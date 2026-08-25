"""Shape feasibility checking — can a shape be drawn at a given location?"""

from __future__ import annotations

import math

from models.schemas import (
    AlternativeLocation,
    BoundingBox,
    CityResult,
    Coordinate,
    FeasibilityRequest,
    FeasibilityResponse,
    ScoreBreakdown,
)
from services.neighborhood import NeighborhoodService, WORLD_CITIES
from services.shape_templates import get_parametric_shape
from services.shape_validator import (
    ShapeValidator,
    _modified_hausdorff_distance,
    _compute_diameter,
    _ordered_sampling_score,
    _raster_iou_score,
)
from services.street_mapper import StreetMapper, haversine_distance_m

FEASIBILITY_THRESHOLD = 90  # premium bar


class FeasibilityService:
    def __init__(self) -> None:
        self.mapper = StreetMapper()
        self.validator = ShapeValidator()
        self.neighborhood_service = NeighborhoodService()

    def center_to_bbox(self, center: Coordinate, radius_km: float) -> BoundingBox:
        """Convert center + radius to bounding box."""
        # 1 degree lat ~ 111km, 1 degree lng ~ 111km * cos(lat)
        lat_offset = radius_km / 111.0
        lng_offset = radius_km / (111.0 * math.cos(math.radians(center.lat)))
        return BoundingBox(
            min_lng=center.lng - lng_offset,
            min_lat=center.lat - lat_offset,
            max_lng=center.lng + lng_offset,
            max_lat=center.lat + lat_offset,
        )

    def _compute_breakdown(
        self,
        target_points: list[Coordinate],
        mapped_points: list[Coordinate],
    ) -> ScoreBreakdown:
        """Compute the three individual score components for the breakdown."""
        diameter = _compute_diameter(target_points)
        if diameter == 0:
            return ScoreBreakdown(hausdorff=0.0, ordered_sampling=0.0, raster_iou=0.0)

        # Modified Hausdorff (90th percentile) -> score
        mhd = _modified_hausdorff_distance(target_points, mapped_points, percentile=90)
        mhd_norm = min(mhd / diameter, 1.0)
        mhd_score = (1.0 - mhd_norm) * 100

        # Ordered sampling score
        os_score = _ordered_sampling_score(target_points, mapped_points, n_samples=50)

        # Raster IoU score
        iou_score = _raster_iou_score(target_points, mapped_points, size=128, line_width=12)

        return ScoreBreakdown(
            hausdorff=round(mhd_score, 1),
            ordered_sampling=round(float(os_score), 1),
            raster_iou=round(float(iou_score), 1),
        )

    def check_feasibility(self, request: FeasibilityRequest) -> FeasibilityResponse:
        """Check if a shape can be drawn at the given location with >=90% similarity."""
        bbox = self.center_to_bbox(request.center, request.radius_km)

        # Generate control points for the shape
        control_points = get_parametric_shape(request.description, request.center)

        # Map to streets using segment-wise algorithm
        mapped = self.mapper.map_to_streets(control_points, bbox)

        # Validate shape similarity using the algorithmic validator.
        # _validate_algorithmic returns a ValidationResult with .score, .passed, etc.
        validation = self.validator._validate_algorithmic(
            mapped, control_points, FEASIBILITY_THRESHOLD
        )

        # Compute individual breakdown scores
        breakdown = self._compute_breakdown(control_points, mapped)

        score = validation.score
        feasible = score >= FEASIBILITY_THRESHOLD

        # Find alternatives if not feasible
        alternatives: list[AlternativeLocation] = []
        if not feasible:
            alternatives = self._find_nearest_feasible(request.description, request.center)

        # Always compute other cities (for "show more")
        other_cities = self._check_other_cities(request.description)

        return FeasibilityResponse(
            feasible=feasible,
            score=round(score, 1),
            breakdown=breakdown,
            bbox_used=bbox,
            route=None,  # Route generation would be a separate call
            nearest_alternatives=alternatives,
            other_cities=other_cities,
        )

    def _find_nearest_feasible(
        self, description: str, center: Coordinate
    ) -> list[AlternativeLocation]:
        """Find nearest neighborhoods where the shape scores >=90%."""
        neighborhoods = self.neighborhood_service.get_sorted_by_distance(center)
        results: list[AlternativeLocation] = []

        for n in neighborhoods[:6]:  # Check top 6 nearest
            control_points = get_parametric_shape(description, n.center)
            mapped = self.mapper.map_to_streets(control_points, n.bbox)

            validation = self.validator._validate_algorithmic(
                mapped, control_points, FEASIBILITY_THRESHOLD
            )
            score = validation.score
            dist = haversine_distance_m(center, n.center) / 1000

            results.append(AlternativeLocation(
                name=n.name,
                score=round(score, 1),
                distance_km=round(dist, 1),
                center=n.center,
                feasible=score >= FEASIBILITY_THRESHOLD,
            ))

        return sorted(results, key=lambda x: -x.score)[:3]

    def _check_other_cities(self, description: str) -> list[CityResult]:
        """Check feasibility in world cities for the gallery."""
        results: list[CityResult] = []
        for city_name, neighborhoods in WORLD_CITIES.items():
            if not neighborhoods:
                continue
            # Just check the first neighborhood per city
            n = neighborhoods[0]
            control_points = get_parametric_shape(description, n.center)
            mapped = self.mapper.map_to_streets(control_points, n.bbox)

            validation = self.validator._validate_algorithmic(
                mapped, control_points, FEASIBILITY_THRESHOLD
            )
            score = validation.score

            results.append(CityResult(
                city=city_name,
                neighborhood=n.name,
                score=round(score, 1),
                feasible=score >= FEASIBILITY_THRESHOLD,
                center=n.center,
            ))

        return sorted(results, key=lambda x: -x.score)
