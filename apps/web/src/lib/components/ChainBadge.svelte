<script lang="ts">
  interface Props {
    chain: 'WC' | 'HB' | 'UNI' | 'Whitechain' | 'Hedera' | 'Uniswap' | 'USDT' | 'WETH' | 'USDC' | string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    class?: string;
  }

  let {
    chain = 'WC',
    size = 'md',
    class: className = ''
  }: Props = $props();

  const sizeClasses = {
    xs: 'w-5 h-5 text-[9px] border',
    sm: 'w-7 h-7 text-xs border-2',
    md: 'w-9 h-9 text-xs border-2',
    lg: 'w-11 h-11 text-sm border-2'
  };

  function getBadgeDetails(c: string) {
    const norm = c.toUpperCase();
    if (norm === 'WC' || norm === 'WHITECHAIN') {
      return { text: 'WC', bg: 'bg-[#C8C3F2]', title: 'Whitechain 1874' };
    }
    if (norm === 'HB' || norm === 'HEDERA') {
      return { text: 'HB', bg: 'bg-[#D6D2F7]', title: 'Hedera testnet' };
    }
    if (norm === 'UNI' || norm === 'UNISWAP') {
      return { text: 'UNI', bg: 'bg-[#B4ADEB]', title: 'Uniswap v4' };
    }
    if (norm === 'WETH') {
      return { text: 'W', bg: 'bg-[#D6D2F7]', title: 'Wrapped Ether' };
    }
    if (norm === 'USDT') {
      return { text: 'U', bg: 'bg-[#C8C3F2]', title: 'Tether USD' };
    }
    if (norm === 'USDC') {
      return { text: 'U', bg: 'bg-[#B4ADEB]', title: 'USD Coin' };
    }
    return { text: c.slice(0, 3).toUpperCase(), bg: 'bg-[#EAE7FA]', title: c };
  }

  let details = $derived(getBadgeDetails(chain));
</script>

<div
  class="inline-flex items-center justify-center font-bold tracking-tight rounded-full border-[#2B2170] text-[#2B2170] select-none shrink-0 transition-transform {sizeClasses[size]} {details.bg} {className}"
  title={details.title}
>
  {details.text}
</div>
