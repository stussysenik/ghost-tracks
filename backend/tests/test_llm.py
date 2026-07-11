"""LLM path coverage: a hermetic mocked-LLM test plus one live integration
round-trip (text→shape + vision judge) that runs only when CEREBRAS_API_KEY
is present (skipped in CI)."""

import types
from pathlib import Path

import pytest

from models.schemas import Coordinate
from services.llm import (
    DescriptionToShape,
    coords_from_raw,
    parse_shape_json,
)
from services.shape_generator import ShapeGenerator
from services.shape_validator import ShapeValidator


def _live_cerebras_key() -> str | None:
    """Read CEREBRAS_API_KEY from the project-root .env.local. conftest blanks
    the env var for hermeticity, so live tests source the real key here."""
    env_local = Path(__file__).resolve().parents[2] / ".env.local"
    if env_local.exists():
        for line in env_local.read_text().splitlines():
            if line.strip().startswith("CEREBRAS_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'") or None
    return None


_LIVE_KEY = _live_cerebras_key()

_FAKE_IDEAS_JSON = (
    '[{"name": "Heart", "emoji": "❤️", "description": "a heart",'
    ' "difficulty": "easy",'
    ' "control_points": [[14.42, 50.07], [14.43, 50.07], [14.43, 50.08],'
    ' [14.42, 50.08], [14.42, 50.07]]}]'
)


@pytest.mark.asyncio
async def test_generate_with_mocked_llm():
    """The DSPy generate path parses LLM JSON into mapped ShapeIdeas — exercised
    with a fake predictor so no network/key is required."""
    gen = ShapeGenerator()

    def fake_predict(**_kwargs):
        return types.SimpleNamespace(ideas_json=_FAKE_IDEAS_JSON)

    gen._generate_ideas = fake_predict  # inject a mocked LM predictor

    hood = gen.neighborhood_service.get_by_name("Vinohrady")
    ideas = await gen._generate_with_llm(hood, count=1)

    assert len(ideas) == 1
    assert ideas[0].name == "Heart"
    assert ideas[0].target_area == "Vinohrady"
    assert len(ideas[0].control_points) >= 3


# --- Live integration (real Cerebras round-trip) --------------------------

requires_live = pytest.mark.skipif(
    not _LIVE_KEY,
    reason="requires CEREBRAS_API_KEY in .env.local (live Cerebras round-trip)",
)


@requires_live
@pytest.mark.asyncio
async def test_cerebras_text_to_shape_roundtrip(monkeypatch):
    """text→shape: Gemma 4 31B returns parseable control points."""
    import dspy

    from services.llm import configure_llm

    monkeypatch.setenv("CEREBRAS_API_KEY", _LIVE_KEY)
    assert configure_llm() is not None
    pred = dspy.Predict(DescriptionToShape)
    result = pred(
        description="a simple triangle",
        target_bbox="14.40,50.05,14.46,50.09",
    )
    data = parse_shape_json(result.shape_json)
    points = coords_from_raw(data.get("control_points", []))
    assert len(points) >= 3


@requires_live
@pytest.mark.asyncio
async def test_cerebras_vision_judge_roundtrip(monkeypatch):
    """judge: the Gemma vision path scores a routed shape and labels its method."""
    monkeypatch.setenv("CEREBRAS_API_KEY", _LIVE_KEY)
    triangle = [
        Coordinate(lng=14.42, lat=50.06),
        Coordinate(lng=14.44, lat=50.06),
        Coordinate(lng=14.43, lat=50.08),
        Coordinate(lng=14.42, lat=50.06),
    ]
    validator = ShapeValidator()
    result = await validator._validate_with_vision(
        "a triangle", triangle, triangle, threshold=45
    )
    assert result.method == "gemma-4-31b"
    assert 0 <= result.score <= 100
