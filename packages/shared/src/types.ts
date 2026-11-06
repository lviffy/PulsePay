export type ChainKey = "whitechain" | "ccip" | "hedera";

export type InvoiceStatus = "OPEN" | "PAID" | "EXPIRED" | "CANCELLED";
export type PaymentStatus = "PAID" | "PARTIALLY_REFUNDED" | "FULLY_REFUNDED";

export interface Invoice {
  id: string; // bytes32 hex
  merchant: `0x${string}`;
  customer?: `0x${string}`;
  amountUnits: bigint;
  dueAt: number; // unix timestamp seconds
  status: InvoiceStatus;
  metadataHash: `0x${string}`;
  createdAt: number;
}

export interface PaymentRecord {
  invoiceId: string;
  merchant: `0x${string}`;
  customer: `0x${string}`;
  amountPaidUnits: bigint;
  amountRefundedUnits: bigint;
  paidAt: number;
  status: PaymentStatus;
  txHash: `0x${string}`;
  chain: "whitechain";
}

export interface SubscriptionPlan {
  id: string;
  merchant: `0x${string}`;
  amountPerCycleUnits: bigint;
  intervalSeconds: number;
  maxCycles: number;
  active: boolean;
}

export interface Subscription {
  id: string;
  planId: string;
  merchant: `0x${string}`;
  subscriber: `0x${string}`;
  amountPerCycleUnits: bigint;
  intervalSeconds: number;
  nextChargeAt: number;
  maxCycles: number;
  cyclesCharged: number;
  active: boolean;
}

export interface BridgeQuote {
  sourceChainId: number;
  destinationChainSelector: string; // stringified bigint
  token: `0x${string}`;
  amountUnits: string;
  recipient: `0x${string}`;
  feeToken: `0x${string}`; // address(0) for native
  feeUnits: string;
  estimatedGas?: string;
  sourcePool?: `0x${string}`;
  destinationToken?: `0x${string}`;
}

export interface BridgeTransactionPayload {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  /** Execute and confirm this fee approval before ccipSend, when present. */
  feeApprovalTx?: { to: `0x${string}`; data: `0x${string}`; value: 0n };
  approvalTx?: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: 0n;
  };
}

export interface AgentSpendPolicy {
  dailyBudgetTinybars: bigint;
  maxPerRequestTinybars: bigint;
  merchantAllowlist: string[];
  humanApprovalThresholdTinybars?: bigint;
  enabled: boolean;
}

export interface AgentSpendRecord {
  id: string;
  serviceId: string;
  payerAccountId: string;
  merchantAccountId: string;
  amountTinybars: bigint;
  hederaTxId: string;
  hcsSequenceNumber?: string;
  timestamp: number;
  status: "SETTLED" | "REJECTED" | "REFUNDED";
}

export interface NormalizedActivity {
  id: string;
  chainKey: ChainKey;
  eventType:
    | "INVOICE_PAID"
    | "REFUND_ISSUED"
    | "SUBSCRIPTION_RENEWED"
    | "AGENT_SPEND_SETTLED"
    | "AGENT_REFUND_SETTLED"
    | "CCIP_BRIDGE_INITIATED"
    | "CCIP_BRIDGE_DELIVERED";
  from: string;
  to: string;
  asset: string;
  amountFormatted: string;
  amountRaw: string;
  status: "CONFIRMED" | "PENDING" | "FAILED";
  txId: string;
  explorerUrl: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
