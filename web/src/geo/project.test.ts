/**
 * project() geometry — golden values. The semantics MUST match the backend:
 * rotate about the unit-canvas center (0.5, 0.5), then linearly map into the
 * placement bbox (y up).
 */
import { describe, expect, it } from 'vitest';
import type { ArtPlan, BBox, Placement } from '../types';
import {
  bboxCenter,
  project,
  projectPoint,
  rotateUnit,
  scaleBBox,
  traceLengthKm,
  translateBBox,
  unitToLngLat
} from './project';

const bbox: BBox = { min_lng: 14.0, min_lat: 50.0, max_lng: 15.0, max_lat: 51.0 };

function placed(rotation_deg: number): Placement {
  return { bbox, rotation_deg, anchor: { lng: 14.5, lat: 50.5 } };
}

function planOf(points: [number, number][]): ArtPlan {
  return { strokes: [], order: [], continuous: points, segments: [] };
}

const SQ8 = Math.SQRT2 / 4; // |(0.5,0)| rotated 45° → component length

describe('rotateUnit', () => {
  it('is identity at 0°', () => {
    expect(rotateUnit([0.1, 0.9], 0)).toEqual([0.1, 0.9]);
  });

  it('rotates 90° CCW about (0.5, 0.5) — golden', () => {
    const [x, y] = rotateUnit([1, 0.5], 90);
    expect(x).toBeCloseTo(0.5, 12);
    expect(y).toBeCloseTo(1.0, 12);
  });

  it('rotates 180° about the center — golden', () => {
    const [x, y] = rotateUnit([0, 0], 180);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(1, 12);
  });

  it('rotates 45° — golden √2 values', () => {
    const [x, y] = rotateUnit([1, 0.5], 45);
    expect(x).toBeCloseTo(0.5 + SQ8, 12);
    expect(y).toBeCloseTo(0.5 + SQ8, 12);
  });

  it('the center is a fixed point for any angle', () => {
    const [x, y] = rotateUnit([0.5, 0.5], 137);
    expect(x).toBeCloseTo(0.5, 12);
    expect(y).toBeCloseTo(0.5, 12);
  });
});

describe('unitToLngLat — bbox mapping', () => {
  it('maps corners (y up: y=0 is south)', () => {
    expect(unitToLngLat([0, 0], bbox)).toEqual([14.0, 50.0]);
    expect(unitToLngLat([1, 1], bbox)).toEqual([15.0, 51.0]);
    expect(unitToLngLat([0, 1], bbox)).toEqual([14.0, 51.0]);
  });

  it('maps the center to the bbox center', () => {
    expect(unitToLngLat([0.5, 0.5], bbox)).toEqual([14.5, 50.5]);
  });
});

describe('project — rotation then linear map (backend semantics)', () => {
  it('0° — corners land on bbox corners', () => {
    const out = project(planOf([[0, 0], [1, 1]]), placed(0));
    expect(out).toEqual([
      [14.0, 50.0],
      [15.0, 51.0]
    ]);
  });

  it('90° CCW — golden: east midpoint goes to north midpoint', () => {
    const [[lng, lat]] = project(planOf([[1, 0.5]]), placed(90));
    expect(lng).toBeCloseTo(14.5, 9);
    expect(lat).toBeCloseTo(51.0, 9);
  });

  it('180° — golden: SW corner lands on NE corner', () => {
    const [[lng, lat]] = project(planOf([[0, 0]]), placed(180));
    expect(lng).toBeCloseTo(15.0, 9);
    expect(lat).toBeCloseTo(51.0, 9);
  });

  it('45° — golden √2 values', () => {
    const [lng, lat] = projectPoint([1, 0.5], placed(45));
    expect(lng).toBeCloseTo(14.5 + SQ8, 9);
    expect(lat).toBeCloseTo(50.5 + SQ8, 9);
  });

  it('rotation happens about the bbox center: center is invariant', () => {
    const [lng, lat] = projectPoint([0.5, 0.5], placed(63));
    expect(lng).toBeCloseTo(14.5, 12);
    expect(lat).toBeCloseTo(50.5, 12);
  });

  it('preserves point count and order', () => {
    const pts: [number, number][] = [
      [0, 0],
      [0.25, 0.5],
      [1, 1]
    ];
    expect(project(planOf(pts), placed(30))).toHaveLength(3);
  });
});

describe('bbox manipulation (gizmo math)', () => {
  it('bboxCenter', () => {
    expect(bboxCenter(bbox)).toEqual([14.5, 50.5]);
  });

  it('translateBBox shifts all edges', () => {
    expect(translateBBox(bbox, 0.1, -0.2)).toEqual({
      min_lng: 14.1,
      min_lat: 49.8,
      max_lng: 15.1,
      max_lat: 50.8
    });
  });

  it('scaleBBox scales about the center', () => {
    const out = scaleBBox(bbox, 0.5);
    expect(out.min_lng).toBeCloseTo(14.25, 12);
    expect(out.max_lng).toBeCloseTo(14.75, 12);
    expect(out.min_lat).toBeCloseTo(50.25, 12);
    expect(out.max_lat).toBeCloseTo(50.75, 12);
    expect(bboxCenter(out)[0]).toBeCloseTo(14.5, 12);
  });

  it('scaleBBox clamps against collapse', () => {
    const out = scaleBBox(bbox, 0);
    expect(out.max_lng - out.min_lng).toBeGreaterThan(0);
  });
});

describe('traceLengthKm', () => {
  it('one degree of latitude is ~111 km', () => {
    const km = traceLengthKm([
      [14.5, 50.0],
      [14.5, 51.0]
    ]);
    expect(km).toBeGreaterThan(108);
    expect(km).toBeLessThan(114);
  });

  it('degenerate traces have zero length', () => {
    expect(traceLengthKm([])).toBe(0);
    expect(traceLengthKm([[14.5, 50.0]])).toBe(0);
  });
});
