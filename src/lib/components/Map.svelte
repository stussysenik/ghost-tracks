<script lang="ts">
	/**
	 * Ghost Tracks - Map Component
	 */
	import { onMount, onDestroy } from 'svelte';
	import { writable, get } from 'svelte/store';
	import mapboxgl from 'mapbox-gl';
	import type { Shape, ShapeFeatureCollection, BoundingBox, LineStringGeometry } from '$types';

	interface Props {
		accessToken: string;
		center?: [number, number];
		zoom?: number;
		shapes?: Shape[];
		selectedShape?: Shape | null;
		selectedRouteGeometry?: LineStringGeometry | null;
		showRoutes?: boolean;
		onViewportChange?: (bounds: BoundingBox) => void;
		onShapeClick?: (shape: Shape) => void;
	}

	let {
		accessToken,
		center = [14.4378, 50.0755],
		zoom = 13,
		shapes = [],
		selectedShape = null,
		selectedRouteGeometry = null,
		showRoutes = true,
		onViewportChange,
		onShapeClick
	}: Props = $props();

	let mapContainer: HTMLDivElement;
	let loadingOverlay: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	const isMapLoaded = writable(false);

	const GHOST_LAYER_ID = 'ghost-routes';
	const GHOST_SOURCE_ID = 'ghost-routes-source';
	const SELECTED_LAYER_ID = 'selected-route';
	const SELECTED_SOURCE_ID = 'selected-route-source';

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

	function selectedToGeoJSON(shape: Shape, geometry?: LineStringGeometry | null): ShapeFeatureCollection {
		return {
			type: 'FeatureCollection',
			features: [
				{
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
					geometry: geometry ?? shape.geometry,
					bbox: shape.bbox
				}
			]
		};
	}

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

	function updateGhostRoutes(shapes: Shape[]) {
		if (!map || !get(isMapLoaded)) return;
		const source = map.getSource(GHOST_SOURCE_ID) as mapboxgl.GeoJSONSource;
		if (source) {
			source.setData(shapesToGeoJSON(shapes));
		}
	}

	function updateSelectedRoute(shape: Shape | null, geometry?: LineStringGeometry | null) {
		if (!map || !get(isMapLoaded)) return;
		const source = map.getSource(SELECTED_SOURCE_ID) as mapboxgl.GeoJSONSource;
		if (!source) return;

		if (!shape) {
			source.setData({ type: 'FeatureCollection', features: [] });
			return;
		}

		source.setData(selectedToGeoJSON(shape, geometry));
	}

	function updateVisibility(visible: boolean) {
		if (!map || !get(isMapLoaded)) return;
		const visibility = visible ? 'visible' : 'none';
		if (map.getLayer(GHOST_LAYER_ID)) {
			map.setLayoutProperty(GHOST_LAYER_ID, 'visibility', visibility);
		}
		if (map.getLayer(SELECTED_LAYER_ID)) {
			map.setLayoutProperty(SELECTED_LAYER_ID, 'visibility', visibility);
		}
	}

	onMount(() => {
		mapboxgl.accessToken = accessToken;

		map = new mapboxgl.Map({
			container: mapContainer,
			style: 'mapbox://styles/mapbox/light-v11',
			center: center,
			zoom: zoom,
			minZoom: 10,
			maxZoom: 18,
			attributionControl: true,
			touchZoomRotate: true,
			touchPitch: false,
			dragRotate: false,
			antialias: true,
			preserveDrawingBuffer: false
		});

		map.addControl(
			new mapboxgl.NavigationControl({ showCompass: false }),
			'top-right'
		);

		map.addControl(
			new mapboxgl.GeolocateControl({
				positionOptions: { enableHighAccuracy: true },
				trackUserLocation: true,
				showUserHeading: true
			}),
			'top-right'
		);

		map.addControl(
			new mapboxgl.ScaleControl({ maxWidth: 100 }),
			'bottom-left'
		);

		map.on('load', () => {
			isMapLoaded.set(true);
			// Hide loading overlay directly (workaround for Svelte 5 store reactivity)
			if (loadingOverlay) {
				loadingOverlay.style.opacity = '0';
				loadingOverlay.style.pointerEvents = 'none';
			}

			map!.addSource(GHOST_SOURCE_ID, {
				type: 'geojson',
				data: shapesToGeoJSON(shapes)
			});

			map!.addLayer({
				id: GHOST_LAYER_ID,
				type: 'line',
				source: GHOST_SOURCE_ID,
				paint: {
					'line-color': '#FF6B35',
					'line-width': 3,
					'line-opacity': 0.35,
					'line-blur': 1
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round'
				}
			});

			map!.addSource(SELECTED_SOURCE_ID, {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			map!.addLayer({
				id: SELECTED_LAYER_ID,
				type: 'line',
				source: SELECTED_SOURCE_ID,
				paint: {
					'line-color': '#3B82F6',
					'line-width': 5,
					'line-opacity': 0.9
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round'
				}
			});

			updateVisibility(showRoutes);
			onViewportChange?.(getBounds());
		});

		map.on('moveend', () => {
			if (get(isMapLoaded)) {
				onViewportChange?.(getBounds());
			}
		});

		map.on('click', GHOST_LAYER_ID, (e) => {
			if (!showRoutes) return;
			if (e.features && e.features.length > 0) {
				const clickedFeature = e.features[0];
				const shapeId = clickedFeature.properties?.id;
				const clickedShape = shapes.find(s => s.id === shapeId);
				if (clickedShape) {
					onShapeClick?.(clickedShape);
				}
			}
		});

		map.on('mouseenter', GHOST_LAYER_ID, () => {
			if (map) map.getCanvas().style.cursor = 'pointer';
		});

		map.on('mouseleave', GHOST_LAYER_ID, () => {
			if (map) map.getCanvas().style.cursor = '';
		});
	});

	$effect(() => {
		updateGhostRoutes(shapes);
	});

	$effect(() => {
		updateSelectedRoute(selectedShape, selectedRouteGeometry);
	});

	$effect(() => {
		updateVisibility(showRoutes);
	});

	onDestroy(() => {
		if (map) {
			map.remove();
			map = null;
		}
	});

	export function flyToShape(shape: Shape) {
		if (!map || !get(isMapLoaded)) return;
		map.fitBounds(shape.bbox as mapboxgl.LngLatBoundsLike, {
			padding: 50,
			duration: 1000
		});
	}

	export function flyTo(lng: number, lat: number, zoom?: number) {
		if (!map || !get(isMapLoaded)) return;
		map.flyTo({
			center: [lng, lat],
			zoom: zoom ?? map.getZoom(),
			duration: 1000
		});
	}
</script>

<div
	bind:this={mapContainer}
	class="absolute inset-0 w-full h-full"
	role="application"
	aria-label="Interactive map showing ghost routes"
></div>

<div
	bind:this={loadingOverlay}
	class="absolute inset-0 flex items-center justify-center bg-slate-100 transition-opacity duration-300"
>
	<div class="text-center">
		<div class="text-4xl mb-2 animate-pulse">👻</div>
		<p class="text-slate-500 text-sm">Loading map...</p>
	</div>
</div>

<style>
	div[role="application"] {
		z-index: var(--z-map, 0);
	}
</style>
