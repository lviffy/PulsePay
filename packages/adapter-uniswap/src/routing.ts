import { SwapQuote } from "@pulsepay/shared";

// Snapshot of the Trading API chain list. Unsupported chains fail before a request.
export const UNISWAP_TRADING_CHAINS = new Set([1, 10, 56, 130, 137, 143, 196, 324, 480, 1868, 4217, 4326, 4663, 5042, 8453, 10143, 42161, 42220, 43114, 57073, 59144, 81457, 7777777, 1301, 84532, 11155111]);
const address = /^0x[a-fA-F0-9]{40}$/;
const positiveUnits = (value: unknown): value is string => typeof value === "string" && /^[0-9]+$/.test(value) && BigInt(value) > 0n;

export interface UniswapRoutingConfig {
  /** Server-side only. Never embed an API key in browser configuration. */
  apiKey?: string;
  baseUrl?: string;
  chainId?: number;
}
export interface ExactOutputQuoteParams {
  tokenInAddress: string;
  tokenInSymbol: string;
  tokenInDecimals: number;
  tokenOutAddress: string;
  targetUsdtAmountUnits: bigint;
  slippageTolerancePercent?: number;
  payerAddress: string;
}

export class UniswapRoutingAdapter {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  readonly chainId: number;

  constructor(config: UniswapRoutingConfig = {}) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://trade-api.gateway.uniswap.org/v1";
    this.chainId = config.chainId ?? 1301;
    if (!UNISWAP_TRADING_CHAINS.has(this.chainId)) throw new Error("Chain is not supported by the Uniswap Trading API; cross-chain invoice settlement is unavailable");
    if (new URL(this.baseUrl).protocol !== "https:") throw new Error("Trading API requires HTTPS");
  }

  private async request(path: string, body: unknown): Promise<any> {
    if (!this.apiKey) throw new Error("Configure a server-side UNISWAP_API_KEY; simulated quotes are disabled");
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/${path}`, {
      method: "POST", signal: AbortSignal.timeout(15000), redirect: "error",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey, "x-universal-router-version": "2.0",
        "x-agent-info": JSON.stringify({ integration_name: "swap-integration", decision_origin: "human_mediated", version: "1.6.0" }) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Uniswap ${path} failed (${response.status}); no quote or transaction was accepted`);
    return response.json();
  }

  async getExactOutputQuote(params: ExactOutputQuoteParams): Promise<SwapQuote> {
    for (const value of [params.tokenInAddress, params.tokenOutAddress, params.payerAddress]) {
      if (!address.test(value) || /^0x0{40}$/i.test(value)) throw new Error("Valid nonzero token and payer addresses are required");
    }
    if (params.tokenInAddress.toLowerCase() === params.tokenOutAddress.toLowerCase()) throw new Error("Input and output tokens must differ");
    if (typeof params.targetUsdtAmountUnits !== "bigint" || params.targetUsdtAmountUnits <= 0n) throw new Error("Output amount must be positive integer token units");
    if (!Number.isInteger(params.tokenInDecimals) || params.tokenInDecimals < 0 || params.tokenInDecimals > 255) throw new Error("Invalid token decimals");
    const slippage = params.slippageTolerancePercent ?? 0.5;
    if (!Number.isFinite(slippage) || slippage < 0 || slippage > 5) throw new Error("Slippage must be between 0 and 5 percent");
    const result = await this.request("quote", {
      swapper: params.payerAddress, tokenIn: params.tokenInAddress, tokenOut: params.tokenOutAddress,
      tokenInChainId: String(this.chainId), tokenOutChainId: String(this.chainId),
      amount: params.targetUsdtAmountUnits.toString(), type: "EXACT_OUTPUT", slippageTolerance: slippage,
      routingPreference: "BEST_PRICE", protocols: ["V2", "V3", "V4"],
    });
    const quote = result?.quote;
    if (result?.routing !== "CLASSIC" || result.txFailureReason || quote?.txFailureReason || !positiveUnits(quote?.input?.amount)
      || !positiveUnits(quote?.output?.amount) || BigInt(quote.output.amount) !== params.targetUsdtAmountUnits
      || quote.input.token?.toLowerCase() !== params.tokenInAddress.toLowerCase()
      || quote.output.token?.toLowerCase() !== params.tokenOutAddress.toLowerCase()) throw new Error("Uniswap returned an invalid or unsupported exact-output quote");
    return {
      inputToken: params.tokenInSymbol, inputAmount: quote.input.amount, outputToken: params.tokenOutAddress,
      outputAmount: quote.output.amount, estimatedGas: String(quote.gasUseEstimate ?? "0"), slippageTolerance: slippage,
      route: `Uniswap CLASSIC on chain ${this.chainId}`, chainId: this.chainId,
    };
  }
}
