<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		headers: string[];
		rows: T[];
		rowKey: (row: T) => string;
		loading?: boolean;
		error?: string | null;
		retry?: () => void;
		empty?: string;
		rowSnippet: Snippet<[T]>;
	}

	let {
		headers,
		rows,
		rowKey,
		loading = false,
		error = null,
		retry,
		empty = 'No records in the loaded block range.',
		rowSnippet
	}: Props = $props();
</script>

<div class="merchant-table-scroll" data-lenis-prevent tabindex="0" aria-label="Scrollable data table">
	<table class="merchant-table">
		<thead>
			<tr>
				{#each headers as header (header)}
					<th scope="col">{header}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if loading}
				<tr class="empty-row">
					<td colspan={headers.length}><span role="status">Reading live records…</span></td>
				</tr>
			{:else if error}
				<tr class="error-row">
					<td colspan={headers.length}>
						<div role="alert">
							Chain read unavailable
							{#if retry}
								<button onclick={retry}>Retry ↗</button>
							{/if}
							<span class="error-detail">{error}</span>
						</div>
					</td>
				</tr>
			{:else if rows.length === 0}
				<tr class="empty-row">
					<td colspan={headers.length}>{empty}</td>
				</tr>
			{:else}
				{#each rows as row (rowKey(row))}
					<tr>
						{@render rowSnippet(row)}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

