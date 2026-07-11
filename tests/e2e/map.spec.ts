import { test, expect } from '@playwright/test';

test.describe('Map Interface', () => {
	test('loads the main page with mode switcher', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-testid="mode-switcher"]')).toBeVisible();
		await expect(page.locator('[data-testid="mode-generate"]')).toBeVisible();
		await expect(page.locator('[data-testid="mode-describe"]')).toBeVisible();
	});

	test('area search is shared across both modes', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-generate"]');
		await expect(page.locator('[data-testid="area-search"]')).toBeVisible();
		await expect(page.locator('[data-testid="generate-button"]')).toBeVisible();

		await page.click('[data-testid="mode-describe"]');
		// The area picker persists (it is rendered above the mode panel).
		await expect(page.locator('[data-testid="area-search"]')).toBeVisible();
		await expect(page.locator('[data-testid="describe-input"]')).toBeVisible();
	});

	test('generate is blocked until an area is chosen', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-generate"]');
		await expect(page.locator('[data-testid="generate-button"]')).toBeDisabled();
	});

	test('describe mode shows text input', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-describe"]');
		await expect(page.locator('[data-testid="describe-input"]')).toBeVisible();
		await expect(page.locator('[data-testid="describe-button"]')).toBeVisible();
	});

	test('geocoding search selects a global area and unlocks generation', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-generate"]');

		await page.fill('[data-testid="area-search"]', 'Berlin');
		const berlin = page.locator('[data-testid="area-result"]', { hasText: 'Berlin, Germany' });
		await expect(berlin).toBeVisible({ timeout: 10000 });
		await berlin.click();

		await expect(page.locator('[data-testid="selected-area-label"]')).toContainText('Berlin');
		// Density gate resolves (ok / sparse / error) and the button unlocks when ok.
		await expect(page.locator('[data-testid="generate-button"]')).toBeEnabled({ timeout: 20000 });
	});
});
