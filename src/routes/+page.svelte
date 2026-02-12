<script lang="ts">
	/**
	 * Ghost Tracks - Main Page
	 *
	 * The discovery interface where users explore Prague and find hidden routes.
	 * Optimized for mobile-first interaction with:
	 * - Full-screen map
	 * - Bottom sheet for shape details
	 * - Search bar for AI suggestions
	 * - Filter controls
	 */
	import { onMount } from 'svelte';
	import Map from '$components/Map.svelte';
	import ShapeDrawer from '$components/ShapeDrawer.svelte';
	import SearchBar from '$components/SearchBar.svelte';
	import FilterBar from '$components/FilterBar.svelte';
	import { getAllShapes, getShapesInBounds } from '$data/prague-shapes';
	import type { Shape, BoundingBox, ShapeCategory } from '$types';

	// Map access token from environment
	const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

	// State
	let shapes = $state<Shape[]>([]);
	let filteredShapes = $state<Shape[]>([]);
	let selectedShape = $state<Shape | null>(null);
	let isDrawerOpen = $state(false);
	let mapRef: Map;

	// Filter state
	let selectedCategories = $state<ShapeCategory[]>(['creature', 'letter', 'geometric']);
	let distanceRange = $state<[number, number]>([0, 20]);
	let searchQuery = $state('');

	// Load shapes on mount
	onMount(() => {
		shapes = getAllShapes();
		filteredShapes = shapes;
	});

	/**
	 * Handle viewport change - load shapes in visible area
	 */
	function handleViewportChange(bounds: BoundingBox) {
		// Get shapes in the current viewport
		const visibleShapes = getShapesInBounds(bounds);

		// Apply filters
		filteredShapes = visibleShapes.filter(shape => {
			// Category filter
			if (!selectedCategories.includes(shape.category)) return false;

			// Distance filter
			if (shape.distance_km < distanceRange[0] || shape.distance_km > distanceRange[1]) {
				return false;
			}

			return true;
		});
	}

	/**
	 * Handle shape click - open drawer with details
	 */
	function handleShapeClick(shape: Shape) {
		selectedShape = shape;
		isDrawerOpen = true;
	}

	/**
	 * Close the drawer
	 */
	function handleCloseDrawer() {
		isDrawerOpen = false;
		// Keep shape selected for a moment for visual continuity
		setTimeout(() => {
			if (!isDrawerOpen) selectedShape = null;
		}, 300);
	}

	/**
	 * Preview shape on map
	 */
	function handlePreviewShape(shape: Shape) {
		selectedShape = shape;
		mapRef?.flyToShape(shape);
	}

	/**
	 * Handle filter changes
	 */
	function handleFilterChange(categories: ShapeCategory[], distance: [number, number]) {
		selectedCategories = categories;
		distanceRange = distance;

		// Re-filter with current shapes
		filteredShapes = shapes.filter(shape => {
			if (!categories.includes(shape.category)) return false;
			if (shape.distance_km < distance[0] || shape.distance_km > distance[1]) return false;
			return true;
		});
	}

	/**
	 * Handle AI search
	 */
	async function handleSearch(query: string) {
		searchQuery = query;
		// TODO: Integrate with AI suggestion API
		console.log('Search query:', query);
	}
</script>

<!-- Main container - full screen -->
<div class="relative h-full w-full overflow-hidden bg-slate-100">
	<!-- Map layer -->
	{#if mapboxToken}
		<Map
			bind:this={mapRef}
			accessToken={mapboxToken}
			shapes={filteredShapes}
			{selectedShape}
			onViewportChange={handleViewportChange}
			onShapeClick={handleShapeClick}
		/>
	{:else}
		<!-- No API key warning -->
		<div class="absolute inset-0 flex items-center justify-center p-8">
			<div class="max-w-md text-center">
				<div class="text-6xl mb-4">🗺️</div>
				<h1 class="text-2xl font-bold text-slate-900 mb-2">Map Not Configured</h1>
				<p class="text-slate-600 mb-4">
					Add your Mapbox access token to see the map.
				</p>
				<code class="block bg-slate-200 p-3 rounded-lg text-sm text-left overflow-x-auto">
					VITE_MAPBOX_ACCESS_TOKEN=pk.xxx
				</code>
				<p class="text-sm text-slate-500 mt-4">
					Get a free token at <a href="https://mapbox.com" class="text-blue-600 underline">mapbox.com</a>
				</p>
			</div>
		</div>
	{/if}

	<!-- Top bar with search and filters -->
	<div class="absolute top-0 left-0 right-0 safe-top z-20 pointer-events-none">
		<div class="p-4 space-y-3 pointer-events-auto">
			<!-- Search bar -->
			<SearchBar
				onSearch={handleSearch}
				placeholder="Describe your dream route..."
			/>

			<!-- Filter chips -->
			<FilterBar
				{selectedCategories}
				{distanceRange}
				onFilterChange={handleFilterChange}
			/>
		</div>
	</div>

	<!-- Shape count indicator -->
	<div class="absolute left-4 bottom-24 z-20 pointer-events-none">
		<div class="glass rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm pointer-events-auto">
			<span class="text-ghost">{filteredShapes.length}</span> ghost routes
		</div>
	</div>

	<!-- Creativity reminder -->
	<div class="absolute right-4 bottom-24 z-20 pointer-events-none">
		<div class="glass rounded-lg px-3 py-2 text-xs text-slate-600 max-w-[180px] shadow-sm pointer-events-auto">
			<span class="font-medium">💡 Remember:</span> These are suggestions. The sky's the limit!
		</div>
	</div>

	<!-- Bottom drawer for shape details -->
	{#if selectedShape}
		<ShapeDrawer
			shape={selectedShape}
			isOpen={isDrawerOpen}
			onClose={handleCloseDrawer}
			onPreview={() => handlePreviewShape(selectedShape!)}
		/>
	{/if}
</div>
