"""Tests for the street mapper service."""

from models.schemas import BoundingBox, Coordinate
from services.street_mapper import StreetMapper, haversine_distance_m


def test_haversine_distance_known():
    """Test with known distance: Prague center to about 1km away."""
    a = Coordinate(lng=14.4205, lat=50.0875)
    b = Coordinate(lng=14.4205, lat=50.0965)
    dist = haversine_distance_m(a, b)
    assert 900 < dist < 1100  # ~1km


def test_haversine_distance_zero():
    a = Coordinate(lng=14.4205, lat=50.0875)
    assert haversine_distance_m(a, a) < 1.0


def test_scale_to_bbox_preserves_point_count():
    mapper = StreetMapper()
    points = [
        Coordinate(lng=0, lat=0),
        Coordinate(lng=1, lat=0),
        Coordinate(lng=1, lat=1),
        Coordinate(lng=0, lat=1),
    ]
    bbox = BoundingBox(min_lng=14.42, min_lat=50.07, max_lng=14.46, max_lat=50.09)
    scaled = mapper.scale_to_bbox(points, bbox)
    assert len(scaled) == len(points)


def test_scale_to_bbox_fits_within_target():
    mapper = StreetMapper()
    points = [
        Coordinate(lng=0, lat=0),
        Coordinate(lng=10, lat=0),
        Coordinate(lng=10, lat=10),
        Coordinate(lng=0, lat=10),
    ]
    bbox = BoundingBox(min_lng=14.42, min_lat=50.07, max_lng=14.46, max_lat=50.09)
    scaled = mapper.scale_to_bbox(points, bbox)
    for p in scaled:
        assert p.lng >= bbox.min_lng, f"lng {p.lng} < min {bbox.min_lng}"
        assert p.lng <= bbox.max_lng, f"lng {p.lng} > max {bbox.max_lng}"
        assert p.lat >= bbox.min_lat, f"lat {p.lat} < min {bbox.min_lat}"
        assert p.lat <= bbox.max_lat, f"lat {p.lat} > max {bbox.max_lat}"


def test_scale_preserves_aspect_ratio():
    mapper = StreetMapper()
    # A tall rectangle
    points = [
        Coordinate(lng=0, lat=0),
        Coordinate(lng=1, lat=0),
        Coordinate(lng=1, lat=2),
        Coordinate(lng=0, lat=2),
    ]
    bbox = BoundingBox(min_lng=14.42, min_lat=50.07, max_lng=14.46, max_lat=50.09)
    scaled = mapper.scale_to_bbox(points, bbox)
    # Height should be ~2x width
    lngs = [p.lng for p in scaled]
    lats = [p.lat for p in scaled]
    w = max(lngs) - min(lngs)
    h = max(lats) - min(lats)
    assert abs(h / w - 2.0) < 0.1


def test_densify_adds_intermediate_points():
    mapper = StreetMapper()
    # Two points ~2km apart
    points = [
        Coordinate(lng=14.42, lat=50.07),
        Coordinate(lng=14.42, lat=50.09),
    ]
    dense = mapper.densify(points, max_segment_m=200)
    assert len(dense) > 2


def test_densify_no_change_for_close_points():
    mapper = StreetMapper()
    points = [
        Coordinate(lng=14.420, lat=50.070),
        Coordinate(lng=14.4201, lat=50.0701),
    ]
    dense = mapper.densify(points, max_segment_m=200)
    assert len(dense) == 2


def test_deduplicate_removes_close_points():
    mapper = StreetMapper()
    points = [
        Coordinate(lng=14.420, lat=50.070),
        Coordinate(lng=14.42001, lat=50.07001),  # ~1m away
        Coordinate(lng=14.425, lat=50.075),
    ]
    clean = mapper.deduplicate(points, min_distance_m=30)
    assert len(clean) == 2


def test_deduplicate_keeps_last_point():
    mapper = StreetMapper()
    points = [
        Coordinate(lng=14.420, lat=50.070),
        Coordinate(lng=14.42001, lat=50.07001),
        Coordinate(lng=14.42002, lat=50.07002),
    ]
    clean = mapper.deduplicate(points, min_distance_m=30)
    assert clean[-1] == points[-1]


def test_map_to_streets_full_pipeline():
    mapper = StreetMapper()
    # Simple square shape
    points = [
        Coordinate(lng=0, lat=0),
        Coordinate(lng=1, lat=0),
        Coordinate(lng=1, lat=1),
        Coordinate(lng=0, lat=1),
        Coordinate(lng=0, lat=0),
    ]
    bbox = BoundingBox(min_lng=14.42, min_lat=50.07, max_lng=14.46, max_lat=50.09)
    mapped = mapper.map_to_streets(points, bbox)
    assert len(mapped) >= 4
    # All points within Prague
    for p in mapped:
        assert 14.0 < p.lng < 15.0
        assert 49.5 < p.lat < 50.5


def test_estimate_distance_km():
    mapper = StreetMapper()
    # Approx 1km north
    points = [
        Coordinate(lng=14.42, lat=50.07),
        Coordinate(lng=14.42, lat=50.08),
    ]
    dist = mapper.estimate_distance_km(points)
    assert 0.8 < dist < 1.5


def test_minimum_waypoint_spacing():
    mapper = StreetMapper()
    points = [
        Coordinate(lng=14.420, lat=50.070),
        Coordinate(lng=14.425, lat=50.075),
        Coordinate(lng=14.430, lat=50.070),
        Coordinate(lng=14.435, lat=50.075),
    ]
    bbox = BoundingBox(min_lng=14.42, min_lat=50.06, max_lng=14.44, max_lat=50.08)
    mapped = mapper.map_to_streets(points, bbox)
    # All consecutive points should be >= 30m apart (deduplicate threshold)
    for i in range(len(mapped) - 1):
        dist = haversine_distance_m(mapped[i], mapped[i + 1])
        assert dist >= 29.0, f"Points {i} and {i+1} only {dist:.0f}m apart"
