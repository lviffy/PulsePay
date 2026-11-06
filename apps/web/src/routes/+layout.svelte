<script lang="ts">
	import '@fontsource-variable/space-grotesk';
	import '@fontsource/jetbrains-mono';
	import '../app.css';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { initMotion } from '$lib/motion';
	import Dock from '$lib/components/Dock.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		children?: Snippet;
	}
	let { children }: Props = $props();

	onMount(() => {
		const cleanup = initMotion(page.url.pathname);
		return cleanup;
	});
</script>

<a href="#main" class="skip-link">Skip to content</a>

<div class="motion-root">
	{@render children?.()}
	<Footer />
	<Dock />
</div>

