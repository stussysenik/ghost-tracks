"""Wire-format tests for the StrokeSet IR — the cross-runtime contract.

These tests pin the EXACT JSON shapes shared with TypeScript (zod) and
Scala (case classes). If one of them fails after a model edit, the wire
contract broke for three runtimes, not one.
"""

import json

from models.ir import (
    ArtPlan,
    ArtRoute,
    Diagnostic,
    Intent,
    Placement,
    SegmentMeta,
    ShapeRef,
    SolveResult,
    Stroke,
    StrokeSet,
)
from models.schemas import BoundingBox, Coordinate


def _sample_plan() -> ArtPlan:
    return ArtPlan(
        strokes=[
            Stroke(points=[[0.0, 0.0], [0.5, 1.0]], kind="glyph"),
            Stroke(points=[[0.5, 1.0], [1.0, 0.0]], kind="connector", retrace=True),
        ],
        order=[0],
        continuous=[[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]],
        segments=[
            SegmentMeta(kind="glyph", retrace=False, start_idx=0, end_idx=1),
            SegmentMeta(kind="connector", retrace=True, start_idx=1, end_idx=2),
        ],
    )


def test_points_serialize_as_bare_lists():
    """A UnitPoint must be [x, y] — a 2-element JSON array, never an object."""
    stroke = Stroke(points=[(0.1, 0.2), [0.3, 0.4]], kind="shape")
    dumped = stroke.model_dump()
    assert dumped["points"] == [[0.1, 0.2], [0.3, 0.4]]
    raw = json.loads(stroke.model_dump_json())
    assert raw["points"] == [[0.1, 0.2], [0.3, 0.4]]
    assert isinstance(raw["points"][0], list)


def test_stroke_defaults():
    stroke = Stroke(points=[[0, 0], [1, 1]], kind="glyph")
    assert stroke.retrace is False


def test_artplan_round_trip():
    plan = _sample_plan()
    restored = ArtPlan.model_validate_json(plan.model_dump_json())
    assert restored == plan
    assert restored.segments[1].retrace is True


def test_segment_meta_wire_keys():
    seg = SegmentMeta(kind="connector", retrace=True, start_idx=3, end_idx=7)
    raw = json.loads(seg.model_dump_json())
    assert raw == {"kind": "connector", "retrace": True, "start_idx": 3, "end_idx": 7}


def test_intent_defaults_and_round_trip():
    intent = Intent()
    assert intent.loop is True
    assert intent.texts == [] and intent.shapes == []

    full = Intent(
        texts=["ANNA + TOM"],
        shapes=[ShapeRef(name="heart")],
        occasion="valentines",
        area="Vinohrady",
        distance_km=8.0,
        loop=True,
    )
    assert Intent.model_validate_json(full.model_dump_json()) == full


def test_solve_result_lnglat_pairs():
    result = SolveResult(
        coordinates=[[14.43, 50.07], [14.44, 50.08]],
        segments=[SegmentMeta(kind="shape", start_idx=0, end_idx=1)],
        distance_km=8.2,
        duration_min=55.0,
        fidelity=83.0,
        success=True,
    )
    raw = json.loads(result.model_dump_json())
    assert raw["coordinates"] == [[14.43, 50.07], [14.44, 50.08]]
    assert raw["error"] is None


def test_art_route_round_trip_with_optional_extras():
    route = ArtRoute(
        plan=_sample_plan(),
        placement=Placement(
            bbox=BoundingBox(min_lng=14.4, min_lat=50.0, max_lng=14.5, max_lat=50.1),
            anchor=Coordinate(lng=14.45, lat=50.05),
        ),
        solve=SolveResult(
            coordinates=[],
            segments=[],
            distance_km=0,
            duration_min=0,
            fidelity=0,
            success=False,
            error="kernel unreachable",
        ),
    )
    assert route.gpx_url is None and route.share_id is None
    assert route.placement.rotation_deg == 0
    restored = ArtRoute.model_validate_json(route.model_dump_json())
    assert restored == route


def test_diagnostic_knob_is_constrained():
    diag = Diagnostic(law=3, message="too small", knob="scale_up")
    assert diag.law == 3
    import pytest

    with pytest.raises(Exception):
        Diagnostic(law=3, message="x", knob="not_a_knob")
