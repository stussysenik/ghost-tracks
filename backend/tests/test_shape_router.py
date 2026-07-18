"""Tests for the short-hop shape router.

Geometry tests (resampling) are pure. Routing tests run fully offline against the
committed Barcelona Eixample extract, and skip if it hasn't been materialized.
"""

import pytest

from eval.fixtures import AREAS, GRAPHS_DIR
from models.schemas import Coordinate
from services.road_graph import RoadGraph, cache_key
from services.shape_router import (
    ShapeRouter,
    UnroutableShapeError,
    resample_uniform,
)
from services.street_mapper import haversine_distance_m

EIXAMPLE = AREAS["eixample"]
requires_extract = pytest.mark.skipif(
    not (GRAPHS_DIR / f"{cache_key(EIXAMPLE.bbox)}.graphml").exists(),
    reason="run `python -m eval.build_graphs` to materialize committed extracts",
)


def _graph() -> RoadGraph:
    return RoadGraph.for_bbox(EIXAMPLE.bbox, cache_dir=GRAPHS_DIR, allow_download=False)


def _square(center: Coordinate, half_deg: float) -> list[Coordinate]:
    """A closed square outline, deliberately with unevenly spaced vertices."""
    c = center
    return [
        Coordinate(lng=c.lng - half_deg, lat=c.lat - half_deg),
        Coordinate(lng=c.lng + half_deg, lat=c.lat - half_deg),
        Coordinate(lng=c.lng + half_deg, lat=c.lat + half_deg),
        Coordinate(lng=c.lng - half_deg, lat=c.lat + half_deg),
        Coordinate(lng=c.lng - half_deg, lat=c.lat - half_deg),
    ]


# --- resampling ---------------------------------------------------------------


def test_resample_returns_the_requested_count_and_keeps_endpoints():
    outline = _square(EIXAMPLE.center(), 0.004)
    out = resample_uniform(outline, 80)

    assert len(out) == 80
    assert out[0] == outline[0]
    assert out[-1] == outline[-1]


def test_resample_spacing_is_uniform_in_arc_length():
    outline = _square(EIXAMPLE.center(), 0.004)
    perimeter = sum(haversine_distance_m(a, b) for a, b in zip(outline, outline[1:]))
    nominal = perimeter / 59

    out = resample_uniform(outline, 60)
    gaps = [haversine_distance_m(a, b) for a, b in zip(out, out[1:])]

    # Spacing is uniform along the *arc*, so a chord never exceeds the nominal
    # step; only the few samples straddling a corner cut it shorter.
    assert max(gaps) <= nominal * 1.001
    on_nominal = [g for g in gaps if abs(g - nominal) < 0.01 * nominal]
    assert len(on_nominal) >= len(gaps) - 4  # one short chord per corner


def test_resample_is_a_noop_for_degenerate_input():
    p = Coordinate(lng=2.16, lat=41.39)
    assert resample_uniform([p], 80) == [p]
    assert resample_uniform([], 80) == []
    assert resample_uniform([p, p], 80) == [p, p]  # zero arc length


# --- routing ------------------------------------------------------------------


@requires_extract
def test_route_follows_the_outline_and_stays_on_the_graph():
    outline = _square(EIXAMPLE.center(), 0.004)
    routed = ShapeRouter(_graph()).route(outline)

    assert len(routed.coordinates) > len(outline)
    assert routed.distance_km > 0
    assert routed.duration_minutes > 0
    assert routed.hops > 0
    b = EIXAMPLE.bbox
    for c in routed.coordinates:
        assert b.min_lng <= c.lng <= b.max_lng
        assert b.min_lat <= c.lat <= b.max_lat


@requires_extract
def test_route_is_deterministic():
    outline = _square(EIXAMPLE.center(), 0.004)
    graph = _graph()
    a = ShapeRouter(graph).route(outline)
    b = ShapeRouter(graph).route(outline)

    assert a.coordinates == b.coordinates
    assert a.distance_km == b.distance_km


@requires_extract
def test_route_walks_further_than_the_outline_but_not_absurdly_further():
    outline = _square(EIXAMPLE.center(), 0.004)
    span_km = sum(
        haversine_distance_m(a, b) for a, b in zip(outline, outline[1:])
    ) / 1000

    routed = ShapeRouter(_graph()).route(outline)

    # Streets cannot beat the straight line, and a dense grid should not need
    # more than double it — the failure this router exists to prevent.
    assert routed.distance_km >= span_km * 0.95
    assert routed.distance_km <= span_km * 2.0


@requires_extract
def test_a_shape_the_network_cannot_express_fails_loudly():
    outline = _square(EIXAMPLE.center(), 0.004)
    # A cap no real street network can satisfy: every hop is over budget.
    router = ShapeRouter(
        _graph(), detour_cap=1.0, cap_floor_m=0.0, max_over_cap_share=0.0
    )

    with pytest.raises(UnroutableShapeError) as exc:
        router.route(outline)

    assert exc.value.diagnostics
    assert "hop" in str(exc.value)


@requires_extract
def test_too_short_an_outline_routes_to_nothing_rather_than_crashing():
    routed = ShapeRouter(_graph()).route([EIXAMPLE.center()])

    assert routed.coordinates == []
    assert routed.distance_km == 0.0
