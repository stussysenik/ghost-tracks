<script lang="ts">
	/**
	 * Ghost Tracks - Map Component
	 *
	 * Interactive Mapbox GL JS map optimized for mobile with:
	 * - Hardware-accelerated rendering
	 * - Touch-friendly controls
	 * - Ghost route overlay layers
	 * - Viewport change events for loading shapes
	 */
	import { onMount, onDestroy } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import type { Shape, ShapeFeatureCollection, BoundingBox } from '$types';

	// Props
	interface Props {
		/** Mapbox access token (required) */
		accessToken: string;
		/** Initial center coordinates [lng, lat] - defaults to Prague */
		center?: [number, number];
		/** Initial zoom level */
		zoom?: number;
		/** Shapes to display as ghost routes */
		shapes?: Shape[];
		/** Currently selected shape (highlighted) */
		selectedShape?: Shape | null;
		/** Callback when map viewport changes (for loading shapes) */
		onViewportChange?: (bounds: BoundingBox) => void;
		/** Callback when a shape is clicked */
		onShapeClick?: (shape: Shape) => void;
	}

	let {
		accessToken,
		center = [14.4378, 50.0755], // Prague center
		zoom = 13,
		shapes = [],
		selectedShape = null,
		onViewportChange,
		onShapeClick
	}: Props = $props();

	// Map instance reference
	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let isMapLoaded = $state(false);

	// Layer IDs for ghost routes
	const GHOST_LAYER_ID = 'ghost-routes';
	const GHOST_SOURCE_ID = 'ghost-routes-source';
	const SELECTED_LAYER_ID = 'selected-route';
	const SELECTED_SOURCE_ID = 'selected-route-source';

	/**
	 * Convert shapes to GeoJSON FeatureCollection for map rendering
	 */
	function shapesToGeoJSON(shapes: Shape[]): ShapeFeatureCollection {
		return {
			type: 'FeatureCollection',
			features: shapes.map(shape => ({
				type: 'Feature',
				id: shape.id,
				properties: {
					id: shape.id,
					name: shape.name,
					emoji: shape.emoji,
					category: shape.category,
					distance_km: shape.distance_km,
					difficulty: shape.difficulty,
					estimated_minutes: shape.estimated_minutes,
					area: shape.area,
					description: shape.description
				},
				geometry: shape.geometry,
				bbox: shape.bbox
			}))
		};
	}

	/**
	 * Get map bounds as BoundingBox tuple
	 */
	function getBounds(): BoundingBox {
		if (!map) return [0, 0, 0, 0];
		const bounds = map.getBounds();
		if (!bounds) return [0, 0, 0, 0];
		return [
			bounds.getWest(),
			bounds.getSouth(),
			bounds.getEast(),
			bounds.getNorth()
		];
	}

	/**
	 * Update ghost routes layer with new shapes
	 */
	function updateGhostRoutes(shapes: Shape[]) {
		if (!map || !isMapLoaded) return;

		const source = map.getSource(GHOST_SOURCE_ID) as mapboxgl.GeoJSONSource;
		if (source) {
			source.setData(shapesToGeoJSON(shapes));
		}
	}

	/**
	 * Update selected route highlight
	 */
	function updateSelectedRoute(shape: Shape | null) {
		if (!map || !isMapLoaded) return;

		const source = map.getSource(SELECTED_SOURCE_ID) as mapboxgl.GeoJSONSource;
		if (source) {
			source.setData(
				shape
					? shapesToGeoJSON([shape])
					: { type: 'FeatureCollection', features: [] }
			);
		}
	}

	/**
	 * Initialize the map
	 */
	onMount(() => {
		// Set access token
		mapboxgl.accessToken = accessToken;

		// Create map instance
		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/light-v11', // Clean, minimal style
			center: center,
			zoom: zoom,
			minZoom: 10,
			maxZoom: 18,
			attributionControl: true,
			// Mobile optimizations
			touchZoomRotate: true,
			touchPitch: false, // Disable pitch for 2D simplicity
			dragRotate: false, // Disable rotation for cleaner UX
			// Performance
			antialias: true,
			preserveDrawingBuffer: false
		});

		// Add navigation controls (top-right, desktop only)
		map.addControl(
			new mapboxgl.NavigationControl({ showCompass: false }),
			'top-right'
		);

		// Add geolocation control
		map.addControl(
			new mapboxgl.GeolocateControl({
				positionOptions: { enableHighAccuracy: true },
				trackUserLocation: true,
				showUserHeading: true
			}),
			'top-right'
		);

		// Add scale control
		map.addControl(
			new mapboxgl.ScaleControl({ maxWidth: 100 }),
			'bottom-left'
		);

		// Map load handler - set up layers
		map.on('load', () => {
			isMapLoaded = true;

			// Add source for ghost routes (all routes)
			map!.addSource(GHOST_SOURCE_ID, {
				type: 'geojson',
				data: shapesToGeoJSON(shapes)
			});

			// Ghost routes layer - faint, pulsing lines
			map!.addLayer({
				id: GHOST_LAYER_ID,
				type: 'line',
				source: GHOST_SOURCE_ID,
				paint: {
					'line-color': '#FF6B35',
					'line-width': 4,
					'line-opacity': 0.4,
					'line-blur': 1
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round'
				}
			});

			// Add source for selected route (highlighted)
			map!.addSource(SELECTED_SOURCE_ID, {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			// Selected route layer - bold, vibrant
			map!.addLayer({
				id: SELECTED_LAYER_ID,
				type: 'line',
				source: SELECTED_SOURCE_ID,
				paint: {
					'line-color': '#FF6B35',
					'line-width': 6,
					'line-opacity': 0.9
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round'
				}
			});

			// Notify parent of initial bounds
			onViewportChange?.(getBounds());
		});

		// Handle map movement (pan/zoom)
		map.on('moveend', () => {
			if (isMapLoaded) {
				onViewportChange?.(getBounds());
			}
		});

		// Handle clicks on ghost routes
		map.on('click', GHOST_LAYER_ID, (e) => {
			if (e.features && e.features.length > 0) {
				const clickedFeature = e.features[0];
				const shapeId = clickedFeature.properties?.id;
				const clickedShape = shapes.find(s => s.id === shapeId);
				if (clickedShape) {
					onShapeClick?.(clickedShape);
				}
			}
		});

		// Change cursor on hover
		map.on('mouseenter', GHOST_LAYER_ID, () => {
			if (map) map.getCanvas().style.cursor = 'pointer';
		});

		map.on('mouseleave', GHOST_LAYER_ID, () => {
			if (map) map.getCanvas().style.cursor = '';
		});
	});

	// Update ghost routes when shapes change
	$effect(() => {
		updateGhostRoutes(shapes);
	});

	// Update selected route when selection changes
	$effect(() => {
		updateSelectedRoute(selectedShape);
	});

	// Cleanup
	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
	});

	/**
	 * Fly to a specific shape's bounding box
	 */
	export function flyToShape(shape: Shape) {
		if (!map || !isMapLoaded) return;
		map.fitBounds(shape.bbox as mapboxgl.LngLatBoundsLike, {
			padding: 50,
			duration: 1000
		});
	}

	/**
	 * Fly to a location
	 */
	export function flyTo(lng: number, lat: number, zoom?: number) {
		if (!map || !isMapLoaded) return;
		map.flyTo({
			center: [lng, lat],
			zoom: zoom ?? map.getZoom(),
			duration: 1000
		});
	}
</script>

<!-- Map container - fills parent -->
<div
	bind:this={mapContainer}
	class="absolute inset-0 w-full h-full"
	role="application"
	aria-label="Interactive map showing ghost routes"
></div>

<!-- Loading overlay (shows until map loads) -->
{#if !isMapLoaded}
	<div class="absolute inset-0 flex items-center justify-center bg-slate-100">
		<div class="text-center">
			<div class="text-4xl mb-2 animate-pulse">👻</div>
			<p class="text-slate-500 text-sm">Loading map...</p>
		</div>
	</div>
{/if}

<style>
	/* Ensure map container takes full space */
	div[role="application"] {
		z-index: var(--z-map, 0);
	}
</style>
