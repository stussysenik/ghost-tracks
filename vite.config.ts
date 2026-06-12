// Ghost Tracks - Vite Configuration
// Optimized for performance with Tailwind CSS v4
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

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

	// Development server configuration
	server: {
		// Pin a dedicated port so the dev URL is ALWAYS the same address.
		// strictPort makes startup FAIL LOUDLY if 5180 is taken (by another project)
		// instead of silently roaming to 5181/5182 — no more "which localhost is it?"
		port: 5180,
		strictPort: true,
		// Allow access from mobile devices on same network
		host: true,
		// Allow tunnel hostnames (e.g. cloudflared)
		allowedHosts: ['.trycloudflare.com']
	}
});
