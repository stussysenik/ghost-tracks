import { test, expect } from '@playwright/test';

// Berlin, Germany — a non-Prague pin proves the global flow.
const BERLIN = { lng: 13.405, lat: 52.52 };

test.describe('Generate Mode (Mode A) — global pin-drop', () => {
	// LLM round-trips can exceed the default 60s under Cerebras load.
	test.describe.configure({ timeout: 120000 });

	test('POST /api/generate returns shape ideas for a dropped pin', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { center: BERLIN, area_name: 'Berlin, Germany', target_distance_km: 5, count: 2 }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.ideas).toHaveLength(2);
		for (const idea of data.ideas) {
			expect(idea.name).toBeTruthy();
			expect(idea.emoji).toBeTruthy();
			expect(idea.control_points.length).toBeGreaterThanOrEqual(3);
			expect(idea.estimated_distance_km).toBeGreaterThan(0);
		}
	});

	test('POST /api/generate positions control points at the dropped pin', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { center: BERLIN, target_distance_km: 5, count: 1 }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		// bbox is centered on the pin, not Prague.
		const midLng = (data.bbox.min_lng + data.bbox.max_lng) / 2;
		const midLat = (data.bbox.min_lat + data.bbox.max_lat) / 2;
		expect(Math.abs(midLng - BERLIN.lng)).toBeLessThan(0.1);
		expect(Math.abs(midLat - BERLIN.lat)).toBeLessThan(0.1);
		for (const cp of data.ideas[0].control_points) {
			expect(Math.abs(cp.lng - BERLIN.lng)).toBeLessThan(0.2);
			expect(Math.abs(cp.lat - BERLIN.lat)).toBeLessThan(0.2);
		}
	});

	test('POST /api/generate defaults to 3 ideas', async ({ request }) => {
		const response = await request.post('/api/generate', {
			data: { center: BERLIN }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.ideas).toHaveLength(3);
	});

	test('POST /api/generate returns 422 without a pin or neighborhood', async ({ request }) => {
		// The GenerateRequest model_validator rejects the body during parsing.
		const response = await request.post('/api/generate', { data: { count: 1 } });
		expect(response.status()).toBe(422);
	});
});
