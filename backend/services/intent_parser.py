"""Intent parser: natural language → Intent (texts, shapes, area, distance).

LESSON — LLM with a deterministic safety net
============================================
The describe→route product hinges on understanding free text, but the LLM
is an *optional* dependency everywhere in this codebase. So parsing is
layered:

  1. If a DSPy LM is configured, ask it for structured JSON (high recall on
     phrasing we never anticipated).
  2. On ANY failure — no key, network down, malformed JSON — fall back to a
     deterministic regex/keyword extractor that nails the golden prompts.

The fallback is not an afterthought: it is unit-tested against the golden
Valentine's scenario and runs in CI with zero network access.
"""

from __future__ import annotations

import json
import re

import dspy

from frontends.templates import KNOWN_SHAPES
from models.ir import Intent, ShapeRef


def _active_lm():
    """The configured DSPy LM or None — patchable seam for tests."""
    return getattr(dspy.settings, "lm", None)


class ExtractIntent(dspy.Signature):
    """Extract GPS-art route intent from a user's request.

    Output STRICT JSON with keys:
    - texts: array of strings the user wants WRITTEN VERBATIM (quoted names
      or messages; preserve their exact characters and case)
    - shapes: array of shape names to draw (e.g. "heart", "star", "fox")
    - occasion: short lowercase tag like "valentines", "birthday",
      "proposal", or null
    - area: neighborhood/place name mentioned, or null
    - distance_km: number, or null
    - loop: true if the route should end where it starts (default true)
    """

    prompt: str = dspy.InputField(desc="The user's natural-language request")
    intent_json: str = dspy.OutputField(desc="JSON object with the keys above")


# --------------------------------------------------------------------------
# Deterministic fallback
# --------------------------------------------------------------------------

# Straight + curly quotes; texts to write are whatever the user quoted.
# A straight apostrophe only OPENS a quote when not preceded by a word char
# and only CLOSES one when not followed by a word char — so the possessive
# in "valentine's day" never pairs with the opening quote of 'ANNA + TOM'.
_QUOTED_RE = re.compile(
    r"(?<!\w)'([^']{1,60})'(?!\w)"  # 'single quoted'
    r"|\"([^\"]{1,60})\""  # "double quoted"
    r"|‘([^‘’]{1,60})’"  # ‘curly single’
    r"|“([^“”]{1,60})”"  # “curly double”
)


def _quoted_texts(prompt: str) -> list[str]:
    """All quoted spans, whichever quote style matched."""
    texts: list[str] = []
    for match in _QUOTED_RE.finditer(prompt):
        content = next(g for g in match.groups() if g is not None)
        if content.strip():
            texts.append(content.strip())
    return texts



_DISTANCE_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:km|kilometers?|kilometres?)\b", re.I)
# A place name after a locational preposition: one or more Capitalized words.
_AREA_RE = re.compile(
    r"\b(?:near|in|around|at|through)\s+"
    r"([A-ZÀ-Ž][\wÀ-ž'-]*(?:\s+[A-ZÀ-Ž][\wÀ-ž'-]*)*)"
)

_OCCASIONS = {
    "valentine": "valentines",
    "propos": "proposal",
    "birthday": "birthday",
    "anniversar": "anniversary",
    "christmas": "christmas",
    "wedding": "wedding",
    "graduat": "graduation",
}

_LOOP_YES = ("end where we start", "back to start", "round trip", "loop",
             "end at the start", "finish where")
_LOOP_NO = ("one way", "one-way", "point to point", "point-to-point")

# Extra shape words the fallback recognizes beyond the parametric templates;
# unknown names route to the LLM-path frontend (template fallback at compose).
_EXTRA_SHAPE_WORDS = ("fox", "cat", "dog", "bird", "fish", "flower", "tree",
                      "ring", "diamond", "smiley", "moon", "sun")


def parse_fallback(prompt: str) -> Intent:
    """Deterministic extraction — no LLM, no network, fully unit-testable."""
    texts = _quoted_texts(prompt)
    # Scan for shapes/area outside the quoted texts so a name like
    # 'ANNA + TOM' is never mistaken for a shape or a place.
    scannable = _QUOTED_RE.sub(" ", prompt)
    lowered = scannable.lower()

    shapes: list[ShapeRef] = []
    seen: set[str] = set()
    for name in (*KNOWN_SHAPES, *_EXTRA_SHAPE_WORDS):
        if re.search(rf"\b{name}s?\b", lowered) and name not in seen:
            shapes.append(ShapeRef(name=name))
            seen.add(name)

    occasion = None
    for stem, tag in _OCCASIONS.items():
        if stem in lowered:
            occasion = tag
            break

    area_match = _AREA_RE.search(scannable)
    area = area_match.group(1).strip() if area_match else None

    dist_match = _DISTANCE_RE.search(scannable)
    distance_km = float(dist_match.group(1).replace(",", ".")) if dist_match else None

    loop = True
    if any(phrase in lowered for phrase in _LOOP_NO):
        loop = False
    elif any(phrase in lowered for phrase in _LOOP_YES):
        loop = True

    return Intent(
        texts=texts,
        shapes=shapes,
        occasion=occasion,
        area=area,
        distance_km=distance_km,
        loop=loop,
    )


# --------------------------------------------------------------------------
# LLM extraction with fallback
# --------------------------------------------------------------------------

def _parse_with_llm(prompt: str) -> Intent:
    prediction = dspy.Predict(ExtractIntent)(prompt=prompt)
    text = prediction.intent_json.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip().startswith("```") else lines[1:])
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}") + 1
        data = json.loads(text[start:end])

    shapes = data.get("shapes") or []
    return Intent(
        texts=[str(t) for t in (data.get("texts") or [])],
        shapes=[ShapeRef(name=str(s)) for s in shapes],
        occasion=data.get("occasion") or None,
        area=data.get("area") or None,
        distance_km=float(data["distance_km"]) if data.get("distance_km") else None,
        loop=bool(data.get("loop", True)),
    )


def parse(prompt: str, use_llm: bool = True) -> Intent:
    """Parse a natural-language request into an Intent.

    Tries the LLM when one is configured; any failure degrades silently to
    the deterministic fallback — the product must work without a model.
    """
    if use_llm and _active_lm() is not None:
        try:
            return _parse_with_llm(prompt)
        except Exception:
            pass  # the fallback is the contract; the LLM is an enhancement
    return parse_fallback(prompt)
