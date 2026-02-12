<script lang="ts">
	/**
	 * Ghost Tracks - Main Page
	 */
	import { onMount } from 'svelte';
	import Map from '$components/Map.svelte';
	import ShapeDrawer from '$components/ShapeDrawer.svelte';
	import SearchBar from '$components/SearchBar.svelte';
	import FilterBar from '$components/FilterBar.svelte';
	import { getAllShapes, getShapeById, getShapesInBounds, searchShapes, getRoutedShapes, getRoutedShapeById } from '$data/prague-shapes';
	import type { Shape, BoundingBox, ShapeCategory, LineStringGeometry } from '$types';

	const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

	let allShapes = $state<Shape[]>([]);
	let visibleShapes = $state<Shape[]>([]);
	let filteredShapes = $state<Shape[]>([]);
	let selectedShape = $state<Shape | null>(null);
	let selectedRouteGeometry = $state<LineStringGeometry | null>(null);
	let isDrawerOpen = $state(false);
	let mapRef: Map | null = $state(null);

	let selectedCategories = $state<ShapeCategory[]>(['creature', 'letter', 'geometric']);
	let distanceRange = $state<[number, number]>([0, 20]);
	let searchQuery = $state('');
	let isSearching = $state(false);
	let showRoutes = $state(true);
	let useRoutablePreview = $state(true);
	let currentBounds = $state<BoundingBox | null>(null);
	let currentCenter = $state<[number, number] | null>(null);

	onMount(() => {
		// Load routed shapes (snapped to actual streets) by default
		allShapes = useRoutablePreview ? getRoutedShapes() : getAllShapes();
		visibleShapes = allShapes;
		applyFilters();

		const shapeIdFromUrl = new URLSearchParams(window.location.search).get('shape');
		if (shapeIdFromUrl) {
			const shape = useRoutablePreview
				? getRoutedShapeById(shapeIdFromUrl)
				: getShapeById(shapeIdFromUrl);
			if (shape) {
				selectedShape = shape;
				isDrawerOpen = true;
				if (mapboxToken) {
					mapRef?.flyToShape(shape);
				}
				loadRouteGeometry(shape);
			}
		}
	});

	// Reload shapes when routable preview toggle changes
	$effect(() => {
		allShapes = useRoutablePreview ? getRoutedShapes() : getAllShapes();
		visibleShapes = allShapes;
		applyFilters();
	});

	function applyFilters() {
		const visibleIds = new Set(visibleShapes.map((shape) => shape.id));
		const searchSource = searchQuery ? searchShapes(searchQuery) : visibleShapes;
		filteredShapes = searchSource.filter((shape) => {
			if (!visibleIds.has(shape.id)) return false;
			if (!selectedCategories.includes(shape.category)) return false;
			if (shape.distance_km < distanceRange[0] || shape.distance_km > distanceRange[1]) return false;
			return true;
		});
	}

	function handleViewportChange(bounds: BoundingBox) {
		currentBounds = bounds;
		currentCenter = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
		visibleShapes = getShapesInBounds(bounds);
		applyFilters();
	}

	async function loadRouteGeometry(shape: Shape) {
		if (!useRoutablePreview) {
			selectedRouteGeometry = null;
			return;
		}

		try {
			const response = await fetch(`/api/shapes/${shape.id}/route`);
			if (!response.ok) {
				selectedRouteGeometry = null;
				return;
			}
			const data = await response.json();
			if (data?.geometry?.type === 'LineString') {
				selectedRouteGeometry = data.geometry as LineStringGeometry;
			} else {
				selectedRouteGeometry = null;
			}
		} catch {
			selectedRouteGeometry = null;
		}
	}

	function handleShapeClick(shape: Shape) {
		selectedShape = shape;
		isDrawerOpen = true;
		loadRouteGeometry(shape);
	}

	function handleCloseDrawer() {
		isDrawerOpen = false;
		setTimeout(() => {
			if (!isDrawerOpen) selectedShape = null;
		}, 300);
	}

	function handlePreviewShape(shape: Shape) {
		selectedShape = shape;
		mapRef?.flyToShape(shape);
		loadRouteGeometry(shape);
	}

	function handleFilterChange(categories: ShapeCategory[], distance: [number, number]) {
		selectedCategories = categories;
		distanceRange = distance;
		applyFilters();
	}

	function toggleRoutes() {
		showRoutes = !showRoutes;
	}

	function toggleRoutablePreview() {
		useRoutablePreview = !useRoutablePreview;
		if (!useRoutablePreview) {
			selectedRouteGeometry = null;
		} else if (selectedShape) {
			loadRouteGeometry(selectedShape);
		}
	}

	async function handleSearch(query: string) {
		searchQuery = query;
		applyFilters();

		isSearching = true;
		try {
			const response = await fetch('/api/suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt: query,
					viewport: currentBounds
						? { bounds: currentBounds, center: currentCenter ?? [14.4378, 50.0755] }
						: undefined,
					preferences: {
						distance_min: distanceRange[0],
						distance_max: distanceRange[1],
						categories: selectedCategories
					}
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data?.shape) {
					selectedShape = data.shape;
					isDrawerOpen = true;
					mapRef?.flyToShape(data.shape);
					loadRouteGeometry(data.shape);
				}
			}
		} finally {
			isSearching = false;
		}
	}
</script>

<div class="relative h-full w-full overflow-hidden bg-slate-100">
	{#if mapboxToken}
		<Map
			bind:this={mapRef}
			accessToken={mapboxToken}
			shapes={filteredShapes}
			selectedShape={selectedShape}
			{selectedRouteGeometry}
			{showRoutes}
			onViewportChange={handleViewportChange}
			onShapeClick={handleShapeClick}
		/>
	{:else}
		<div class="absolute inset-0 flex items-start justify-center pt-24 px-4 pb-44 overflow-y-auto">
			<div class="max-w-3xl w-full space-y-3">
				<div class="glass rounded-2xl p-4 text-sm text-slate-700">
					<div class="font-semibold text-slate-900">Map token not configured</div>
					<div>Browse and export routes below. Set <code>VITE_MAPBOX_ACCESS_TOKEN</code> to enable map mode.</div>
				</div>
				{#if filteredShapes.length === 0}
					<div class="glass rounded-2xl p-4 text-slate-600">No shape routes match your current filters.</div>
				{:else}
					{#each filteredShapes as shape}
						<button
							type="button"
							class="shape-card glass w-full rounded-2xl p-4 text-left"
							data-testid="shape-card"
							onclick={() => handleShapeClick(shape)}
						>
							<div class="flex items-center gap-3">
								<div class="text-3xl">{shape.emoji}</div>
								<div class="min-w-0">
									<div class="font-semibold text-slate-900 truncate">{shape.name}</div>
									<div class="text-sm text-slate-600 truncate">{shape.area} · {shape.distance_km} km</div>
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}

	<div class="absolute top-0 left-0 right-0 safe-top z-20 pointer-events-none">
		<div class="p-4 space-y-3 pointer-events-auto">
			<SearchBar
				onSearch={handleSearch}
				placeholder="Describe your dream route..."
				isLoading={isSearching}
			/>

			<FilterBar
				{selectedCategories}
				{distanceRange}
				onFilterChange={handleFilterChange}
			/>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={toggleRoutes}
					class="glass rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/95"
				>
					{showRoutes ? 'Hide routes' : 'Show routes'}
				</button>
				<button
					type="button"
					onclick={toggleRoutablePreview}
					disabled={!showRoutes}
					class="glass rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white/95 disabled:opacity-50"
				>
					{useRoutablePreview ? 'Routable preview on' : 'Routable preview off'}
				</button>
			</div>
		</div>
	</div>

	<div class="absolute left-4 bottom-24 z-20 pointer-events-none">
		<div class="glass rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm pointer-events-auto">
			<span class="text-ghost">{filteredShapes.length}</span> ghost routes
		</div>
	</div>

	<div class="absolute right-4 bottom-24 z-20 pointer-events-none">
		<div class="glass rounded-lg px-3 py-2 text-xs text-slate-600 max-w-[180px] shadow-sm pointer-events-auto">
			<span class="font-medium">Remember:</span> These are suggestions. The sky's the limit.
		</div>
	</div>

	{#if selectedShape}
		<ShapeDrawer
			shape={selectedShape}
			isOpen={isDrawerOpen}
			onClose={handleCloseDrawer}
			onPreview={() => handlePreviewShape(selectedShape!)}
		/>
	{/if}
</div>
