<script lang="ts">
	import type { PageData } from './$types';
	import DocsFrame from '$lib/components/DocsFrame.svelte';
	import Feedback from '$lib/components/Feedback.svelte';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();
</script>

<svelte:head>
	<title>{data.doc.title} · PulsePay Docs</title>
	<meta name="description" content={data.doc.lede} />
</svelte:head>

<DocsFrame slug={data.slug} toc={data.doc.toc}>
	<div class="breadcrumb">Docs / {data.doc.group} / {data.slug.split('/').at(-1)}</div>
	<h1 data-decode>{data.doc.title}</h1>
	<p class="docs-lede">{data.doc.lede}</p>

	<div class="track-chips">
		<span class="track-chip">Track: {data.doc.track}</span>
		<span class="track-chip">Source verified</span>
		<a class="track-chip" href="/docs/{data.slug}.md">Agent readable ↗</a>
	</div>

	<div class="before-start">
		<strong>Before you start</strong>
		Node 22.13 or newer · pnpm 12.14.0 · Your configured deployment.<br />
		{#if data.doc.group === 'Hedera'}
			Native HBAR · asset 0.0.0. No Solidity is deployed on this track.
		{:else}
			Read the actual source and use accounts you control for wallet-authorized writes.
		{/if}
	</div>

	<div class="markdown-content">
		{@html data.html}
	</div>

	<nav class="docs-pagination" aria-label="Documentation pagination">
		{#if data.prev}
			<a href="/docs/{data.prev.slug}">
				<small>← Previous</small>
				{data.prev.title}
			</a>
		{:else}
			<span></span>
		{/if}
		{#if data.next}
			<a href="/docs/{data.next.slug}">
				<small>Next →</small>
				{data.next.title}
			</a>
		{/if}
	</nav>

	<div class="docs-meta">
		<a
			href="https://github.com/lviffy/ETHGLOBAL/edit/main/apps/web/content/docs/{data.slug}.md"
			target="_blank"
			rel="noreferrer"
		>
			Edit this page ↗
		</a>
		<a href="/docs/{data.slug}.md">View as Markdown ↗</a>
		<a href="https://github.com/lviffy/ETHGLOBAL/issues/new" target="_blank" rel="noreferrer">
			Report an issue ↗
		</a>
	</div>

	<Feedback slug={data.slug} />
</DocsFrame>

