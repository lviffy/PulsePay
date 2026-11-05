<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import ChainBadge from '$lib/components/ChainBadge.svelte';
  import type { CheckoutState } from '$lib/mock';

  // Checkout states to toggle between
  let selectedState = $state<CheckoutState>('READY');
  let payMode = $state<'USDT' | 'ANY'>('ANY');
  let selectedToken = $state<'USDT' | 'WETH' | 'USDC'>('WETH');
  let isApproved = $state(false);
  let isConfirmed = $state(false);
  let isPending = $state(false);

  const stateOptions: { id: CheckoutState; label: string }[] = [
    { id: 'WALLET_NOT_CONNECTED', label: 'Wallet not connected' },
    { id: 'WRONG_NETWORK', label: 'Wrong network' },
    { id: 'INSUFFICIENT_BALANCE', label: 'Insufficient balance' },
    { id: 'APPROVAL_REQUIRED', label: 'Approval required' },
    { id: 'PENDING_CONFIRMATION', label: 'Pending confirmation' },
    { id: 'REVERTED_REJECTED', label: 'Reverted / rejected' },
    { id: 'READY', label: 'Ready to pay' }
  ];

  function handleStateChange(state: CheckoutState) {
    selectedState = state;
    if (state === 'APPROVAL_REQUIRED') {
      isApproved = false;
      isConfirmed = false;
      isPending = false;
    } else if (state === 'PENDING_CONFIRMATION') {
      isApproved = true;
      isPending = true;
      isConfirmed = false;
    } else if (state === 'REVERTED_REJECTED') {
      isApproved = true;
      isPending = false;
      isConfirmed = false;
    } else if (state === 'CONFIRMED') {
      isApproved = true;
      isPending = false;
      isConfirmed = true;
    } else {
      isPending = false;
      isConfirmed = false;
    }
  }

  function handleMainAction() {
    if (selectedState === 'WALLET_NOT_CONNECTED') {
      selectedState = 'READY';
      return;
    }
    if (selectedState === 'WRONG_NETWORK') {
      selectedState = 'READY';
      return;
    }
    if (selectedState === 'APPROVAL_REQUIRED' && !isApproved) {
      isApproved = true;
      selectedState = 'READY';
      return;
    }

    // Trigger payment
    isPending = true;
    selectedState = 'PENDING_CONFIRMATION';
    setTimeout(() => {
      isPending = false;
      isConfirmed = true;
      selectedState = 'CONFIRMED';
    }, 1800);
  }
</script>

<svelte:head>
  <title>PulsePay — Universal Checkout (B2B)</title>
</svelte:head>

<section class="mt-4 mb-12">
  <!-- PAGE HEADER -->
  <div class="mb-10">
    <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2B2170] tracking-tight mb-2">
      Checkout.
    </h1>
    <p class="font-serif italic text-lg sm:text-xl text-[#645C9A] font-normal">
      Acme Studio · Pro plan · invoice inv_123
    </p>
  </div>

  <!-- 3 COLUMN LAYOUT -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- LEFT CARD: STATES SELECTOR (3 cols) -->
    <div class="lg:col-span-3">
      <Card tabText="STATES" tabColor="purple" class="p-5">
        <div class="space-y-3 pt-2">
          {#each stateOptions as opt}
            <label
              class="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-black/[0.02] transition-colors select-none text-sm text-[#2B2170] {selectedState === opt.id ? 'font-semibold' : ''}"
            >
              <input
                type="radio"
                name="checkoutState"
                value={opt.id}
                checked={selectedState === opt.id}
                onchange={() => handleStateChange(opt.id)}
                class="w-4 h-4 text-[#2B2170] border-2 border-[#2B2170] focus:ring-0 focus:ring-offset-0 cursor-pointer accent-[#2B2170]"
              />
              <span>{opt.label}</span>
            </label>
          {/each}
        </div>
      </Card>
    </div>

    <!-- CENTER CARD: CUSTOMER CHECKOUT (6 cols) -->
    <div class="lg:col-span-6">
      <Card tabText="CUSTOMER CHECKOUT" tabColor="purple" class="p-6 sm:p-8">
        <!-- Invoice Header -->
        <div class="text-center sm:text-left mb-6">
          <div class="text-xs font-semibold text-[#645C9A] uppercase tracking-wider mb-1">
            Acme Studio
          </div>
          <div class="font-serif text-4xl sm:text-5xl font-normal text-[#2B2170] tracking-tight mb-1">
            20.00 USDT
          </div>
          <div class="text-xs sm:text-sm text-[#645C9A]">
            Pro plan · monthly · Whitechain Sepolia
          </div>
        </div>

        <!-- Mode Toggle Tabs (Pay with USDT / Pay with any token) -->
        <div class="grid grid-cols-2 p-1 border-2 border-[#2B2170] rounded-full mb-6 bg-white overflow-hidden">
          <button
            type="button"
            onclick={() => { payMode = 'USDT'; selectedToken = 'USDT'; }}
            class="py-2 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer {payMode === 'USDT' ? 'bg-[#C8C3F2] text-[#2B2170]' : 'text-[#645C9A] hover:text-[#2B2170]'}"
          >
            Pay with USDT
          </button>
          <button
            type="button"
            onclick={() => { payMode = 'ANY'; selectedToken = 'WETH'; }}
            class="py-2 text-xs sm:text-sm font-semibold rounded-full transition-all cursor-pointer {payMode === 'ANY' ? 'bg-[#C8C3F2] text-[#2B2170]' : 'text-[#645C9A] hover:text-[#2B2170]'}"
          >
            Pay with any token
          </button>
        </div>

        <!-- Token Options List -->
        <div class="space-y-3 mb-6">
          <!-- Row 1: USDT -->
          <div
            role="button"
            tabindex="0"
            onclick={() => selectedToken = 'USDT'}
            onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') selectedToken = 'USDT'; }}
            class="flex items-center justify-between p-3.5 border-2 border-[#2B2170] rounded-xl transition-all cursor-pointer select-none {selectedToken === 'USDT' ? 'bg-[#C8C3F2]/40 border-[#2B2170]' : 'bg-white hover:bg-black/[0.015]'}"
          >
            <div class="flex items-center gap-3">
              <ChainBadge chain="USDT" size="sm" />
              <div>
                <div class="font-bold text-sm text-[#2B2170]">USDT</div>
                <div class="text-xs text-[#645C9A]">Balance 12.00</div>
              </div>
            </div>
            <div class="text-xs sm:text-sm font-semibold text-[#645C9A]">
              short by 8.00
            </div>
          </div>

          <!-- Row 2: WETH (Selected - purple highlight) -->
          <div
            role="button"
            tabindex="0"
            onclick={() => selectedToken = 'WETH'}
            onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') selectedToken = 'WETH'; }}
            class="flex items-center justify-between p-3.5 border-2 border-[#2B2170] rounded-xl transition-all cursor-pointer select-none {selectedToken === 'WETH' ? 'bg-[#C8C3F2]/50 border-[#2B2170]' : 'bg-white hover:bg-black/[0.015]'}"
          >
            <div class="flex items-center gap-3">
              <ChainBadge chain="WETH" size="sm" />
              <div>
                <div class="font-bold text-sm text-[#2B2170]">WETH</div>
                <div class="text-xs text-[#645C9A]">Balance 0.052</div>
              </div>
            </div>
            <div class="text-xs sm:text-sm font-bold text-[#2B2170]">
              0.0078 WETH
            </div>
          </div>

          <!-- Row 3: USDC -->
          <div
            role="button"
            tabindex="0"
            onclick={() => selectedToken = 'USDC'}
            onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') selectedToken = 'USDC'; }}
            class="flex items-center justify-between p-3.5 border-2 border-[#2B2170] rounded-xl transition-all cursor-pointer select-none {selectedToken === 'USDC' ? 'bg-[#D6D2F7]/40 border-[#2B2170]' : 'bg-white hover:bg-black/[0.015]'}"
          >
            <div class="flex items-center gap-3">
              <ChainBadge chain="USDC" size="sm" />
              <div>
                <div class="font-bold text-sm text-[#2B2170]">USDC</div>
                <div class="text-xs text-[#645C9A]">Balance 40.00</div>
              </div>
            </div>
            <div class="text-xs sm:text-sm font-bold text-[#2B2170]">
              20.04 USDC
            </div>
          </div>
        </div>

        <!-- Uniswap Route Card (Dashed Outline) -->
        <div class="border-2 border-dashed border-[#2B2170] rounded-xl p-4 mb-6 bg-white">
          <div class="text-[11px] font-bold uppercase tracking-wider text-[#645C9A] mb-1.5">
            Uniswap route
          </div>
          <div class="font-mono text-xs sm:text-sm font-semibold text-[#2B2170] mb-1">
            {selectedToken} &rarr; Uniswap &rarr; 20.00 USDT &rarr; MerchantHub
          </div>
          <div class="text-xs text-[#645C9A]">
            Slippage 0.5% · max input {selectedToken === 'WETH' ? '0.0079 WETH' : '20.10 USDC'} · est. gas 0.0002
          </div>
        </div>

        <!-- Stepper Indicator -->
        <div class="flex items-center justify-between px-2 mb-6 text-xs font-semibold text-[#2B2170]">
          <div class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full border-2 border-[#2B2170] {isApproved || selectedState === 'READY' || isConfirmed ? 'bg-[#C8C3F2]' : 'bg-white'}"></span>
            <span>Approve</span>
          </div>
          <div class="flex-1 mx-3 h-[2px] bg-[#2B2170]"></div>
          <div class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full border-2 border-[#2B2170] {isPending || isConfirmed ? 'bg-[#C8C3F2]' : 'bg-white'}"></span>
            <span>Swap + pay</span>
          </div>
          <div class="flex-1 mx-3 h-[2px] bg-[#2B2170]"></div>
          <div class="flex items-center gap-2">
            <span class="w-3.5 h-3.5 rounded-full border-2 border-[#2B2170] {isConfirmed ? 'bg-[#C8C3F2]' : 'bg-white'}"></span>
            <span>Confirmed</span>
          </div>
        </div>

        <!-- Conditional State Alert Messages (Strictly Purple / Neutral) -->
        {#if selectedState === 'WALLET_NOT_CONNECTED'}
          <div class="p-3 mb-4 bg-[#EAE7FA] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
            ⚠ Wallet not connected. Please connect your Web3 wallet.
          </div>
        {:else if selectedState === 'WRONG_NETWORK'}
          <div class="p-3 mb-4 bg-[#E2DEF3] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
            ⚠ Wrong network: connected to Chain 1. Please switch to Whitechain 1874.
          </div>
        {:else if selectedState === 'INSUFFICIENT_BALANCE'}
          <div class="p-3 mb-4 bg-[#E2DEF3] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
            ⚠ Insufficient balance for this transaction.
          </div>
        {:else if selectedState === 'APPROVAL_REQUIRED' && !isApproved}
          <div class="p-3 mb-4 bg-[#EAE7FA] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
            ℹ ERC20 Approval required before swap & settlement.
          </div>
        {:else if selectedState === 'REVERTED_REJECTED'}
          <div class="p-3 mb-4 bg-[#E2DEF3] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
            ✕ Transaction reverted onchain: Slippage tolerance exceeded.
          </div>
        {:else if isConfirmed}
          <div class="p-3 mb-4 bg-[#C8C3F2] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
            ✓ Payment confirmed on Whitechain block 4,198,230!
          </div>
        {/if}

        <!-- Primary Action Button -->
        <div class="space-y-2">
          {#if selectedState === 'WALLET_NOT_CONNECTED'}
            <Button variant="primary" fullWidth size="lg" onclick={handleMainAction}>
              Connect wallet
            </Button>
          {:else if selectedState === 'WRONG_NETWORK'}
            <Button variant="secondary" fullWidth size="lg" onclick={handleMainAction}>
              Switch to Whitechain 1874
            </Button>
          {:else if selectedState === 'INSUFFICIENT_BALANCE'}
            <Button variant="primary" fullWidth size="lg" disabled>
              Insufficient balance
            </Button>
          {:else if selectedState === 'APPROVAL_REQUIRED' && !isApproved}
            <Button variant="secondary" fullWidth size="lg" onclick={handleMainAction}>
              Approve {selectedToken} (Step 1 of 2)
            </Button>
          {:else if isPending}
            <Button variant="primary" fullWidth size="lg" disabled>
              <span class="inline-block animate-spin mr-2">⟳</span> Confirming onchain...
            </Button>
          {:else if isConfirmed}
            <Button variant="primary" fullWidth size="lg" onclick={() => handleStateChange('READY')}>
              ✓ Payment Complete (Reset)
            </Button>
          {:else}
            <Button variant="primary" fullWidth size="lg" onclick={handleMainAction}>
              Pay with {selectedToken === 'WETH' ? '0.0078 WETH' : (selectedToken === 'USDC' ? '20.04 USDC' : '20.00 USDT')}
            </Button>
          {/if}

          <div class="text-center text-xs text-[#645C9A] pt-1">
            Paid only after onchain confirmation
          </div>
        </div>
      </Card>
    </div>

    <!-- RIGHT CARD: RECEIPT (3 cols) -->
    <div class="lg:col-span-3">
      <Card tabText="RECEIPT" tabColor="purple" class="p-6">
        <div class="space-y-4 pt-2 text-sm text-[#2B2170]">
          <div class="flex justify-between items-center">
            <span class="text-[#645C9A]">Invoice</span>
            <span class="font-mono font-semibold">inv_123</span>
          </div>

          <div class="flex justify-between items-center">
            <span class="text-[#645C9A]">Paid with</span>
            <span class="font-bold">0.0078 WETH</span>
          </div>

          <div class="flex justify-between items-center">
            <span class="text-[#645C9A]">Settled</span>
            <span class="font-bold">20.00 USDT</span>
          </div>

          <div class="flex justify-between items-center">
            <span class="text-[#645C9A]">Status</span>
            <Chip status={isConfirmed ? 'PAID' : (selectedState === 'REVERTED_REJECTED' ? 'REJECTED' : 'OPEN')} />
          </div>

          <div class="pt-6 border-t border-[#E2DEF3] space-y-2 text-sm font-semibold">
            <div>
              <a
                href="https://unichain.blockscout.com"
                target="_blank"
                rel="noreferrer"
                class="hover:underline inline-flex items-center gap-1 text-[#2B2170]"
              >
                Swap tx ↗
              </a>
            </div>
            <div>
              <a
                href="https://whitechain.io"
                target="_blank"
                rel="noreferrer"
                class="hover:underline inline-flex items-center gap-1 text-[#2B2170]"
              >
                Settlement tx ↗
              </a>
            </div>
            <div class="pt-2">
              <a
                href="https://whitechain.io"
                target="_blank"
                rel="noreferrer"
                class="text-xs text-[#645C9A] hover:text-[#2B2170] hover:underline"
              >
                Verify on explorer
              </a>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>
