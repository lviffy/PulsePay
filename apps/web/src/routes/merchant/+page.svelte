<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import Field from '$lib/components/Field.svelte';
  import { initialInvoices, formatBaseUnits, type Invoice } from '$lib/mock';

  let invoices = $state<Invoice[]>([...initialInvoices]);
  let filter = $state<'ALL' | 'PAID' | 'OPEN' | 'REFUNDED'>('ALL');

  // Refund Form State
  let refundInvoiceId = $state('inv_122');
  let refundAmount = $state('5.00');
  let refundReason = $state('Prorated goodwill');
  let refundSuccessMsg = $state('');

  let filteredInvoices = $derived(
    invoices.filter((inv) => {
      if (filter === 'ALL') return true;
      if (filter === 'PAID') return inv.status === 'PAID';
      if (filter === 'OPEN') return inv.status === 'OPEN';
      if (filter === 'REFUNDED') return inv.status === 'PARTIAL REFUND' || inv.status === 'REFUNDED';
      return true;
    })
  );

  function handleRefundSubmit(e: SubmitEvent) {
    e.preventDefault();
    const target = invoices.find(i => i.id === refundInvoiceId);
    if (!target) return;

    const amountFloat = parseFloat(refundAmount) || 0;
    const amountBase = BigInt(Math.round(amountFloat * 1_000_000));

    target.refundedBase = (target.refundedBase || 0n) + amountBase;
    target.status = target.refundedBase >= target.amountBase ? 'REFUNDED' : 'PARTIAL REFUND';

    refundSuccessMsg = `Successfully refunded ${refundAmount} USDT onchain to original payer (${target.customer})!`;
    setTimeout(() => {
      refundSuccessMsg = '';
    }, 4000);
  }
</script>

<svelte:head>
  <title>PulsePay — Merchant Receivables & Invoices</title>
</svelte:head>

<section class="mt-4 mb-12">
  <!-- PAGE HEADER -->
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
    <div>
      <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2B2170] tracking-tight mb-2">
        Merchant overview.
      </h1>
      <p class="font-serif italic text-lg sm:text-xl text-[#645C9A] font-normal">
        Invoices, refunds and activity for Acme Studio
      </p>
    </div>
    <div>
      <a
        href="/merchant/subscriptions"
        class="inline-flex items-center gap-2 border-2 border-[#2B2170] rounded-full px-5 py-2 text-sm font-semibold bg-[#C8C3F2] hover:bg-[#b8b3ea] transition-colors"
      >
        <span>View Subscriptions</span>
        <span>&rarr;</span>
      </a>
    </div>
  </div>

  <!-- STATS ROW (6 OUTLINED CARDS) -->
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
    <!-- Stat 1: Collected -->
    <div class="bg-white border-2 border-[#2B2170] rounded-[22px] p-4 text-left shadow-2xs">
      <div class="text-xs font-semibold text-[#645C9A] mb-1">Collected</div>
      <div class="font-serif text-xl sm:text-2xl font-normal text-[#2B2170]">
        1,240 USDT
      </div>
    </div>

    <!-- Stat 2: Open invoices -->
    <div class="bg-white border-2 border-[#2B2170] rounded-[22px] p-4 text-left shadow-2xs">
      <div class="text-xs font-semibold text-[#645C9A] mb-1">Open invoices</div>
      <div class="font-serif text-xl sm:text-2xl font-normal text-[#2B2170]">
        6
      </div>
    </div>

    <!-- Stat 3: Active subs -->
    <div class="bg-white border-2 border-[#2B2170] rounded-[22px] p-4 text-left shadow-2xs">
      <div class="text-xs font-semibold text-[#645C9A] mb-1">Active subs</div>
      <div class="font-serif text-xl sm:text-2xl font-normal text-[#2B2170]">
        14
      </div>
    </div>

    <!-- Stat 4: Refunds -->
    <div class="bg-white border-2 border-[#2B2170] rounded-[22px] p-4 text-left shadow-2xs">
      <div class="text-xs font-semibold text-[#645C9A] mb-1">Refunds</div>
      <div class="font-serif text-xl sm:text-2xl font-normal text-[#2B2170]">
        35 USDT
      </div>
    </div>

    <!-- Stat 5: Agent spend -->
    <div class="bg-white border-2 border-[#2B2170] rounded-[22px] p-4 text-left shadow-2xs">
      <div class="text-xs font-semibold text-[#645C9A] mb-1">Agent spend</div>
      <div class="font-serif text-xl sm:text-2xl font-normal text-[#2B2170]">
        2.4 USDC
      </div>
    </div>

    <!-- Stat 6: Treasury -->
    <div class="bg-white border-2 border-[#2B2170] rounded-[22px] p-4 text-left shadow-2xs">
      <div class="text-xs font-semibold text-[#645C9A] mb-1">Treasury</div>
      <div class="font-serif text-xl sm:text-2xl font-normal text-[#2B2170]">
        1 position
      </div>
    </div>
  </div>

  <!-- 2-COLUMN MAIN CONTENT (INVOICES + REFUND) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- LEFT CARD: INVOICES TABLE (8 cols) -->
    <div class="lg:col-span-8">
      <Card tabText="INVOICES" tabColor="purple" class="p-6">
        <!-- Filter Pills Header -->
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pt-1">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => filter = 'ALL'}
              class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {filter === 'ALL' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
            >
              All
            </button>
            <button
              type="button"
              onclick={() => filter = 'PAID'}
              class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {filter === 'PAID' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
            >
              Paid
            </button>
            <button
              type="button"
              onclick={() => filter = 'OPEN'}
              class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {filter === 'OPEN' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
            >
              Open
            </button>
            <button
              type="button"
              onclick={() => filter = 'REFUNDED'}
              class="px-4 py-1.5 border-2 border-[#2B2170] rounded-full text-xs font-bold transition-colors cursor-pointer {filter === 'REFUNDED' ? 'bg-[#C8C3F2]' : 'bg-transparent hover:bg-black/5'}"
            >
              Refunded
            </button>
          </div>

          <div class="w-16 h-8 bg-[#2B2170] rounded-full hidden sm:block opacity-90"></div>
        </div>

        <!-- Invoices Table -->
        <div class="w-full overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b-2 border-[#2B2170]">
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">INVOICE</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">CUSTOMER</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">AMOUNT</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">VIA</th>
                <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">STATUS</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E2DEF3]">
              {#each filteredInvoices as inv (inv.id)}
                <tr class="hover:bg-black/[0.015] transition-colors">
                  <td class="py-4 px-3 font-mono text-sm font-semibold text-[#2B2170]">
                    {inv.id}
                  </td>
                  <td class="py-4 px-3 font-mono text-sm text-[#2B2170]">
                    {inv.customer}
                  </td>
                  <td class="py-4 px-3 text-sm font-semibold text-[#2B2170]">
                    {formatBaseUnits(inv.amountBase, inv.decimals, inv.token)}
                  </td>
                  <td class="py-4 px-3 text-sm text-[#2B2170]">
                    {inv.via}
                  </td>
                  <td class="py-4 px-3">
                    <Chip status={inv.status} />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Footnote -->
        <div class="mt-6 pt-4 border-t border-[#E2DEF3] text-xs text-[#645C9A]">
          Statuses read from contract state · payment links & webhooks per invoice
        </div>
      </Card>
    </div>

    <!-- RIGHT CARD: REFUND FORM (4 cols) -->
    <div class="lg:col-span-4">
      <Card tabText="REFUND" tabColor="purple" class="p-6">
        <form onsubmit={handleRefundSubmit} class="space-y-4 pt-1">
          <!-- Refund Target Header -->
          <div class="font-serif text-lg font-normal text-[#2B2170] mb-2">
            {refundInvoiceId} · 50.00 USDT
          </div>

          <!-- Refund Spec Values -->
          <div class="space-y-2 text-sm text-[#2B2170] pb-2 border-b border-[#E2DEF3]">
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Original payment</span>
              <span class="font-semibold">50.00</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Refunded so far</span>
              <span class="font-semibold">0.00</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Refundable</span>
              <span class="font-semibold">50.00</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-[#645C9A]">Refund reserve (20%)</span>
              <span class="font-semibold">10.00 avail.</span>
            </div>
          </div>

          <!-- Inputs -->
          <div class="space-y-3">
            <Field
              label="Refund amount (USDT)"
              bind:value={refundAmount}
              placeholder="5.00"
            />

            <Field
              label="Reason"
              bind:value={refundReason}
              placeholder="Prorated goodwill"
            />
          </div>

          <!-- Warning Banner (Formal Purple Tint Box) -->
          <div class="p-3 bg-[#EAE7FA] border-2 border-[#2B2170] rounded-xl text-center text-xs font-semibold text-[#2B2170]">
            Goes to original payer only
          </div>

          {#if refundSuccessMsg}
            <div class="p-3 bg-[#C8C3F2] border-2 border-[#2B2170] rounded-xl text-xs font-bold text-[#2B2170]">
              ✓ {refundSuccessMsg}
            </div>
          {/if}

          <!-- Submit Button -->
          <Button type="submit" variant="primary" fullWidth size="lg">
            Confirm refund
          </Button>
        </form>
      </Card>
    </div>
  </div>
</section>
