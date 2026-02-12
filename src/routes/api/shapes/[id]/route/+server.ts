import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShapeById, resolveShapeId } from '$data/prague-shapes';
import { getRoutableCoordinates } from '$services/routing';

export const GET: RequestHandler = async ({ params, url }) => {
	const { id } = params;
	const canonicalId = resolveShapeId(id);
	const mode = url.searchParams.get('mode') === 'overlay' ? 'overlay' : 'routable';

	const shape = getShapeById(id);
	if (!shape) {
		throw error(404, { message: `Shape not found: ${id}` });
	}

	try {
		const routed = mode === 'routable' ? await getRoutableCoordinates(shape) : null;
		const geometry = routed
			? { type: 'LineString', coordinates: routed }
			: shape.geometry;

		return json({
			id: shape.id,
			requested_id: id,
			canonical_id: canonicalId,
			mode: routed ? 'routable' : 'overlay',
			geometry
		});
	} catch (err) {
		console.error('Error generating route geometry:', err);
		throw error(500, { message: 'Failed to generate route geometry' });
	}
};
