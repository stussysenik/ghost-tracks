// Ghost Tracks - SvelteKit Configuration
// Configured for Vercel deployment with serverless functions
import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Enable preprocessing for TypeScript and PostCSS (Tailwind)
	preprocess: vitePreprocess(),

	kit: {
		// Use Vercel adapter for serverless deployment
		// Edge functions don't support Node.js crypto (needed by gpx-builder)
		adapter: adapter({
			// Use serverless functions (Node.js runtime)
			runtime: 'nodejs22.x',
			// Split routes for optimal caching
			split: true
		}),

		// Alias for clean imports
		alias: {
			$components: 'src/lib/components',
			$stores: 'src/lib/stores',
			$services: 'src/lib/services',
			$types: 'src/lib/types',
			$data: 'src/lib/data'
		}
	}
};

export default config;
