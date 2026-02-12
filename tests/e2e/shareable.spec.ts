import { test, expect } from '@playwright/test';

test.describe('Shareable Shape Page', () => {
	test('loads canonical shape page with details', async ({ page }) => {
		await page.goto('/shape/prague-fox-1');
		await expect(page.locator('h1')).toContainText('Fox');
		await expect(page.locator('p').filter({ hasText: 'Staré Město, Prague' })).toHaveCount(1);
	});

	test('has expected share metadata and actions', async ({ page }) => {
		await page.goto('/shape/prague-fox-1');

		const ogTitle = await page.locator('meta[property="og:title"]').last().getAttribute('content');
		expect(ogTitle).toContain('Fox');

		const ogType = await page.locator('meta[property="og:type"]').last().getAttribute('content');
		expect(ogType).toBe('website');

		await expect(page.locator('button:has-text("Download GPX")')).toBeVisible();
		await expect(page.locator('button:has-text("Share")')).toBeVisible();
		await expect(page.locator('button:has-text("View on Map")')).toBeVisible();
	});

	test('returns 404 for non-existent shape', async ({ page }) => {
		const response = await page.goto('/shape/non-existent-shape');
		expect(response?.status()).toBe(404);
	});

	test('view on map redirects to main app with canonical shape query', async ({ page }) => {
		await page.goto('/shape/prague-fox-1');
		await page.locator('button:has-text("View on Map")').click();
		await page.waitForURL('/?shape=prague-fox-1');
	});
});
