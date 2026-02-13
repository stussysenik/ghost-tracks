<script lang="ts">
	import type { ShapeIdea } from '$types';

	interface Props {
		idea: ShapeIdea;
		onSelect: (idea: ShapeIdea) => void;
	}

	let { idea, onSelect }: Props = $props();
</script>

<button
	type="button"
	data-testid="shape-idea"
	class="glass w-full rounded-2xl p-4 text-left hover:bg-white/95 transition-all"
	onclick={() => onSelect(idea)}
>
	<div class="flex items-start gap-3">
		<div class="text-3xl">{idea.emoji}</div>
		<div class="min-w-0 flex-1">
			<div class="font-semibold text-slate-900 truncate">{idea.name}</div>
			<div class="text-sm text-slate-600 mt-0.5">{idea.description}</div>
			<div class="flex items-center gap-3 mt-2 text-xs text-slate-500">
				<span>{idea.estimated_distance_km} km</span>
				<span class="capitalize">{idea.difficulty}</span>
				<span>{idea.target_area}</span>
			</div>
		</div>
		<div class="shrink-0">
			<span
				data-testid="use-this"
				class="inline-block rounded-full bg-ghost/10 text-ghost px-3 py-1 text-xs font-semibold"
			>
				Use this
			</span>
		</div>
	</div>
</button>
