/**
 * Ghost Tracks - Shape Page Server
 *
 * Loads shape data for the shareable shape page.
 * This runs on the server before rendering the page.
 */
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShapeById, resolveShapeId } from '$data/prague-shapes';

export const load: PageServerLoad = async ({ params }) => {
	const requestedId = params.id;
	const canonicalId = resolveShapeId(requestedId);
	const shape = getShapeById(requestedId);

	if (!shape) {
		throw error(404, {
			message: 'Shape not found'
		});
	}

	return {
		shape,
		requestedId,
		canonicalId
	};
};
