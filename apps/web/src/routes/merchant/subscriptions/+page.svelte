<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import { initialSubscribers, type Subscriber } from '$lib/mock';

  let subscribers = $state<Subscriber[]>([...initialSubscribers]);
  let isCancelled = $state(false);
  let cancelMessage = $state('');

  function handleCancelSub() {
    if (confirm("Are you sure you want to cancel subscription on Whitechain? This blocks all future chargeRenewal() pulls onchain.")) {
      isCancelled = true;
      cancelMessage = 'Subscription cancelled onchain. All future pulls are now blocked.';
      const sub1 = subscribers.find(s => s.address === '0x3f...a91');
      if (sub1) {
        sub1.status = 'REFUNDED';
        sub1.nextCharge = 'cancelled';
      }
    }
  }
</script>

<svelte:head>
  <title>PulsePay — Recurring Subscriptions (Whitechain)</title>
</svelte:head>

<section class="mt-4 mb-12">
  <!-- PAGE HEADER -->
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
    <div>
      <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2B2170] tracking-tight mb-2">
        Subscriptions.
      </h1>
      <p class="font-serif italic text-lg sm:text-xl text-[#645C9A] font-normal">
        Bounded, transparent, cancellable at any time
      </p>
    </div>
    <div>
      <a
        href="/merchant"
        class="inline-flex items-center gap-2 border-2 border-[#2B2170] rounded-full px-5 py-2 text-sm font-semibold hover:bg-black/5 transition-colors"
      >
        <span>&larr;</span>
        <span>Back to Invoices</span>
      </a>
    </div>
  </div>

  <!-- 3-COLUMN MAIN LAYOUT -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- LEFT COLUMN (3 cols): PLAN + RENEWAL WORKER -->
    <div class="lg:col-span-3 space-y-6">
      <!-- PLAN CARD -->
      <Card tabText="PLAN" tabColor="purple" class="p-6">
        <div class="pt-1">
          <h2 class="font-serif text-3xl font-normal text-[#2B2170] mb-1">
            Pro
          </h2>
          <div class="text-xs font-semibold text-[#645C9A] mb-6">
            20.00 USDT / 30 days
          </div>

          <div class="space-y-3 text-xs sm:text-sm text-[#2B2170] pb-6">
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Max cycles</span>
              <span class="font-semibold">12</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Grace period</span>
              <span class="font-semibold">3 days</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Authorization</span>
              <span class="font-semibold">capped approval</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Permit (EIP-2612)</span>
              <span class="font-semibold">if supported</span>
            </div>
          </div>

          <Button variant="outline" fullWidth size="sm">
            Edit plan
          </Button>
        </div>
      </Card>

      <!-- RENEWAL WORKER CARD -->
      <Card tabText="RENEWAL WORKER" tabColor="purple" class="p-6">
        <div class="pt-1 space-y-3.5 text-xs sm:text-sm text-[#2B2170]">
          <div class="flex items-start gap-2.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#2B2170] mt-1 shrink-0"></span>
            <span>Scans <code class="font-mono text-xs bg-black/5 px-1 py-0.5 rounded">nextChargeAt</code></span>
          </div>

          <div class="flex items-start gap-2.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#2B2170] mt-1 shrink-0"></span>
            <span>Calls <code class="font-mono text-xs bg-black/5 px-1 py-0.5 rounded">chargeRenewal()</code> only if due</span>
          </div>

          <div class="flex items-start gap-2.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#2B2170] mt-1 shrink-0"></span>
            <span>Contract checks active · due · cycle cap</span>
          </div>

          <div class="flex items-start gap-2.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-[#2B2170] mt-1 shrink-0"></span>
            <span>Failed pull &rarr; retry state, never 'paid'</span>
          </div>
        </div>
      </Card>
    </div>

    <!-- CENTER COLUMN (6 cols): SUBSCRIBERS TABLE -->
    <div class="lg:col-span-6">
      <Card tabText="SUBSCRIBERS" tabColor="purple" class="p-6">
        <div class="w-full overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b-2 border-[#2B2170]">
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">SUBSCRIBER</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">NEXT CHARGE</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">CYCLES</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">STATUS</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E2DEF3]">
              {#each subscribers as sub (sub.id)}
                <tr class="hover:bg-black/[0.015] transition-colors">
                  <td class="py-4 px-3 font-mono text-sm font-semibold text-[#2B2170]">
                    {sub.address}
                  </td>
                  <td class="py-4 px-3 text-sm text-[#2B2170]">
                    {sub.nextCharge}
                  </td>
                  <td class="py-4 px-3 text-sm text-[#2B2170]">
                    {sub.cyclesCompleted} / {sub.cyclesTotal}
                  </td>
                  <td class="py-4 px-3">
                    <Chip status={sub.status} />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Card>
    </div>

    <!-- RIGHT COLUMN (3 cols): CUSTOMER RECEIPT -->
    <div class="lg:col-span-3">
      <Card tabText="CUSTOMER RECEIPT" tabColor="purple" class="p-6">
        <div class="pt-1 space-y-6">
          <!-- Timeline entries with strict purple nodes -->
          <div class="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#2B2170]">
            <!-- Payment -->
            <div class="relative">
              <span class="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-[#2B2170] bg-[#C8C3F2]"></span>
              <div class="font-semibold text-sm text-[#2B2170]">Payment</div>
              <div class="text-xs text-[#645C9A]">
                20.00 USDT · <a href="https://whitechain.io" target="_blank" rel="noreferrer" class="underline hover:text-[#2B2170]">tx ↗</a>
              </div>
            </div>

            <!-- Refund (Purple tint, no pink) -->
            <div class="relative">
              <span class="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-[#2B2170] bg-[#D6D2F7]"></span>
              <div class="font-semibold text-sm text-[#2B2170]">Refund</div>
              <div class="text-xs text-[#645C9A]">
                5.00 USDT · <a href="https://whitechain.io" target="_blank" rel="noreferrer" class="underline hover:text-[#2B2170]">tx ↗</a>
              </div>
            </div>

            <!-- Cumulative refund (Purple tint, no pink) -->
            <div class="relative">
              <span class="absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-[#2B2170] bg-[#B4ADEB]"></span>
              <div class="font-semibold text-sm text-[#2B2170]">Cumulative refund</div>
              <div class="text-xs text-[#645C9A]">
                5.00 / 20.00
              </div>
            </div>
          </div>

          <!-- Status badge -->
          <div>
            <Chip status="PARTIALLY REFUNDED" variant="partial" />
          </div>

          <!-- Next billing dashed box -->
          <div class="border-2 border-dashed border-[#2B2170] rounded-xl p-4 text-left">
            <div class="text-[11px] font-bold uppercase tracking-wider text-[#645C9A] mb-1">
              Next billing
            </div>
            <div class="font-serif text-2xl font-bold text-[#2B2170]">
              {isCancelled ? 'Cancelled' : '05 Dec 2026'}
            </div>
          </div>

          {#if cancelMessage}
            <div class="p-2.5 bg-[#EAE7FA] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170] text-center">
              ✓ {cancelMessage}
            </div>
          {/if}

          <!-- Cancel subscription action -->
          <div class="space-y-2">
            <Button
              variant="outline"
              fullWidth
              disabled={isCancelled}
              onclick={handleCancelSub}
            >
              {isCancelled ? 'Subscription cancelled' : 'Cancel subscription'}
            </Button>
            <div class="text-center text-xs text-[#645C9A]">
              Cancel is onchain and blocks all future pulls
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>
