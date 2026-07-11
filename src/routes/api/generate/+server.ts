/**
 * POST /api/generate - Proxy to Python backend for shape generation.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const BACKEND_URL = env.BACKEND_URL || 'http://127.0.0.1:8000';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 60_000);

		const response = await fetch(`${BACKEND_URL}/generate/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: controller.signal
		});

		clearTimeout(timeout);

		const data = await response.json();
		return json(data, { status: response.status });
	} catch (error) {
		console.error('Backend proxy error (generate):', error);

		if (error instanceof DOMException && error.name === 'AbortError') {
			return json(
				{ error: 'Generation timed out', detail: 'The backend took too long to respond.' },
				{ status: 504 }
			);
		}

		const isConnectionError =
			error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('connect'));

		return json(
			{
				error: isConnectionError ? 'Backend service unavailable' : 'Internal proxy error',
				detail: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: isConnectionError ? 502 : 500 }
		);
	}
};
