"""POST /art/compose and /art/solve — the compiler pipeline as an API.

LESSON — the pipeline is a straight line of total functions
===========================================================
compose:  parse → frontends → merge → normalize → compose → place → preview
solve:    project → kernel /solve → score → tighten loop → ArtRoute

Every stage consumes and produces explicit types from ``models.ir``; edits
re-enter the pipeline at a stage boundary instead of mutating downstream
state. The Scala kernel is a *separate process* (stateful GraphHopper
graph), reached over HTTP with a camelCase wire format; this module owns
the snake_case ↔ camelCase translation so neither side bends.
"""

from __future__ import annotations

import math
import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel, Field

from frontends.canvas import merge_canvas
from frontends.glyphs import layout_text
from frontends.llm_path import concept_strokeset
from frontends.templates import is_known_shape, template_strokeset
from models.ir import (
    ArtPlan,
    ArtRoute,
    Diagnostic,
    Intent,
    Placement,
    SegmentMeta,
    SolveResult,
    StrokeSet,
)
from models.schemas import BoundingBox, Coordinate
from services.composer import compose
from services.intent_parser import parse as parse_intent
from services.neighborhood import NeighborhoodService
from services.normalizer import ROUTE_OVERHEAD, normalize
from services.preview import render_svg
from services.projector import project
from services.shape_validator import ShapeValidator
from services.street_mapper import haversine_distance_m

router = APIRouter()
_neighborhoods = NeighborhoodService()
_validator = ShapeValidator()

DEFAULT_KERNEL_URL = "http://localhost:8080"
DEFAULT_DISTANCE_KM = 8.0
FIDELITY_TARGET = 70.0
MAX_TIGHTEN_RETRIES = 2
_M_PER_DEG_LAT = 110_540.0
_M_PER_DEG_LNG_EQUATOR = 111_320.0


# --------------------------------------------------------------------------
# Request / response shapes
# --------------------------------------------------------------------------

class ComposeRequest(BaseModel):
    prompt: str
    area: str | None = None
    distance_km: float | None = Field(default=None, gt=0)


class ComposeResponse(BaseModel):
    intent: Intent
    plan: ArtPlan
    placement: Placement
    preview_svg: str
    diagnostics: list[Diagnostic]


class SolveOpts(BaseModel):
    close_loop: bool | None = None
    profile: str = "foot"


class SolveRequest(BaseModel):
    plan: ArtPlan
    placement: Placement
    opts: SolveOpts | None = None
    intent: Intent | None = None  # optional pass-through into the ArtRoute


# --------------------------------------------------------------------------
# /art/compose
# --------------------------------------------------------------------------

def _shape_strokeset(name: str) -> StrokeSet:
    """Known shape → template; novel concept → LLM path → template fallback.

    The fallback chain is the graceful-degradation contract: a missing LLM
    never breaks compose, it just narrows the vocabulary to the templates.
    """
    if is_known_shape(name):
        return template_strokeset(name)
    try:
        return concept_strokeset(name)
    except Exception:
        return template_strokeset("circle")


def _canvas_width_m(strokeset: StrokeSet, budget_km: float) -> float:
    """Size the physical canvas so total ink ≈ the distance budget."""
    ink_unit = sum(
        math.hypot(s.points[i + 1][0] - s.points[i][0], s.points[i + 1][1] - s.points[i][1])
        for s in strokeset.strokes
        for i in range(len(s.points) - 1)
    )
    if ink_unit <= 0:
        return 1000.0
    width = budget_km * 1000.0 / (ink_unit * ROUTE_OVERHEAD)
    return min(max(width, 300.0), 5000.0)


def _default_placement(area: str | None, width_m: float) -> Placement:
    """A square canvas centered on the requested (or default) neighborhood."""
    hood = _neighborhoods.get_by_name(area) if area else None
    if hood is None:
        hood = _neighborhoods.get_by_name("Vinohrady")
    if hood is not None:
        center = hood.center
    else:  # no data file — still produce something usable (Prague center)
        center = Coordinate(lng=14.42076, lat=50.08804)

    half_lat = width_m / _M_PER_DEG_LAT / 2
    half_lng = width_m / (_M_PER_DEG_LNG_EQUATOR * math.cos(math.radians(center.lat))) / 2
    return Placement(
        bbox=BoundingBox(
            min_lng=center.lng - half_lng,
            min_lat=center.lat - half_lat,
            max_lng=center.lng + half_lng,
            max_lat=center.lat + half_lat,
        ),
        rotation_deg=0,
        anchor=center,
    )


@router.post("/compose", response_model=ComposeResponse)
def compose_art(req: ComposeRequest) -> ComposeResponse:
    intent = parse_intent(req.prompt)
    if req.area:
        intent.area = req.area
    if req.distance_km:
        intent.distance_km = req.distance_km

    # Frontends: each input kind compiles to the same StrokeSet IR.
    text_sets = [layout_text(t) for t in intent.texts if t.strip()]
    shape_sets = [_shape_strokeset(ref.name) for ref in intent.shapes]
    if not any(ts.strokes for ts in text_sets) and not any(ss.strokes for ss in shape_sets):
        # Nothing extractable — treat the whole prompt as a novel concept.
        try:
            shape_sets = [concept_strokeset(req.prompt)]
        except Exception:
            shape_sets = [template_strokeset("circle")]

    merged = merge_canvas(text_sets, shape_sets)

    budget_km = intent.distance_km or DEFAULT_DISTANCE_KM
    width_m = _canvas_width_m(merged, budget_km)
    normalized, diagnostics = normalize(merged, width_m, budget_km)
    plan = compose(normalized)
    placement = _default_placement(intent.area, width_m)

    return ComposeResponse(
        intent=intent,
        plan=plan,
        placement=placement,
        preview_svg=render_svg(plan),
        diagnostics=diagnostics,
    )


# --------------------------------------------------------------------------
# /art/solve
# --------------------------------------------------------------------------

def _call_kernel(payload: dict) -> dict:
    """POST to the Scala GeoKernel. Module-level seam: tests monkeypatch it."""
    kernel_url = os.environ.get("KERNEL_URL", DEFAULT_KERNEL_URL)
    response = httpx.post(f"{kernel_url}/solve", json=payload, timeout=90.0)
    response.raise_for_status()
    return response.json()


def _kernel_payload(
    trace: list[list[float]],
    segments: list[SegmentMeta],
    profile: str,
    close_loop: bool,
) -> dict:
    """snake_case IR → the kernel's camelCase wire format."""
    return {
        "trace": trace,
        "profile": profile,
        "closeLoop": close_loop,
        "segments": [
            {
                "kind": s.kind,
                "retrace": s.retrace,
                "startIdx": s.start_idx,
                "endIdx": s.end_idx,
            }
            for s in segments
        ],
    }


def _parse_kernel_segments(raw: list | None) -> list[SegmentMeta]:
    """Defensive parse — accept camelCase (canonical) or snake_case."""
    segments: list[SegmentMeta] = []
    for s in raw or []:
        segments.append(
            SegmentMeta(
                kind=s.get("kind", "shape"),
                retrace=bool(s.get("retrace", False)),
                start_idx=int(s.get("startIdx", s.get("start_idx", 0))),
                end_idx=int(s.get("endIdx", s.get("end_idx", 0))),
            )
        )
    return segments


def _fidelity(target: list[list[float]], actual: list[list[float]]) -> float:
    """Algorithmic fidelity score (no network, no vision model)."""
    if not target or not actual:
        return 0.0
    target_c = [Coordinate(lng=p[0], lat=p[1]) for p in target]
    actual_c = [Coordinate(lng=p[0], lat=p[1]) for p in actual]
    result = _validator._validate_algorithmic(target_c, actual_c, int(FIDELITY_TARGET))
    return float(result.score)


def _tighten_trace(
    trace: list[list[float]],
    solved: list[list[float]],
    segments: list[SegmentMeta],
    n_spans: int = 3,
) -> tuple[list[list[float]], list[SegmentMeta]]:
    """Insert midpoints around the worst-deviating trace spans.

    Map matching drifts where the trace is sparse; extra vertices near the
    max-deviation points pull the matcher back onto the intended geometry.
    Segment ranges are shifted to account for every insertion.
    """
    if len(trace) < 3 or not solved:
        return trace, segments

    # Subsample the solved route so deviation stays O(n·m/k).
    sample = solved[:: max(1, len(solved) // 200)]
    sample_c = [Coordinate(lng=p[0], lat=p[1]) for p in sample]

    deviations: list[tuple[float, int]] = []
    for i in range(1, len(trace) - 1):
        p = Coordinate(lng=trace[i][0], lat=trace[i][1])
        deviations.append((min(haversine_distance_m(p, s) for s in sample_c), i))
    deviations.sort(reverse=True)

    # Pick the worst spans, keeping them apart so we don't pile onto one spot.
    chosen: list[int] = []
    for _, i in deviations:
        if len(chosen) >= n_spans:
            break
        if all(abs(i - j) > 2 for j in chosen):
            chosen.append(i)

    # Insertion positions on the ORIGINAL index space: a midpoint before i
    # and one before i+1 bracket the offending vertex.
    positions: list[tuple[int, list[float]]] = []
    for i in chosen:
        positions.append((i, [(trace[i - 1][0] + trace[i][0]) / 2,
                              (trace[i - 1][1] + trace[i][1]) / 2]))
        positions.append((i + 1, [(trace[i][0] + trace[i + 1][0]) / 2,
                                  (trace[i][1] + trace[i + 1][1]) / 2]))

    new_trace = [list(p) for p in trace]
    for pos, point in sorted(positions, key=lambda x: x[0], reverse=True):
        new_trace.insert(pos, point)

    insert_positions = sorted(pos for pos, _ in positions)

    def _shift(idx: int) -> int:
        return idx + sum(1 for pos in insert_positions if pos <= idx)

    new_segments = [
        SegmentMeta(
            kind=s.kind,
            retrace=s.retrace,
            start_idx=_shift(s.start_idx),
            end_idx=_shift(s.end_idx),
        )
        for s in segments
    ]
    return new_trace, new_segments


@router.post("/solve", response_model=ArtRoute)
def solve_art(req: SolveRequest) -> ArtRoute:
    opts = req.opts or SolveOpts()
    intent = req.intent or Intent()
    close_loop = opts.close_loop if opts.close_loop is not None else intent.loop

    trace, segments = project(req.plan, req.placement)

    def _failed(message: str) -> ArtRoute:
        return ArtRoute(
            intent=intent,
            plan=req.plan,
            placement=req.placement,
            solve=SolveResult(
                coordinates=[],
                segments=[],
                distance_km=0.0,
                duration_min=0.0,
                fidelity=0.0,
                success=False,
                error=message,
            ),
        )

    if not trace:
        return _failed("empty plan — compose an artwork before solving")

    best: dict | None = None
    best_fidelity = -1.0
    best_segments = segments
    retries = 0
    while True:
        try:
            data = _call_kernel(_kernel_payload(trace, segments, opts.profile, close_loop))
        except Exception:
            kernel_url = os.environ.get("KERNEL_URL", DEFAULT_KERNEL_URL)
            return _failed(
                f"kernel unreachable at {kernel_url} — start the Scala GeoKernel "
                "(:8080) or set KERNEL_URL"
            )

        solved = [list(map(float, c)) for c in (data.get("coordinates") or [])]
        fidelity = _fidelity(trace, solved) if data.get("success") else 0.0
        if fidelity > best_fidelity:
            best, best_fidelity, best_segments = data, fidelity, segments

        # Tighten loop: add vertices where the solve drifted, try again.
        if fidelity >= FIDELITY_TARGET or retries >= MAX_TIGHTEN_RETRIES or not solved:
            break
        trace, segments = _tighten_trace(trace, solved, segments)
        retries += 1

    assert best is not None
    kernel_segments = _parse_kernel_segments(best.get("segments"))
    solve = SolveResult(
        coordinates=[list(map(float, c)) for c in (best.get("coordinates") or [])],
        segments=kernel_segments if kernel_segments else best_segments,
        distance_km=float(best.get("distance_km", best.get("distanceKm", 0.0)) or 0.0),
        duration_min=float(
            best.get("duration_minutes", best.get("duration_min", 0.0)) or 0.0
        ),
        fidelity=best_fidelity,
        success=bool(best.get("success", False)),
        error=best.get("error"),
    )
    # gpx_url / share_id stay None: the gateway owns export + share links.
    return ArtRoute(intent=intent, plan=req.plan, placement=req.placement, solve=solve)
