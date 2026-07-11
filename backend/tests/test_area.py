"""Global area selection: bbox sizing and street-density gating."""

import pytest

from models.schemas import Coordinate
from services import area as area_mod
from services.area import (
    MIN_ROUTABLE_WAYS,
    area_from_center,
    bbox_from_center,
    check_density,
)


def test_bbox_is_centered_on_pin():
    center = Coordinate(lng=-122.4194, lat=37.7749)  # San Francisco
    bbox = bbox_from_center(center, target_distance_km=5.0)
    assert bbox.center().lng == pytest.approx(center.lng, abs=1e-9)
    assert bbox.center().lat == pytest.approx(center.lat, abs=1e-9)
    assert bbox.min_lng < center.lng < bbox.max_lng
    assert bbox.min_lat < center.lat < bbox.max_lat


def test_bbox_grows_with_distance():
    center = Coordinate(lng=13.405, lat=52.52)  # Berlin
    small = bbox_from_center(center, 3.0)
    large = bbox_from_center(center, 20.0)
    assert large.width_deg() > small.width_deg()
    assert large.height_deg() > small.height_deg()


def test_bbox_respects_min_span():
    """A tiny target still yields a usable (non-degenerate) box."""
    center = Coordinate(lng=0.0, lat=0.0)
    bbox = bbox_from_center(center, 1.0)
    # MIN_SPAN_KM=1.0 → ~1/111 deg of latitude
    assert bbox.height_deg() == pytest.approx(1.0 / 111.0, rel=0.01)


def test_area_from_center_defaults_name():
    center = Coordinate(lng=13.405, lat=52.52)
    assert area_from_center(center, 5.0).name == "Selected area"
    assert area_from_center(center, 5.0, "Berlin Mitte").name == "Berlin Mitte"


@pytest.mark.asyncio
async def test_density_rejects_sparse(monkeypatch):
    async def fake_count(_bbox):
        return MIN_ROUTABLE_WAYS - 1

    monkeypatch.setattr(area_mod, "count_routable_ways", fake_count)
    result = await check_density(bbox_from_center(Coordinate(lng=0, lat=0), 5.0))
    assert result.ok is False
    assert "sparse" in result.message.lower()


@pytest.mark.asyncio
async def test_density_accepts_dense(monkeypatch):
    async def fake_count(_bbox):
        return 500

    monkeypatch.setattr(area_mod, "count_routable_ways", fake_count)
    result = await check_density(bbox_from_center(Coordinate(lng=0, lat=0), 5.0))
    assert result.ok is True
    assert result.way_count == 500


@pytest.mark.asyncio
async def test_density_fails_open_when_overpass_down(monkeypatch):
    async def fake_count(_bbox):
        return None

    monkeypatch.setattr(area_mod, "count_routable_ways", fake_count)
    result = await check_density(bbox_from_center(Coordinate(lng=0, lat=0), 5.0))
    assert result.ok is True  # never block a user on a flaky third party
