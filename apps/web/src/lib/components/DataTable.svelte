<script lang="ts">
  import type { Snippet } from 'svelte';

  export interface Column<T = any> {
    key: string;
    header: string;
    align?: 'left' | 'center' | 'right';
    width?: string;
    render?: (row: T) => string;
  }

  interface Props<T = any> {
    columns: Column<T>[];
    rows: T[];
    rowKey?: string;
    class?: string;
    emptyText?: string;
    rowSnippet?: Snippet<[T, number]>;
  }

  let {
    columns = [],
    rows = [],
    rowKey = 'id',
    class: className = '',
    emptyText = 'No records found',
    rowSnippet
  }: Props = $props();

  const alignMap = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right'
  };
</script>

<div class="w-full overflow-x-auto {className}">
  <table class="w-full border-collapse text-left">
    <thead>
      <tr class="border-b-2 border-[#2B2170]">
        {#each columns as col}
          <th
            class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] select-none {alignMap[col.align || 'left']} {col.width || ''}"
          >
            {col.header}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-[#D9D4F2]">
      {#if rows.length === 0}
        <tr>
          <td colspan={columns.length} class="py-8 text-center text-sm text-[#6E67A8]">
            {emptyText}
          </td>
        </tr>
      {:else}
        {#each rows as row, index (rowKey && (row as any)[rowKey] ? (row as any)[rowKey] : index)}
          {#if rowSnippet}
            {@render rowSnippet(row, index)}
          {:else}
            <tr class="hover:bg-black/[0.015] transition-colors">
              {#each columns as col}
                <td class="py-3.5 px-3 text-sm text-[#2B2170] {alignMap[col.align || 'left']}">
                  {#if col.render}
                    {col.render(row)}
                  {:else}
                    {(row as any)[col.key] ?? '—'}
                  {/if}
                </td>
              {/each}
            </tr>
          {/if}
        {/each}
      {/if}
    </tbody>
  </table>
</div>
