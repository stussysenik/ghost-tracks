import pytest
import math
from services.shape_templates import get_parametric_shape
from models.schemas import Coordinate

def test_star_shape_closure():
    center = Coordinate(lng=14.42, lat=50.08)
    # Scale in degrees (roughly 500m)
    scale = 0.005 
    shape = get_parametric_shape("star", center, scale)
    
    # Assert start point equals end point for closure
    assert shape[0].lng == shape[-1].lng
    assert shape[0].lat == shape[-1].lat

def test_star_shape_vertices():
    center = Coordinate(lng=14.42, lat=50.08)
    scale = 0.005 
    shape = get_parametric_shape("star", center, scale)
    
    # The _star template generates 10 vertices + interpolates midpoints.
    # Total points = 10 (vertices) * 2 (with midpoints) + 1 (closure) = 21
    assert len(shape) == 21

def test_square_shape_closure():
    center = Coordinate(lng=14.42, lat=50.08)
    scale = 0.005 
    shape = get_parametric_shape("square", center, scale)
    
    assert shape[0].lng == shape[-1].lng
    assert shape[0].lat == shape[-1].lat

def haversine_distance(coord1: Coordinate, coord2: Coordinate) -> float:
    R = 6371000  # Earth radius in meters
    phi1, phi2 = math.radians(coord1.lat), math.radians(coord2.lat)
    dphi = math.radians(coord2.lat - coord1.lat)
    dlamb = math.radians(coord2.lng - coord1.lng)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlamb / 2)**2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def calculate_perimeter(shape: list[Coordinate]) -> float:
    total = 0
    for i in range(len(shape) - 1):
        total += haversine_distance(shape[i], shape[i+1])
    return total

def test_circle_perimeter_accuracy():
    center = Coordinate(lng=14.42, lat=50.08)
    # 0.01 deg is approx 1111 meters
    scale = 0.01 
    shape = get_parametric_shape("circle", center, scale)
    
    # Expected radius is scale * 0.45 in degrees.
    # Perimeter approx 2 * pi * r.
    # 0.01 scale -> ~1111m diameter. r ~ 500m. Perimeter ~ 3141m.
    perimeter = calculate_perimeter(shape)
    
    # Expected perimeter should be around 2600m (+/- 10%)
    assert 2400 < perimeter < 2900
