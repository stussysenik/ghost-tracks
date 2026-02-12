import { test, expect } from '@playwright/test';

test.describe('Map Interface', () => {
	test('loads primary UI and filters', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('text=Creatures')).toBeVisible();
		await expect(page.locator('text=Letters')).toBeVisible();
		await expect(page.locator('text=Shapes')).toBeVisible();

		const hasMap = (await page.locator('[role="application"]').count()) > 0;
		const hasFallbackCards = (await page.locator('[data-testid="shape-card"]').count()) > 0;
		expect(hasMap || hasFallbackCards).toBe(true);
	});

	test('supports viewport-based shape filtering endpoint', async ({ request }) => {
		const response = await request.get('/api/shapes?bbox=14.44,50.086,14.454,50.094&category=geometric');
		expect(response.status()).toBe(200);
		const data = await response.json();
		expect(data).toHaveProperty('count');
		expect(Array.isArray(data.shapes)).toBe(true);
	});
});
