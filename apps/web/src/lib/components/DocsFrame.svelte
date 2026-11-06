<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { catalog } from '$lib/docs';
	import Mark from './Mark.svelte';
	import Palette from './Palette.svelte';

	interface Props {
		slug: string;
		toc: { id: string; label: string }[];
		children?: Snippet;
	}

	let { slug, toc, children }: Props = $props();

	let drawer = $state(false);
	let search = $state(false);
	let active = $state('');

	$effect(() => {
		if (!active && toc[0]?.id) {
			active = toc[0].id;
		}
	});

	onMount(() => {
		const key = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				search = !search;
			}
			if (e.key === 'Escape') drawer = false;
		};
		window.addEventListener('keydown', key);

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						active = entry.target.id;
					}
				}
			},
			{ rootMargin: '-5% 0px -70% 0px' }
		);

		document.querySelectorAll('.markdown-content h2').forEach((el) => observer.observe(el));

		return () => {
			window.removeEventListener('keydown', key);
			observer.disconnect();
		};
	});

	const groups = $derived([...new Set(catalog.map((doc) => doc.group))]);
</script>

<main id="main">
	<button
		class="docs-drawer-toggle"
		aria-expanded={drawer}
		aria-controls="docs-navigation"
		onclick={() => (drawer = !drawer)}
	>
		PulsePay docs<span>{drawer ? 'Close −' : 'Browse +'}</span>
	</button>

	<div class="docs-layout">
		<aside id="docs-navigation" class="docs-sidebar {drawer ? 'open' : ''}" data-lenis-prevent>
			<a href="/" class="brand">
				<Mark />PulsePay docs
			</a>
			<button
				class="docs-search"
				onclick={() => {
					search = true;
					drawer = false;
				}}
			>
				Search<span>CTRL K</span>
			</button>
			<nav class="docs-tree" aria-label="Documentation">
				{#each groups as group (group)}
					<details open>
						<summary>{group}</summary>
						{#each catalog.filter((doc) => doc.group === group) as doc (doc.slug)}
							<a
								href="/docs/{doc.slug}"
								aria-current={doc.slug === slug ? 'page' : undefined}
								onclick={() => (drawer = false)}
							>
								{doc.slug.split('/').at(-1)}.md
							</a>
						{/each}
					</details>
				{/each}
			</nav>
		</aside>

		<article class="docs-article">
			{@render children?.()}
		</article>

		<aside class="docs-toc" aria-label="On this page">
			<p>On this page</p>
			{#each toc as item (item.id)}
				<a href="#{item.id}" class={active === item.id ? 'active' : ''}>
					{item.label.replace(' / ', ' ')}
				</a>
			{/each}
			<div class="agent-chip">
				Agent-readable
				<a href="/llms.txt">/llms.txt ↗</a>
				<a href="/docs/{slug}.md">Markdown twin ↗</a>
			</div>
		</aside>
	</div>

	<Palette
		open={search}
		onclose={() => (search = false)}
		items={catalog.map((doc) => ({
			label: `${doc.group} / ${doc.title}`,
			value: `/docs/${doc.slug}`
		}))}
		onselect={(val) => goto(val)}
		title="Search the docs"
	/>
</main>

