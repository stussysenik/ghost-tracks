/**
 * GPX generation — valid XML and the load-bearing lat/lng swap:
 * wire format is [lng, lat]; GPX trkpt wants lat= lon= attributes.
 */
import { describe, expect, it } from 'vitest';
import type { LngLat } from '../types';
import { generateGPX, gpxFilename } from './gpx';

const coords: LngLat[] = [
  [14.4378, 50.0755], // [lng, lat] — Prague
  [14.45, 50.08]
];

describe('generateGPX', () => {
  it('produces well-formed XML with a gpx root and one track', () => {
    const xml = generateGPX(coords, 'ANNA + TOM');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');

    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.tagName).toBe('gpx');
    expect(doc.querySelectorAll('trk')).toHaveLength(1);
    expect(doc.querySelector('trk name')?.textContent).toBe('ANNA + TOM');
    expect(doc.querySelectorAll('trkseg')).toHaveLength(1);
    expect(doc.querySelectorAll('trkpt')).toHaveLength(2);
  });

  it('swaps [lng, lat] wire order into lat=/lon= attributes', () => {
    const xml = generateGPX(coords, 'swap check');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const pt = doc.querySelector('trkpt')!;

    // latitude must be the 50.x value, longitude the 14.x value
    expect(Number(pt.getAttribute('lat'))).toBeCloseTo(50.0755, 6);
    expect(Number(pt.getAttribute('lon'))).toBeCloseTo(14.4378, 6);
  });

  it('keeps point order', () => {
    const xml = generateGPX(coords, 'order');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const pts = [...doc.querySelectorAll('trkpt')];
    expect(Number(pts[1].getAttribute('lat'))).toBeCloseTo(50.08, 6);
  });
});

describe('gpxFilename', () => {
  it('slugs to ghost-tracks-<slug>.gpx', () => {
    expect(gpxFilename('ANNA + TOM ❤')).toBe('ghost-tracks-anna-tom.gpx');
  });

  it('collapses whitespace and special characters', () => {
    expect(gpxFilename("  MARRY ME?!  über alles ")).toBe('ghost-tracks-marry-me-ber-alles.gpx');
  });

  it('falls back when nothing survives', () => {
    expect(gpxFilename('❤❤❤')).toBe('ghost-tracks-route.gpx');
  });

  it('caps slug length at 50', () => {
    const name = 'x'.repeat(120);
    expect(gpxFilename(name).length).toBeLessThanOrEqual('ghost-tracks-'.length + 50 + 4);
  });
});
