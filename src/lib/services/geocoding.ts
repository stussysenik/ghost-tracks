/**
 * Mapbox Geocoding — forward (search box) and reverse (pin label).
 * Runs client-side against the public `VITE_MAPBOX_ACCESS_TOKEN`.
 */
import type { SelectedArea } from '$types';

const TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
const BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

function fallbackLabel(lng: number, lat: number): string {
	return `Pin (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
}

/** Forward geocode a free-text query into up to `limit` candidate areas. */
export async function searchPlaces(
	query: string,
	signal?: AbortSignal,
	limit = 5
): Promise<SelectedArea[]> {
	const q = query.trim();
	if (!q || !TOKEN) return [];

	const url =
		`${BASE}/${encodeURIComponent(q)}.json` +
		`?access_token=${TOKEN}&limit=${limit}&language=en` +
		`&types=place,locality,neighborhood,district,address`;

	const res = await fetch(url, { signal });
	if (!res.ok) return [];

	const data = await res.json();
	return (data.features ?? [])
		.filter((f: { center?: [number, number] }) => Array.isArray(f.center))
		.map((f: { center: [number, number]; place_name: string }) => ({
			lng: f.center[0],
			lat: f.center[1],
			label: f.place_name
		}));
}

/** Reverse geocode a coordinate into a readable place name. */
export async function reverseGeocode(lng: number, lat: number): Promise<string> {
	if (!TOKEN) return fallbackLabel(lng, lat);

	const url =
		`${BASE}/${lng},${lat}.json` +
		`?access_token=${TOKEN}&limit=1&language=en` +
		`&types=neighborhood,locality,place,address`;

	try {
		const res = await fetch(url);
		if (!res.ok) return fallbackLabel(lng, lat);
		const data = await res.json();
		return data.features?.[0]?.place_name ?? fallbackLabel(lng, lat);
	} catch {
		return fallbackLabel(lng, lat);
	}
}
