<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		createWalletClient,
		custom,
		formatUnits,
		isAddress,
		parseUnits,
		type EIP1193Provider,
		type WalletClient
	} from 'viem';
	import { createPulsePay, whitechainSepolia } from '@pulsepay/sdk-core';
	import type { MerchantData, InvoiceRow, SubscriptionRow } from '$lib/chain';
	import DataTable from './DataTable.svelte';
	import Modal from './Modal.svelte';
	import Mark from './Mark.svelte';

	interface Props {
		section: string;
	}
	let { section }: Props = $props();

	export const sections = [
		'invoices',
		'payments',
		'refunds',
		'subscriptions',
		'treasury',
		'agents',
		'exports',
		'settings'
	];

	export type Config = {
		hub: string;
		rpc: string;
		usdt: string;
		merchant: string;
		merchantName: string;
		topic: string;
		network: string;
		serviceUrl: string;
		hederaEvmHub: string;
		hederaEvmToken: string;
		hederaEvmRpc: string;
	};

	type AuditEntry = {
		sequence_number: number;
		consensus_timestamp: string;
		payer_account_id: string;
		payload: Record<string, any>;
	};

	type AuditData = {
		topic: string;
		network: string;
		entries: AuditEntry[];
		next?: string;
	};

	type ConfirmState = {
		title: string;
		description: string;
		label: string;
		run: () => Promise<{ txHash: `0x${string}`; receipt: { status: string } }>;
	};

	const short = (val: string) => (val.length > 20 ? `${val.slice(0, 10)}…${val.slice(-6)}` : val);
	const amount = (val: string | bigint) => formatUnits(BigInt(val), 6);
	const message = (err: unknown) =>
		err instanceof Error ? err.message : 'Request failed. Retry after checking the network.';

	let config = $state<Config | null>(null);
	let configLoading = $state(true);
	let configError = $state<string | null>(null);

	let merchant = $state('');
	let addressInput = $state('');
	let wallet = $state<WalletClient | null>(null);
	let chain = $state<'whitechain' | 'hedera'>('whitechain');
	let lastWhitechainSection = $state('invoices');
	let filter = $state('');
	let before = $state<string | undefined>();

	let action = $state<'invoice' | 'refund' | 'plan' | 'fund' | 'withdraw' | null>(null);
	let refundRow = $state<InvoiceRow | null>(null);
	let sum = $state('');
	let customer = $state('');
	let reason = $state('');
	let days = $state<number>(7);
	let cycles = $state<number>(12);

	let confirm = $state<ConfirmState | null>(null);
	let busy = $state(false);
	let txNotification = $state<{
		type: 'info' | 'success' | 'error';
		title: string;
		message: string;
		link?: string;
	} | null>(null);

	let remoteData = $state<MerchantData | null>(null);
	let remoteLoading = $state(false);
	let remoteError = $state<string | null>(null);

	let treasuryData = $state<{
		status: string;
		protocol: string;
		sourceChain: string;
		destinationChain: string;
		routerAddress: string;
		explorerUrl: string;
	} | null>(null);
	let treasuryLoading = $state(false);
	let treasuryError = $state<string | null>(null);

	let auditData = $state<AuditData | null>(null);
	let auditLoading = $state(false);
	let auditError = $state<string | null>(null);

	let manifestData = $state<{
		services: Array<{
			id: string;
			name: string;
			pricing: { scheme: string; amount: string; asset: string; recipient?: string; payTo?: string; network: string; hub?: string; payer?: string };
			endpoints: Array<{ path: string; method: string }>;
		}>;
	} | null>(null);
	let manifestLoading = $state(false);
	let manifestError = $state<string | null>(null);

	async function fetchConfig() {
		configLoading = true;
		configError = null;
		try {
			const res = await fetch('/api/config');
			if (!res.ok) throw new Error('Failed to load public config.');
			const data = await res.json();
			config = data;
			const saved = localStorage.getItem('pulsepay:merchant:v1') || data.merchant || '';
			merchant = saved;
			addressInput = saved;
		} catch (err: any) {
			configError = err.message;
		} finally {
			configLoading = false;
		}
	}

	async function fetchMerchantData() {
		if (!config || !merchant || ['settings', 'agents'].includes(section) || chain !== 'whitechain')
			return;
		remoteLoading = true;
		remoteError = null;
		try {
			const url = `/api/merchant?merchant=${encodeURIComponent(merchant)}${before ? `&before=${before}` : ''}`;
			const res = await fetch(url);
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `Error ${res.status}`);
			}
			remoteData = await res.json();
		} catch (err: any) {
			remoteError = err.message;
		} finally {
			remoteLoading = false;
		}
	}

	async function fetchTreasury() {
		if (section !== 'treasury') return;
		treasuryLoading = true;
		treasuryError = null;
		try {
			const res = await fetch('/api/treasury');
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `Error ${res.status}`);
			}
			treasuryData = await res.json();
		} catch (err: any) {
			treasuryError = err.message;
		} finally {
			treasuryLoading = false;
		}
	}

	async function fetchAudit() {
		auditLoading = true;
		auditError = null;
		try {
			const res = await fetch('/api/audit');
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `Error ${res.status}`);
			}
			auditData = await res.json();
		} catch (err: any) {
			auditError = err.message;
		} finally {
			auditLoading = false;
		}
	}

	async function fetchManifest() {
		manifestLoading = true;
		manifestError = null;
		try {
			const res = await fetch('/.well-known/x402.json');
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				throw new Error(body.error || `Error ${res.status}`);
			}
			manifestData = await res.json();
		} catch (err: any) {
			manifestError = err.message;
		} finally {
			manifestLoading = false;
		}
	}

	onMount(() => {
		fetchConfig().then(() => {
			if (chain === 'whitechain') fetchMerchantData();
		});
		if (section === 'agents') {
			chain = 'hedera';
			fetchAudit();
			fetchManifest();
		} else if (section === 'treasury') {
			chain = 'whitechain';
			fetchTreasury();
		} else if (section !== 'settings') {
			chain = 'whitechain';
			lastWhitechainSection = section;
		}
	});

	$effect(() => {
		if (merchant && chain === 'whitechain' && !['settings', 'agents'].includes(section)) {
			fetchMerchantData();
		}
	});

	$effect(() => {
		if (section === 'agents') {
			chain = 'hedera';
			fetchAudit();
			fetchManifest();
		} else if (section === 'settings') {
			// Settings displays cross-chain configurations; keep current chain
		} else {
			chain = 'whitechain';
			lastWhitechainSection = section;
			if (section === 'treasury') {
				fetchTreasury();
			}
		}
	});

	function selectChain(target: 'whitechain' | 'hedera') {
		if (target === chain) return;
		chain = target;
		if (target === 'hedera') {
			if (section !== 'agents' && section !== 'settings') {
				goto('/merchant/agents');
			} else {
				fetchAudit();
				fetchManifest();
			}
		} else {
			if (section === 'agents') {
				goto(`/merchant/${lastWhitechainSection || 'invoices'}`);
			} else if (merchant) {
				fetchMerchantData();
			}
		}
	}

	function saveAddress(addr: string) {
		if (!isAddress(addr)) throw new Error('Enter a valid EVM merchant address.');
		localStorage.setItem('pulsepay:merchant:v1', addr);
		merchant = addr;
		addressInput = addr;
		before = undefined;
		fetchMerchantData();
	}

	async function connectWallet() {
		const ethereum = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
		if (!ethereum) throw new Error('Install or open an EVM browser wallet, then connect it here.');
		const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
		const account = accounts[0];
		if (!account) throw new Error('No account was authorized.');
		const chainId = '0x752';
		if ((await ethereum.request({ method: 'eth_chainId' })) !== chainId) {
			await ethereum.request({
				method: 'wallet_switchEthereumChain',
				params: [{ chainId }]
			});
		}
		const connected = createWalletClient({
			account,
			chain: whitechainSepolia,
			transport: custom(ethereum)
		});
		wallet = connected;
		saveAddress(account);
		return connected;
	}

	async function getBillingClient() {
		const cfg = config;
		if (!cfg || !isAddress(cfg.hub))
			throw new Error('Configure WHITECHAIN_MERCHANT_HUB_ADDRESS before sending a transaction.');
		const activeWallet = wallet && (await wallet.getChainId()) === 1874 ? wallet : await connectWallet();
		const account = activeWallet.account?.address || (await activeWallet.getAddresses())[0];
		if (merchant && account?.toLowerCase() !== merchant.toLowerCase()) {
			throw new Error('The connected wallet must match the merchant address being viewed.');
		}
		const client = createPulsePay({
			whitechain: {
				contractAddress: cfg.hub as `0x${string}`,
				usdtAddress: cfg.usdt as `0x${string}`,
				rpcUrl: cfg.rpc,
				walletClient: activeWallet
			}
		});
		return client;
	}

	async function executeConfirm() {
		if (!confirm || busy) return;
		busy = true;
		txNotification = {
			type: 'info',
			title: confirm.title,
			message: 'Review in your wallet. Waiting for the transaction receipt…'
		};
		try {
			const result = await confirm.run();
			if (result.receipt.status !== 'success') {
				throw new Error(`Transaction reverted: ${result.txHash}`);
			}
			const explorerUrl = `https://explorer.testnet.whitechain.io/tx/${result.txHash}`;
			txNotification = {
				type: 'success',
				title: 'Transaction confirmed',
				message: `${short(result.txHash)} · View transaction ↗`,
				link: explorerUrl
			};
			confirm = null;
			action = null;
			fetchMerchantData();
			fetchTreasury();
		} catch (err: any) {
			txNotification = {
				type: 'error',
				title: 'Transaction not confirmed',
				message: message(err)
			};
		} finally {
			busy = false;
		}
	}

	async function exportCsv() {
		try {
			if (chain === 'hedera') {
				if (!auditData?.entries || auditData.entries.length === 0) {
					throw new Error('No Hedera audit entries loaded to export.');
				}
				const header = ['sequence_number', 'consensus_timestamp', 'payer', 'event', 'amount_tinybars'];
				const rows = auditData.entries.map((entry) => [
					entry.sequence_number,
					entry.consensus_timestamp,
					entry.payer_account_id,
					entry.payload.event || entry.payload.tool || 'MESSAGE',
					entry.payload.result?.amountTinybars || ''
				]);
				const csvContent = [
					header.join(','),
					...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
				].join('\n');
				const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
				const url = URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = `pulsepay-hedera-audit-${new Date().toISOString().slice(0, 10)}.csv`;
				document.body.appendChild(link);
				link.click();
				link.remove();
				setTimeout(() => URL.revokeObjectURL(url), 1000);
				return;
			}

			if (!isAddress(merchant)) {
				throw new Error('Choose a merchant address in Settings before exporting.');
			}
			const response = await fetch(
				`/api/export?merchant=${merchant}${before ? `&before=${before}` : ''}`
			);
			if (!response.ok) {
				const body = await response.json();
				throw new Error(body.error);
			}
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `pulsepay-whitechain-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (err: any) {
			txNotification = {
				type: 'error',
				title: 'Export error',
				message: message(err)
			};
		}
	}

	function prepareAction() {
		try {
			if (!sum || !/^\d+(\.\d{1,6})?$/.test(sum) || parseUnits(sum, 6) <= 0n) {
				throw new Error('Enter a positive USDT amount with up to six decimal places.');
			}
			const units = parseUnits(sum, 6);

			if (action === 'invoice') {
				if (customer && !isAddress(customer)) {
					throw new Error('Customer must be an EVM address, or leave it blank for any payer.');
				}
				if (!Number.isInteger(Number(days)) || Number(days) < 1 || Number(days) > 365) {
					throw new Error('Choose a due time between 1 and 365 days.');
				}
				confirm = {
					title: 'Create onchain invoice',
					description: `${sum} USDT. Due in ${days} days. Customer: ${customer || 'any payer'}.`,
					label: 'Create invoice',
					run: async () => {
						const client = await getBillingClient();
						const result = await client.invoices.create({
							amountUnits: units,
							customer: customer ? (customer as `0x${string}`) : undefined,
							dueAtSeconds: Math.floor(Date.now() / 1000) + Number(days) * 86400
						});
						return result;
					}
				};
			} else if (action === 'refund' && refundRow?.payment) {
				const remaining =
					BigInt(refundRow.payment.amountPaidUnits) -
					BigInt(refundRow.payment.amountRefundedUnits);
				if (units > remaining) throw new Error('Refund exceeds the remaining paid amount.');
				confirm = {
					title: 'Confirm reserve-backed refund',
					description: `Send ${sum} USDT from your held balance (reserve first, then available) to the original payer ${refundRow.payment.customer}. Invoice: ${refundRow.id}. Reason: ${reason || 'not supplied'}.`,
					label: 'Issue refund',
					run: async () => {
						const client = await getBillingClient();
						return client.payments.refund(refundRow!.id as `0x${string}`, units, reason);
					}
				};
			} else if (action === 'plan') {
				if (
					!Number.isInteger(Number(days)) ||
					Number(days) < 1 ||
					!Number.isInteger(Number(cycles)) ||
					Number(cycles) < 1
				) {
					throw new Error('Interval and cycle count must be positive whole numbers.');
				}
				confirm = {
					title: 'Create subscription plan',
					description: `${sum} USDT every ${days} days, maximum ${cycles} cycles. Subscribers authorize this plan separately.`,
					label: 'Create plan',
					run: async () => {
						const client = await getBillingClient();
						return client.subscriptions.createPlan({
							amountPerCycleUnits: units,
							intervalSeconds: Number(days) * 86400,
							maxCycles: Number(cycles)
						});
					}
				};
			} else if (action === 'fund' || action === 'withdraw') {
				const funding = action === 'fund';
				confirm = {
					title: funding ? 'Fund refund reserve' : 'Withdraw available USDT',
					description: `${funding ? 'Deposit' : 'Withdraw'} ${sum} USDT ${funding ? 'from the connected wallet into the merchant reserve' : 'from the available balance to the connected merchant wallet'}.`,
					label: funding ? 'Fund reserve' : 'Withdraw',
					run: async () => {
						const client = await getBillingClient();
						return funding ? client.payments.fundReserve(units) : client.payments.withdraw(units);
					}
				};
			}
		} catch (err: any) {
			txNotification = {
				type: 'error',
				title: 'Action could not complete',
				message: message(err)
			};
		}
	}

	const shownRows = $derived(
		(remoteData?.rows || []).filter(
			(row) =>
				(section !== 'payments' && section !== 'refunds' || row.payment || row.error) &&
				(section !== 'refunds' || row.payment || row.error) &&
				`${row.id} ${row.invoice?.customer || ''} ${row.invoice?.status || ''}`
					.toLowerCase()
					.includes(filter.toLowerCase())
		)
	);

	const readError = $derived(
		configError ||
			remoteError ||
			(!merchant && !configLoading
				? 'Choose a merchant address in Settings or connect a wallet to read its invoices.'
				: null)
	);

	const reserve = $derived(remoteData?.balances.reserve);
	const available = $derived(remoteData?.balances.available);
	const total = $derived(
		reserve !== undefined && available !== undefined
			? BigInt(reserve) + BigInt(available)
			: undefined
	);
	const reservePercent = $derived(
		total && total > 0n ? Number((BigInt(reserve!) * 10000n) / total) / 100 : 0
	);
	const activeSection = $derived(section.charAt(0).toUpperCase() + section.slice(1));
</script>

<svelte:head>
	<title>{activeSection} · PulsePay Merchant</title>
</svelte:head>

<main id="main" class="merchant-shell">
	<aside class="merchant-rail" data-lenis-prevent>
		<a href="/" class="brand">
			<Mark />PulsePay
		</a>
		<nav aria-label="Merchant navigation">
			<div class="rail-group-title mono">Whitechain</div>
			<a href="/merchant/invoices" aria-current={section === 'invoices' ? 'page' : undefined}>
				invoices
			</a>
			<a href="/merchant/payments" aria-current={section === 'payments' ? 'page' : undefined}>
				payments
			</a>
			<a href="/merchant/refunds" aria-current={section === 'refunds' ? 'page' : undefined}>
				refunds
			</a>
			<a href="/merchant/subscriptions" aria-current={section === 'subscriptions' ? 'page' : undefined}>
				subscriptions
			</a>
			<a href="/merchant/treasury" aria-current={section === 'treasury' ? 'page' : undefined}>
				treasury
			</a>
			<a href="/merchant/exports" aria-current={section === 'exports' ? 'page' : undefined}>
				exports
			</a>

			<div class="rail-group-title mono">Hedera</div>
			<a href="/merchant/agents" aria-current={section === 'agents' ? 'page' : undefined}>
				agents
			</a>

			<div class="rail-group-title mono">General</div>
			<a href="/merchant/settings" aria-current={section === 'settings' ? 'page' : undefined}>
				settings
			</a>
		</nav>
		<div class="rail-bottom">
			<span><i class="status-dot"></i> Wallet-authorized writes</span>
			<a href="/docs">Documentation ↗</a>
			<a href="/">Back to PulsePay ↗</a>
		</div>
	</aside>

	<div class="merchant-main">
		{#if txNotification}
			<div
				class="merchant-panel"
				style="margin-bottom: 20px; border-color: {txNotification.type === 'error' ? 'var(--orange)' : '#666'};"
			>
				<strong>{txNotification.title}</strong>
				<p style="margin: 8px 0 0;">
					{#if txNotification.link}
						<a href={txNotification.link} target="_blank" rel="noreferrer" style="text-decoration: underline;">
							{txNotification.message}
						</a>
					{:else}
						{txNotification.message}
					{/if}
				</p>
				<button
					class="table-action"
					style="margin-top: 10px;"
					onclick={() => (txNotification = null)}
				>
					[Dismiss]
				</button>
			</div>
		{/if}

		<header class="merchant-header">
			<div>
				<p class="eyebrow">Merchant / {activeSection}</p>
				<h1>{config?.merchantName || 'Merchant console'}</h1>
			</div>
			<div class="merchant-actions">
				<div role="tablist" class="chain-tabs" aria-label="Chain">
					<button
						role="tab"
						aria-selected={chain === 'whitechain'}
						onclick={() => selectChain('whitechain')}
					>
						Whitechain
					</button>
					<button
						role="tab"
						aria-selected={chain === 'hedera'}
						onclick={() => selectChain('hedera')}
					>
						Hedera
					</button>
				</div>
				<button class="export-button" onclick={exportCsv}>Export CSV ↗</button>
			</div>
		</header>

		{#if !['settings', 'agents'].includes(section) && chain === 'whitechain'}
			<div class="metric-grid">
				<div class="metric-cell">
					<span class="mono">Gross / loaded window</span>
					<span class="metric-value">{remoteData ? amount(remoteData.gross) : '—'}</span>
					<small>USDT</small>
				</div>
				<div class="metric-cell">
					<span class="mono">Available</span>
					<span class="metric-value">{available !== undefined ? amount(available) : '—'}</span>
					<small>USDT</small>
				</div>
				<div class="metric-cell">
					<span class="mono">
						Refund reserve{remoteData ? ` · ${remoteData.balances.reserveBps / 100}% policy` : ''}
					</span>
					<span class="metric-value">{reserve !== undefined ? amount(reserve) : '—'}</span>
					<small>USDT</small>
				</div>
				<div class="metric-cell">
					<span class="mono">Refunded / loaded window</span>
					<span class="metric-value">{remoteData ? amount(remoteData.refunded) : '—'}</span>
					<small>USDT</small>
				</div>
			</div>

			<div
				class="reserve-bar"
				role="img"
				aria-label={total !== undefined
					? `Current held balance: ${100 - reservePercent}% available, ${reservePercent}% reserve`
					: 'Reserve balance unavailable'}
			>
				{#if total !== undefined && total > 0n}
					<span class="available" style="width: {100 - reservePercent}%;"></span>
					<span class="reserve" style="width: {reservePercent}%;"></span>
				{/if}
			</div>

			<div class="reserve-caption">
				<span>{merchant ? short(merchant) : 'No merchant selected'}</span>
				<span>
					{remoteData ? `Blocks ${remoteData.fromBlock}–${remoteData.block}` : 'Awaiting real chain data'}
				</span>
			</div>
		{/if}

		{#if section === 'agents' || (chain === 'hedera' && section !== 'settings')}
			<div class="merchant-panel">
				<p class="eyebrow">Actual service discovery / SDK server</p>
				<h2>Agents read the terms first.</h2>
				{#if manifestLoading}
					<p role="status">Reading service manifest…</p>
				{:else if manifestError}
					<div class="checkout-error" role="alert">
						{manifestError}
						<button class="table-action" onclick={fetchManifest}>[Retry]</button>
					</div>
				{:else if manifestData}
					{#each manifestData.services as service (service.id)}
						<div style="margin-bottom: 16px;">
							<p>
								<strong>{service.name}</strong><br />
								<code>
									{service.id} · {service.pricing.amount} {service.pricing.scheme === 'hedera-evm-invoice-receipt' ? 'token units' : 'tinybars'} · {service.pricing.network} · {service.pricing.asset}
								</code>
							</p>
							{#each service.endpoints as endpoint (endpoint.path)}
								<p><code>{endpoint.method} {endpoint.path}</code></p>
							{/each}
						</div>
					{/each}
				{/if}
				<p>
					Native HBAR uses PulsePay’s hedera-native-receipt extension. Contract invoices use
					hedera-evm-invoice-receipt on chain 296. Both paths verify settlement before returning the
					resource; contract-token budgets are separate from tinybar budgets.
				</p>
			</div>

			<div class="table-toolbar">
				<h2>HCS audit trail {auditData?.topic ? `/ ${auditData.topic}` : ''}</h2>
				<button class="table-action" onclick={fetchAudit}>[Refresh]</button>
			</div>

			<DataTable
				headers={['Sequence', 'Event / tool', 'Amount', 'Consensus timestamp', 'Payer', 'Evidence']}
				rows={auditData?.entries || []}
				rowKey={(row) => String(row.sequence_number)}
				loading={auditLoading}
				error={auditError}
				retry={fetchAudit}
				empty="The configured topic has no messages in this page."
			>
				{#snippet rowSnippet(row)}
					<td>{row.sequence_number}</td>
					<td title={JSON.stringify(row.payload)}>
						{String(row.payload.event || row.payload.tool || 'TOPIC MESSAGE')}
					</td>
					<td>{row.payload.result?.amountTinybars ? `${row.payload.result.amountTinybars} tinybars` : '—'}</td>
					<td>{row.consensus_timestamp}</td>
					<td>{row.payer_account_id}</td>
					<td>
						<a
							href="https://hashscan.io/{auditData?.network}/topic/{auditData?.topic}"
							target="_blank"
							rel="noreferrer"
						>
							[View ↗]
						</a>
					</td>
				{/snippet}
			</DataTable>

			<p class="merchant-notice">
				Messages come directly from the configured topic’s mirror-node history. An embedded payment claim
				needs independent receipt verification. This view does not label every public topic payload as
				a verified payment.
			</p>
		{:else if section === 'settings'}
			<div class="settings-grid">
				<section class="merchant-panel">
					<h2>Read a merchant.</h2>
					<p>Public contract data can be read without connecting a wallet. Writes require the matching merchant account.</p>
					<form
						class="merchant-form"
						onsubmit={(e) => {
							e.preventDefault();
							try {
								saveAddress(addressInput);
								txNotification = {
									type: 'info',
									title: 'Merchant selected',
									message: short(addressInput)
								};
							} catch (err: any) {
								txNotification = {
									type: 'error',
									title: 'Invalid address',
									message: err.message
								};
							}
						}}
					>
						<label for="settings-addr-input">Merchant wallet address</label>
						<input
							id="settings-addr-input"
							bind:value={addressInput}
							placeholder="0x…"
						/>
						<button class="button light" type="submit">Use this address ↗</button>
					</form>
					<button
						class="table-action"
						style="margin-top: 20px;"
						onclick={() => connectWallet().catch((err) => (txNotification = { type: 'error', title: 'Wallet error', message: err.message }))}
					>
						[Connect merchant wallet]
					</button>
				</section>

				<section class="merchant-panel">
					<h2>Network configuration.</h2>
					{#if configError}
						<p>{configError} <button class="table-action" onclick={fetchConfig}>[Retry]</button></p>
					{:else}
						<dl class="settings-list">
							<dt>Chain</dt>
							<dd>Whitechain Sepolia / 1874</dd>
							<dt>Hub</dt>
							<dd>{config?.hub || 'Not configured'}</dd>
							<dt>USDT</dt>
							<dd>{config?.usdt || 'Reading…'}</dd>
							<dt>RPC</dt>
							<dd>{config?.rpc || 'Reading…'}</dd>
							<dt>HCS topic</dt>
							<dd>{config?.topic || 'Not configured'}</dd>
							<dt>Service API</dt>
							<dd>{config?.serviceUrl || 'Reading…'}</dd>
							<dt>Hedera EVM hub</dt>
							<dd>{config?.hederaEvmHub || 'Not configured'}</dd>
							<dt>Hedera settlement token</dt>
							<dd>{config?.hederaEvmToken || 'Not configured'}</dd>
							<dt>Hedera EVM RPC</dt>
							<dd>{config?.hederaEvmRpc || 'Not configured'}</dd>
						</dl>
					{/if}
				</section>
			</div>
			<p class="merchant-notice">
				Deployment settings are read from the server’s root .env. Public wallet selection is saved on
				this device. No signing keys are stored in this frontend.
			</p>
		{:else if section === 'treasury'}
			<section class="merchant-panel">
				<h2>Reserve & available balance.</h2>
				<p>Fund the refund reserve or withdraw available USDT. Both actions use the connected Whitechain merchant wallet.</p>
				<div class="actions">
					<button class="button light" onclick={() => { action = 'fund'; sum = ''; }}>
						Fund reserve ↗
					</button>
					<button class="button outline-light" onclick={() => { action = 'withdraw'; sum = ''; }}>
						Withdraw available ↗
					</button>
				</div>
				{#if readError}
					<p role="alert">{readError} <button class="table-action" onclick={fetchMerchantData}>[Retry]</button></p>
				{/if}
			</section>

			<section class="merchant-panel">
				<p class="eyebrow">Chainlink CCIP 2.0 / Token Bridging</p>
				<h2>Cross-chain token bridge.</h2>
				{#if treasuryLoading}
					<p>Reading CCIP router configuration…</p>
				{:else if treasuryError}
					<p role="alert">{treasuryError} <button class="table-action" onclick={fetchTreasury}>[Retry]</button></p>
				{:else if treasuryData}
					<dl class="settings-list">
						<dt>Status</dt>
						<dd>{treasuryData.status}</dd>
						<dt>Protocol</dt>
						<dd>{treasuryData.protocol}</dd>
						<dt>Source</dt>
						<dd>{treasuryData.sourceChain}</dd>
						<dt>Destination</dt>
						<dd>{treasuryData.destinationChain}</dd>
						<dt>CCIP Router</dt>
						<dd>{treasuryData.routerAddress}</dd>
						<dt>Destination Gas</dt>
						<dd>0 (Token-only bridging)</dd>
					</dl>
					<a
						class="button light"
						href={treasuryData.explorerUrl}
						target="_blank"
						rel="noreferrer"
					>
						Open CCIP Explorer ↗
					</a>
				{/if}
			</section>
		{:else if section === 'exports'}
			<section class="merchant-panel">
				<p class="eyebrow">Shared / formatAccountantCsv</p>
				<h2>A file from actual settlement events.</h2>
				<p>
					Export PaymentSettled and RefundIssued in the displayed Whitechain block window, with UTC
					timestamps, raw units and transaction links. Historical windows can be exported separately.
				</p>
				<button class="button light" onclick={exportCsv}>Download CSV ↗</button>
				{#if readError}
					<p role="alert">{readError} <button class="table-action" onclick={fetchMerchantData}>[Retry]</button></p>
				{/if}
			</section>
		{:else if section === 'subscriptions'}
			<div class="table-toolbar">
				<h2>Subscription ledger</h2>
				<button
					class="table-action"
					onclick={() => {
						sum = '';
						days = 30;
						action = 'plan';
					}}
				>
					[Create plan +]
				</button>
			</div>

			<DataTable
				headers={['Subscription', 'Plan', 'USDT / cycle', 'Cycles', 'Next charge', 'Status', 'Action']}
				rows={remoteData?.subscriptions || []}
				rowKey={(row) => row.id}
				loading={remoteLoading || configLoading}
				error={readError}
				retry={fetchMerchantData}
			>
				{#snippet rowSnippet(row: SubscriptionRow)}
					{#if row.error}
						<td colspan={7} style="white-space: normal;">
							{short(row.id)} · {row.error}
							<button class="table-action" onclick={fetchMerchantData}>[Retry]</button>
						</td>
					{:else}
						<td title={row.id}>{short(row.id)}</td>
						<td title={row.subscription!.planId}>{short(row.subscription!.planId)}</td>
						<td>{amount(row.subscription!.amountPerCycleUnits)}</td>
						<td>{row.subscription!.cyclesCharged} / {row.subscription!.maxCycles}</td>
						<td>{new Date(row.subscription!.nextChargeAt * 1000).toISOString().slice(0, 10)}</td>
						<td>{row.subscription!.active ? 'ACTIVE' : 'CANCELLED'}</td>
						<td>
							{#if row.subscription!.active}
								<button
									class="table-action"
									onclick={() =>
										(confirm = {
											title: 'Charge due renewal',
											description: `Charge the next eligible cycle for subscription ${row.id}. The contract enforces its due time and allowance.`,
											label: 'Charge renewal',
											run: async () => {
												const client = await getBillingClient();
												return client.subscriptions.chargeRenewal(row.id as `0x${string}`);
											}
										})}
								>
									[Charge]
								</button>
								<button
									class="table-action"
									onclick={() =>
										(confirm = {
											title: 'Cancel subscription',
											description: `Cancel future renewals for ${row.id}. Existing settled payments are retained.`,
											label: 'Cancel subscription',
											run: async () => {
												const client = await getBillingClient();
												return client.subscriptions.cancel(row.id as `0x${string}`);
											}
										})}
								>
									[Cancel]
								</button>
							{/if}
						</td>
					{/if}
				{/snippet}
			</DataTable>
		{:else}
			<div class="table-toolbar">
				<h2>{activeSection} / real contract state</h2>
				<div class="actions">
					<input
						aria-label="Filter invoices"
						bind:value={filter}
						placeholder="Filter ID, customer, status"
						style="background: transparent; border: 1px solid #66665a; padding: 10px 12px; color: var(--cream); font-size: 11px;"
					/>
					{#if section === 'invoices'}
						<button
							class="table-action"
							onclick={() => {
								sum = '';
								customer = '';
								days = 7;
								action = 'invoice';
							}}
						>
							[Create invoice +]
						</button>
					{/if}
				</div>
			</div>

			<DataTable
				headers={['Invoice', 'Paid with', 'Settled USDT', 'Chain', 'Status', 'Action']}
				rows={shownRows}
				rowKey={(row) => row.id}
				loading={configLoading || remoteLoading}
				error={readError}
				retry={() => {
					fetchConfig();
					fetchMerchantData();
				}}
			>
				{#snippet rowSnippet(row: InvoiceRow)}
					{#if row.error}
						<td colspan={6} style="white-space: normal;">
							{short(row.id)} · Read failed: {row.error}
							<button class="table-action" onclick={fetchMerchantData}>[Retry]</button>
						</td>
					{:else}
						<td title={row.id}>
							<a href={row.payment ? `/receipt/${row.id}` : `/pricing-free?invoice=${row.id}`}>
								{short(row.id)}
							</a>
						</td>
						<td>{row.payment ? 'USDT' : '—'}</td>
						<td>{row.payment ? amount(row.payment.amountPaidUnits) : '—'}</td>
						<td>Whitechain</td>
						<td>{row.payment?.status.replaceAll('_', ' ') || row.invoice?.status}</td>
						<td>
							{#if row.payment && BigInt(row.payment.amountPaidUnits) > BigInt(row.payment.amountRefundedUnits)}
								<button
									class="table-action"
									onclick={() => {
										refundRow = row;
										sum = amount(
											BigInt(row.payment!.amountPaidUnits) - BigInt(row.payment!.amountRefundedUnits)
										);
										reason = '';
										action = 'refund';
									}}
								>
									[Refund]
								</button>
							{:else if row.invoice?.status === 'OPEN'}
								<button
									class="table-action"
									onclick={() =>
										(confirm = {
											title: 'Cancel open invoice',
											description: `Cancel invoice ${row.id}. Customers will no longer be able to settle it.`,
											label: 'Cancel invoice',
											run: async () => {
												const client = await getBillingClient();
												return client.invoices.cancel(row.id as `0x${string}`);
											}
										})}
								>
									[Cancel]
								</button>
							{:else}
								<a href="/receipt/{row.id}">[View]</a>
							{/if}
						</td>
					{/if}
				{/snippet}
			</DataTable>
		{/if}

		{#if chain === 'whitechain' && remoteData && !['settings', 'agents'].includes(section)}
			<div class="table-toolbar">
				<p class="merchant-notice">
					Event window: {remoteData.fromBlock}–{remoteData.block}. Balances are current; gross and refunded
					totals cover this window. Invoice creation history may be older than a payment.
				</p>
				<div class="actions">
					{#if remoteData.nextBefore}
						<button class="table-action" onclick={() => (before = remoteData!.nextBefore)}>
							[Older event window →]
						</button>
					{/if}
					{#if before}
						<button class="table-action" onclick={() => (before = undefined)}>
							[Latest window]
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Action Modal -->
		<Modal
			opened={action !== null && !confirm}
			onclose={() => (!busy ? (action = null) : null)}
			title={action === 'refund'
				? 'Reserve-backed refund'
				: action === 'invoice'
					? 'Create invoice'
					: action === 'plan'
						? 'Create subscription plan'
						: action === 'fund'
							? 'Fund reserve'
							: 'Withdraw available'}
		>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					prepareAction();
				}}
				class="merchant-form"
			>
				{#if action === 'refund'}
					<p class="merchant-notice">
						Invoice {refundRow?.id}<br />
						Original payer: {refundRow?.payment?.customer}
					</p>
				{/if}

				<label for="action-sum-input">
					{action === 'plan' ? 'USDT per cycle' : 'Amount / USDT'}
				</label>
				<input
					id="action-sum-input"
					bind:value={sum}
					inputmode="decimal"
					required
				/>

				{#if action === 'invoice'}
					<label for="action-cust-input">Customer address / optional</label>
					<input
						id="action-cust-input"
						bind:value={customer}
						placeholder="0x…"
					/>

					<label for="action-days-input">Due in days</label>
					<input
						id="action-days-input"
						type="number"
						bind:value={days}
						min="1"
						max="365"
					/>
				{/if}

				{#if action === 'refund'}
					<label for="action-reason-input">Refund reason / optional</label>
					<textarea
						id="action-reason-input"
						bind:value={reason}
						rows="3"
						style="width: 100%; background: transparent; border: 1px solid #747466; color: var(--ink); padding: 13px; font-family: var(--mono);"
					></textarea>
				{/if}

				{#if action === 'plan'}
					<label for="action-interval-input">Interval / days</label>
					<input
						id="action-interval-input"
						type="number"
						bind:value={days}
						min="1"
					/>

					<label for="action-cycles-input">Maximum cycles</label>
					<input
						id="action-cycles-input"
						type="number"
						bind:value={cycles}
						min="1"
						max="4294967295"
					/>
				{/if}

				<button type="submit" class="button" style="margin-top: 22px;">
					Review transaction →
				</button>
			</form>
		</Modal>

		<!-- Confirm Modal -->
		<Modal
			opened={confirm !== null}
			onclose={() => (!busy ? (confirm = null) : null)}
			title={confirm?.title}
		>
			<p style="font-size: 14px; line-height: 1.7; overflow-wrap: anywhere;">
				{confirm?.description}
			</p>
			<p class="merchant-notice">
				A transaction is submitted only after you confirm it in your wallet. Wait for the chain receipt.
			</p>
			<div class="actions" style="margin-top: 20px;">
				<button class="button" onclick={executeConfirm} disabled={busy}>
					{busy ? 'Awaiting confirmation…' : confirm?.label}
				</button>
				<button
					class="button soft"
					onclick={() => (!busy ? (confirm = null) : null)}
					disabled={busy}
				>
					Back
				</button>
			</div>
		</Modal>
	</div>
</main>

