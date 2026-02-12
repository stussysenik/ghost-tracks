/**
 * Ghost Tracks - Shape Detail API
 *
 * GET /api/shapes/:id
 *
 * Returns: Single shape with full details
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShapeById } from '$data/prague-shapes';

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	const shape = getShapeById(id);

	if (!shape) {
		throw error(404, {
			message: `Shape not found: ${id}`
		});
	}

	return json(shape, {
		headers: {
			// Cache for 1 hour
			'Cache-Control': 'public, max-age=3600, s-maxage=3600'
		}
	});
};
