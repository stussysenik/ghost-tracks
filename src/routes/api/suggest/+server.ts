/**
 * Ghost Tracks - AI Suggestion API
 *
 * POST /api/suggest
 *
 * Request Body:
 * {
 *   prompt: string,           // User's description of desired route
 *   viewport?: {
 *     center: [lng, lat],
 *     bounds?: [minLng, minLat, maxLng, maxLat]
 *   },
 *   preferences?: {
 *     distance_min?: number,
 *     distance_max?: number,
 *     categories?: string[]
 *   }
 * }
 *
 * Returns: AI-suggested shape with alternatives
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { suggestRoute, type AIContext } from '$services/ai';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		// Validate required fields
		if (!body.prompt || typeof body.prompt !== 'string') {
			return json(
				{ error: 'Missing or invalid prompt', message: 'Please provide a prompt string' },
				{ status: 400 }
			);
		}

		// Build context from request
		const context: AIContext = {
			prompt: body.prompt.trim(),
			viewport: body.viewport,
			preferences: body.preferences
		};

		// Get AI suggestion
		const suggestion = await suggestRoute(context);

		// Return response
		return json({
			...suggestion,
			provider: 'ghost-tracks-ai', // Don't expose which provider is used
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error in suggest API:', error);
		return json(
			{ error: 'Failed to generate suggestion', message: String(error) },
			{ status: 500 }
		);
	}
};

// Also support GET for simple queries
export const GET: RequestHandler = async ({ url }) => {
	const prompt = url.searchParams.get('q') || url.searchParams.get('prompt');

	if (!prompt) {
		return json(
			{ error: 'Missing prompt', message: 'Use ?q=your+search+query' },
			{ status: 400 }
		);
	}

	const context: AIContext = {
		prompt: prompt.trim(),
		preferences: {
			distance_min: parseFloat(url.searchParams.get('distance_min') || '0'),
			distance_max: parseFloat(url.searchParams.get('distance_max') || '100')
		}
	};

	const suggestion = await suggestRoute(context);

	return json({
		...suggestion,
		provider: 'ghost-tracks-ai',
		timestamp: new Date().toISOString()
	});
};
