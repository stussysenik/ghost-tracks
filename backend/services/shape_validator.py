"""Shape validation using blended algorithmic scoring and optional vision model."""

from __future__ import annotations

import base64
import io
import math
import os
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw

from models.schemas import Coordinate, ValidationResult

VALIDATION_THRESHOLD = int(os.environ.get("SHAPE_VALIDATION_THRESHOLD", "45"))


def _compute_shared_bbox(
    points_a: list[Coordinate],
    points_b: list[Coordinate],
    padding_pct: float = 0.1,
) -> tuple[float, float, float, float]:
    """Compute a shared bounding box for two point sets."""
    all_lngs = [p.lng for p in points_a] + [p.lng for p in points_b]
    all_lats = [p.lat for p in points_a] + [p.lat for p in points_b]
    min_lng, max_lng = min(all_lngs), max(all_lngs)
    min_lat, max_lat = min(all_lats), max(all_lats)
    w = max_lng - min_lng or 1e-6
    h = max_lat - min_lat or 1e-6
    return (
        min_lng - w * padding_pct,
        min_lat - h * padding_pct,
        max_lng + w * padding_pct,
        max_lat + h * padding_pct,
    )


def rasterize_route(
    coords: list[Coordinate],
    bbox: tuple[float, float, float, float],
    size: int = 512,
    line_width: int = 4,
) -> Image.Image:
    """Rasterize a route to a binary PIL Image."""
    img = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(img)

    min_lng, min_lat, max_lng, max_lat = bbox
    w = max_lng - min_lng
    h = max_lat - min_lat

    def to_pixel(c: Coordinate) -> tuple[int, int]:
        x = int((c.lng - min_lng) / w * (size - 1))
        y = int((max_lat - c.lat) / h * (size - 1))  # flip Y
        return (x, y)

    pixels = [to_pixel(c) for c in coords]
    if len(pixels) >= 2:
        draw.line(pixels, fill=255, width=line_width)

    return img


def hausdorff_distance(
    points_a: list[Coordinate],
    points_b: list[Coordinate],
) -> float:
    """Compute Hausdorff distance between two point sets in meters."""
    from services.street_mapper import haversine_distance_m

    def directed_hd(src: list[Coordinate], tgt: list[Coordinate]) -> float:
        max_min = 0.0
        for s in src:
            min_d = min(haversine_distance_m(s, t) for t in tgt)
            max_min = max(max_min, min_d)
        return max_min

    return max(directed_hd(points_a, points_b), directed_hd(points_b, points_a))


def _modified_hausdorff_distance(
    points_a: list[Coordinate],
    points_b: list[Coordinate],
    percentile: float = 90.0,
) -> float:
    """Modified Hausdorff using the Nth-percentile instead of max.

    This is robust to single-point outliers from Mapbox routing quirks.
    """
    from services.street_mapper import haversine_distance_m

    def directed_distances(src: list[Coordinate], tgt: list[Coordinate]) -> list[float]:
        return [min(haversine_distance_m(s, t) for t in tgt) for s in src]

    d_ab = directed_distances(points_a, points_b)
    d_ba = directed_distances(points_b, points_a)
    all_dists = d_ab + d_ba
    return float(np.percentile(all_dists, percentile))


def _resample_curve(points: list[Coordinate], n: int) -> list[Coordinate]:
    """Resample a polyline to exactly n equally-spaced points."""
    from services.street_mapper import haversine_distance_m

    if len(points) < 2 or n < 2:
        return points[:n] if len(points) >= n else points

    # Compute cumulative arc-length
    cumlen = [0.0]
    for i in range(1, len(points)):
        cumlen.append(cumlen[-1] + haversine_distance_m(points[i - 1], points[i]))
    total = cumlen[-1]
    if total == 0:
        return [points[0]] * n

    result: list[Coordinate] = []
    for k in range(n):
        target_len = total * k / (n - 1)
        # Find the segment containing this arc length
        for i in range(1, len(cumlen)):
            if cumlen[i] >= target_len:
                seg_len = cumlen[i] - cumlen[i - 1]
                if seg_len == 0:
                    frac = 0.0
                else:
                    frac = (target_len - cumlen[i - 1]) / seg_len
                result.append(Coordinate(
                    lng=points[i - 1].lng + (points[i].lng - points[i - 1].lng) * frac,
                    lat=points[i - 1].lat + (points[i].lat - points[i - 1].lat) * frac,
                ))
                break
    return result


def _ordered_sampling_score(
    target: list[Coordinate],
    actual: list[Coordinate],
    n_samples: int = 50,
) -> float:
    """Score based on mean distance between corresponding resampled points.

    Returns a score in [0, 100] — lower mean distance → higher score.
    """
    from services.street_mapper import haversine_distance_m

    t_resampled = _resample_curve(target, n_samples)
    a_resampled = _resample_curve(actual, n_samples)

    if not t_resampled or not a_resampled:
        return 0.0

    dists = [haversine_distance_m(t, a) for t, a in zip(t_resampled, a_resampled)]
    mean_dist = sum(dists) / len(dists)

    # Compute target diameter for normalization
    diameter = _compute_diameter(target)
    if diameter == 0:
        return 0.0

    normalized = min(mean_dist / diameter, 1.0)
    return round((1.0 - normalized) * 100)


def _raster_iou_score(
    target: list[Coordinate],
    actual: list[Coordinate],
    size: int = 128,
    line_width: int = 8,
) -> float:
    """Raster intersection-over-union score.

    Rasterizes both shapes with thick lines and computes pixel IoU.
    Returns a score in [0, 100].
    """
    bbox = _compute_shared_bbox(target, actual)

    img_t = rasterize_route(target, bbox, size=size, line_width=line_width)
    img_a = rasterize_route(actual, bbox, size=size, line_width=line_width)

    arr_t = np.array(img_t) > 0
    arr_a = np.array(img_a) > 0

    intersection = np.logical_and(arr_t, arr_a).sum()
    union = np.logical_or(arr_t, arr_a).sum()

    if union == 0:
        return 0.0

    return round(float(intersection / union) * 100)


def _compute_diameter(points: list[Coordinate]) -> float:
    """Compute the approximate diameter of a point set in meters.

    Samples pairs for efficiency on large sets.
    """
    from services.street_mapper import haversine_distance_m

    if len(points) < 2:
        return 0.0

    max_dist = 0.0
    n = len(points)

    if n <= 60:
        # Small enough to check all pairs
        for i in range(n):
            for j in range(i + 1, n):
                d = haversine_distance_m(points[i], points[j])
                if d > max_dist:
                    max_dist = d
    else:
        # Sample: check every point against 50 random others
        import random
        rng = random.Random(42)  # deterministic for reproducibility
        for i in range(n):
            samples = rng.sample(range(n), min(50, n))
            for j in samples:
                if i != j:
                    d = haversine_distance_m(points[i], points[j])
                    if d > max_dist:
                        max_dist = d

    return max_dist


class ShapeValidator:
    """Validates that generated routes resemble their target shapes."""

    def __init__(self) -> None:
        self._glm_api_key: Optional[str] = os.environ.get("GLM_API_KEY")

    async def validate(
        self,
        target_description: str,
        target_points: list[Coordinate],
        actual_points: list[Coordinate],
        threshold: int = VALIDATION_THRESHOLD,
    ) -> ValidationResult:
        """Validate shape similarity. Tries vision model first, falls back to algorithmic."""
        # Try GLM-4.6v vision validation
        if self._glm_api_key:
            try:
                return await self._validate_with_vision(
                    target_description, target_points, actual_points, threshold
                )
            except Exception:
                pass  # fall through to algorithmic

        # Algorithmic fallback (blended scoring)
        return self._validate_algorithmic(target_points, actual_points, threshold)

    async def _validate_with_vision(
        self,
        description: str,
        target_points: list[Coordinate],
        actual_points: list[Coordinate],
        threshold: int,
    ) -> ValidationResult:
        """Use GLM-4.6v to visually assess shape similarity."""
        from zhipuai import ZhipuAI

        bbox = _compute_shared_bbox(target_points, actual_points)

        # Rasterize the routed result
        img = rasterize_route(actual_points, bbox, size=512, line_width=6)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        client = ZhipuAI(api_key=self._glm_api_key)
        response = client.chat.completions.create(
            model="glm-4v",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{img_b64}"},
                        },
                        {
                            "type": "text",
                            "text": (
                                f"This is a running route drawn on a map as white lines on a "
                                f"black background. The intended shape is: '{description}'. "
                                f"Rate how well this route resembles the intended shape on a "
                                f"scale of 0 to 100 (100 = perfect match). "
                                f"Respond with ONLY a JSON object: "
                                f'{{"score": <number>, "reasoning": "<brief explanation>"}}'
                            ),
                        },
                    ],
                }
            ],
        )

        import json

        text = response.choices[0].message.content.strip()
        # Try to extract JSON from the response
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(text[start:end])
            else:
                raise ValueError(f"Could not parse vision model response: {text}")

        score = float(data.get("score", 0))
        reasoning = data.get("reasoning", "")

        return ValidationResult(
            score=score,
            passed=score >= threshold,
            method="glm-4v",
            reasoning=reasoning,
        )

    def _validate_algorithmic(
        self,
        target_points: list[Coordinate],
        actual_points: list[Coordinate],
        threshold: int,
    ) -> ValidationResult:
        """Blended algorithmic validation using three components:

        1. Modified Hausdorff (50%): 90th-percentile directed distance
        2. Ordered sampling (30%): mean distance between resampled pairs
        3. Raster IoU (20%): pixel intersection-over-union

        This is much more robust than raw Hausdorff, which is sensitive to
        single outlier points from Mapbox routing detours.
        """
        if not target_points or not actual_points:
            return ValidationResult(
                score=0, passed=False, method="algorithmic", reasoning="Empty point set"
            )

        diameter = _compute_diameter(target_points)
        if diameter == 0:
            return ValidationResult(
                score=0, passed=False, method="algorithmic", reasoning="Degenerate shape"
            )

        # Component 1: Modified Hausdorff (90th percentile) → score
        mhd = _modified_hausdorff_distance(target_points, actual_points, percentile=90)
        mhd_norm = min(mhd / diameter, 1.0)
        mhd_score = (1.0 - mhd_norm) * 100

        # Component 2: Ordered sampling score
        os_score = _ordered_sampling_score(target_points, actual_points, n_samples=50)

        # Component 3: Raster IoU score (thick lines for tolerance)
        iou_score = _raster_iou_score(target_points, actual_points, size=128, line_width=12)

        # Blend: 55% modified Hausdorff, 35% ordered sampling, 10% raster IoU
        # IoU is downweighted because street routing inherently distorts smooth curves
        blended = 0.55 * mhd_score + 0.35 * os_score + 0.10 * iou_score
        score = round(blended)

        reasoning = (
            f"Blended (.55/.35/.10): mHD={mhd_score:.0f} ({mhd:.0f}m), "
            f"ordered={os_score:.0f}, IoU={iou_score:.0f}, "
            f"diameter={diameter:.0f}m"
        )

        return ValidationResult(
            score=score,
            passed=score >= threshold,
            method="algorithmic",
            reasoning=reasoning,
        )
