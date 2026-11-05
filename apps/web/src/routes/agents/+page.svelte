<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Chip from '$lib/components/Chip.svelte';
  import Button from '$lib/components/Button.svelte';
  import Toggle from '$lib/components/Toggle.svelte';
  import Field from '$lib/components/Field.svelte';
  import {
    initialAgentServices,
    initialAgentActivities,
    initialSpendControls,
    formatBaseUnits,
    type AgentService,
    type AgentActivity
  } from '$lib/mock';

  let services = $state<AgentService[]>([...initialAgentServices]);
  let activities = $state<AgentActivity[]>([...initialAgentActivities]);

  // Spend controls state
  let isAgentEnabled = $state(true);
  let dailyBudget = $state('5.00');
  let maxPerRequest = $state('0.10');
  let perMerchantPerDay = $state('2.00');
  let humanApprovalAbove = $state('0.50');
  let allowlist = $state<string[]>([...initialSpendControls.merchantsAllowlist]);
  let isEmergencyStopped = $state(false);

  // Modals
  let showPublishModal = $state(false);
  let newServiceName = $state('');
  let newServicePrice = $state('0.03');

  let showAuditModal = $state(false);
  let showAddMerchantModal = $state(false);
  let newMerchantName = $state('');

  function handleEmergencyStop() {
    isEmergencyStopped = !isEmergencyStopped;
    if (isEmergencyStopped) {
      isAgentEnabled = false;
      activities.unshift({
        id: `act_${Date.now()}`,
        time: 'Just now',
        agentAccount: '0.0.482...',
        amountBase: 50_000n,
        token: 'USDC',
        decimals: 6,
        status: 'REJECTED',
        proofLabel: 'Emergency halted',
        proofUrl: null
      });
    }
  }

  function handlePublishService(e: SubmitEvent) {
    e.preventDefault();
    if (!newServiceName) return;
    const priceNum = parseFloat(newServicePrice) || 0.01;
    services.push({
      id: `srv_${Date.now()}`,
      name: newServiceName,
      priceBase: BigInt(Math.round(priceNum * 1_000_000)),
      token: 'USDC',
      decimals: 6,
      network: 'hedera:testnet',
      manifestUrl: 'https://pulsepay.io/.well-known/x402.json'
    });
    newServiceName = '';
    showPublishModal = false;
  }

  function handleAddMerchant(e: SubmitEvent) {
    e.preventDefault();
    if (newMerchantName && !allowlist.includes(newMerchantName)) {
      allowlist.push(newMerchantName.trim());
      newMerchantName = '';
    }
    showAddMerchantModal = false;
  }
</script>

<svelte:head>
  <title>PulsePay — AI Agent Payments (Hedera x402)</title>
</svelte:head>

<section class="mt-4 mb-12">
  <!-- PAGE HEADER -->
  <div class="mb-10">
    <h1 class="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal text-[#2B2170] tracking-tight mb-2">
      Agent payments.
    </h1>
    <p class="font-serif italic text-lg sm:text-xl text-[#645C9A] font-normal">
      x402 on Hedera · spend limits enforced in code, not by the model
    </p>
  </div>

  <!-- 2-COLUMN GRID (LEFT: SERVICES & ACTIVITY, RIGHT: SPEND CONTROLS) -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
    <!-- LEFT COLUMN (6 cols): PAID SERVICES + AGENT ACTIVITY -->
    <div class="lg:col-span-6 space-y-6">
      <!-- PAID SERVICES CARD -->
      <Card tabText="PAID SERVICES" tabColor="purple" class="p-6">
        <div class="pt-1">
          <div class="w-full overflow-x-auto mb-6">
            <table class="w-full border-collapse">
              <thead>
                <tr class="border-b-2 border-[#2B2170]">
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">SERVICE</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">PRICE</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">NETWORK</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">MANIFEST</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E2DEF3]">
                {#each services as srv (srv.id)}
                  <tr class="hover:bg-black/[0.015] transition-colors">
                    <td class="py-4 px-3 font-mono text-sm font-semibold text-[#2B2170]">
                      {srv.name}
                    </td>
                    <td class="py-4 px-3 text-sm font-semibold text-[#2B2170]">
                      {formatBaseUnits(srv.priceBase, srv.decimals, srv.token)}
                    </td>
                    <td class="py-4 px-3 font-mono text-xs text-[#2B2170]">
                      {srv.network}
                    </td>
                    <td class="py-4 px-3 font-mono text-xs">
                      <a
                        href={srv.manifestUrl}
                        target="_blank"
                        rel="noreferrer"
                        class="hover:underline text-[#2B2170]"
                      >
                        x402.json ↗
                      </a>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <Button variant="outline" size="sm" onclick={() => showPublishModal = true}>
            + Publish service
          </Button>
        </div>
      </Card>

      <!-- AGENT ACTIVITY CARD -->
      <Card tabText="AGENT ACTIVITY" tabColor="purple" class="p-6">
        <div class="pt-1">
          <!-- Flow Sequence Stepper (Unified Purple Palette) -->
          <div class="flex items-center justify-between gap-1 mb-8 overflow-x-auto pb-2">
            <div class="px-2.5 py-1.5 border-2 border-[#2B2170] rounded-xl bg-[#EAE7FA] text-[11px] font-bold text-[#2B2170] whitespace-nowrap text-center">
              402<br /><span class="font-normal text-[10px] text-[#645C9A]">quote received</span>
            </div>
            <div class="h-[2px] w-3 sm:w-6 bg-[#2B2170] shrink-0"></div>
            <div class="px-2.5 py-1.5 border-2 border-[#2B2170] rounded-xl bg-[#C8C3F2] text-[11px] font-bold text-[#2B2170] whitespace-nowrap text-center">
              Policy<br /><span class="font-normal text-[10px] text-[#645C9A]">check passed</span>
            </div>
            <div class="h-[2px] w-3 sm:w-6 bg-[#2B2170] shrink-0"></div>
            <div class="px-2.5 py-1.5 border-2 border-[#2B2170] rounded-xl bg-[#C8C3F2] text-[11px] font-bold text-[#2B2170] whitespace-nowrap text-center">
              Payment<br /><span class="font-normal text-[10px] text-[#645C9A]">signed</span>
            </div>
            <div class="h-[2px] w-3 sm:w-6 bg-[#2B2170] shrink-0"></div>
            <div class="px-2.5 py-1.5 border-2 border-[#2B2170] rounded-xl bg-[#C8C3F2] text-[11px] font-bold text-[#2B2170] whitespace-nowrap text-center">
              Facilitator<br /><span class="font-normal text-[10px] text-[#645C9A]">settled</span>
            </div>
            <div class="h-[2px] w-3 sm:w-6 bg-[#2B2170] shrink-0"></div>
            <div class="px-2.5 py-1.5 border-2 border-[#2B2170] rounded-xl bg-[#D6D2F7] text-[11px] font-bold text-[#2B2170] whitespace-nowrap text-center">
              HCS<br /><span class="font-normal text-[10px] text-[#645C9A]">entry written</span>
            </div>
          </div>

          <!-- Activity Table -->
          <div class="w-full overflow-x-auto">
            <table class="w-full border-collapse">
              <thead>
                <tr class="border-b-2 border-[#2B2170]">
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">TIME</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">AGENT</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">AMOUNT</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">STATUS</th>
                  <th class="py-3 px-3 text-[11px] font-bold tracking-wider uppercase text-[#2B2170] text-left">PROOF</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E2DEF3]">
                {#each activities as act (act.id)}
                  <tr class="hover:bg-black/[0.015] transition-colors">
                    <td class="py-4 px-3 font-mono text-sm text-[#2B2170]">
                      {act.time}
                    </td>
                    <td class="py-4 px-3 font-mono text-sm text-[#2B2170]">
                      {act.agentAccount}
                    </td>
                    <td class="py-4 px-3 text-sm font-semibold text-[#2B2170]">
                      {formatBaseUnits(act.amountBase, act.decimals, act.token)}
                    </td>
                    <td class="py-4 px-3">
                      <Chip status={act.status} />
                    </td>
                    <td class="py-4 px-3 text-xs font-semibold">
                      {#if act.proofUrl}
                        <a
                          href={act.proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          class="hover:underline text-[#2B2170]"
                        >
                          {act.proofLabel}
                        </a>
                      {:else}
                        <span class="text-[#645C9A]">{act.proofLabel}</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>

    <!-- RIGHT COLUMN (6 cols): SPEND CONTROLS -->
    <div class="lg:col-span-6">
      <Card tabText="SPEND CONTROLS" tabColor="purple" class="p-6 sm:p-8">
        <div class="pt-1 space-y-6">
          <!-- Title & Toggle Header -->
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-2xl font-normal text-[#2B2170]">
              Procurement agent
            </h2>
            <div class="flex items-center gap-2">
              <Toggle
                bind:checked={isAgentEnabled}
                label="Enabled"
                disabled={isEmergencyStopped}
              />
            </div>
          </div>

          <!-- 2x2 Grid of Fields -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Daily budget (USDC)"
              bind:value={dailyBudget}
              disabled={isEmergencyStopped}
            />
            <Field
              label="Max per request (USDC)"
              bind:value={maxPerRequest}
              disabled={isEmergencyStopped}
            />
            <Field
              label="Per merchant per day"
              bind:value={perMerchantPerDay}
              disabled={isEmergencyStopped}
            />
            <Field
              label="Human approval above"
              bind:value={humanApprovalAbove}
              disabled={isEmergencyStopped}
            />
          </div>

          <!-- Merchant allowlist -->
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-[#645C9A] mb-2">
              Merchant allowlist
            </div>
            <div class="flex flex-wrap items-center gap-2">
              {#each allowlist as m}
                <span class="px-3.5 py-1 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-[#C8C3F2] text-[#2B2170]">
                  {m}
                </span>
              {/each}
              <button
                type="button"
                onclick={() => showAddMerchantModal = true}
                class="px-3.5 py-1 border-2 border-[#2B2170] rounded-full text-xs font-bold bg-white text-[#2B2170] hover:bg-black/5 cursor-pointer"
              >
                + Add
              </button>
            </div>
          </div>

          <!-- Budget Progress Box -->
          <div class="border-2 border-[#2B2170] rounded-xl p-4 bg-white">
            <div class="flex justify-between items-center text-xs font-bold mb-2">
              <span class="text-[#2B2170]">Budget used today</span>
              <span class="text-[#2B2170]">2.4 / 5.0 USDC</span>
            </div>
            <div class="w-full h-3 bg-[#E2DEF3] border border-[#2B2170] rounded-full overflow-hidden p-0.5">
              <div class="h-full bg-[#C8C3F2] rounded-full border-r border-[#2B2170]" style="width: 48%;"></div>
            </div>
          </div>

          <!-- Emergency Stop Box (Formal Purple Tint) -->
          <div class="p-4 border-2 border-[#2B2170] rounded-xl bg-[#EAE7FA] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="font-bold text-sm text-[#2B2170] mb-0.5">
                Emergency stop
              </div>
              <div class="text-xs text-[#2B2170]/80">
                {isEmergencyStopped ? 'Agent spending is currently halted!' : 'Disables all agent spending immediately'}
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              onclick={handleEmergencyStop}
              class="shrink-0 {isEmergencyStopped ? '!bg-red-700' : ''}"
            >
              {isEmergencyStopped ? 'Resume agent' : 'Stop agent'}
            </Button>
          </div>

          <!-- Audit Topic Section -->
          <div class="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#645C9A]">
            <div>
              Audit topic <code class="font-mono font-semibold text-[#2B2170]">0.0.123456</code> · entries verifiable on Mirror Node
            </div>
            <Button variant="outline" size="sm" onclick={() => showAuditModal = true}>
              Open audit log
            </Button>
          </div>
        </div>
      </Card>
    </div>
  </div>

  <!-- PUBLISH SERVICE MODAL -->
  {#if showPublishModal}
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onclick={(e) => { if (e.target === e.currentTarget) showPublishModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showPublishModal = false; }}
    >
      <div class="bg-white border-2 border-[#2B2170] rounded-[22px] max-w-md w-full p-6 relative shadow-xl">
        <h3 class="font-serif text-2xl font-bold text-[#2B2170] mb-4">Publish Paid Agent Service</h3>
        <form onsubmit={handlePublishService} class="space-y-4">
          <Field label="Service Name" bind:value={newServiceName} placeholder="e.g. sentiment-analyzer" />
          <Field label="Price (USDC)" bind:value={newServicePrice} placeholder="0.03" />
          <div class="text-xs text-[#645C9A]">
            Will be registered under Hedera testnet with x402 header enforcement.
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onclick={() => showPublishModal = false}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Publish
            </Button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- ADD MERCHANT MODAL -->
  {#if showAddMerchantModal}
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onclick={(e) => { if (e.target === e.currentTarget) showAddMerchantModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showAddMerchantModal = false; }}
    >
      <div class="bg-white border-2 border-[#2B2170] rounded-[22px] max-w-sm w-full p-6 relative shadow-xl">
        <h3 class="font-serif text-xl font-bold text-[#2B2170] mb-4">Add Merchant to Allowlist</h3>
        <form onsubmit={handleAddMerchant} class="space-y-4">
          <Field label="Merchant Handle" bind:value={newMerchantName} placeholder="e.g. deepseek-api" />
          <div class="flex justify-end gap-3 pt-2">
            <Button variant="outline" size="sm" onclick={() => showAddMerchantModal = false}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- AUDIT LOG MODAL -->
  {#if showAuditModal}
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs"
      onclick={(e) => { if (e.target === e.currentTarget) showAuditModal = false; }}
      onkeydown={(e) => { if (e.key === 'Escape') showAuditModal = false; }}
    >
      <div class="bg-white border-2 border-[#2B2170] rounded-[22px] max-w-lg w-full p-6 relative shadow-xl">
        <h3 class="font-serif text-2xl font-bold text-[#2B2170] mb-2">HCS Audit Topic: 0.0.123456</h3>
        <p class="text-xs text-[#645C9A] mb-4">Hedera Consensus Service immutable log entries for all agent purchases:</p>
        <div class="space-y-2 max-h-60 overflow-y-auto text-xs font-mono bg-[#F9F8F5] p-3 rounded-xl border border-[#E2DEF3]">
          <div class="p-2 bg-white rounded border border-[#E2DEF3]">
            <span class="text-[#645C9A]">seq: 42</span> | topic: 0.0.123456 | agent: 0.0.482001 | 0.02 USDC settled to market-data-basic
          </div>
          <div class="p-2 bg-white rounded border border-[#E2DEF3]">
            <span class="text-[#645C9A]">seq: 41</span> | topic: 0.0.123456 | agent: 0.0.482001 | 9.00 USDC REJECTED (exceeded max_per_request 0.10 USDC)
          </div>
          <div class="p-2 bg-white rounded border border-[#E2DEF3]">
            <span class="text-[#645C9A]">seq: 40</span> | topic: 0.0.123456 | policy update: human_approval_above = 0.50 USDC
          </div>
        </div>
        <div class="mt-4 flex justify-end">
          <Button variant="primary" size="sm" onclick={() => showAuditModal = false}>
            Done
          </Button>
        </div>
      </div>
    </div>
  {/if}
</section>
