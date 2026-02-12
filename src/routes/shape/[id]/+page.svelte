<script lang="ts">
	/**
	 * Ghost Tracks - Shareable Shape Page
	 *
	 * A public page for sharing specific routes on social media.
	 * Includes:
	 * - Large shape preview
	 * - Route details
	 * - Export buttons
	 * - Open Graph meta tags for rich previews
	 */
	import type { Shape } from '$types';

	// Props from page load
	let { data } = $props();
	const shape = $derived(data.shape as Shape);
	const canonicalId = $derived((data.canonicalId as string) ?? shape.id);

	// Format time estimate
	function formatTime(minutes: number): string {
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
	}

	// Get pace description
	function getPaceDescription(difficulty: Shape['difficulty']): string {
		switch (difficulty) {
			case 'easy': return '6:00/km';
			case 'moderate': return '5:30/km';
			case 'hard': return '5:00/km';
		}
	}

	// Handle GPX export
	function handleExportGPX() {
		window.open(`/api/shapes/${shape.id}/gpx`, '_blank');
	}

	// Handle share
	async function handleShare() {
		const url = window.location.href;
		const text = `Check out this running route: ${shape.emoji} ${shape.name} (${shape.distance_km}km) - Ghost Tracks`;

		if (navigator.share) {
			try {
				await navigator.share({ title: `${shape.emoji} ${shape.name}`, text, url });
			} catch {
				// User cancelled
			}
		} else {
			await navigator.clipboard.writeText(url);
			alert('Link copied to clipboard!');
		}
	}

	// Open in main app
	function openInApp() {
		window.location.href = `/?shape=${canonicalId}`;
	}
</script>

<svelte:head>
	<title>{shape.emoji} {shape.name} - Ghost Tracks</title>
	<meta name="description" content="{shape.description || `A ${shape.distance_km}km ${shape.category} route in ${shape.area}`}" />

	<!-- Open Graph -->
	<meta property="og:title" content="{shape.emoji} {shape.name} - Ghost Tracks" />
	<meta property="og:description" content="A {shape.distance_km}km {shape.category} route in {shape.area}. Don't just run a route. Reveal it." />
	<meta property="og:type" content="website" />
	<meta property="og:url" content="{`https://ghosttracks.app/shape/${shape.id}`}" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content="{shape.emoji} {shape.name}" />
	<meta name="twitter:description" content="A {shape.distance_km}km running route that forms a {shape.category}. Ghost Tracks - discover hidden shapes in city streets." />
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
	<!-- Hero Section -->
	<div
		class="relative overflow-hidden text-white"
		style="background: linear-gradient(135deg, #FF6B35 0%, #E55A28 100%);"
	>
		<!-- Background pattern -->
		<div class="absolute inset-0 opacity-10">
			<svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
				<pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
					<path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" stroke-width="0.5"/>
				</pattern>
				<rect width="100" height="100" fill="url(#grid)"/>
			</svg>
		</div>

		<div class="relative max-w-2xl mx-auto px-6 py-12 text-center">
			<!-- Emoji -->
			<div class="text-8xl mb-4 drop-shadow-lg">{shape.emoji}</div>

			<!-- Name -->
			<h1 class="text-3xl font-bold mb-2">{shape.name}</h1>

			<!-- Area -->
			<p class="text-white/80 text-lg">{shape.area}</p>
		</div>
	</div>

	<!-- Stats -->
	<div class="max-w-2xl mx-auto px-6 -mt-6">
		<div class="bg-white rounded-2xl shadow-xl p-6">
			<div class="grid grid-cols-3 gap-4 text-center">
				<div>
					<div class="text-3xl font-bold text-slate-900">{shape.distance_km}<span class="text-xl font-normal">km</span></div>
					<div class="text-sm text-slate-500">Distance</div>
				</div>
				<div>
					<div class="text-3xl font-bold text-slate-900">{formatTime(shape.estimated_minutes)}</div>
					<div class="text-sm text-slate-500">{getPaceDescription(shape.difficulty)}</div>
				</div>
				<div>
					<div class="text-3xl font-bold text-slate-900 capitalize">{shape.difficulty}</div>
					<div class="text-sm text-slate-500">Difficulty</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Description -->
	<div class="max-w-2xl mx-auto px-6 py-8">
		{#if shape.description}
			<p class="text-lg text-slate-600 text-center">{shape.description}</p>
		{/if}

		<!-- Category badge -->
		<div class="flex justify-center mt-4">
			<span class="
				px-4 py-2 rounded-full text-sm font-medium
				{shape.category === 'creature' ? 'bg-amber-100 text-amber-800' : ''}
				{shape.category === 'letter' ? 'bg-blue-100 text-blue-800' : ''}
				{shape.category === 'geometric' ? 'bg-purple-100 text-purple-800' : ''}
			">
				{shape.category === 'creature' ? '🦊 Creature' : ''}
				{shape.category === 'letter' ? '🔤 Letter' : ''}
				{shape.category === 'geometric' ? '⭐ Geometric' : ''}
			</span>
		</div>
	</div>

	<!-- Actions -->
	<div class="max-w-2xl mx-auto px-6 pb-8">
		<div class="space-y-3">
			<!-- Primary: Export GPX -->
			<button
				onclick={handleExportGPX}
				class="w-full btn-primary text-lg py-4 flex items-center justify-center gap-3"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				Download GPX File
			</button>

			<!-- Secondary buttons -->
			<div class="flex gap-3">
				<button
					onclick={openInApp}
					class="flex-1 btn-secondary flex items-center justify-center gap-2"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
					</svg>
					View on Map
				</button>

				<button
					onclick={handleShare}
					class="flex-1 btn-secondary flex items-center justify-center gap-2"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
					</svg>
					Share
				</button>
			</div>
		</div>
	</div>

	<!-- Footer -->
	<div class="max-w-2xl mx-auto px-6 pb-12">
		<div class="text-center space-y-4">
			<!-- Creativity reminder -->
			<p class="text-sm text-slate-500">
				💡 This is just a suggestion. When it comes to Strava art, the sky's the limit!
			</p>

			<!-- Safety disclaimer -->
			<p class="text-xs text-slate-400">
				⚠️ Routes are suggestions only. Always verify safety before running.
			</p>

			<!-- Branding -->
			<div class="pt-4 border-t border-slate-200">
				<a href="/" class="inline-flex items-center gap-2 text-slate-600 hover:text-[#FF6B35] transition-colors">
					<span class="text-2xl">👻</span>
					<span class="font-semibold">Ghost Tracks</span>
				</a>
				<p class="text-xs text-slate-400 mt-1">Don't just run a route. Reveal it.</p>
			</div>
		</div>
	</div>
</div>
