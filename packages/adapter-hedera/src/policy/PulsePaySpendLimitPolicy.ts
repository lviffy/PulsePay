import { AbstractPolicy, PreToolExecutionParams, PostParamsNormalizationParams } from "../types.js";

export interface SpendPolicyConfig {
  dailyBudgetTinybars: bigint;
  maxPerRequestTinybars: bigint;
  merchantAllowlist?: string[];
  allowedTools?: string[];
}

/**
 * @title PulsePaySpendLimitPolicy
 * @notice Hedera Agent Kit v4 Policy extending AbstractPolicy.
 * Enforces per-request limits, daily spending budgets, and merchant account allowlists
 * at Stage 1 & Stage 3 of the BaseTool lifecycle before any transaction can be signed.
 */
export class PulsePaySpendLimitPolicy extends AbstractPolicy {
  public readonly name = "PulsePay Spend Limit Policy";
  public readonly description = "Enforces per-request and daily spending limits and merchant allowlists for Hedera agents.";
  public override relevantTools: string[];

  public dailyBudgetTinybars: bigint;
  public maxPerRequestTinybars: bigint;
  public merchantAllowlist: Set<string>;

  private dailySpentTinybars: bigint = 0n;
  private lastResetDay: number = new Date().getUTCDate();

  constructor(config: SpendPolicyConfig) {
    super();
    this.dailyBudgetTinybars = config.dailyBudgetTinybars;
    this.maxPerRequestTinybars = config.maxPerRequestTinybars;
    this.merchantAllowlist = new Set(config.merchantAllowlist || []);
    this.relevantTools = config.allowedTools || ["x402_pay_tool", "transfer_hbar_tool"];
  }

  private resetDailyBudgetIfNewDay() {
    const currentDay = new Date().getUTCDate();
    if (currentDay !== this.lastResetDay) {
      this.dailySpentTinybars = 0n;
      this.lastResetDay = currentDay;
    }
  }

  protected override shouldBlockPreToolExecution(
    _params: PreToolExecutionParams,
    method: string
  ): boolean {
    if (this.relevantTools.length > 0 && !this.relevantTools.includes(method)) {
      throw new Error(
        `[SpendPolicy Violation] Tool "${method}" is not in the approved allowlist.`
      );
    }
    return false;
  }

  protected override shouldBlockPostParamsNormalization(
    params: PostParamsNormalizationParams,
    method: string
  ): boolean {
    if (!this.relevantTools.includes(method)) return false;

    this.resetDailyBudgetIfNewDay();

    const { normalisedParams } = params;
    const recipient = normalisedParams.merchantAccountId || normalisedParams.toAccountId;
    const amountTinybars: bigint = BigInt(normalisedParams.amountTinybars || 0);

    // Check 1: Merchant Allowlist
    if (this.merchantAllowlist.size > 0 && recipient && !this.merchantAllowlist.has(recipient)) {
      throw new Error(
        `[SpendPolicy Violation] Merchant account "${recipient}" is not on the authorized merchant allowlist.`
      );
    }

    // Check 2: Max Per-Request Limit
    if (this.maxPerRequestTinybars > 0n && amountTinybars > this.maxPerRequestTinybars) {
      throw new Error(
        `[SpendPolicy Violation] Requested spend of ${amountTinybars} tinybars exceeds maximum per-request limit of ${this.maxPerRequestTinybars} tinybars.`
      );
    }

    // Check 3: Daily Budget
    if (this.dailyBudgetTinybars > 0n && this.dailySpentTinybars + amountTinybars > this.dailyBudgetTinybars) {
      const remaining = this.dailyBudgetTinybars - this.dailySpentTinybars;
      throw new Error(
        `[SpendPolicy Violation] Requested spend of ${amountTinybars} tinybars exceeds remaining daily budget of ${remaining} tinybars (Daily Budget: ${this.dailyBudgetTinybars} tinybars).`
      );
    }

    // If passed, track cumulative spend
    this.dailySpentTinybars += amountTinybars;
    return false;
  }

  public getRemainingDailyBudgetTinybars(): bigint {
    this.resetDailyBudgetIfNewDay();
    return this.dailyBudgetTinybars > this.dailySpentTinybars
      ? this.dailyBudgetTinybars - this.dailySpentTinybars
      : 0n;
  }
}

