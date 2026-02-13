import { test, expect } from '@playwright/test';

test.describe('Describe Mode (Mode B)', () => {
	test.describe.configure({ timeout: 120000 });

	test('POST /api/describe returns a routed shape', async ({ request }) => {
		const response = await request.post('/api/describe', {
			data: { description: 'a heart shape' }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.shape.name).toBeTruthy();
		expect(data.neighborhood).toBeTruthy();
		expect(data.routed_coordinates.length).toBeGreaterThan(2);
		expect(data.similarity_score).toBeGreaterThanOrEqual(0);
		expect(data.distance_km).toBeGreaterThan(0);
		expect(data.waypoints.length).toBeGreaterThan(0);
	});

	test('POST /api/describe returns waypoints with instructions', async ({ request }) => {
		const response = await request.post('/api/describe', {
			data: { description: 'a triangle' }
		});
		const data = await response.json();
		for (const wp of data.waypoints) {
			expect(wp.index).toBeGreaterThan(0);
			expect(typeof wp.lng).toBe('number');
			expect(typeof wp.lat).toBe('number');
			expect(wp.instruction).toBeTruthy();
		}
	});

	test('POST /api/describe waypoints are numbered sequentially', async ({ request }) => {
		const response = await request.post('/api/describe', {
			data: { description: 'a star' }
		});
		const data = await response.json();
		const indices = data.waypoints.map((w: any) => w.index);
		for (let i = 0; i < indices.length; i++) {
			expect(indices[i]).toBe(i + 1);
		}
	});

	test('POST /api/describe coordinates are within Prague', async ({ request }) => {
		const response = await request.post('/api/describe', {
			data: { description: 'a circle' }
		});
		const data = await response.json();
		for (const [lng, lat] of data.routed_coordinates) {
			expect(lng).toBeGreaterThan(14.2);
			expect(lng).toBeLessThan(14.7);
			expect(lat).toBeGreaterThan(49.9);
			expect(lat).toBeLessThan(50.2);
		}
	});

	test('POST /api/describe returns 422 without description', async ({ request }) => {
		const response = await request.post('/api/describe', {
			data: {}
		});
		expect(response.status()).toBe(422);
	});
});
