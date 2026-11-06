import { AbstractPolicy, HederaContext, PostParamsNormalizationParams } from "../types.js";
import { readJson, writeJson } from "../storage/json.js";

export interface TokenSpendPolicyConfig {
  chainId: number;
  tokenAddress: string;
  dailyBudgetUnits: bigint;
  maxPerRequestUnits: bigint;
  hubAllowlist: string[];
  merchantAllowlist?: string[];
  statePath?: string;
}

interface TokenSpendState { day: string; spent: string; }

export class PulsePayTokenSpendPolicy extends AbstractPolicy {
  readonly name = "PulsePay Token Spend Policy";
  readonly description = "Restricts Hedera EVM invoice payments by chain, token, hub, merchant and token-unit budgets.";
  readonly relevantTools = ["hedera_evm_invoice_pay_tool"];
  private spent = 0n;
  private day = new Date().toISOString().slice(0, 10);
  private reservations = new WeakMap<object, bigint>();
  private readonly hubs: Set<string>;
  private readonly merchants: Set<string>;

  constructor(private readonly config: TokenSpendPolicyConfig) {
    super();
    if (config.chainId !== 296) throw new Error("Token spend policy currently supports Hedera testnet chain 296 only");
    if (config.dailyBudgetUnits < 0n || config.maxPerRequestUnits < 0n) throw new Error("Token spend limits cannot be negative");
    this.hubs = new Set(config.hubAllowlist.map(address => address.toLowerCase()));
    this.merchants = new Set((config.merchantAllowlist || []).map(address => address.toLowerCase()));
    if (!this.hubs.size) throw new Error("At least one trusted merchant hub is required");
    if (config.statePath) {
      const state = readJson<TokenSpendState>(config.statePath, { day: this.day, spent: "0" });
      if (state.day === this.day) this.spent = BigInt(state.spent);
    }
  }

  private reset() {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.day) { this.day = day; this.spent = 0n; this.reservations = new WeakMap(); this.save(); }
  }

  private save() {
    if (this.config.statePath) writeJson(this.config.statePath, { day: this.day, spent: this.spent.toString() });
  }

  protected override shouldBlockPostParamsNormalization(params: PostParamsNormalizationParams, method: string): boolean {
    if (!this.relevantTools.includes(method)) return false;
    this.reset();
    const value = params.normalisedParams as Record<string, unknown>;
    const chainId = Number(value.chainId);
    const hub = String(value.hubAddress).toLowerCase();
    const token = String(value.tokenAddress).toLowerCase();
    const merchant = String(value.merchantAddress).toLowerCase();
    const amount = BigInt(String(value.amountUnits));
    if (chainId !== this.config.chainId) throw new Error("[token-spend-policy] Untrusted chain");
    if (!this.hubs.has(hub)) throw new Error("[token-spend-policy] Untrusted merchant hub");
    if (token !== this.config.tokenAddress.toLowerCase()) throw new Error("[token-spend-policy] Untrusted settlement token");
    if (this.merchants.size && !this.merchants.has(merchant)) throw new Error("[token-spend-policy] Merchant is not allowlisted");
    if (this.config.maxPerRequestUnits > 0n && amount > this.config.maxPerRequestUnits) throw new Error("[token-spend-policy] Payment exceeds the per-request token limit");
    if (this.config.dailyBudgetUnits > 0n && this.spent + amount > this.config.dailyBudgetUnits) throw new Error("[token-spend-policy] Payment exceeds the remaining daily token budget");
    this.spent += amount;
    const context = params.context as HederaContext;
    if (context.executionId) this.reservations.set(context.executionId, amount);
    this.save();
    return false;
  }

  executionFailed(context: HederaContext) {
    const amount = context.executionId && this.reservations.get(context.executionId);
    if (amount !== undefined && !context.submissionStarted) {
      this.spent -= amount;
      this.reservations.delete(context.executionId!);
      this.save();
    }
  }

  getRemainingDailyBudgetUnits(): bigint {
    this.reset();
    return this.config.dailyBudgetUnits > this.spent ? this.config.dailyBudgetUnits - this.spent : 0n;
  }
}

