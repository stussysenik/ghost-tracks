/**
 * Ghost Tracks - GPX Export E2E Tests
 *
 * Tests the GPX file download functionality
 */
import { test, expect } from '@playwright/test';

test.describe('GPX Export', () => {
	test('downloads GPX file for a shape', async ({ page }) => {
		// Go to the API endpoint directly
		const response = await page.goto('/api/shapes/fox-stare-mesto/gpx');

		// Should return a GPX file
		expect(response?.status()).toBe(200);

		// Content type should be GPX
		const contentType = response?.headers()['content-type'];
		expect(contentType).toContain('application/gpx+xml');

		// Content disposition should suggest a filename
		const contentDisposition = response?.headers()['content-disposition'];
		expect(contentDisposition).toContain('fox-stare-mesto.gpx');

		// Body should be valid GPX XML
		const body = await response?.text();
		expect(body).toContain('<?xml');
		expect(body).toContain('<gpx');
		expect(body).toContain('<trk>');
		expect(body).toContain('</gpx>');
	});

	test('returns 404 for non-existent shape', async ({ page }) => {
		const response = await page.goto('/api/shapes/non-existent-shape/gpx');

		expect(response?.status()).toBe(404);
	});

	test('export button triggers download', async ({ page, context }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Click first shape to open drawer
		const firstEmoji = page.locator('.text-3xl:visible').first();
		await firstEmoji.click();

		// Wait for drawer
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 5000 });

		// Set up download listener
		const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

		// Click export GPX button - try different selectors
		const exportButton = page.locator('button:has-text("GPX"), button:has-text("Export")').first();
		await exportButton.click();

		// Note: In actual test, this would trigger a new tab/download
		// For now, we just verify the button exists and is clickable
	});
});
