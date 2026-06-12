"""Ghost Tracks — StrokeSet IR and compiler-pipeline wire types.

ARCHITECTURE LESSON — the compiler model
========================================
Generation is structured like a compiler: many *frontends* (text glyphs,
parametric templates, LLM-drawn concepts, image tracing) each emit ONE
intermediate representation — the ``StrokeSet`` — and everything downstream
(Normalizer → Composer → Projector → Solver) only ever sees that IR.

Adding a new kind of input is a new frontend emitting IR — never a pipeline
change. This is the same trick LLVM uses: N languages × M targets becomes
N + M instead of N × M.

WIRE-FORMAT CONTRACT
====================
These JSON shapes are mirrored in TypeScript (zod) and Scala (case classes).
Do NOT deviate: a ``UnitPoint`` is a **2-element list** ``[x, y]``, not an
object — pydantic serializes ``list[float]`` naturally, which keeps the JSON
identical across all three runtimes.

Unit space convention: x, y ∈ [0, 1], **y points up** (math convention, like
latitude). SVG rendering flips y; geographic projection does not.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from models.schemas import BoundingBox, Coordinate

# A point in unit canvas space: [x, y] with 0 <= x, y <= 1 (y up).
# Annotated list (not a class!) so JSON stays a bare 2-element array.
UnitPoint = Annotated[list[float], Field(min_length=2, max_length=2)]

# A geographic point: [lng, lat] — GeoJSON ordering, matching Mapbox/kernel.
LngLat = Annotated[list[float], Field(min_length=2, max_length=2)]

StrokeKind = Literal["glyph", "shape", "connector"]

# Design knobs a diagnostic can point the user at — every medium-law
# violation maps to one concrete, actionable adjustment (spec §6.2).
DiagnosticKnob = Literal[
    "scale_up", "reduce_detail", "move_area", "split_runs", "accept_distance"
]


class Stroke(BaseModel):
    """One pen-down polyline.

    ``kind`` records provenance (glyph/shape) or function (connector);
    ``retrace`` marks ink that re-draws an existing path — retraced GPS
    segments visually disappear, which is the craft trick for "pen lifts".
    """

    points: list[UnitPoint]
    kind: StrokeKind
    retrace: bool = False


class StrokeSet(BaseModel):
    """The IR: the ONLY format downstream stages see (spec §6.1)."""

    strokes: list[Stroke]


class SegmentMeta(BaseModel):
    """Index range into a continuous polyline, with provenance.

    ``start_idx``/``end_idx`` are **inclusive** indices into the owning
    polyline (``ArtPlan.continuous`` or a densified/solved trace). The Scala
    kernel uses these to report per-segment provenance after map matching.
    """

    kind: StrokeKind
    retrace: bool = False
    start_idx: int
    end_idx: int


class ArtPlan(BaseModel):
    """Composed artwork: ONE continuous line (medium law #1).

    - ``strokes``: every drawn piece in draw order, connectors included.
    - ``order``: permutation of the *input* StrokeSet's stroke indices the
      composer chose (connector insertion happens after ordering).
    - ``continuous``: the single concatenated polyline a runner will trace.
    - ``segments``: index ranges into ``continuous``, aligned 1:1 with
      ``strokes`` — the kernel needs these to keep provenance through solving.
    """

    strokes: list[Stroke]
    order: list[int]
    continuous: list[UnitPoint]
    segments: list[SegmentMeta] = Field(default_factory=list)


class ShapeRef(BaseModel):
    """A named shape the user asked for ("heart", "fox", ...)."""

    name: str


class Intent(BaseModel):
    """What the user asked for, extracted from natural language.

    All fields default so a bare ``Intent()`` is valid — /art/solve does not
    require the caller to round-trip intent.
    """

    texts: list[str] = Field(default_factory=list)
    shapes: list[ShapeRef] = Field(default_factory=list)
    occasion: str | None = None
    area: str | None = None
    distance_km: float | None = None
    loop: bool = True


class Placement(BaseModel):
    """Where the unit canvas lands on Earth: bbox + rotation about its center."""

    bbox: BoundingBox
    rotation_deg: float = 0
    anchor: Coordinate


class SolveResult(BaseModel):
    """Street-snapped route from the kernel, plus our fidelity verdict."""

    coordinates: list[LngLat]
    segments: list[SegmentMeta]
    distance_km: float
    duration_min: float
    fidelity: float
    success: bool
    error: str | None = None


class Diagnostic(BaseModel):
    """An actionable medium-law warning (spec §6.2).

    ``law`` is the medium-law number (1–7); ``knob`` is the single design
    adjustment most likely to fix it. The Normalizer never rejects — it
    adapts the design and *explains* what was lost via these.
    """

    law: int
    message: str
    knob: DiagnosticKnob


class ArtRoute(BaseModel):
    """The full product artifact: state is a pure function of these parts."""

    intent: Intent = Field(default_factory=Intent)
    plan: ArtPlan
    placement: Placement
    solve: SolveResult
    gpx_url: str | None = None
    share_id: str | None = None
