"""DSPy module definitions for shape generation with GLM-4.7."""

from __future__ import annotations

import json
import os
from typing import Optional

import dspy

from models.schemas import Coordinate


def configure_llm() -> Optional[dspy.LM]:
    """Configure DSPy with GLM-4.7 if API key is available."""
    api_key = os.environ.get("GLM_API_KEY")
    if not api_key:
        return None

    lm = dspy.LM(
        model="openai/glm-4-plus",
        api_key=api_key,
        api_base="https://open.bigmodel.cn/api/paas/v4/",
        timeout=10,
        num_retries=1,
    )
    dspy.configure(lm=lm)
    return lm


class GenerateShapeIdeas(dspy.Signature):
    """Given a Prague neighborhood, generate creative Strava art route ideas
    that can be traced by running on real streets. Each idea should be a
    recognizable shape (animal, object, letter, symbol) that fits within
    the neighborhood's street grid.

    Return a JSON array of objects, each with:
    - name: Creative name for the route
    - emoji: Single emoji representing the shape
    - description: One sentence describing the route
    - difficulty: "easy", "moderate", or "hard"
    - control_points: Array of [longitude, latitude] pairs forming the shape outline
      (use coordinates within the given bounding box, 8-20 points per shape)
    """

    neighborhood: str = dspy.InputField(desc="Prague neighborhood name")
    street_layout: str = dspy.InputField(desc="Street layout type: 'grid', 'organic', or 'mixed'")
    bbox: str = dspy.InputField(desc="Bounding box as 'min_lng,min_lat,max_lng,max_lat'")
    count: int = dspy.InputField(desc="Number of ideas to generate")

    ideas_json: str = dspy.OutputField(desc="JSON array of shape idea objects")


class DescriptionToShape(dspy.Signature):
    """Given a user's description of a desired Strava art shape, generate
    control points that form that shape. The points should be in [longitude, latitude]
    format and fit within the specified bounding box in Prague.

    Return a JSON object with:
    - name: Name for the route
    - emoji: Single emoji
    - control_points: Array of [longitude, latitude] pairs (8-20 points)
    """

    description: str = dspy.InputField(desc="User's description of desired shape")
    target_bbox: str = dspy.InputField(desc="Target area bounding box as 'min_lng,min_lat,max_lng,max_lat'")

    shape_json: str = dspy.OutputField(desc="JSON object with name, emoji, control_points")


class FindOptimalArea(dspy.Signature):
    """Given a shape description, determine the best Prague neighborhood
    where this shape could be drawn using real streets.

    Consider:
    - Grid neighborhoods (Vinohrady, Karlin) are better for geometric/letter shapes
    - Organic neighborhoods (Stare Mesto, Mala Strana) are better for creature/curved shapes
    - The shape size must fit within the neighborhood

    Return the neighborhood name (exactly as listed) and brief reasoning.
    """

    description: str = dspy.InputField(desc="Shape description from user")
    neighborhoods: str = dspy.InputField(desc="Available neighborhoods with their characteristics")

    best_neighborhood: str = dspy.OutputField(desc="Exact name of the best neighborhood")
    reasoning: str = dspy.OutputField(desc="Brief explanation of why this neighborhood fits")


def parse_ideas_json(raw: str) -> list[dict]:
    """Parse the LLM's ideas output, handling common JSON issues."""
    text = raw.strip()
    # Strip markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]") + 1
        if start >= 0 and end > start:
            data = json.loads(text[start:end])
        else:
            raise ValueError(f"Could not parse ideas JSON: {text[:200]}")

    if isinstance(data, dict) and "ideas" in data:
        data = data["ideas"]
    if not isinstance(data, list):
        raise ValueError(f"Expected list, got {type(data)}")
    return data


def parse_shape_json(raw: str) -> dict:
    """Parse the LLM's shape output."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            data = json.loads(text[start:end])
        else:
            raise ValueError(f"Could not parse shape JSON: {text[:200]}")
    return data


def coords_from_raw(raw_points: list) -> list[Coordinate]:
    """Convert [[lng, lat], ...] to list of Coordinate."""
    coords: list[Coordinate] = []
    for p in raw_points:
        if isinstance(p, (list, tuple)) and len(p) >= 2:
            coords.append(Coordinate(lng=float(p[0]), lat=float(p[1])))
        elif isinstance(p, dict):
            coords.append(Coordinate(lng=float(p.get("lng", p.get("longitude", 0))),
                                     lat=float(p.get("lat", p.get("latitude", 0)))))
    return coords
