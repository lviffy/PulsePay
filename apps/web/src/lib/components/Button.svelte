<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'outline' | 'secondary' | 'warning';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    fullWidth?: boolean;
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    fullWidth = false,
    href,
    type = 'button',
    class: className = '',
    onclick,
    children
  }: Props = $props();

  const sizeClasses = {
    sm: 'px-4 py-1.5 text-xs',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3 text-base'
  };

  const variantClasses = {
    primary: 'bg-[#2B2170] text-white hover:bg-[#201855] border-2 border-[#2B2170]',
    outline: 'bg-transparent text-[#2B2170] hover:bg-[#2B2170]/5 border-2 border-[#2B2170]',
    secondary: 'bg-[#C3BEEF] text-[#2B2170] hover:bg-[#b2ace8] border-2 border-[#2B2170]',
    warning: 'bg-[#F4E7A6] text-[#2B2170] hover:bg-[#ede097] border-2 border-[#2B2170]'
  };
</script>

{#if href && !disabled}
  <a
    {href}
    class="inline-flex items-center justify-center font-medium rounded-full cursor-pointer transition-all select-none {sizeClasses[size]} {variantClasses[variant]} {fullWidth ? 'w-full' : ''} {className}"
    {onclick}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    {disabled}
    class="inline-flex items-center justify-center font-medium rounded-full transition-all select-none {sizeClasses[size]} {variantClasses[variant]} {fullWidth ? 'w-full' : ''} {disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} {className}"
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}
