"""Glyph frontend: text → StrokeSet of single-stroke skeleton letters.

LESSON — typesetting for streets
================================
This is a miniature font engine. Glyph *shapes* live in
``data/hershey_simplex.py`` (1×2 block proportion, y up); this module only
does *layout*: advancing a cursor, inserting letter/word gaps, and
normalizing the finished line into the unit canvas.

Spacing follows the practitioner craft rules: a letter is one block wide,
gaps are **1 block between letters, 2 between words** — wide by typographic
standards, but on a street grid each gap must survive as recognizable
whitespace after GPS jitter and block quantization.
"""

from __future__ import annotations

from data.hershey_simplex import GLYPH_HEIGHT, GLYPHS
from frontends.canvas import normalize_unit
from models.ir import Stroke, StrokeSet

LETTER_GAP = 1.0  # blocks between letters
WORD_GAP = 2.0  # blocks between words (a space contributes the extra block)
_DEFAULT_ADVANCE = 1.0  # width of a glyph cell (the "1" of 1×2)


def _glyph_width(char: str) -> float:
    """A glyph's advance width: its rightmost coordinate (min one cell)."""
    strokes = GLYPHS.get(char, [])
    xs = [x for stroke in strokes for x, _ in stroke]
    return max(xs) if xs else _DEFAULT_ADVANCE


def layout_text(text: str, normalize: bool = True) -> StrokeSet:
    """Typeset ``text`` as single-stroke glyphs.

    Unknown characters are skipped (the medium cannot draw what it has no
    skeleton for — better to omit than to invent). With ``normalize=True``
    (the default, what the pipeline uses) the line is fitted into the unit
    canvas preserving aspect; ``normalize=False`` exposes raw block
    coordinates, which tests use to verify spacing exactly.
    """
    strokes: list[Stroke] = []
    cursor = 0.0
    for raw_ch in text.upper():
        if raw_ch == " ":
            # The previous letter already added LETTER_GAP; top it up.
            cursor += WORD_GAP - LETTER_GAP
            continue
        glyph = GLYPHS.get(raw_ch)
        if glyph is None:
            continue  # no skeleton for this char — skip, never crash
        for stroke_pts in glyph:
            if len(stroke_pts) < 2:
                continue
            strokes.append(
                Stroke(
                    points=[[cursor + x, y] for x, y in stroke_pts],
                    kind="glyph",
                )
            )
        cursor += _glyph_width(raw_ch) + LETTER_GAP

    if not strokes:
        return StrokeSet(strokes=[])
    if normalize:
        return StrokeSet(strokes=normalize_unit(strokes))
    return StrokeSet(strokes=strokes)


def glyph_height() -> float:
    """Glyph-local cap height (the "2" of the 1×2 block proportion)."""
    return GLYPH_HEIGHT
