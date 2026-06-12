"""LLM-path frontend: novel concept → StrokeSet (variable determinism).

LESSON — degrading gracefully around an unreliable dependency
=============================================================
This is the only *non-deterministic* frontend. The architecture treats the
LLM as optional everywhere: if no model is configured (or it misbehaves),
``concept_strokeset`` raises ``LLMUnavailableError`` and callers fall back
to the deterministic template frontend. The pipeline itself never changes —
that is the whole point of compiling everything to the same IR.

Defensive parsing is the other half of the story: LLM output is *data from
an untrusted source*. We strip code fences, hunt for the JSON object,
clamp every coordinate into [0, 1], and discard degenerate strokes before
anything downstream can see them.
"""

from __future__ import annotations

import json

import dspy

from frontends.canvas import normalize_unit
from models.ir import Stroke, StrokeSet


class LLMUnavailableError(RuntimeError):
    """No LLM configured (or it produced nothing usable) — fall back."""


def _active_lm():
    """The currently configured DSPy LM, or None.

    Isolated in a function so tests can monkeypatch LLM availability without
    touching global DSPy state.
    """
    return getattr(dspy.settings, "lm", None)


class DrawSingleStrokeConcept(dspy.Signature):
    """Draw a concept as minimal single-line (pen-plotter style) art.

    Output STRICT JSON: {"strokes": [[[x, y], ...], ...]} where each stroke
    is a polyline of [x, y] points in unit space (0..1, y pointing UP).
    Rules: at most 6 strokes total; at most 20 points per stroke; use
    straight segments and 45-degree diagonals instead of curves; the drawing
    must stay recognizable as a thick-line silhouette skeleton.
    """

    concept: str = dspy.InputField(desc="The thing to draw, e.g. 'a fox'")
    strokes_json: str = dspy.OutputField(
        desc='JSON object: {"strokes": [[[x,y],...], ...]} in 0..1 unit space'
    )


def _parse_strokes_json(raw: str) -> list[list[list[float]]]:
    """Extract the strokes array from possibly-messy LLM text."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip().startswith("```") else lines[1:])
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}") + 1
        if start < 0 or end <= start:
            raise LLMUnavailableError(f"unparseable LLM drawing: {text[:120]!r}")
        data = json.loads(text[start:end])
    strokes = data.get("strokes", data) if isinstance(data, dict) else data
    if not isinstance(strokes, list):
        raise LLMUnavailableError("LLM drawing JSON has no strokes array")
    return strokes


def concept_strokeset(concept: str) -> StrokeSet:
    """Ask the LLM to draw ``concept`` as single-stroke line art.

    Raises ``LLMUnavailableError`` when no LM is configured or the answer
    contains no usable geometry — callers fall back to templates.
    """
    if _active_lm() is None:
        raise LLMUnavailableError(
            "no LLM configured (set NVIDIA_NIM_API_KEY or GLM_API_KEY) — "
            f"cannot draw novel concept {concept!r}"
        )

    prediction = dspy.Predict(DrawSingleStrokeConcept)(concept=concept)
    raw_strokes = _parse_strokes_json(prediction.strokes_json)

    strokes: list[Stroke] = []
    for raw in raw_strokes:
        points: list[list[float]] = []
        for p in raw if isinstance(raw, list) else []:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                # Clamp into unit space — the model is *asked* for 0..1 but
                # we enforce it; one stray 14.42 must not warp the canvas.
                x = min(max(float(p[0]), 0.0), 1.0)
                y = min(max(float(p[1]), 0.0), 1.0)
                points.append([x, y])
        if len(points) >= 2:
            strokes.append(Stroke(points=points, kind="shape"))

    if not strokes:
        raise LLMUnavailableError(f"LLM produced no usable strokes for {concept!r}")
    return StrokeSet(strokes=normalize_unit(strokes))
