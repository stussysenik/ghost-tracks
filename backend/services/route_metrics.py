"""Route quality metrics shared by the router and the eval scoreboard.

`repeat_ratio` lives here rather than in `eval/` because the route contract now
*reports* it: the number a caller sees on a route and the number the scoreboard
grades it by must be the same function, or the gate stops describing the product.
Dependency runs eval -> services, never the reverse.
"""

from __future__ import annotations

import math

from models.schemas import Coordinate
from services.street_mapper import haversine_distance_m

DEFAULT_CELL_M = 25.0


def repeat_ratio(route: list[Coordinate], cell_m: float = DEFAULT_CELL_M) -> float:
    """Fraction of the route that retraces ground already covered.

    The polyline is walked at ~`cell_m` resolution and each step is binned into a
    square grid cell (local equirectangular meters). The ratio is
    `1 - unique_cells / visited_cells`: an out-and-back on the same street
    approaches ~0.5, a clean non-overlapping loop approaches ~0.0.

    Ground covered, not edges traversed: sampling by cumulative arc length keeps
    the sample count a function of how far the route goes, never of how densely
    its polyline happens to be vertexed.
    """
    if len(route) < 2:
        return 0.0

    lat0 = route[0].lat
    m_per_deg_lat = 111_320.0
    m_per_deg_lng = 111_320.0 * math.cos(math.radians(lat0))

    def cell_of(c: Coordinate) -> tuple[int, int]:
        x_m = c.lng * m_per_deg_lng
        y_m = c.lat * m_per_deg_lat
        return (int(x_m // cell_m), int(y_m // cell_m))

    visited: list[tuple[int, int]] = []
    next_at = 0.0
    walked = 0.0
    for a, b in zip(route, route[1:]):
        seg = haversine_distance_m(a, b)
        while next_at <= walked + seg:
            frac = (next_at - walked) / seg if seg > 0 else 0.0
            visited.append(
                cell_of(
                    Coordinate(
                        lng=a.lng + (b.lng - a.lng) * frac,
                        lat=a.lat + (b.lat - a.lat) * frac,
                    )
                )
            )
            next_at += cell_m
        walked += seg
    visited.append(cell_of(route[-1]))

    if not visited:
        return 0.0
    unique = len(set(visited))
    return round(1.0 - unique / len(visited), 4)
