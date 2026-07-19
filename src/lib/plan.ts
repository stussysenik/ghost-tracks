/**
 * Plan validation.
 *
 * Pure on purpose, for the same reason `route-contract.ts` is: this decides what
 * the planner will *accept*, which is the part that can be wrong rather than
 * merely ugly. Routing a plan is expensive — up to `MAX_RUNS` backend calls — so
 * rejecting a bad spec here is also the difference between a fast 400 and seven
 * slow round-trips that were never going to work.
 *
 * Shape-per-run means there is no cross-run geometric invariant to check. Every
 * rule below is either structural (order, anchor, size) or per-run.
 */
import type { PlanIssue, PlanRunSpec, PlanSpec } from '$types';

/** A week view (5.3) has seven days, so a plan has at most seven runs. */
export const MAX_RUNS = 7;

/** The backend clamps requested distance to this band; we reject instead. */
export const MIN_DISTANCE_KM = 1;
export const MAX_DISTANCE_KM = 30;

/** Slowest and fastest pace worth accepting, in minutes per km. */
const MIN_PACE = 2;
const MAX_PACE = 20;

/** Beyond this, the climb is not a target, it is a typo. */
const MAX_ELEVATION_GAIN_M = 5000;

function validateRun(run: PlanRunSpec, at: string): PlanIssue[] {
	const issues: PlanIssue[] = [];

	if (typeof run.theme !== 'string' || run.theme.trim() === '') {
		issues.push({ path: `${at}.theme`, message: 'Every run needs a theme to draw.' });
	}

	// Each optional target is rejected out of band rather than clamped. Clamping
	// would hand back a route graded against a target the user never asked for —
	// the same dishonesty the distance badge refuses when no target was given.
	const { target_distance_km: km, target_pace_min_per_km: pace, target_elevation_gain_m: gain } = run;

	if (km !== undefined && !(Number.isFinite(km) && km >= MIN_DISTANCE_KM && km <= MAX_DISTANCE_KM)) {
		issues.push({
			path: `${at}.target_distance_km`,
			message: `Distance must be between ${MIN_DISTANCE_KM} and ${MAX_DISTANCE_KM} km, or left off entirely.`
		});
	}

	if (pace !== undefined && !(Number.isFinite(pace) && pace >= MIN_PACE && pace <= MAX_PACE)) {
		issues.push({
			path: `${at}.target_pace_min_per_km`,
			message: `Pace must be between ${MIN_PACE} and ${MAX_PACE} min/km.`
		});
	}

	if (gain !== undefined && !(Number.isFinite(gain) && gain >= 0 && gain <= MAX_ELEVATION_GAIN_M)) {
		issues.push({
			path: `${at}.target_elevation_gain_m`,
			message: `Elevation gain must be between 0 and ${MAX_ELEVATION_GAIN_M} m.`
		});
	}

	return issues;
}

/**
 * Returns every reason `spec` cannot be planned. Empty means valid.
 *
 * All issues at once, not the first: a plan is a form with up to seven rows, and
 * fixing one error per round-trip is seven round-trips.
 */
export function validatePlanSpec(spec: PlanSpec): PlanIssue[] {
	const issues: PlanIssue[] = [];

	const anchor = spec?.anchor;
	if (!anchor || !Number.isFinite(anchor.lng) || !Number.isFinite(anchor.lat)) {
		issues.push({ path: 'anchor', message: 'A plan needs a start point on the map.' });
	} else if (anchor.lng < -180 || anchor.lng > 180 || anchor.lat < -90 || anchor.lat > 90) {
		issues.push({ path: 'anchor', message: 'Start point is not a valid coordinate.' });
	}

	const runs = spec?.runs;
	if (!Array.isArray(runs) || runs.length === 0) {
		issues.push({ path: 'runs', message: 'A plan needs at least one run.' });
		return issues;
	}

	if (runs.length > MAX_RUNS) {
		issues.push({ path: 'runs', message: `A plan holds at most ${MAX_RUNS} runs.` });
	}

	runs.forEach((run, i) => issues.push(...validateRun(run, `runs[${i}]`)));

	return issues;
}
