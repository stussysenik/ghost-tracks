/**
 * Ghost Tracks - Routing Service
 *
 * Two approaches for snapping routes to actual streets:
 * 1. Map Matching API - Snaps existing GPS traces to roads
 * 2. Directions API - Routes between waypoints (PREFERRED for shape creation)
 *
 * The Directions API is better for Strava art because it actually creates
 * walkable routes between control points, rather than just snapping points.
 */
import { env } from '$env/dynamic/private';
import type { Shape } from '$types';

type Coord = [number, number];

const MAPBOX_MATCHING_BASE = 'https://api.mapbox.com/matching/v5/mapbox';
const MAPBOX_DIRECTIONS_BASE = 'https://api.mapbox.com/directions/v5/mapbox';
const MAX_COORDS_PER_MATCH_REQUEST = 95; // Limit is 100, keeping a buffer
const MAX_WAYPOINTS_PER_DIRECTIONS_REQUEST = 25; // Directions API limit
const ROUTING_PROFILE = 'walking';

interface MapboxMatchingResponse {
	matchings?: Array<{
		confidence: number;
		geometry: {
			type: 'LineString';
			coordinates: Coord[];
		};
	}>;
	code: string;
	message?: string;
}

function getMapboxToken(): string | null {
	return env.MAPBOX_ACCESS_TOKEN || env.VITE_MAPBOX_ACCESS_TOKEN || null;
}

/**
 * Calculates distance between two coordinates in meters using Haversine formula
 */
function haversineDistance(coords1: Coord, coords2: Coord): number {
	const R = 6371e3; // Earth radius in meters
	const phi1 = (coords1[1] * Math.PI) / 180;
	const phi2 = (coords2[1] * Math.PI) / 180;
	const deltaPhi = ((coords2[1] - coords1[1]) * Math.PI) / 180;
	const deltaLambda = ((coords2[0] - coords1[0]) * Math.PI) / 180;

	const a =
		Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
		Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

/**
 * Interpolates coordinates to ensure points are not too far apart.
 * This "densifies" the shape so the map matching API has enough context
 * to snap it to the correct road.
 */
function interpolateCoords(coords: Coord[], maxSegmentLengthMeters: number = 40): Coord[] {
	if (coords.length < 2) return coords;

	const result: Coord[] = [coords[0]];

	for (let i = 0; i < coords.length - 1; i++) {
		const start = coords[i];
		const end = coords[i + 1];
		const dist = haversineDistance(start, end);

		if (dist > maxSegmentLengthMeters) {
			const numSegments = Math.ceil(dist / maxSegmentLengthMeters);
			for (let j = 1; j < numSegments; j++) {
				const fraction = j / numSegments;
				const lng = start[0] + (end[0] - start[0]) * fraction;
				const lat = start[1] + (end[1] - start[1]) * fraction;
				result.push([lng, lat]);
			}
		}
		result.push(end);
	}

	return result;
}

/**
 * Splits coordinates into overlapping chunks to fit API limits
 */
function buildChunkedCoords(coords: Coord[]): Coord[][] {
	if (coords.length <= MAX_COORDS_PER_MATCH_REQUEST) return [coords];

	const chunks: Coord[][] = [];
	// Overlap by 1 point to ensure continuity
	const step = MAX_COORDS_PER_MATCH_REQUEST - 1;

	for (let start = 0; start < coords.length - 1; start += step) {
		// Ensure we don't go out of bounds, and always include at least 2 points
		let end = start + MAX_COORDS_PER_MATCH_REQUEST;
		if (end > coords.length) end = coords.length;
		
		const chunk = coords.slice(start, end);
		if (chunk.length >= 2) {
			chunks.push(chunk);
		}
	}

	return chunks;
}

function encodeCoords(coords: Coord[]): string {
	return coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
}

async function matchChunk(coords: Coord[], accessToken: string): Promise<Coord[]> {
	// Radius 25m allows for some inexactness in drawing while still snapping to street
	const radiuses = coords.map(() => 25).join(';');
	
	const url =
		`${MAPBOX_MATCHING_BASE}/${ROUTING_PROFILE}/${encodeCoords(coords)}` +
		`?geometries=geojson&overview=full&steps=false&radiuses=${radiuses}&access_token=${encodeURIComponent(accessToken)}`;

	const response = await fetch(url);
	if (!response.ok) {
		// Log detailed error for debugging
		const text = await response.text();
		console.error(`Mapbox Matching API error ${response.status}: ${text}`);
		throw new Error(`Matching API failed (${response.status})`);
	}

	const payload = (await response.json()) as MapboxMatchingResponse;
	
	// Map Matching API might return multiple matchings if it thinks the trace is split.
	// Usually strict checking returns "No match" if it can't match everything, 
	// but default is less strict. We take the highest confidence one.
	if (!payload.matchings || payload.matchings.length === 0) {
		console.warn('Mapbox Matching API returned no matches for chunk');
		// Fallback: return the original straight lines for this chunk if matching fails
		return coords; 
	}

	// Sort by confidence just in case, though usually first is best
	const bestMatch = payload.matchings.sort((a, b) => b.confidence - a.confidence)[0];
	return bestMatch.geometry.coordinates;
}

export async function getRoutableCoordinates(shape: Shape): Promise<Coord[] | null> {
	const token = getMapboxToken();
	if (!token) {
		console.warn('No Mapbox token found, skipping routing');
		return null;
	}
	if (shape.geometry.coordinates.length < 2) return null;

	// 1. Densify the shape coordinates to give the matcher more points to work with
	const densifiedCoords = interpolateCoords(shape.geometry.coordinates);
	
	// 2. Chunk if necessary (Map Matching API limit is 100 points)
	const chunks = buildChunkedCoords(densifiedCoords);
	const routedChunks: Coord[][] = [];

	try {
		for (const chunk of chunks) {
			const routed = await matchChunk(chunk, token);
			routedChunks.push(routed);
		}
	} catch (err) {
		console.error('Error during map matching:', err);
		// Return null to fall back to overlay mode
		return null;
	}

	// 3. Merge chunks
	if (routedChunks.length === 0) return null;
	
	const merged: Coord[] = [...routedChunks[0]];
	for (let i = 1; i < routedChunks.length; i++) {
		// If the previous chunk ended exactly where this one starts (likely), 
		// we might want to deduplicate the join point.
		// Detailed geometric stitching might be needed for perfect results,
		// but simple concatenation + overlap handling usually works visually.
		const nextChunk = routedChunks[i];
		
		// If we relied on overlap, the first point of nextChunk *should* be 
		// close to last point of merged. We can just append.
		// To be cleaner, we could check distance.
		merged.push(...nextChunk);
	}

	return merged.length >= 2 ? merged : null;
}

// ============================================================================
// DIRECTIONS API - Better for Strava Art (routes between waypoints)
// ============================================================================

interface MapboxDirectionsResponse {
	code: string;
	routes?: Array<{
		geometry: {
			type: 'LineString';
			coordinates: Coord[];
		};
		distance: number; // meters
		duration: number; // seconds
	}>;
	message?: string;
}

export interface DirectionsResult {
	coordinates: Coord[];
	distance_km: number;
	duration_minutes: number;
	success: boolean;
	error?: string;
}

/**
 * Get a walkable route between waypoints using Mapbox Directions API.
 * This is the PREFERRED method for Strava art because it creates
 * actual runnable routes along streets, sidewalks, and paths.
 *
 * @param waypoints - Control points that define the shape outline
 * @returns Route following actual streets between the waypoints
 */
export async function getDirectionsRoute(waypoints: Coord[]): Promise<DirectionsResult> {
	const token = getMapboxToken();
	if (!token) {
		return {
			coordinates: waypoints,
			distance_km: 0,
			duration_minutes: 0,
			success: false,
			error: 'No Mapbox token configured'
		};
	}

	if (waypoints.length < 2) {
		return {
			coordinates: waypoints,
			distance_km: 0,
			duration_minutes: 0,
			success: false,
			error: 'At least 2 waypoints required'
		};
	}

	try {
		// Handle routes with more than 25 waypoints by chunking
		if (waypoints.length > MAX_WAYPOINTS_PER_DIRECTIONS_REQUEST) {
			return await getDirectionsWithChunking(waypoints, token);
		}

		return await fetchDirections(waypoints, token);
	} catch (error) {
		console.error('Directions API error:', error);
		return {
			coordinates: waypoints,
			distance_km: 0,
			duration_minutes: 0,
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

async function fetchDirections(waypoints: Coord[], token: string): Promise<DirectionsResult> {
	const coordsString = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');

	const url = new URL(`${MAPBOX_DIRECTIONS_BASE}/${ROUTING_PROFILE}/${coordsString}`);
	url.searchParams.set('geometries', 'geojson');
	url.searchParams.set('overview', 'full');
	url.searchParams.set('steps', 'false');
	url.searchParams.set('access_token', token);

	const response = await fetch(url.toString());

	if (!response.ok) {
		const text = await response.text();
		console.error(`Mapbox Directions API error ${response.status}: ${text}`);
		throw new Error(`Directions API failed (${response.status})`);
	}

	const data: MapboxDirectionsResponse = await response.json();

	if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
		throw new Error(data.message || 'No route found between waypoints');
	}

	const route = data.routes[0];

	return {
		coordinates: route.geometry.coordinates,
		distance_km: Math.round((route.distance / 1000) * 100) / 100,
		duration_minutes: Math.round(route.duration / 60),
		success: true
	};
}

async function getDirectionsWithChunking(waypoints: Coord[], token: string): Promise<DirectionsResult> {
	const chunks: Coord[][] = [];

	// Split into chunks of MAX_WAYPOINTS_PER_DIRECTIONS_REQUEST
	// Each chunk overlaps by 1 point to ensure route continuity
	for (let i = 0; i < waypoints.length; i += MAX_WAYPOINTS_PER_DIRECTIONS_REQUEST - 1) {
		const chunk = waypoints.slice(i, i + MAX_WAYPOINTS_PER_DIRECTIONS_REQUEST);
		if (chunk.length >= 2) {
			chunks.push(chunk);
		}
	}

	// Fetch all chunks
	const results: DirectionsResult[] = [];
	for (const chunk of chunks) {
		const result = await fetchDirections(chunk, token);
		if (!result.success) {
			return result; // Return first failure
		}
		results.push(result);
	}

	// Combine all coordinates
	const allCoordinates: Coord[] = [];
	let totalDistance = 0;
	let totalDuration = 0;

	results.forEach((result, index) => {
		if (index === 0) {
			allCoordinates.push(...result.coordinates);
		} else {
			// Skip first point as it overlaps with previous chunk's last point
			allCoordinates.push(...result.coordinates.slice(1));
		}
		totalDistance += result.distance_km;
		totalDuration += result.duration_minutes;
	});

	return {
		coordinates: allCoordinates,
		distance_km: Math.round(totalDistance * 100) / 100,
		duration_minutes: Math.round(totalDuration),
		success: true
	};
}

/**
 * Get routable coordinates for a shape using the best available method.
 * Tries Directions API first (better for art), falls back to Map Matching.
 */
export async function getRoutedShape(shape: Shape): Promise<{
	coordinates: Coord[];
	distance_km: number;
	duration_minutes: number;
	method: 'directions' | 'matching' | 'original';
} | null> {
	// First, try to extract key waypoints from the shape
	// The current coordinates are too dense - we need control points only
	const waypoints = simplifyToWaypoints(shape.geometry.coordinates);

	// Try Directions API first (creates actual walkable routes)
	const directionsResult = await getDirectionsRoute(waypoints);
	if (directionsResult.success) {
		return {
			coordinates: directionsResult.coordinates,
			distance_km: directionsResult.distance_km,
			duration_minutes: directionsResult.duration_minutes,
			method: 'directions'
		};
	}

	// Fall back to Map Matching (snaps points to nearest roads)
	const matchedCoords = await getRoutableCoordinates(shape);
	if (matchedCoords) {
		return {
			coordinates: matchedCoords,
			distance_km: calculateRouteDistance(matchedCoords),
			duration_minutes: Math.round(calculateRouteDistance(matchedCoords) / 5 * 60), // ~5km/h walking
			method: 'matching'
		};
	}

	// Last resort: return original coordinates
	return {
		coordinates: shape.geometry.coordinates,
		distance_km: shape.distance_km,
		duration_minutes: shape.estimated_minutes,
		method: 'original'
	};
}

/**
 * Simplify dense coordinates to key waypoints for routing.
 * Uses Douglas-Peucker algorithm to preserve shape while reducing points.
 */
function simplifyToWaypoints(coords: Coord[], tolerance: number = 0.0005): Coord[] {
	if (coords.length <= 3) return coords;

	// Find point with maximum distance from line between first and last
	let maxDistance = 0;
	let maxIndex = 0;

	const [startLng, startLat] = coords[0];
	const [endLng, endLat] = coords[coords.length - 1];

	for (let i = 1; i < coords.length - 1; i++) {
		const [lng, lat] = coords[i];
		const distance = perpendicularDistance(lng, lat, startLng, startLat, endLng, endLat);

		if (distance > maxDistance) {
			maxDistance = distance;
			maxIndex = i;
		}
	}

	// If max distance > tolerance, recursively simplify
	if (maxDistance > tolerance) {
		const left = simplifyToWaypoints(coords.slice(0, maxIndex + 1), tolerance);
		const right = simplifyToWaypoints(coords.slice(maxIndex), tolerance);
		return [...left.slice(0, -1), ...right];
	}

	// Otherwise, return just start and end
	return [coords[0], coords[coords.length - 1]];
}

function perpendicularDistance(
	px: number, py: number,
	x1: number, y1: number,
	x2: number, y2: number
): number {
	const dx = x2 - x1;
	const dy = y2 - y1;

	if (dx === 0 && dy === 0) {
		return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
	}

	const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
	const nearestX = x1 + t * dx;
	const nearestY = y1 + t * dy;

	return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
}

function calculateRouteDistance(coords: Coord[]): number {
	let total = 0;
	for (let i = 1; i < coords.length; i++) {
		total += haversineDistance(coords[i - 1], coords[i]);
	}
	return Math.round((total / 1000) * 100) / 100; // Convert to km
}
