/**
 * Ghost Tracks - Shareable Shape Page E2E Tests
 *
 * Tests the public shareable route pages
 */
import { test, expect } from '@playwright/test';

test.describe('Shareable Shape Page', () => {
	test('loads shape page with details', async ({ page }) => {
		await page.goto('/shape/fox-stare-mesto');

		// Should show shape name
		await expect(page.locator('h1')).toContainText('Fox');

		// Should show emoji
		await expect(page.locator('text=🦊')).toBeVisible();

		// Should show distance
		await expect(page.locator('text=/\\d+\\.?\\d*.*km/')).toBeVisible();

		// Should show area
		await expect(page.locator('text=Staré Město')).toBeVisible();
	});

	test('has correct meta tags for social sharing', async ({ page }) => {
		await page.goto('/shape/fox-stare-mesto');

		// Check Open Graph tags
		const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
		expect(ogTitle).toContain('Fox');

		const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
		expect(ogDescription).toContain('creature');

		const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
		expect(ogType).toBe('website');

		// Check Twitter Card
		const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
		expect(twitterCard).toBe('summary_large_image');
	});

	test('has export and share buttons', async ({ page }) => {
		await page.goto('/shape/fox-stare-mesto');

		// Should have GPX export button
		const exportButton = page.locator('button:has-text("GPX"), button:has-text("Download")');
		await expect(exportButton.first()).toBeVisible();

		// Should have share button
		const shareButton = page.locator('button:has-text("Share")');
		await expect(shareButton).toBeVisible();

		// Should have view on map button
		const mapButton = page.locator('button:has-text("Map")');
		await expect(mapButton).toBeVisible();
	});

	test('returns 404 for non-existent shape', async ({ page }) => {
		const response = await page.goto('/shape/non-existent-shape');

		expect(response?.status()).toBe(404);
	});

	test('view on map redirects to main app', async ({ page }) => {
		await page.goto('/shape/fox-stare-mesto');

		const mapButton = page.locator('button:has-text("Map")');
		await mapButton.click();

		// Should redirect to main app with shape parameter
		await page.waitForURL('/?shape=fox-stare-mesto');
	});
});
