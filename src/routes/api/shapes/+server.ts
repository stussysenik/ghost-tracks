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
import { getAllShapes, getShapesInBounds } from '$data/prague-shapes';
import type { Shape, BoundingBox, ShapeCategory } from '$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const bboxParam = url.searchParams.get('bbox');
		const distanceMinRaw = url.searchParams.get('distance_min') ?? '0';
		const distanceMaxRaw = url.searchParams.get('distance_max') ?? '100';
		const categoryRaw = url.searchParams.get('category');
		const limitRaw = url.searchParams.get('limit') ?? '100';

		const distanceMin = Number.parseFloat(distanceMinRaw);
		const distanceMax = Number.parseFloat(distanceMaxRaw);
		const limit = Number.parseInt(limitRaw, 10);

		if (!Number.isFinite(distanceMin) || !Number.isFinite(distanceMax) || distanceMin > distanceMax) {
			return json(
				{ error: 'Invalid distance range', message: 'distance_min and distance_max must be valid numbers with min <= max' },
				{ status: 400 }
			);
		}

		if (!Number.isFinite(limit) || limit < 1) {
			return json(
				{ error: 'Invalid limit', message: 'limit must be a positive integer' },
				{ status: 400 }
			);
		}

		const validCategories: ShapeCategory[] = ['creature', 'letter', 'geometric'];
		const category = categoryRaw as ShapeCategory | null;
		if (category && !validCategories.includes(category)) {
			return json(
				{ error: 'Invalid category', message: `category must be one of: ${validCategories.join(', ')}` },
				{ status: 400 }
			);
		}

		// Start with all shapes
		let shapes: Shape[] = getAllShapes();

		// Filter by bounding box if provided
		if (bboxParam) {
			const bboxParts = bboxParam.split(',').map(part => Number.parseFloat(part));
			if (bboxParts.length !== 4 || bboxParts.some(n => !Number.isFinite(n))) {
				return json(
					{ error: 'Invalid bbox', message: 'bbox must be: minLng,minLat,maxLng,maxLat' },
					{ status: 400 }
				);
			}

			const bbox: BoundingBox = [bboxParts[0], bboxParts[1], bboxParts[2], bboxParts[3]];
			if (bbox[0] > bbox[2] || bbox[1] > bbox[3]) {
				return json(
					{ error: 'Invalid bbox', message: 'bbox must satisfy min <= max for longitude and latitude' },
					{ status: 400 }
				);
			}

			shapes = getShapesInBounds(bbox);
		}

		// Filter by category
		if (category) {
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
