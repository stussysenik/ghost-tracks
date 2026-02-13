<script lang="ts">
	import { getToasts, removeToast } from '$lib/stores/toasts.svelte';
	import { fly } from 'svelte/transition';

	const iconMap: Record<string, string> = {
		success: '✓',
		error: '✕',
		warning: '⚠',
		info: 'ℹ'
	};

	const colorMap: Record<string, string> = {
		success: 'bg-green-50 text-green-800 border-green-200',
		error: 'bg-red-50 text-red-800 border-red-200',
		warning: 'bg-amber-50 text-amber-800 border-amber-200',
		info: 'bg-blue-50 text-blue-800 border-blue-200'
	};

	let toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
	<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
		{#each toasts as toast (toast.id)}
			<div
				class="glass border rounded-xl px-4 py-3 text-sm shadow-lg flex items-start gap-2 {colorMap[toast.type]}"
				transition:fly={{ x: 300, duration: 300 }}
			>
				<span class="font-bold shrink-0 mt-0.5">{iconMap[toast.type]}</span>
				<span class="flex-1">{toast.message}</span>
				<button
					type="button"
					class="shrink-0 opacity-60 hover:opacity-100 ml-1"
					onclick={() => removeToast(toast.id)}
				>
					&times;
				</button>
			</div>
		{/each}
	</div>
{/if}
