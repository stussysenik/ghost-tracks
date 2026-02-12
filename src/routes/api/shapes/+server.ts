/**
 * Ghost Tracks - Shapes API
 *
 * GET /api/shapes
 *
 * Query Parameters:
 * - bbox: Bounding box as "minLng,minLat,maxLng,maxLat"
 * - distance_min: Minimum distance in km
 * - distance_max: Maximum distance in km
 * - category: Filter by category (creature, letter, geometric)
 * - limit: Maximum number of results
 *
 * Returns: JSON array of shapes with GeoJSON geometry
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllShapes, getShapesInBounds, getShapesByCategory, getShapesByDistance } from '$data/prague-shapes';
import type { Shape, BoundingBox, ShapeCategory } from '$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Parse query parameters
		const bboxParam = url.searchParams.get('bbox');
		const distanceMin = parseFloat(url.searchParams.get('distance_min') || '0');
		const distanceMax = parseFloat(url.searchParams.get('distance_max') || '100');
		const category = url.searchParams.get('category') as ShapeCategory | null;
		const limit = parseInt(url.searchParams.get('limit') || '100');

		// Start with all shapes
		let shapes: Shape[] = getAllShapes();

		// Filter by bounding box if provided
		if (bboxParam) {
			const bboxParts = bboxParam.split(',').map(parseFloat);
			if (bboxParts.length === 4 && bboxParts.every(n => !isNaN(n))) {
				const bbox: BoundingBox = [bboxParts[0], bboxParts[1], bboxParts[2], bboxParts[3]];
				shapes = getShapesInBounds(bbox);
			}
		}

		// Filter by category
		if (category && ['creature', 'letter', 'geometric'].includes(category)) {
			shapes = shapes.filter(s => s.category === category);
		}

		// Filter by distance range
		shapes = shapes.filter(s => s.distance_km >= distanceMin && s.distance_km <= distanceMax);

		// Apply limit
		shapes = shapes.slice(0, limit);

		// Return response with caching headers
		return json(
			{
				shapes,
				count: shapes.length,
				filters: {
					bbox: bboxParam || null,
					distance_min: distanceMin,
					distance_max: distanceMax,
					category: category || null
				}
			},
			{
				headers: {
					// Cache for 1 hour (shapes don't change often)
					'Cache-Control': 'public, max-age=3600, s-maxage=3600'
				}
			}
		);
	} catch (error) {
		console.error('Error fetching shapes:', error);
		return json(
			{ error: 'Failed to fetch shapes', message: String(error) },
			{ status: 500 }
		);
	}
};
