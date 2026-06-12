"""Preview: ArtPlan → SVG string for the composition card.

LESSON — show the connector strategy, don't hide it
===================================================
The preview's job is honesty: the user must see what the run will actually
trace. Real ink (glyphs/shapes) renders solid; connectors render dashed in
a muted tone; retraced segments get their own dashed accent so the user can
tell "free" retraced ink from visible connector ink.

Unit space has y pointing UP (math convention); SVG's y points DOWN, so we
flip with ``y_svg = 1 - y`` at render time — the IR never bends to a
renderer's convention.
"""

from __future__ import annotations

from models.ir import ArtPlan, Stroke

_INK_COLOR = "#16161a"
_CONNECTOR_COLOR = "#9a8c98"
_RETRACE_COLOR = "#e07a5f"


def _polyline(stroke: Stroke) -> str:
    points = " ".join(f"{p[0]:.4f},{1.0 - p[1]:.4f}" for p in stroke.points)
    if stroke.retrace:
        style = (
            f'stroke="{_RETRACE_COLOR}" stroke-width="0.008" '
            'stroke-dasharray="0.006 0.012"'
        )
    elif stroke.kind == "connector":
        style = (
            f'stroke="{_CONNECTOR_COLOR}" stroke-width="0.008" '
            'stroke-dasharray="0.02 0.015"'
        )
    else:
        style = f'stroke="{_INK_COLOR}" stroke-width="0.012"'
    return (
        f'  <polyline points="{points}" fill="none" {style} '
        'stroke-linecap="round" stroke-linejoin="round" />'
    )


def render_svg(plan: ArtPlan, size: int = 480) -> str:
    """Render the composed plan to a standalone SVG document string.

    The viewBox IS the unit canvas, so frontend code can overlay the same
    coordinates (control points, hit targets) without any transform math.
    """
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        'viewBox="0 0 1 1">',
    ]
    lines.extend(_polyline(s) for s in plan.strokes if len(s.points) >= 2)
    lines.append("</svg>")
    return "\n".join(lines)
