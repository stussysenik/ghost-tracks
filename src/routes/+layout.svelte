<script lang="ts">
	/**
	 * Ghost Tracks - Root Layout
	 * Provides global CSS and app structure
	 */
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Ghost Tracks - Discover Strava Art Routes</title>
</svelte:head>

<!-- Full-screen app container -->
<div class="h-screen w-screen overflow-hidden">
	{@render children()}
</div>
