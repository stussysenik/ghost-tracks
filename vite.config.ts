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
		// Allow access from mobile devices on same network
		host: true
	}
});
