/**
 * The runnable-route contract, rendered as badges.
 *
 * Pure on purpose: this is the grading rule, not presentation. It decides when a
 * route is judged and when it is merely reported, which is the one part of 4.4
 * that can be *wrong* rather than just ugly — so it lives where it can be read
 * and tested, not inlined in a component.
 */
import type { RouteContract } from '$types';

export type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Badge {
	testid: string;
	label: string;
	tone: BadgeTone;
	title: string;
}

/** Tailwind classes per tone. Neutral reads as "not graded", never as a pass. */
export const TONE: Record<BadgeTone, string> = {
	good: 'bg-green-100 text-green-700',
	warn: 'bg-yellow-100 text-yellow-700',
	bad: 'bg-red-100 text-red-700',
	neutral: 'bg-slate-100 text-slate-500'
};

/** Repeat ratio above this reads as a warning; above `REPEAT_BAD`, a failure. */
const REPEAT_WARN = 25;
const REPEAT_BAD = 40;

export function contractBadges(route: RouteContract & { distance_km: number }): Badge[] {
	const out: Badge[] = [];

	// Closure is graded only where the shape was drawn as a loop. A letter M ends
	// away from its start by design; grading that as a failed loop would measure
	// the alphabet rather than the router — the same distinction the eval
	// scoreboard makes by showing open shapes as not-graded instead of passing.
	if (route.shape_is_closed) {
		out.push(
			route.is_loop
				? {
						testid: 'badge-loop',
						label: 'Loop ✓',
						tone: 'good',
						title: 'The route returns to its start.'
					}
				: {
						testid: 'badge-loop',
						label: 'Loop ✗',
						tone: 'bad',
						title: 'This shape is a loop, but the route did not close.'
					}
		);
	} else {
		out.push({
			testid: 'badge-loop',
			label: 'Point to point',
			tone: 'neutral',
			title: 'This shape is not a loop, so it is not expected to close.'
		});
	}

	// No target requested means nothing to grade distance against — the header
	// already states the length. Inventing a target here would be a badge that
	// reports a promise the user never made.
	if (route.target_distance_km != null) {
		const delta = route.distance_km - route.target_distance_km;
		const off = `${delta >= 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} km`;
		out.push(
			route.best_effort
				? {
						testid: 'badge-distance',
						label: `${off} off target`,
						tone: 'warn',
						title:
							`Closest achievable route: asked for ${route.target_distance_km} km, ` +
							`got ${route.distance_km} km.`
					}
				: {
						testid: 'badge-distance',
						label: `${route.target_distance_km} km target ✓`,
						tone: 'good',
						title: `On target (${off}).`
					}
		);
	}

	const repeat = Math.round(route.repeat_ratio * 100);
	out.push({
		testid: 'badge-repeat',
		label: `${repeat}% retraced`,
		tone: repeat <= REPEAT_WARN ? 'good' : repeat <= REPEAT_BAD ? 'warn' : 'bad',
		title: 'Share of the route that covers ground it already walked.'
	});

	return out;
}
