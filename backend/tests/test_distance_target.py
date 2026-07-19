"""Distance targeting: footprint scaling until the measured route hits target.

The search logic is tested against a fake router with a known length-vs-scale
curve, so each convergence property is asserted against a function whose answer is
known in advance rather than against whatever the OSM extract happens to do. Two
integration tests then pin the real wiring to the committed extracts.
"""

from __future__ import annotations

import pytest

from eval.fixtures import AREAS, GRAPHS_DIR
from models.schemas import BoundingBox, Coordinate
from services.distance_target import (
    max_scale_within,
    route_to_distance,
    scale_outline,
)
from services.road_graph import RoadGraph, cache_key
from services.shape_router import RoutedShape, ShapeRouter, UnroutableShapeError
from services.street_mapper import StreetMapper, haversine_distance_m
from services.shape_templates import get_parametric_shape

EIXAMPLE = AREAS["eixample"]
SCOTTSDALE = AREAS["scottsdale"]

pytestmark = pytest.mark.skipif(
    not (GRAPHS_DIR / f"{cache_key(EIXAMPLE.bbox)}.graphml").exists(),
    reason="committed eixample extract not present",
)


# --- a router whose length-vs-scale curve we choose --------------------------


class FakeRouter:
    """Returns a route whose length is `curve(scale)`, and counts its calls.

    Scale is recovered from the outline's own span, so the search is exercised
    exactly as it would be against a real router — through the geometry.
    """

    def __init__(self, curve, base_outline: list[Coordinate]) -> None:
        self.curve = curve
        self.base_span = _span_m(base_outline)
        self.scales: list[float] = []

    def route(self, outline: list[Coordinate]) -> RoutedShape:
        k = _span_m(outline) / self.base_span
        self.scales.append(k)
        km = self.curve(k)
        if km <= 0:
            raise UnroutableShapeError([], 0)
        return RoutedShape(list(outline), km, 0, len(outline), len(outline) - 1)


def _span_m(outline: list[Coordinate]) -> float:
    return max(haversine_distance_m(outline[0], p) for p in outline)


SQUARE = [
    Coordinate(lng=2.16, lat=41.39),
    Coordinate(lng=2.17, lat=41.39),
    Coordinate(lng=2.17, lat=41.40),
    Coordinate(lng=2.16, lat=41.40),
    Coordinate(lng=2.16, lat=41.39),
]


# --- geometry ----------------------------------------------------------------


def test_scale_outline_scales_ground_distance_and_holds_position():
    scaled = scale_outline(SQUARE, 0.5)
    original = haversine_distance_m(SQUARE[0], SQUARE[2])
    assert scaled[0] != SQUARE[0]  # corners move
    assert haversine_distance_m(scaled[0], scaled[2]) == pytest.approx(
        original * 0.5, rel=0.01
    )
    # The centroid is the fixed point — the shape shrinks in place, it does not drift.
    cx = sum(c.lng for c in SQUARE) / len(SQUARE)
    cx_scaled = sum(c.lng for c in scaled) / len(scaled)
    assert cx_scaled == pytest.approx(cx, abs=1e-9)


def test_max_scale_within_is_the_room_left_in_the_area():
    # A square spanning half the bbox has room to roughly double.
    bounds = BoundingBox(min_lng=2.15, min_lat=41.38, max_lng=2.18, max_lat=41.41)
    small = scale_outline(SQUARE, 0.5)
    assert max_scale_within(small, bounds) > 1.5
    # Grown to the bbox edge, there is no room left.
    at_edge = scale_outline(SQUARE, max_scale_within(SQUARE, bounds))
    assert max_scale_within(at_edge, bounds) == pytest.approx(1.0, rel=1e-6)


# --- search behaviour --------------------------------------------------------


def test_linear_curve_converges_in_one_correction():
    router = FakeRouter(lambda k: 10.0 * k, SQUARE)
    result = route_to_distance(router, SQUARE, 5.0)
    assert not result.best_effort
    assert result.scale == pytest.approx(0.5, rel=0.01)
    assert result.attempts == 2  # first measurement + one proportional correction


def test_staircase_curve_needs_interpolation_not_bisection():
    """The measured triangle-scottsdale pathology, in miniature.

    Walked length steps rather than sliding: 0.5 km below k=0.16, 3.0 km on a
    narrow tread, 6.9 km above it. A proportional step from k=1.0 overshoots the
    tread; a blind geometric midpoint of the resulting bracket lands just past it.
    Interpolating on the two measured ends lands inside.
    """

    def staircase(k: float) -> float:
        if k < 0.157:
            return 0.5
        if k < 0.171:
            return 3.0
        return 6.9 if k < 0.5 else 9.0

    router = FakeRouter(staircase, SQUARE)
    result = route_to_distance(router, SQUARE, 3.0, max_iterations=4)
    assert not result.best_effort
    assert 0.157 <= result.scale < 0.171
    assert result.distance_km == pytest.approx(3.0)


def test_unreachable_target_is_best_effort_with_its_true_distance():
    """A target the curve can never produce must not be reported as a hit."""
    router = FakeRouter(lambda k: 1.0, SQUARE)  # length ignores scale entirely
    result = route_to_distance(router, SQUARE, 10.0)
    assert result.best_effort
    assert result.distance_km == 1.0  # the measured truth, not the target
    assert result.distance_error == pytest.approx(0.9)


def test_search_stops_at_the_area_ceiling_rather_than_walking_off_the_graph():
    bounds = BoundingBox(min_lng=2.15, min_lat=41.38, max_lng=2.18, max_lat=41.41)
    ceiling = max_scale_within(SQUARE, bounds)
    router = FakeRouter(lambda k: 2.0 * k, SQUARE)  # needs k=10 for a 20 km target
    result = route_to_distance(router, SQUARE, 20.0, bounds=bounds)
    assert result.best_effort
    assert max(router.scales) <= ceiling + 1e-9


def test_iterations_are_capped():
    router = FakeRouter(lambda k: 1.0, SQUARE)
    route_to_distance(router, SQUARE, 10.0, max_iterations=3)
    assert len(router.scales) <= 4  # first measurement + at most 3 corrections


def test_shapes_too_small_to_express_fall_back_to_a_routable_scale():
    """Below some size the street network cannot express the shape at all.

    The search treats unroutable as an undershoot and grows, so a target that
    would need an unexpressible footprint returns the closest routable route
    rather than raising.
    """
    router = FakeRouter(lambda k: 8.0 * k if k >= 0.5 else 0.0, SQUARE)
    result = route_to_distance(router, SQUARE, 2.0)  # would need k=0.25
    assert result.best_effort
    assert result.distance_km > 0.0
    assert result.scale >= 0.5


def test_no_scale_routes_at_all_raises():
    router = FakeRouter(lambda k: 0.0, SQUARE)
    with pytest.raises(UnroutableShapeError):
        route_to_distance(router, SQUARE, 5.0)


# --- integration with the real router and committed extracts ------------------


def _outline(area, shape: str) -> list[Coordinate]:
    points = get_parametric_shape(shape, area.center(), area.scale_deg())
    return StreetMapper().map_to_streets(points, area.bbox)


def _router(area) -> ShapeRouter:
    return ShapeRouter(
        RoadGraph.for_bbox(area.bbox, cache_dir=GRAPHS_DIR, allow_download=False)
    )


def test_hits_target_on_a_real_dense_area():
    outline = _outline(EIXAMPLE, "circle")
    result = route_to_distance(_router(EIXAMPLE), outline, 3.0, bounds=EIXAMPLE.bbox)
    assert not result.best_effort
    assert abs(result.distance_km - 3.0) / 3.0 <= 0.10
    assert result.scale < 1.0  # the untargeted circle measured 5.36 km


def test_targeting_returns_the_outline_it_actually_routed():
    """The scaled outline must travel with the result.

    Scoring a shrunk route against the full-size shape reads as a snapping
    collapse when the router in fact tracked its target — the eval's snap metric
    depends on getting this geometry, not the original.
    """
    outline = _outline(EIXAMPLE, "circle")
    result = route_to_distance(_router(EIXAMPLE), outline, 3.0, bounds=EIXAMPLE.bbox)
    assert _span_m(result.outline) == pytest.approx(
        _span_m(outline) * result.scale, rel=0.01
    )
