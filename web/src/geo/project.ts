/**
 * project(plan, placement) — unit-space artwork → geographic trace.
 *
 * MUST match the backend's projection semantics exactly (SPEC §6.3):
 *   1. rotate each unit point about the unit-canvas center (0.5, 0.5)
 *      by `rotation_deg` (counter-clockwise positive),
 *   2. linearly map x → [min_lng, max_lng], y → [min_lat, max_lat]
 *      (y up: y=0 is the south edge).
 *
 * Rotation happens in unit space *before* the anisotropic lng/lat map —
 * which is equivalent to "rotate about bbox center, then linear map".
 */
import { length as turfLength, lineString } from '@turf/turf';
import type { ArtPlan, BBox, LngLat, Placement, UnitPoint } from '../types';

/** Rotate a unit point about (0.5, 0.5) by `deg` counter-clockwise. */
export function rotateUnit([x, y]: UnitPoint, deg: number): UnitPoint {
  if (deg === 0) return [x, y];
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - 0.5;
  const dy = y - 0.5;
  return [0.5 + dx * cos - dy * sin, 0.5 + dx * sin + dy * cos];
}

/** Linear map of a (possibly rotated) unit point into a geographic bbox. */
export function unitToLngLat([x, y]: UnitPoint, bbox: BBox): LngLat {
  return [
    bbox.min_lng + x * (bbox.max_lng - bbox.min_lng),
    bbox.min_lat + y * (bbox.max_lat - bbox.min_lat)
  ];
}

/** Project one unit point through a full Placement. */
export function projectPoint(p: UnitPoint, placement: Placement): LngLat {
  return unitToLngLat(rotateUnit(p, placement.rotation_deg), placement.bbox);
}

/** Project the plan's continuous polyline through the placement. */
export function project(plan: ArtPlan, placement: Placement): LngLat[] {
  return plan.continuous.map((p) => projectPoint(p, placement));
}

/** Geographic center of a placement bbox. */
export function bboxCenter(bbox: BBox): LngLat {
  return [(bbox.min_lng + bbox.max_lng) / 2, (bbox.min_lat + bbox.max_lat) / 2];
}

/** Translate a bbox by a lng/lat delta (gizmo drag). */
export function translateBBox(bbox: BBox, dLng: number, dLat: number): BBox {
  return {
    min_lng: bbox.min_lng + dLng,
    min_lat: bbox.min_lat + dLat,
    max_lng: bbox.max_lng + dLng,
    max_lat: bbox.max_lat + dLat
  };
}

/** Scale a bbox about its center (gizmo corner handles). Clamped > 0. */
export function scaleBBox(bbox: BBox, factor: number): BBox {
  const f = Math.max(0.05, factor);
  const [cx, cy] = bboxCenter(bbox);
  const hw = ((bbox.max_lng - bbox.min_lng) / 2) * f;
  const hh = ((bbox.max_lat - bbox.min_lat) / 2) * f;
  return {
    min_lng: cx - hw,
    min_lat: cy - hh,
    max_lng: cx + hw,
    max_lat: cy + hh
  };
}

/** Length of a geographic trace in km (preview "ink" estimate). */
export function traceLengthKm(coords: LngLat[]): number {
  if (coords.length < 2) return 0;
  return turfLength(lineString(coords), { units: 'kilometers' });
}
