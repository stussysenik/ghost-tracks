"""Distance targeting — scale the shape's footprint until the route hits target.

The router draws whatever outline it is handed; nothing in it knows how long the
run should be. Measured across the 12 eval fixtures, routes came in 0.91x–3.02x
their target, because the outline was always sized to the area (70% of the bbox)
rather than to the distance. This module closes that gap the only honest way:
route, measure, rescale, re-route.

Two properties of the measured function shape the search:

- **It is not linear in scale.** Walked length inflates over the drawn outline by
  1.2x in a dense grid and up to 3.8x in a sparse suburb, and that factor *grows*
  as the shape shrinks toward block size. A pure proportional step (`k * target /
  measured`) therefore overshoots badly in sparse networks — measured on
  triangle-scottsdale it went 0.33 -> 0.14, collapsing a 7.15 km route to 0.57 km.
- **It is not even monotone.** Between k=0.15 and k=0.19 that same fixture jumps
  0.57 -> 3.09 -> 6.89 km as the shape grows past one suburban block.

So the step is proportional *bracketed*: once a scale that overshoots and one that
undershoots are both known, a proposal escaping that bracket is replaced by a
linear interpolation between the two measured ends (regula falsi). Interpolating
beats bisecting here because the bracket can be wide and the function inside it is
a staircase — measured on triangle-scottsdale, walked length steps 0.57 -> 2.90 ->
6.89 km, and the 3 km tread is only ~8% of the bracket wide. A blind midpoint
lands next to it; using the lengths already paid for lands on it.

Best effort is reported, never rounded away.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from models.schemas import BoundingBox, Coordinate
from services.shape_router import RoutedShape, ShapeRouter, UnroutableShapeError

DEFAULT_TOLERANCE = 0.10  # ±10%, the runnable-route contract
DEFAULT_MAX_ITERATIONS = 3  # corrections *after* the first measurement


# --- geometry ------------------------------------------------------------------


def centroid(outline: list[Coordinate]) -> Coordinate:
    n = len(outline)
    return Coordinate(
        lng=sum(c.lng for c in outline) / n,
        lat=sum(c.lat for c in outline) / n,
    )


def scale_outline(outline: list[Coordinate], k: float) -> list[Coordinate]:
    """Scale an outline about its centroid, preserving its shape and position.

    Scaling in degrees is safe here: over a ~2 km area the meters-per-degree
    factors are constant, so both axes stretch by the same ground factor and the
    shape does not shear.
    """
    if not outline or k == 1.0:
        return list(outline)
    c = centroid(outline)
    return [
        Coordinate(lng=c.lng + (p.lng - c.lng) * k, lat=c.lat + (p.lat - c.lat) * k)
        for p in outline
    ]


def max_scale_within(outline: list[Coordinate], bounds: BoundingBox) -> float:
    """Largest scale that keeps the outline inside `bounds`.

    Growing a shape past the area it was routed in walks it off the loaded graph,
    where every waypoint is unanchored and the route quietly becomes nonsense. The
    honest ceiling is the area itself: hit it, and the result is best-effort.
    """
    if not outline:
        return 1.0
    c = centroid(outline)
    limits = [
        (bounds.max_lng - c.lng, max(p.lng - c.lng for p in outline)),
        (c.lng - bounds.min_lng, max(c.lng - p.lng for p in outline)),
        (bounds.max_lat - c.lat, max(p.lat - c.lat for p in outline)),
        (c.lat - bounds.min_lat, max(c.lat - p.lat for p in outline)),
    ]
    return min((room / reach for room, reach in limits if reach > 0), default=1.0)


# --- result --------------------------------------------------------------------


@dataclass(frozen=True)
class TargetedRoute:
    """A route plus the scale it took to get there — and whether that was enough."""

    route: RoutedShape
    outline: list[Coordinate]  # the *scaled* outline actually routed
    target_km: float
    scale: float
    attempts: int
    tolerance: float = DEFAULT_TOLERANCE

    @property
    def distance_km(self) -> float:
        return self.route.distance_km

    @property
    def distance_error(self) -> float:
        if self.target_km <= 0:
            return float("inf")
        return abs(self.route.distance_km - self.target_km) / self.target_km

    @property
    def best_effort(self) -> bool:
        """True when the target was not reached and the closest try is returned."""
        return self.distance_error > self.tolerance


# --- the search ----------------------------------------------------------------


def route_to_distance(
    router: ShapeRouter,
    outline: list[Coordinate],
    target_km: float,
    *,
    bounds: BoundingBox | None = None,
    tolerance: float = DEFAULT_TOLERANCE,
    max_iterations: int = DEFAULT_MAX_ITERATIONS,
) -> TargetedRoute:
    """Route `outline` at the footprint scale whose measured length hits target.

    Composes `ShapeRouter` rather than extending it: the router's job is to draw
    an outline on streets, and it should not grow a distance knob to do so.

    Raises `UnroutableShapeError` only if *no* scale produced a route at all.
    """
    ceiling = max_scale_within(outline, bounds) if bounds else math.inf
    k = min(1.0, ceiling)
    # Each bracket end remembers the length measured there, so a step that escapes
    # the bracket can interpolate between them instead of guessing a midpoint.
    lo: _Measured | None = None  # largest scale measured short of target
    hi: _Measured | None = None  # smallest scale measured long of target
    best: TargetedRoute | None = None
    failure: UnroutableShapeError | None = None
    stalls = _Stalls()

    for attempt in range(1, max_iterations + 2):
        scaled = scale_outline(outline, k)
        try:
            routed = router.route(scaled)
        except UnroutableShapeError as e:
            # Unexpressible almost always means the shape is small relative to the
            # block structure, so treat it as an undershoot and grow.
            failure = e
            lo = _further(lo, _Measured(k, 0.0), grow=True)
            k_next = math.sqrt(lo.scale * hi.scale) if hi else lo.scale * 2.0
        else:
            candidate = TargetedRoute(routed, scaled, target_km, k, attempt, tolerance)
            if best is None or candidate.distance_error < best.distance_error:
                best = candidate
            if not candidate.best_effort:
                return candidate
            here = _Measured(k, routed.distance_km)
            if routed.distance_km < target_km:
                lo = _further(lo, here, grow=True)
            else:
                hi = _further(hi, here, grow=False)
            stalls = stalls.after(short=routed.distance_km < target_km)
            k_next = _next_scale(here, target_km, lo, hi, stalls)

        k_next = min(k_next, ceiling)
        if k_next == k:  # clamped or converged — another pass learns nothing
            break
        k = k_next

    if best is None:
        raise failure or UnroutableShapeError([], 0)
    return best


@dataclass(frozen=True)
class _Measured:
    """A scale and the route length measured at it."""

    scale: float
    km: float


@dataclass(frozen=True)
class _Stalls:
    """How many measurements in a row each bracket end has sat unmoved.

    A stale end is what makes plain interpolation creep: it keeps anchoring the
    line to a point the search has already left behind. Counting per end lets
    `_next_scale` discount exactly the one that stopped contributing.
    """

    low: int = 0
    high: int = 0

    def after(self, *, short: bool) -> _Stalls:
        """A measurement short of target refreshes the low end, and vice versa."""
        return _Stalls(low=0, high=self.high + 1) if short else _Stalls(
            low=self.low + 1, high=0
        )


def _further(current: _Measured | None, new: _Measured, *, grow: bool) -> _Measured:
    """Keep whichever bracket end sits closer to the unknown crossing."""
    if current is None:
        return new
    tighter = new.scale > current.scale if grow else new.scale < current.scale
    return new if tighter else current


def _next_scale(
    here: _Measured,
    target_km: float,
    lo: _Measured | None,
    hi: _Measured | None,
    stalls: _Stalls = _Stalls(),
) -> float:
    """Proportional step, interpolated when it escapes the known bracket."""
    proposal = here.scale * target_km / here.km if here.km > 0 else here.scale * 2.0
    if lo is None or hi is None or lo.scale < proposal < hi.scale:
        return proposal

    # Regula falsi on (scale, length - target), with the Illinois correction: when
    # the same side has been replaced repeatedly the opposite end is stale, and
    # plain interpolation inches toward it forever. Halving the stale end's
    # residual per stall pulls the next probe back across the bracket. Measured on
    # a staircase curve this is the difference between landing on a narrow tread
    # and creeping past it until the iteration budget runs out.
    f_lo = (lo.km - target_km) * 0.5**stalls.low
    f_hi = (hi.km - target_km) * 0.5**stalls.high
    span = f_hi - f_lo
    if span <= 0:  # both ends measured alike — no gradient to interpolate along
        return math.sqrt(lo.scale * hi.scale)
    return lo.scale + (-f_lo / span) * (hi.scale - lo.scale)
