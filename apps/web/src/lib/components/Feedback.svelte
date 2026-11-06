<script lang="ts">
	interface Props {
		slug: string;
	}
	let { slug }: Props = $props();
	let answer = $state('');

	function handleYes() {
		localStorage.setItem(`pulsepay:docs-feedback:${slug}`, 'useful');
		answer = 'Thanks. Your vote is saved on this device.';
	}
</script>

<div class="docs-feedback">
	<span>Was this page useful? </span>
	<button class="copy-button" onclick={handleYes}>Yes</button>
	<a
		class="copy-button"
		href="https://github.com/lviffy/ETHGLOBAL/issues/new?title={encodeURIComponent(`Docs feedback: ${slug}`)}"
		target="_blank"
		rel="noreferrer"
	>
		Needs work ↗
	</a>
	{#if answer}
		<p role="status">{answer}</p>
	{/if}
</div>

