<script lang="ts">
	interface Item {
		label: string;
		value: string;
	}
	interface Props {
		open: boolean;
		items: Item[];
		title?: string;
		onclose: () => void;
		onselect: (value: string) => void;
	}
	let { open, items, title = 'Find a file', onclose, onselect }: Props = $props();

	let query = $state('');
	let index = $state(0);
	let dialog = $state<HTMLDialogElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);

	let filtered = $derived(
		items
			.filter((item) => `${item.label} ${item.value}`.toLowerCase().includes(query.toLowerCase()))
			.slice(0, 40)
	);

	$effect(() => {
		if (open) {
			dialog?.showModal();
			input?.focus();
		} else {
			dialog?.close();
		}
	});

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			index = Math.min(index + 1, filtered.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			index = Math.max(0, index - 1);
		} else if (e.key === 'Enter' && filtered[index]) {
			e.preventDefault();
			onselect(filtered[index].value);
			onclose();
		} else if (e.key === 'Escape') {
			onclose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialog) {
			onclose();
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="palette"
	style="color-scheme: light; color: var(--ink);"
	oncancel={onclose}
	onclick={handleBackdropClick}
	onkeydown={handleKeyDown}
>
	<div class="palette-heading">
		<label for="palette-search-input">{title}</label>
		<button onclick={onclose} aria-label="Close search">ESC</button>
	</div>
	<input
		id="palette-search-input"
		bind:this={input}
		bind:value={query}
		oninput={() => (index = 0)}
		placeholder="Type to search…"
		autocomplete="off"
		role="combobox"
		aria-controls="palette-listbox"
		aria-expanded="true"
		style="color: var(--ink);"
	/>
	<div id="palette-listbox" role="listbox" data-lenis-prevent>
		{#if open}
			{#each filtered as item, i (item.value)}
				<button
					role="option"
					aria-selected={i === index}
					onclick={() => {
						onselect(item.value);
						onclose();
					}}
				>
					{item.label}
					<span>↵</span>
				</button>
			{/each}
			{#if filtered.length === 0}
				<p>No matching files.</p>
			{/if}
		{/if}
	</div>
	<div class="palette-footer mono">↑ ↓ TO NAVIGATE · ENTER TO OPEN</div>
</dialog>

