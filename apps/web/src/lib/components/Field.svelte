<script lang="ts">
  interface Props {
    label?: string;
    value?: string | number;
    placeholder?: string;
    type?: string;
    disabled?: boolean;
    readonly?: boolean;
    suffix?: string;
    class?: string;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
  }

  let {
    label = '',
    value = $bindable(''),
    placeholder = '',
    type = 'text',
    disabled = false,
    readonly = false,
    suffix = '',
    class: className = '',
    oninput,
    onchange
  }: Props = $props();
</script>

<label class="flex flex-col gap-1.5 w-full {className}">
  {#if label}
    <span class="text-xs font-semibold uppercase tracking-wider text-[#6E67A8]">
      {label}
    </span>
  {/if}
  <div class="relative flex items-center">
    <input
      {type}
      bind:value
      {placeholder}
      {disabled}
      {readonly}
      {oninput}
      {onchange}
      class="w-full bg-white border-2 border-[#2B2170] rounded-xl px-4 py-2.5 text-sm font-medium text-[#2B2170] placeholder:text-[#6E67A8]/50 focus:outline-none focus:ring-2 focus:ring-[#2B2170]/20 transition-all {readonly ? 'bg-black/[0.02]' : ''} {disabled ? 'opacity-50 cursor-not-allowed' : ''} {suffix ? 'pr-12' : ''}"
    />
    {#if suffix}
      <span class="absolute right-3.5 text-xs font-semibold text-[#6E67A8] select-none pointer-events-none">
        {suffix}
      </span>
    {/if}
  </div>
</label>
