<script lang="ts">
  import type { PaymentStatus } from '$lib/mock';

  interface Props {
    status?: PaymentStatus | string;
    variant?: 'settled' | 'pending' | 'rejected' | 'partial' | 'neutral';
    class?: string;
  }

  let {
    status = '',
    variant,
    class: className = ''
  }: Props = $props();

  function getVariant(s: string): string {
    if (variant) {
      switch (variant) {
        case 'settled': return 'bg-[#C8C3F2]';
        case 'pending': return 'bg-[#EAE7FA]';
        case 'rejected': return 'bg-[#E2DEF3]';
        case 'partial': return 'bg-[#B4ADEB]';
        default: return 'bg-white';
      }
    }

    const upper = s.toUpperCase();
    if (['SETTLED', 'PAID', 'ACTIVE'].includes(upper)) {
      return 'bg-[#C8C3F2]';
    }
    if (['PENDING', 'OPEN', 'AUDIT PENDING'].includes(upper)) {
      return 'bg-[#EAE7FA]';
    }
    if (['REJECTED', 'EXPIRED', 'REFUNDED'].includes(upper)) {
      return 'bg-[#E2DEF3]';
    }
    if (['PARTIAL REFUND', 'PARTIALLY REFUNDED'].includes(upper)) {
      return 'bg-[#B4ADEB]';
    }
    return 'bg-[#EAE7FA]';
  }
</script>

<span
  class="inline-flex items-center justify-center px-3 py-0.5 border-2 border-[#2B2170] rounded-full text-[11px] font-bold tracking-wider uppercase text-[#2B2170] select-none whitespace-nowrap {getVariant(status)} {className}"
>
  {status}
</span>
