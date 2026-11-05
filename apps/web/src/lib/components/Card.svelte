<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    tabText?: string;
    tabColor?: 'purple' | 'purple-light' | 'purple-deep' | 'white' | string;
    tabPosition?: 'left' | 'center' | 'right';
    class?: string;
    children?: Snippet;
  }

  let {
    tabText = '',
    tabColor = 'purple',
    tabPosition = 'left',
    class: className = '',
    children
  }: Props = $props();

  function getTabBg(color: string): string {
    switch (color) {
      case 'purple-light': return 'bg-[#EAE7FA]';
      case 'purple-deep': return 'bg-[#B4ADEB]';
      case 'white': return 'bg-white';
      case 'purple':
      default:
        // Strictly unified purple tone — replaces all previous pink/cyan
        return 'bg-[#C8C3F2]';
    }
  }

  const posMap: Record<string, string> = {
    left: 'left-6',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-6'
  };
</script>

<div class="relative bg-white border-2 border-[#2B2170] rounded-[22px] p-6 lg:p-7 text-[#2B2170] transition-shadow {className}">
  {#if tabText}
    <div
      class="absolute -top-[13px] {posMap[tabPosition] || 'left-6'} px-3.5 py-0.5 border-2 border-[#2B2170] rounded-full text-[11px] font-bold tracking-wider uppercase text-[#2B2170] select-none {getTabBg(tabColor)} shadow-xs"
    >
      {tabText}
    </div>
  {/if}
  {@render children?.()}
</div>
