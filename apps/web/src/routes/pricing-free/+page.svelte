<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		createWalletClient,
		custom,
		formatUnits,
		isAddress,
		type EIP1193Provider
	} from 'viem';
	import { createPulsePay, whitechainSepolia, type Invoice } from '@pulsepay/sdk-core';
	import { WHITECHAIN_SEPOLIA_EXPLORER } from '@pulsepay/shared';

	let input = $state('');
	let id = $state('');
	let tx = $state('');
	let invoice = $state<Invoice | null>(null);
	let loadingInvoice = $state(false);
	let invoiceError = $state<string | null>(null);
	let paymentStatus = $state<'IDLE' | 'PENDING' | 'CONFIRMED'>('IDLE');
	let paymentError = $state<string | null>(null);

	let config = $state<{ hub: string; rpc: string; usdt: string } | null>(null);
	let loadingConfig = $state(true);
	let configError = $state<string | null>(null);

	async function loadConfig() {
		loadingConfig = true;
		configError = null;
		try {
			const res = await fetch('/api/config');
			if (!res.ok) throw new Error('Failed to load public config.');
			const data = await res.json();
			config = data;
		} catch (err: any) {
			configError = err.message || 'Config error.';
		} finally {
			loadingConfig = false;
		}
	}

	async function readInvoice(invoiceId: string) {
		if (!/^0x[a-fA-F0-9]{64}$/.test(invoiceId)) {
			invoiceError = 'Invoice ID must be a bytes32 hex value.';
			invoice = null;
			return;
		}
		if (!config || !isAddress(config.hub)) {
			invoiceError = 'Merchant hub address is not configured.';
			return;
		}

		loadingInvoice = true;
		invoiceError = null;
		paymentError = null;
		paymentStatus = 'IDLE';
		tx = '';

		try {
			const client = createPulsePay({
				whitechain: {
					contractAddress: config.hub as `0x${string}`,
					rpcUrl: config.rpc,
					usdtAddress: config.usdt as `0x${string}`
				}
			});
			const result = await client.invoices.get(invoiceId as `0x${string}`);
			if (!result) throw new Error('Invoice not found on the configured merchant hub.');
			invoice = result;
		} catch (err: any) {
			invoiceError = err.message || 'Invoice read failed.';
			invoice = null;
		} finally {
			loadingInvoice = false;
		}
	}

	function handleLoad(e: SubmitEvent) {
		e.preventDefault();
		id = input.trim();
		if (id) {
			readInvoice(id);
		}
	}

	async function handlePay() {
		if (!id || !config) return;
		paymentStatus = 'PENDING';
		paymentError = null;

		try {
			const ethereum = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
			if (!ethereum) throw new Error('Connect an EVM browser wallet to pay this invoice.');

			const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
			const account = accounts[0];
			if (!account) throw new Error('No wallet account was authorized.');

			const currentChain = await ethereum.request({ method: 'eth_chainId' });
			if (currentChain !== '0x752') {
				try {
					await ethereum.request({
						method: 'wallet_switchEthereumChain',
						params: [{ chainId: '0x752' }]
					});
				} catch (switchErr: any) {
					// If chain has not been added, add it
					if (switchErr.code === 4902) {
						await ethereum.request({
							method: 'wallet_addEthereumChain',
							params: [
								{
									chainId: '0x752',
									chainName: 'Whitechain Sepolia',
									nativeCurrency: { name: 'Whitechain', symbol: 'WBT', decimals: 18 },
									rpcUrls: ['https://rpc.testnet.whitechain.io'],
									blockExplorerUrls: ['https://explorer.testnet.whitechain.io']
								}
							]
						});
					} else {
						throw switchErr;
					}
				}
			}

			const wallet = createWalletClient({
				account,
				chain: whitechainSepolia,
				transport: custom(ethereum)
			});

			const client = createPulsePay({
				whitechain: {
					contractAddress: config.hub as `0x${string}`,
					rpcUrl: config.rpc,
					usdtAddress: config.usdt as `0x${string}`,
					walletClient: wallet
				}
			});

			const result = await client.whitechain.payInvoice(id as `0x${string}`, wallet);
			if (result.receipt.status !== 'success') {
				throw new Error(`Payment reverted: ${result.txHash}`);
			}
			tx = result.txHash;
			paymentStatus = 'CONFIRMED';
		} catch (err: any) {
			paymentError = err.message || 'Payment could not be confirmed.';
			paymentStatus = 'IDLE';
		}
	}

	onMount(() => {
		loadConfig().then(() => {
			const queryInvoice = page.url.searchParams.get('invoice');
			if (queryInvoice) {
				input = queryInvoice;
				id = queryInvoice;
				readInvoice(queryInvoice);
			}
		});
	});

	const payable = $derived(
		invoice && invoice.status === 'OPEN' && invoice.dueAt > Date.now() / 1000
	);
</script>

<svelte:head>
	<title>Universal Checkout · PulsePay</title>
</svelte:head>

<main id="main" class="checkout-page">
	<div>
		<p class="eyebrow">LIVE SDK / DIRECT USDT</p>
		<h1>Try the real<br />checkout.</h1>
		<p class="lede">
			Bring an existing Whitechain invoice. The SDK reads its amount and only reports success after a
			matching settlement event.
		</p>
		<p class="mono small" style="max-width: 430px; line-height: 1.9;">
			The integration demo has no platform fee. Paying an invoice moves real testnet USDT and
			requires network gas. Other-token quote-to-settlement is a separate integration.
		</p>
		<a href="/docs/sdk/react" class="text-link mono">Read the SDK integration ↗</a>
	</div>

	<div class="checkout-box">
		<form onsubmit={handleLoad}>
			<label for="invoice-id">Invoice ID / bytes32</label>
			<input
				id="invoice-id"
				bind:value={input}
				placeholder="0x…"
				autocomplete="off"
			/>
			<button class="button" type="submit">Load invoice ↗</button>
		</form>

		{#if loadingConfig}
			<p class="loading-line" role="status">Reading configuration…</p>
		{:else if configError}
			<div class="checkout-error" role="alert">
				{configError}
				<button class="copy-button" onclick={loadConfig}>Retry</button>
			</div>
		{:else if !config || !isAddress(config.hub)}
			<div class="checkout-error" role="alert">
				Set WHITECHAIN_MERCHANT_HUB_ADDRESS in the root .env to use a deployed merchant hub.<br />
				<a href="/merchant/settings">View configuration ↗</a>
			</div>
		{:else if id}
			<div style="margin-top: 30px;">
				<div class="sdk-widget">
					<div class="sdk-widget-head">
						<h3>PulsePay checkout</h3>
						<span class="sdk-network">Whitechain Sepolia</span>
					</div>

					{#if loadingInvoice}
						<p role="status">Reading invoice from Whitechain…</p>
					{:else if invoice}
						<div class="sdk-total">
							<small>Amount due / USDT</small>
							<div class="sdk-amount">{formatUnits(invoice.amountUnits, 6)}</div>
							<div class="sdk-invoice-id">{invoice.id}</div>
							<div class="sdk-invoice-id">
								{invoice.status} · Due {new Date(invoice.dueAt * 1000).toISOString()}
							</div>
						</div>
					{/if}

					{#if invoiceError}
						<div class="sdk-error" role="alert">
							{invoiceError}<br />
							<button
								type="button"
								class="sdk-retry"
								onclick={() => readInvoice(id)}
								disabled={paymentStatus === 'PENDING'}
							>
								Retry invoice read
							</button>
						</div>
					{/if}

					{#if paymentError}
						<div class="sdk-error" role="alert">
							{paymentError}
						</div>
					{/if}

					{#if paymentStatus === 'CONFIRMED' && tx}
						<div class="sdk-success" role="status">
							Payment settled.<br />
							<a
								href="{WHITECHAIN_SEPOLIA_EXPLORER}/tx/{tx}"
								target="_blank"
								rel="noreferrer"
							>
								View confirmed transaction ↗
							</a>
						</div>
					{:else}
						<button
							type="button"
							class="sdk-pay"
							onclick={handlePay}
							disabled={loadingInvoice || !payable || paymentStatus === 'PENDING'}
						>
							{#if paymentStatus === 'PENDING'}
								Confirm in wallet · awaiting settlement…
							{:else if payable && invoice}
								Pay {formatUnits(invoice.amountUnits, 6)} USDT ↗
							{:else}
								No payable invoice
							{/if}
						</button>
					{/if}
				</div>

				{#if tx}
					<a href="/receipt/{id}" class="button soft" style="margin-top: 15px; display: inline-flex;">
						Open receipt ↗
					</a>
				{/if}
			</div>
		{:else}
			<p class="checkout-error">
				Create an invoice in the merchant console, then paste its bytes32 ID here. No sample invoice
				or amount is supplied.
			</p>
		{/if}
	</div>
</main>

