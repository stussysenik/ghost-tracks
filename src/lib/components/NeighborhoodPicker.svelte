<script lang="ts">
	import type { NeighborhoodOption } from '$types';

	interface Props {
		selected: string;
		onSelect: (neighborhood: string) => void;
	}

	let { selected, onSelect }: Props = $props();

	const neighborhoods: NeighborhoodOption[] = [
		{ value: 'Staré Město', label: 'Staré Město (Old Town)', icon: '🏛️' },
		{ value: 'Malá Strana', label: 'Malá Strana (Lesser Town)', icon: '🌉' },
		{ value: 'Vinohrady', label: 'Vinohrady', icon: '🍇' },
		{ value: 'Žižkov', label: 'Žižkov', icon: '📡' },
		{ value: 'Karlín', label: 'Karlín', icon: '🏗️' },
		{ value: 'Letná', label: 'Letná', icon: '🌳' },
		{ value: 'Holešovice', label: 'Holešovice', icon: '🎨' },
		{ value: 'Hradčany', label: 'Hradčany', icon: '🏰' },
		{ value: 'Nové Město', label: 'Nové Město (New Town)', icon: '🏙️' },
		{ value: 'Josefov', label: 'Josefov', icon: '✡️' },
		{ value: 'Vršovice', label: 'Vršovice', icon: '🏠' },
		{ value: 'Smíchov', label: 'Smíchov', icon: '🏭' }
	];
</script>

<select
	data-testid="neighborhood-picker"
	class="glass w-full rounded-xl px-4 py-3 text-sm font-medium text-slate-700 appearance-none bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22%23475569%22 d=%22M2 4l4 4 4-4%22/%3E%3C/svg%3E')] bg-[right_12px_center] bg-no-repeat pr-8"
	value={selected}
	onchange={(e) => onSelect((e.target as HTMLSelectElement).value)}
>
	<option value="" disabled>Pick a Prague neighborhood...</option>
	{#each neighborhoods as hood}
		<option value={hood.value}>{hood.icon} {hood.label}</option>
	{/each}
</select>
