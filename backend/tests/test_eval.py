"""The `pytest -m eval` entrypoint: build + persist the offline scoreboard.

Deselected from the default suite (see pyproject `addopts`). Run explicitly:

    pytest -m eval -s

It replays recorded Mapbox routing (no network), scores all fixtures, writes
`eval/scoreboard.json`, and prints the readable table. Assertions are descriptive
for the baseline — they confirm the harness ran and the scoreboard is well-formed,
not that quality is good (that is deliberately the point: the baseline is meant to
be bad). Later changes flip these into hard gates.
"""

import pytest

from eval.scoreboard import build_scoreboard, render_table, write_scoreboard


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
