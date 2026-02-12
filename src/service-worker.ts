/**
 * Ghost Tracks - Service Worker
 *
 * Provides offline caching for the PWA.
 * Caches static assets and map tiles for offline access.
 */
/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Unique cache name based on build version
const CACHE_NAME = `ghost-tracks-${version}`;

// Assets to cache immediately
const STATIC_ASSETS = [
	...build, // Built JS/CSS files
	...files  // Static files
];

// Install event - cache static assets
sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => cache.addAll(STATIC_ASSETS))
			.then(() => sw.skipWaiting())
	);
});

// Activate event - clean up old caches
sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key))
			);
		}).then(() => sw.clients.claim())
	);
});

// Fetch event - serve from cache, fallback to network
sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);

	// Skip non-GET requests
	if (event.request.method !== 'GET') return;

	// Skip external requests (except Mapbox tiles)
	if (url.origin !== sw.location.origin) {
		// Cache Mapbox tiles for offline use
		if (url.hostname.includes('mapbox.com') && url.pathname.includes('tiles')) {
			event.respondWith(
				caches.open(CACHE_NAME).then((cache) => {
					return cache.match(event.request).then((cached) => {
						if (cached) return cached;

						return fetch(event.request).then((response) => {
							// Only cache successful responses
							if (response.ok) {
								cache.put(event.request, response.clone());
							}
							return response;
						});
					});
				})
			);
		}
		return;
	}

	// Skip API requests (always fetch fresh)
	if (url.pathname.startsWith('/api')) return;

	// For static assets, try cache first
	if (STATIC_ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				return cached || fetch(event.request);
			})
		);
		return;
	}

	// For pages, try network first with cache fallback
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				// Cache HTML pages
				if (response.ok && event.request.headers.get('accept')?.includes('text/html')) {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(() => {
				return caches.match(event.request).then((cached) => {
					return cached || caches.match('/');
				});
			})
	);
});
