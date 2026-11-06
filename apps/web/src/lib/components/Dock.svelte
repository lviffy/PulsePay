<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Mark from './Mark.svelte';
	import { gsap, eases } from '$lib/motion';

	const links = [
		{ href: '/#sdk', label: 'SDK' },
		{ href: '/docs', label: 'Docs' },
		{ href: '/merchant', label: 'Merchant' },
		{ href: '/merchant/agents', label: 'Agents' }
	];

	let open = $state(false);
	let dock = $state<HTMLElement | null>(null);

	const pathname = $derived(page.url.pathname);
	const merchant = $derived(pathname.startsWith('/merchant'));

	$effect(() => {
		open = false;
		if (dock) gsap.set(dock, { y: 0 });
	});

	onMount(() => {
		let last = window.scrollY;
		const scroll = () => {
			if (!merchant || !dock) return;
			const down = window.scrollY > last && window.scrollY > 50;
			gsap.to(dock, { y: down ? 150 : 0, duration: 0.35, ease: eases.dock });
			last = window.scrollY;
		};
		window.addEventListener('scroll', scroll, { passive: true });

		const close = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		window.addEventListener('keydown', close);

		return () => {
			window.removeEventListener('scroll', scroll);
			window.removeEventListener('keydown', close);
		};
	});
</script>

<nav class="dock {merchant ? 'dock-merchant' : ''}" bind:this={dock} aria-label="Main navigation">
	<div class="dock-marquee" aria-label="Whitechain, Uniswap v4, Hedera x402">
		<span>
			<i class="status-dot"></i> ONCHAIN BY DESIGN · WHITECHAIN · UNISWAP V4 · HEDERA X402 · ONCHAIN
			BY DESIGN · WHITECHAIN · UNISWAP V4 · HEDERA X402 ·
		</span>
	</div>
	<div class="dock-main">
		<a href="/" class="dock-logo" aria-label="PulsePay home">
			<Mark />
		</a>
		<div class="dock-links">
			{#each links as { href, label } (label)}
				<a
					{href}
					class={(label === 'SDK' && pathname === '/') ||
					(label === 'Docs' && pathname.startsWith('/docs')) ||
					(label === 'Merchant' && merchant && !pathname.startsWith('/merchant/agents')) ||
					(label === 'Agents' && pathname.startsWith('/merchant/agents'))
						? 'active'
						: ''}
				>
					{label}
				</a>
			{/each}
		</div>
		<a class="button dock-cta light" href="/merchant">
			Open console <span>↗</span>
		</a>
		<button
			class="menu-toggle"
			onclick={() => (open = !open)}
			aria-expanded={open}
			aria-controls="mobile-navigation"
		>
			{open ? 'Close −' : 'Menu +'}
		</button>
	</div>

	{#if open}
		<div id="mobile-navigation" class="mobile-navigation">
			{#each links as link (link.label)}
				<a href={link.href} onclick={() => (open = false)}>
					{link.label}
					<span>↗</span>
				</a>
			{/each}
		</div>
	{/if}
</nav>

