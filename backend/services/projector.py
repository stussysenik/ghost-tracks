"""Projector: unit-space ArtPlan + Placement → geographic trace.

LESSON — keeping provenance through coordinate changes
======================================================
Projection has three steps, each of which must NOT lose the segment index
map the kernel needs:

  1. rotate the unit canvas about its center (unit space is isotropic, so
     rotation is exact here — doing it in lng/lat would shear the art
     because a degree of longitude is shorter than a degree of latitude),
  2. fit metrically into the placement bbox (uniform scale in METERS, not
     degrees, again to avoid shear),
  3. densify to ~80 m segments so map matching has enough vertices.

Densification inserts points, so original polyline indices move. We return
an explicit ``index_map`` (old index → new index) and re-express the plan's
segment ranges with it — the kernel receives ranges into the trace it is
actually given.
"""

from __future__ import annotations

import math

from models.ir import ArtPlan, SegmentMeta
from models.schemas import Coordinate
from services.street_mapper import haversine_distance_m

# Meters per degree of latitude is ~constant; longitude shrinks with cos(lat).
_M_PER_DEG_LAT = 110_540.0
_M_PER_DEG_LNG_EQUATOR = 111_320.0


def _rotate_unit(points: list[list[float]], degrees: float) -> list[list[float]]:
    """Rotate about the unit-canvas center (0.5, 0.5)."""
    if not degrees:
        return [list(p) for p in points]
    rad = math.radians(degrees)
    cos_r, sin_r = math.cos(rad), math.sin(rad)
    out = []
    for x, y in points:
        dx, dy = x - 0.5, y - 0.5
        out.append([0.5 + dx * cos_r - dy * sin_r, 0.5 + dx * sin_r + dy * cos_r])
    return out


def densify_with_index_map(
    coords: list[list[float]], max_segment_m: float = 80.0
) -> tuple[list[list[float]], list[int]]:
    """Insert intermediate points on long segments, tracking index movement.

    Returns ``(dense, index_map)`` where ``index_map[i]`` is the position of
    original point i inside ``dense`` — the tool that lets SegmentMeta
    ranges survive densification.
    """
    if len(coords) < 2:
        return [list(c) for c in coords], list(range(len(coords)))

    dense: list[list[float]] = [list(coords[0])]
    index_map: list[int] = [0]
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        dist = haversine_distance_m(
            Coordinate(lng=a[0], lat=a[1]), Coordinate(lng=b[0], lat=b[1])
        )
        if dist > max_segment_m:
            n_segments = math.ceil(dist / max_segment_m)
            for j in range(1, n_segments):
                frac = j / n_segments
                dense.append([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac])
        dense.append(list(b))
        index_map.append(len(dense) - 1)
    return dense, index_map


def remap_segments(segments: list[SegmentMeta], index_map: list[int]) -> list[SegmentMeta]:
    """Re-express segment ranges in densified-trace indices."""
    return [
        SegmentMeta(
            kind=s.kind,
            retrace=s.retrace,
            start_idx=index_map[s.start_idx],
            end_idx=index_map[s.end_idx],
        )
        for s in segments
    ]


def project(
    plan: ArtPlan,
    placement,
    max_segment_m: float = 80.0,
) -> tuple[list[list[float]], list[SegmentMeta]]:
    """Project a composed plan onto the placement bbox.

    Returns ``(trace, segments)``: the densified ``[[lng, lat], ...]`` trace
    and the plan's segments re-expressed as ranges into that trace.
    """
    rotated = _rotate_unit([list(p) for p in plan.continuous], placement.rotation_deg)
    if not rotated:
        return [], []

    bbox = placement.bbox
    center = bbox.center()
    m_per_deg_lng = _M_PER_DEG_LNG_EQUATOR * math.cos(math.radians(center.lat))
    bbox_w_m = bbox.width_deg() * m_per_deg_lng
    bbox_h_m = bbox.height_deg() * _M_PER_DEG_LAT

    xs = [p[0] for p in rotated]
    ys = [p[1] for p in rotated]
    src_w = (max(xs) - min(xs)) or 1e-9
    src_h = (max(ys) - min(ys)) or 1e-9
    src_cx = (max(xs) + min(xs)) / 2
    src_cy = (max(ys) + min(ys)) / 2

    # Uniform scale in METERS keeps the art's true aspect on the ground.
    scale_m = min(bbox_w_m / src_w, bbox_h_m / src_h)

    geo: list[list[float]] = []
    for x, y in rotated:
        east_m = (x - src_cx) * scale_m
        north_m = (y - src_cy) * scale_m
        geo.append(
            [center.lng + east_m / m_per_deg_lng, center.lat + north_m / _M_PER_DEG_LAT]
        )

    dense, index_map = densify_with_index_map(geo, max_segment_m=max_segment_m)
    return dense, remap_segments(plan.segments, index_map)
