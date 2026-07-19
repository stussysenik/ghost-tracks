/**
 * Plan validation tests.
 *
 * These assert on `path` and issue *count*, not on message wording — the wording
 * is the easy half to accidentally test instead of the rule. Each case is chosen
 * so that deleting the rule it covers fails it and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { MAX_DISTANCE_KM, MAX_RUNS, MIN_DISTANCE_KM, validatePlanSpec } from './plan';
import type { PlanSpec } from '$types';

const ANCHOR = { lng: 14.42, lat: 50.08, label: 'Staré Město, Prague' };

const plan = (overrides: Partial<PlanSpec> = {}): PlanSpec => ({
	anchor: ANCHOR,
	runs: [{ theme: 'a fox' }],
	...overrides
});

const paths = (spec: PlanSpec) => validatePlanSpec(spec).map((i) => i.path);

describe('validatePlanSpec', () => {
	it('accepts a minimal plan: one anchored run, no targets', () => {
		expect(validatePlanSpec(plan())).toEqual([]);
	});

	it('accepts a run with every optional target set', () => {
		const spec = plan({
			runs: [
				{ theme: 'a fox', target_distance_km: 8, target_pace_min_per_km: 5.5, target_elevation_gain_m: 120 }
			]
		});
		expect(validatePlanSpec(spec)).toEqual([]);
	});

	describe('anchor', () => {
		it('requires an anchor', () => {
			expect(paths(plan({ anchor: undefined as never }))).toContain('anchor');
		});

		it('rejects an out-of-range coordinate', () => {
			expect(paths(plan({ anchor: { lng: 200, lat: 50, label: 'nowhere' } }))).toContain('anchor');
		});
	});

	describe('run count', () => {
		it('rejects an empty plan', () => {
			expect(paths(plan({ runs: [] }))).toEqual(['runs']);
		});

		it(`accepts exactly ${MAX_RUNS} runs`, () => {
			const runs = Array.from({ length: MAX_RUNS }, (_, i) => ({ theme: `run ${i}` }));
			expect(validatePlanSpec(plan({ runs }))).toEqual([]);
		});

		it(`rejects ${MAX_RUNS + 1} runs`, () => {
			const runs = Array.from({ length: MAX_RUNS + 1 }, (_, i) => ({ theme: `run ${i}` }));
			expect(paths(plan({ runs }))).toEqual(['runs']);
		});
	});

	describe('theme', () => {
		it('rejects an empty theme', () => {
			expect(paths(plan({ runs: [{ theme: '' }] }))).toEqual(['runs[0].theme']);
		});

		it('rejects a whitespace-only theme', () => {
			expect(paths(plan({ runs: [{ theme: '   ' }] }))).toEqual(['runs[0].theme']);
		});
	});

	describe('distance target', () => {
		// The central rule: an absent target is valid and must stay absent. If this
		// ever became "default to something", the distance badge would grade a
		// promise the user never made.
		it('treats an omitted distance as valid, not as a missing field', () => {
			expect(validatePlanSpec(plan({ runs: [{ theme: 'a fox' }] }))).toEqual([]);
		});

		it('rejects a distance below the band rather than clamping it up', () => {
			const spec = plan({ runs: [{ theme: 'a fox', target_distance_km: MIN_DISTANCE_KM - 0.5 }] });
			expect(paths(spec)).toEqual(['runs[0].target_distance_km']);
		});

		it('rejects a distance above the band rather than clamping it down', () => {
			const spec = plan({ runs: [{ theme: 'a fox', target_distance_km: MAX_DISTANCE_KM + 1 }] });
			expect(paths(spec)).toEqual(['runs[0].target_distance_km']);
		});

		it('accepts both band edges', () => {
			const spec = plan({
				runs: [
					{ theme: 'short', target_distance_km: MIN_DISTANCE_KM },
					{ theme: 'long', target_distance_km: MAX_DISTANCE_KM }
				]
			});
			expect(validatePlanSpec(spec)).toEqual([]);
		});

		// This validator runs on untrusted JSON, where the `number` in the type is a
		// claim and not a fact. A bare band check would accept `"5"` outright, since
		// JS coerces it — so the type guard is load-bearing, not defensive padding.
		// (NaN needs no guard: `NaN >= MIN` is already false.)
		it('rejects a numeric string, which coercion would otherwise let through', () => {
			const spec = plan({ runs: [{ theme: 'a fox', target_distance_km: '5' as never }] });
			expect(paths(spec)).toEqual(['runs[0].target_distance_km']);
		});
	});

	describe('pace and elevation', () => {
		it('rejects a pace faster than any human runs', () => {
			const spec = plan({ runs: [{ theme: 'a fox', target_pace_min_per_km: 0.5 }] });
			expect(paths(spec)).toEqual(['runs[0].target_pace_min_per_km']);
		});

		it('accepts a flat run: zero elevation gain is a target, not an absence', () => {
			const spec = plan({ runs: [{ theme: 'a fox', target_elevation_gain_m: 0 }] });
			expect(validatePlanSpec(spec)).toEqual([]);
		});

		it('rejects negative elevation gain', () => {
			const spec = plan({ runs: [{ theme: 'a fox', target_elevation_gain_m: -10 }] });
			expect(paths(spec)).toEqual(['runs[0].target_elevation_gain_m']);
		});
	});

	describe('reporting', () => {
		// A seven-row form fixed one error per round-trip is seven round-trips.
		it('reports every issue at once, not just the first', () => {
			const spec = plan({
				anchor: undefined as never,
				runs: [{ theme: '' }, { theme: 'a fox', target_distance_km: 99 }]
			});
			expect(paths(spec)).toEqual(['anchor', 'runs[0].theme', 'runs[1].target_distance_km']);
		});

		it('points at the offending run by index, not just the field', () => {
			const spec = plan({
				runs: [{ theme: 'ok' }, { theme: 'ok' }, { theme: 'ok', target_pace_min_per_km: 99 }]
			});
			expect(paths(spec)).toEqual(['runs[2].target_pace_min_per_km']);
		});
	});
});
