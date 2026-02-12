<script lang="ts">
	/**
	 * Ghost Tracks - Filter Bar
	 *
	 * Horizontal scrollable filter chips for:
	 * - Category selection (creatures, letters, geometric)
	 * - Distance range
	 */
	import type { ShapeCategory } from '$types';

	interface Props {
		selectedCategories: ShapeCategory[];
		distanceRange: [number, number];
		onFilterChange: (categories: ShapeCategory[], distance: [number, number]) => void;
	}

	let {
		selectedCategories,
		distanceRange,
		onFilterChange
	}: Props = $props();

	// Category definitions with emoji and color
	const categories: { id: ShapeCategory; label: string; emoji: string }[] = [
		{ id: 'creature', label: 'Creatures', emoji: '🦊' },
		{ id: 'letter', label: 'Letters', emoji: '🔤' },
		{ id: 'geometric', label: 'Shapes', emoji: '⭐' }
	];

	// Distance presets
	const distancePresets: { label: string; range: [number, number] }[] = [
		{ label: 'All', range: [0, 20] },
		{ label: '< 5km', range: [0, 5] },
		{ label: '5-10km', range: [5, 10] },
		{ label: '> 10km', range: [10, 20] }
	];

	/**
	 * Toggle category selection
	 */
	function toggleCategory(category: ShapeCategory) {
		const newCategories = selectedCategories.includes(category)
			? selectedCategories.filter(c => c !== category)
			: [...selectedCategories, category];

		// Ensure at least one category is selected
		if (newCategories.length > 0) {
			onFilterChange(newCategories, distanceRange);
		}
	}

	/**
	 * Set distance range
	 */
	function setDistanceRange(range: [number, number]) {
		onFilterChange(selectedCategories, range);
	}

	/**
	 * Check if a distance preset is active
	 */
	function isDistanceActive(range: [number, number]): boolean {
		return distanceRange[0] === range[0] && distanceRange[1] === range[1];
	}
</script>

<div class="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
	<!-- Category filters -->
	{#each categories as category}
		<button
			onclick={() => toggleCategory(category.id)}
			class="
				flex-shrink-0 flex items-center gap-1.5
				px-3 py-1.5 rounded-full
				text-sm font-medium
				transition-all duration-150
				tap-target
				{selectedCategories.includes(category.id)
					? 'bg-ghost text-white shadow-md'
					: 'glass text-slate-600 hover:bg-white/90'
				}
			"
		>
			<span>{category.emoji}</span>
			<span>{category.label}</span>
		</button>
	{/each}

	<!-- Divider -->
	<div class="flex-shrink-0 w-px bg-slate-200 mx-1"></div>

	<!-- Distance filters -->
	{#each distancePresets as preset}
		<button
			onclick={() => setDistanceRange(preset.range)}
			class="
				flex-shrink-0
				px-3 py-1.5 rounded-full
				text-sm font-medium
				transition-all duration-150
				tap-target
				{isDistanceActive(preset.range)
					? 'bg-track text-white shadow-md'
					: 'glass text-slate-600 hover:bg-white/90'
				}
			"
		>
			{preset.label}
		</button>
	{/each}
</div>

<style>
	/* Custom color variables from app.css */
	.bg-ghost {
		background-color: var(--color-ghost, #FF6B35);
	}
	.bg-track {
		background-color: var(--color-track, #3B82F6);
	}
</style>
