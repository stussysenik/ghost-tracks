<script lang="ts">
	/**
	 * Ghost Tracks - Search Bar
	 *
	 * AI-powered search input for describing dream routes.
	 * Sends prompts to the suggestion API for intelligent matching.
	 */

	interface Props {
		onSearch: (query: string) => void;
		placeholder?: string;
		isLoading?: boolean;
	}

	let {
		onSearch,
		placeholder = 'Search routes...',
		isLoading = false
	}: Props = $props();

	let query = $state('');
	let isFocused = $state(false);

	/**
	 * Handle form submission
	 */
	function handleSubmit(e: Event) {
		e.preventDefault();
		if (query.trim() && !isLoading) {
			onSearch(query.trim());
		}
	}

	/**
	 * Handle keyboard shortcuts
	 */
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			query = '';
			(e.target as HTMLInputElement).blur();
		}
	}
</script>

<form
	onsubmit={handleSubmit}
	class="relative"
>
	<div
		class="
			glass rounded-2xl shadow-lg overflow-hidden
			transition-all duration-200
			{isFocused ? 'ring-2 ring-ghost/50' : ''}
		"
	>
		<!-- Search icon -->
		<div class="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
			{#if isLoading}
				<svg class="w-5 h-5 text-ghost animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			{:else}
				<svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
			{/if}
		</div>

		<!-- Input -->
		<input
			type="text"
			bind:value={query}
			onfocus={() => isFocused = true}
			onblur={() => isFocused = false}
			onkeydown={handleKeydown}
			{placeholder}
			disabled={isLoading}
			class="
				w-full h-12 pl-12 pr-4
				bg-transparent
				text-slate-900 placeholder-slate-400
				focus:outline-none
				disabled:opacity-50
			"
		/>

		<!-- AI badge -->
		<div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
			<span class="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
				✨ AI
			</span>
		</div>
	</div>
</form>

<!-- Suggestions hint -->
{#if isFocused && !query}
	<div class="mt-2 px-4 text-xs text-slate-500">
		Try: "A heart shape around 5km" or "Something that looks like a cat"
	</div>
{/if}
