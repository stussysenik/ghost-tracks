"""Parametric shape templates - fallback when LLM is unavailable."""

from __future__ import annotations

import math
from typing import Callable

from models.schemas import Coordinate

# Each template function: (center_lng, center_lat, scale_deg) -> list of Coordinate
# scale_deg is roughly the shape diameter in degrees (~0.01 deg ~ 1.1 km)

ShapeTemplateFunc = Callable[[float, float, float], list[Coordinate]]


def _heart(cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Parametric heart curve with high density for street-routing fidelity."""
    points: list[Coordinate] = []
    n = 64
    for i in range(n):
        t = 2 * math.pi * i / (n - 1)
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        # Normalize to [-1, 1] range (max x=16, max y=17)
        points.append(Coordinate(
            lng=cx + (x / 17) * scale * 0.5,
            lat=cy + (y / 17) * scale * 0.5,
        ))
    points.append(points[0])  # close the shape
    return points


def _star(cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Five-pointed star with midpoints on each edge for better street snapping."""
    outer_r = scale * 0.5
    inner_r = outer_r * 0.38
    # Generate 10 vertices (alternating outer/inner)
    vertices: list[tuple[float, float]] = []
    for i in range(10):
        angle = math.pi / 2 + (2 * math.pi * i / 10)
        r = outer_r if i % 2 == 0 else inner_r
        vertices.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))

    # Interpolate: add midpoint between each consecutive pair
    points: list[Coordinate] = []
    for i in range(len(vertices)):
        ax, ay = vertices[i]
        bx, by = vertices[(i + 1) % len(vertices)]
        points.append(Coordinate(lng=ax, lat=ay))
        points.append(Coordinate(lng=(ax + bx) / 2, lat=(ay + by) / 2))
    points.append(points[0])  # close
    return points


def _circle(cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Circle with high point density."""
    points: list[Coordinate] = []
    r = scale * 0.45
    n = 48
    for i in range(n):
        angle = 2 * math.pi * i / n
        points.append(Coordinate(
            lng=cx + r * math.cos(angle),
            lat=cy + r * math.sin(angle),
        ))
    points.append(points[0])  # close
    return points


def _triangle(cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Equilateral triangle with interpolated edges."""
    r = scale * 0.45
    corners: list[tuple[float, float]] = []
    for i in range(3):
        angle = math.pi / 2 + (2 * math.pi * i / 3)
        corners.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))

    points: list[Coordinate] = []
    pts_per_edge = 4  # intermediate points per edge
    for i in range(3):
        ax, ay = corners[i]
        bx, by = corners[(i + 1) % 3]
        for j in range(pts_per_edge + 1):
            frac = j / (pts_per_edge + 1)
            points.append(Coordinate(
                lng=ax + (bx - ax) * frac,
                lat=ay + (by - ay) * frac,
            ))
    points.append(points[0])  # close
    return points


def _arrow(cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Right-pointing arrow with interpolated segments."""
    s = scale * 0.45
    # Define the 7 key vertices
    vertices = [
        (cx - s, cy),
        (cx + s * 0.3, cy),
        (cx + s * 0.3, cy + s * 0.4),
        (cx + s, cy),
        (cx + s * 0.3, cy - s * 0.4),
        (cx + s * 0.3, cy),
        (cx - s, cy),
    ]
    # Interpolate: add midpoint between each consecutive pair
    points: list[Coordinate] = []
    for i in range(len(vertices) - 1):
        ax, ay = vertices[i]
        bx, by = vertices[i + 1]
        points.append(Coordinate(lng=ax, lat=ay))
        points.append(Coordinate(lng=(ax + bx) / 2, lat=(ay + by) / 2))
    points.append(Coordinate(lng=vertices[-1][0], lat=vertices[-1][1]))
    return points


def _square(cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Square with interpolated edges."""
    s = scale * 0.4
    corners = [
        (cx - s, cy + s),
        (cx + s, cy + s),
        (cx + s, cy - s),
        (cx - s, cy - s),
    ]

    points: list[Coordinate] = []
    pts_per_edge = 3  # intermediate points per edge
    for i in range(4):
        ax, ay = corners[i]
        bx, by = corners[(i + 1) % 4]
        for j in range(pts_per_edge + 1):
            frac = j / (pts_per_edge + 1)
            points.append(Coordinate(
                lng=ax + (bx - ax) * frac,
                lat=ay + (by - ay) * frac,
            ))
    points.append(points[0])  # close
    return points


def _letter(char: str, cx: float, cy: float, scale: float) -> list[Coordinate]:
    """Simple block-letter shapes for A-Z (basic subset)."""
    s = scale * 0.4
    h = scale * 0.5
    templates: dict[str, list[tuple[float, float]]] = {
        "A": [(-s, -h), (-s * 0.2, h), (s * 0.2, h), (s, -h), (s * 0.5, 0), (-s * 0.5, 0)],
        "B": [(-s, -h), (-s, h), (s * 0.5, h), (s, h * 0.6), (s * 0.5, 0),
               (s, -h * 0.6), (s * 0.5, -h), (-s, -h), (-s, 0), (s * 0.5, 0)],
        "C": [(s, h * 0.7), (0, h), (-s, h * 0.5), (-s, -h * 0.5), (0, -h), (s, -h * 0.7)],
        "D": [(-s, -h), (-s, h), (s * 0.3, h), (s, 0), (s * 0.3, -h), (-s, -h)],
        "E": [(s, h), (-s, h), (-s, 0), (s * 0.5, 0), (-s, 0), (-s, -h), (s, -h)],
        "H": [(-s, h), (-s, -h), (-s, 0), (s, 0), (s, h), (s, -h)],
        "L": [(-s, h), (-s, -h), (s, -h)],
        "M": [(-s, -h), (-s, h), (0, 0), (s, h), (s, -h)],
        "N": [(-s, -h), (-s, h), (s, -h), (s, h)],
        "O": [(0, h), (-s, h * 0.5), (-s, -h * 0.5), (0, -h), (s, -h * 0.5),
               (s, h * 0.5), (0, h)],
        "P": [(-s, -h), (-s, h), (s * 0.5, h), (s, h * 0.5), (s * 0.5, 0), (-s, 0)],
        "R": [(-s, -h), (-s, h), (s * 0.5, h), (s, h * 0.5), (s * 0.5, 0),
               (-s, 0), (s, -h)],
        "S": [(s, h * 0.7), (0, h), (-s, h * 0.3), (-s, 0), (s, 0),
               (s, -h * 0.3), (0, -h), (-s, -h * 0.7)],
        "T": [(-s, h), (s, h), (0, h), (0, -h)],
        "V": [(-s, h), (0, -h), (s, h)],
        "W": [(-s, h), (-s * 0.5, -h), (0, 0), (s * 0.5, -h), (s, h)],
        "X": [(-s, h), (s, -h), (0, 0), (-s, -h), (s, h)],
        "Z": [(-s, h), (s, h), (-s, -h), (s, -h)],
    }
    raw = templates.get(char.upper(), templates.get("O", []))
    return [Coordinate(lng=cx + dx, lat=cy + dy) for dx, dy in raw]


# Registry
TEMPLATES: dict[str, ShapeTemplateFunc] = {
    "heart": _heart,
    "star": _star,
    "circle": _circle,
    "triangle": _triangle,
    "arrow": _arrow,
    "square": _square,
}


def get_parametric_shape(
    shape_name: str,
    center: Coordinate,
    scale: float = 0.012,
) -> list[Coordinate]:
    """Get control points from a parametric template.

    Args:
        shape_name: Name or description of the shape (e.g. "heart", "letter M")
        center: Center coordinate for the shape
        scale: Shape diameter in degrees (~0.01 = ~1.1km)

    Returns:
        List of control point Coordinates
    """
    name_lower = shape_name.lower().strip()

    # Check for letter patterns
    if "letter" in name_lower:
        for char in name_lower:
            if char.isalpha() and char != "l" and char != "e" and char != "t" and char != "r":
                return _letter(char, center.lng, center.lat, scale)
        # If "letter X" pattern
        parts = name_lower.split()
        for p in parts:
            if len(p) == 1 and p.isalpha():
                return _letter(p, center.lng, center.lat, scale)

    # Check templates
    for key, func in TEMPLATES.items():
        if key in name_lower:
            return func(center.lng, center.lat, scale)

    # Single character
    if len(name_lower) == 1 and name_lower.isalpha():
        return _letter(name_lower, center.lng, center.lat, scale)

    # Default: circle
    return _circle(center.lng, center.lat, scale)
