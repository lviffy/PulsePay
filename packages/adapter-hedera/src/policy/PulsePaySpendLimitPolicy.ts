import { AbstractPolicy, HederaContext, PreToolExecutionParams, PostParamsNormalizationParams, PostSecondaryActionParams } from "../types.js";
import { amountTinybarsSchema } from "../transactions.js";
import { readJson, writeJson } from "../storage/json.js";
import { mirrorTransactionId } from "../mirror.js";

export interface SpendPolicyConfig {
  dailyBudgetTinybars: bigint;
  maxPerRequestTinybars: bigint;
  merchantAllowlist?: string[];
  allowedTools?: string[];
  statePath?: string;
}

export class PulsePaySpendLimitPolicy extends AbstractPolicy {
  readonly name = "PulsePay Spend Limit Policy";
  readonly description = "Enforces request limits, daily budgets and recipient allowlists before signing.";
  relevantTools = ["*"];
  private spent = 0n;
  private day = new Date().toISOString().slice(0, 10);
  private reservations = new WeakMap<object, bigint>();
  private allowedTools: string[];
  readonly merchantAllowlist: Set<string>;
  readonly dailyBudgetTinybars: bigint;
  readonly maxPerRequestTinybars: bigint;
  private statePath?: string;
  private prepared: Record<string, string> = {};
  private confirmed: string[] = [];

  constructor(config: SpendPolicyConfig) {
    super();
    if (config.dailyBudgetTinybars < 0n || config.maxPerRequestTinybars < 0n) throw new Error("Spending limits cannot be negative");
    this.dailyBudgetTinybars = config.dailyBudgetTinybars;
    this.maxPerRequestTinybars = config.maxPerRequestTinybars;
    this.merchantAllowlist = new Set(config.merchantAllowlist || []);
    this.allowedTools = config.allowedTools || ["x402_pay_tool", "transfer_hbar_tool"];
    this.statePath = config.statePath;
    if (this.statePath) {
      const state = readJson(this.statePath, { day: this.day, spent: "0", prepared: {} as Record<string,string>, confirmed: [] as string[] });
      if (state.day === this.day) { this.spent = BigInt(state.spent); this.prepared = state.prepared || {}; this.confirmed = state.confirmed || []; }
    }
  }
  private save() { if (this.statePath) writeJson(this.statePath, { day: this.day, spent: this.spent.toString(), prepared: this.prepared, confirmed: this.confirmed }); }
  private reset() {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.day) { this.spent = 0n; this.day = day; this.prepared = {}; this.confirmed = []; this.reservations = new WeakMap(); this.save(); }
  }
  protected override shouldBlockPreToolExecution(_params: PreToolExecutionParams, method: string): boolean {
    if (!this.allowedTools.includes(method)) throw new Error(`[SpendPolicy Violation] Tool "${method}" is not in the approved allowlist.`);
    return false;
  }
  protected override shouldBlockPostParamsNormalization(params: PostParamsNormalizationParams): boolean {
    this.reset();
    const p = params.normalisedParams;
    const recipient = p.merchantAccountId || p.agentAccountId || p.toAccountId;
    const amount = amountTinybarsSchema.parse(p.amountTinybars);
    if (this.merchantAllowlist.size && (!recipient || !this.merchantAllowlist.has(recipient))) throw new Error(`[SpendPolicy Violation] Merchant account "${recipient}" is not on the authorized merchant allowlist.`);
    if (this.maxPerRequestTinybars > 0n && amount > this.maxPerRequestTinybars) throw new Error("Requested spend exceeds maximum per-request limit");
    if (this.dailyBudgetTinybars > 0n && this.spent + amount > this.dailyBudgetTinybars) throw new Error("Requested spend exceeds remaining daily budget");
    this.spent += amount;
    const context = params.context as HederaContext;
    if (context.executionId) this.reservations.set(context.executionId, amount);
    this.save();
    return false;
  }
  executionFailed(context: HederaContext) {
    const amount = context.executionId && this.reservations.get(context.executionId);
    if (amount !== undefined && !context.submissionStarted) { this.spent -= amount; this.reservations.delete(context.executionId!); this.save(); }
    // Ambiguous submission errors retain the reservation to prevent accidental double spending.
  }
  override async postToolExecutionHook(params: PostSecondaryActionParams, _method: string) {
    const context = params.context as HederaContext;
    if (params.toolResult.status === "PREPARED") {
      this.prepared[mirrorTransactionId(params.toolResult.transactionId)] = String(params.normalisedParams.amountTinybars);
      this.save();
    }
    if (context.executionId) this.reservations.delete(context.executionId);
  }
  /** Call only after independently verifying consensus; idempotent across worker restarts. */
  recordConfirmedSpend(transactionId: string, amount: bigint) {
    this.reset(); const id = mirrorTransactionId(transactionId);
    if (this.confirmed.includes(id)) return;
    if (this.prepared[id] !== undefined) {
      if (BigInt(this.prepared[id]) !== amount) throw new Error("Prepared payment amount mismatch");
      delete this.prepared[id];
    } else this.spent += amount;
    this.confirmed.push(id); this.save();
  }
  getRemainingDailyBudgetTinybars(): bigint { this.reset(); return this.dailyBudgetTinybars > this.spent ? this.dailyBudgetTinybars - this.spent : 0n; }
}
