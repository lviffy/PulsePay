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

export function transferCredit(record: HederaTransactionRecord, account: string): bigint {
  return record.transfers.filter(t => t.account === account).reduce((sum, t) => sum + tinybars(t.amount), 0n);
}
