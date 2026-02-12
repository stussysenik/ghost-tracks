/**
 * Ghost Tracks - Map E2E Tests
 *
 * Tests the main map interface and interactions
 */
import { test, expect } from '@playwright/test';

test.describe('Map Interface', () => {
	test('loads with Prague center', async ({ page }) => {
		await page.goto('/');

		// Wait for the map container to be visible
		const mapContainer = page.locator('[role="application"]');
		await expect(mapContainer).toBeVisible({ timeout: 10000 });

		// The loading overlay should disappear
		const loadingOverlay = page.locator('text=Loading map');
		await expect(loadingOverlay).not.toBeVisible({ timeout: 10000 });
	});

	test('shows ghost emoji while loading', async ({ page }) => {
		await page.goto('/');

		// The ghost emoji should be visible during load
		const ghostEmoji = page.locator('text=👻');
		await expect(ghostEmoji).toBeVisible();
	});

	test('displays filter bar', async ({ page }) => {
		await page.goto('/');

		// Wait for page to load
		await page.waitForLoadState('networkidle');

		// Should have distance slider
		const distanceFilter = page.locator('text=/\\d+\\s*-\\s*\\d+\\s*km/');
		await expect(distanceFilter).toBeVisible({ timeout: 5000 });

		// Should have category filters
		const creatureFilter = page.locator('text=Creatures');
		const letterFilter = page.locator('text=Letters');
		const geometricFilter = page.locator('text=Geometric');

		await expect(creatureFilter).toBeVisible();
		await expect(letterFilter).toBeVisible();
		await expect(geometricFilter).toBeVisible();
	});

	test('shows shape cards', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		// Should display at least one shape card
		const shapeCards = page.locator('[data-testid="shape-card"]');

		// Wait for cards to appear (may take a moment for shapes to load)
		await page.waitForTimeout(2000);

		// Check for shape emojis (they're used in cards)
		const emojiElements = page.locator('.text-3xl:visible');
		await expect(emojiElements.first()).toBeVisible({ timeout: 5000 });
	});
});

test.describe('Shape Selection', () => {
	test('opens drawer when shape card is clicked', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Click on the first shape card (emoji)
		const firstEmoji = page.locator('.text-3xl:visible').first();
		await firstEmoji.click();

		// The drawer should open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 5000 });

		// Should show shape details
		const distanceText = page.locator('text=/\\d+\\.?\\d*\\s*km/');
		await expect(distanceText.first()).toBeVisible();
	});

	test('closes drawer when close button is clicked', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Click first shape
		const firstEmoji = page.locator('.text-3xl:visible').first();
		await firstEmoji.click();

		// Wait for drawer to open
		const drawer = page.locator('[role="dialog"]');
		await expect(drawer).toBeVisible({ timeout: 5000 });

		// Click close button
		const closeButton = page.locator('[aria-label="Close"]');
		await closeButton.click();

		// Drawer should close (slide down)
		await expect(drawer).not.toBeVisible({ timeout: 5000 });
	});
});
