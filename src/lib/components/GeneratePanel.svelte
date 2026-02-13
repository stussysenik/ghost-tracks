<script lang="ts">
	import type { ShapeIdea } from '$types';
	import NeighborhoodPicker from './NeighborhoodPicker.svelte';
	import ShapeIdeaCard from './ShapeIdeaCard.svelte';

	interface Props {
		onIdeaSelected: (idea: ShapeIdea) => void;
	}

	let { onIdeaSelected }: Props = $props();

	let selectedNeighborhood = $state('');
	let ideas = $state<ShapeIdea[]>([]);
	let isLoading = $state(false);
	let error = $state('');

	async function generate() {
		if (!selectedNeighborhood) return;

		isLoading = true;
		error = '';
		ideas = [];

		try {
			const response = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					neighborhood: selectedNeighborhood,
					count: 3
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.detail || data.error || 'Generation failed');
			}

			const data = await response.json();
			ideas = data.ideas;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="space-y-3">
	<NeighborhoodPicker selected={selectedNeighborhood} onSelect={(v) => (selectedNeighborhood = v)} />

	<button
		type="button"
		data-testid="generate-button"
		disabled={!selectedNeighborhood || isLoading}
		class="w-full rounded-xl bg-ghost py-3 text-sm font-bold text-white shadow-md
			hover:bg-ghost-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
		onclick={generate}
	>
		{#if isLoading}
			<span class="inline-flex items-center gap-2">
				<span class="animate-spin">✨</span> Generating ideas...
			</span>
		{:else}
			Generate Route Ideas
		{/if}
	</button>

	{#if error}
		<div class="glass rounded-xl p-3 text-sm text-red-600">
			{error}
			<button type="button" class="underline ml-2" onclick={generate}>Retry</button>
		</div>
	{/if}

	<!-- Skeleton loaders during loading -->
	{#if isLoading}
		<div class="space-y-2" data-testid="skeleton-loaders">
			{#each [1, 2, 3] as _}
				<div class="glass rounded-xl p-3 animate-pulse flex items-center gap-3">
					<div class="w-10 h-10 rounded-full bg-slate-200 shrink-0"></div>
					<div class="flex-1 space-y-2">
						<div class="h-3 bg-slate-200 rounded w-3/4"></div>
						<div class="h-2.5 bg-slate-200 rounded w-1/2"></div>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	{#if ideas.length > 0}
		<div class="space-y-2" data-testid="ideas-list">
			{#each ideas as idea}
				<ShapeIdeaCard {idea} onSelect={onIdeaSelected} />
			{/each}
		</div>
	{/if}
</div>
