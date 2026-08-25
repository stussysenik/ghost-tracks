"""Prague neighborhood data service."""

from __future__ import annotations

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Optional

from models.schemas import BoundingBox, Coordinate, Neighborhood

_DATA_DIR = Path(os.path.dirname(os.path.abspath(__file__))).parent / "data"

# Explicit shape-to-preferred-layout mapping
_SHAPE_LAYOUT_PREFS: dict[str, str] = {
    "heart": "mixed",
    "star": "grid",
    "circle": "mixed",
    "triangle": "grid",
    "square": "grid",
    "arrow": "grid",
    "letter": "grid",
    "geometric": "grid",
    "creature": "organic",
    "animal": "organic",
    "cat": "organic",
    "dog": "organic",
    "bird": "organic",
    "fish": "organic",
    "fox": "organic",
    "flower": "organic",
    "tree": "mixed",
}

# Noise words to strip when normalizing shape descriptions
_NOISE_WORDS = {"a", "an", "the", "shape", "shaped", "pattern", "route", "running", "draw",
                "make", "create", "please", "me", "i", "want", "like", "of", "in", "with"}


def _normalize_shape_term(text: str) -> set[str]:
    """Normalize a shape description to a set of canonical terms.

    Strips noise words, removes common suffixes (plurals), and returns
    the set of meaningful shape-related tokens.
    """
    # Lowercase and strip punctuation
    text = re.sub(r"[^a-z0-9\s]", "", text.lower().strip())
    tokens = text.split()

    result = set()
    for tok in tokens:
        if tok in _NOISE_WORDS:
            continue
        # Strip common English plural suffixes
        stem = tok
        if stem.endswith("s") and len(stem) > 3:
            stem = stem[:-1]
        if stem.endswith("es") and len(stem) > 4:
            stem = stem[:-2]
        result.add(stem)

    return result


class NeighborhoodService:
    def __init__(self) -> None:
        self._neighborhoods: list[Neighborhood] = self._load()

    def _load(self) -> list[Neighborhood]:
        path = _DATA_DIR / "prague_neighborhoods.json"
        if not path.exists():
            return []
        with open(path) as f:
            raw = json.load(f)
        return [self._parse(entry) for entry in raw]

    @staticmethod
    def _parse(entry: dict) -> Neighborhood:
        return Neighborhood(
            name=entry["name"],
            name_cs=entry["name_cs"],
            center=Coordinate(lng=entry["center"][0], lat=entry["center"][1]),
            bbox=BoundingBox(
                min_lng=entry["bbox"][0],
                min_lat=entry["bbox"][1],
                max_lng=entry["bbox"][2],
                max_lat=entry["bbox"][3],
            ),
            street_layout=entry["street_layout"],
            character=entry["character"],
            good_for=entry["good_for"],
        )

    def get_all(self) -> list[Neighborhood]:
        return self._neighborhoods

    def get_by_name(self, name: str) -> Optional[Neighborhood]:
        """Fuzzy lookup: strips diacritics and compares case-insensitively."""
        normalized = self._strip_diacritics(name.lower().strip())
        for hood in self._neighborhoods:
            if (
                self._strip_diacritics(hood.name.lower()) == normalized
                or self._strip_diacritics(hood.name_cs.lower()) == normalized
            ):
                return hood
        return None

    def find_best_for_shape(
        self, shape_type: str, size_km: float
    ) -> list[Neighborhood]:
        """Rank neighborhoods by suitability for a given shape type.

        Uses normalized term matching (handles plurals, noise words) and
        an explicit shape-to-layout preference map. Ties are broken by
        a hash of the neighborhood name to avoid list-order bias.
        """
        desc_terms = _normalize_shape_term(shape_type)

        scored: list[tuple[float, float, Neighborhood]] = []
        for hood in self._neighborhoods:
            score = 0.0

            # Term matching: compare normalized good_for tags vs description terms
            for good_raw in hood.good_for:
                good_terms = _normalize_shape_term(good_raw)
                overlap = desc_terms & good_terms
                if overlap:
                    score += 15.0 * len(overlap)

            # Layout preference based on explicit map
            preferred_layout = None
            for term in desc_terms:
                if term in _SHAPE_LAYOUT_PREFS:
                    preferred_layout = _SHAPE_LAYOUT_PREFS[term]
                    break

            if preferred_layout:
                if hood.street_layout == preferred_layout:
                    score += 8.0
                elif hood.street_layout == "mixed":
                    score += 4.0  # mixed is always decent

            # Check if neighborhood is large enough for the route
            bbox_diag_km = (
                (hood.bbox.width_deg() * 111.0) ** 2
                + (hood.bbox.height_deg() * 71.5) ** 2
            ) ** 0.5
            if bbox_diag_km >= size_km * 0.3:
                score += 3.0

            # Hash-based tiebreaker to avoid list-order bias
            tiebreaker = int(hashlib.md5(hood.name.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
            scored.append((score, tiebreaker, hood))

        scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return [hood for _, _, hood in scored]

    def get_summary_string(self) -> str:
        """Return a summary string of all neighborhoods for LLM context."""
        lines = []
        for h in self._neighborhoods:
            lines.append(
                f"- {h.name} ({h.street_layout} streets): {h.character}. "
                f"Good for: {', '.join(h.good_for)}"
            )
        return "\n".join(lines)

    def get_sorted_by_distance(self, center: Coordinate) -> list[Neighborhood]:
        """Return all neighborhoods sorted by haversine distance from the given center."""
        from services.street_mapper import haversine_distance_m

        scored = [(haversine_distance_m(center, n.center), n) for n in self._neighborhoods]
        scored.sort(key=lambda x: x[0])
        return [n for _, n in scored]

    @staticmethod
    def _strip_diacritics(text: str) -> str:
        import unicodedata

        nfkd = unicodedata.normalize("NFKD", text)
        return "".join(c for c in nfkd if not unicodedata.combining(c))


# World cities with seed neighborhoods for cross-city feasibility checks
WORLD_CITIES: dict[str, list[Neighborhood]] = {
    "Berlin": [
        Neighborhood(
            name="Kreuzberg", name_cs="Kreuzberg",
            center=Coordinate(lng=13.4050, lat=52.4990),
            bbox=BoundingBox(min_lng=13.385, min_lat=52.489, max_lng=13.425, max_lat=52.509),
            street_layout="grid", character="Dense urban grid with wide avenues",
            good_for=["geometric", "letters", "hearts"],
        ),
        Neighborhood(
            name="Tiergarten", name_cs="Tiergarten",
            center=Coordinate(lng=13.3500, lat=52.5145),
            bbox=BoundingBox(min_lng=13.330, min_lat=52.504, max_lng=13.370, max_lat=52.525),
            street_layout="organic", character="Park paths and tree-lined boulevards",
            good_for=["circles", "organic", "flowers"],
        ),
    ],
    "NYC": [
        Neighborhood(
            name="Midtown Manhattan", name_cs="Midtown Manhattan",
            center=Coordinate(lng=-73.9845, lat=40.7549),
            bbox=BoundingBox(min_lng=-74.004, min_lat=40.745, max_lng=-73.965, max_lat=40.765),
            street_layout="grid", character="Classic numbered grid, long avenues",
            good_for=["letters", "geometric", "arrows"],
        ),
        Neighborhood(
            name="Central Park", name_cs="Central Park",
            center=Coordinate(lng=-73.9665, lat=40.7829),
            bbox=BoundingBox(min_lng=-73.981, min_lat=40.764, max_lng=-73.949, max_lat=40.800),
            street_layout="organic", character="Winding park loops and meadow paths",
            good_for=["circles", "hearts", "organic"],
        ),
        Neighborhood(
            name="Brooklyn Heights", name_cs="Brooklyn Heights",
            center=Coordinate(lng=-73.9936, lat=40.6960),
            bbox=BoundingBox(min_lng=-74.003, min_lat=40.686, max_lng=-73.984, max_lat=40.706),
            street_layout="mixed", character="Tree-lined streets with waterfront promenade",
            good_for=["hearts", "stars", "geometric"],
        ),
    ],
    "London": [
        Neighborhood(
            name="Hyde Park", name_cs="Hyde Park",
            center=Coordinate(lng=-0.1657, lat=51.5073),
            bbox=BoundingBox(min_lng=-0.185, min_lat=51.497, max_lng=-0.146, max_lat=51.517),
            street_layout="organic", character="Royal park with serpentine paths",
            good_for=["circles", "hearts", "organic"],
        ),
        Neighborhood(
            name="Shoreditch", name_cs="Shoreditch",
            center=Coordinate(lng=-0.0774, lat=51.5265),
            bbox=BoundingBox(min_lng=-0.092, min_lat=51.517, max_lng=-0.063, max_lat=51.536),
            street_layout="mixed", character="Dense creative quarter with angled streets",
            good_for=["stars", "letters", "geometric"],
        ),
    ],
    "Barcelona": [
        Neighborhood(
            name="Eixample", name_cs="Eixample",
            center=Coordinate(lng=2.1634, lat=41.3918),
            bbox=BoundingBox(min_lng=2.143, min_lat=41.382, max_lng=2.183, max_lat=41.402),
            street_layout="grid", character="Iconic octagonal grid with chamfered blocks",
            good_for=["geometric", "letters", "squares"],
        ),
        Neighborhood(
            name="Parc de la Ciutadella", name_cs="Parc de la Ciutadella",
            center=Coordinate(lng=2.1870, lat=41.3879),
            bbox=BoundingBox(min_lng=2.177, min_lat=51.378, max_lng=2.197, max_lat=41.398),
            street_layout="organic", character="Large park with lake and winding paths",
            good_for=["circles", "hearts", "organic"],
        ),
    ],
    "Tokyo": [
        Neighborhood(
            name="Shibuya", name_cs="Shibuya",
            center=Coordinate(lng=139.7016, lat=35.6580),
            bbox=BoundingBox(min_lng=139.690, min_lat=35.648, max_lng=139.713, max_lat=35.668),
            street_layout="organic", character="Dense scramble area with narrow winding streets",
            good_for=["organic", "circles", "hearts"],
        ),
        Neighborhood(
            name="Chiyoda", name_cs="Chiyoda",
            center=Coordinate(lng=139.7530, lat=35.6938),
            bbox=BoundingBox(min_lng=139.740, min_lat=35.684, max_lng=139.766, max_lat=35.704),
            street_layout="mixed", character="Imperial palace moats and wide boulevards",
            good_for=["geometric", "squares", "circles"],
        ),
        Neighborhood(
            name="Shinjuku Gyoen", name_cs="Shinjuku Gyoen",
            center=Coordinate(lng=139.7100, lat=35.6852),
            bbox=BoundingBox(min_lng=139.700, min_lat=35.675, max_lng=139.720, max_lat=35.695),
            street_layout="organic", character="Garden park with formal and landscape paths",
            good_for=["hearts", "flowers", "organic"],
        ),
    ],
}
