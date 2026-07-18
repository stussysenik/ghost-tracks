"""Tests for eval stage metrics — exact numeric expectations so wrong logic fails."""

import math

from eval.metrics import (
    discrete_frechet_distance,
    distance_error,
    is_loop,
    loop_closure_gap_m,
    repeat_ratio,
    route_length_km,
    score_fixture,
)
from models.schemas import Coordinate
from services.street_mapper import haversine_distance_m

# ~50.07°N: 1e-4 deg lat ≈ 11.1 m; used to build shapes with known scale.
LAT0 = 50.07
LNG0 = 14.42


def _square(cx: float, cy: float, half_deg: float) -> list[Coordinate]:
    s = half_deg
    return [
        Coordinate(lng=cx - s, lat=cy - s),
        Coordinate(lng=cx + s, lat=cy - s),
        Coordinate(lng=cx + s, lat=cy + s),
        Coordinate(lng=cx - s, lat=cy + s),
        Coordinate(lng=cx - s, lat=cy - s),  # closed loop
    ]


# --- discrete Fréchet ---------------------------------------------------------


def test_frechet_identical_is_zero():
    sq = _square(LNG0, LAT0, 0.005)
    assert discrete_frechet_distance(sq, sq) == 0.0


def test_frechet_uniform_shift_equals_shift_distance():
    """A rigid shift makes Fréchet exactly the per-point shift distance."""
    sq = _square(LNG0, LAT0, 0.005)
    shifted = [Coordinate(lng=p.lng + 0.0001, lat=p.lat) for p in sq]
    expected = haversine_distance_m(sq[0], shifted[0])
    got = discrete_frechet_distance(sq, shifted)
    assert math.isclose(got, expected, rel_tol=1e-6)


def test_frechet_catches_reversed_order_when_hausdorff_would_not():
    """Same point set, reversed traversal: Hausdorff=0 but Fréchet is large."""
    line = [Coordinate(lng=LNG0 + i * 0.001, lat=LAT0) for i in range(5)]
    reversed_line = list(reversed(line))
    # Hausdorff (set metric) is 0 — identical point sets.
    from services.shape_validator import hausdorff_distance

    assert hausdorff_distance(line, reversed_line) < 1.0
    # Fréchet must be roughly the full span (leash stretches end-to-end).
    span = haversine_distance_m(line[0], line[-1])
    assert discrete_frechet_distance(line, reversed_line) >= span * 0.9


# --- runnability --------------------------------------------------------------


def test_route_length_km_of_known_leg():
    a = Coordinate(lng=LNG0, lat=LAT0)
    b = Coordinate(lng=LNG0, lat=LAT0 + 0.009)  # ~1 km north
    km = route_length_km([a, b])
    assert 0.98 < km < 1.02


def test_loop_closure_detected():
    sq = _square(LNG0, LAT0, 0.005)  # first == last
    assert loop_closure_gap_m(sq) < 1.0
    assert is_loop(sq, tol_m=50)


def test_open_route_is_not_loop():
    line = [Coordinate(lng=LNG0, lat=LAT0), Coordinate(lng=LNG0 + 0.01, lat=LAT0)]
    assert loop_closure_gap_m(line) > 500  # ~700m gap
    assert not is_loop(line, tol_m=50)


def test_distance_error_symmetric_and_zero():
    assert distance_error(5.0, 5.0) == 0.0
    assert math.isclose(distance_error(5.5, 5.0), 0.1, rel_tol=1e-9)
    assert math.isclose(distance_error(4.5, 5.0), 0.1, rel_tol=1e-9)


def test_repeat_ratio_clean_loop_low():
    # A generously-sized square loop retraces almost nothing.
    sq = _square(LNG0, LAT0, 0.01)
    assert repeat_ratio(sq) < 0.1


def test_repeat_ratio_out_and_back_high():
    # Walk east then back west along the same line → ~half is retraced.
    fwd = [Coordinate(lng=LNG0 + i * 0.0005, lat=LAT0) for i in range(11)]
    out_and_back = fwd + list(reversed(fwd))[1:]
    assert repeat_ratio(out_and_back) > 0.4


# --- aggregate ----------------------------------------------------------------


def test_score_fixture_perfect_match_is_high():
    sq = _square(LNG0, LAT0, 0.005)
    target_km = route_length_km(sq)
    scores = score_fixture(sq, sq, target_km)
    assert scores.snap_score >= 99
    assert scores.is_loop
    assert scores.distance_error == 0.0
    assert scores.frechet_m == 0.0


def test_score_fixture_empty_routed_is_worst():
    sq = _square(LNG0, LAT0, 0.005)
    scores = score_fixture(sq, [], target_km=2.0)
    assert scores.snap_score == 0.0
    assert not scores.is_loop
    assert scores.frechet_m == float("inf")


def test_score_fixture_dict_roundtrip():
    sq = _square(LNG0, LAT0, 0.005)
    d = score_fixture(sq, sq, route_length_km(sq)).to_dict()
    assert set(d) >= {"snap_score", "is_loop", "distance_error", "repeat_ratio", "frechet_m"}
