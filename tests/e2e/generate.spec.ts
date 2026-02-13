import { test, expect } from '@playwright/test';

test.describe('Generate Mode (Mode A)', () => {
	test('POST /api/generate returns shape ideas for a valid neighborhood', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { neighborhood: 'Vinohrady', count: 2 }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.neighborhood).toBe('Vinohrady');
		expect(data.ideas).toHaveLength(2);
		for (const idea of data.ideas) {
			expect(idea.name).toBeTruthy();
			expect(idea.emoji).toBeTruthy();
			expect(idea.control_points.length).toBeGreaterThanOrEqual(3);
			expect(idea.estimated_distance_km).toBeGreaterThan(0);
		}
	});

	test('POST /api/generate returns 400 for unknown neighborhood', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { neighborhood: 'NonExistent' }
		});
		expect(response.status()).toBe(400);
	});

	test('POST /api/generate defaults to 3 ideas', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { neighborhood: 'Karlín' }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.ideas).toHaveLength(3);
	});

	test('POST /api/generate returns bbox', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { neighborhood: 'Letná', count: 1 }
		});
		const data = await response.json();
		expect(data.bbox).toBeDefined();
		expect(data.bbox.min_lng).toBeLessThan(data.bbox.max_lng);
		expect(data.bbox.min_lat).toBeLessThan(data.bbox.max_lat);
	});
});
