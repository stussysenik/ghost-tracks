import { test, expect } from '@playwright/test';

test.describe('Map Interface', () => {
	test('loads the main page with mode switcher', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('[data-testid="mode-switcher"]')).toBeVisible();
		await expect(page.locator('[data-testid="mode-generate"]')).toBeVisible();
		await expect(page.locator('[data-testid="mode-describe"]')).toBeVisible();
	});

	test('generate mode shows neighborhood picker', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-generate"]');
		await expect(page.locator('[data-testid="neighborhood-picker"]')).toBeVisible();
		await expect(page.locator('[data-testid="generate-button"]')).toBeVisible();
	});

	test('describe mode shows text input', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-describe"]');
		await expect(page.locator('[data-testid="describe-input"]')).toBeVisible();
		await expect(page.locator('[data-testid="describe-button"]')).toBeVisible();
	});

	test('mode switching clears previous state', async ({ page }) => {
		await page.goto('/');
		await page.click('[data-testid="mode-describe"]');
		await expect(page.locator('[data-testid="describe-input"]')).toBeVisible();
		await page.click('[data-testid="mode-generate"]');
		await expect(page.locator('[data-testid="describe-input"]')).not.toBeVisible();
		await expect(page.locator('[data-testid="neighborhood-picker"]')).toBeVisible();
	});
});
