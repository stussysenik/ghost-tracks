"""Global area selection: size a bbox from a dropped pin and target route
length, and sanity-check that the area has enough streets to trace a route."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional

import httpx

from models.schemas import Area, BoundingBox, Coordinate

# A compact art route of length L km spans a region roughly L * SPAN_FACTOR km
# across (a wiggly single stroke folds into a fraction of its own length).
SPAN_FACTOR = 0.35
MIN_SPAN_KM = 1.0
KM_PER_DEG_LAT = 111.0

# Tried in order; the public instances rate-limit, so a mirror fallback keeps
# the check from failing open on a single flaky endpoint.
OVERPASS_URLS = (
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
)
# Overpass rejects the default python-httpx User-Agent with 406.
_OVERPASS_HEADERS = {"User-Agent": "ghost-tracks/1.0 (route street-density check)"}
# Below this many routable ways the area can't hold a recognizable route.
MIN_ROUTABLE_WAYS = 20
_WALKABLE_HIGHWAYS = (
    "residential|living_street|unclassified|tertiary|secondary|primary|"
    "pedestrian|footway|path|cycleway|service|track|road"
)


def bbox_from_center(center: Coordinate, target_distance_km: float) -> BoundingBox:
    """Size a square bbox around a pin from the target route length."""
    span_km = max(target_distance_km * SPAN_FACTOR, MIN_SPAN_KM)
    half_lat_deg = (span_km / 2) / KM_PER_DEG_LAT
    cos_lat = max(math.cos(math.radians(center.lat)), 0.01)
    half_lng_deg = (span_km / 2) / (KM_PER_DEG_LAT * cos_lat)
    return BoundingBox(
        min_lng=center.lng - half_lng_deg,
        min_lat=center.lat - half_lat_deg,
        max_lng=center.lng + half_lng_deg,
        max_lat=center.lat + half_lat_deg,
    )


def area_from_center(
    center: Coordinate, target_distance_km: float, name: Optional[str] = None
) -> Area:
    return Area(
        name=name or "Selected area",
        center=center,
        bbox=bbox_from_center(center, target_distance_km),
        street_layout="mixed",
    )


async def count_routable_ways(bbox: BoundingBox) -> Optional[int]:
    """Count walkable/routable OSM ways in the bbox via Overpass. Returns None
    if Overpass is unavailable (caller decides how to treat that)."""
    query = (
        "[out:json][timeout:20];"
        f'(way["highway"~"^({_WALKABLE_HIGHWAYS})$"]'
        f"({bbox.min_lat},{bbox.min_lng},{bbox.max_lat},{bbox.max_lng}););"
        "out count;"
    )
    async with httpx.AsyncClient(timeout=25.0) as client:
        for url in OVERPASS_URLS:
            try:
                resp = await client.post(
                    url, data={"data": query}, headers=_OVERPASS_HEADERS
                )
                resp.raise_for_status()
                elements = resp.json().get("elements", [])
                if elements:
                    tags = elements[0].get("tags", {})
                    return int(tags.get("ways") or tags.get("total") or 0)
            except Exception as exc:  # network/rate-limit/parse — try next mirror
                print(f"Overpass density check failed ({url}): {exc}")
    return None  # all mirrors failed — caller fails open


@dataclass
class DensityResult:
    ok: bool
    way_count: Optional[int]
    message: str


async def check_density(bbox: BoundingBox) -> DensityResult:
    """Sanity-check an area's street density. Fails open (ok=True) when Overpass
    can't be reached — a flaky third party must not block a paying user."""
    count = await count_routable_ways(bbox)
    if count is None:
        return DensityResult(True, None, "Could not verify street density; proceeding anyway.")
    if count < MIN_ROUTABLE_WAYS:
        return DensityResult(
            False,
            count,
            "This area is too sparse to trace a route — try a denser, "
            "more built-up location.",
        )
    return DensityResult(True, count, "This area has plenty of streets to work with.")
