<script lang="ts">
	interface Props {
		text: string;
		class?: string;
	}
	let { text, class: className = '' }: Props = $props();
	let state = $state('Copy');

	async function copy() {
		try {
			await navigator.clipboard.writeText(text);
			state = 'Copied ✓';
			setTimeout(() => {
				state = 'Copy';
			}, 2000);
		} catch {
			state = 'Select text to copy';
		}
	}
</script>

<button class="copy-button {className}" onclick={copy} aria-live="polite">
	{state}
</button>

