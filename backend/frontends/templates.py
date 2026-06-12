"""Template frontend: known shape name → StrokeSet (deterministic).

LESSON — adapters over rewrites
===============================
The parametric generators in ``services/shape_templates.py`` predate the IR
and emit geographic ``Coordinate``s around an arbitrary center. Rather than
rewrite them, this frontend *adapts*: it asks each generator to draw around
(0.5, 0.5) at unit scale, reads lng/lat as plain x/y, and renormalizes into
the unit canvas. The generators stay the single source of truth for shape
geometry; the IR stays the single source of truth for the pipeline.
"""

from __future__ import annotations

from frontends.canvas import normalize_unit
from models.ir import Stroke, StrokeSet
from models.schemas import Coordinate
from services.shape_templates import TEMPLATES

KNOWN_SHAPES = frozenset(TEMPLATES.keys())


class UnknownShapeError(KeyError):
    """Raised when no parametric template exists for a shape name."""


def is_known_shape(name: str) -> bool:
    """True if some template key appears in the (lowercased) name."""
    return _match_key(name) is not None


def _match_key(name: str) -> str | None:
    lowered = name.lower().strip()
    for key in TEMPLATES:
        if key in lowered:
            return key
    return None


def template_strokeset(name: str) -> StrokeSet:
    """Compile a known shape name to IR.

    Closed shapes come out of the generators with last point == first point
    (the templates close themselves) — the composer relies on that to treat
    them as loops with free choice of start point.
    """
    key = _match_key(name)
    if key is None:
        raise UnknownShapeError(name)
    coords: list[Coordinate] = TEMPLATES[key](0.5, 0.5, 1.0)
    stroke = Stroke(points=[[c.lng, c.lat] for c in coords], kind="shape")
    return StrokeSet(strokes=normalize_unit([stroke]))
