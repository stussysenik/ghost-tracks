import { test, expect } from '@playwright/test';

test.describe('GPX Export', () => {
	test('downloads GPX payload for an existing shape', async ({ request }) => {
		const response = await request.get('/api/shapes/prague-fox-1/gpx');

		expect(response.status()).toBe(200);
		expect(response.headers()['content-type']).toContain('application/gpx+xml');
		expect(response.headers()['content-disposition']).toContain('ghost-tracks-fox-across-star-msto.gpx');
		expect(response.headers()['x-route-mode']).toBeTruthy();

		const body = await response.text();
		expect(body).toContain('<?xml');
		expect(body).toContain('<gpx');
		expect(body).toContain('<trk>');
		expect(body).toContain('</gpx>');
	});

	test('supports alias resolution on shape detail endpoint', async ({ request }) => {
		const response = await request.get('/api/shapes/fox-stare-mesto');
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data.canonical_id).toBe('prague-fox-1');
	});

	test('returns 404 for non-existent shape', async ({ page }) => {
		const response = await page.goto('/api/shapes/non-existent-shape/gpx');
		expect(response?.status()).toBe(404);
	});
});
