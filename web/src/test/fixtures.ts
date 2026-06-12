/**
 * Shared test fixtures — a tiny but structurally complete art pipeline:
 * two glyph strokes joined by one connector, placed over Vinohrady.
 */
import type { ComposeResponse } from '../api';
import type { ArtPlan, ArtRoute, Placement, SolveResult } from '../types';

export const plan: ArtPlan = {
  strokes: [
    { points: [[0.1, 0.2], [0.3, 0.8]], kind: 'glyph', retrace: false },
    { points: [[0.6, 0.8], [0.9, 0.2]], kind: 'shape', retrace: false }
  ],
  order: [0, 1],
  continuous: [
    [0.1, 0.2],
    [0.3, 0.8],
    [0.6, 0.8],
    [0.9, 0.2]
  ],
  segments: [
    { kind: 'glyph', retrace: false, start_idx: 0, end_idx: 1 },
    { kind: 'connector', retrace: false, start_idx: 1, end_idx: 2 },
    { kind: 'shape', retrace: true, start_idx: 2, end_idx: 3 }
  ]
};

export const placement: Placement = {
  bbox: { min_lng: 14.43, min_lat: 50.07, max_lng: 14.45, max_lat: 50.08 },
  rotation_deg: 0,
  anchor: { lng: 14.44, lat: 50.075 }
};

export const solve: SolveResult = {
  coordinates: [
    [14.432, 50.072],
    [14.436, 50.078],
    [14.442, 50.078],
    [14.448, 50.072]
  ],
  segments: plan.segments,
  distance_km: 8.2,
  duration_min: 49,
  fidelity: 84,
  success: true
};

export const composeResponse: ComposeResponse = {
  intent: {
    texts: ['ANNA + TOM'],
    shapes: [{ name: 'heart' }],
    occasion: "valentine's day",
    area: 'Vinohrady',
    distance_km: 8,
    loop: true
  },
  plan,
  placement,
  preview_svg: undefined,
  diagnostics: [
    { level: 'warn', message: 'Heart lobes are near GPS jitter scale', action: 'scale up' }
  ]
};

export const artRoute: ArtRoute = {
  intent: composeResponse.intent,
  plan,
  placement,
  solve
};

export function movedPlacement(dLng: number): Placement {
  return {
    ...placement,
    bbox: {
      min_lng: placement.bbox.min_lng + dLng,
      min_lat: placement.bbox.min_lat,
      max_lng: placement.bbox.max_lng + dLng,
      max_lat: placement.bbox.max_lat
    },
    anchor: { lng: placement.anchor.lng + dLng, lat: placement.anchor.lat }
  };
}
