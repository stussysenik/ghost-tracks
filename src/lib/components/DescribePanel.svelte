<script lang="ts">
	import type { DescribeResponse } from '$types';
	import { getArea, isAreaBlocked } from '$lib/stores/area.svelte';

	interface Props {
		onRouteGenerated: (result: DescribeResponse) => void;
	}

	let { onRouteGenerated }: Props = $props();

	let description = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let currentStep = $state(0);

	const area = $derived(getArea());
	const blocked = $derived(isAreaBlocked());

	const steps = [
		'Placing your shape on the map...',
		'Generating shape control points...',
		'Routing through real streets...',
		'Validating shape similarity...'
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
		if (!description.trim() || blocked) return;

		isLoading = true;
		error = '';
		startProgressSteps();

		try {
			const body: Record<string, unknown> = { description: description.trim() };
			const current = getArea();
			if (current) {
				body.center = { lng: current.lng, lat: current.lat };
				body.area_name = current.label;
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

	<button
		type="button"
		data-testid="describe-button"
		disabled={!description.trim() || blocked || isLoading}
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
		{#if area}
			Routing in {area.label}. Try: "a heart shape", "letter P", "a star", "a cat"
		{:else}
			Pick an area above, or we'll choose one for you. Try: "a heart shape", "a star", "a cat"
		{/if}
	</p>
</div>
