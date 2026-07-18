"""Owned OSM walk-network road graph with on-disk caching.

Wraps osmnx/networkx behind a small, stable internal API so the rest of the
backend never imports osmnx directly. This is the groundwork the shape-fidelity
router (Task 3) and future drag-to-edit repair build on: `nearest_node` snaps a
coordinate to the graph, `route_between` returns the graph-native shortest path
between two coordinates.

Graphs are cached to disk as GraphML keyed by bounding box, so a given area is
downloaded from OSM (Overpass) exactly once. Eval and tests replay the committed
extracts fully offline by passing `allow_download=False` — a cache miss then
fails closed instead of reaching for the network.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import networkx as nx
import osmnx as ox

from models.schemas import BoundingBox, Coordinate

NETWORK_TYPE = "walk"  # routes are for humans on foot, not cars
DEFAULT_CACHE_DIR = Path(__file__).resolve().parent.parent / ".graph_cache"


class GraphUnavailableError(RuntimeError):
    """A graph is not cached and downloading was disallowed (offline)."""


class NoRouteError(RuntimeError):
    """No path exists between two nodes in the graph."""


def cache_key(bbox: BoundingBox, network_type: str = NETWORK_TYPE) -> str:
    """Stable filename stem for a bbox + network type.

    Coordinates are rounded to 6 decimals (~0.1 m) before hashing so trivially
    different floats map to the same cached extract.
    """
    coords = (bbox.min_lng, bbox.min_lat, bbox.max_lng, bbox.max_lat)
    raw = f"{network_type}:" + ",".join(f"{c:.6f}" for c in coords)
    digest = hashlib.sha1(raw.encode()).hexdigest()[:12]
    return f"{network_type}_{digest}"


class RoadGraph:
    """A walk-network graph for one area, with snapping and routing queries."""

    def __init__(self, graph: nx.MultiDiGraph) -> None:
        self.graph = graph

    # --- construction -----------------------------------------------------

    @classmethod
    def for_bbox(
        cls,
        bbox: BoundingBox,
        *,
        cache_dir: Path | str = DEFAULT_CACHE_DIR,
        network_type: str = NETWORK_TYPE,
        allow_download: bool = True,
    ) -> "RoadGraph":
        """Load the area's graph from disk, downloading once on a cache miss.

        With `allow_download=False` a cache miss raises `GraphUnavailableError`
        instead of hitting the network — the mode eval and tests run in.
        """
        cache_dir = Path(cache_dir)
        path = cache_dir / f"{cache_key(bbox, network_type)}.graphml"
        if path.exists():
            return cls(ox.load_graphml(path))
        if not allow_download:
            raise GraphUnavailableError(
                f"No cached graph at {path}; downloading disabled (offline)."
            )
        graph = ox.graph_from_bbox(
            bbox=(bbox.min_lng, bbox.min_lat, bbox.max_lng, bbox.max_lat),
            network_type=network_type,
        )
        cache_dir.mkdir(parents=True, exist_ok=True)
        ox.save_graphml(graph, path)
        return cls(graph)

    # --- queries (internal API for the router + future drag-edit) ---------

    def nearest_node(self, coord: Coordinate) -> int:
        """Snap a coordinate to the id of the nearest graph node."""
        return int(ox.nearest_nodes(self.graph, X=coord.lng, Y=coord.lat))

    def node_coord(self, node: int) -> Coordinate:
        """The geographic position of a graph node."""
        data = self.graph.nodes[node]
        return Coordinate(lng=data["x"], lat=data["y"])

    def route_between(
        self,
        a: Coordinate,
        b: Coordinate,
        *,
        weight: str = "length",
    ) -> list[Coordinate]:
        """Graph-native shortest path between two coordinates as a polyline.

        Snaps both endpoints to their nearest nodes, then returns the node
        coordinates along the shortest path (inclusive of both endpoints). The
        `weight` seam is where Task 3's shape-fidelity / repeat-penalty edge
        costs plug in; `length` is the plain-distance default.
        """
        orig = self.nearest_node(a)
        dest = self.nearest_node(b)
        if orig == dest:
            return [self.node_coord(orig)]
        path = ox.shortest_path(self.graph, orig, dest, weight=weight)
        if path is None:
            raise NoRouteError(f"No {weight} path between nodes {orig} and {dest}.")
        return [self.node_coord(n) for n in path]

    def __len__(self) -> int:
        return self.graph.number_of_nodes()
