<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import ChainBadge from '$lib/components/ChainBadge.svelte';
  import { fade, slide, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  // State for interactive code block
  let activeCodeTab = $state<'react' | 'vanilla' | 'x402'>('react');
  let copied = $state(false);
  let isSimulating = $state(false);
  let simulationLogs = $state<string[]>([]);

  // State for Tri-Track Architecture Interactive Explorer
  let selectedTrack = $state<'whitechain' | 'hedera' | 'uniswap'>('whitechain');

  // State for Interactive Sandbox
  let sandboxAmount = $state('20.00');
  let sandboxToken = $state<'USDT' | 'WETH' | 'USDC'>('WETH');
  let sandboxSimulated = $state(false);

  const codeSnippets = {
    react: `import { createPulsePay } from "@pulsepay/sdk";

const pulsepay = createPulsePay({
  merchantId: "merch_acme_studio",
  whitechain: { chainId: 1874, hubAddress: "0x3F8a...9B1" },
  hedera: { network: "testnet", auditTopic: "0.0.123456" },
  uniswap: { v4Hook: "0x00C0...4b2" }
});

<PulsePayCheckout
  invoiceId="inv_123"
  enablePayWithAnyToken={true}
  onConfirmed={(receipt) => console.log("Settled onchain:", receipt.txHash)}
/>`,
    vanilla: `import { PulsePayClient } from "@pulsepay/sdk";

const client = new PulsePayClient({
  merchantId: "merch_acme_studio",
  settlementRail: "whitechain:1874",
  x402: { enabled: true, auditTopic: "0.0.123456" }
});

// Mount modular checkout component into DOM
const checkout = await client.invoices.mount("#checkout-container", {
  invoiceId: "inv_123",
  allowedTokens: ["USDT", "WETH", "USDC"]
});`,
    x402: `import { createAgentClient, PulsePaySpendLimitPolicy } from "@pulsepay/sdk/agent";

const agent = createAgentClient({
  account: "0.0.482001",
  policy: new PulsePaySpendLimitPolicy({
    dailyBudgetUSDC: 5.00,
    maxPerRequestUSDC: 0.10,
    allowlist: ["acme-data", "ocr-lite", "search-pro"]
  })
});

// Autonomous machine-to-machine x402 payment
const response = await agent.fetch("https://api.acme.com/v1/market-data-basic");
// Status 402 intercepted -> policy validated -> signed & settled -> HCS logged`
  };

  function copyCode() {
    navigator.clipboard?.writeText(codeSnippets[activeCodeTab]);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function runSimulation() {
    isSimulating = true;
    simulationLogs = [];
    const steps = [
      'Init @pulsepay/sdk v1.2.0 with Whitechain 1874 & Hedera x402...',
      'Verifying merchant hub contract [0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7]...',
      'Routing Uniswap Universal Router quote: 0.0078 WETH -> 20.00 USDT...',
      'Locking 20% refund reserve in onchain vault...',
      'Settlement verified: Invoice inv_123 marked PAID!'
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        simulationLogs = [...simulationLogs, step];
        if (idx === steps.length - 1) {
          isSimulating = false;
        }
      }, (idx + 1) * 450);
    });
  }
</script>

<svelte:head>
  <title>PulsePay — Unified Onchain Payment Stack for B2B & AI Agents</title>
</svelte:head>

<!-- SECTION 1: HERO & WIREFRAME 01-LANDING COMPONENT -->
<section id="hero" class="mt-4 mb-20">
  <!-- PAGE HEADING -->
  <div class="mb-10 max-w-4xl">
    <div class="inline-flex items-center gap-2 px-3 py-1 border-2 border-[#2B2170] rounded-full text-xs font-semibold text-[#2B2170] bg-white mb-4 shadow-2xs">
      <span class="w-2 h-2 rounded-full bg-[#C8C3F2] border border-[#2B2170]"></span>
      <span>Enterprise SDK Specification · Whitechain 1874 · Hedera · Uniswap v4</span>
    </div>
    <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2B2170] tracking-tight mb-3 leading-tight">
      One SDK for getting paid.
    </h1>
    <p class="font-serif italic text-lg sm:text-xl text-[#645C9A] font-normal leading-relaxed">
      By people, by agents, in any token. Settled onchain, verified by anyone.
    </p>

    <!-- Jump navigation pills for quick smooth scroll -->
    <div class="flex flex-wrap items-center gap-2 pt-4">
      <a href="#architecture" class="text-xs font-semibold px-3 py-1 border border-[#2B2170] rounded-full text-[#2B2170] hover:bg-[#C8C3F2] transition-colors">
        Tri-Track Architecture &darr;
      </a>
      <a href="#lifecycle" class="text-xs font-semibold px-3 py-1 border border-[#2B2170] rounded-full text-[#2B2170] hover:bg-[#C8C3F2] transition-colors">
        Acme Studio Journey &darr;
      </a>
      <a href="#sandbox" class="text-xs font-semibold px-3 py-1 border border-[#2B2170] rounded-full text-[#2B2170] hover:bg-[#C8C3F2] transition-colors">
        Interactive Sandbox &darr;
      </a>
      <a href="#comparison" class="text-xs font-semibold px-3 py-1 border border-[#2B2170] rounded-full text-[#2B2170] hover:bg-[#C8C3F2] transition-colors">
        Enterprise Comparison &darr;
      </a>
    </div>
  </div>

  <!-- MAIN 2-COLUMN GRID (Matching Wireframe 01-landing.png) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- LEFT CARD: CODE SNIPPET (~20 LINES) -->
    <div class="lg:col-span-6">
      <Card tabText="~20 LINES" tabColor="purple" class="flex flex-col justify-between min-h-[500px]">
        <div>
          <!-- Tab Selector & Copy Header -->
          <div class="flex items-center justify-between pb-3 mb-4 border-b border-[#E2DEF3]">
            <div class="flex items-center gap-1 sm:gap-2 text-xs font-semibold">
              <button
                type="button"
                onclick={() => activeCodeTab = 'react'}
                class="px-2.5 py-1 rounded-md transition-colors cursor-pointer {activeCodeTab === 'react' ? 'bg-[#2B2170] text-white' : 'text-[#645C9A] hover:text-[#2B2170]'}"
              >
                React / Svelte
              </button>
              <button
                type="button"
                onclick={() => activeCodeTab = 'vanilla'}
                class="px-2.5 py-1 rounded-md transition-colors cursor-pointer {activeCodeTab === 'vanilla' ? 'bg-[#2B2170] text-white' : 'text-[#645C9A] hover:text-[#2B2170]'}"
              >
                Vanilla JS
              </button>
              <button
                type="button"
                onclick={() => activeCodeTab = 'x402'}
                class="px-2.5 py-1 rounded-md transition-colors cursor-pointer {activeCodeTab === 'x402' ? 'bg-[#2B2170] text-white' : 'text-[#645C9A] hover:text-[#2B2170]'}"
              >
                x402 Agent Client
              </button>
            </div>
            <button
              type="button"
              onclick={copyCode}
              class="text-xs font-semibold text-[#645C9A] hover:text-[#2B2170] flex items-center gap-1 cursor-pointer"
            >
              <span>{copied ? '✓ Copied' : 'Copy'}</span>
            </button>
          </div>

          <!-- Code View -->
          <div class="font-mono text-xs sm:text-sm text-[#2B2170] space-y-4 pt-1 overflow-x-auto">
            <pre class="leading-relaxed font-mono"><code>{codeSnippets[activeCodeTab]}</code></pre>
          </div>

          <!-- Terminal output simulation view -->
          {#if simulationLogs.length > 0}
            <div transition:slide={{ duration: 250 }} class="mt-4 p-3 bg-[#F9F8F5] border-2 border-[#2B2170] rounded-xl font-mono text-[11px] text-[#2B2170] space-y-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-[#645C9A] mb-1">
                SDK Execution Console
              </div>
              {#each simulationLogs as log}
                <div transition:fade={{ duration: 150 }} class="flex items-center gap-1.5">
                  <span class="text-[#2B2170] font-bold">&gt;</span>
                  <span>{log}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Action CTAs + Interactive Run Button -->
        <div class="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-[#E2DEF3] mt-6">
          <div class="flex flex-wrap items-center gap-3">
            <Button variant="primary" href="/docs" onclick={(e) => { e.preventDefault(); alert("Open developer documentation via the top-right 'Docs ↗' button!"); }}>
              Read the docs
            </Button>
            <Button variant="outline" href="/merchant">
              Open merchant dashboard
            </Button>
          </div>
          <button
            type="button"
            onclick={runSimulation}
            disabled={isSimulating}
            class="px-3.5 py-1.5 border border-[#2B2170] rounded-full text-xs font-bold bg-[#C8C3F2] hover:bg-[#b8b3ea] text-[#2B2170] transition-colors cursor-pointer"
          >
            {isSimulating ? 'Executing...' : '▶ Simulate SDK'}
          </button>
        </div>
      </Card>
    </div>

    <!-- RIGHT COLUMN: 3 FEATURE CARDS (Wireframe 01-landing.png) -->
    <div class="lg:col-span-6 space-y-6">
      <!-- Feature 1: Whitechain -->
      <a href="/merchant" class="block group">
        <Card tabText="WHITECHAIN" tabColor="purple" class="hover:border-[#2B2170] hover:shadow-md transition-all cursor-pointer">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-serif text-2xl font-normal text-[#2B2170] mb-1 group-hover:underline">
                Human billing
              </h2>
              <p class="text-sm text-[#645C9A]">
                Invoices, subscriptions, partial refunds, verifiable receipts
              </p>
            </div>
            <div class="text-2xl text-[#2B2170] group-hover:translate-x-1 transition-transform">
              &rarr;
            </div>
          </div>
        </Card>
      </a>

      <!-- Feature 2: Hedera -->
      <a href="/agents" class="block group">
        <Card tabText="HEDERA" tabColor="purple" class="hover:border-[#2B2170] hover:shadow-md transition-all cursor-pointer">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-serif text-2xl font-normal text-[#2B2170] mb-1 group-hover:underline">
                Agent payments
              </h2>
              <p class="text-sm text-[#645C9A]">
                x402 paid APIs, spend limits, HCS audit trail
              </p>
            </div>
            <div class="text-2xl text-[#2B2170] group-hover:translate-x-1 transition-transform">
              &rarr;
            </div>
          </div>
        </Card>
      </a>

      <!-- Feature 3: Uniswap -->
      <a href="/treasury" class="block group">
        <Card tabText="UNISWAP" tabColor="purple" class="hover:border-[#2B2170] hover:shadow-md transition-all cursor-pointer">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="font-serif text-2xl font-normal text-[#2B2170] mb-1 group-hover:underline">
                Any token + treasury
              </h2>
              <p class="text-sm text-[#645C9A]">
                Pay with any token; v4 pool with TreasuryGuardHook
              </p>
            </div>
            <div class="text-2xl text-[#2B2170] group-hover:translate-x-1 transition-transform">
              &rarr;
            </div>
          </div>
        </Card>
      </a>
    </div>
  </div>

  <!-- FOOTER TAG -->
  <div class="mt-8 text-xs font-semibold uppercase tracking-wider text-[#645C9A]">
    Unified ledger · one SDK · three settlement rails
  </div>
</section>

<!-- SECTION 2: TRI-TRACK ARCHITECTURAL SPECIFICATION (FROM PRD SECTION 1 & 2) -->
<section id="architecture" class="mb-20 pt-8 border-t border-[#E2DEF3]">
  <div class="mb-8">
    <div class="text-xs font-bold uppercase tracking-wider text-[#645C9A] mb-1">
      System Architecture
    </div>
    <h2 class="font-serif text-3xl sm:text-4xl font-normal text-[#2B2170]">
      One SDK. Three Dedicated Execution Adapters.
    </h2>
    <p class="font-serif italic text-base text-[#645C9A] mt-1">
      PulsePay normalizes transactions across chains without hiding each network's native settlement guarantees.
    </p>
  </div>

  <!-- Track Filter Buttons -->
  <div class="flex flex-wrap items-center gap-3 mb-6">
    <button
      type="button"
      onclick={() => selectedTrack = 'whitechain'}
      class="px-5 py-2 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-all cursor-pointer {selectedTrack === 'whitechain' ? 'bg-[#C8C3F2] shadow-xs' : 'bg-white hover:bg-black/5'}"
    >
      Whitechain 1874 · Human Billing
    </button>
    <button
      type="button"
      onclick={() => selectedTrack = 'hedera'}
      class="px-5 py-2 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-all cursor-pointer {selectedTrack === 'hedera' ? 'bg-[#C8C3F2] shadow-xs' : 'bg-white hover:bg-black/5'}"
    >
      Hedera Testnet · Machine x402
    </button>
    <button
      type="button"
      onclick={() => selectedTrack = 'uniswap'}
      class="px-5 py-2 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-all cursor-pointer {selectedTrack === 'uniswap' ? 'bg-[#C8C3F2] shadow-xs' : 'bg-white hover:bg-black/5'}"
    >
      Uniswap v4 · Universal Swaps & Treasury
    </button>
  </div>

  <!-- Architecture Detail Card -->
  <Card tabText="ARCHITECTURE SPEC" tabColor="purple" class="p-6 sm:p-8">
    {#if selectedTrack === 'whitechain'}
      <div transition:fade={{ duration: 200 }} class="space-y-4">
        <div class="flex items-center gap-3">
          <ChainBadge chain="WC" size="md" />
          <div>
            <h3 class="font-serif text-2xl font-normal text-[#2B2170]">Whitechain Sepolia (Chain ID: 1874)</h3>
            <p class="text-xs text-[#645C9A]">High-speed sub-second EVM rail for human receivables and subscription schedules</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">Official USDT Settlement</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Accepts and settles payments using the official Whitechain challenge token address (<code class="font-mono text-[10px]">0xcedfB561...55a7</code>).
            </p>
          </div>
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">20% Refund Reserve</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Every checkout automatically segregates a 20% onchain reserve pool, allowing instant prorated refunds back to original payers.
            </p>
          </div>
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">Transparent Keeper Daemon</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Renewal worker scans <code class="font-mono text-[10px]">nextChargeAt</code> and executes renewals only when due, bounded by cycle caps.
            </p>
          </div>
        </div>

        <div class="pt-4 flex justify-between items-center text-xs text-[#645C9A] border-t border-[#E2DEF3]">
          <span>Verified contract: <code class="font-mono text-[#2B2170]">0x3F8a9B12c...</code></span>
          <a href="/merchant" class="font-semibold text-[#2B2170] hover:underline">
            View Merchant Invoices Console &rarr;
          </a>
        </div>
      </div>
    {:else if selectedTrack === 'hedera'}
      <div transition:fade={{ duration: 200 }} class="space-y-4">
        <div class="flex items-center gap-3">
          <ChainBadge chain="HB" size="md" />
          <div>
            <h3 class="font-serif text-2xl font-normal text-[#2B2170]">Hedera Testnet (x402 Micropayments)</h3>
            <p class="text-xs text-[#645C9A]">100% native Hedera SDK integration with Zero Solidity for autonomous AI agents</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">HTTP 402 Standard</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Autonomous agents consume protected APIs via RFC-compliant HTTP 402 headers without requiring credit cards or human logins.
            </p>
          </div>
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">Hedera Agent Kit v4</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Deterministic code policies enforce daily budgets ($5.00), per-request caps ($0.10), and merchant allowlists before signing.
            </p>
          </div>
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">HCS Consensus Topic</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              All agent spending entries are notarized on Hedera Consensus Service topic <code class="font-mono text-[10px]">0.0.123456</code> for tamper-proof auditing.
            </p>
          </div>
        </div>

        <div class="pt-4 flex justify-between items-center text-xs text-[#645C9A] border-t border-[#E2DEF3]">
          <span>Audit topic: <code class="font-mono text-[#2B2170]">0.0.123456</code> · verifiable on Mirror Node</span>
          <a href="/agents" class="font-semibold text-[#2B2170] hover:underline">
            View Agent Spend Controls &rarr;
          </a>
        </div>
      </div>
    {:else}
      <div transition:fade={{ duration: 200 }} class="space-y-4">
        <div class="flex items-center gap-3">
          <ChainBadge chain="UNI" size="md" />
          <div>
            <h3 class="font-serif text-2xl font-normal text-[#2B2170]">Uniswap v4 & Universal Routing (Unichain 1301)</h3>
            <p class="text-xs text-[#645C9A]">Pay With Any Token checkout conversion and TreasuryGuardHook onchain governance</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">Pay With Any Token</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Customers pay with WETH or USDC while merchants settle in exact USDT through Uniswap swap routing without bridge friction.
            </p>
          </div>
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">TreasuryGuardHook.sol</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              Custom v4 hook enforces onchain circuit-breaker pauses and maximum trade limits (10,000 USDC) before executing pool swaps.
            </p>
          </div>
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC]">
            <div class="font-bold text-sm text-[#2B2170] mb-1">Separate Network Isolation</div>
            <p class="text-xs text-[#645C9A] leading-relaxed">
              No cross-chain sweep assumptions. Treasury runs deterministically on its supported deployment with unified ledger tracking.
            </p>
          </div>
        </div>

        <div class="pt-4 flex justify-between items-center text-xs text-[#645C9A] border-t border-[#E2DEF3]">
          <span>Deployed Hook: <code class="font-mono text-[#2B2170]">TreasuryGuardHook (0x00C0)</code></span>
          <a href="/treasury" class="font-semibold text-[#2B2170] hover:underline">
            View Treasury & Ledger Console &rarr;
          </a>
        </div>
      </div>
    {/if}
  </Card>
</section>

<!-- SECTION 3: CORE ACME STUDIO USER JOURNEY (FROM PRD SECTION 1.3 & 6) -->
<section id="lifecycle" class="mb-20 pt-8 border-t border-[#E2DEF3]">
  <div class="mb-8">
    <div class="text-xs font-bold uppercase tracking-wider text-[#645C9A] mb-1">
      End-to-End Business Flow
    </div>
    <h2 class="font-serif text-3xl sm:text-4xl font-normal text-[#2B2170]">
      The Acme Studio Journey
    </h2>
    <p class="font-serif italic text-base text-[#645C9A] mt-1">
      How a B2B SaaS company accepts payments, handles recurring subscribers, issues onchain refunds, and sells tools to AI agents.
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
    <!-- Step 1 -->
    <div class="p-5 border-2 border-[#2B2170] rounded-[22px] bg-white flex flex-col justify-between">
      <div>
        <div class="w-7 h-7 rounded-full bg-[#C8C3F2] border border-[#2B2170] flex items-center justify-center font-bold text-xs text-[#2B2170] mb-3">
          1
        </div>
        <div class="font-bold text-sm text-[#2B2170] mb-1">Universal Checkout</div>
        <p class="text-xs text-[#645C9A] leading-relaxed">
          Customer buys Pro plan ($20 USDT) using 0.0078 WETH via Uniswap swap routing.
        </p>
      </div>
      <a href="/checkout" class="mt-4 text-xs font-bold text-[#2B2170] underline hover:no-underline">
        Test Checkout &rarr;
      </a>
    </div>

    <!-- Step 2 -->
    <div class="p-5 border-2 border-[#2B2170] rounded-[22px] bg-white flex flex-col justify-between">
      <div>
        <div class="w-7 h-7 rounded-full bg-[#C8C3F2] border border-[#2B2170] flex items-center justify-center font-bold text-xs text-[#2B2170] mb-3">
          2
        </div>
        <div class="font-bold text-sm text-[#2B2170] mb-1">Prorated Refund</div>
        <p class="text-xs text-[#645C9A] leading-relaxed">
          Merchant issues $5.00 partial refund from 20% reserve; customer receives verifiable onchain receipt.
        </p>
      </div>
      <a href="/merchant" class="mt-4 text-xs font-bold text-[#2B2170] underline hover:no-underline">
        Issue Refund &rarr;
      </a>
    </div>

    <!-- Step 3 -->
    <div class="p-5 border-2 border-[#2B2170] rounded-[22px] bg-white flex flex-col justify-between">
      <div>
        <div class="w-7 h-7 rounded-full bg-[#C8C3F2] border border-[#2B2170] flex items-center justify-center font-bold text-xs text-[#2B2170] mb-3">
          3
        </div>
        <div class="font-bold text-sm text-[#2B2170] mb-1">Recurring Keeper</div>
        <p class="text-xs text-[#645C9A] leading-relaxed">
          Automated keeper triggers cycle renewal without custody, bounded by customer-approved cycle caps.
        </p>
      </div>
      <a href="/merchant/subscriptions" class="mt-4 text-xs font-bold text-[#2B2170] underline hover:no-underline">
        View Subs &rarr;
      </a>
    </div>

    <!-- Step 4 -->
    <div class="p-5 border-2 border-[#2B2170] rounded-[22px] bg-white flex flex-col justify-between">
      <div>
        <div class="w-7 h-7 rounded-full bg-[#C8C3F2] border border-[#2B2170] flex items-center justify-center font-bold text-xs text-[#2B2170] mb-3">
          4
        </div>
        <div class="font-bold text-sm text-[#2B2170] mb-1">AI Agent Purchase</div>
        <p class="text-xs text-[#645C9A] leading-relaxed">
          Buyer agent consumes paid API via x402 on Hedera, enforcing daily budgets and writing to HCS.
        </p>
      </div>
      <a href="/agents" class="mt-4 text-xs font-bold text-[#2B2170] underline hover:no-underline">
        Agent Spend &rarr;
      </a>
    </div>

    <!-- Step 5 -->
    <div class="p-5 border-2 border-[#2B2170] rounded-[22px] bg-white flex flex-col justify-between">
      <div>
        <div class="w-7 h-7 rounded-full bg-[#C8C3F2] border border-[#2B2170] flex items-center justify-center font-bold text-xs text-[#2B2170] mb-3">
          5
        </div>
        <div class="font-bold text-sm text-[#2B2170] mb-1">Treasury Guard</div>
        <p class="text-xs text-[#645C9A] leading-relaxed">
          Rebalance assets on Uniswap v4 pool with custom policy hook preventing unauthorized sizes.
        </p>
      </div>
      <a href="/treasury" class="mt-4 text-xs font-bold text-[#2B2170] underline hover:no-underline">
        Open Treasury &rarr;
      </a>
    </div>
  </div>
</section>

<!-- SECTION 4: INTERACTIVE SDK SANDBOX -->
<section id="sandbox" class="mb-20 pt-8 border-t border-[#E2DEF3]">
  <div class="mb-8">
    <div class="text-xs font-bold uppercase tracking-wider text-[#645C9A] mb-1">
      Live Interactive Sandbox
    </div>
    <h2 class="font-serif text-3xl sm:text-4xl font-normal text-[#2B2170]">
      Test PulsePay Invoice Generation
    </h2>
    <p class="font-serif italic text-base text-[#645C9A] mt-1">
      Simulate an onchain invoice creation and calculate real-time universal token conversion quotes.
    </p>
  </div>

  <Card tabText="INTERACTIVE SANDBOX" tabColor="purple" class="p-6 sm:p-8">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <!-- Controls -->
      <div class="lg:col-span-6 space-y-4">
        <div>
          <label for="sandboxAmountInput" class="block text-xs font-semibold uppercase tracking-wider text-[#645C9A] mb-1.5">
            Invoice Target Amount (USDT)
          </label>
          <input
            id="sandboxAmountInput"
            type="text"
            bind:value={sandboxAmount}
            class="w-full bg-white border-2 border-[#2B2170] rounded-xl px-4 py-2.5 text-sm font-bold text-[#2B2170] focus:outline-none"
          />
        </div>

        <div>
          <span class="block text-xs font-semibold uppercase tracking-wider text-[#645C9A] mb-1.5">
            Customer Payment Token
          </span>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              onclick={() => sandboxToken = 'USDT'}
              class="py-2 px-3 border-2 border-[#2B2170] rounded-xl text-xs font-bold transition-all cursor-pointer {sandboxToken === 'USDT' ? 'bg-[#C8C3F2]' : 'bg-white'}"
            >
              USDT (Direct)
            </button>
            <button
              type="button"
              onclick={() => sandboxToken = 'WETH'}
              class="py-2 px-3 border-2 border-[#2B2170] rounded-xl text-xs font-bold transition-all cursor-pointer {sandboxToken === 'WETH' ? 'bg-[#C8C3F2]' : 'bg-white'}"
            >
              WETH (Swap)
            </button>
            <button
              type="button"
              onclick={() => sandboxToken = 'USDC'}
              class="py-2 px-3 border-2 border-[#2B2170] rounded-xl text-xs font-bold transition-all cursor-pointer {sandboxToken === 'USDC' ? 'bg-[#C8C3F2]' : 'bg-white'}"
            >
              USDC (Swap)
            </button>
          </div>
        </div>

        <div class="pt-2">
          <Button
            variant="primary"
            fullWidth
            onclick={() => { sandboxSimulated = true; }}
          >
            Generate Onchain Payload
          </Button>
        </div>
      </div>

      <!-- Preview Box -->
      <div class="lg:col-span-6">
        <div class="p-5 border-2 border-[#2B2170] rounded-xl bg-[#FDFDFC] space-y-3 font-mono text-xs">
          <div class="flex justify-between items-center text-[10px] uppercase font-bold text-[#645C9A] pb-2 border-b border-[#E2DEF3]">
            <span>Payload Manifest</span>
            <span>Whitechain 1874</span>
          </div>
          <div class="space-y-1.5 text-[#2B2170]">
            <div><span class="text-[#645C9A]">settlementAmount:</span> {sandboxAmount} USDT (base: {(parseFloat(sandboxAmount) || 0) * 1000000}n)</div>
            <div><span class="text-[#645C9A]">customerPayerToken:</span> {sandboxToken}</div>
            <div>
              <span class="text-[#645C9A]">quotedInput:</span>
              {sandboxToken === 'WETH' ? `${((parseFloat(sandboxAmount) || 20) * 0.00039).toFixed(4)} WETH` : (sandboxToken === 'USDC' ? `${((parseFloat(sandboxAmount) || 20) * 1.002).toFixed(2)} USDC` : `${sandboxAmount} USDT`)}
            </div>
            <div><span class="text-[#645C9A]">reserveVaultLocked:</span> {((parseFloat(sandboxAmount) || 20) * 0.2).toFixed(2)} USDT (20%)</div>
            <div><span class="text-[#645C9A]">routerPolicy:</span> "EXACT_OUTPUT_MERCHANT_HUB"</div>
          </div>
          {#if sandboxSimulated}
            <div transition:slide={{ duration: 150 }} class="p-2.5 bg-[#C8C3F2] border border-[#2B2170] rounded-lg font-bold text-xs text-[#2B2170]">
              ✓ Ready for SDK checkout mount (#checkout-container)
            </div>
          {/if}
        </div>
      </div>
    </div>
  </Card>
</section>

<!-- SECTION 5: ENTERPRISE COMPARISON TABLE (PRD SECTION 3) -->
<section id="comparison" class="mb-20 pt-8 border-t border-[#E2DEF3]">
  <div class="mb-8">
    <div class="text-xs font-bold uppercase tracking-wider text-[#645C9A] mb-1">
      Market Benchmark
    </div>
    <h2 class="font-serif text-3xl sm:text-4xl font-normal text-[#2B2170]">
      Why PulsePay for Enterprise B2B
    </h2>
    <p class="font-serif italic text-base text-[#645C9A] mt-1">
      Comparing legacy card networks, fragmented Web3 plugins, and PulsePay's unified architecture.
    </p>
  </div>

  <Card tabText="BENCHMARK MATRIX" tabColor="purple" class="p-6">
    <div class="w-full overflow-x-auto">
      <table class="w-full border-collapse text-left text-xs sm:text-sm">
        <thead>
          <tr class="border-b-2 border-[#2B2170]">
            <th class="py-3 px-3 uppercase text-[11px] font-bold text-[#2B2170]">Feature</th>
            <th class="py-3 px-3 uppercase text-[11px] font-bold text-[#645C9A]">Traditional (Stripe)</th>
            <th class="py-3 px-3 uppercase text-[11px] font-bold text-[#645C9A]">Generic Web3</th>
            <th class="py-3 px-3 uppercase text-[11px] font-bold text-[#2B2170] bg-[#C8C3F2]/30">PulsePay Unified SDK</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#E2DEF3]">
          <tr>
            <td class="py-3 px-3 font-semibold text-[#2B2170]">Autonomous AI Agents</td>
            <td class="py-3 px-3 text-[#645C9A]">No (blocks headless requests)</td>
            <td class="py-3 px-3 text-[#645C9A]">Unsafe unrestricted wallet</td>
            <td class="py-3 px-3 font-bold text-[#2B2170] bg-[#C8C3F2]/20">x402 protocol + Hedera Agent Kit limits</td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-semibold text-[#2B2170]">Pay With Any Token</td>
            <td class="py-3 px-3 text-[#645C9A]">N/A (Fiat only)</td>
            <td class="py-3 px-3 text-[#645C9A]">Requires user manual bridge/swap</td>
            <td class="py-3 px-3 font-bold text-[#2B2170] bg-[#C8C3F2]/20">Native Uniswap routing to exact USDT</td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-semibold text-[#2B2170]">Refund Guarantees</td>
            <td class="py-3 px-3 text-[#645C9A]">5-10 day card reversal</td>
            <td class="py-3 px-3 text-[#645C9A]">Manual informal wallet transfers</td>
            <td class="py-3 px-3 font-bold text-[#2B2170] bg-[#C8C3F2]/20">Instant onchain 20% reserve backing</td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-semibold text-[#2B2170]">Subscription Security</td>
            <td class="py-3 px-3 text-[#645C9A]">Opaque silent billing</td>
            <td class="py-3 px-3 text-[#645C9A]">Risky infinite ERC-20 allowances</td>
            <td class="py-3 px-3 font-bold text-[#2B2170] bg-[#C8C3F2]/20">Capped cycle limits & onchain cancel</td>
          </tr>
          <tr>
            <td class="py-3 px-3 font-semibold text-[#2B2170]">Consensus Audit Trail</td>
            <td class="py-3 px-3 text-[#645C9A]">Internal centralized database</td>
            <td class="py-3 px-3 text-[#645C9A]">Disconnected block explorers</td>
            <td class="py-3 px-3 font-bold text-[#2B2170] bg-[#C8C3F2]/20">Immutable HCS topic + unified ledger</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Card>
</section>

<!-- SECTION 6: GETTING STARTED & QUICK LINKS -->
<section id="get-started" class="mb-16 pt-8 border-t border-[#E2DEF3]">
  <Card tabText="INTEGRATION" tabColor="purple" class="p-8 text-center bg-white">
    <h2 class="font-serif text-3xl sm:text-4xl font-normal text-[#2B2170] mb-2">
      Ready to deploy PulsePay?
    </h2>
    <p class="font-serif italic text-base text-[#645C9A] max-w-xl mx-auto mb-6">
      Drop the SDK into your Next.js, SvelteKit, React or Node.js backend in under 20 lines of code.
    </p>

    <div class="flex flex-wrap items-center justify-center gap-3">
      <Button variant="primary" size="lg" href="/checkout">
        Launch Customer Checkout
      </Button>
      <Button variant="outline" size="lg" href="/merchant">
        Access Merchant Dashboard
      </Button>
      <Button variant="secondary" size="lg" href="/agents">
        Test AI Agent Micropayments
      </Button>
    </div>
  </Card>
</section>
