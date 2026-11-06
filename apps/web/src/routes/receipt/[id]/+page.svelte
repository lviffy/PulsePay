<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { formatUnits } from 'viem';
	import { WHITECHAIN_SEPOLIA_EXPLORER, type PaymentStatus } from '@pulsepay/shared';

	const id = $derived(page.params.id);

	let loading = $state(true);
	let error = $state<string | null>(null);
	let data = $state<{
		invoice: { id: string; merchant: string };
		payment: {
			customer: string;
			amountPaidUnits: string;
			amountRefundedUnits: string;
			status: PaymentStatus;
			txHash: string;
		};
	} | null>(null);

	async function fetchReceipt() {
		if (!id) return;
		loading = true;
		error = null;
		try {
			const res = await fetch(`/api/receipt/${encodeURIComponent(id)}`);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `Error ${res.status}`);
			}
			data = await res.json();
		} catch (err: any) {
			error = err.message || 'Failed to read receipt.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchReceipt();
	});

	const compact = (value: string) =>
		value.length > 16 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
</script>

<svelte:head>
	<title>Receipt · PulsePay</title>
</svelte:head>

<main id="main" class="receipt-page">
	<div>
		<p class="eyebrow" data-decode>PAYMENT / ONCHAIN EVIDENCE</p>
		<h1>A payment.<br />A paper trail.</h1>
		<p class="lede">
			The amount, payer and refund status are read from the Whitechain merchant hub. This invoice
			has its own deterministic receipt pattern.
		</p>
		<p class="receipt-evidence">Invoice / {id}</p>
	</div>

	<div class="receipt-box">
		<img
			src="/api/art/{encodeURIComponent(id)}"
			alt="Procedural receipt art"
			width="1000"
			height="480"
			class="receipt-art"
		/>

		{#if loading}
			<p class="loading-line" role="status">Reading payment evidence…</p>
		{:else if error}
			<div class="checkout-error" role="alert">
				{error}
				<button class="copy-button" onclick={fetchReceipt}>Retry ↗</button>
			</div>
		{:else if data}
			<div class="receipt-evidence">
				<a
					href="{WHITECHAIN_SEPOLIA_EXPLORER}/tx/{data.payment.txHash}"
					target="_blank"
					rel="noreferrer"
				>
					{data.payment.txHash} ↗
				</a>
			</div>

			<div class="receipt-sdk" data-no-split>
				<section
					class="sdk-receipt"
					aria-label="Payment receipt"
					style="font-family: var(--font-space, sans-serif); background: #f1efe7; color: #20201e;"
				>
					<div
						style="display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 1px solid #d2d0c7; padding-bottom: 20px;"
					>
						<h3 style="font-size: 21px; margin: 0;">Customer receipt</h3>
						<span style="font-family: var(--font-mono, monospace); fontSize: 9px;">
							{data.payment.status.replaceAll('_', ' ')}
						</span>
					</div>

					<dl
						style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px 20px; font-family: var(--font-mono, monospace); font-size: 10px; line-height: 1.7; padding: 20px 0; margin: 0; border-bottom: 1px solid #d2d0c7;"
					>
						<dt>INVOICE</dt>
						<dd style="margin: 0; text-align: right;" title={id}>{compact(id)}</dd>

						<dt>MERCHANT</dt>
						<dd style="margin: 0; text-align: right;" title={data.invoice.merchant}>
							{compact(data.invoice.merchant)}
						</dd>

						<dt>PAYER</dt>
						<dd style="margin: 0; text-align: right;" title={data.payment.customer}>
							{compact(data.payment.customer)}
						</dd>

						<dt>PAID / USDT</dt>
						<dd style="margin: 0; text-align: right;">
							{formatUnits(BigInt(data.payment.amountPaidUnits), 6)}
						</dd>

						<dt>REFUNDED / USDT</dt>
						<dd style="margin: 0; text-align: right;">
							{formatUnits(BigInt(data.payment.amountRefundedUnits), 6)}
						</dd>
					</dl>

					<div
						style="padding-top: 20px; font-family: var(--font-mono, monospace); font-size: 10px; line-height: 1.9;"
					>
						{#if /^(0x)[a-fA-F0-9]{64}$/.test(data.payment.txHash)}
							<a
								style="display: block; text-decoration: underline;"
								href="{WHITECHAIN_SEPOLIA_EXPLORER}/tx/{data.payment.txHash}"
								target="_blank"
								rel="noreferrer"
							>
								PAYMENT TRANSACTION ↗
							</a>
						{/if}
					</div>
				</section>
			</div>
		{/if}
	</div>
</main>

