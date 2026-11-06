<script lang="ts">
	import { page } from '$app/state';
	import Mark from './Mark.svelte';

	const pathname = $derived(page.url.pathname);
</script>

<footer class="site-footer {pathname.startsWith('/merchant') ? 'footer-dark' : ''}">
	<a href="/" class="brand">
		<Mark /> PulsePay
	</a>
	<span class="mono">Payments, with a paper trail.</span>
	<div>
		<a href="/docs">Documentation ↗</a>
		<a href="/docs/skills/pulsepay">Agent Skill ↗</a>
		<a href="/llms.txt" data-sveltekit-reload rel="external">llms.txt ↗</a>
		<a href="/openapi.json" data-sveltekit-reload rel="external">API ↗</a>
	</div>
	<small>© {new Date().getFullYear()} PulsePay</small>
</footer>

