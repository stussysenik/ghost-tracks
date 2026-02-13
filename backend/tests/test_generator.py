"""Tests for the shape generator service (using template fallback, no LLM required)."""

from models.schemas import Coordinate
from services.shape_templates import get_parametric_shape, TEMPLATES


def test_all_templates_return_points():
    center = Coordinate(lng=14.42, lat=50.07)
    for name in TEMPLATES:
        points = get_parametric_shape(name, center, scale=0.012)
        assert len(points) >= 3, f"Template '{name}' returned too few points"


def test_heart_template_shape():
    center = Coordinate(lng=14.42, lat=50.07)
    points = get_parametric_shape("heart", center, scale=0.012)
    assert len(points) >= 20  # Heart has 25 + 1 closing point
    # All points should be near center
    for p in points:
        assert abs(p.lng - center.lng) < 0.02
        assert abs(p.lat - center.lat) < 0.02


def test_star_template_has_5_points():
    center = Coordinate(lng=14.42, lat=50.07)
    points = get_parametric_shape("star", center, scale=0.012)
    assert len(points) >= 11  # 5 outer + 5 inner + closing


def test_letter_template():
    center = Coordinate(lng=14.42, lat=50.07)
    points = get_parametric_shape("letter M", center, scale=0.012)
    assert len(points) >= 3


def test_single_char_template():
    center = Coordinate(lng=14.42, lat=50.07)
    points = get_parametric_shape("A", center, scale=0.012)
    assert len(points) >= 3


def test_unknown_shape_defaults_to_circle():
    center = Coordinate(lng=14.42, lat=50.07)
    points = get_parametric_shape("dinosaur", center, scale=0.012)
    assert len(points) >= 10  # circle has 21 points


def test_control_points_within_prague():
    center = Coordinate(lng=14.42, lat=50.07)
    for name in TEMPLATES:
        points = get_parametric_shape(name, center, scale=0.012)
        for p in points:
            assert 14.0 < p.lng < 15.0, f"Point lng {p.lng} outside Prague for {name}"
            assert 49.5 < p.lat < 50.5, f"Point lat {p.lat} outside Prague for {name}"


def test_scale_affects_size():
    center = Coordinate(lng=14.42, lat=50.07)
    small = get_parametric_shape("circle", center, scale=0.005)
    large = get_parametric_shape("circle", center, scale=0.02)
    # Large circle should span more degrees
    small_span = max(p.lng for p in small) - min(p.lng for p in small)
    large_span = max(p.lng for p in large) - min(p.lng for p in large)
    assert large_span > small_span
