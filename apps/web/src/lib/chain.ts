import { createPulsePay, pulsePayMerchantHubAbi, type Invoice, type PaymentRecord, type Subscription } from "@pulsepay/sdk-core";
import { createPublicClient, http, parseAbiItem, isAddress, formatUnits } from "viem";
import { whitechainSepolia } from "@pulsepay/adapter-whitechain";
import type { NormalizedActivity } from "@pulsepay/shared";

export function publicConfig() {
	return {
		hub: process.env.WHITECHAIN_MERCHANT_HUB_ADDRESS || "",
		rpc: process.env.WHITECHAIN_RPC_URL || "https://rpc.testnet.whitechain.io",
		usdt: process.env.WHITECHAIN_USDT_ADDRESS || "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
		merchant: process.env.PULSEPAY_MERCHANT_ADDRESS || "",
		merchantName: process.env.PULSEPAY_MERCHANT_NAME || "Merchant console",
		hook: process.env.UNISWAP_TREASURY_HOOK_ADDRESS || "",
		topic: process.env.HEDERA_AUDIT_TOPIC_ID || "",
		network: process.env.HEDERA_NETWORK === "mainnet" ? "mainnet" : "testnet",
		serviceUrl: process.env.PULSEPAY_SERVICE_URL || process.env.PULSEPAY_APP_URL || "http://localhost:3000"
	};
}

export function chainClient() {
	const config = publicConfig();
	if (!isAddress(config.hub) || /^0x0{40}$/i.test(config.hub))
		throw new Error("Set WHITECHAIN_MERCHANT_HUB_ADDRESS to the deployed merchant hub. No chain data is available until it is configured.");
	const publicClient = createPublicClient({ chain: whitechainSepolia, transport: http(config.rpc, { timeout: 12000, retryCount: 0 }) });
	return createPulsePay({ whitechain: { contractAddress: config.hub as `0x${string}`, usdtAddress: config.usdt as `0x${string}`, publicClient } });
}

export function stringify(data: unknown) {
	return JSON.stringify(data, (_, value) => (typeof value === "bigint" ? value.toString() : value));
}

export const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : "The chain read failed. Retry the request.";

const invoiceEvent = parseAbiItem("event InvoiceCreated(bytes32 indexed invoiceId, address indexed merchant, address indexed customer, uint256 amount, uint64 dueAt, bytes32 metadataHash)");
const subscriptionEvent = parseAbiItem("event SubscriptionCreated(bytes32 indexed subscriptionId, bytes32 indexed planId, address indexed merchant, address subscriber, uint256 amountPerCycle, uint64 nextChargeAt)");
const paidEvent = parseAbiItem("event PaymentSettled(bytes32 indexed invoiceId, address indexed merchant, address indexed customer, uint256 amount, uint64 paidAt)");
const refundEvent = parseAbiItem("event RefundIssued(bytes32 indexed invoiceId, address indexed merchant, address indexed customer, uint256 amount, uint256 cumulativeRefund, bytes32 reasonHash)");

export type InvoiceRow = { id: string; invoice?: Omit<Invoice, "amountUnits"> & { amountUnits: string }; payment?: Omit<PaymentRecord, "amountPaidUnits" | "amountRefundedUnits"> & { amountPaidUnits: string; amountRefundedUnits: string }; error?: string };
export type SubscriptionRow = { id: string; subscription?: Omit<Subscription, "amountPerCycleUnits"> & { amountPerCycleUnits: string }; error?: string };
export type MerchantData = { rows: InvoiceRow[]; subscriptions: SubscriptionRow[]; balances: { reserve: string; available: string; reserveBps: number }; gross: string; refunded: string; block: string; nextBefore?: string; fromBlock: string };

export async function readMerchant(merchant: string, before?: string): Promise<MerchantData> {
	if (!isAddress(merchant)) throw new Error("Connect a merchant wallet or enter a valid merchant address in Settings.");
	const client = chainClient(), rpc = client.whitechain.publicClient, hub = client.whitechain.contractAddress;
	if (await rpc.getChainId() !== 1874) throw new Error("Configured RPC is not Whitechain Sepolia (1874).");
	const latest = await rpc.getBlockNumber();
	const end = before ? BigInt(before) : latest;
	const deployed = BigInt(process.env.WHITECHAIN_DEPLOYMENT_BLOCK || "0");
	if (end > latest || end < deployed) throw new Error("Invalid block range.");
	
	const start = end - 19999n > deployed ? end - 19999n : deployed;
	const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
	for (let from = start; from <= end; from += 2000n) ranges.push({ fromBlock: from, toBlock: from + 1999n > end ? end : from + 1999n });
	
	const [invoices, subscriptions, balances, bps, paid, refunds] = await Promise.all([
		Promise.all(ranges.map(range => rpc.getLogs({ address: hub, event: invoiceEvent, args: { merchant: merchant as `0x${string}` }, ...range }))),
		Promise.all(ranges.map(range => rpc.getLogs({ address: hub, event: subscriptionEvent, args: { merchant: merchant as `0x${string}` }, ...range }))),
		client.payments.getBalances(merchant as `0x${string}`),
		rpc.readContract({ address: hub, abi: pulsePayMerchantHubAbi, functionName: "getMerchantReserveBps", args: [merchant as `0x${string}`] }),
		Promise.all(ranges.map(range => rpc.getLogs({ address: hub, event: paidEvent, args: { merchant: merchant as `0x${string}` }, ...range }))),
		Promise.all(ranges.map(range => rpc.getLogs({ address: hub, event: refundEvent, args: { merchant: merchant as `0x${string}` }, ...range })))
	]);
	
	const ids = [...new Set(invoices.flat().map(log => log.args.invoiceId!))].reverse();
	const rows: InvoiceRow[] = [];
	for (let i = 0; i < ids.length; i += 12) {
		rows.push(...await Promise.all(ids.slice(i, i + 12).map(async id => {
			try {
				const invoice = await client.invoices.get(id);
				if (!invoice) throw new Error("Invoice event exists but its contract read returned no invoice.");
				const payment = await client.payments.get(id);
				return JSON.parse(stringify({ id, invoice, payment: payment || undefined })) as InvoiceRow;
			} catch (error) {
				return { id, error: errorMessage(error) };
			}
		})));
	}
	
	const subscriptionRows: SubscriptionRow[] = [];
	const subIds = [...new Set(subscriptions.flat().map(log => log.args.subscriptionId!))].reverse();
	for (let i = 0; i < subIds.length; i += 12) {
		subscriptionRows.push(...await Promise.all(subIds.slice(i, i + 12).map(async id => {
			try {
				const subscription = await client.subscriptions.get(id);
				if (!subscription) throw new Error("Subscription not found.");
				return JSON.parse(stringify({ id, subscription }));
			} catch (error) {
				return { id, error: errorMessage(error) };
			}
		})));
	}
	
	return {
		rows,
		subscriptions: subscriptionRows,
		balances: { reserve: balances.reserve.toString(), available: balances.available.toString(), reserveBps: Number(bps) },
		gross: paid.flat().reduce((sum, log) => sum + (log.args.amount || 0n), 0n).toString(),
		refunded: refunds.flat().reduce((sum, log) => sum + (log.args.amount || 0n), 0n).toString(),
		block: end.toString(),
		fromBlock: start.toString(),
		...(start > deployed ? { nextBefore: (start - 1n).toString() } : {})
	};
}

export async function readAudit(next?: string) {
	const config = publicConfig();
	if (!/^\d+\.\d+\.\d+$/.test(config.topic)) throw new Error("Set HEDERA_AUDIT_TOPIC_ID to the agent worker’s HCS topic.");
	const base = `https://${config.network}.mirrornode.hedera.com`;
	const path = `/api/v1/topics/${config.topic}/messages`;
	const url = new URL(path, base);
	url.searchParams.set("limit", "100");
	url.searchParams.set("order", "desc");
	if (next) {
		if (!/^\d+\.\d+$/.test(next)) throw new Error("Invalid consensus timestamp.");
		url.searchParams.set("timestamp", `lt:${next}`);
	}
	const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: "no-store" });
	if (!response.ok) throw new Error(`Hedera mirror returned ${response.status}. Retry the topic read.`);
	const data = (await response.json()) as { messages: Array<{ sequence_number: number; consensus_timestamp: string; message: string; payer_account_id: string }>; links: { next: string | null } };
	const entries = data.messages.map(message => {
		const decoded = Buffer.from(message.message, "base64").toString("utf8");
		let payload: Record<string, unknown>;
		try { payload = JSON.parse(decoded); } catch { payload = { message: decoded }; }
		return { ...message, payload };
	});
	return { topic: config.topic, network: config.network, entries, next: data.links.next ? entries.at(-1)?.consensus_timestamp : undefined };
}

export async function readActivities(merchant: string, before?: string): Promise<NormalizedActivity[]> {
	if (!isAddress(merchant)) throw new Error("A valid merchant address is required.");
	const client = chainClient(), rpc = client.whitechain.publicClient, hub = client.whitechain.contractAddress;
	const end = before ? BigInt(before) : await rpc.getBlockNumber();
	const deployed = BigInt(process.env.WHITECHAIN_DEPLOYMENT_BLOCK || "0");
	const start = end - 19999n > deployed ? end - 19999n : deployed;
	const activity: NormalizedActivity[] = [];
	const times = new Map<bigint, number>();
	for (let from = start; from <= end; from += 2000n) {
		const range = { fromBlock: from, toBlock: from + 1999n > end ? end : from + 1999n };
		const [paid, refunds] = await Promise.all([
			rpc.getLogs({ address: hub, event: paidEvent, args: { merchant: merchant as `0x${string}` }, ...range }),
			rpc.getLogs({ address: hub, event: refundEvent, args: { merchant: merchant as `0x${string}` }, ...range })
		]);
		for (const [logs, refund] of [[paid, false], [refunds, true]] as const) {
			for (const log of logs) {
				if (log.blockNumber === null || !log.transactionHash || log.removed) continue;
				let timestamp = times.get(log.blockNumber);
				if (timestamp === undefined) {
					timestamp = Number((await rpc.getBlock({ blockNumber: log.blockNumber })).timestamp);
					times.set(log.blockNumber, timestamp);
				}
				const amount = log.args.amount!;
				activity.push({
					id: `${log.transactionHash}:${log.logIndex}`,
					chainKey: "whitechain",
					eventType: refund ? "REFUND_ISSUED" : "INVOICE_PAID",
					from: refund ? merchant : log.args.customer!,
					to: refund ? log.args.customer! : merchant,
					asset: "USDT",
					amountFormatted: formatUnits(amount, 6),
					amountRaw: amount.toString(),
					status: "CONFIRMED",
					txId: log.transactionHash,
					explorerUrl: `https://explorer.testnet.whitechain.io/tx/${log.transactionHash}`,
					timestamp
				});
			}
		}
	}
	return activity.sort((a, b) => b.timestamp - a.timestamp);
}

