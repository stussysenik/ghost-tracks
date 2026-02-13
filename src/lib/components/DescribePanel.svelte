<script lang="ts">
	import type { DescribeResponse } from '$types';

	interface Props {
		onRouteGenerated: (result: DescribeResponse) => void;
	}

	let { onRouteGenerated }: Props = $props();

	let description = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let currentStep = $state(0);
	let showAdvanced = $state(false);
	let selectedNeighborhood = $state('');

	const steps = [
		'Finding the best neighborhood...',
		'Generating shape control points...',
		'Routing through real streets...',
		'Validating shape similarity...'
	];

	const neighborhoods = [
		{ value: '', label: 'Let AI decide' },
		{ value: 'Vinohrady', label: 'Vinohrady' },
		{ value: 'Karlín', label: 'Karlín' },
		{ value: 'Letná', label: 'Letná' },
		{ value: 'Holešovice', label: 'Holešovice' },
		{ value: 'Žižkov', label: 'Žižkov' },
		{ value: 'Vršovice', label: 'Vršovice' },
		{ value: 'Nusle', label: 'Nusle' },
		{ value: 'Dejvice', label: 'Dejvice' },
		{ value: 'Smíchov', label: 'Smíchov' },
		{ value: 'Staré Město', label: 'Staré Město' },
		{ value: 'Malá Strana', label: 'Malá Strana' },
		{ value: 'Nové Město', label: 'Nové Město' }
	];

	let stepTimer: ReturnType<typeof setInterval> | null = null;

	function startProgressSteps() {
		currentStep = 0;
		stepTimer = setInterval(() => {
			if (currentStep < steps.length - 1) {
				currentStep++;
			}
		}, 3000);
	}

	function stopProgressSteps() {
		if (stepTimer) {
			clearInterval(stepTimer);
			stepTimer = null;
		}
		currentStep = 0;
	}

	async function handleSubmit() {
		if (!description.trim()) return;

		isLoading = true;
		error = '';
		startProgressSteps();

		try {
			const body: Record<string, unknown> = { description: description.trim() };
			if (selectedNeighborhood) {
				body.neighborhood = selectedNeighborhood;
			}

			const response = await fetch('/api/describe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.detail || data.error || 'Generation failed');
			}

			const data: DescribeResponse = await response.json();
			onRouteGenerated(data);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			isLoading = false;
			stopProgressSteps();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
		if (e.key === 'Escape') {
			description = '';
		}
	}
</script>

<div class="space-y-3">
	<div class="relative">
		<input
			data-testid="describe-input"
			type="text"
			bind:value={description}
			onkeydown={handleKeydown}
			placeholder="Describe your shape... (e.g. 'a heart', 'letter M', 'a cat')"
			disabled={isLoading}
			class="glass w-full rounded-xl px-4 py-3 pr-12 text-sm text-slate-700 placeholder-slate-400
				focus:outline-none focus:ring-2 focus:ring-ghost/30 disabled:opacity-50"
		/>
		{#if isLoading}
			<div class="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ghost">✨</div>
		{/if}
	</div>

	<!-- Advanced options -->
	<button
		type="button"
		class="text-xs text-slate-400 hover:text-slate-600 transition-colors px-1"
		onclick={() => (showAdvanced = !showAdvanced)}
	>
		{showAdvanced ? '▾' : '▸'} Neighborhood preference
	</button>

	{#if showAdvanced}
		<select
			bind:value={selectedNeighborhood}
			disabled={isLoading}
			class="glass w-full rounded-xl px-4 py-2.5 text-sm text-slate-700 focus:outline-none
				focus:ring-2 focus:ring-ghost/30 disabled:opacity-50"
		>
			{#each neighborhoods as opt}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	{/if}

	<button
		type="button"
		data-testid="describe-button"
		disabled={!description.trim() || isLoading}
		class="w-full rounded-xl bg-ghost py-3 text-sm font-bold text-white shadow-md
			hover:bg-ghost-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
		onclick={handleSubmit}
	>
		{#if isLoading}
			{steps[currentStep]}
		{:else}
			Create Route
		{/if}
	</button>

	<!-- Progress steps during loading -->
	{#if isLoading}
		<div class="glass rounded-xl p-3 space-y-1.5">
			{#each steps as step, i}
				<div class="flex items-center gap-2 text-xs {i <= currentStep ? 'text-slate-700' : 'text-slate-300'}">
					{#if i < currentStep}
						<span class="text-green-500 font-bold">✓</span>
					{:else if i === currentStep}
						<span class="animate-spin text-ghost">◌</span>
					{:else}
						<span class="text-slate-300">○</span>
					{/if}
					<span>{step}</span>
				</div>
			{/each}
		</div>
	{/if}

	{#if error}
		<div class="glass rounded-xl p-3 text-sm text-red-600">
			{error}
			<button type="button" class="underline ml-2" onclick={handleSubmit}>Retry</button>
		</div>
	{/if}

	<p class="text-xs text-slate-500 px-1">
		Try: "a heart shape", "letter P", "a star", "a triangle", "a cat"
	</p>
</div>
