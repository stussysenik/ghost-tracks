"""End-to-end API tests for /art/compose and /art/solve.

No network, no LLM: LLM availability is patched off (the deterministic
fallbacks are the contract) and the Scala kernel is replaced by an echo
double that returns the trace it was given — which by definition scores a
near-perfect fidelity, isolating the pipeline plumbing from routing quality.
"""

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

GOLDEN = (
    "for valentine's day — write 'ANNA + TOM' and a heart, "
    "near Vinohrady, about 8 km, end where we start."
)


@pytest.fixture
def no_llm(monkeypatch):
    """Force every LLM-touching seam into its deterministic fallback."""
    monkeypatch.setattr("services.intent_parser._active_lm", lambda: None)
    monkeypatch.setattr("frontends.llm_path._active_lm", lambda: None)


@pytest.fixture
def echo_kernel(monkeypatch):
    """Kernel double: solves by returning the requested trace verbatim."""
    calls: list[dict] = []

    def fake_call(payload: dict) -> dict:
        calls.append(payload)
        return {
            "coordinates": payload["trace"],
            "segments": payload["segments"],
            "distance_km": 8.2,
            "duration_minutes": 55,
            "success": True,
            "error": None,
        }

    monkeypatch.setattr("routers.art._call_kernel", fake_call)
    return calls


def test_compose_golden_prompt_without_llm(no_llm):
    response = client.post("/art/compose", json={"prompt": GOLDEN})
    assert response.status_code == 200
    body = response.json()

    assert body["intent"]["texts"] == ["ANNA + TOM"]
    assert [s["name"] for s in body["intent"]["shapes"]] == ["heart"]
    assert body["intent"]["area"] == "Vinohrady"
    assert body["intent"]["distance_km"] == 8.0

    plan = body["plan"]
    assert plan["continuous"], "compose must yield a continuous polyline"
    assert plan["segments"], "segments index map is required by the kernel"
    # ONE continuous line: consecutive segments share their joint index.
    for a, b in zip(plan["segments"], plan["segments"][1:]):
        assert a["end_idx"] == b["start_idx"]
    assert plan["segments"][-1]["end_idx"] == len(plan["continuous"]) - 1
    # Both frontends contributed: glyph ink and shape ink.
    kinds = {s["kind"] for s in plan["strokes"]}
    assert "glyph" in kinds and "shape" in kinds

    assert body["preview_svg"].startswith("<svg")
    assert "polyline" in body["preview_svg"]
    assert isinstance(body["diagnostics"], list)

    # Placement defaults onto Vinohrady (lng ≈ 14.44, lat ≈ 50.07).
    bbox = body["placement"]["bbox"]
    assert 14.3 < bbox["min_lng"] < bbox["max_lng"] < 14.6
    assert 49.9 < bbox["min_lat"] < bbox["max_lat"] < 50.2
    assert body["placement"]["rotation_deg"] == 0


def test_compose_unknown_shape_falls_back_to_template(no_llm):
    response = client.post(
        "/art/compose", json={"prompt": "draw a fox near Vinohrady, 6 km"}
    )
    assert response.status_code == 200
    body = response.json()
    assert [s["name"] for s in body["intent"]["shapes"]] == ["fox"]
    # LLM is off → the fox degrades to a template, but the pipeline holds.
    assert body["plan"]["continuous"]
    assert body["preview_svg"].startswith("<svg")


def test_compose_request_overrides(no_llm):
    response = client.post(
        "/art/compose",
        json={"prompt": "a heart", "area": "Karlin", "distance_km": 12.0},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["intent"]["area"] == "Karlin"
    assert body["intent"]["distance_km"] == 12.0


def test_solve_returns_art_route_with_fidelity(no_llm, echo_kernel):
    composed = client.post("/art/compose", json={"prompt": GOLDEN}).json()

    response = client.post(
        "/art/solve",
        json={
            "plan": composed["plan"],
            "placement": composed["placement"],
            "opts": {"close_loop": True, "profile": "foot"},
            "intent": composed["intent"],
        },
    )
    assert response.status_code == 200
    route = response.json()

    solve = route["solve"]
    assert solve["success"] is True
    assert solve["error"] is None
    assert solve["coordinates"], "solved route must have coordinates"
    assert solve["fidelity"] > 90  # echo kernel ⇒ near-perfect fidelity
    assert solve["distance_km"] == 8.2
    assert solve["duration_min"] == 55
    assert solve["segments"], "per-segment provenance must survive the kernel"

    # The gateway owns export/share — the brain leaves them unset.
    assert route["gpx_url"] is None and route["share_id"] is None
    assert route["intent"]["texts"] == ["ANNA + TOM"]

    # The kernel got the camelCase wire format with segment provenance.
    payload = echo_kernel[0]
    assert payload["closeLoop"] is True
    assert payload["profile"] == "foot"
    assert {"kind", "retrace", "startIdx", "endIdx"} <= set(payload["segments"][0])
    # Trace was densified to ~80 m: enough vertices for map matching.
    assert len(payload["trace"]) >= len(composed["plan"]["continuous"])


def test_solve_kernel_unreachable_is_actionable(no_llm, monkeypatch):
    def boom(payload):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr("routers.art._call_kernel", boom)
    composed = client.post("/art/compose", json={"prompt": GOLDEN}).json()

    response = client.post(
        "/art/solve",
        json={"plan": composed["plan"], "placement": composed["placement"]},
    )
    assert response.status_code == 200  # failure is data, not a 5xx
    route = response.json()
    assert route["solve"]["success"] is False
    assert "kernel" in route["solve"]["error"].lower()
    assert "KERNEL_URL" in route["solve"]["error"]
    assert route["solve"]["fidelity"] == 0


def test_solve_empty_plan_fails_gracefully(no_llm):
    response = client.post(
        "/art/solve",
        json={
            "plan": {"strokes": [], "order": [], "continuous": [], "segments": []},
            "placement": {
                "bbox": {
                    "min_lng": 14.4, "min_lat": 50.0, "max_lng": 14.5, "max_lat": 50.1,
                },
                "anchor": {"lng": 14.45, "lat": 50.05},
            },
        },
    )
    assert response.status_code == 200
    assert response.json()["solve"]["success"] is False
