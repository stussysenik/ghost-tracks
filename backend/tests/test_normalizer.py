"""Tests for the Normalizer — the medium laws as pure functions."""

import math

from models.ir import Stroke, StrokeSet
from services.normalizer import (
    GPS_JITTER_M,
    STROKE_BUDGET,
    douglas_peucker,
    normalize,
)


def _circle_stroke(n: int = 200, r: float = 0.45) -> Stroke:
    pts = [
        [0.5 + r * math.cos(2 * math.pi * i / n), 0.5 + r * math.sin(2 * math.pi * i / n)]
        for i in range(n)
    ]
    pts.append(pts[0])
    return Stroke(points=pts, kind="shape")


def test_douglas_peucker_collinear_collapse():
    pts = [[0.0, 0.0], [0.25, 0.0], [0.5, 1e-6], [0.75, 0.0], [1.0, 0.0]]
    assert douglas_peucker(pts, 0.01) == [[0.0, 0.0], [1.0, 0.0]]


def test_simplification_reduces_points():
    dense = StrokeSet(strokes=[_circle_stroke(200)])
    normalized, _ = normalize(dense, placement_hint_width_m=500.0)
    assert len(normalized.strokes) == 1
    assert len(normalized.strokes[0].points) < 200
    assert len(normalized.strokes[0].points) >= 4  # still recognizably round


def test_sub_jitter_stroke_dropped_with_diagnostic():
    big = Stroke(points=[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]], kind="shape")
    # 0.005 of a 1000 m canvas = 5 m — well under the ~20 m jitter floor.
    tiny = Stroke(points=[[0.5, 0.5], [0.505, 0.505]], kind="glyph")
    normalized, diagnostics = normalize(
        StrokeSet(strokes=[big, tiny]), placement_hint_width_m=1000.0
    )
    assert len(normalized.strokes) == 1
    law3 = [d for d in diagnostics if d.law == 3]
    assert law3, "expected a law-3 (resolution) diagnostic"
    assert "GPS" in law3[0].message
    assert law3[0].knob == "scale_up"


def test_never_empty_without_diagnostics():
    """The adapt-don't-reject contract: silence implies survival."""
    all_tiny = StrokeSet(
        strokes=[Stroke(points=[[0.5, 0.5], [0.501, 0.5]], kind="glyph")]
    )
    normalized, diagnostics = normalize(all_tiny, placement_hint_width_m=1000.0)
    assert normalized.strokes == []
    assert diagnostics, "an empty result must always be explained"

    empty_in, diags = normalize(StrokeSet(strokes=[]), placement_hint_width_m=1000.0)
    assert empty_in.strokes == [] and diags


def test_stroke_budget_enforced_with_diagnostic():
    # 20 separated strokes, each 100 m at 1000 m width — none sub-jitter,
    # none touching, so merging cannot save them: pruning must kick in.
    strokes = [
        Stroke(points=[[0.0, i * 0.05], [0.1, i * 0.05]], kind="glyph")
        for i in range(20)
    ]
    normalized, diagnostics = normalize(
        StrokeSet(strokes=strokes), placement_hint_width_m=1000.0
    )
    assert len(normalized.strokes) <= STROKE_BUDGET
    assert any(d.law == 7 for d in diagnostics)


def test_touching_strokes_merge_for_free():
    a = Stroke(points=[[0.0, 0.0], [0.5, 0.0]], kind="glyph")
    b = Stroke(points=[[0.5, 0.0], [0.5, 0.5]], kind="glyph")  # tail touches head
    normalized, _ = normalize(StrokeSet(strokes=[a, b]), placement_hint_width_m=1000.0)
    assert len(normalized.strokes) == 1
    assert len(normalized.strokes[0].points) >= 3


def test_distance_budget_overflow_emits_scale_advice():
    # A long zigzag: lots of ink on a big canvas blows a small budget.
    zigzag = Stroke(
        points=[[i / 20, (i % 2) * 1.0] for i in range(21)], kind="shape"
    )
    _, diagnostics = normalize(
        StrokeSet(strokes=[zigzag]), placement_hint_width_m=3000.0, distance_budget_km=5.0
    )
    law6 = [d for d in diagnostics if d.law == 6]
    assert law6 and law6[0].knob == "accept_distance"
    assert "km" in law6[0].message


def test_arbitrary_fox_like_multistroke_path_normalizes():
    """Spec P1 gate: an LLM-path concept normalizes with no pipeline change."""
    fox = StrokeSet(
        strokes=[
            # body
            Stroke(points=[[0.1, 0.3], [0.5, 0.2], [0.8, 0.35], [0.7, 0.6]], kind="shape"),
            # head
            Stroke(points=[[0.7, 0.6], [0.85, 0.75], [0.75, 0.85], [0.6, 0.7]], kind="shape"),
            # ears (45° triangles)
            Stroke(points=[[0.72, 0.85], [0.76, 0.95], [0.8, 0.85]], kind="shape"),
            # tail
            Stroke(points=[[0.1, 0.3], [0.02, 0.45], [0.08, 0.55]], kind="shape"),
            # legs
            Stroke(points=[[0.35, 0.22], [0.35, 0.05]], kind="shape"),
        ]
    )
    normalized, diagnostics = normalize(fox, placement_hint_width_m=1500.0,
                                        distance_budget_km=8.0)
    assert normalized.strokes, "a fox-sized design at 1.5 km width must survive"
    assert len(normalized.strokes) <= STROKE_BUDGET
    assert isinstance(diagnostics, list)
    # Everything that survived is above the GPS resolution floor.
    for stroke in normalized.strokes:
        xs = [p[0] for p in stroke.points]
        ys = [p[1] for p in stroke.points]
        extent_m = max(max(xs) - min(xs), max(ys) - min(ys)) * 1500.0
        assert extent_m >= GPS_JITTER_M
