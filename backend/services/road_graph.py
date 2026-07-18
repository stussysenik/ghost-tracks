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
import math
from pathlib import Path

import networkx as nx
import numpy as np
import osmnx as ox
from scipy.spatial import cKDTree

from models.schemas import BoundingBox, Coordinate
from services.street_mapper import haversine_distance_m

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
        self._tree_cache: tuple | None = None

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

    def nearest_nodes(self, coords: list[Coordinate]) -> list[int]:
        """Snap many coordinates at once — one vectorized query, not N."""
        if not coords:
            return []
        nodes = ox.nearest_nodes(
            self.graph, X=[c.lng for c in coords], Y=[c.lat for c in coords]
        )
        return [int(n) for n in nodes]

    def candidate_nodes(
        self, coord: Coordinate, *, k: int = 5, radius_m: float = 200.0
    ) -> list[int]:
        """The k nearest nodes within `radius_m`, nearest first.

        The router needs candidates rather than one winner: the node closest to a
        waypoint is often across a barrier or up a cul-de-sac, cheap in meters but
        ruinous in the network. Falls back to the single nearest node so a caller
        always gets at least one anchor.
        """
        tree, ids, scale = self._kdtree()
        x = coord.lng * scale[0]
        y = coord.lat * scale[1]
        dists, idxs = tree.query([x, y], k=min(k, len(ids)))
        pairs = zip(np.atleast_1d(dists), np.atleast_1d(idxs))
        within = [int(ids[i]) for d, i in pairs if d <= radius_m]
        return within or [self.nearest_node(coord)]

    def reachable_paths(
        self, source: int, *, cutoff_m: float, weight: str = "length"
    ) -> tuple[dict[int, float], dict[int, list[int]]]:
        """Bounded Dijkstra from one node: distances and paths within `cutoff_m`.

        One bounded search answers "how far to every nearby candidate" for a whole
        hop, instead of one A* per candidate pair.
        """
        return nx.single_source_dijkstra(
            self.graph, source, cutoff=cutoff_m, weight=weight
        )

    def _kdtree(self):
        """Lazily built KD-tree over node positions in local meters."""
        if self._tree_cache is None:
            ids = list(self.graph.nodes)
            lat0 = float(np.mean([self.graph.nodes[n]["y"] for n in ids]))
            scale = (
                111_320.0 * math.cos(math.radians(lat0)),  # meters per degree lng
                111_320.0,  # meters per degree lat
            )
            pts = np.array(
                [
                    (self.graph.nodes[n]["x"] * scale[0], self.graph.nodes[n]["y"] * scale[1])
                    for n in ids
                ]
            )
            self._tree_cache = (cKDTree(pts), ids, scale)
        return self._tree_cache

    def node_coord(self, node: int) -> Coordinate:
        """The geographic position of a graph node."""
        data = self.graph.nodes[node]
        return Coordinate(lng=data["x"], lat=data["y"])

    def path_nodes(self, orig: int, dest: int, *, weight: str = "length") -> list[int]:
        """A* shortest path between two node ids.

        The heuristic is straight-line distance in meters, which never exceeds the
        real walked distance, so it is admissible and A* stays exact while
        expanding far fewer nodes than Dijkstra on the short hops the shape router
        issues (~80 per route).
        """
        if orig == dest:
            return [orig]
        try:
            return nx.astar_path(
                self.graph, orig, dest, heuristic=self.straight_line_m, weight=weight
            )
        except nx.NetworkXNoPath as exc:
            raise NoRouteError(f"No {weight} path between nodes {orig} and {dest}.") from exc

    def path_coords(self, nodes: list[int]) -> list[Coordinate]:
        """Expand a node path into a polyline, following real edge geometry.

        Curved ways carry a `geometry` LineString; using it (rather than jumping
        node-to-node) keeps the drawn line on the street and makes the polyline's
        measured length match the graph's own edge lengths.
        """
        if not nodes:
            return []
        coords = [self.node_coord(nodes[0])]
        for u, v in zip(nodes, nodes[1:]):
            edge = self._shortest_edge(u, v)
            geom = edge.get("geometry") if edge else None
            if geom is not None:
                pts = list(geom.coords)
                # Edge geometry is stored in the way's own direction; orient it.
                if haversine_distance_m(
                    coords[-1], Coordinate(lng=pts[0][0], lat=pts[0][1])
                ) > haversine_distance_m(
                    coords[-1], Coordinate(lng=pts[-1][0], lat=pts[-1][1])
                ):
                    pts = list(reversed(pts))
                coords.extend(Coordinate(lng=x, lat=y) for x, y in pts[1:])
            else:
                coords.append(self.node_coord(v))
        return coords

    def path_length_m(self, nodes: list[int]) -> float:
        """Walked length of a node path, from the graph's own edge lengths."""
        total = 0.0
        for u, v in zip(nodes, nodes[1:]):
            edge = self._shortest_edge(u, v)
            if edge is None:
                total += haversine_distance_m(self.node_coord(u), self.node_coord(v))
            else:
                total += float(edge.get("length", 0.0))
        return total

    def _shortest_edge(self, u: int, v: int) -> dict | None:
        """The shortest of the parallel edges u→v (a MultiDiGraph may have several)."""
        edges = self.graph.get_edge_data(u, v)
        if not edges:
            return None
        return min(edges.values(), key=lambda d: d.get("length", float("inf")))

    def straight_line_m(self, u: int, v: int) -> float:
        return haversine_distance_m(self.node_coord(u), self.node_coord(v))

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
