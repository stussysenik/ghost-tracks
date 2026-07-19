"""The `pytest -m eval` entrypoint: build + persist the offline scoreboard.

Deselected from the default suite (see pyproject `addopts`). Run explicitly:

    pytest -m eval -s

It replays recorded Mapbox routing (no network), scores all fixtures, writes
`eval/scoreboard.json`, and prints the readable table. Assertions are descriptive
for the baseline — they confirm the harness ran and the scoreboard is well-formed,
not that quality is good (that is deliberately the point: the baseline is meant to
be bad). Later changes flip these into hard gates.
"""

import json

import pytest

from eval.fixtures import get_fixtures
from eval.graph_provider import graph_provider
from eval.scoreboard import (
    GRAPH_SCOREBOARD_PATH,
    build_scoreboard,
    render_table,
    write_scoreboard,
)

# Task 4.5 gate thresholds.
MIN_WITHIN_DISTANCE_RATE = 0.80
# `mean_abs_deviation_m` is in meters, so it is comparable only against a board
# built from the *same* fixture set (see 4.6a) — the fixture-id guard below
# enforces that before the comparison is allowed to mean anything. 5% absorbs the
# path-choice discreteness documented in 4.2/4.3 while still catching a real
# collapse: the max_iterations=4 experiment moved it +21% (41.4 -> 50.3 m).
DEVIATION_REGRESSION_TOL = 0.05


@pytest.mark.eval
def test_generation_scoreboard():
    scoreboard = build_scoreboard()

    if not scoreboard["rows"]:
        pytest.skip(
            "No recorded cassettes. Run `python -m eval.record_baseline` once "
            "(needs MAPBOX_ACCESS_TOKEN) to record the baseline."
        )

    write_scoreboard(scoreboard)
    print("\n" + render_table(scoreboard))

    # Well-formed harness invariants (not quality gates).
    assert scoreboard["fixtures_scored"] >= 1
    o = scoreboard["overall"]
    assert 0.0 <= o["snap_score"] <= 100.0
    assert 0.0 <= o["loop_closure_rate"] <= 1.0
    assert 0.0 <= o["within_distance_rate"] <= 1.0
    assert scoreboard["dominant_failure_mode"] != "n/a (no cassettes)"


@pytest.mark.eval
def test_graph_router_meets_runnability_gate():
    """Task 4.5's gate, enforced rather than asserted in a ledger.

    Until now nothing in the repo built `scoreboard_graph_router.json` — it came
    from a scratch script, which is exactly how it went three tasks stale while
    the ledger reported numbers it did not contain. Building it here makes
    regenerating the committed artifact the same act as checking it.
    """
    previous = json.loads(GRAPH_SCOREBOARD_PATH.read_text())
    scoreboard = build_scoreboard(graph_provider, "owned-graph-router")
    print("\n" + render_table(scoreboard))

    # Every fixture must be scored. A router that fails to route the hard ones
    # drops them from `rows`, which *raises* both rates below by shrinking the
    # denominator — the survivorship bias Task 3.3 rejected a filter for. The
    # gate has to be unpassable by giving up on a fixture.
    assert scoreboard["fixtures_missing"] == []
    assert scoreboard["fixtures_scored"] == len(get_fixtures())

    o = scoreboard["overall"]
    # Closure is graded only over closed outlines, so an empty closed set would
    # score a vacuous 1.000. Pin the count: the gate must have something to grade.
    assert o["closed_outline_count"] == previous["overall"]["closed_outline_count"]
    assert o["loop_closure_rate"] == 1.0
    assert o["within_distance_rate"] >= MIN_WITHIN_DISTANCE_RATE

    # Snapping regression, in meters — valid only same-fixture-set (4.6a).
    ids = [r["id"] for r in scoreboard["rows"]]
    assert ids == [r["id"] for r in previous["rows"]], (
        "Fixture set changed; `mean_abs_deviation_m` is not scale-free and cannot "
        "be compared across boards built from different fixtures. Re-baseline first."
    )
    ceiling = previous["overall"]["mean_abs_deviation_m"] * (1 + DEVIATION_REGRESSION_TOL)
    assert o["mean_abs_deviation_m"] <= ceiling, (
        f"snapping regressed: {o['mean_abs_deviation_m']:.1f} m vs committed "
        f"{previous['overall']['mean_abs_deviation_m']:.1f} m (ceiling {ceiling:.1f} m)"
    )

    write_scoreboard(scoreboard, GRAPH_SCOREBOARD_PATH)
