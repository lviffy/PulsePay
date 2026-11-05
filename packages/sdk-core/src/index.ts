import { WhitechainAdapter, WhitechainClientConfig } from "@pulsepay/adapter-whitechain";
import {
  UniswapRoutingAdapter,
  UniswapV4TreasuryAdapter,
  UniswapRoutingConfig,
  UniswapV4TreasuryConfig,
} from "@pulsepay/adapter-uniswap";
import {
  Invoice,
  PaymentRecord,
  Subscription,
  SubscriptionPlan,
  SwapQuote,
} from "@pulsepay/shared";

export interface PulsePayConfig {
  merchantId?: string;
  whitechain: WhitechainClientConfig;
  uniswap?: {
    routing?: UniswapRoutingConfig;
    treasury?: UniswapV4TreasuryConfig;
  };
}

export class PulsePayClient {
  public readonly whitechain: WhitechainAdapter;
  public readonly routing: UniswapRoutingAdapter;
  public readonly treasury?: UniswapV4TreasuryAdapter;

  constructor(config: PulsePayConfig) {
    this.whitechain = new WhitechainAdapter(config.whitechain);
    this.routing = new UniswapRoutingAdapter(config.uniswap?.routing);
    if (config.uniswap?.treasury) {
      this.treasury = new UniswapV4TreasuryAdapter(config.uniswap.treasury);
    }
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

  // --- Universal Checkout ("Pay With Any Token") ---
  get checkout() {
    return {
      quotePayWithToken: (params: {
        tokenInAddress: string;
        tokenInSymbol: string;
        tokenInDecimals: number;
        tokenOutAddress: string;
        targetUsdtAmountUnits: bigint;
        slippageTolerancePercent?: number;
        payerAddress: string;
      }): Promise<SwapQuote> => {
        return this.routing.getExactOutputQuote(params);
      },
    };
  }
}

export function createPulsePay(config: PulsePayConfig): PulsePayClient {
  return new PulsePayClient(config);
}

export * from "@pulsepay/shared";
export * from "@pulsepay/adapter-whitechain";
export * from "@pulsepay/adapter-uniswap";

