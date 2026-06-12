"""Tests for the composer: ordering, connector insertion, continuity."""

import math

from models.ir import ArtPlan, Stroke, StrokeSet
from services.composer import compose


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _connector_ink(plan: ArtPlan) -> float:
    total = 0.0
    for stroke in plan.strokes:
        if stroke.kind == "connector":
            for i in range(len(stroke.points) - 1):
                total += _dist(stroke.points[i], stroke.points[i + 1])
    return total


def _assert_continuous(plan: ArtPlan):
    """The whole point of the composer: ONE gap-free polyline."""
    assert plan.continuous, "empty continuous polyline"
    # Segments tile the polyline and consecutive segments share their joint.
    assert plan.segments[0].start_idx == 0
    assert plan.segments[-1].end_idx == len(plan.continuous) - 1
    for k in range(len(plan.segments) - 1):
        assert plan.segments[k].end_idx == plan.segments[k + 1].start_idx
    # Each segment's index range reproduces its stroke's geometry.
    for stroke, seg in zip(plan.strokes, plan.segments):
        span = plan.continuous[seg.start_idx : seg.end_idx + 1]
        assert span == stroke.points


def test_single_stroke_passthrough():
    plan = compose(StrokeSet(strokes=[Stroke(points=[[0, 0], [1, 1]], kind="shape")]))
    assert plan.order == [0]
    assert plan.continuous == [[0, 0], [1, 1]]
    assert len(plan.segments) == 1
    _assert_continuous(plan)


def test_connector_inserted_between_disjoint_strokes():
    plan = compose(
        StrokeSet(
            strokes=[
                Stroke(points=[[0.0, 0.0], [0.2, 0.0]], kind="glyph"),
                Stroke(points=[[0.6, 0.0], [0.8, 0.0]], kind="glyph"),
            ]
        )
    )
    kinds = [s.kind for s in plan.strokes]
    assert kinds == ["glyph", "connector", "glyph"]
    _assert_continuous(plan)
    # The connector spans exactly the gap.
    connector = plan.strokes[1]
    assert math.isclose(_dist(connector.points[0], connector.points[-1]), 0.4)


def test_touching_strokes_need_no_connector():
    plan = compose(
        StrokeSet(
            strokes=[
                Stroke(points=[[0.0, 0.0], [0.5, 0.0]], kind="glyph"),
                Stroke(points=[[0.5, 0.0], [0.5, 0.5]], kind="glyph"),
            ]
        )
    )
    assert all(s.kind != "connector" for s in plan.strokes)
    _assert_continuous(plan)


def test_order_minimizes_connector_ink_vs_naive():
    """Fixture: naive order 0,1,2 costs 6.0; the optimum (0,2,1) costs 2.0."""
    strokes = [
        Stroke(points=[[0.0, 0.0], [1.0, 0.0]], kind="shape"),
        Stroke(points=[[4.0, 0.0], [5.0, 0.0]], kind="shape"),
        Stroke(points=[[2.0, 0.0], [3.0, 0.0]], kind="shape"),
    ]
    plan = compose(StrokeSet(strokes=strokes))
    assert sorted(plan.order) == [0, 1, 2]  # a true permutation
    assert _connector_ink(plan) <= 2.0 + 1e-9
    _assert_continuous(plan)


def test_two_opt_beats_pure_greedy_trap():
    """Strokes may be entered at either end — reversal must be exploited."""
    strokes = [
        Stroke(points=[[0.0, 0.0], [1.0, 0.0]], kind="shape"),
        Stroke(points=[[3.0, 0.0], [1.2, 0.0]], kind="shape"),  # reversed layout
        Stroke(points=[[3.2, 0.0], [4.0, 0.0]], kind="shape"),
    ]
    plan = compose(StrokeSet(strokes=strokes))
    # Optimal: draw 0, reverse 1 (enter at 1.2), then 2 → ink 0.2 + 0.2.
    assert _connector_ink(plan) <= 0.4 + 1e-9
    _assert_continuous(plan)


def test_retrace_connector_detected():
    """A connector lying fully on already-drawn ink is marked retrace."""
    strokes = [
        Stroke(points=[[0.0, 0.0], [1.0, 0.0]], kind="shape"),
        # Starts in the middle of stroke 0's path, heads away from it.
        Stroke(points=[[0.5, 0.0], [0.5, 0.8]], kind="shape"),
    ]
    plan = compose(StrokeSet(strokes=strokes))
    connectors = [s for s in plan.strokes if s.kind == "connector"]
    assert len(connectors) == 1
    assert connectors[0].retrace is True
    # And the matching segment carries the flag too.
    seg = [s for s in plan.segments if s.kind == "connector"][0]
    assert seg.retrace is True


def test_visible_connector_not_marked_retrace():
    strokes = [
        Stroke(points=[[0.0, 0.0], [0.2, 0.0]], kind="glyph"),
        Stroke(points=[[0.9, 0.9], [1.0, 1.0]], kind="glyph"),
    ]
    plan = compose(StrokeSet(strokes=strokes))
    connectors = [s for s in plan.strokes if s.kind == "connector"]
    assert len(connectors) == 1
    assert connectors[0].retrace is False


def test_empty_strokeset():
    plan = compose(StrokeSet(strokes=[]))
    assert plan.continuous == [] and plan.order == [] and plan.segments == []
