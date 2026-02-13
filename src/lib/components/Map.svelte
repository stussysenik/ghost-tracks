<script lang="ts">
	/**
	 * Ghost Tracks v2 - Map Component
	 *
	 * Displays the Mapbox map with:
	 * - A generated route as a blue line
	 * - Numbered waypoint markers at turn points
	 */
	import { onMount, onDestroy } from 'svelte';
	import { writable, get } from 'svelte/store';
	import mapboxgl from 'mapbox-gl';
	import type { LineStringGeometry, BoundingBox, WaypointMarker } from '$types';

	interface Props {
		accessToken: string;
		center?: [number, number];
		zoom?: number;
		routeGeometry?: LineStringGeometry | null;
		waypoints?: WaypointMarker[];
		showWaypoints?: boolean;
	}

	let {
		accessToken,
		center = [14.4378, 50.0755],
		zoom = 13,
		routeGeometry = null,
		waypoints = [],
		showWaypoints = true
	}: Props = $props();

	let mapContainer: HTMLDivElement;
	let loadingOverlay: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	const isMapLoaded = writable(false);
	let waypointMarkers: mapboxgl.Marker[] = [];

	const ROUTE_LAYER_ID = 'generated-route';
	const ROUTE_SOURCE_ID = 'generated-route-source';

	function updateRoute(geometry: LineStringGeometry | null) {
		if (!map || !get(isMapLoaded)) return;
		const source = map.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource;
		if (!source) return;

		if (!geometry) {
			source.setData({ type: 'FeatureCollection', features: [] });
			return;
		}

		source.setData({
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {},
					geometry: geometry
				}
			]
		});
	}

	function updateWaypoints(wps: WaypointMarker[]) {
		// Remove old markers
		waypointMarkers.forEach((m) => m.remove());
		waypointMarkers = [];

		if (!map || !get(isMapLoaded) || wps.length === 0) return;

		for (const wp of wps) {
			const el = document.createElement('div');
			el.className = 'waypoint-marker';
			el.setAttribute('data-testid', 'waypoint-marker');
			el.textContent = String(wp.index);

			const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(
				wp.instruction
			);

			const marker = new mapboxgl.Marker({ element: el })
				.setLngLat([wp.lng, wp.lat])
				.setPopup(popup)
				.addTo(map);

			waypointMarkers.push(marker);
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

		map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

		map.addControl(
			new mapboxgl.GeolocateControl({
				positionOptions: { enableHighAccuracy: true },
				trackUserLocation: true,
				showUserHeading: true
			}),
			'top-right'
		);

		map.addControl(new mapboxgl.ScaleControl({ maxWidth: 100 }), 'bottom-left');

		map.on('load', () => {
			isMapLoaded.set(true);
			if (loadingOverlay) {
				loadingOverlay.style.opacity = '0';
				loadingOverlay.style.pointerEvents = 'none';
			}

			map!.addSource(ROUTE_SOURCE_ID, {
				type: 'geojson',
				data: { type: 'FeatureCollection', features: [] }
			});

			map!.addLayer({
				id: ROUTE_LAYER_ID,
				type: 'line',
				source: ROUTE_SOURCE_ID,
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

			// Apply initial route if any
			updateRoute(routeGeometry);
			updateWaypoints(waypoints);
		});
	});

	$effect(() => {
		updateRoute(routeGeometry);
	});

	$effect(() => {
		updateWaypoints(waypoints);
	});

	$effect(() => {
		// Read showWaypoints outside the loop so Svelte always tracks it,
		// even when waypointMarkers is empty on first run.
		const show = showWaypoints;
		for (const m of waypointMarkers) {
			m.getElement().style.display = show ? '' : 'none';
			const popup = m.getPopup();
			if (!show && popup?.isOpen()) {
				m.togglePopup();
			}
		}
	});

	onDestroy(() => {
		waypointMarkers.forEach((m) => m.remove());
		if (map) {
			map.remove();
			map = null;
		}
	});

	export function flyToBounds(bbox: BoundingBox) {
		if (!map || !get(isMapLoaded)) return;
		map.fitBounds(bbox as mapboxgl.LngLatBoundsLike, {
			padding: 60,
			duration: 1000
		});
	}

	export function flyTo(lng: number, lat: number, z?: number) {
		if (!map || !get(isMapLoaded)) return;
		map.flyTo({
			center: [lng, lat],
			zoom: z ?? map.getZoom(),
			duration: 1000
		});
	}
</script>

<div
	bind:this={mapContainer}
	class="absolute inset-0 w-full h-full"
	role="application"
	aria-label="Interactive map showing generated route"
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
	div[role='application'] {
		z-index: var(--z-map, 0);
	}

	:global(.waypoint-marker) {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #ff6b35;
		color: white;
		font-size: 12px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
		cursor: pointer;
	}
</style>
