"""Tests for the deterministic intent-parser fallback (no LLM, no network)."""

from services.intent_parser import parse, parse_fallback

GOLDEN = (
    "for valentine's day — write 'ANNA + TOM' and a heart, "
    "near Vinohrady, about 8 km, end where we start."
)


def test_golden_valentine_prompt():
    """The spec §3 canonical scenario must parse without any LLM."""
    intent = parse_fallback(GOLDEN)
    assert intent.texts == ["ANNA + TOM"]
    assert [s.name for s in intent.shapes] == ["heart"]
    assert intent.area == "Vinohrady"
    assert intent.distance_km == 8.0
    assert intent.loop is True
    assert intent.occasion == "valentines"


def test_parse_without_llm_uses_fallback():
    intent = parse(GOLDEN, use_llm=False)
    assert intent.texts == ["ANNA + TOM"]
    assert intent.area == "Vinohrady"


def test_apostrophe_is_not_a_quote():
    """The possessive in \"valentine's\" must not open a quoted span."""
    intent = parse_fallback("valentine's day run, draw a star")
    assert intent.texts == []
    assert [s.name for s in intent.shapes] == ["star"]


def test_double_quotes_and_curly_quotes():
    assert parse_fallback('write "MARRY ME" please').texts == ["MARRY ME"]
    assert parse_fallback("write ‘LOU + SAM’ somewhere").texts == ["LOU + SAM"]


def test_one_way_disables_loop():
    intent = parse_fallback("a 5 km one way star route in Karlin")
    assert intent.loop is False
    assert intent.distance_km == 5.0
    assert intent.area == "Karlin"
    assert [s.name for s in intent.shapes] == ["star"]


def test_decimal_distance_with_comma():
    assert parse_fallback("about 7,5 km please").distance_km == 7.5


def test_novel_concept_word_recognized():
    intent = parse_fallback("draw a fox near Letna, 10 km")
    assert [s.name for s in intent.shapes] == ["fox"]
    assert intent.distance_km == 10.0


def test_defaults_when_nothing_matches():
    intent = parse_fallback("surprise me")
    assert intent.texts == []
    assert intent.shapes == []
    assert intent.area is None
    assert intent.distance_km is None
    assert intent.loop is True
