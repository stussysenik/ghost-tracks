/**
 * Ghost Tracks - AI Suggestion E2E Tests
 *
 * Tests the AI route suggestion API
 */
import { test, expect } from '@playwright/test';

test.describe('AI Suggestion API', () => {
	test('GET request with query returns suggestion', async ({ request }) => {
		const response = await request.get('/api/suggest?q=fox');

		expect(response.status()).toBe(200);

		const data = await response.json();

		// Should have shape or message
		expect(data).toHaveProperty('message');
		expect(data).toHaveProperty('provider', 'ghost-tracks-ai');
		expect(data).toHaveProperty('timestamp');

		// Should find the fox shape
		if (data.shape) {
			expect(data.shape.name.toLowerCase()).toContain('fox');
		}
	});

	test('POST request with prompt returns suggestion', async ({ request }) => {
		const response = await request.post('/api/suggest', {
			data: {
				prompt: 'I want to run a 5km route',
				preferences: {
					distance_min: 4,
					distance_max: 6
				}
			}
		});

		expect(response.status()).toBe(200);

		const data = await response.json();

		expect(data).toHaveProperty('message');
		expect(data).toHaveProperty('creativityReminder');

		// If there's a shape, it should be within distance range
		if (data.shape) {
			expect(data.shape.distance_km).toBeGreaterThanOrEqual(3);
			expect(data.shape.distance_km).toBeLessThanOrEqual(7);
		}
	});

	test('returns alternatives', async ({ request }) => {
		const response = await request.post('/api/suggest', {
			data: {
				prompt: 'creature route'
			}
		});

		expect(response.status()).toBe(200);

		const data = await response.json();

		// Should have alternatives array
		expect(data).toHaveProperty('alternatives');
		expect(Array.isArray(data.alternatives)).toBe(true);
	});

	test('handles empty query gracefully', async ({ request }) => {
		const response = await request.get('/api/suggest');

		// Should return error for missing query
		expect(response.status()).toBe(400);

		const data = await response.json();
		expect(data).toHaveProperty('error');
	});

	test('matches by category', async ({ request }) => {
		const response = await request.post('/api/suggest', {
			data: {
				prompt: 'letter',
				preferences: {
					categories: ['letter']
				}
			}
		});

		expect(response.status()).toBe(200);

		const data = await response.json();

		// Shape or alternatives should be letters
		if (data.shape) {
			expect(data.shape.category).toBe('letter');
		}
	});

	test('matches by area', async ({ request }) => {
		const response = await request.post('/api/suggest', {
			data: {
				prompt: 'Vinohrady'
			}
		});

		expect(response.status()).toBe(200);

		const data = await response.json();

		// Should find shapes in Vinohrady
		if (data.shape) {
			expect(data.shape.area.toLowerCase()).toContain('vinohrady');
		}
	});

	test('creativity reminder is always included', async ({ request }) => {
		const response = await request.post('/api/suggest', {
			data: {
				prompt: 'any route'
			}
		});

		expect(response.status()).toBe(200);

		const data = await response.json();

		// Should always include creativity reminder
		expect(data).toHaveProperty('creativityReminder');
		expect(data.creativityReminder).toContain('sky');
	});
});
