/**
 * The 12 checks 4.4 ran from a scratch script, made permanent.
 *
 * What is being guarded is the *grading rule*, not the wording: when the contract
 * is judged and when it is only reported. A badge that grades something the user
 * never asked for, or that reads an open shape as a failed loop, is wrong in a way
 * no amount of styling fixes — and until now nothing on CI could catch it.
 */
import { describe, expect, it } from 'vitest';
import { contractBadges, type Badge } from './route-contract';
import type { RouteContract } from '$types';

type Route = RouteContract & { distance_km: number };

/** A closed shape, on target, clean — every arm passing. Tests vary one axis off this. */
const base: Route = {
	target_distance_km: 5,
	best_effort: false,
	repeat_ratio: 0.1,
	is_loop: true,
	shape_is_closed: true,
	distance_km: 5
};

const route = (over: Partial<Route> = {}): Route => ({ ...base, ...over });
const by = (badges: Badge[], testid: string) => badges.find((b) => b.testid === testid);

describe('closure is graded only where the shape is a loop', () => {
	it('grades a closed shape that closed as good', () => {
		expect(by(contractBadges(route()), 'badge-loop')).toMatchObject({
			label: 'Loop ✓',
			tone: 'good'
		});
	});

	it('grades a closed shape that failed to close as bad', () => {
		expect(by(contractBadges(route({ is_loop: false })), 'badge-loop')).toMatchObject({
			label: 'Loop ✗',
			tone: 'bad'
		});
	});

	it('leaves an open shape ungraded rather than failed', () => {
		// The letter-M case. `is_loop: false` here is the shape's design, not a defect.
		const badge = by(contractBadges(route({ shape_is_closed: false, is_loop: false })), 'badge-loop');
		expect(badge).toMatchObject({ label: 'Point to point', tone: 'neutral' });
	});

	it('does not let an open shape read as a pass either', () => {
		// Guards the other direction: neutral must not drift to `good`, or an
		// ungraded arm would look like a cleared one.
		const badge = by(contractBadges(route({ shape_is_closed: false })), 'badge-loop');
		expect(badge?.tone).toBe('neutral');
	});
});

describe('distance is graded only against a target the user asked for', () => {
	it('emits no distance badge when no target was requested', () => {
		expect(by(contractBadges(route({ target_distance_km: null })), 'badge-distance')).toBeUndefined();
	});

	it('grades an achieved target as good', () => {
		expect(by(contractBadges(route()), 'badge-distance')).toMatchObject({
			label: '5 km target ✓',
			tone: 'good'
		});
	});

	it('reports best-effort as a warning, never a pass', () => {
		const badge = by(contractBadges(route({ best_effort: true, distance_km: 3.8 })), 'badge-distance');
		expect(badge).toMatchObject({ label: '−1.2 km off target', tone: 'warn' });
	});

	it('signs an overshoot the other way', () => {
		const badge = by(contractBadges(route({ best_effort: true, distance_km: 6.4 })), 'badge-distance');
		expect(badge?.label).toBe('+1.4 km off target');
	});
});

describe('repeat ratio thresholds', () => {
	const repeatBadge = (repeat_ratio: number) =>
		by(contractBadges(route({ repeat_ratio })), 'badge-repeat');

	it('reads low retracing as good', () => {
		expect(repeatBadge(0.1)).toMatchObject({ label: '10% retraced', tone: 'good' });
	});

	it('holds good at the warn boundary', () => {
		expect(repeatBadge(0.25)?.tone).toBe('good');
	});

	it('warns just past it', () => {
		expect(repeatBadge(0.26)?.tone).toBe('warn');
	});

	it('fails past the bad threshold', () => {
		expect(repeatBadge(0.41)).toMatchObject({ label: '41% retraced', tone: 'bad' });
	});
});
