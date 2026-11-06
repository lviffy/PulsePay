import { WhitechainAdapter, WhitechainClientConfig } from "@pulsepay/adapter-whitechain";
import {
  CCIPBridgeAdapter,
  CCIPMessageMonitor,
  CCIPBridgeConfig,
  QuoteBridgeParams,
  BuildBridgeParams,
} from "@pulsepay/adapter-ccip";
import type {
  BridgeQuote,
  BridgeTransactionPayload,
} from "@pulsepay/shared";

export interface PulsePayConfig {
  merchantId?: string;
  whitechain: WhitechainClientConfig;
  ccip?: CCIPBridgeConfig;
}

export class PulsePayClient {
  public readonly whitechain: WhitechainAdapter;
  public readonly bridge: CCIPBridgeAdapter;
  public readonly bridgeMonitor = new CCIPMessageMonitor();

  constructor(config: PulsePayConfig) {
    this.whitechain = new WhitechainAdapter(config.whitechain);
    this.bridge = new CCIPBridgeAdapter(config.ccip);
  }

  // --- Invoices ---
  get invoices() {
    return {
      get: (id: `0x${string}`) => this.whitechain.getInvoice(id),
      create: this.whitechain.createInvoice.bind(this.whitechain),
      cancel: this.whitechain.cancelInvoice.bind(this.whitechain),
      pay: this.whitechain.payInvoice.bind(this.whitechain),
      encodeCreate: this.whitechain.encodeCreateInvoice.bind(this.whitechain),
      encodeCancel: this.whitechain.encodeCancelInvoice.bind(this.whitechain),
      encodePay: this.whitechain.encodePayInvoice.bind(this.whitechain),
    };
  }

  // --- Payments & Refunds ---
  get payments() {
    return {
      get: (id: `0x${string}`) => this.whitechain.getPayment(id),
      refund: this.whitechain.issueRefund.bind(this.whitechain),
      withdraw: this.whitechain.withdrawAvailable.bind(this.whitechain),
      fundReserve: this.whitechain.fundRefundReserve.bind(this.whitechain),
      encodeRefund: this.whitechain.encodeIssueRefund.bind(this.whitechain),
      encodeApproveUsdt: this.whitechain.encodeApproveUsdt.bind(this.whitechain),
      getBalances: (merchant: `0x${string}`) => this.whitechain.getMerchantBalances(merchant),
      encodeWithdraw: this.whitechain.encodeWithdrawAvailable.bind(this.whitechain),
      encodeFundReserve: this.whitechain.encodeFundRefundReserve.bind(this.whitechain),
    };
  }

  // --- Subscriptions ---
  get subscriptions() {
    return {
      get: (id: `0x${string}`) => this.whitechain.getSubscription(id),
      getPlan: (id: `0x${string}`) => this.whitechain.getPlan(id),
      createPlan: this.whitechain.createPlan.bind(this.whitechain),
      subscribe: this.whitechain.createSubscription.bind(this.whitechain),
      chargeRenewal: this.whitechain.chargeRenewal.bind(this.whitechain),
      cancel: this.whitechain.cancelSubscription.bind(this.whitechain),
      encodeCreatePlan: this.whitechain.encodeCreatePlan.bind(this.whitechain),
      encodeSubscribe: this.whitechain.encodeCreateSubscription.bind(this.whitechain),
      encodeChargeRenewal: this.whitechain.encodeChargeRenewal.bind(this.whitechain),
      encodeCancel: this.whitechain.encodeCancelSubscription.bind(this.whitechain),
    };
  }

  // --- Chainlink CCIP 2.0 Token Bridging ---
  get bridgeOps() {
    return {
      getStatus: this.bridgeMonitor.getStatus.bind(this.bridgeMonitor),
      waitForDelivery: this.bridgeMonitor.waitForDelivery.bind(this.bridgeMonitor),
      quoteFee: (params: QuoteBridgeParams): Promise<BridgeQuote> => {
        return this.bridge.quoteBridgeFee(params);
      },
      buildTransactions: (params: BuildBridgeParams): Promise<BridgeTransactionPayload> => {
        return this.bridge.buildBridgeTransactions(params);
      },
      getExplorerUrl: (messageId: string): string => {
        return this.bridge.getExplorerUrl(messageId);
      },
    };
  }
}

export function createPulsePay(config: PulsePayConfig): PulsePayClient {
  return new PulsePayClient(config);
}

export * from "@pulsepay/shared";
export * from "@pulsepay/adapter-whitechain";
export * from "@pulsepay/adapter-ccip";
