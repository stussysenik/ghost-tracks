"""Fixture manifest — deterministic shapes × pinned areas spanning difficulty.

Targets are built from the *real* pipeline's pre-router stage
(`StreetMapper.map_to_streets`), so the eval measures exactly the polyline the
router receives. Areas are pinned by bbox; caching the OSM walk-network extract
for each is deferred to Task 2 (`road_graph.py`), which is the first consumer —
the Mapbox baseline and all metrics here need no graph.

Difficulty tiers reflect routing hardness, not drawing complexity: smooth convex
loops (easy) → curves and tips (moderate) → sharp reversals and open strokes that
a shortcut-prone router mangles (hard).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from models.schemas import BoundingBox, Coordinate
from services.shape_templates import get_parametric_shape
from services.street_mapper import StreetMapper


@dataclass(frozen=True)
class Area:
    key: str
    name: str
    tier: str  # network character: "dense_grid" | "irregular" | "sparse"
    bbox: BoundingBox

    def center(self) -> Coordinate:
        return self.bbox.center()

    def scale_deg(self) -> float:
        # Mirror generator: shape spans ~70% of the smaller bbox dimension.
        return min(self.bbox.width_deg(), self.bbox.height_deg()) * 0.7


# Committed OSM walk-network extracts (Task 2), replayed offline by eval + tests.
GRAPHS_DIR = Path(__file__).parent / "fixtures" / "graphs"


# Three pinned areas, one per network character. Bboxes are ~2 km across.
AREAS: dict[str, Area] = {
    "eixample": Area(
        key="eixample",
        name="Barcelona Eixample (dense grid)",
        tier="dense_grid",
        bbox=BoundingBox(min_lng=2.1500, min_lat=41.3850, max_lng=2.1760, max_lat=41.4010),
    ),
    "prague": Area(
        key="prague",
        name="Prague centre (irregular European)",
        tier="irregular",
        bbox=BoundingBox(min_lng=14.4100, min_lat=50.0770, max_lng=14.4360, max_lat=50.0930),
    ),
    "scottsdale": Area(
        key="scottsdale",
        name="Scottsdale AZ (sparse suburb)",
        tier="sparse",
        bbox=BoundingBox(min_lng=-111.9330, min_lat=33.6120, max_lng=-111.9070, max_lat=33.6280),
    ),
}


@dataclass(frozen=True)
class Fixture:
    id: str
    shape: str  # template name or "letter X"
    area_key: str
    difficulty: str  # "easy" | "moderate" | "hard"
    target_distance_km: float

    @property
    def area(self) -> Area:
        return AREAS[self.area_key]

    def control_points(self) -> list[Coordinate]:
        """Raw template control points, centered/scaled to the area."""
        return get_parametric_shape(self.shape, self.area.center(), self.area.scale_deg())

    def target_polyline(self) -> list[Coordinate]:
        """The intended on-map polyline fed to the router (pre-snapping)."""
        return StreetMapper().map_to_streets(self.control_points(), self.area.bbox)


# 12 fixtures: 4 per area, spanning all three difficulty tiers.
FIXTURES: list[Fixture] = [
    # easy — smooth convex loops
    Fixture("circle-eixample", "circle", "eixample", "easy", 3.0),
    Fixture("square-prague", "square", "prague", "easy", 3.0),
    Fixture("triangle-scottsdale", "triangle", "scottsdale", "easy", 3.0),
    # moderate — curves, tips, closed letters
    Fixture("heart-prague", "heart", "prague", "moderate", 5.0),
    Fixture("star-eixample", "star", "eixample", "moderate", 5.0),
    Fixture("arrow-scottsdale", "arrow", "scottsdale", "moderate", 5.0),
    Fixture("letter-o-eixample", "letter O", "eixample", "moderate", 5.0),
    # hard — sharp reversals and open strokes (shortcut-prone)
    Fixture("letter-m-prague", "letter M", "prague", "hard", 6.0),
    Fixture("letter-w-scottsdale", "letter W", "scottsdale", "hard", 6.0),
    Fixture("letter-x-eixample", "letter X", "eixample", "hard", 6.0),
    Fixture("letter-z-prague", "letter Z", "prague", "hard", 6.0),
    Fixture("letter-h-scottsdale", "letter H", "scottsdale", "hard", 6.0),
]


def get_fixtures() -> list[Fixture]:
    return FIXTURES
