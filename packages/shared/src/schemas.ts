import { z } from "zod";

export const CreateInvoiceSchema = z.object({
  invoiceId: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Must be bytes32 hex string"),
  customer: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid customer address")
    .optional(),
  amountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/, "Valid USDT decimal string"),
  dueInSeconds: z.number().int().positive().default(86400),
  description: z.string().max(256).optional(),
});

export const IssueRefundSchema = z.object({
  invoiceId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  amountUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
  reason: z.string().max(256).default("Customer Request"),
});

export const CreatePlanSchema = z.object({
  planId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  name: z.string().min(1).max(100),
  amountUsdtPerCycle: z.string().regex(/^\d+(\.\d{1,6})?$/),
  intervalDays: z.number().int().positive().default(30),
  maxCycles: z.number().int().nonnegative().default(12),
});

export const AgentPolicySchema = z.object({
  dailyBudgetHbar: z.number().positive(),
  maxPerRequestHbar: z.number().positive(),
  merchantAllowlist: z.array(z.string().regex(/^\d+\.\d+\.\d+$/)),
  humanApprovalThresholdHbar: z.number().positive().optional(),
  enabled: z.boolean().default(true),
});

export const TreasurySwapQuoteSchema = z.object({
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string(),
  slippageTolerancePercent: z.number().positive().max(10).default(0.5),
});

