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
	class="palette merchant-modal"
	style="padding: 24px; max-width: 600px;"
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

<style>
	.palette.merchant-modal :global(.merchant-form input),
	.palette.merchant-modal :global(.merchant-form select),
	.palette.merchant-modal :global(.merchant-form textarea) {
		color: var(--ink);
		caret-color: var(--ink);
		background: var(--cream);
		color-scheme: light;
		width: 100%;
		margin: 0;
	}
	.palette.merchant-modal :global(.merchant-form input::placeholder),
	.palette.merchant-modal :global(.merchant-form textarea::placeholder) {
		color: var(--muted);
		opacity: 1;
	}
	.palette.merchant-modal :global(.button.light) {
		background: var(--ink);
		color: var(--cream);
		border-color: var(--ink);
	}
	.palette.merchant-modal :global(.button.light:hover) {
		background: #393934;
	}
	.palette.merchant-modal :global(.button.outline-light) {
		background: transparent;
		color: var(--ink);
		border-color: var(--muted);
	}
	.palette.merchant-modal :global(.button.outline-light:hover) {
		background: var(--soft);
	}
	.palette.merchant-modal :global(.merchant-notice) {
		color: var(--muted);
	}
</style>

