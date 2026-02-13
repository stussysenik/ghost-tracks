<script lang="ts">
	import type { WaypointMarker, GeneratedRoute } from '$types';
	import { fly } from 'svelte/transition';

	interface Props {
		route: GeneratedRoute;
		onExportGPX: () => void;
		onClose: () => void;
		onRetryNeighborhood?: (neighborhood: string) => void;
		onToggleWaypoints?: (show: boolean) => void;
	}

	let { route, onExportGPX, onClose, onRetryNeighborhood, onToggleWaypoints }: Props = $props();

	let isExpanded = $state(false);
	let showMarkers = $state(true);
</script>

<div
	class="absolute bottom-0 left-0 right-0 z-30 safe-bottom"
	data-testid="route-display"
	transition:fly={{ y: 200, duration: 400 }}
>
	<div class="glass rounded-t-2xl shadow-lg max-h-[60vh] overflow-hidden flex flex-col">
		<!-- Header -->
		<div class="p-4 border-b border-slate-200/50">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<span class="text-2xl">{route.shape.emoji}</span>
					<div>
						<h3 class="font-bold text-slate-900">{route.shape.name}</h3>
						<div class="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
							<span>{route.distance_km} km</span>
							<span>{route.duration_minutes} min</span>
							<span class="capitalize">{route.shape.difficulty}</span>
							<span>{route.neighborhood}</span>
						</div>
					</div>
				</div>
				<button
					type="button"
					class="text-slate-400 hover:text-slate-700 text-xl p-1"
					onclick={onClose}
				>
					&times;
				</button>
			</div>

			{#if route.similarity_score > 0}
				<div class="mt-2 flex items-center gap-2">
					<span
						data-testid="similarity-score"
						class="inline-block rounded-full px-2 py-0.5 text-xs font-bold
							{route.similarity_score >= 70
								? 'bg-green-100 text-green-700'
								: route.similarity_score >= 45
									? 'bg-yellow-100 text-yellow-700'
									: 'bg-red-100 text-red-700'}"
					>
						{Math.round(route.similarity_score)}% match
					</span>
					<span class="text-xs text-slate-400">{route.shape.description}</span>
				</div>
			{/if}

			<!-- Alternative neighborhoods -->
			{#if route.alternative_neighborhoods && route.alternative_neighborhoods.length > 0 && onRetryNeighborhood}
				<div class="mt-2 flex flex-wrap items-center gap-1.5">
					<span class="text-xs text-slate-400">Try in:</span>
					{#each route.alternative_neighborhoods as alt}
						<button
							type="button"
							class="rounded-full px-2.5 py-0.5 text-xs font-medium
								bg-slate-100 text-slate-600 hover:bg-ghost/10 hover:text-ghost
								transition-colors"
							onclick={() => onRetryNeighborhood(alt)}
						>
							{alt}
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex gap-2 mt-3">
				<button
					type="button"
					data-testid="export-gpx"
					class="flex-1 rounded-lg bg-track py-2 text-xs font-bold text-white hover:bg-track-dark transition-all"
					onclick={onExportGPX}
				>
					Export GPX
				</button>
				<button
					type="button"
					class="flex-1 rounded-lg glass py-2 text-xs font-semibold text-slate-700 hover:bg-white/95"
					onclick={() => (isExpanded = !isExpanded)}
				>
					{isExpanded ? 'Hide' : 'Show'} directions ({route.waypoints.length} turns)
				</button>
				<button
					type="button"
					class="rounded-lg py-2 px-3 text-xs font-semibold transition-all
						{showMarkers
							? 'glass text-slate-700 hover:bg-white/95'
							: 'bg-ghost text-white'}"
					onclick={() => {
						showMarkers = !showMarkers;
						onToggleWaypoints?.(showMarkers);
					}}
					title={showMarkers ? 'Hide markers to see just the path' : 'Show waypoint markers'}
				>
					{showMarkers ? 'Path only' : 'Markers'}
				</button>
			</div>
		</div>

		<!-- Waypoint list -->
		{#if isExpanded}
			<div class="overflow-y-auto p-4 space-y-2">
				{#each route.waypoints as wp}
					<div class="flex items-start gap-3 text-sm" data-testid="waypoint-instruction">
						<span
							class="shrink-0 w-7 h-7 rounded-full bg-ghost text-white text-xs font-bold
								flex items-center justify-center"
						>
							{wp.index}
						</span>
						<span class="text-slate-700 pt-0.5">{wp.instruction}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
