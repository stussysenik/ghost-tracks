"""Route provider that scores the owned graph router on the eval fixtures.

The counterpart to the recorded Mapbox cassettes: same fixtures, same metrics,
routes produced live from the committed OSM extracts (offline — a cache miss
raises rather than downloading). Graphs are loaded once per area and reused,
since loading dominates routing cost.
"""

from __future__ import annotations

from eval.fixtures import GRAPHS_DIR, Fixture
from eval.scoreboard import RouteAttempt
from services.distance_target import route_to_distance
from services.road_graph import RoadGraph
from services.shape_router import ShapeRouter, UnroutableShapeError

_GRAPHS: dict[str, RoadGraph] = {}


def _graph_for(fixture: Fixture) -> RoadGraph:
    if fixture.area_key not in _GRAPHS:
        _GRAPHS[fixture.area_key] = RoadGraph.for_bbox(
            fixture.area.bbox, cache_dir=GRAPHS_DIR, allow_download=False
        )
    return _GRAPHS[fixture.area_key]


def graph_provider(fixture: Fixture) -> RouteAttempt | None:
    """Route a fixture on the owned graph, scaled to its distance target.

    The fixture's `target_distance_km` was declared from the start but never acted
    on — the outline was always sized to the area. Routing to it here is what makes
    `within_distance_rate` measure the router instead of the fixture manifest.
    """
    router = ShapeRouter(_graph_for(fixture))
    try:
        result = route_to_distance(
            router,
            fixture.target_polyline(),
            fixture.target_distance_km,
            bounds=fixture.area.bbox,
        )
    except UnroutableShapeError:
        return None
    return RouteAttempt(
        outline=result.outline,
        routed=result.route.coordinates,
        scale=result.scale,
        best_effort=result.best_effort,
    )
