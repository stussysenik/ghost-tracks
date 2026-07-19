"""The production generation flow routes on the owned graph, never over the network.

Guards the Task 3.3 swap: `ShapeGenerator` must produce routes from the committed
OSM extracts with downloads disabled, so any reintroduced HTTP routing call fails
here rather than in production.
"""

from __future__ import annotations

import asyncio

import pytest

from eval.fixtures import AREAS, GRAPHS_DIR
from services.road_graph import cache_key
from services.shape_generator import ShapeGenerator
from services.shape_router import UnroutableShapeError
from services.street_mapper import StreetMapper
from services.shape_templates import get_parametric_shape

EIXAMPLE = AREAS["eixample"]

pytestmark = pytest.mark.skipif(
    not (GRAPHS_DIR / f"{cache_key(EIXAMPLE.bbox)}.graphml").exists(),
    reason="committed eixample extract not present",
)


def _offline_generator() -> ShapeGenerator:
    return ShapeGenerator(graph_cache_dir=GRAPHS_DIR, allow_graph_download=False)


def _outline(shape: str) -> list:
    points = get_parametric_shape(shape, EIXAMPLE.center(), EIXAMPLE.scale_deg())
    return StreetMapper().map_to_streets(points, EIXAMPLE.bbox)


def test_routes_offline_on_owned_graph():
    routed = _offline_generator()._route_on_graph(_outline("circle"), EIXAMPLE.bbox)

    assert routed["distance_km"] > 0
    assert routed["duration_minutes"] > 0
    # The contract the generation flow consumes: [lng, lat] pairs.
    assert len(routed["coordinates"]) > 2
    assert all(len(c) == 2 for c in routed["coordinates"])


def test_routed_geometry_stays_inside_the_area():
    routed = _offline_generator()._route_on_graph(_outline("square"), EIXAMPLE.bbox)
    bbox = EIXAMPLE.bbox

    # A route built from this area's graph cannot wander outside its extract.
    for lng, lat in routed["coordinates"]:
        assert bbox.min_lng <= lng <= bbox.max_lng
        assert bbox.min_lat <= lat <= bbox.max_lat


def test_async_wrapper_matches_sync_route():
    gen = _offline_generator()
    outline = _outline("circle")

    via_async = asyncio.run(gen._route_waypoints(outline, EIXAMPLE.bbox))

    assert via_async["coordinates"] == gen._route_on_graph(outline, EIXAMPLE.bbox)["coordinates"]


def test_unroutable_shape_is_not_silently_degraded():
    """A shape the network cannot express must raise, not return a fake route."""
    gen = _offline_generator()
    # A shape scaled far outside the extract has no expressible strokes.
    far = [
        type(c)(lng=c.lng + 10.0, lat=c.lat)
        for c in _outline("letter X")
    ]
    with pytest.raises(UnroutableShapeError) as exc:
        gen._route_on_graph(far, EIXAMPLE.bbox)

    # Before the anchoring check this returned a single node and 0.0 km as success.
    assert "unanchored" in str(exc.value)


def test_target_distance_scales_the_production_route():
    """The generation flow honours a distance target, not just the eval harness."""
    gen = _offline_generator()
    outline = _outline("circle")

    untargeted = gen._route_on_graph(outline, EIXAMPLE.bbox)
    targeted = gen._route_on_graph(outline, EIXAMPLE.bbox, target_km=3.0)

    assert untargeted["distance_km"] > 4.0  # sized to the area, not to a target
    assert abs(targeted["distance_km"] - 3.0) / 3.0 <= 0.10
    assert not targeted["best_effort"]


def test_targeted_route_reports_the_outline_it_drew():
    """Validation must judge the route against the scaled shape, not the drawn one.

    Otherwise a correctly shrunk route scores as a snapping failure and the
    generator retries against a target it already hit.
    """
    gen = _offline_generator()
    outline = _outline("circle")
    targeted = gen._route_on_graph(outline, EIXAMPLE.bbox, target_km=3.0)

    assert targeted["outline"] != outline
    assert len(targeted["outline"]) == len(outline)


def test_untargeted_route_is_unchanged():
    """No target means the previous behaviour, byte for byte."""
    gen = _offline_generator()
    outline = _outline("circle")
    routed = gen._route_on_graph(outline, EIXAMPLE.bbox)

    assert routed["outline"] == outline
    assert routed["best_effort"] is False
