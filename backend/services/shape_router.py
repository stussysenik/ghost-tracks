"""Short-hop shape-fidelity router over the owned road graph.

The Mapbox baseline failed because it was asked the wrong question: given widely
spaced waypoints, a Directions API optimizes *travel*, so it takes the sensible
long way round and the drawing dissolves (measured: mean distance error 158%,
repeat ratio 0.66). This router asks a different question — follow the outline —
by resampling the shape at uniform arc length and routing each short consecutive
pair through the graph, so no single hop has room to wander.

Two knobs carry the design:

- **arc-length-uniform resampling** puts waypoints at even spacing along the
  outline, so a long straight stroke gets as many anchors as a tight curve.
- **the per-hop detour cap** is the honesty valve. When a hop's walked distance
  blows past its straight-line distance, the local street network cannot express
  that stroke; rather than quietly emitting a detour that ruins the shape, the
  router records it and fails fast once too many hops are unexpressible.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from models.schemas import Coordinate
from services.road_graph import NoRouteError, RoadGraph
from services.street_mapper import haversine_distance_m

DEFAULT_WAYPOINTS = 80
DEFAULT_DETOUR_CAP = 2.5  # walked / crow-flies per hop
DEFAULT_CAP_FLOOR_M = 120.0  # below this, a big ratio is just short-hop noise
DEFAULT_MAX_OVER_CAP_SHARE = 0.25
DEFAULT_CANDIDATES = 5
DEFAULT_CANDIDATE_RADIUS_M = 200.0
DEFAULT_EMISSION_WEIGHT = 1.5  # favour hugging the outline over walking less
DEFAULT_CORRIDOR_M = 100.0  # how far off-outline counts as "one corridor width"
DEFAULT_CORRIDOR_WEIGHT = 2.0  # cost multiplier per corridor width of deviation
DEFAULT_CLOSURE_TOL_M = 50.0  # same tolerance the eval's `is_loop` grades against
WALKING_KMH = 5.0


def outline_is_closed(
    outline: list[Coordinate], tol_m: float = DEFAULT_CLOSURE_TOL_M
) -> bool:
    """True when the outline's own ends meet — i.e. a loop was actually drawn.

    Closure is a property of the *shape*, not something the router may impose. A
    circle or a letter O is a loop; a letter M is a stroke that ends 700 m from
    where it began. Forcing the latter shut would append up to 1.7 km of ground
    the drawing does not contain, wrecking distance targeting and retracing the
    letter's own streets — a green loop metric bought with two red ones.
    """
    if len(outline) < 3:
        return False
    return haversine_distance_m(outline[0], outline[-1]) <= tol_m


# --- resampling ---------------------------------------------------------------


def resample_uniform(
    points: list[Coordinate], count: int = DEFAULT_WAYPOINTS
) -> list[Coordinate]:
    """Resample a polyline to `count` points spaced evenly along its arc length.

    Endpoints are preserved exactly, which keeps a closed outline closed.
    """
    if count < 2 or len(points) < 2:
        return list(points)

    # Cumulative arc length at each input vertex.
    cumulative = [0.0]
    for a, b in zip(points, points[1:]):
        cumulative.append(cumulative[-1] + haversine_distance_m(a, b))
    total = cumulative[-1]
    if total <= 0:
        return [points[0], points[-1]]

    out: list[Coordinate] = [points[0]]
    seg = 0
    for k in range(1, count - 1):
        target = total * k / (count - 1)
        while seg < len(points) - 2 and cumulative[seg + 1] < target:
            seg += 1
        span = cumulative[seg + 1] - cumulative[seg]
        frac = (target - cumulative[seg]) / span if span > 0 else 0.0
        a, b = points[seg], points[seg + 1]
        out.append(
            Coordinate(
                lng=a.lng + (b.lng - a.lng) * frac,
                lat=a.lat + (b.lat - a.lat) * frac,
            )
        )
    out.append(points[-1])
    return out


# --- results & diagnostics -----------------------------------------------------


@dataclass(frozen=True)
class HopDiagnostic:
    """One hop the street network could not express as drawn."""

    index: int
    crow_m: float
    walked_m: float
    detour_ratio: float
    reason: str  # "detour" | "disconnected" | "unanchored"

    def describe(self) -> str:
        if self.reason == "unanchored":
            return (
                f"waypoint {self.index}: unanchored, nearest street is "
                f"{self.crow_m:.0f} m away"
            )
        return (
            f"hop {self.index}: {self.reason}, {self.walked_m:.0f} m walked for "
            f"{self.crow_m:.0f} m of shape (x{self.detour_ratio:.1f})"
        )


@dataclass
class RoutedShape:
    coordinates: list[Coordinate]
    distance_km: float
    duration_minutes: int
    waypoint_count: int
    hops: int
    over_cap_hops: list[HopDiagnostic] = field(default_factory=list)
    max_detour_ratio: float = 0.0

    @property
    def is_loop(self) -> bool:
        """Whether the route ends on the node it started from.

        Derived from the geometry rather than stored alongside it, so it reports
        what the route *is* and cannot drift from what the router intended.
        """
        return len(self.coordinates) > 1 and self.coordinates[0] == self.coordinates[-1]


class UnroutableShapeError(RuntimeError):
    """Too many strokes are unexpressible in this area's street network."""

    def __init__(self, diagnostics: list[HopDiagnostic], hops: int) -> None:
        self.diagnostics = diagnostics
        self.hops = hops
        detail = (
            f" (worst — {max(diagnostics, key=lambda d: d.detour_ratio).describe()})"
            if diagnostics
            else ""
        )
        super().__init__(
            f"{len(diagnostics)} of {hops} hops cannot be drawn on this street "
            f"network{detail}. Try a larger area or a simpler shape."
        )


# --- the router ----------------------------------------------------------------


class ShapeRouter:
    """Routes a shape outline onto real streets, hop by short hop."""

    def __init__(
        self,
        graph: RoadGraph,
        *,
        waypoints: int = DEFAULT_WAYPOINTS,
        detour_cap: float = DEFAULT_DETOUR_CAP,
        cap_floor_m: float = DEFAULT_CAP_FLOOR_M,
        max_over_cap_share: float = DEFAULT_MAX_OVER_CAP_SHARE,
        candidates_per_waypoint: int = DEFAULT_CANDIDATES,
        candidate_radius_m: float = DEFAULT_CANDIDATE_RADIUS_M,
        emission_weight: float = DEFAULT_EMISSION_WEIGHT,
        corridor_m: float = DEFAULT_CORRIDOR_M,
        corridor_weight: float = DEFAULT_CORRIDOR_WEIGHT,
        closure_tol_m: float = DEFAULT_CLOSURE_TOL_M,
    ) -> None:
        self.closure_tol_m = closure_tol_m
        self.corridor_m = corridor_m
        self.corridor_weight = corridor_weight
        self.graph = graph
        self.waypoints = waypoints
        self.detour_cap = detour_cap
        self.cap_floor_m = cap_floor_m
        self.max_over_cap_share = max_over_cap_share
        self.candidates_per_waypoint = candidates_per_waypoint
        self.candidate_radius_m = candidate_radius_m
        self.emission_weight = emission_weight

    def route(self, outline: list[Coordinate]) -> RoutedShape:
        """Route an outline polyline onto the graph.

        Each waypoint offers several candidate nodes; the chosen sequence is the
        one minimizing (deviation from the outline) + (how much the walked hop
        overshoots the outline's own step). Picking node by node greedily is what
        produces 2 km detours for 50 m of shape: the closest node in meters can be
        the far side of a barrier. Viterbi resolves the whole chain at once.

        Raises `UnroutableShapeError` as soon as more than `max_over_cap_share` of
        the hops are still unexpressible — a loud failure beats a silent scribble.
        """
        if len(outline) < 2:
            return RoutedShape([], 0.0, 0, len(outline), 0)

        sampled = resample_uniform(outline, self.waypoints)
        closed = outline_is_closed(outline, self.closure_tol_m)
        nodes = _collapse_repeats(self._best_node_chain(sampled, closed=closed))
        corridor = _OutlineCorridor(outline, self.graph, self.corridor_m, self.corridor_weight)
        if len(nodes) < 2:
            # Every waypoint matched the same node: the outline does not overlap
            # this graph at all. Returning it as a tidy 0.0 km route is the worst
            # outcome — the caller cannot tell success from total failure, and no
            # hop exists for the detour cap to price.
            raise UnroutableShapeError(
                self._unanchored(sampled) or [HopDiagnostic(0, 0.0, 0.0, float("inf"), "unanchored")],
                len(sampled),
            )

        hops = len(nodes) - 1
        over_cap_budget = int(self.max_over_cap_share * hops)
        coords: list[Coordinate] = []
        over_cap: list[HopDiagnostic] = []
        max_ratio = 0.0
        walked_total = 0.0

        for i, (u, v) in enumerate(zip(nodes, nodes[1:])):
            crow = self.graph.straight_line_m(u, v)
            try:
                path = self.graph.path_nodes(u, v, weight=corridor.edge_cost)
                hop_coords = self.graph.path_coords(path)
                walked = self.graph.path_length_m(path)
                ratio = walked / crow if crow > 0 else 1.0
                if walked > self.cap_floor_m and ratio > self.detour_cap:
                    over_cap.append(HopDiagnostic(i, crow, walked, ratio, "detour"))
            except NoRouteError:
                hop_coords = [self.graph.node_coord(u), self.graph.node_coord(v)]
                walked, ratio = crow, float("inf")
                over_cap.append(
                    HopDiagnostic(i, crow, walked, ratio, "disconnected")
                )

            if len(over_cap) > over_cap_budget:
                raise UnroutableShapeError(over_cap, hops)

            max_ratio = max(max_ratio, ratio)
            coords.extend(hop_coords if not coords else hop_coords[1:])
            walked_total += walked

        distance_km = walked_total / 1000.0
        return RoutedShape(
            coordinates=coords,
            distance_km=round(distance_km, 3),
            duration_minutes=round(distance_km / WALKING_KMH * 60),
            waypoint_count=len(sampled),
            hops=hops,
            over_cap_hops=over_cap,
            max_detour_ratio=round(max_ratio, 2) if max_ratio != float("inf") else max_ratio,
        )

    # --- node selection ---------------------------------------------------

    def _unanchored(self, sampled: list[Coordinate]) -> list[HopDiagnostic]:
        """Waypoints with no street within `candidate_radius_m`.

        Diagnostic only — a sparse network legitimately puts many waypoints past
        the radius while still expressing the shape, so this must not by itself
        reject a route. It exists to explain a collapse, not to cause one.
        """
        out: list[HopDiagnostic] = []
        for i, p in enumerate(sampled):
            near = self.graph.candidate_nodes(p, k=1, radius_m=self.candidate_radius_m)
            d = haversine_distance_m(p, self.graph.node_coord(near[0]))
            if d > self.candidate_radius_m:
                out.append(HopDiagnostic(i, d, d, float("inf"), "unanchored"))
        return out

    def _best_node_chain(
        self, sampled: list[Coordinate], *, closed: bool = False
    ) -> list[int]:
        """Best node chain for the sampled outline, closed into a loop if it was one.

        For a closed outline the first and last waypoint are the same point, but
        nothing forces their *nodes* to agree — they are independent layers of the
        Viterbi, so the two ends land on whichever nodes happen to be locally
        cheapest. That is why closure was luck: 6 of 7 closed fixtures agreed and
        square-prague missed by 61.6 m.

        Rather than snapping the tail onto the head after the fact (which would
        fake the last few meters), pin both ends to the start node the free pass
        already preferred and re-solve, so the tail is genuinely *routed back* to
        it. Costs a second pass only when the free pass didn't already close.
        """
        candidates = [
            self.graph.candidate_nodes(
                p, k=self.candidates_per_waypoint, radius_m=self.candidate_radius_m
            )
            for p in sampled
        ]
        chain = self._viterbi(sampled, candidates)
        if closed and len(chain) > 1 and chain[0] != chain[-1]:
            anchor = [chain[0]]
            chain = self._viterbi(sampled, [anchor, *candidates[1:-1], anchor])
        return chain

    def _viterbi(
        self, sampled: list[Coordinate], candidates: list[list[int]]
    ) -> list[int]:
        """Viterbi over per-waypoint candidate nodes (Newson–Krumm map matching).

        Emission cost is how far a candidate sits from its waypoint; transition
        cost is how far the walked hop overshoots the outline's own step. Both are
        in meters, so they add without an arbitrary scale factor.
        """
        cost: dict[int, float] = {
            n: self.emission_weight * haversine_distance_m(sampled[0], self.graph.node_coord(n))
            for n in candidates[0]
        }
        back: list[dict[int, int]] = []

        for i in range(1, len(sampled)):
            step_m = haversine_distance_m(sampled[i - 1], sampled[i])
            cutoff = max(self.detour_cap * step_m, step_m + self.cap_floor_m)
            reach = {u: self.graph.reachable_paths(u, cutoff_m=cutoff)[0] for u in cost}

            next_cost: dict[int, float] = {}
            next_back: dict[int, int] = {}
            for v in candidates[i]:
                emission = self.emission_weight * haversine_distance_m(
                    sampled[i], self.graph.node_coord(v)
                )
                best_u, best = None, float("inf")
                for u, prev in cost.items():
                    walked = reach[u].get(v)
                    # Unreachable within the cutoff: allow it, but priced so that
                    # any expressible alternative wins.
                    overshoot = (
                        abs(walked - step_m) if walked is not None else cutoff + step_m
                    )
                    total = prev + overshoot
                    if total < best:
                        best_u, best = u, total
                if best_u is not None:
                    next_cost[v] = best + emission
                    next_back[v] = best_u

            if not next_cost:  # no candidates at all — keep the chain alive
                continue
            cost = next_cost
            back.append(next_back)

        # Backtrack from the cheapest terminal candidate.
        node = min(cost, key=cost.get)
        chain = [node]
        for layer in reversed(back):
            node = layer.get(node, node)
            chain.append(node)
        chain.reverse()
        return chain


class _OutlineCorridor:
    """Edge cost that makes wandering away from the outline expensive.

    Between two ways of getting from one anchor to the next, plain shortest-path
    picks the shorter one even when it swings a block away and smears the drawing.
    Scaling each edge by how far its endpoints sit from the outline makes staying
    in the corridor the cheap option, and only genuinely unavoidable excursions
    (no street any closer) still happen.
    """

    def __init__(
        self, outline: list[Coordinate], graph: RoadGraph, corridor_m: float, weight: float
    ) -> None:
        self._graph = graph
        self._corridor_m = corridor_m
        self._weight = weight
        # Sample the outline finely so "distance to the nearest sample" is a good
        # stand-in for distance to the outline itself.
        span = sum(haversine_distance_m(a, b) for a, b in zip(outline, outline[1:]))
        self._samples = resample_uniform(outline, max(2, int(span / 15.0)))
        self._deviation: dict[int, float] = {}

    def edge_cost(self, u: int, v: int, data: dict) -> float:
        # networkx hands a callable weight the whole parallel-edge dict on a
        # MultiDiGraph ({key: attrs}), and plain attrs on a simple graph.
        attrs = data.values() if "length" not in data else [data]
        length = min(float(a.get("length", 0.0)) for a in attrs)
        off = (self._deviation_of(u) + self._deviation_of(v)) / 2.0
        return length * (1.0 + self._weight * off / self._corridor_m)

    def _deviation_of(self, node: int) -> float:
        cached = self._deviation.get(node)
        if cached is None:
            coord = self._graph.node_coord(node)
            cached = min(haversine_distance_m(coord, s) for s in self._samples)
            self._deviation[node] = cached
        return cached


def _collapse_repeats(nodes: list[int]) -> list[int]:
    """Drop consecutive duplicates — several waypoints can snap to one node."""
    out: list[int] = []
    for n in nodes:
        if not out or out[-1] != n:
            out.append(n)
    return out
