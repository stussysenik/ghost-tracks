/**
 * Slice a coordinate trace into per-segment GeoJSON features so the map can
 * color by provenance: ink (glyph/shape) vs connector vs retrace.
 */
import type { Feature, FeatureCollection, LineString } from 'geojson';
import type { LngLat, SegmentMeta } from '../types';

export type SegmentClass = 'ink' | 'connector' | 'retrace';

export function classifySegment(seg: Pick<SegmentMeta, 'kind' | 'retrace'>): SegmentClass {
  if (seg.retrace) return 'retrace';
  if (seg.kind === 'connector') return 'connector';
  return 'ink';
}

export function segmentsToFeatureCollection(
  coords: LngLat[],
  segments: SegmentMeta[]
): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];

  if (segments.length === 0 && coords.length >= 2) {
    // No provenance — render the whole trace as ink.
    features.push({
      type: 'Feature',
      properties: { class: 'ink' },
      geometry: { type: 'LineString', coordinates: coords }
    });
  }

  for (const seg of segments) {
    // end_idx is inclusive; share the boundary vertex so lines stay joined.
    const slice = coords.slice(seg.start_idx, seg.end_idx + 1);
    if (slice.length < 2) continue;
    features.push({
      type: 'Feature',
      properties: { class: classifySegment(seg) },
      geometry: { type: 'LineString', coordinates: slice }
    });
  }

  return { type: 'FeatureCollection', features };
}
