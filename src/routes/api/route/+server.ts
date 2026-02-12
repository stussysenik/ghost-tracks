/**
 * Ghost Tracks - Route Snapping API
 *
 * POST /api/route
 *
 * Snaps a set of waypoints to actual walkable streets using
 * Mapbox Directions API. Used for:
 * - On-demand routing for user-created custom shapes
 * - Testing route validity before saving
 * - Preview mode toggle (ghost vs routed)
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDirectionsRoute } from '$services/routing';

interface RouteRequest {
	waypoints: [number, number][];
	profile?: 'walking' | 'cycling';
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: RouteRequest = await request.json();

		// Validate request
		if (!body.waypoints || !Array.isArray(body.waypoints)) {
			return json(
				{ error: 'Missing waypoints array', success: false },
				{ status: 400 }
			);
		}

		if (body.waypoints.length < 2) {
			return json(
				{ error: 'At least 2 waypoints required', success: false },
				{ status: 400 }
			);
		}

		// Validate coordinate format
		for (const coord of body.waypoints) {
			if (!Array.isArray(coord) || coord.length !== 2) {
				return json(
					{ error: 'Each waypoint must be [lng, lat] array', success: false },
					{ status: 400 }
				);
			}
			const [lng, lat] = coord;
			if (typeof lng !== 'number' || typeof lat !== 'number') {
				return json(
					{ error: 'Coordinates must be numbers', success: false },
					{ status: 400 }
				);
			}
			if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
				return json(
					{ error: 'Coordinates out of valid range', success: false },
					{ status: 400 }
				);
			}
		}

		// Get routed path
		const result = await getDirectionsRoute(body.waypoints);

		if (!result.success) {
			return json(
				{
					error: result.error || 'Failed to compute route',
					success: false,
					// Return original waypoints as fallback
					coordinates: body.waypoints,
					distance_km: 0,
					duration_minutes: 0
				},
				{ status: 422 }
			);
		}

		return json({
			success: true,
			coordinates: result.coordinates,
			distance_km: result.distance_km,
			duration_minutes: result.duration_minutes,
			waypoint_count: body.waypoints.length,
			coordinate_count: result.coordinates.length
		});
	} catch (error) {
		console.error('Route API error:', error);
		return json(
			{
				error: 'Internal server error',
				success: false,
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

/**
 * GET /api/route - Health check and API info
 */
export const GET: RequestHandler = async () => {
	return json({
		service: 'Ghost Tracks Route Snapping API',
		version: '1.0',
		endpoints: {
			'POST /api/route': {
				description: 'Snap waypoints to walkable streets',
				body: {
					waypoints: '[[lng, lat], ...] - Array of coordinate pairs',
					profile: "'walking' | 'cycling' - Optional, defaults to walking"
				},
				response: {
					coordinates: 'Snapped route coordinates',
					distance_km: 'Total route distance',
					duration_minutes: 'Estimated walking time'
				}
			}
		}
	});
};
