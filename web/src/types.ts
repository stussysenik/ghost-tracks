/**
 * Ghost Tracks — shared wire types (SPEC §6.3).
 *
 * These mirror the Python (pydantic) and Scala (case class) definitions
 * EXACTLY — field names are snake_case because they cross runtimes as JSON.
 * State everywhere is a pure function of (Plan, Placement, SolveResult).
 */

/** A point in unit canvas space, components in 0..1. `[x, y]`. */
export type UnitPoint = [number, number];

/** A geographic coordinate, `[lng, lat]` (GeoJSON order). */
export type LngLat = [number, number];

/** Segment provenance — what a slice of the continuous line *means*. */
export type StrokeKind = 'glyph' | 'shape' | 'connector';

/** One stroke of the StrokeSet IR (the only format downstream sees). */
export interface Stroke {
  points: UnitPoint[];
  kind: StrokeKind;
  /** Retraced segments visually disappear when the route is run. */
  retrace: boolean;
}

/** Metadata for a slice of `ArtPlan.continuous` / `SolveResult.coordinates`. */
export interface SegmentMeta {
  kind: StrokeKind;
  retrace: boolean;
  start_idx: number;
  end_idx: number;
}

/** Composed artwork: ordered strokes joined into ONE continuous line. */
export interface ArtPlan {
  strokes: Stroke[];
  order: number[];
  continuous: UnitPoint[];
  segments: SegmentMeta[];
}

/** Parsed natural-language intent. */
export interface Intent {
  texts: string[];
  shapes: { name: string }[];
  occasion?: string | null;
  area?: string | null;
  distance_km?: number | null;
  loop: boolean;
}

/** Geographic bounding box for placement. */
export interface BBox {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
}

/** Where (and how rotated) the unit-space artwork lands on the city. */
export interface Placement {
  bbox: BBox;
  rotation_deg: number;
  anchor: { lng: number; lat: number };
}

/** Street-snapped solve result from the Scala GeoKernel. */
export interface SolveResult {
  coordinates: LngLat[];
  segments: SegmentMeta[];
  distance_km: number;
  duration_min: number;
  /** Blended fidelity score 0..100 — the product's hero metric. */
  fidelity: number;
  success: boolean;
  error?: string;
}

/** The full describable→runnable artifact. */
export interface ArtRoute {
  intent: Intent;
  plan: ArtPlan;
  placement: Placement;
  solve: SolveResult;
  gpx_url?: string;
  share_id?: string;
}

/** Actionable diagnostic chip from the Normalizer / validator (SPEC §6.2). */
export interface Diagnostic {
  level: 'info' | 'warn' | 'error';
  message: string;
  /** Design knob the user can turn: scale up · reduce detail · move area … */
  action?: string;
}
