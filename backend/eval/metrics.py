"""Per-stage eval metrics for the shape-generation pipeline.

Three stages, matching the pipeline's failure surfaces (design D3):

- **extraction**: does the extracted path match the source silhouette? (raster IoU)
- **snapping**: does the routed polyline follow the intended shape? (Hausdorff +
  modified Hausdorff + discrete Fréchet, normalized by shape diameter)
- **runnability**: is the route humanly runnable? (loop closure, distance error
  vs. target, repeat ratio)

Geometry helpers are reused from `services.shape_validator` so the eval and the
runtime validator measure the same thing.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict

from models.schemas import Coordinate
from services.shape_validator import (
    _compute_diameter,
    _modified_hausdorff_distance,
    hausdorff_distance,
)
from services.street_mapper import haversine_distance_m


# --- Snapping: discrete Fréchet ------------------------------------------------


def discrete_frechet_distance(a: list[Coordinate], b: list[Coordinate]) -> float:
    """Discrete Fréchet distance between two polylines, in meters.

    Unlike Hausdorff (a set metric), Fréchet respects point ordering — it is the
    "minimum leash length" for two dogs walking their paths without backtracking.
    This catches shape distortions (a router that visits the right places in the
    wrong order) that Hausdorff misses.
    """
    if not a or not b:
        return float("inf")

    n, m = len(a), len(b)
    # ca[j] holds the coupling measure for the current row i.
    prev = [0.0] * m
    curr = [0.0] * m
    for i in range(n):
        for j in range(m):
            d = haversine_distance_m(a[i], b[j])
            if i == 0 and j == 0:
                curr[j] = d
            elif i == 0:
                curr[j] = max(curr[j - 1], d)
            elif j == 0:
                curr[j] = max(prev[j], d)
            else:
                curr[j] = max(min(prev[j], prev[j - 1], curr[j - 1]), d)
        prev, curr = curr, prev
    return prev[m - 1]


# --- Runnability ---------------------------------------------------------------


def route_length_km(route: list[Coordinate]) -> float:
    """Total polyline length in kilometers."""
    total = 0.0
    for i in range(len(route) - 1):
        total += haversine_distance_m(route[i], route[i + 1])
    return total / 1000.0


def loop_closure_gap_m(route: list[Coordinate]) -> float:
    """Straight-line gap between the route's first and last point, in meters."""
    if len(route) < 2:
        return 0.0
    return haversine_distance_m(route[0], route[-1])


def is_loop(route: list[Coordinate], tol_m: float = 50.0) -> bool:
    """True when the route returns to (near) its start."""
    return loop_closure_gap_m(route) <= tol_m


def distance_error(routed_km: float, target_km: float) -> float:
    """Relative distance error |routed - target| / target (0 = perfect)."""
    if target_km <= 0:
        return float("inf")
    return abs(routed_km - target_km) / target_km


def repeat_ratio(route: list[Coordinate], cell_m: float = 25.0) -> float:
    """Fraction of the route that retraces ground already covered.

    The polyline is walked at ~`cell_m` resolution and each step is binned into a
    square grid cell (local equirectangular meters). The ratio is
    `1 - unique_cells / visited_cells`: an out-and-back on the same street
    approaches ~0.5, a clean non-overlapping loop approaches ~0.0.
    """
    if len(route) < 2:
        return 0.0

    lat0 = route[0].lat
    import math

    m_per_deg_lat = 111_320.0
    m_per_deg_lng = 111_320.0 * math.cos(math.radians(lat0))

    def cell_of(c: Coordinate) -> tuple[int, int]:
        x_m = c.lng * m_per_deg_lng
        y_m = c.lat * m_per_deg_lat
        return (int(x_m // cell_m), int(y_m // cell_m))

    # Sample by cumulative arc length, not per segment: the sample count must depend
    # on how far the route goes, never on how densely its polyline is vertexed.
    visited: list[tuple[int, int]] = []
    next_at = 0.0
    walked = 0.0
    for a, b in zip(route, route[1:]):
        seg = haversine_distance_m(a, b)
        while next_at <= walked + seg:
            frac = (next_at - walked) / seg if seg > 0 else 0.0
            visited.append(
                cell_of(
                    Coordinate(
                        lng=a.lng + (b.lng - a.lng) * frac,
                        lat=a.lat + (b.lat - a.lat) * frac,
                    )
                )
            )
            next_at += cell_m
        walked += seg
    visited.append(cell_of(route[-1]))

    if not visited:
        return 0.0
    unique = len(set(visited))
    return round(1.0 - unique / len(visited), 4)


# --- Aggregated per-stage scores ----------------------------------------------


@dataclass
class StageScores:
    """Per-stage metrics for a single fixture's routed result.

    Raw geometric quantities plus normalized [0,100] scores where a normalization
    makes sense; runnability keeps raw booleans/ratios so thresholds stay honest.
    """

    # extraction (identity for parametric fixtures → 100 unless a source raster given)
    extraction_iou: float

    # snapping (meters + normalized-by-diameter scores in [0,100])
    hausdorff_m: float
    modified_hausdorff_m: float
    frechet_m: float
    diameter_m: float
    snap_score: float  # blended, higher = better

    # runnability
    routed_km: float
    target_km: float
    loop_closure_gap_m: float
    is_loop: bool
    distance_error: float
    repeat_ratio: float

    extras: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def _snap_score(hausdorff_m: float, mhd_m: float, frechet_m: float, diameter_m: float) -> float:
    """Blend snapping distances into a [0,100] score, normalized by shape size.

    Weights favor the ordered metrics (modified Hausdorff + Fréchet) because a
    good-looking route can have a low max-Hausdorff yet the wrong traversal order.
    """
    if diameter_m <= 0:
        return 0.0

    def norm(d: float) -> float:
        return (1.0 - min(d / diameter_m, 1.0)) * 100.0

    return round(0.25 * norm(hausdorff_m) + 0.40 * norm(mhd_m) + 0.35 * norm(frechet_m), 1)


def score_fixture(
    target: list[Coordinate],
    routed: list[Coordinate],
    target_km: float,
    *,
    extraction_iou: float = 100.0,
) -> StageScores:
    """Compute all per-stage metrics for one fixture's routed result.

    `target` is the intended on-map polyline (post scale-to-bbox); `routed` is the
    router's output. `extraction_iou` defaults to 100 (identity) for parametric
    fixtures that skip the image→path extraction stage.
    """
    diameter = _compute_diameter(target) if target else 0.0

    if not target or not routed:
        return StageScores(
            extraction_iou=extraction_iou,
            hausdorff_m=float("inf"),
            modified_hausdorff_m=float("inf"),
            frechet_m=float("inf"),
            diameter_m=diameter,
            snap_score=0.0,
            routed_km=route_length_km(routed),
            target_km=target_km,
            loop_closure_gap_m=loop_closure_gap_m(routed),
            is_loop=False,
            distance_error=distance_error(route_length_km(routed), target_km),
            repeat_ratio=repeat_ratio(routed),
        )

    hd = hausdorff_distance(target, routed)
    mhd = _modified_hausdorff_distance(target, routed, percentile=90)
    frechet = discrete_frechet_distance(target, routed)
    routed_km = route_length_km(routed)

    return StageScores(
        extraction_iou=round(extraction_iou, 1),
        hausdorff_m=round(hd, 1),
        modified_hausdorff_m=round(mhd, 1),
        frechet_m=round(frechet, 1),
        diameter_m=round(diameter, 1),
        snap_score=_snap_score(hd, mhd, frechet, diameter),
        routed_km=round(routed_km, 3),
        target_km=target_km,
        loop_closure_gap_m=round(loop_closure_gap_m(routed), 1),
        is_loop=is_loop(routed),
        distance_error=round(distance_error(routed_km, target_km), 4),
        repeat_ratio=repeat_ratio(routed),
    )
