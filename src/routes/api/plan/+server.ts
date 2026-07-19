/**
 * POST /api/plan - Route every run in a plan.
 *
 * Shape-per-run: each run is an independent `/describe/` call against the shared
 * anchor, so a plan is exactly N standalone routes in an order. There is no
 * composition step, and nothing here re-implements the runnable-route contract —
 * each run carries the backend's contract fields through untouched.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { runDuration, validatePlanSpec } from '$lib/plan';
import type { FailedRun, PlanRunSpec, PlanSpec, PlannedRun, SelectedArea } from '$types';

const BACKEND_URL = env.BACKEND_URL || 'http://127.0.0.1:8000';

/** Per run, matching the /api/describe proxy. A 7-run plan is bounded by 7×this. */
const RUN_TIMEOUT_MS = 90_000;

async function routeRun(
	run: PlanRunSpec,
	index: number,
	anchor: SelectedArea
): Promise<PlannedRun | FailedRun> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

	try {
		const response = await fetch(`${BACKEND_URL}/describe/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				description: run.theme,
				// Omitted, not defaulted: the contract distinguishes "no target given"
				// from a target, and sending one here would forge the difference.
				...(run.target_distance_km !== undefined && { target_distance_km: run.target_distance_km }),
				center: { lng: anchor.lng, lat: anchor.lat },
				area_name: anchor.label
			}),
			signal: controller.signal
		});

		const data = await response.json();
		if (!response.ok) {
			return { index, spec: run, error: data?.error || `Routing failed (${response.status})` };
		}

		return {
			index,
			spec: run,
			shape: data.shape,
			routed_coordinates: data.routed_coordinates,
			distance_km: data.distance_km,
			// The one field a plan derives rather than passes through: the backend
			// cannot compute this, because pace is the user's input and the backend
			// never sees it. Everything else stays verbatim.
			...runDuration(data.distance_km, run.target_pace_min_per_km, data.duration_minutes),
			waypoints: data.waypoints,
			similarity_score: data.similarity_score,
			bbox: data.bbox,
			// Contract fields pass through verbatim. Re-deriving any of these in the
			// planner would create a second grading rule that could disagree with the
			// one the badges read.
			target_distance_km: data.target_distance_km,
			best_effort: data.best_effort,
			repeat_ratio: data.repeat_ratio,
			is_loop: data.is_loop,
			shape_is_closed: data.shape_is_closed
		};
	} catch (error) {
		const timedOut = error instanceof DOMException && error.name === 'AbortError';
		return {
			index,
			spec: run,
			error: timedOut
				? 'Route generation timed out. Try a simpler shape.'
				: error instanceof Error
					? error.message
					: 'Unknown routing error'
		};
	} finally {
		clearTimeout(timeout);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	let spec: PlanSpec;
	try {
		spec = await request.json();
	} catch {
		return json({ error: 'Malformed request body' }, { status: 400 });
	}

	const issues = validatePlanSpec(spec);
	if (issues.length > 0) {
		return json({ error: 'Invalid plan', issues }, { status: 400 });
	}

	// Sequential, not parallel: seven concurrent graph builds is the kind of load
	// that makes the backend slower than doing them in turn, and a plan is not a
	// latency-critical path. Revisit only if measurement says otherwise.
	const results: (PlannedRun | FailedRun)[] = [];
	for (const [index, run] of spec.runs.entries()) {
		results.push(await routeRun(run, index, spec.anchor));
	}

	const runs = results.filter((r): r is PlannedRun => !('error' in r));
	const failed = results.filter((r): r is FailedRun => 'error' in r);

	// A plan where every run failed is a failed plan; a plan where some failed is
	// still a plan, and hiding the gap would misreport what the user asked for.
	return json(
		{ name: spec.name, anchor: spec.anchor, runs, failed },
		{ status: runs.length === 0 ? 502 : 200 }
	);
};
