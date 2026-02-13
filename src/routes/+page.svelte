<script lang="ts">
	/**
	 * Ghost Tracks v2 - Main Page
	 *
	 * Two modes:
	 * - Generate: Pick a Prague neighborhood → get ASCII art route ideas
	 * - Describe: Type a description → get a validated, routed shape
	 */
	import { onMount } from 'svelte';
	import Map from '$components/Map.svelte';
	import ModeSwitcher from '$components/ModeSwitcher.svelte';
	import GeneratePanel from '$components/GeneratePanel.svelte';
	import DescribePanel from '$components/DescribePanel.svelte';
	import RouteInstructions from '$components/RouteInstructions.svelte';
	import Toast from '$components/Toast.svelte';
	import { addToast } from '$lib/stores/toasts.svelte';
	import type {
		AppMode,
		ShapeIdea,
		DescribeResponse,
		GeneratedRoute,
		WaypointMarker,
		BoundingBox,
		LineStringGeometry
	} from '$types';
	const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

	const SESSION_KEY = 'ghost-tracks-last-route';

	let mode = $state<AppMode>('generate');
	let generatedRoute = $state<GeneratedRoute | null>(null);
	let isRoutingIdea = $state(false);
	let mapRef: Map | null = $state(null);
	let showWaypoints = $state(true);

	// Restore last route from sessionStorage on mount
	onMount(() => {
		try {
			const saved = sessionStorage.getItem(SESSION_KEY);
			if (saved) {
				const route: GeneratedRoute = JSON.parse(saved);
				generatedRoute = route;
				mode = 'describe';
				// Fly to the route after map loads
				setTimeout(() => {
					if (mapRef) mapRef.flyToBounds(route.bbox);
				}, 1500);
			}
		} catch {
			// ignore parse errors
		}
	});

	function saveRoute(route: GeneratedRoute) {
		try {
			sessionStorage.setItem(SESSION_KEY, JSON.stringify(route));
		} catch {
			// storage full or unavailable
		}
	}

	function handleModeChange(newMode: AppMode) {
		mode = newMode;
		generatedRoute = null;
		showWaypoints = true;
	}

	function buildRoute(data: DescribeResponse): GeneratedRoute {
		return {
			shape: data.shape,
			routed_coordinates: data.routed_coordinates,
			distance_km: data.distance_km,
			duration_minutes: data.duration_minutes,
			waypoints: data.waypoints,
			similarity_score: data.similarity_score,
			neighborhood: data.neighborhood,
			bbox: [data.bbox.min_lng, data.bbox.min_lat, data.bbox.max_lng, data.bbox.max_lat],
			alternative_neighborhoods: data.alternative_neighborhoods
		};
	}

	function setRoute(route: GeneratedRoute) {
		generatedRoute = route;
		showWaypoints = true;
		saveRoute(route);
	}

	function showSimilarityToast(score: number) {
		if (score >= 85) {
			addToast('success', `Great match! ${Math.round(score)}% similarity`);
		} else if (score >= 50) {
			addToast('info', `${Math.round(score)}% match — try another neighborhood for better results`);
		} else if (score > 0) {
			addToast('warning', `Low match (${Math.round(score)}%) — consider a different shape or neighborhood`);
		}
	}

	async function handleIdeaSelected(idea: ShapeIdea) {
		isRoutingIdea = true;
		try {
			const response = await fetch('/api/describe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ description: idea.name })
			});

			if (!response.ok) throw new Error('Routing failed');

			const data: DescribeResponse = await response.json();
			const route = buildRoute(data);
			setRoute(route);
			showSimilarityToast(route.similarity_score);

			if (mapRef) {
				mapRef.flyToBounds(route.bbox);
			}
		} catch (err) {
			console.error('Failed to route idea:', err);
			addToast('error', 'Failed to generate route. Please try again.');
		} finally {
			isRoutingIdea = false;
		}
	}

	function handleDescribeResult(data: DescribeResponse) {
		const route = buildRoute(data);
		setRoute(route);
		showSimilarityToast(route.similarity_score);

		if (mapRef) {
			mapRef.flyToBounds(route.bbox);
		}
	}

	async function handleRetryNeighborhood(neighborhood: string) {
		if (!generatedRoute) return;

		isRoutingIdea = true;
		const shapeName = generatedRoute.shape.name;

		try {
			const response = await fetch('/api/describe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					description: shapeName,
					neighborhood
				})
			});

			if (!response.ok) throw new Error('Routing failed');

			const data: DescribeResponse = await response.json();
			const route = buildRoute(data);
			setRoute(route);
			showSimilarityToast(route.similarity_score);
			addToast('info', `Regenerated in ${neighborhood}`);

			if (mapRef) {
				mapRef.flyToBounds(route.bbox);
			}
		} catch (err) {
			console.error('Failed to retry in neighborhood:', err);
			addToast('error', `Failed to generate route in ${neighborhood}`);
		} finally {
			isRoutingIdea = false;
		}
	}

	async function handleExportGPX() {
		if (!generatedRoute) return;

		const { generateGPX } = await import('$lib/services/gpx');

		const shape = {
			name: generatedRoute.shape.name,
			geometry: {
				type: 'LineString' as const,
				coordinates: generatedRoute.routed_coordinates
			}
		};

		const gpxContent = generateGPX(shape as any, generatedRoute.routed_coordinates);
		const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ghost-tracks-${generatedRoute.shape.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50)}.gpx`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		addToast('success', 'GPX file downloaded');
	}

	function handleCloseRoute() {
		generatedRoute = null;
		showWaypoints = true;
	}

	function handleToggleWaypoints(show: boolean) {
		showWaypoints = show;
	}

	// Derive the route geometry for the map
	let routeGeometry = $derived<LineStringGeometry | null>(
		generatedRoute
			? { type: 'LineString', coordinates: generatedRoute.routed_coordinates }
			: null
	);

	let routeWaypoints = $derived<WaypointMarker[]>(generatedRoute?.waypoints ?? []);
</script>

<div class="relative h-full w-full overflow-hidden bg-slate-100">
	{#if mapboxToken}
		<Map
			bind:this={mapRef}
			accessToken={mapboxToken}
			routeGeometry={routeGeometry}
			waypoints={routeWaypoints}
			{showWaypoints}
		/>
	{:else}
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="glass rounded-2xl p-6 text-center max-w-sm">
				<div class="text-4xl mb-2">👻</div>
				<div class="font-semibold text-slate-900">Map token not configured</div>
				<div class="text-sm text-slate-600 mt-1">
					Set <code class="bg-slate-100 px-1 rounded">VITE_MAPBOX_ACCESS_TOKEN</code> to enable the map.
				</div>
			</div>
		</div>
	{/if}

	<!-- Top controls -->
	<div class="absolute top-0 left-0 right-0 safe-top z-20 pointer-events-none">
		<div class="p-4 space-y-3 pointer-events-auto max-w-lg">
			<div class="flex items-center gap-3">
				<div class="text-xl font-bold text-slate-800 glass rounded-full px-3 py-1.5">👻</div>
				<ModeSwitcher {mode} onModeChange={handleModeChange} />
			</div>

			{#if mode === 'generate'}
				<GeneratePanel onIdeaSelected={handleIdeaSelected} />
			{:else}
				<DescribePanel onRouteGenerated={handleDescribeResult} />
			{/if}

			{#if isRoutingIdea}
				<div class="glass rounded-xl p-3 text-sm text-slate-600 flex items-center gap-2">
					<span class="animate-spin">✨</span>
					Routing through real streets...
				</div>
			{/if}
		</div>
	</div>

	<!-- Route details panel -->
	{#if generatedRoute}
		<RouteInstructions
			route={generatedRoute}
			onExportGPX={handleExportGPX}
			onClose={handleCloseRoute}
			onRetryNeighborhood={handleRetryNeighborhood}
			onToggleWaypoints={handleToggleWaypoints}
		/>
	{/if}

	<!-- Toast notifications -->
	<Toast />
</div>
