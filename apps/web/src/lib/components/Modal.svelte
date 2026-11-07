<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		opened: boolean;
		title?: string;
		onclose?: () => void;
		children?: Snippet;
	}
	let { opened, title, onclose, children }: Props = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (opened) {
			dialog?.showModal();
		} else {
			dialog?.close();
		}
	});

	function handleBackdrop(e: MouseEvent) {
		if (e.target === dialog) {
			onclose?.();
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="palette"
	style="padding: 24px; max-width: 600px; color-scheme: light; color: var(--ink);"
	oncancel={() => onclose?.()}
	onclick={handleBackdrop}
>
	<div class="palette-heading" style="padding: 0 0 18px; border-bottom: 1px solid var(--rule);">
		<h2 style="font-size: 18px; margin: 0; font-family: var(--display); letter-spacing: -0.02em;">
			{title}
		</h2>
		<button onclick={() => onclose?.()} aria-label="Close modal">ESC</button>
	</div>
	<div style="padding-top: 20px;">
		{@render children?.()}
	</div>
</dialog>

