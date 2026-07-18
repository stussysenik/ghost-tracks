"""One-time recorder: route every fixture through live Mapbox, commit cassettes.

This is the ONLY online step in the harness. It mirrors the direct-Mapbox branch
of `ShapeGenerator._route_waypoints` (walking profile, chunk_size=25, skip the
overlap point) so the recorded geometry equals what production returns. Run once:

    python -m eval.record_baseline           # record all fixtures
    python -m eval.record_baseline --dry-run # print plan, no network

Cassettes land in `eval/fixtures/recorded/<id>.json` and are committed for
deterministic offline replay. Re-running overwrites them.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

from eval.fixtures import get_fixtures
from eval.scoreboard import RECORDED_DIR
from models.schemas import Coordinate
from services.street_mapper import StreetMapper, haversine_distance_m

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MAPBOX_CHUNK = 25


def _load_token() -> str:
    from dotenv import dotenv_values

    env = {**dotenv_values(REPO_ROOT / ".env.local")}
    token = env.get("MAPBOX_ACCESS_TOKEN") or env.get("VITE_MAPBOX_ACCESS_TOKEN")
    if not token:
        raise SystemExit(
            "No MAPBOX_ACCESS_TOKEN in .env.local — cannot record the live baseline."
        )
    return token


def route_via_mapbox(waypoints: list[Coordinate], token: str) -> dict:
    """Chunked Mapbox walking Directions, mirroring the production direct branch."""
    coords = [[w.lng, w.lat] for w in waypoints]
    all_coords: list[list[float]] = []
    total_dist = 0.0
    total_dur = 0.0

    for i in range(0, len(coords), MAPBOX_CHUNK - 1):
        chunk = coords[i : i + MAPBOX_CHUNK]
        if len(chunk) < 2:
            continue
        coords_str = ";".join(f"{c[0]},{c[1]}" for c in chunk)
        url = (
            f"https://api.mapbox.com/directions/v5/mapbox/walking/{coords_str}"
            f"?geometries=geojson&overview=full&steps=false&access_token={token}"
        )
        resp = httpx.get(url, timeout=30.0)
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            continue
        route = data["routes"][0]
        route_coords = route["geometry"]["coordinates"]
        if all_coords:
            all_coords.extend(route_coords[1:])  # skip overlap point
        else:
            all_coords.extend(route_coords)
        total_dist += route["distance"] / 1000
        total_dur += route["duration"] / 60

    fallback_km = StreetMapper().estimate_distance_km(waypoints)
    return {
        "routed": all_coords or coords,
        "distance_km": round(total_dist, 3) or fallback_km,
        "duration_minutes": round(total_dur) or int(fallback_km / 5 * 60),
        "waypoint_count": len(coords),
    }


def record_all(dry_run: bool = False) -> None:
    RECORDED_DIR.mkdir(parents=True, exist_ok=True)
    token = None if dry_run else _load_token()

    for fx in get_fixtures():
        target = fx.target_polyline()
        span_km = sum(
            haversine_distance_m(target[i], target[i + 1]) for i in range(len(target) - 1)
        ) / 1000
        print(f"{fx.id:<22} {fx.shape:<10} {fx.area_key:<12} "
              f"waypoints={len(target):>3}  intended≈{span_km:.2f}km")
        if dry_run:
            continue
        cassette = route_via_mapbox(target, token)
        cassette["fixture_id"] = fx.id
        (RECORDED_DIR / f"{fx.id}.json").write_text(json.dumps(cassette, indent=2) + "\n")
        print(f"  -> routed {len(cassette['routed'])} coords, "
              f"{cassette['distance_km']}km")

    if not dry_run:
        print(f"\nRecorded {len(get_fixtures())} cassettes to {RECORDED_DIR}")


if __name__ == "__main__":
    record_all(dry_run="--dry-run" in sys.argv)
