"""Tests for the owned road graph — cache determinism + nearest-node snapping.

Fully offline: loads the committed walk-network extracts from
`eval/fixtures/graphs/` with `allow_download=False`. If the extracts haven't been
materialized yet (`python -m eval.build_graphs`), these skip rather than fail.
"""

import pytest

from eval.fixtures import AREAS, GRAPHS_DIR
from models.schemas import BoundingBox, Coordinate
from services.road_graph import (
    GraphUnavailableError,
    RoadGraph,
    cache_key,
)
from services.street_mapper import haversine_distance_m

EIXAMPLE = AREAS["eixample"]  # dense grid → best connectivity for routing
_GRAPH_FILE = GRAPHS_DIR / f"{cache_key(EIXAMPLE.bbox)}.graphml"
requires_extract = pytest.mark.skipif(
    not _GRAPH_FILE.exists(),
    reason="run `python -m eval.build_graphs` to materialize committed extracts",
)


def _load(area_key: str = "eixample") -> RoadGraph:
    return RoadGraph.for_bbox(
        AREAS[area_key].bbox, cache_dir=GRAPHS_DIR, allow_download=False
    )


# --- cache key ----------------------------------------------------------------


def test_cache_key_is_stable_and_rounds_trivial_float_diffs():
    a = BoundingBox(min_lng=2.15, min_lat=41.385, max_lng=2.176, max_lat=41.401)
    b = BoundingBox(
        min_lng=2.1500000001, min_lat=41.385, max_lng=2.176, max_lat=41.401
    )
    assert cache_key(a) == cache_key(a)  # deterministic
    assert cache_key(a) == cache_key(b)  # 6-dp rounding collapses the noise
    assert cache_key(a).startswith("walk_")


# --- offline fail-closed ------------------------------------------------------


def test_uncached_bbox_offline_fails_closed():
    nowhere = BoundingBox(min_lng=0.0, min_lat=0.0, max_lng=0.001, max_lat=0.001)
    with pytest.raises(GraphUnavailableError):
        RoadGraph.for_bbox(nowhere, cache_dir=GRAPHS_DIR, allow_download=False)


# --- cache determinism --------------------------------------------------------


@requires_extract
def test_two_loads_are_structurally_identical():
    g1, g2 = _load(), _load()
    assert len(g1) == len(g2) > 0
    assert set(g1.graph.nodes) == set(g2.graph.nodes)


@requires_extract
def test_nearest_node_is_deterministic_across_loads():
    center = EIXAMPLE.center()
    assert _load().nearest_node(center) == _load().nearest_node(center)


# --- nearest-node snapping ----------------------------------------------------


@requires_extract
def test_nearest_node_snaps_within_the_area():
    g = _load()
    node = g.nearest_node(EIXAMPLE.center())
    snapped = g.node_coord(node)
    b = EIXAMPLE.bbox
    assert b.min_lng <= snapped.lng <= b.max_lng
    assert b.min_lat <= snapped.lat <= b.max_lat
    # A ~2 km dense-grid extract has a node within a block of its centre.
    assert haversine_distance_m(EIXAMPLE.center(), snapped) < 200.0


@requires_extract
def test_a_nodes_own_coordinate_snaps_back_to_itself():
    g = _load()
    node = next(iter(g.graph.nodes))
    assert g.nearest_node(g.node_coord(node)) == node


# --- route_between (groundwork for the short-hop router) ----------------------


@requires_extract
def test_route_between_returns_a_polyline_no_shorter_than_crow_flies():
    g = _load()
    b = EIXAMPLE.bbox
    a = Coordinate(lng=b.min_lng + b.width_deg() * 0.3, lat=b.min_lat + b.height_deg() * 0.3)
    c = Coordinate(lng=b.min_lng + b.width_deg() * 0.7, lat=b.min_lat + b.height_deg() * 0.7)
    poly = g.route_between(a, c)

    assert len(poly) >= 2
    crow = haversine_distance_m(g.node_coord(g.nearest_node(a)), g.node_coord(g.nearest_node(c)))
    walked = sum(haversine_distance_m(poly[i], poly[i + 1]) for i in range(len(poly) - 1))
    assert walked >= crow - 1.0  # graph path can't beat the straight line


@requires_extract
def test_route_between_identical_endpoints_is_a_single_point():
    g = _load()
    p = EIXAMPLE.center()
    assert g.route_between(p, p) == [g.node_coord(g.nearest_node(p))]
