/**
 * Ghost Tracks - GPX Export API
 *
 * GET /api/shapes/:id/gpx
 *
 * Returns: GPX file download for the specified shape
 */
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShapeById, resolveShapeId } from '$data/prague-shapes';
import { generateGPX, getGPXFilename } from '$services/gpx';
import { getRoutableCoordinates } from '$services/routing';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const canonicalId = resolveShapeId(id);
	const mode = url.searchParams.get('mode') === 'overlay' ? 'overlay' : 'routable';

	// Find the shape
	const shape = getShapeById(id);

	if (!shape) {
		throw error(404, {
			message: `Shape not found: ${id}`
		});
	}

	try {
		const routedCoordinates =
			mode === 'routable' ? await getRoutableCoordinates(shape) : null;

		// Generate GPX content (falls back to overlay coordinates)
		const gpxContent = generateGPX(shape, routedCoordinates ?? undefined);
		const filename = getGPXFilename(shape);

		// Return as downloadable file
		return new Response(gpxContent, {
			status: 200,
			headers: {
				'Content-Type': 'application/gpx+xml',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'X-Canonical-Shape-Id': canonicalId,
				'X-Route-Mode': routedCoordinates ? 'routable' : 'overlay',
				// Cache for 1 hour (GPX content is deterministic)
				'Cache-Control': 'public, max-age=3600, s-maxage=3600'
			}
		});
	} catch (err) {
		console.error('Error generating GPX:', err);
		throw error(500, {
			message: 'Failed to generate GPX file'
		});
	}
};
