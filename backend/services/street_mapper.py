"""Map abstract shape control points to real street waypoints."""

from __future__ import annotations

import math

from models.schemas import BoundingBox, Coordinate


def haversine_distance_m(a: Coordinate, b: Coordinate) -> float:
    """Distance in meters between two coordinates."""
    R = 6_371_000  # Earth radius in meters
    phi1 = math.radians(a.lat)
    phi2 = math.radians(b.lat)
    d_phi = math.radians(b.lat - a.lat)
    d_lambda = math.radians(b.lng - a.lng)
    a_val = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a_val), math.sqrt(1 - a_val))


def _bearing_deg(a: Coordinate, b: Coordinate) -> float:
    """Compute initial bearing from a to b in degrees [0, 360)."""
    d_lng = math.radians(b.lng - a.lng)
    lat1 = math.radians(a.lat)
    lat2 = math.radians(b.lat)
    x = math.sin(d_lng) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(d_lng)
    return math.degrees(math.atan2(x, y)) % 360


class StreetMapper:
    """Maps abstract shape control points to street-snappable waypoints."""

    def scale_to_bbox(
        self,
        points: list[Coordinate],
        target_bbox: BoundingBox,
        padding_pct: float = 0.1,
    ) -> list[Coordinate]:
        """Scale and center control points to fit within a target bounding box.

        Preserves aspect ratio.
        """
        if not points:
            return []

        # Compute shape bounds
        lngs = [p.lng for p in points]
        lats = [p.lat for p in points]
        s_min_lng, s_max_lng = min(lngs), max(lngs)
        s_min_lat, s_max_lat = min(lats), max(lats)
        s_width = s_max_lng - s_min_lng or 1e-6
        s_height = s_max_lat - s_min_lat or 1e-6
        s_cx = (s_min_lng + s_max_lng) / 2
        s_cy = (s_min_lat + s_max_lat) / 2

        # Target bounds with padding
        pad_lng = target_bbox.width_deg() * padding_pct
        pad_lat = target_bbox.height_deg() * padding_pct
        t_width = target_bbox.width_deg() - 2 * pad_lng
        t_height = target_bbox.height_deg() - 2 * pad_lat
        t_cx = (target_bbox.min_lng + target_bbox.max_lng) / 2
        t_cy = (target_bbox.min_lat + target_bbox.max_lat) / 2

        # Scale preserving aspect ratio
        scale = min(t_width / s_width, t_height / s_height)

        return [
            Coordinate(
                lng=t_cx + (p.lng - s_cx) * scale,
                lat=t_cy + (p.lat - s_cy) * scale,
            )
            for p in points
        ]

    def densify(
        self,
        points: list[Coordinate],
        max_segment_m: float = 80.0,
    ) -> list[Coordinate]:
        """Interpolate points that are too far apart."""
        if len(points) < 2:
            return list(points)

        result: list[Coordinate] = [points[0]]
        for i in range(len(points) - 1):
            a, b = points[i], points[i + 1]
            dist = haversine_distance_m(a, b)
            if dist > max_segment_m:
                n_segments = math.ceil(dist / max_segment_m)
                for j in range(1, n_segments):
                    frac = j / n_segments
                    result.append(Coordinate(
                        lng=a.lng + (b.lng - a.lng) * frac,
                        lat=a.lat + (b.lat - a.lat) * frac,
                    ))
            result.append(b)
        return result

    def deduplicate(
        self,
        points: list[Coordinate],
        min_distance_m: float = 12.0,
    ) -> list[Coordinate]:
        """Remove waypoints that are too close together, preserving turns.

        Points where the bearing changes by more than 20 degrees are always
        kept, even if they are closer than min_distance_m to the previous
        point. This preserves corners, star tips, and tight curves.
        """
        if len(points) < 2:
            return list(points)

        result: list[Coordinate] = [points[0]]
        for i in range(1, len(points)):
            p = points[i]
            dist = haversine_distance_m(result[-1], p)

            if dist >= min_distance_m:
                result.append(p)
            elif i < len(points) - 1:
                # Curvature-aware: keep the point if bearing changes sharply
                prev = result[-1]
                next_p = points[i + 1]
                b_in = _bearing_deg(prev, p)
                b_out = _bearing_deg(p, next_p)
                angle_change = abs(b_out - b_in)
                if angle_change > 180:
                    angle_change = 360 - angle_change
                if angle_change > 20:
                    result.append(p)

        # Always keep the last point
        if result[-1] != points[-1]:
            result.append(points[-1])
        return result

    def split_into_segments(
        self,
        points: list[Coordinate],
        n_segments: int = 6,
    ) -> list[list[Coordinate]]:
        """Split a shape into n roughly equal arc-length segments.

        Each segment overlaps by 1 point with the next for stitching.
        Based on Variant E (Segment-Wise) from the shape-routing-algorithms
        experiment which showed +0.2% avg improvement and best scores on
        complex shapes (triangle, letterA).
        """
        if len(points) < 2 or n_segments < 2:
            return [list(points)]

        # Compute cumulative arc lengths
        arc_lengths = [0.0]
        for i in range(1, len(points)):
            arc_lengths.append(
                arc_lengths[-1] + haversine_distance_m(points[i - 1], points[i])
            )
        total_length = arc_lengths[-1]
        if total_length < 1.0:
            return [list(points)]

        segment_length = total_length / n_segments
        segments: list[list[Coordinate]] = []
        current_segment: list[Coordinate] = [points[0]]
        current_target = segment_length
        seg_idx = 1

        for i in range(1, len(points)):
            current_segment.append(points[i])
            if arc_lengths[i] >= current_target and seg_idx < n_segments:
                segments.append(current_segment)
                # Start new segment with overlap (last point of previous)
                current_segment = [points[i]]
                seg_idx += 1
                current_target = segment_length * seg_idx

        # Add remaining points to last segment
        if current_segment:
            if segments and current_segment[0] == segments[-1][-1] and len(current_segment) == 1:
                pass  # empty segment, skip
            else:
                segments.append(current_segment)

        return segments if segments else [list(points)]

    def map_to_streets(
        self,
        control_points: list[Coordinate],
        target_bbox: BoundingBox,
    ) -> list[Coordinate]:
        """Segment-wise pipeline: scale → split → per-segment densify+dedup → stitch.

        Uses the Variant E (Segment-Wise) approach from the shape-routing-algorithms
        experiment. Splits the shape into 6 arc-length segments and processes each
        independently with tighter parameters (50m densify, 10m dedup) for better
        fidelity on complex shapes.
        """
        scaled = self.scale_to_bbox(control_points, target_bbox)
        segments = self.split_into_segments(scaled, n_segments=6)

        result: list[Coordinate] = []
        for seg in segments:
            dense = self.densify(seg, max_segment_m=50.0)
            clean = self.deduplicate(dense, min_distance_m=10.0)
            if result and clean and result[-1] == clean[0]:
                clean = clean[1:]  # remove overlap point
            result.extend(clean)

        return result

    def estimate_distance_km(self, points: list[Coordinate]) -> float:
        """Estimate total route distance from waypoints."""
        total = 0.0
        for i in range(len(points) - 1):
            total += haversine_distance_m(points[i], points[i + 1])
        return round(total / 1000, 1)
