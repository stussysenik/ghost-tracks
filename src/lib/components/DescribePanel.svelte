<script lang="ts">
	import type { DescribeRequest, DescribeResponse } from '$types';
	import { getArea, isAreaBlocked } from '$lib/stores/area.svelte';

	interface Props {
		onRouteGenerated: (result: DescribeResponse) => void;
	}

	let { onRouteGenerated }: Props = $props();

	let description = $state('');
	let isLoading = $state(false);
	let error = $state('');
	let currentStep = $state(0);

	// Opt-in by design, mirroring the API: an absent `target_distance_km` means
	// "size the shape to the area". A bare slider always holds a value and so
	// could never express that, which is why the toggle exists rather than a
	// default of 5 km silently becoming a request nobody made.
	let useTargetDistance = $state(false);
	let targetDistanceKm = $state(5);

	// Matches the backend's clamp (ge=1.0, le=30.0) — sending outside it is a 422.
	const MIN_KM = 1;
	const MAX_KM = 30;

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
			const body: DescribeRequest = { description: description.trim() };
			const current = getArea();
			if (current) {
				body.center = { lng: current.lng, lat: current.lat };
				body.area_name = current.label;
			}
			if (useTargetDistance) {
				body.target_distance_km = targetDistanceKm;
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

	<div class="space-y-2">
		<button
			type="button"
			data-testid="target-distance-toggle"
			role="switch"
			aria-checked={useTargetDistance}
			disabled={isLoading}
			onclick={() => (useTargetDistance = !useTargetDistance)}
			class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs
				font-medium transition-colors disabled:opacity-50
				{useTargetDistance ? 'bg-ghost/10 text-ghost' : 'glass text-slate-600'}"
		>
			<span>Set a target distance</span>
			<span class="text-slate-400">
				{useTargetDistance ? `${targetDistanceKm} km` : 'Fit to area'}
			</span>
		</button>

		{#if useTargetDistance}
			<div class="px-1">
				<label for="target-distance" class="sr-only">Target distance in kilometers</label>
				<input
					id="target-distance"
					data-testid="target-distance-slider"
					type="range"
					min={MIN_KM}
					max={MAX_KM}
					step="0.5"
					bind:value={targetDistanceKm}
					disabled={isLoading}
					class="w-full accent-ghost disabled:opacity-50"
				/>
				<div class="flex justify-between text-[10px] text-slate-400">
					<span>{MIN_KM} km</span>
					<span>{MAX_KM} km</span>
				</div>
			</div>
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
