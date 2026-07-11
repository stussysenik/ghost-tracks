/**
 * Selected-area store (Svelte 5 runes).
 *
 * Single source of truth for the globally-chosen generation area (a dropped pin
 * with a human label) plus its street-density gate. Both Generate and Describe
 * modes read this; the Map both reads it (to draw the pin / fly) and writes it
 * (on click). Density is checked once per area via `/api/area/check` so the UI
 * can refuse a too-sparse area before any LLM/routing spend.
 */
import type { AreaCheckResponse, DensityStatus, SelectedArea } from '$types';

/** Target route length used to size the density-check bbox (km). */
const TARGET_DISTANCE_KM = 5;

interface DensityState {
	status: DensityStatus;
	message: string;
	wayCount: number | null;
}

const IDLE_DENSITY: DensityState = { status: 'idle', message: '', wayCount: null };

let area = $state<SelectedArea | null>(null);
let density = $state<DensityState>({ ...IDLE_DENSITY });
let flyNonce = $state(0);
let checkSeq = 0;

export function getArea(): SelectedArea | null {
	return area;
}

export function getDensity(): DensityState {
	return density;
}

/** Increments whenever the map should animate to the current area. */
export function getFlyNonce(): number {
	return flyNonce;
}

/** True when the area is missing, still checking, or too sparse to generate. */
export function isAreaBlocked(): boolean {
	return area === null || density.status === 'checking' || density.status === 'sparse';
}

/**
 * Set the active area. Pass `{ fly: true }` when the user picked it via search
 * (the map should animate); map-click keeps the current viewport. Kicks off the
 * density check for the new area.
 */
export function setArea(next: SelectedArea | null, opts: { fly?: boolean } = {}): void {
	area = next;
	if (!next) {
		checkSeq += 1; // cancel any in-flight check
		density = { ...IDLE_DENSITY };
		return;
	}
	if (opts.fly) flyNonce += 1;
	void checkDensity(next);
}

/** Update only the label of the current area (e.g. after reverse geocoding). */
export function setAreaLabel(label: string): void {
	if (area) area = { ...area, label };
}

async function checkDensity(target: SelectedArea): Promise<void> {
	const seq = ++checkSeq;
	density = { status: 'checking', message: 'Checking street density…', wayCount: null };

	try {
		const res = await fetch('/api/area/check', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				center: { lng: target.lng, lat: target.lat },
				target_distance_km: TARGET_DISTANCE_KM
			})
		});
		if (seq !== checkSeq) return; // superseded by a newer selection

		const data = (await res.json()) as AreaCheckResponse & { detail?: string };
		if (!res.ok) {
			density = { status: 'error', message: data.detail || 'Density check failed', wayCount: null };
			return;
		}
		density = {
			status: data.ok ? 'ok' : 'sparse',
			message: data.message,
			wayCount: data.way_count ?? null
		};
	} catch {
		if (seq !== checkSeq) return;
		density = { status: 'error', message: 'Could not verify this area', wayCount: null };
	}
}
