// Ghost Tracks - Vite Configuration
// Optimized for performance with Tailwind CSS v4
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		// Tailwind CSS v4 plugin for zero-config styling
		tailwindcss(),
		// SvelteKit plugin for SSR and routing
		sveltekit()
	],

	// Optimize dependencies for faster cold starts
	optimizeDeps: {
		include: ['mapbox-gl']
	},

	// Build optimization
	build: {
		// Target modern browsers for smaller bundles
		target: 'esnext',
		// Enable source maps for debugging in production
		sourcemap: true
	},

	// Unit tests. Scoped to src/ so Playwright keeps tests/ to itself — the two
	// runners share a repo, not a directory.
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	},

	// Development server configuration
	server: {
		// Allow access from mobile devices on same network
		host: true,
		// Allow tunnel hostnames (e.g. cloudflared)
		allowedHosts: ['.trycloudflare.com']
	}
});
