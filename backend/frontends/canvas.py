"""Unit-canvas geometry helpers shared by all frontends.

LESSON — why a unit canvas?
===========================
Every frontend emits strokes in an abstract [0,1]×[0,1] space (y up).
Physical meaning (meters, streets, GPS) is attached *later* by Placement +
projection. Keeping design space dimensionless means frontends compose
freely: text and shapes are just rectangles of strokes to be arranged,
exactly like laying out a print page before choosing the paper size.
"""

from __future__ import annotations

from models.ir import Stroke, StrokeSet

Bounds = tuple[float, float, float, float]  # (min_x, min_y, max_x, max_y)


def stroke_bounds(strokes: list[Stroke]) -> Bounds:
    """Axis-aligned bounds over every point of every stroke."""
    xs = [p[0] for s in strokes for p in s.points]
    ys = [p[1] for s in strokes for p in s.points]
    if not xs:
        return (0.0, 0.0, 0.0, 0.0)
    return (min(xs), min(ys), max(xs), max(ys))


def fit_into(strokes: list[Stroke], box: Bounds) -> list[Stroke]:
    """Uniformly scale + center strokes into ``box``, preserving aspect.

    Aspect preservation matters: unit space is isotropic by convention, so a
    heart squeezed to fit a wide cell would project as a squeezed heart on
    the streets. We letterbox instead, like ``object-fit: contain``.
    """
    min_x, min_y, max_x, max_y = stroke_bounds(strokes)
    src_w = max_x - min_x or 1e-9
    src_h = max_y - min_y or 1e-9
    bx0, by0, bx1, by1 = box
    dst_w, dst_h = bx1 - bx0, by1 - by0
    scale = min(dst_w / src_w, dst_h / src_h)
    # Center the letterboxed content inside the box.
    off_x = bx0 + (dst_w - src_w * scale) / 2 - min_x * scale
    off_y = by0 + (dst_h - src_h * scale) / 2 - min_y * scale
    return [
        Stroke(
            points=[[p[0] * scale + off_x, p[1] * scale + off_y] for p in s.points],
            kind=s.kind,
            retrace=s.retrace,
        )
        for s in strokes
    ]


def normalize_unit(strokes: list[Stroke]) -> list[Stroke]:
    """Fit strokes into the full unit canvas [0,1]×[0,1]."""
    return fit_into(strokes, (0.0, 0.0, 1.0, 1.0))


def merge_canvas(
    text_sets: list[StrokeSet],
    shape_sets: list[StrokeSet],
) -> StrokeSet:
    """Arrange frontend outputs on one composition canvas.

    Layout policy (a tiny typesetter): each text is a horizontal *row*;
    all shapes share one row, placed side by side. Text rows sit ABOVE the
    shape row — names over the heart, like a greeting card. Rows get
    vertical space by weight (shapes deserve more height than a text line),
    separated by a small gutter.
    """
    rows: list[tuple[list[Stroke], float]] = []  # (strokes, weight)
    for ts in text_sets:
        if ts.strokes:
            rows.append((ts.strokes, 1.0))

    shape_row: list[Stroke] = []
    shapes = [ss for ss in shape_sets if ss.strokes]
    if shapes:
        # Side-by-side cells with a small gap between shapes.
        n = len(shapes)
        gap = 0.04 if n > 1 else 0.0
        cell_w = (1.0 - gap * (n - 1)) / n
        for i, ss in enumerate(shapes):
            x0 = i * (cell_w + gap)
            shape_row.extend(fit_into(ss.strokes, (x0, 0.0, x0 + cell_w, 1.0)))
        rows.append((shape_row, 2.0))

    if not rows:
        return StrokeSet(strokes=[])
    if len(rows) == 1:
        return StrokeSet(strokes=normalize_unit(rows[0][0]))

    gutter = 0.06
    usable = 1.0 - gutter * (len(rows) - 1)
    total_w = sum(w for _, w in rows)
    merged: list[Stroke] = []
    y_top = 1.0  # rows are laid top-down; unit y points up
    for strokes, weight in rows:
        band_h = usable * weight / total_w
        merged.extend(fit_into(strokes, (0.0, y_top - band_h, 1.0, y_top)))
        y_top -= band_h + gutter
    return StrokeSet(strokes=normalize_unit(merged))
