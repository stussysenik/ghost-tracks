/**
 * GPX export — ported from the legacy Svelte service (src/lib/services/gpx.ts).
 *
 * GPX is the universal interchange: Strava (web import, subscription),
 * Garmin Connect, Komoot all accept it. gpx-builder's Point takes
 * (lat, lng) — our wire format is [lng, lat] — so the swap here is
 * load-bearing and unit-tested.
 */
import { buildGPX, BaseBuilder } from 'gpx-builder';
import type { LngLat } from '../types';

const { Point, Segment, Track } = BaseBuilder.MODELS;

/** Build a GPX 1.1 document string from route coordinates. */
export function generateGPX(coordinates: LngLat[], name: string): string {
  const points = coordinates.map(([lng, lat]) => new Point(lat, lng));
  const track = new Track([new Segment(points)], { name });
  const builder = new BaseBuilder();
  builder.setTracks([track]);
  return buildGPX(builder.toObject());
}

/** ghost-tracks-<slug>.gpx — safe, lowercase, hyphenated. */
export function gpxFilename(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50) || 'route';
  return `ghost-tracks-${slug}.gpx`;
}

/** Trigger a browser download of the GPX document. */
export function downloadGPX(coordinates: LngLat[], name: string): void {
  const xml = generateGPX(coordinates, name);
  const blob = new Blob([xml], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = gpxFilename(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
