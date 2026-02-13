"""Tests for the shape validator service."""

from models.schemas import Coordinate, ValidationResult
from services.shape_validator import ShapeValidator, hausdorff_distance, rasterize_route


def _make_square(cx: float, cy: float, size: float) -> list[Coordinate]:
    s = size / 2
    return [
        Coordinate(lng=cx - s, lat=cy - s),
        Coordinate(lng=cx + s, lat=cy - s),
        Coordinate(lng=cx + s, lat=cy + s),
        Coordinate(lng=cx - s, lat=cy + s),
        Coordinate(lng=cx - s, lat=cy - s),
    ]


def _make_line(cx: float, cy: float, length: float) -> list[Coordinate]:
    return [
        Coordinate(lng=cx - length / 2, lat=cy),
        Coordinate(lng=cx + length / 2, lat=cy),
    ]


def test_identical_shapes_score_high():
    """Two identical point sets should score very high."""
    validator = ShapeValidator()
    points = _make_square(14.42, 50.07, 0.01)
    result = validator._validate_algorithmic(points, points, threshold=45)
    assert result.score >= 90
    assert result.passed


def test_similar_shapes_pass():
    """A slightly shifted version should still pass."""
    validator = ShapeValidator()
    target = _make_square(14.42, 50.07, 0.01)
    # Shift slightly (a few meters)
    actual = [Coordinate(lng=p.lng + 0.0001, lat=p.lat + 0.0001) for p in target]
    result = validator._validate_algorithmic(target, actual, threshold=45)
    assert result.passed


def test_completely_different_shapes_fail():
    """A square vs a far-away line should fail."""
    validator = ShapeValidator()
    target = _make_square(14.42, 50.07, 0.01)
    actual = _make_line(14.50, 50.10, 0.05)  # far away
    result = validator._validate_algorithmic(target, actual, threshold=45)
    assert not result.passed
    assert result.score < 45


def test_hausdorff_distance_identical():
    points = _make_square(14.42, 50.07, 0.01)
    dist = hausdorff_distance(points, points)
    assert dist < 1.0  # < 1 meter


def test_hausdorff_distance_symmetric():
    a = _make_square(14.42, 50.07, 0.01)
    b = _make_line(14.42, 50.07, 0.01)
    assert abs(hausdorff_distance(a, b) - hausdorff_distance(b, a)) < 1.0


def test_rasterize_creates_image():
    points = _make_square(14.42, 50.07, 0.01)
    bbox = (14.41, 50.06, 14.43, 50.08)
    img = rasterize_route(points, bbox, size=128)
    assert img.size == (128, 128)
    # Should have some white pixels (the route)
    import numpy as np
    arr = np.array(img)
    assert arr.sum() > 0


def test_rasterize_empty_coords():
    bbox = (14.41, 50.06, 14.43, 50.08)
    img = rasterize_route([], bbox, size=128)
    import numpy as np
    arr = np.array(img)
    assert arr.sum() == 0


def test_validation_threshold_configurable():
    validator = ShapeValidator()
    points = _make_square(14.42, 50.07, 0.01)
    actual = [Coordinate(lng=p.lng + 0.002, lat=p.lat + 0.002) for p in points]
    # With high threshold, might fail
    result_strict = validator._validate_algorithmic(points, actual, threshold=90)
    # With low threshold, should pass
    result_lenient = validator._validate_algorithmic(points, actual, threshold=10)
    assert result_lenient.passed
    # The strict result may or may not pass depending on shift magnitude


def test_empty_target_fails():
    validator = ShapeValidator()
    actual = _make_square(14.42, 50.07, 0.01)
    result = validator._validate_algorithmic([], actual, threshold=45)
    assert not result.passed
    assert result.score == 0
