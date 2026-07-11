<script lang="ts">
	/**
	 * Global area selector — geocoding search + pin-drop, replacing the old
	 * Prague-only NeighborhoodPicker. Writes the chosen area to the shared area
	 * store; the map draws the pin and both modes generate against it.
	 */
	import type { SelectedArea } from '$types';
	import { searchPlaces } from '$lib/services/geocoding';
	import { getArea, getDensity, setArea } from '$lib/stores/area.svelte';

	let query = $state('');
	let results = $state<SelectedArea[]>([]);
	let isSearching = $state(false);
	let showResults = $state(false);

	let debounce: ReturnType<typeof setTimeout> | null = null;
	let controller: AbortController | null = null;

	const area = $derived(getArea());
	const density = $derived(getDensity());

	function runSearch(q: string) {
		controller?.abort();
		if (!q.trim()) {
			results = [];
			isSearching = false;
			return;
		}
		controller = new AbortController();
		isSearching = true;
		searchPlaces(q, controller.signal)
			.then((r) => {
				results = r;
				showResults = true;
			})
			.catch(() => {
				/* aborted or network error — leave prior results */
			})
			.finally(() => {
				isSearching = false;
			});
	}

	function onInput() {
		showResults = true;
		if (debounce) clearTimeout(debounce);
		debounce = setTimeout(() => runSearch(query), 300);
	}

	function choose(result: SelectedArea) {
		setArea(result, { fly: true });
		query = '';
		results = [];
		showResults = false;
	}

	function clearArea() {
		setArea(null);
		query = '';
		results = [];
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			showResults = false;
		} else if (e.key === 'Enter' && results.length > 0) {
			e.preventDefault();
			choose(results[0]);
		}
	}
</script>

<div class="relative space-y-2">
	<div class="relative">
		<input
			data-testid="area-search"
			type="text"
			bind:value={query}
			oninput={onInput}
			onkeydown={onKeydown}
			onfocus={() => (showResults = true)}
			placeholder="Search a city or address…"
			autocomplete="off"
			class="glass w-full rounded-xl px-4 py-3 pr-10 text-sm text-slate-700 placeholder-slate-400
				focus:outline-none focus:ring-2 focus:ring-ghost/30"
		/>
		<div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
			{#if isSearching}
				<span class="animate-spin text-ghost">◌</span>
			{:else}
				🔍
			{/if}
		</div>

		{#if showResults && results.length > 0}
			<ul
				data-testid="area-results"
				class="glass absolute z-30 mt-1 w-full overflow-hidden rounded-xl py-1 shadow-lg"
			>
				{#each results as result (result.label)}
					<li>
						<button
							type="button"
							data-testid="area-result"
							class="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700
								hover:bg-ghost/10 transition-colors"
							onclick={() => choose(result)}
						>
							<span class="text-slate-400">📍</span>
							<span class="truncate">{result.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if area}
		<div
			data-testid="selected-area"
			class="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
		>
			<span class="text-base">📍</span>
			<div class="min-w-0 flex-1">
				<div class="truncate font-medium text-slate-800" data-testid="selected-area-label">
					{area.label}
				</div>
				{#if density.status === 'checking'}
					<div class="text-xs text-slate-500 flex items-center gap-1">
						<span class="animate-spin">◌</span> Checking street density…
					</div>
				{:else if density.status === 'ok'}
					<div class="text-xs text-green-600" data-testid="density-ok">
						✓ Good street density{density.wayCount ? ` (${density.wayCount.toLocaleString()} streets)` : ''}
					</div>
				{:else if density.status === 'sparse'}
					<div class="text-xs text-red-600" data-testid="density-sparse">⚠ {density.message}</div>
				{:else if density.status === 'error'}
					<div class="text-xs text-amber-600">{density.message} — proceeding anyway</div>
				{/if}
			</div>
			<button
				type="button"
				data-testid="clear-area"
				class="shrink-0 rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100"
				onclick={clearArea}
				aria-label="Clear selected area"
			>
				✕
			</button>
		</div>
	{:else}
		<p class="px-1 text-xs text-slate-500">Search above, or tap the map to drop a pin anywhere.</p>
	{/if}
</div>
