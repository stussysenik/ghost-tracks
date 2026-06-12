"""Composer: StrokeSet → ArtPlan — ONE continuous line (medium law #1).

LESSON — stroke ordering is a tiny TSP
======================================
A run is a single GPS track, so disconnected strokes must be chained with
*connector* ink. Choosing the drawing order to minimize total connector
length is a traveling-salesman variant (each "city" is a stroke that may be
entered at either end). Exact TSP is overkill for ≤ 12 strokes; we use the
classic practical combo:

  1. greedy nearest-endpoint chaining (try every start, keep the best),
  2. a 2-opt improvement pass (reverse subsequences while it helps).

Connectors between consecutive strokes are straight lines. When BOTH
connector endpoints already lie on previously drawn ink, the connector is
marked ``retrace=True`` — retraced segments visually disappear in the final
GPS trace, which is the craft trick practitioners use instead of pen lifts.
"""

from __future__ import annotations

import math

from models.ir import ArtPlan, SegmentMeta, Stroke, StrokeSet

# Endpoints closer than this (unit space) are considered the same point.
JOIN_EPS = 1e-6
# A point within this distance of drawn ink counts as "on" it (~1.5% of canvas).
ON_PATH_EPS = 0.015


def _dist(a: list[float], b: list[float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _endpoints(stroke: Stroke, reverse: bool) -> tuple[list[float], list[float]]:
    pts = stroke.points
    return (pts[-1], pts[0]) if reverse else (pts[0], pts[-1])


def _chain_cost(order: list[tuple[int, bool]], strokes: list[Stroke]) -> float:
    """Total connector length for a given (index, reversed) sequence."""
    total = 0.0
    for k in range(len(order) - 1):
        i, rev_i = order[k]
        j, rev_j = order[k + 1]
        _, end_i = _endpoints(strokes[i], rev_i)
        start_j, _ = _endpoints(strokes[j], rev_j)
        total += _dist(end_i, start_j)
    return total


def _greedy_chain(strokes: list[Stroke], start: int) -> list[tuple[int, bool]]:
    """Nearest-endpoint greedy walk starting at stroke ``start``."""
    order: list[tuple[int, bool]] = [(start, False)]
    remaining = set(range(len(strokes))) - {start}
    while remaining:
        i, rev_i = order[-1]
        _, tail = _endpoints(strokes[i], rev_i)
        best: tuple[float, int, bool] | None = None
        for j in remaining:
            for rev_j in (False, True):
                head, _ = _endpoints(strokes[j], rev_j)
                d = _dist(tail, head)
                if best is None or d < best[0]:
                    best = (d, j, rev_j)
        assert best is not None
        order.append((best[1], best[2]))
        remaining.discard(best[1])
    return order


def _two_opt(
    order: list[tuple[int, bool]], strokes: list[Stroke], max_passes: int = 10
) -> list[tuple[int, bool]]:
    """2-opt: reverse subsequences while connector cost improves.

    Reversing a subsequence of the drawing order also flips each stroke's
    traversal direction inside it — that is what makes 2-opt valid for the
    "enter at either end" TSP variant.
    """
    best = list(order)
    best_cost = _chain_cost(best, strokes)
    n = len(best)
    for _ in range(max_passes):
        improved = False
        for i in range(n - 1):
            for j in range(i + 1, n):
                candidate = (
                    best[:i]
                    + [(idx, not rev) for idx, rev in reversed(best[i : j + 1])]
                    + best[j + 1 :]
                )
                cost = _chain_cost(candidate, strokes)
                if cost < best_cost - 1e-12:
                    best, best_cost = candidate, cost
                    improved = True
        if not improved:
            break
    return best


def _point_on_paths(p: list[float], paths: list[list[list[float]]], eps: float) -> bool:
    """Is p within eps of any segment of any drawn path?"""
    for path in paths:
        for k in range(len(path) - 1):
            a, b = path[k], path[k + 1]
            ab = (b[0] - a[0], b[1] - a[1])
            seg_len_sq = ab[0] ** 2 + ab[1] ** 2
            if seg_len_sq == 0:
                d = _dist(p, a)
            else:
                t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / seg_len_sq
                t = min(max(t, 0.0), 1.0)
                d = _dist(p, [a[0] + t * ab[0], a[1] + t * ab[1]])
            if d <= eps:
                return True
    return False


def compose(strokeset: StrokeSet) -> ArtPlan:
    """Order strokes, insert connectors, emit ONE continuous polyline.

    The returned plan's ``strokes``/``segments`` are aligned 1:1 in draw
    order (connectors included); ``order`` is the chosen permutation of the
    input strokes; ``segments[k]`` gives the inclusive index range of piece
    k inside ``continuous``. Consecutive segments always share their joint
    point index, so the polyline is verifiably gap-free.
    """
    drawable = [s for s in strokeset.strokes if len(s.points) >= 2]
    if not drawable:
        return ArtPlan(strokes=[], order=[], continuous=[], segments=[])

    # Optimize drawing order: best greedy start, then 2-opt polish.
    best_order: list[tuple[int, bool]] | None = None
    best_cost = math.inf
    for start in range(len(drawable)):
        candidate = _greedy_chain(drawable, start)
        cost = _chain_cost(candidate, drawable)
        if cost < best_cost:
            best_order, best_cost = candidate, cost
    assert best_order is not None
    order = _two_opt(best_order, drawable)

    # Stitch the continuous polyline, inserting connectors at gaps.
    continuous: list[list[float]] = []
    out_strokes: list[Stroke] = []
    segments: list[SegmentMeta] = []
    drawn_paths: list[list[list[float]]] = []  # real ink only, for retrace test

    def _append_piece(pts: list[list[float]], kind: str, retrace: bool) -> None:
        """Append a piece, sharing the joint point with the previous one."""
        if continuous and _dist(continuous[-1], pts[0]) <= JOIN_EPS:
            start_idx = len(continuous) - 1
            continuous.extend(pts[1:])
        else:
            start_idx = len(continuous)
            continuous.extend(pts)
        end_idx = len(continuous) - 1
        out_strokes.append(Stroke(points=pts, kind=kind, retrace=retrace))
        segments.append(
            SegmentMeta(kind=kind, retrace=retrace, start_idx=start_idx, end_idx=end_idx)
        )

    for idx, reverse in order:
        stroke = drawable[idx]
        pts = [list(p) for p in (reversed(stroke.points) if reverse else stroke.points)]
        if continuous and _dist(continuous[-1], pts[0]) > JOIN_EPS:
            # Gap → straight connector. If both of its endpoints lie on ink
            # we already drew, the runner is retracing — mark it invisible.
            a, b = continuous[-1], pts[0]
            retrace = _point_on_paths(a, drawn_paths, ON_PATH_EPS) and _point_on_paths(
                b, drawn_paths, ON_PATH_EPS
            )
            _append_piece([a, b], "connector", retrace)
        _append_piece(pts, stroke.kind, stroke.retrace)
        drawn_paths.append(pts)

    return ArtPlan(
        strokes=out_strokes,
        order=[idx for idx, _ in order],
        continuous=continuous,
        segments=segments,
    )
