<script lang="ts">
  interface Props {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    class?: string;
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    label = '',
    class: className = '',
    onchange
  }: Props = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<div class="inline-flex items-center gap-3 {className}">
  {#if label}
    <span class="text-sm font-medium text-[#2B2170] select-none">{label}</span>
  {/if}
  <div
    role="switch"
    tabindex="0"
    aria-checked={checked}
    aria-label={label || 'Toggle switch'}
    class="relative w-12 h-6 border-2 border-[#2B2170] rounded-full transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#2B2170]/30 {disabled ? 'opacity-50 cursor-not-allowed' : ''} {checked ? 'bg-[#2B2170]' : 'bg-transparent'}"
    onclick={toggle}
    onkeydown={handleKeydown}
  >
    <div
      class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform duration-200 border border-[#2B2170] {checked ? 'translate-x-6 bg-white border-white' : 'translate-x-0 bg-[#2B2170]'}"
    ></div>
  </div>
</div>
