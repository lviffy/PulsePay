import { decodeEventLog, isAddress, type Address, type Hex } from "viem";
import { hederaMerchantHubAbi } from "./hedera-evm.js";

export interface HederaTransactionRecord {
  transaction_id: string;
  result: string;
  consensus_timestamp: string;
  memo_base64: string;
  charged_tx_fee: number;
  name?: string;
  entity_id?: string | null;
  transfers: { account: string; amount: number | string }[];
}

export interface HederaContractResult {
  status: string;
  from: string;
  to?: string | null;
  hash?: string;
  transaction_hash?: string;
  logs: { address: string; data: Hex; topics: Hex[] }[];
}

export function mirrorTransactionId(id: string): string {
  if (!/^\d+\.\d+\.\d+[@-]\d+[.-]\d{1,9}$/.test(id)) throw new Error("Invalid Hedera transaction ID");
  return id.replace("@", "-").replace(/(\d+\.\d+\.\d+-\d+)\./, "$1-");
}

export function tinybars(value: number | string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error("Unsafe tinybar integer");
  if (!/^-?\d+$/.test(String(value))) throw new Error("Invalid tinybar integer");
  return BigInt(value);
}

export class HederaMirrorClient {
  readonly baseUrl: string;
  constructor(readonly network: "testnet" | "mainnet" = "testnet", private fetcher: typeof fetch = fetch) {
    this.baseUrl = `https://${network}.mirrornode.hedera.com`;
  }
  async transaction(id: string): Promise<HederaTransactionRecord> {
    const normalized = mirrorTransactionId(id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await this.fetcher(`${this.baseUrl}/api/v1/transactions/${normalized}`, { signal: AbortSignal.timeout(10000) });
      if (response.status === 404 && attempt < 4) { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      if (!response.ok) throw new Error(`Mirror transaction lookup failed: ${response.status}`);
      const data = await response.json() as { transactions: HederaTransactionRecord[] };
      const record = data.transactions.find(tx => tx.transaction_id === normalized && !((tx as any).nonce));
      if (!record || record.result !== "SUCCESS") throw new Error("Transaction has not settled successfully");
      return record;
    }
    throw new Error("Transaction is not indexed yet");
  }
  async contractResult(idOrHash: string): Promise<HederaContractResult> {
    const identifier = /^0x[a-fA-F0-9]{64}$/.test(idOrHash) ? idOrHash : mirrorTransactionId(idOrHash);
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await this.fetcher(`${this.baseUrl}/api/v1/contracts/results/${encodeURIComponent(identifier)}`, { signal: AbortSignal.timeout(10000) });
      if (response.status === 404 && attempt < 4) { await new Promise(resolve => setTimeout(resolve, 500)); continue; }
      if (!response.ok) throw new Error(`Mirror contract-result lookup failed: ${response.status}`);
      const result = await response.json() as HederaContractResult;
      if (result.status !== "SUCCESS") throw new Error("Contract transaction has not settled successfully");
      return result;
    }
    throw new Error("Contract transaction is not indexed yet");
  }
  async topic(id: string): Promise<any> {
    if (!/^\d+\.\d+\.\d+$/.test(id)) throw new Error("Invalid topic ID");
    const response = await this.fetcher(`${this.baseUrl}/api/v1/topics/${id}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Mirror topic lookup failed: ${response.status}`);
    const topic = await response.json() as any;
    if (topic.deleted || topic.topic_id !== id) throw new Error("Topic is deleted or mismatched");
    return topic;
  }
  async verifyTopicMessage(topicId: string, timestamp: string, message: string): Promise<boolean> {
    if (!/^\d+\.\d+\.\d+$/.test(topicId) || !/^\d+\.\d+$/.test(timestamp)) throw new Error("Invalid topic message lookup");
    const response = await this.fetcher(`${this.baseUrl}/api/v1/topics/${topicId}/messages?timestamp=${timestamp}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Mirror message lookup failed: ${response.status}`);
    const data = await response.json() as { messages: { message: string }[] };
    return data.messages.some(item => item.message === Buffer.from(message).toString("base64"));
  }
}

export async function verifyHederaInvoicePayment(input: {
  mirror: HederaMirrorClient;
  transactionIdOrHash: string;
  hubAddress: string;
  invoiceId: string;
  merchantAddress: string;
  payerAddress: string;
  amountUnits: bigint;
}): Promise<{ transactionHash: string; paidAt: bigint }> {
  if (![input.hubAddress, input.merchantAddress, input.payerAddress].every(value => isAddress(value)) || !/^0x[a-fA-F0-9]{64}$/.test(input.invoiceId)) throw new Error("Invalid invoice verification terms");
  const result = await input.mirror.contractResult(input.transactionIdOrHash);
  if (!result.to || result.to.toLowerCase() !== input.hubAddress.toLowerCase()) throw new Error("Payment called an untrusted contract");
  if (result.from.toLowerCase() !== input.payerAddress.toLowerCase()) throw new Error("Payment was submitted by another payer");
  for (const log of result.logs || []) {
    if (log.address.toLowerCase() !== input.hubAddress.toLowerCase()) continue;
    if (!log.topics.length) continue;
    try {
      const decoded = decodeEventLog({ abi: hederaMerchantHubAbi, eventName: "PaymentSettled", data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      const args = decoded.args as { invoiceId: Hex; merchant: Address; customer: Address; amount: bigint; paidAt: bigint };
      if (args.invoiceId.toLowerCase() === input.invoiceId.toLowerCase()
        && args.merchant.toLowerCase() === input.merchantAddress.toLowerCase()
        && args.customer.toLowerCase() === input.payerAddress.toLowerCase()
        && args.amount === input.amountUnits) {
        return { transactionHash: result.transaction_hash || result.hash || input.transactionIdOrHash, paidAt: args.paidAt };
      }
    } catch { /* Ignore unrelated logs. */ }
  }
  throw new Error("PaymentSettled event does not match the invoice challenge");
}

export function transferCredit(record: HederaTransactionRecord, account: string): bigint {
  return record.transfers.filter(t => t.account === account).reduce((sum, t) => sum + tinybars(t.amount), 0n);
}
