<script lang="ts">
	/**
	 * Ghost Tracks - Filter Bar
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

	const categories: { id: ShapeCategory; label: string; emoji: string }[] = [
		{ id: 'creature', label: 'Creatures', emoji: '🦊' },
		{ id: 'letter', label: 'Letters', emoji: '🔤' },
		{ id: 'geometric', label: 'Shapes', emoji: '⭐' }
	];

	const distancePresets: { label: string; range: [number, number] }[] = [
		{ label: 'All', range: [0, 20] },
		{ label: '< 5km', range: [0, 5] },
		{ label: '5-10km', range: [5, 10] },
		{ label: '> 10km', range: [10, 20] }
	];

	function toggleCategory(category: ShapeCategory) {
		const newCategories = selectedCategories.includes(category)
			? selectedCategories.filter(c => c !== category)
			: [...selectedCategories, category];

		if (newCategories.length > 0) {
			onFilterChange(newCategories, distanceRange);
		}
	}

	function setDistanceRange(range: [number, number]) {
		onFilterChange(selectedCategories, range);
	}

	function isDistanceActive(range: [number, number]): boolean {
		return distanceRange[0] === range[0] && distanceRange[1] === range[1];
	}
</script>

<div class="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
	{#each categories as category}
		<button
			onclick={() => toggleCategory(category.id)}
			class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 tap-target border border-white/70 {selectedCategories.includes(category.id)
				? 'bg-ghost text-white shadow-md'
				: 'bg-white/90 text-slate-700 hover:bg-white'}"
		>
			<span>{category.emoji}</span>
			<span>{category.label}</span>
		</button>
	{/each}

	<div class="flex-shrink-0 w-px bg-slate-200 mx-1"></div>

	{#each distancePresets as preset}
		<button
			onclick={() => setDistanceRange(preset.range)}
			class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold transition-all duration-150 tap-target border border-white/70 {isDistanceActive(preset.range)
				? 'bg-track text-white shadow-md'
				: 'bg-white/90 text-slate-700 hover:bg-white'}"
		>
			{preset.label}
		</button>
	{/each}
</div>

<style>
	.bg-ghost {
		background-color: var(--color-ghost, #FF6B35);
	}
	.bg-track {
		background-color: var(--color-track, #3B82F6);
	}
</style>
