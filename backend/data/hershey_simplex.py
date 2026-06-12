"""Single-stroke skeleton glyphs for street-writable text.

DESIGN LESSON — why this font looks the way it does
===================================================
GPS art letters must be drawn by a runner as ONE continuous track, so each
glyph is a *skeleton* (centerline), not an outline. This data follows the
practitioner craft rules encoded in the spec (§2):

- **1×2 proportion blocks**: every glyph lives in a 1-wide × 2-tall box
  (city blocks are the pixels of this medium).
- **45° diagonals instead of curves**: streets are straight segments
  (medium law #4), so curves are pre-faked with octagonal corners — they
  survive street-snapping instead of being mangled by it.
- **Minimal strokes per char**: every extra stroke costs connector ink
  (medium law #1). Where a letter needs a crossbar (A, E, H, +) the stroke
  *retraces* itself — retraced GPS segments visually disappear, so this is
  free, unlike a connector.
- **Disambiguated forms**: pointed A with crossbar, R with a straight
  diagonal leg, S built from two stacked open boxes — the forms that stay
  legible after blocky street quantization.

The layout is Hershey-Simplex-inspired (the pen-plotter lineage the spec
names) but hand-designed on a half-unit grid so every coordinate is exact.

FORMAT
======
``GLYPHS[char]`` is a list of strokes; each stroke is a list of ``(x, y)``
tuples in glyph-local coordinates with x ∈ [0, 1], y ∈ [0, 2], **y up**.
Space maps to an empty stroke list (it is pure advance).
"""

from __future__ import annotations

GLYPH_HEIGHT = 2.0  # the "2" of the 1×2 block proportion

GLYPHS: dict[str, list[list[tuple[float, float]]]] = {
    # --- Letters -----------------------------------------------------------
    # A: pointed apex; crossbar drawn via retrace down the right leg.
    "A": [[(0, 0), (0.5, 2), (0.75, 1), (0.25, 1), (0.75, 1), (1, 0)]],
    # B: two bowls, one stroke; (0,1)→(0.7,1) retraces the mid-bar.
    "B": [[(0, 0), (0, 2), (0.7, 2), (1, 1.75), (1, 1.25), (0.7, 1), (0, 1),
           (0.7, 1), (1, 0.75), (1, 0.25), (0.7, 0), (0, 0)]],
    "C": [[(1, 1.75), (0.7, 2), (0.3, 2), (0, 1.7), (0, 0.3), (0.3, 0),
           (0.7, 0), (1, 0.25)]],
    "D": [[(0, 0), (0, 2), (0.6, 2), (1, 1.6), (1, 0.4), (0.6, 0), (0, 0)]],
    # E/F: middle arm drawn out-and-back (retrace).
    "E": [[(1, 2), (0, 2), (0, 1), (0.8, 1), (0, 1), (0, 0), (1, 0)]],
    "F": [[(1, 2), (0, 2), (0, 1), (0.8, 1), (0, 1), (0, 0)]],
    "G": [[(1, 1.75), (0.7, 2), (0.3, 2), (0, 1.7), (0, 0.3), (0.3, 0),
           (0.7, 0), (1, 0.3), (1, 1), (0.5, 1)]],
    # H: down, back up to the waist (retrace), across, up-and-down the right.
    "H": [[(0, 2), (0, 0), (0, 1), (1, 1), (1, 2), (1, 0)]],
    # I: serifed so it is not confused with 1 or a stray connector.
    "I": [[(0, 2), (1, 2), (0.5, 2), (0.5, 0), (0, 0), (1, 0)]],
    "J": [[(0.5, 2), (1, 2), (1, 0.3), (0.7, 0), (0.3, 0), (0, 0.3)]],
    "K": [[(0, 2), (0, 0), (0, 1), (1, 2), (0, 1), (1, 0)]],
    "L": [[(0, 2), (0, 0), (1, 0)]],
    "M": [[(0, 0), (0, 2), (0.5, 1), (1, 2), (1, 0)]],
    "N": [[(0, 0), (0, 2), (1, 0), (1, 2)]],
    # O: octagon — a circle that survives piecewise-linear streets.
    "O": [[(0.3, 2), (0.7, 2), (1, 1.7), (1, 0.3), (0.7, 0), (0.3, 0),
           (0, 0.3), (0, 1.7), (0.3, 2)]],
    "P": [[(0, 0), (0, 2), (0.7, 2), (1, 1.75), (1, 1.25), (0.7, 1), (0, 1)]],
    # Q: octagon ring + a separate crossing tail.
    "Q": [[(0.3, 2), (0.7, 2), (1, 1.7), (1, 0.3), (0.7, 0), (0.3, 0),
           (0, 0.3), (0, 1.7), (0.3, 2)],
          [(0.6, 0.6), (1, 0)]],
    # R: disambiguated — bowl, retrace along the mid-bar, straight leg.
    "R": [[(0, 0), (0, 2), (0.7, 2), (1, 1.75), (1, 1.25), (0.7, 1), (0, 1),
           (0.4, 1), (1, 0)]],
    # S: two stacked open boxes with 45° corners — the legible blocky S.
    "S": [[(1, 1.7), (0.7, 2), (0.3, 2), (0, 1.7), (0, 1.3), (0.3, 1),
           (0.7, 1), (1, 0.7), (1, 0.3), (0.7, 0), (0.3, 0), (0, 0.3)]],
    "T": [[(0, 2), (1, 2), (0.5, 2), (0.5, 0)]],
    "U": [[(0, 2), (0, 0.3), (0.3, 0), (0.7, 0), (1, 0.3), (1, 2)]],
    "V": [[(0, 2), (0.5, 0), (1, 2)]],
    "W": [[(0, 2), (0.25, 0), (0.5, 1), (0.75, 0), (1, 2)]],
    # X: two strokes — the baseline connector between them is the craft norm.
    "X": [[(0, 2), (1, 0)], [(0, 0), (1, 2)]],
    "Y": [[(0, 2), (0.5, 1), (1, 2), (0.5, 1), (0.5, 0)]],
    "Z": [[(0, 2), (1, 2), (0, 0), (1, 0)]],
    # --- Digits ------------------------------------------------------------
    # 0: octagon + slash so it cannot be read as O.
    "0": [[(0.3, 2), (0.7, 2), (1, 1.7), (1, 0.3), (0.7, 0), (0.3, 0),
           (0, 0.3), (0, 1.7), (0.3, 2)],
          [(0.3, 0.5), (0.7, 1.5)]],
    "1": [[(0.25, 1.5), (0.5, 2), (0.5, 0), (0.25, 0), (0.75, 0)]],
    "2": [[(0, 1.7), (0.3, 2), (0.7, 2), (1, 1.7), (1, 1.3), (0, 0), (1, 0)]],
    "3": [[(0, 1.7), (0.3, 2), (0.7, 2), (1, 1.7), (1, 1.3), (0.7, 1),
           (0.4, 1), (0.7, 1), (1, 0.7), (1, 0.3), (0.7, 0), (0.3, 0),
           (0, 0.3)]],
    "4": [[(0.75, 0), (0.75, 2), (0, 0.5), (1, 0.5)]],
    "5": [[(1, 2), (0, 2), (0, 1), (0.7, 1), (1, 0.7), (1, 0.3), (0.7, 0),
           (0.3, 0), (0, 0.3)]],
    "6": [[(1, 1.7), (0.7, 2), (0.3, 2), (0, 1.7), (0, 0.3), (0.3, 0),
           (0.7, 0), (1, 0.3), (1, 0.7), (0.7, 1), (0.3, 1), (0, 0.7)]],
    "7": [[(0, 2), (1, 2), (0.3, 0)]],
    # 8: a single figure-eight stroke (crosses itself at the waist).
    "8": [[(0.5, 1), (0.2, 1.3), (0.2, 1.7), (0.5, 2), (0.8, 1.7), (0.8, 1.3),
           (0.5, 1), (0.2, 0.7), (0.2, 0.3), (0.5, 0), (0.8, 0.3), (0.8, 0.7),
           (0.5, 1)]],
    "9": [[(0, 0.3), (0.3, 0), (0.7, 0), (1, 0.3), (1, 1.7), (0.7, 2),
           (0.3, 2), (0, 1.7), (0, 1.3), (0.3, 1), (0.7, 1), (1, 1.3)]],
    # --- Punctuation -------------------------------------------------------
    # +: vertical drawn with an out-and-back excursion along the horizontal.
    "+": [[(0.5, 1.5), (0.5, 1), (0.1, 1), (0.9, 1), (0.5, 1), (0.5, 0.5)]],
    # &: crossing-diagonal skeleton ampersand, single stroke.
    "&": [[(1, 0), (0.15, 1.1), (0.15, 1.7), (0.5, 2), (0.85, 1.7),
           (0.85, 1.4), (0, 0.6), (0, 0.25), (0.3, 0), (0.7, 0), (1, 0.6)]],
    "-": [[(0.1, 1), (0.9, 1)]],
    # .: a tiny closed square — at small physical scale the Normalizer will
    # (correctly) drop it as sub-GPS-jitter detail and say so.
    ".": [[(0.4, 0), (0.6, 0), (0.6, 0.2), (0.4, 0.2), (0.4, 0)]],
    "!": [[(0.5, 2), (0.5, 0.6)], [(0.5, 0.2), (0.5, 0)]],
    "?": [[(0, 1.7), (0.3, 2), (0.7, 2), (1, 1.7), (1, 1.3), (0.5, 0.9),
           (0.5, 0.6)],
          [(0.5, 0.2), (0.5, 0)]],
    " ": [],  # pure advance — handled by the layout engine
}
