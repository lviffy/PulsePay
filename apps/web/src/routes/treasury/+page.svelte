<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import Field from '$lib/components/Field.svelte';
  import { initialLedger, type LedgerEntry, type ChainId } from '$lib/mock';

  let ledger = $state<LedgerEntry[]>([...initialLedger]);
  let chainFilter = $state<'ALL' | 'WHITECHAIN' | 'HEDERA' | 'UNISWAP'>('ALL');

  // Swap Form State
  let swapFromAmount = $state('50');
  let swapFromToken = $state('USDC');
  let swapToEst = $derived((parseFloat(swapFromAmount) * 0.000382).toFixed(4));
  let swapMessage = $state('');

  // Hook Policy State
  let isHookPaused = $state(false);
  let maxSwapSize = $state('10,000');

  let filteredLedger = $derived(
    ledger.filter((entry) => {
      if (chainFilter === 'ALL') return true;
      if (chainFilter === 'WHITECHAIN') return entry.chainId === 'whitechain';
      if (chainFilter === 'HEDERA') return entry.chainId === 'hedera';
      if (chainFilter === 'UNISWAP') return entry.chainId === 'uniswap';
      return true;
    })
  );

  function executeSwap() {
    const amountVal = parseFloat(swapFromAmount.replace(/,/g, '')) || 0;
    const maxVal = parseFloat(maxSwapSize.replace(/,/g, '')) || 10000;

    if (isHookPaused) {
      swapMessage = 'Swap rejected by TreasuryGuardHook: Treasury is currently emergency paused!';
      ledger.unshift({
        id: `led_${Date.now()}`,
        chain: 'Uniswap',
        chainId: 'uniswap',
        type: 'Swap',
        amountFormatted: `${amountVal} USDC`,
        status: 'REJECTED',
        txLink: null,
        timestamp: 'Just now'
      });
      return;
    }

    if (amountVal > maxVal) {
      swapMessage = `Swap rejected by TreasuryGuardHook: Exceeds max swap size (${maxVal} USDC)!`;
      ledger.unshift({
        id: `led_${Date.now()}`,
        chain: 'Uniswap',
        chainId: 'uniswap',
        type: 'Swap',
        amountFormatted: `${amountVal} USDC`,
        status: 'REJECTED',
        txLink: null,
        timestamp: 'Just now'
      });
      return;
    }

    swapMessage = `Successfully executed swap of ${amountVal} USDC for ${swapToEst} WETH on Unichain Sepolia!`;
    ledger.unshift({
      id: `led_${Date.now()}`,
      chain: 'Uniswap',
      chainId: 'uniswap',
      type: 'Swap',
      amountFormatted: `${amountVal} USDC`,
      status: 'SETTLED',
      txLink: 'https://unichain.blockscout.com',
      timestamp: 'Just now'
    });
  }

  function exportCSV() {
    const headers = ['ID', 'Chain', 'Type', 'Amount', 'Status', 'Timestamp', 'TxLink'];
    const rows = filteredLedger.map(l => [
      l.id,
      l.chain,
      l.type,
      `"${l.amountFormatted}"`,
      l.status,
      l.timestamp,
      l.txLink || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pulsepay_unified_ledger_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
</script>

<svelte:head>
  <title>PulsePay — Uniswap v4 Treasury & Unified Multi-Chain Ledger</title>
</svelte:head>

<section class="mt-4 mb-12">
  <!-- PAGE HEADER -->
  <div class="mb-10">
    <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2B2170] tracking-tight mb-2">
      Treasury & ledger.
    </h1>
    <p class="font-serif italic text-lg sm:text-xl text-[#645C9A] font-normal">
      Uniswap v4 on a separate network · every action lands in one activity feed
    </p>
  </div>

  <!-- 2-COLUMN MAIN LAYOUT -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- LEFT COLUMN (5 cols): TREASURY SWAP + HOOK POLICY -->
    <div class="lg:col-span-5 space-y-6">
      <!-- TREASURY SWAP CARD -->
      <Card tabText="TREASURY SWAP" tabColor="purple" class="p-6">
        <div class="pt-1 space-y-5">
          <div class="text-xs text-[#645C9A]">
            Unichain Sepolia (1301) — separate from Whitechain
          </div>

          <!-- Swap Input Row -->
          <div class="flex items-center gap-3">
            <div class="flex-1">
              <label for="swapFromInput" class="block text-[11px] font-semibold text-[#645C9A] uppercase mb-1">From</label>
              <div class="relative">
                <input
                  id="swapFromInput"
                  type="text"
                  bind:value={swapFromAmount}
                  class="w-full bg-white border-2 border-[#2B2170] rounded-xl px-4 py-2.5 text-sm font-bold text-[#2B2170] focus:outline-none"
                />
                <span class="absolute right-3 top-2.5 text-xs font-bold text-[#645C9A]">USDC</span>
              </div>
            </div>

            <div class="pt-5 text-xl font-bold text-[#2B2170] select-none">
              &rarr;
            </div>

            <div class="flex-1">
              <label for="swapToInput" class="block text-[11px] font-semibold text-[#645C9A] uppercase mb-1">To (est.)</label>
              <div class="relative">
                <input
                  id="swapToInput"
                  type="text"
                  readonly
                  value="{swapToEst} WETH"
                  class="w-full bg-[#FDFDFC] border-2 border-[#2B2170] rounded-xl px-4 py-2.5 text-sm font-bold text-[#2B2170] focus:outline-none cursor-default"
                />
              </div>
            </div>
          </div>

          <!-- Dashed Details Card -->
          <div class="border-2 border-dashed border-[#2B2170] rounded-xl p-3.5 space-y-1 bg-white text-xs text-[#645C9A]">
            <div>Slippage 0.5% · min received {(parseFloat(swapToEst) * 0.995).toFixed(4)} WETH · deadline 20 min</div>
            <div class="font-medium text-[#2B2170]">Pool: USDC/WETH · hook TreasuryGuardHook</div>
          </div>

          {#if swapMessage}
            <div class="p-3 border-2 border-[#2B2170] rounded-xl text-xs font-bold {swapMessage.includes('rejected') ? 'bg-[#E2DEF3]' : 'bg-[#C8C3F2]'} text-[#2B2170]">
              {swapMessage}
            </div>
          {/if}

          <!-- Execute Swap Button -->
          <Button variant="primary" fullWidth size="lg" onclick={executeSwap}>
            Execute swap
          </Button>

          <div class="text-xs text-[#645C9A]">
            Merchant approves every swap and liquidity change
          </div>
        </div>
      </Card>

      <!-- HOOK POLICY CARD -->
      <Card tabText="HOOK POLICY" tabColor="purple" class="p-6">
        <div class="pt-1 space-y-4">
          <!-- Emergency Pause -->
          <div class="flex items-center justify-between pb-2 border-b border-[#E2DEF3]">
            <span class="text-sm font-bold text-[#2B2170]">Emergency pause</span>
            <Toggle bind:checked={isHookPaused} />
          </div>

          <!-- Max swap size -->
          <div class="flex items-center justify-between gap-4 pb-2 border-b border-[#E2DEF3]">
            <span class="text-sm font-bold text-[#2B2170] shrink-0">Max swap size</span>
            <div class="w-44">
              <Field bind:value={maxSwapSize} suffix="USDC" />
            </div>
          </div>

          <!-- Policy Badges (Strictly Purple / Neutral) -->
          <div class="flex items-center gap-3 pt-1">
            <span class="px-3.5 py-1 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-[#C8C3F2] text-[#2B2170]">
              Allowed: 50 USDC
            </span>
            <span class="px-3.5 py-1 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-[#E2DEF3] text-[#2B2170]">
              Rejected: over max
            </span>
          </div>

          <div class="text-xs text-[#645C9A] pt-2">
            Only treasury owner can change policy
          </div>
        </div>
      </Card>
    </div>

    <!-- RIGHT COLUMN (7 cols): UNIFIED LEDGER -->
    <div class="lg:col-span-7">
      <Card tabText="UNIFIED LEDGER" tabColor="purple" class="p-6">
        <div class="pt-1">
          <!-- Filters + Export Row -->
          <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onclick={() => chainFilter = 'ALL'}
                class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {chainFilter === 'ALL' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
              >
                All
              </button>
              <button
                type="button"
                onclick={() => chainFilter = 'WHITECHAIN'}
                class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {chainFilter === 'WHITECHAIN' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
              >
                Whitechain
              </button>
              <button
                type="button"
                onclick={() => chainFilter = 'HEDERA'}
                class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {chainFilter === 'HEDERA' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
              >
                Hedera
              </button>
              <button
                type="button"
                onclick={() => chainFilter = 'UNISWAP'}
                class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {chainFilter === 'UNISWAP' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
              >
                Uniswap
              </button>
            </div>

            <Button variant="primary" size="sm" onclick={exportCSV}>
              Export CSV
            </Button>
          </div>

          <!-- Ledger Table -->
          <div class="w-full overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="border-b-2 border-[#2B2170]">
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">CHAIN</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">TYPE</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">AMOUNT</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">STATUS</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-right">TX</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E2DEF3]">
                {#each filteredLedger as item (item.id)}
                  <tr class="hover:bg-black/[0.015] transition-colors">
                    <td class="py-4 px-3 text-sm font-semibold text-[#2B2170]">
                      {item.chain}
                    </td>
                    <td class="py-4 px-3 text-sm text-[#2B2170]">
                      {item.type}
                    </td>
                    <td class="py-4 px-3 text-sm font-semibold text-[#2B2170]">
                      {item.amountFormatted}
                    </td>
                    <td class="py-4 px-3">
                      <Chip status={item.status} />
                    </td>
                    <td class="py-4 px-3 text-sm font-bold text-right">
                      {#if item.txLink}
                        <a
                          href={item.txLink}
                          target="_blank"
                          rel="noreferrer"
                          class="hover:underline text-[#2B2170]"
                        >
                          ↗
                        </a>
                      {:else}
                        <span class="text-[#645C9A] select-none">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Footnote -->
          <div class="mt-6 pt-4 border-t border-[#E2DEF3] text-xs text-[#645C9A]">
            Network, asset, amount, status and tx reference per record
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>
