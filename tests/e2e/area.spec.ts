import { test, expect } from '@playwright/test';

// Berlin, Germany — a dense urban pin.
const BERLIN = { lng: 13.405, lat: 52.52 };

test.describe('Area density gate', () => {
	test('POST /api/area/check sizes a bbox and reports density for a pin', async ({ request }) => {
		const response = await request.post('/api/area/check', {
			data: { center: BERLIN, target_distance_km: 5 }
		});
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(typeof data.ok).toBe('boolean');
		expect(data.message).toBeTruthy();
		// bbox is centered on the pin.
		const midLng = (data.bbox.min_lng + data.bbox.max_lng) / 2;
		const midLat = (data.bbox.min_lat + data.bbox.max_lat) / 2;
		expect(Math.abs(midLng - BERLIN.lng)).toBeLessThan(0.05);
		expect(Math.abs(midLat - BERLIN.lat)).toBeLessThan(0.05);
	});
});
