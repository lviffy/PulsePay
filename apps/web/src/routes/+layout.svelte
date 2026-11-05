<script lang="ts">
  import './layout.css';
  import { page } from '$app/state';
  import ChainBadge from '$lib/components/ChainBadge.svelte';
  import Pill from '$lib/components/Pill.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  let currentPath = $derived(page.url.pathname);

  let showDocsModal = $state(false);
  let showTestnetModal = $state(false);
  let faucetSuccessMsg = $state('');
  let copiedInstall = $state(false);

  function copyInstallCmd() {
    navigator.clipboard?.writeText('npm install @pulsepay/sdk viem');
    copiedInstall = true;
    setTimeout(() => { copiedInstall = false; }, 2000);
  }

  function requestFaucet(token: string, chain: string) {
    faucetSuccessMsg = `Credited 100 ${token} on ${chain} sandbox.`;
    setTimeout(() => {
      faucetSuccessMsg = '';
    }, 3000);
  }
</script>

<div class="min-h-screen flex flex-col justify-between relative pb-36 pt-6 px-4 sm:px-8 max-w-[1400px] mx-auto">
  <!-- TOP HEADER -->
  <header class="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-[#E2DEF3]/70 mb-2">
    <!-- Top Left: Chain badges + Wordmark + SDK pill -->
    <a href="/" class="flex items-center gap-3.5 group cursor-pointer focus:outline-none">
      <div class="flex items-center -space-x-1.5">
        <ChainBadge chain="WC" size="md" />
        <ChainBadge chain="HB" size="md" />
        <ChainBadge chain="UNI" size="md" />
      </div>
      <div class="flex items-center gap-2">
        <span class="font-serif text-2xl font-bold tracking-tight text-[#2B2170] group-hover:opacity-90 transition-opacity">
          PulsePay
        </span>
        <span class="px-2 py-0.5 border border-[#2B2170] rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F9F8F5] text-[#2B2170]">
          SDK v1.2
        </span>
      </div>
    </a>

    <!-- Top Right: Pill Nav + Testnet pill -->
    <div class="flex flex-col items-end gap-2.5 w-full md:w-auto">
      <nav class="flex flex-wrap items-center gap-2" aria-label="Main Navigation">
        <Pill
          href="/checkout"
          active={currentPath === '/checkout'}
          class={currentPath === '/checkout' ? '!bg-[#C8C3F2]' : ''}
        >
          Checkout
        </Pill>
        <Pill
          href="/merchant"
          active={currentPath.startsWith('/merchant')}
          class={currentPath.startsWith('/merchant') ? '!bg-[#C8C3F2]' : ''}
        >
          Merchant
        </Pill>
        <Pill
          href="/agents"
          active={currentPath === '/agents'}
          class={currentPath === '/agents' ? '!bg-[#C8C3F2]' : ''}
        >
          Agents
        </Pill>
        <Pill
          href="/treasury"
          active={currentPath === '/treasury'}
          class={currentPath === '/treasury' ? '!bg-[#C8C3F2]' : ''}
        >
          Treasury
        </Pill>
        <button
          type="button"
          onclick={() => showDocsModal = true}
          class="inline-flex items-center justify-center font-medium border-2 border-[#2B2170] rounded-full text-[#2B2170] px-5 py-2 text-sm hover:bg-[#2B2170]/5 transition-colors cursor-pointer select-none"
        >
          Docs ↗
        </button>
      </nav>

      <!-- Testnet pill -->
      <button
        type="button"
        onclick={() => showTestnetModal = true}
        class="inline-flex items-center gap-2 border-2 border-[#2B2170] rounded-full px-4 py-1 text-xs font-semibold text-[#2B2170] hover:bg-[#2B2170]/5 transition-colors cursor-pointer"
        title="View testnet environment configuration and test tokens"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-[#2B2170]"></span>
        <span>Testnet only · test tokens</span>
      </button>
    </div>
  </header>

  <!-- MAIN PAGE CONTENT -->
  <main class="w-full flex-1">
    {@render children?.()}
  </main>

  <!-- FLOATING BOTTOM-CENTER PILL -->
  <aside class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
    <div
      class="flex items-center gap-3 sm:gap-4 bg-white/95 backdrop-blur-xs border-2 border-[#2B2170] rounded-full px-5 sm:px-7 py-2.5 shadow-sm text-xs sm:text-sm font-semibold text-[#2B2170] whitespace-nowrap select-none"
    >
      <span class="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#2B2170] bg-[#C8C3F2]"></span>
      <span>Whitechain 1874</span>
      <span class="text-[#645C9A]">·</span>
      <span>Hedera testnet</span>
      <span class="text-[#645C9A]">·</span>
      <span>Uniswap v4 (1301)</span>
      <div class="flex items-center gap-1.5 ml-1.5">
        <span class="w-3.5 h-3.5 rounded-full border border-[#2B2170] bg-[#C8C3F2]" title="Whitechain"></span>
        <span class="w-3.5 h-3.5 rounded-full border border-[#2B2170] bg-[#D6D2F7]" title="Hedera"></span>
        <span class="w-3.5 h-3.5 rounded-full border border-[#2B2170] bg-[#B4ADEB]" title="Uniswap v4"></span>
      </div>
    </div>
  </aside>

  <!-- DEVELOPER SDK DOCS MODAL -->
  {#if showDocsModal}
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onclick={(e) => { if (e.target === e.currentTarget) showDocsModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showDocsModal = false; }}
    >
      <div class="bg-white border-2 border-[#2B2170] rounded-[22px] max-w-2xl w-full p-6 sm:p-8 relative shadow-2xl">
        <div class="absolute -top-[13px] left-6 px-3.5 py-0.5 border-2 border-[#2B2170] rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#C8C3F2] text-[#2B2170]">
          DEVELOPER SDK SPECIFICATION
        </div>
        <div class="flex justify-between items-start mb-4 mt-2">
          <div>
            <h3 class="font-serif text-2xl sm:text-3xl font-normal text-[#2B2170]">PulsePay Integration Guide</h3>
            <p class="text-xs text-[#645C9A] mt-1">Multi-rail onchain settlement for B2B merchants and autonomous AI agents</p>
          </div>
          <button
            type="button"
            class="text-[#2B2170] hover:opacity-70 font-bold text-xl cursor-pointer"
            onclick={() => showDocsModal = false}
          >
            ✕
          </button>
        </div>

        <div class="space-y-4 text-sm text-[#2B2170] max-h-[60vh] overflow-y-auto pr-1">
          <!-- Install Command -->
          <div class="flex items-center justify-between p-3.5 bg-[#F9F8F5] border-2 border-[#2B2170] rounded-xl font-mono text-xs">
            <code>npm install @pulsepay/sdk viem</code>
            <button
              type="button"
              onclick={copyInstallCmd}
              class="px-3 py-1 border border-[#2B2170] rounded-md bg-white hover:bg-black/5 font-sans text-xs font-semibold text-[#2B2170] cursor-pointer"
            >
              {copiedInstall ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          <!-- Architecture Rails -->
          <div class="space-y-3">
            <div class="p-3.5 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
              <div class="flex items-center gap-2 font-bold text-sm text-[#2B2170] mb-1">
                <span class="w-2.5 h-2.5 rounded-full bg-[#C8C3F2] border border-[#2B2170]"></span>
                Whitechain Sepolia (Chain ID: 1874)
              </div>
              <p class="text-xs text-[#645C9A] leading-relaxed">
                Primary business rails for sub-second human invoicing, subscriptions, 20% onchain refund reserves, and EIP-2612 capped permits.
              </p>
            </div>

            <div class="p-3.5 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
              <div class="flex items-center gap-2 font-bold text-sm text-[#2B2170] mb-1">
                <span class="w-2.5 h-2.5 rounded-full bg-[#D6D2F7] border border-[#2B2170]"></span>
                Hedera Testnet (x402 Micropayments)
              </div>
              <p class="text-xs text-[#645C9A] leading-relaxed">
                HTTP 402 protocol integration for autonomous AI buyers with programmable spend limits and Hedera Consensus Service (HCS) immutable audit topic <code class="font-mono bg-black/5 px-1 py-0.5 rounded">0.0.123456</code>.
              </p>
            </div>

            <div class="p-3.5 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
              <div class="flex items-center gap-2 font-bold text-sm text-[#2B2170] mb-1">
                <span class="w-2.5 h-2.5 rounded-full bg-[#B4ADEB] border border-[#2B2170]"></span>
                Unichain Sepolia 1301 (Uniswap v4 Treasury)
              </div>
              <p class="text-xs text-[#645C9A] leading-relaxed">
                Automated treasury swap liquidity protected by custom <code class="font-mono bg-black/5 px-1 py-0.5 rounded">TreasuryGuardHook</code> enforcing circuit-breaker pauses and maximum trade sizes.
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3 pt-3 border-t border-[#E2DEF3]">
          <button
            type="button"
            onclick={() => showDocsModal = false}
            class="px-6 py-2 border-2 border-[#2B2170] rounded-full text-sm font-semibold bg-[#2B2170] text-white hover:bg-[#201855] cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- TESTNET MODAL -->
  {#if showTestnetModal}
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onclick={(e) => { if (e.target === e.currentTarget) showTestnetModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showTestnetModal = false; }}
    >
      <div class="bg-white border-2 border-[#2B2170] rounded-[22px] max-w-lg w-full p-6 sm:p-8 relative shadow-2xl">
        <div class="absolute -top-[13px] left-6 px-3.5 py-0.5 border-2 border-[#2B2170] rounded-full text-[11px] font-bold tracking-wider uppercase bg-[#C8C3F2] text-[#2B2170]">
          DEVELOPER SANDBOX
        </div>
        <div class="flex justify-between items-start mb-4 mt-2">
          <h3 class="font-serif text-2xl font-normal text-[#2B2170]">Testnet Faucets & Tokens</h3>
          <button
            type="button"
            class="text-[#2B2170] hover:opacity-70 font-bold text-lg cursor-pointer"
            onclick={() => showTestnetModal = false}
          >
            ✕
          </button>
        </div>
        <p class="text-xs text-[#645C9A] mb-4">
          All test environments operate with mock base unit ledger entries:
        </p>

        {#if faucetSuccessMsg}
          <div class="p-3 mb-4 bg-[#C8C3F2] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170]">
            ✓ {faucetSuccessMsg}
          </div>
        {/if}

        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div>
              <div class="font-bold text-sm text-[#2B2170]">Whitechain Sepolia (1874)</div>
              <div class="text-xs text-[#645C9A]">USDT (6 dec) · WETH (18 dec)</div>
            </div>
            <button
              type="button"
              onclick={() => requestFaucet('USDT', 'Whitechain 1874')}
              class="px-3.5 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-[#C8C3F2] hover:bg-[#b8b3ea] cursor-pointer"
            >
              +100 USDT
            </button>
          </div>

          <div class="flex items-center justify-between p-3 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div>
              <div class="font-bold text-sm text-[#2B2170]">Hedera Testnet (x402)</div>
              <div class="text-xs text-[#645C9A]">HCS Topic 0.0.123456 · USDC</div>
            </div>
            <button
              type="button"
              onclick={() => requestFaucet('USDC', 'Hedera Testnet')}
              class="px-3.5 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-[#D6D2F7] hover:bg-[#c5c0f2] cursor-pointer"
            >
              +50 USDC
            </button>
          </div>

          <div class="flex items-center justify-between p-3 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div>
              <div class="font-bold text-sm text-[#2B2170]">Unichain Sepolia (1301)</div>
              <div class="text-xs text-[#645C9A]">Uniswap v4 (USDC/WETH Pool)</div>
            </div>
            <button
              type="button"
              onclick={() => requestFaucet('WETH', 'Unichain 1301')}
              class="px-3.5 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-[#B4ADEB] hover:bg-[#a39be4] cursor-pointer"
            >
              +1.0 WETH
            </button>
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            onclick={() => showTestnetModal = false}
            class="px-5 py-2 border-2 border-[#2B2170] rounded-full text-sm font-semibold bg-[#2B2170] text-white hover:bg-[#201855] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
