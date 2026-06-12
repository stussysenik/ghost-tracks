"""Normalizer: adapt any StrokeSet IR to the medium laws (spec §6.2).

LESSON — lossy compilation, never rejection
===========================================
Streets + GPS + human legs impose physics, not product choices:

  law 3  resolution — GPS jitter (~20 m) is a Nyquist limit; smaller detail
         simply does not exist after recording
  law 4  piecewise-linearity — curves must survive simplification
  law 6  length budget — 5–25 km is the human range
  law 7  stroke budget — every disconnected stroke costs connector ink

Like printing a photo on a dot-matrix printer, the Normalizer *adapts* the
design to the medium (simplify, prune, merge) and explains every loss with
an actionable ``Diagnostic`` tied to a design knob. It never rejects: the
worst case is an empty StrokeSet accompanied by diagnostics that say
exactly which knob to turn.

Everything here is a pure function: (IR, physical hints) → (IR, diagnostics).
"""

from __future__ import annotations

import math

from models.ir import Diagnostic, Stroke, StrokeSet

GPS_JITTER_M = 20.0  # urban multipath floor — the medium's pixel size
STROKE_BUDGET = 12  # beyond this, connector noise dominates the art
HUMAN_MIN_KM = 5.0
HUMAN_MAX_KM = 25.0
# Routes are longer than raw ink: connectors + street snapping detours.
ROUTE_OVERHEAD = 1.4


# --------------------------------------------------------------------------
# Pure geometry helpers
# --------------------------------------------------------------------------

def _dist(a: list[float], b: list[float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _perpendicular_distance(p: list[float], a: list[float], b: list[float]) -> float:
    """Distance from p to segment ab (used by Douglas-Peucker)."""
    ab = (b[0] - a[0], b[1] - a[1])
    seg_len_sq = ab[0] ** 2 + ab[1] ** 2
    if seg_len_sq == 0:
        return _dist(p, a)
    t = ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / seg_len_sq
    t = min(max(t, 0.0), 1.0)
    proj = [a[0] + t * ab[0], a[1] + t * ab[1]]
    return _dist(p, proj)


def douglas_peucker(points: list[list[float]], tolerance: float) -> list[list[float]]:
    """Classic recursive polyline simplification.

    Keeps endpoints, recursively keeps the farthest-out point while it
    exceeds tolerance. This is medium law 4 made executable: any vertex the
    streets cannot resolve is noise and gets dropped *before* routing.
    """
    if len(points) < 3:
        return list(points)
    a, b = points[0], points[-1]
    max_d, max_i = 0.0, 0
    for i in range(1, len(points) - 1):
        d = _perpendicular_distance(points[i], a, b)
        if d > max_d:
            max_d, max_i = d, i
    if max_d <= tolerance:
        return [a, b]
    left = douglas_peucker(points[: max_i + 1], tolerance)
    right = douglas_peucker(points[max_i:], tolerance)
    return left[:-1] + right


def _stroke_extent(points: list[list[float]]) -> float:
    """Largest bbox dimension — the stroke's 'feature size'."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return max(max(xs) - min(xs), max(ys) - min(ys))


def _stroke_length(points: list[list[float]]) -> float:
    return sum(_dist(points[i], points[i + 1]) for i in range(len(points) - 1))


def _merge_touching(strokes: list[Stroke], eps: float) -> list[Stroke]:
    """Concatenate strokes whose endpoints nearly touch (same kind).

    Greedy single pass: walk the list, and whenever the current chain's tail
    is within eps of another stroke's head (or reversed tail), absorb it.
    Fewer strokes = less connector ink (medium law 7) at zero visual cost.
    """
    remaining = [s for s in strokes]
    merged: list[Stroke] = []
    while remaining:
        current = remaining.pop(0)
        pts = [list(p) for p in current.points]
        changed = True
        while changed:
            changed = False
            for i, other in enumerate(remaining):
                if other.kind != current.kind or other.retrace != current.retrace:
                    continue
                o = other.points
                if _dist(pts[-1], o[0]) <= eps:
                    pts.extend([list(p) for p in o[1:]])
                elif _dist(pts[-1], o[-1]) <= eps:
                    pts.extend([list(p) for p in reversed(o[:-1])])
                elif _dist(pts[0], o[-1]) <= eps:
                    pts = [list(p) for p in o[:-1]] + pts
                elif _dist(pts[0], o[0]) <= eps:
                    pts = [list(p) for p in reversed(o[1:])] + pts
                else:
                    continue
                remaining.pop(i)
                changed = True
                break
        merged.append(Stroke(points=pts, kind=current.kind, retrace=current.retrace))
    return merged


# --------------------------------------------------------------------------
# The normalizer
# --------------------------------------------------------------------------

def normalize(
    strokeset: StrokeSet,
    placement_hint_width_m: float,
    distance_budget_km: float | None = None,
) -> tuple[StrokeSet, list[Diagnostic]]:
    """Adapt a StrokeSet to the medium laws. Never rejects.

    ``placement_hint_width_m`` is the intended physical width of the unit
    canvas — it converts unit-space geometry into meters so the laws (which
    are physical) can be applied. Returns the adapted StrokeSet plus
    actionable diagnostics for everything that was lost or is at risk.
    """
    diagnostics: list[Diagnostic] = []
    width_m = max(placement_hint_width_m, 1.0)

    if not strokeset.strokes:
        diagnostics.append(
            Diagnostic(
                law=7,
                message="nothing to draw — add text or a shape to the design",
                knob="reduce_detail",
            )
        )
        return StrokeSet(strokes=[]), diagnostics

    # Law 3/4 — simplify to street resolution. Tolerance: half the GPS
    # jitter expressed in unit space; vertices the recording cannot resolve
    # are noise.
    tolerance_unit = 0.5 * GPS_JITTER_M / width_m

    simplified: list[Stroke] = []
    dropped = 0
    for stroke in strokeset.strokes:
        if len(stroke.points) < 2:
            dropped += 1
            continue
        pts = douglas_peucker([list(p) for p in stroke.points], tolerance_unit)
        extent_m = _stroke_extent(pts) * width_m
        if extent_m < GPS_JITTER_M:
            dropped += 1
            continue
        simplified.append(Stroke(points=pts, kind=stroke.kind, retrace=stroke.retrace))

    if dropped:
        diagnostics.append(
            Diagnostic(
                law=3,
                message=(
                    f"{dropped} stroke(s) dropped: detail below GPS resolution "
                    f"(~{GPS_JITTER_M:.0f} m) at {width_m:.0f} m canvas width — "
                    "scale up or reduce detail"
                ),
                knob="scale_up",
            )
        )

    # Law 7 — stroke budget. First merge for free, then prune if still over.
    merged = _merge_touching(simplified, eps=tolerance_unit * 2)
    if len(merged) > STROKE_BUDGET:
        # Keep the longest strokes (most ink = most signal), original order.
        ranked = sorted(merged, key=lambda s: _stroke_length(s.points), reverse=True)
        keep = set(id(s) for s in ranked[:STROKE_BUDGET])
        pruned_count = len(merged) - STROKE_BUDGET
        merged = [s for s in merged if id(s) in keep]
        diagnostics.append(
            Diagnostic(
                law=7,
                message=(
                    f"{pruned_count} smallest stroke(s) pruned to stay within the "
                    f"{STROKE_BUDGET}-stroke budget — reduce detail, or split the "
                    "design into multiple runs"
                ),
                knob="reduce_detail",
            )
        )

    # Law 6 — length budget. Estimate the route the runner actually faces.
    ink_unit = sum(_stroke_length(s.points) for s in merged)
    est_km = ink_unit * width_m * ROUTE_OVERHEAD / 1000.0
    budget_km = distance_budget_km if distance_budget_km else HUMAN_MAX_KM
    if est_km > budget_km * 1.15:
        fit_width = budget_km * 1000.0 / (ink_unit * ROUTE_OVERHEAD or 1e-9)
        diagnostics.append(
            Diagnostic(
                law=6,
                message=(
                    f"estimated route ≈ {est_km:.1f} km exceeds the "
                    f"{budget_km:.0f} km budget — scale the canvas down to "
                    f"~{fit_width:.0f} m width, or accept ~{est_km:.0f} km"
                ),
                knob="accept_distance",
            )
        )
    elif merged and est_km < max(distance_budget_km or 0.0, HUMAN_MIN_KM) * 0.4:
        diagnostics.append(
            Diagnostic(
                law=6,
                message=(
                    f"estimated route ≈ {est_km:.1f} km is far below the "
                    f"distance budget — scale up for a sharper drawing"
                ),
                knob="scale_up",
            )
        )

    if not merged and not diagnostics:
        # Invariant: an empty result is always explained (defensive — the
        # drop branch above already diagnoses every known empty path).
        diagnostics.append(
            Diagnostic(
                law=3,
                message="no strokes survived normalization — scale up the design",
                knob="scale_up",
            )
        )

    return StrokeSet(strokes=merged), diagnostics
