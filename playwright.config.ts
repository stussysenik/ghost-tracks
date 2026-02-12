/**
 * Ghost Tracks - Playwright E2E Test Configuration
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	// Test directory
	testDir: './tests/e2e',

	// Run tests in parallel
	fullyParallel: true,

	// Fail the build on CI if you accidentally left test.only
	forbidOnly: !!process.env.CI,

	// Retry on CI only
	retries: process.env.CI ? 2 : 0,

	// Opt out of parallel tests on CI
	workers: process.env.CI ? 1 : undefined,

	// Reporter configuration
	reporter: 'html',

	// Shared settings for all projects
	use: {
		// Base URL for tests
		baseURL: 'http://localhost:4173',

		// Collect trace when retrying
		trace: 'on-first-retry',

		// Take screenshot on failure
		screenshot: 'only-on-failure'
	},

	// Test projects for different browsers
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'Mobile Safari',
			use: { ...devices['iPhone 13'] }
		}
	],

	// Run local dev server before starting tests
	webServer: {
		command: 'npm run preview',
		url: 'http://localhost:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
});
