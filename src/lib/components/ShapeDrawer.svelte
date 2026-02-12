<script lang="ts">
	/**
	 * Ghost Tracks - Shape Drawer
	 *
	 * iOS-style bottom sheet that shows shape details:
	 * - Shape name, emoji, and category
	 * - Distance and estimated time
	 * - Description
	 * - Action buttons (Preview, Export GPX, Share)
	 */
	import type { Shape } from '$types';

	interface Props {
		shape: Shape;
		isOpen: boolean;
		onClose: () => void;
		onPreview: () => void;
	}

	let {
		shape,
		isOpen,
		onClose,
		onPreview
	}: Props = $props();

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
			case 'easy': return '6:00/km pace';
			case 'moderate': return '5:30/km pace';
			case 'hard': return '5:00/km pace';
		}
	}

	// Get category styling
	function getCategoryClass(category: Shape['category']): string {
		switch (category) {
			case 'creature': return 'category-pill creature';
			case 'letter': return 'category-pill letter';
			case 'geometric': return 'category-pill geometric';
		}
	}

	/**
	 * Handle GPX export
	 */
	async function handleExportGPX() {
		// Navigate to GPX download endpoint
		window.open(`/api/shapes/${shape.id}/gpx`, '_blank');
	}

	/**
	 * Handle share
	 */
	async function handleShare() {
		const url = `${window.location.origin}/shape/${shape.id}`;
		const text = `Check out this running route: ${shape.emoji} ${shape.name} (${shape.distance_km}km)`;

		if (navigator.share) {
			// Use native share on mobile
			try {
				await navigator.share({ title: shape.name, text, url });
			} catch (e) {
				// User cancelled or error
				console.log('Share cancelled');
			}
		} else {
			// Fallback: copy to clipboard
			await navigator.clipboard.writeText(url);
			alert('Link copied to clipboard!');
		}
	}

	/**
	 * Handle backdrop click
	 */
	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	/**
	 * Handle touch swipe down to close
	 */
	let touchStartY = $state(0);
	let currentTranslateY = $state(0);
	let isDragging = $state(false);

	function handleTouchStart(e: TouchEvent) {
		touchStartY = e.touches[0].clientY;
		isDragging = true;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const deltaY = e.touches[0].clientY - touchStartY;
		if (deltaY > 0) {
			currentTranslateY = deltaY;
		}
	}

	function handleTouchEnd() {
		isDragging = false;
		if (currentTranslateY > 100) {
			onClose();
		}
		currentTranslateY = 0;
	}
</script>

<!-- Backdrop -->
{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/20 z-30 transition-opacity duration-300"
		onclick={handleBackdropClick}
	></div>
{/if}

<!-- Drawer -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="
		fixed bottom-0 left-0 right-0 z-30
		bg-white rounded-t-3xl shadow-2xl
		transition-transform duration-300 ease-out
		safe-bottom
		{isOpen ? 'translate-y-0' : 'translate-y-full'}
	"
	style="transform: translateY({isOpen ? currentTranslateY : '100%'}px)"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	role="dialog"
	aria-label="Shape details"
	tabindex="-1"
>
	<!-- Drag handle -->
	<div class="flex justify-center pt-3 pb-2">
		<div class="w-10 h-1 bg-slate-300 rounded-full"></div>
	</div>

	<!-- Content -->
	<div class="px-6 pb-6">
		<!-- Header -->
		<div class="flex items-start gap-4 mb-4">
			<!-- Emoji -->
			<div class="text-5xl flex-shrink-0">{shape.emoji}</div>

			<!-- Info -->
			<div class="flex-1 min-w-0">
				<h2 class="text-xl font-bold text-slate-900 truncate">{shape.name}</h2>
				<p class="text-sm text-slate-500">{shape.area}</p>

				<!-- Category badge -->
				<span class={getCategoryClass(shape.category)}>
					{shape.category}
				</span>
			</div>

			<!-- Close button -->
			<button
				onclick={onClose}
				class="p-2 -mr-2 text-slate-400 hover:text-slate-600"
				aria-label="Close"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Stats -->
		<div class="flex gap-6 mb-4 py-3 border-y border-slate-100">
			<div>
				<div class="text-2xl font-bold text-slate-900">{shape.distance_km}<span class="text-lg font-normal">km</span></div>
				<div class="text-xs text-slate-500">Distance</div>
			</div>
			<div>
				<div class="text-2xl font-bold text-slate-900">{formatTime(shape.estimated_minutes)}</div>
				<div class="text-xs text-slate-500">{getPaceDescription(shape.difficulty)}</div>
			</div>
			<div>
				<div class="text-2xl font-bold text-slate-900 capitalize">{shape.difficulty}</div>
				<div class="text-xs text-slate-500">Difficulty</div>
			</div>
		</div>

		<!-- Description -->
		{#if shape.description}
			<p class="text-sm text-slate-600 mb-4">{shape.description}</p>
		{/if}

		<!-- Action buttons -->
		<div class="flex gap-3">
			<button
				onclick={onPreview}
				class="btn-secondary flex-1 flex items-center justify-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
				Preview
			</button>

			<button
				onclick={handleExportGPX}
				class="btn-primary flex-1 flex items-center justify-center gap-2"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
				</svg>
				Export GPX
			</button>
		</div>

		<!-- Share button -->
		<button
			onclick={handleShare}
			class="w-full mt-3 py-2 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2"
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
			</svg>
			Share this route
		</button>

		<!-- Safety disclaimer -->
		<p class="mt-4 text-xs text-slate-400 text-center">
			⚠️ Routes are suggestions only. Always verify safety before running.
		</p>
	</div>
</div>
