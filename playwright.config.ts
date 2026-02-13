import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	timeout: 60000,
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: [
		{
			command: 'cd backend && source .venv/bin/activate && uvicorn main:app --host 127.0.0.1 --port 8000',
			url: 'http://127.0.0.1:8000/health/',
			reuseExistingServer: !process.env.CI,
			timeout: 30000
		},
		{
			command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
			url: 'http://127.0.0.1:4173',
			reuseExistingServer: !process.env.CI,
			timeout: 120000
		}
	]
});
