<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} · PulsePay</title>
</svelte:head>

<main id="main" class="not-found">
	{#if page.status === 404}
		<p class="eyebrow" data-decode>404 / NOT ON THIS CHAIN</p>
		<h1>This route<br />didn’t settle.</h1>
		<p>The page you’re looking for doesn’t exist. Your next step still does.</p>
		<div class="actions">
			<a href="/" class="button">Back to PulsePay ↗</a>
			<a href="/docs" class="button soft">Read the docs</a>
		</div>
	{:else}
		<p class="eyebrow">REQUEST INTERRUPTED · {page.status}</p>
		<h1>Let’s try that again.</h1>
		<p>{page.error?.message || 'The page could not finish loading.'}</p>
		<button class="button" onclick={() => location.reload()}>Retry ↗</button>
	{/if}
</main>

