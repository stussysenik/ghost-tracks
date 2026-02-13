"""Tests for the FastAPI endpoints."""

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["version"] == "2.0.0"


def test_generate_requires_neighborhood():
    response = client.post("/generate/", json={})
    assert response.status_code == 422  # Pydantic validation error


def test_generate_unknown_neighborhood():
    response = client.post("/generate/", json={"neighborhood": "NonExistent"})
    assert response.status_code == 400


def test_generate_valid_neighborhood():
    response = client.post("/generate/", json={"neighborhood": "Vinohrady", "count": 2})
    assert response.status_code == 200
    data = response.json()
    assert data["neighborhood"] == "Vinohrady"
    assert len(data["ideas"]) == 2
    for idea in data["ideas"]:
        assert idea["name"]
        assert len(idea["control_points"]) >= 3


def test_generate_default_count():
    response = client.post("/generate/", json={"neighborhood": "Karlín"})
    assert response.status_code == 200
    data = response.json()
    assert len(data["ideas"]) == 3


def test_describe_requires_description():
    response = client.post("/describe/", json={})
    assert response.status_code == 422


def test_describe_returns_route():
    """This test uses template fallback (no LLM needed)."""
    response = client.post("/describe/", json={"description": "a heart shape"})
    assert response.status_code == 200
    data = response.json()
    assert data["shape"]["name"]
    assert data["neighborhood"]
    assert data["similarity_score"] >= 0
    assert len(data["waypoints"]) > 0
    # Coordinates should be present (even if unrouted fallback)
    assert len(data["routed_coordinates"]) > 0


def test_generate_count_bounds():
    # Count too high
    response = client.post("/generate/", json={"neighborhood": "Vinohrady", "count": 10})
    assert response.status_code == 422

    # Count too low
    response = client.post("/generate/", json={"neighborhood": "Vinohrady", "count": 0})
    assert response.status_code == 422
