"""Core shape generation service - orchestrates LLM, templates, mapping, and validation."""

from __future__ import annotations

import os
from typing import Optional

import dspy
import httpx

from models.schemas import (
    BoundingBox,
    Coordinate,
    DescribeResponse,
    GenerateResponse,
    ShapeIdea,
    WaypointMarker,
)
from services.llm import (
    DescriptionToShape,
    FindOptimalArea,
    GenerateShapeIdeas,
    configure_llm,
    coords_from_raw,
    parse_ideas_json,
    parse_shape_json,
)
from services.neighborhood import NeighborhoodService
from services.shape_templates import get_parametric_shape
from services.shape_validator import ShapeValidator
from services.street_mapper import StreetMapper, haversine_distance_m

MAX_RETRIES = int(os.environ.get("MAX_GENERATION_RETRIES", "2"))
SVELTEKIT_URL = os.environ.get("SVELTEKIT_URL", "http://127.0.0.1:4173")


class ShapeGenerator:
    def __init__(self) -> None:
        self.neighborhood_service = NeighborhoodService()
        self.street_mapper = StreetMapper()
        self.validator = ShapeValidator()
        self._lm = configure_llm()
        self._generate_ideas = dspy.Predict(GenerateShapeIdeas) if self._lm else None
        self._describe_to_shape = dspy.Predict(DescriptionToShape) if self._lm else None
        self._find_area = dspy.Predict(FindOptimalArea) if self._lm else None

    async def generate_for_neighborhood(
        self,
        neighborhood: str,
        count: int = 3,
    ) -> GenerateResponse:
        """Mode A: Generate shape ideas for a neighborhood."""
        hood = self.neighborhood_service.get_by_name(neighborhood)
        if not hood:
            raise ValueError(f"Unknown neighborhood: {neighborhood}")

        ideas: list[ShapeIdea] = []

        # Try LLM first
        if self._generate_ideas:
            try:
                ideas = await self._generate_with_llm(hood, count)
            except Exception as e:
                print(f"LLM generation failed, falling back to templates: {e}")

        # Fallback to parametric templates
        if not ideas:
            ideas = self._generate_with_templates(hood, count)

        return GenerateResponse(
            ideas=ideas,
            neighborhood=hood.name,
            bbox=hood.bbox,
        )

    async def generate_from_description(
        self,
        description: str,
        max_distance_km: float = 10.0,
        neighborhood: str | None = None,
    ) -> DescribeResponse:
        """Mode B: Generate a route from a text description."""
        # Step 1: Find optimal neighborhood (or use the one specified)
        if neighborhood:
            hood = self.neighborhood_service.get_by_name(neighborhood)
            if not hood:
                raise ValueError(f"Unknown neighborhood: {neighborhood}")
        else:
            hood = await self._find_neighborhood(description)

        # Get alternative neighborhoods (top 3, excluding current)
        all_ranked = self.neighborhood_service.find_best_for_shape(description, max_distance_km)
        alternative_neighborhoods = [
            h.name for h in all_ranked if h.name != hood.name
        ][:3]

        # Step 2: Generate control points
        control_points = await self._generate_control_points(description, hood.bbox)

        # Step 3: Map to streets
        mapped = self.street_mapper.map_to_streets(control_points, hood.bbox)

        # Step 4: Route via Mapbox (through SvelteKit proxy)
        routed = await self._route_waypoints(mapped)

        # Step 5: Extract waypoints with turn instructions
        waypoints = self._extract_waypoints(routed["coordinates"])

        # Step 6: Validate shape (compare mapped waypoints vs routed result,
        # since both are in the same geographic space after scale_to_bbox)
        routed_coords = [Coordinate(lng=c[0], lat=c[1]) for c in routed["coordinates"]]
        validation = await self.validator.validate(
            target_description=description,
            target_points=mapped,
            actual_points=routed_coords,
        )

        # Step 7: Retry if validation fails — targeted tightening
        retries = 0
        while not validation.passed and retries < MAX_RETRIES:
            retries += 1
            control_points = self._tighten_control_points(
                control_points, routed_coords
            )
            mapped = self.street_mapper.map_to_streets(control_points, hood.bbox)
            routed = await self._route_waypoints(mapped)
            routed_coords = [Coordinate(lng=c[0], lat=c[1]) for c in routed["coordinates"]]
            validation = await self.validator.validate(
                target_description=description,
                target_points=mapped,
                actual_points=routed_coords,
            )
            waypoints = self._extract_waypoints(routed["coordinates"])

        shape = ShapeIdea(
            name=description.title(),
            description=f"A {description} route through {hood.name}",
            emoji=self._emoji_for_description(description),
            estimated_distance_km=routed["distance_km"],
            difficulty=self._difficulty_for_distance(routed["distance_km"]),
            control_points=control_points,
            target_area=hood.name,
        )

        return DescribeResponse(
            shape=shape,
            neighborhood=hood.name,
            bbox=hood.bbox,
            similarity_score=validation.score,
            routed_coordinates=routed["coordinates"],
            distance_km=routed["distance_km"],
            duration_minutes=routed["duration_minutes"],
            waypoints=waypoints,
            alternative_neighborhoods=alternative_neighborhoods,
        )

    # --- Private helpers ---

    async def _generate_with_llm(self, hood, count: int) -> list[ShapeIdea]:
        """Generate ideas using GLM-4.7 via DSPy."""
        bbox_str = f"{hood.bbox.min_lng},{hood.bbox.min_lat},{hood.bbox.max_lng},{hood.bbox.max_lat}"
        result = self._generate_ideas(
            neighborhood=hood.name,
            street_layout=hood.street_layout,
            bbox=bbox_str,
            count=count,
        )
        raw_ideas = parse_ideas_json(result.ideas_json)
        ideas: list[ShapeIdea] = []
        for raw in raw_ideas[:count]:
            points = coords_from_raw(raw.get("control_points", []))
            if len(points) < 3:
                continue
            mapped = self.street_mapper.map_to_streets(points, hood.bbox)
            ideas.append(ShapeIdea(
                name=raw.get("name", "Unnamed"),
                description=raw.get("description", ""),
                emoji=raw.get("emoji", ""),
                estimated_distance_km=self.street_mapper.estimate_distance_km(mapped),
                difficulty=raw.get("difficulty", "moderate"),
                control_points=mapped,
                target_area=hood.name,
            ))
        return ideas

    def _generate_with_templates(self, hood, count: int) -> list[ShapeIdea]:
        """Fallback: generate ideas from parametric templates."""
        template_names = ["heart", "star", "triangle", "circle", "arrow", "square"]
        emojis = {"heart": "❤️", "star": "⭐", "triangle": "🔺", "circle": "⭕", "arrow": "➡️", "square": "⬜"}
        ideas: list[ShapeIdea] = []
        center = hood.bbox.center()
        scale = min(hood.bbox.width_deg(), hood.bbox.height_deg()) * 0.7

        for name in template_names[:count]:
            raw_points = get_parametric_shape(name, center, scale)
            mapped = self.street_mapper.map_to_streets(raw_points, hood.bbox)
            ideas.append(ShapeIdea(
                name=f"{name.title()} in {hood.name}",
                description=f"A {name} shape traced through the streets of {hood.name}",
                emoji=emojis.get(name, ""),
                estimated_distance_km=self.street_mapper.estimate_distance_km(mapped),
                difficulty="moderate",
                control_points=mapped,
                target_area=hood.name,
            ))
        return ideas

    async def _find_neighborhood(self, description: str):
        """Find the best neighborhood for a description."""
        if self._find_area:
            try:
                summary = self.neighborhood_service.get_summary_string()
                result = self._find_area(
                    description=description,
                    neighborhoods=summary,
                )
                hood = self.neighborhood_service.get_by_name(result.best_neighborhood)
                if hood:
                    return hood
            except Exception:
                pass

        # Fallback: use heuristics
        best = self.neighborhood_service.find_best_for_shape(description, 5.0)
        if best:
            return best[0]
        # Last resort
        all_hoods = self.neighborhood_service.get_all()
        return all_hoods[0] if all_hoods else None

    async def _generate_control_points(
        self, description: str, bbox: BoundingBox
    ) -> list[Coordinate]:
        """Generate control points from description."""
        if self._describe_to_shape:
            try:
                bbox_str = f"{bbox.min_lng},{bbox.min_lat},{bbox.max_lng},{bbox.max_lat}"
                result = self._describe_to_shape(
                    description=description,
                    target_bbox=bbox_str,
                )
                raw = parse_shape_json(result.shape_json)
                points = coords_from_raw(raw.get("control_points", []))
                if len(points) >= 3:
                    return points
            except Exception:
                pass

        # Fallback to parametric template
        center = bbox.center()
        scale = min(bbox.width_deg(), bbox.height_deg()) * 0.7
        return get_parametric_shape(description, center, scale)

    async def _route_waypoints(self, waypoints: list[Coordinate]) -> dict:
        """Route waypoints through Mapbox Directions API via SvelteKit proxy."""
        coords = [[w.lng, w.lat] for w in waypoints]

        # Try SvelteKit /api/route endpoint first
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{SVELTEKIT_URL}/api/route",
                    json={"waypoints": coords, "profile": "walking"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        return {
                            "coordinates": data["coordinates"],
                            "distance_km": data["distance_km"],
                            "duration_minutes": data["duration_minutes"],
                        }
        except Exception as e:
            print(f"SvelteKit routing failed: {e}")

        # Fallback: call Mapbox directly
        mapbox_token = os.environ.get("MAPBOX_ACCESS_TOKEN") or os.environ.get(
            "VITE_MAPBOX_ACCESS_TOKEN"
        )
        if not mapbox_token:
            # Return unrouted coordinates as fallback
            return {
                "coordinates": coords,
                "distance_km": self.street_mapper.estimate_distance_km(waypoints),
                "duration_minutes": int(
                    self.street_mapper.estimate_distance_km(waypoints) / 5 * 60
                ),
            }

        # Chunk if > 25 waypoints
        all_coords: list[list[float]] = []
        total_dist = 0.0
        total_dur = 0.0
        chunk_size = 25

        for i in range(0, len(coords), chunk_size - 1):
            chunk = coords[i : i + chunk_size]
            if len(chunk) < 2:
                continue
            coords_str = ";".join(f"{c[0]},{c[1]}" for c in chunk)
            url = (
                f"https://api.mapbox.com/directions/v5/mapbox/walking/{coords_str}"
                f"?geometries=geojson&overview=full&steps=true&access_token={mapbox_token}"
            )
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url)
                data = resp.json()

            if data.get("code") != "Ok" or not data.get("routes"):
                continue

            route = data["routes"][0]
            route_coords = route["geometry"]["coordinates"]

            if all_coords:
                all_coords.extend(route_coords[1:])  # skip overlap point
            else:
                all_coords.extend(route_coords)

            total_dist += route["distance"] / 1000
            total_dur += route["duration"] / 60

        return {
            "coordinates": all_coords or coords,
            "distance_km": round(total_dist, 1) or self.street_mapper.estimate_distance_km(waypoints),
            "duration_minutes": round(total_dur) or int(
                self.street_mapper.estimate_distance_km(waypoints) / 5 * 60
            ),
        }

    def _extract_waypoints(self, coordinates: list[list[float]]) -> list[WaypointMarker]:
        """Extract turn points from routed coordinates."""
        import math

        if len(coordinates) < 3:
            return [
                WaypointMarker(index=i + 1, lng=c[0], lat=c[1], instruction="Waypoint")
                for i, c in enumerate(coordinates)
            ]

        def bearing(a: list[float], b: list[float]) -> float:
            d_lng = math.radians(b[0] - a[0])
            lat1 = math.radians(a[1])
            lat2 = math.radians(b[1])
            x = math.sin(d_lng) * math.cos(lat2)
            y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(
                d_lng
            )
            return math.degrees(math.atan2(x, y)) % 360

        waypoints: list[WaypointMarker] = []
        # Always include start
        waypoints.append(WaypointMarker(
            index=1, lng=coordinates[0][0], lat=coordinates[0][1], instruction="Start here"
        ))

        # Sample every Nth point to avoid too many markers (target ~15-25 waypoints)
        step = max(1, len(coordinates) // 50)
        threshold = 30  # degrees

        for i in range(step, len(coordinates) - step, step):
            prev = coordinates[i - step]
            curr = coordinates[i]
            next_p = coordinates[min(i + step, len(coordinates) - 1)]

            b1 = bearing(prev, curr)
            b2 = bearing(curr, next_p)
            angle_change = abs(b2 - b1)
            if angle_change > 180:
                angle_change = 360 - angle_change

            if angle_change >= threshold:
                # Determine turn direction
                cross = (b2 - b1 + 360) % 360
                if angle_change > 150:
                    instruction = "Make a U-turn"
                elif cross < 180:
                    instruction = "Turn right" if angle_change > 60 else "Bear right"
                else:
                    instruction = "Turn left" if angle_change > 60 else "Bear left"

                waypoints.append(WaypointMarker(
                    index=len(waypoints) + 1,
                    lng=curr[0],
                    lat=curr[1],
                    instruction=instruction,
                ))

        # Always include end
        last = coordinates[-1]
        waypoints.append(WaypointMarker(
            index=len(waypoints) + 1,
            lng=last[0],
            lat=last[1],
            instruction="Finish!",
        ))

        return waypoints

    def _tighten_control_points(
        self,
        target_points: list[Coordinate],
        actual_points: list[Coordinate],
    ) -> list[Coordinate]:
        """Deviation-targeted tightening: add extra control points only where
        the actual route deviates most from the target shape.

        Instead of blindly adding midpoints everywhere, this finds segments
        where the routed path strays and inserts corrective waypoints.
        """
        if len(target_points) < 2:
            return target_points

        # For each target segment, find the max deviation of actual points
        segment_deviations: list[tuple[int, float]] = []
        for i in range(len(target_points) - 1):
            a, b = target_points[i], target_points[i + 1]
            mid = Coordinate(lng=(a.lng + b.lng) / 2, lat=(a.lat + b.lat) / 2)

            # Find closest actual point to this midpoint
            if actual_points:
                min_dist = min(haversine_distance_m(mid, ap) for ap in actual_points)
            else:
                min_dist = 0.0
            segment_deviations.append((i, min_dist))

        # Sort by deviation (worst first) and pick top 50% of segments
        segment_deviations.sort(key=lambda x: x[1], reverse=True)
        segments_to_tighten = {
            idx for idx, _ in segment_deviations[: max(1, len(segment_deviations) // 2)]
        }

        result: list[Coordinate] = [target_points[0]]
        for i in range(len(target_points) - 1):
            a, b = target_points[i], target_points[i + 1]
            if i in segments_to_tighten:
                # Add midpoint for this deviating segment
                mid = Coordinate(lng=(a.lng + b.lng) / 2, lat=(a.lat + b.lat) / 2)
                result.append(mid)
            result.append(b)
        return result

    @staticmethod
    def _emoji_for_description(desc: str) -> str:
        """Pick an emoji based on the description."""
        desc_l = desc.lower()
        mapping = {
            "heart": "❤️", "star": "⭐", "circle": "⭕", "triangle": "🔺",
            "arrow": "➡️", "square": "⬜", "cat": "🐱", "dog": "🐕",
            "fox": "🦊", "bird": "🐦", "rabbit": "🐰", "fish": "🐟",
            "flower": "🌸", "tree": "🌳", "house": "🏠", "crown": "👑",
            "lightning": "⚡", "moon": "🌙", "sun": "☀️", "diamond": "💎",
        }
        for key, emoji in mapping.items():
            if key in desc_l:
                return emoji
        return "✨"

    @staticmethod
    def _difficulty_for_distance(km: float) -> str:
        if km < 4:
            return "easy"
        if km < 8:
            return "moderate"
        return "hard"
