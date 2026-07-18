"""Route provider that scores the owned graph router on the eval fixtures.

The counterpart to the recorded Mapbox cassettes: same fixtures, same metrics,
routes produced live from the committed OSM extracts (offline — a cache miss
raises rather than downloading). Graphs are loaded once per area and reused,
since loading dominates routing cost.
"""

from __future__ import annotations

from eval.fixtures import GRAPHS_DIR, Fixture
from models.schemas import Coordinate
from services.road_graph import RoadGraph
from services.shape_router import ShapeRouter, UnroutableShapeError

_GRAPHS: dict[str, RoadGraph] = {}


def _graph_for(fixture: Fixture) -> RoadGraph:
    if fixture.area_key not in _GRAPHS:
        _GRAPHS[fixture.area_key] = RoadGraph.for_bbox(
            fixture.area.bbox, cache_dir=GRAPHS_DIR, allow_download=False
        )
    return _GRAPHS[fixture.area_key]


def graph_provider(fixture: Fixture) -> list[Coordinate] | None:
    """Route a fixture on the owned graph. None when the area can't express it."""
    router = ShapeRouter(_graph_for(fixture))
    try:
        return router.route(fixture.target_polyline()).coordinates
    except UnroutableShapeError:
        return None
