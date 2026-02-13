<script lang="ts">
	import type { AppMode } from '$types';

	interface Props {
		mode: AppMode;
		onModeChange: (mode: AppMode) => void;
	}

	let { mode, onModeChange }: Props = $props();
</script>

<div class="flex gap-2" data-testid="mode-switcher">
	<button
		type="button"
		data-testid="mode-generate"
		class="rounded-full px-4 py-2 text-sm font-semibold transition-all {mode === 'generate'
			? 'bg-ghost text-white shadow-md'
			: 'glass text-slate-700 hover:bg-white/95'}"
		onclick={() => onModeChange('generate')}
	>
		Generate
	</button>
	<button
		type="button"
		data-testid="mode-describe"
		class="rounded-full px-4 py-2 text-sm font-semibold transition-all {mode === 'describe'
			? 'bg-ghost text-white shadow-md'
			: 'glass text-slate-700 hover:bg-white/95'}"
		onclick={() => onModeChange('describe')}
	>
		Describe
	</button>
</div>
