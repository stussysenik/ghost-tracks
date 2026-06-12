"""Tests for the skeleton font data and the glyph layout engine."""

import string

from data.hershey_simplex import GLYPH_HEIGHT, GLYPHS
from frontends.glyphs import LETTER_GAP, WORD_GAP, layout_text

REQUIRED_CHARS = set(string.ascii_uppercase) | set(string.digits) | set("+&-.!? ")


def test_required_charset_is_vendored():
    missing = REQUIRED_CHARS - set(GLYPHS)
    assert not missing, f"glyph data missing chars: {sorted(missing)}"


def test_every_glyph_in_bounds_and_drawable():
    """Glyph-local coords obey the 1×2 block box; strokes are real polylines."""
    for char, strokes in GLYPHS.items():
        if char == " ":
            assert strokes == []
            continue
        assert strokes, f"{char!r} has no strokes"
        for stroke in strokes:
            assert len(stroke) >= 2, f"{char!r} has a degenerate stroke"
            for x, y in stroke:
                assert 0.0 <= x <= 1.0, f"{char!r} x={x} outside [0,1]"
                assert 0.0 <= y <= GLYPH_HEIGHT, f"{char!r} y={y} outside [0,2]"


def test_layout_letter_spacing_raw():
    """1 block gap between letters: B starts 1 glyph-width + 1 gap after A."""
    raw = layout_text("AB", normalize=False)
    a_xs = [p[0] for s in raw.strokes[:1] for p in s.points]
    # A is one stroke; B is the rest. B's leftmost x must be at cursor 2.0.
    b_xs = [p[0] for s in raw.strokes[1:] for p in s.points]
    assert max(a_xs) <= 1.0
    assert min(b_xs) == 2.0  # width 1 + LETTER_GAP 1


def test_layout_word_spacing_raw():
    """2 blocks between words: space contributes WORD_GAP - LETTER_GAP extra."""
    raw = layout_text("A A", normalize=False)
    second_a_xs = [p[0] for s in raw.strokes[1:] for p in s.points]
    assert min(second_a_xs) == 1.0 + WORD_GAP  # 1 (width) + 2 (word gap)
    assert WORD_GAP == LETTER_GAP + 1.0


def test_layout_is_unit_normalized():
    result = layout_text("HELLO WORLD")
    assert result.strokes
    for stroke in result.strokes:
        assert stroke.kind == "glyph"
        for x, y in stroke.points:
            assert -1e-9 <= x <= 1 + 1e-9
            assert -1e-9 <= y <= 1 + 1e-9


def test_golden_text_produces_strokes_for_every_non_space_char():
    text = "ANNA + TOM"
    result = layout_text(text)
    non_space = [c for c in text if c != " "]
    # Every char has >= 1 stroke; some (none here) have more.
    expected_min = sum(len(GLYPHS[c]) for c in non_space)
    assert len(result.strokes) == expected_min
    assert len(result.strokes) >= len(non_space)


def test_unknown_chars_are_skipped_not_fatal():
    result = layout_text("A~B")  # ~ has no skeleton
    assert len(result.strokes) == len(GLYPHS["A"]) + len(GLYPHS["B"])


def test_empty_and_space_only_text():
    assert layout_text("").strokes == []
    assert layout_text("   ").strokes == []
