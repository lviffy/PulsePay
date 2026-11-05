<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    active?: boolean;
    href?: string;
    variant?: 'default' | 'filled' | 'wc' | 'hb' | 'uni';
    size?: 'sm' | 'md' | 'lg';
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    active = false,
    href,
    variant = 'default',
    size = 'md',
    class: className = '',
    onclick,
    children
  }: Props = $props();

  const sizeClasses = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-5 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base'
  };

  const variantMap = {
    default: 'hover:bg-[#2B2170]/5',
    filled: 'bg-[#C3BEEF]',
    wc: 'bg-[#C3BEEF]',
    hb: 'bg-[#BFE6F2]',
    uni: 'bg-[#F3C6DF]'
  };

  let computedBg = $derived(
    active ? (variant === 'default' ? 'bg-[#C3BEEF]' : variantMap[variant]) : 'bg-transparent'
  );
</script>

{#if href}
  <a
    {href}
    class="inline-flex items-center justify-center font-medium border-2 border-[#2B2170] rounded-full text-[#2B2170] transition-colors cursor-pointer select-none {sizeClasses[size]} {computedBg} {className}"
    {onclick}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    type="button"
    class="inline-flex items-center justify-center font-medium border-2 border-[#2B2170] rounded-full text-[#2B2170] transition-colors cursor-pointer select-none {sizeClasses[size]} {computedBg} {className}"
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}
