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

    @staticmethod
    def _strip_diacritics(text: str) -> str:
        import unicodedata

        nfkd = unicodedata.normalize("NFKD", text)
        return "".join(c for c in nfkd if not unicodedata.combining(c))
