"""Offline scoreboard — replays recorded routing and scores every fixture.

Reads cassettes written by `record_baseline.py` (no network), scores each fixture
with `metrics.score_fixture`, aggregates per difficulty tier and per network tier,
and names the dominant failure mode empirically (design D3). This is the gate: a
later router change must move these numbers, not just pass unit tests.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

from eval.fixtures import Fixture, get_fixtures
from eval.metrics import StageScores, score_fixture
from models.schemas import Coordinate
from services.shape_router import outline_is_closed

EVAL_DIR = Path(__file__).parent
RECORDED_DIR = EVAL_DIR / "fixtures" / "recorded"
SCOREBOARD_PATH = EVAL_DIR / "scoreboard.json"

# Runnability thresholds (design D4 / Task 4 gates) — descriptive here, asserted later.
LOOP_TOL_M = 50.0
DISTANCE_TOL = 0.10  # ±10%


def recorded_path(fixture_id: str) -> Path:
    return RECORDED_DIR / f"{fixture_id}.json"


def load_recorded(fixture_id: str) -> dict | None:
    """Load a recorded routing cassette, or None if it hasn't been recorded."""
    p = recorded_path(fixture_id)
    if not p.exists():
        return None
    return json.loads(p.read_text())


def _routed_coords(cassette: dict) -> list[Coordinate]:
    return [Coordinate(lng=c[0], lat=c[1]) for c in cassette.get("routed", [])]


def score_one(fixture: Fixture, cassette: dict) -> StageScores:
    target = fixture.target_polyline()
    routed = _routed_coords(cassette)
    return score_fixture(target, routed, fixture.target_distance_km)


# A router under test: fixture -> routed polyline, or None when it has no route.
RouteProvider = Callable[[Fixture], list[Coordinate] | None]


def cassette_provider(fixture: Fixture) -> list[Coordinate] | None:
    """The recorded Mapbox baseline — replayed, never called live."""
    cassette = load_recorded(fixture.id)
    return None if cassette is None else _routed_coords(cassette)


def _mean(xs: list[float]) -> float:
    finite = [x for x in xs if x != float("inf")]
    return round(sum(finite) / len(finite), 3) if finite else 0.0


def _aggregate(rows: list[dict]) -> dict:
    scores = [r["scores"] for r in rows]
    n = len(scores) or 1
    # Closure is graded only where the shape is itself a loop. A letter M ends
    # 700 m from where it began; scoring that as a failed loop measures the
    # alphabet, not the router, and caps the metric below any gate it could pass.
    # Open shapes are honest point-to-point runs — see `outline_is_closed`.
    closed = [r for r in rows if r["shape_is_closed"]]
    loop_rate = (
        sum(1 for r in closed if r["scores"]["is_loop"]) / len(closed) if closed else 1.0
    )
    within_dist = sum(1 for s in scores if s["distance_error"] <= DISTANCE_TOL) / n
    return {
        "count": len(scores),
        "extraction_iou": _mean([s["extraction_iou"] for s in scores]),
        "snap_score": _mean([s["snap_score"] for s in scores]),
        "closed_outline_count": len(closed),
        "loop_closure_rate": round(loop_rate, 3),
        "within_distance_rate": round(within_dist, 3),
        "mean_distance_error": _mean([s["distance_error"] for s in scores]),
        "mean_repeat_ratio": _mean([s["repeat_ratio"] for s in scores]),
    }


def _dominant_failure_mode(agg: dict) -> str:
    """Name the weakest stage on a common 0..1 health scale (higher = healthier)."""
    health = {
        "extraction": agg["extraction_iou"] / 100.0,
        "snapping": agg["snap_score"] / 100.0,
        "runnability": min(
            agg["loop_closure_rate"],
            agg["within_distance_rate"],
            max(0.0, 1.0 - agg["mean_repeat_ratio"]),
        ),
    }
    worst = min(health, key=health.get)
    return f"{worst} (health {health[worst]:.2f} of {json.dumps({k: round(v, 2) for k, v in health.items()})})"


def build_scoreboard(
    provider: RouteProvider = cassette_provider,
    label: str = "mapbox-directions-walking",
) -> dict:
    """Score every fixture routed by `provider` and aggregate.

    Defaults to replaying the recorded Mapbox baseline. Pass a graph-router
    provider to score a challenger on exactly the same fixtures and metrics.
    """
    rows: list[dict] = []
    missing: list[str] = []
    for fx in get_fixtures():
        routed = provider(fx)
        if routed is None:
            missing.append(fx.id)
            continue
        outline = fx.target_polyline()
        scores = score_fixture(outline, routed, fx.target_distance_km)
        rows.append(
            {
                "id": fx.id,
                "shape": fx.shape,
                "area": fx.area_key,
                "network_tier": fx.area.tier,
                "difficulty": fx.difficulty,
                "shape_is_closed": outline_is_closed(outline),
                "scores": scores.to_dict(),
            }
        )

    by_difficulty = {
        tier: _aggregate([r for r in rows if r["difficulty"] == tier])
        for tier in ("easy", "moderate", "hard")
        if any(r["difficulty"] == tier for r in rows)
    }
    by_network = {
        tier: _aggregate([r for r in rows if r["network_tier"] == tier])
        for tier in ("dense_grid", "irregular", "sparse")
        if any(r["network_tier"] == tier for r in rows)
    }
    overall = _aggregate(rows) if rows else {}

    return {
        "baseline": label,
        "fixtures_scored": len(rows),
        "fixtures_missing": missing,
        "overall": overall,
        "by_difficulty": by_difficulty,
        "by_network": by_network,
        "dominant_failure_mode": _dominant_failure_mode(overall) if rows else "n/a (no cassettes)",
        "rows": rows,
    }


def render_table(scoreboard: dict) -> str:
    """Human-readable per-fixture table + aggregate summary."""
    lines: list[str] = []
    lines.append(f"BASELINE: {scoreboard['baseline']}   "
                 f"scored={scoreboard['fixtures_scored']}  missing={len(scoreboard['fixtures_missing'])}")
    lines.append("")
    header = f"{'fixture':<22}{'tier':<12}{'snap':>6}{'loop':>6}{'dist_err':>10}{'repeat':>8}"
    lines.append(header)
    lines.append("-" * len(header))
    for r in scoreboard["rows"]:
        s = r["scores"]
        # "-" = open shape, closure not graded (not a silent pass).
        loop = ("Y" if s["is_loop"] else "n") if r["shape_is_closed"] else "-"
        lines.append(
            f"{r['id']:<22}{r['difficulty']:<12}"
            f"{s['snap_score']:>6.1f}{loop:>6}"
            f"{s['distance_error']:>10.2f}{s['repeat_ratio']:>8.2f}"
        )
    lines.append("")
    o = scoreboard.get("overall", {})
    if o:
        lines.append(
            f"OVERALL  snap={o['snap_score']:.1f}  "
            f"loop_rate={o['loop_closure_rate']:.2f} (of {o['closed_outline_count']} closed)  "
            f"within_dist={o['within_distance_rate']:.2f}  "
            f"mean_dist_err={o['mean_distance_error']:.2f}  mean_repeat={o['mean_repeat_ratio']:.2f}"
        )
    lines.append(f"DOMINANT FAILURE MODE: {scoreboard['dominant_failure_mode']}")
    return "\n".join(lines)


def write_scoreboard(scoreboard: dict, path: Path = SCOREBOARD_PATH) -> Path:
    path.write_text(json.dumps(scoreboard, indent=2) + "\n")
    return path
