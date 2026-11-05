import { z } from "zod";
import { createHash } from "node:crypto";
import { TransferTransaction, Hbar } from "@hiero-ledger/sdk";
import { BaseTool, HederaContext } from "../types.js";
import { amountTinybarsSchema, formatHbar, operator, submit } from "../transactions.js";

export const X402_PAY_TOOL = "x402_pay_tool";
const schema = z.object({
  serviceId: z.string().min(1).max(64),
  merchantAccountId: z.string().regex(/^\d+\.\d+\.\d+$/),
  amountTinybars: amountTinybarsSchema,
  paymentChallengeUrl: z.url().optional(),
  challengeId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});
export type X402PayParams = z.infer<typeof schema>;

export class X402PayTool extends BaseTool {
  readonly method = X402_PAY_TOOL;
  readonly name = "x402 Pay Tool";
  readonly description = "Settle a native HBAR payment; requires a client or wallet submitter.";
  readonly parameters = schema;
  override toolType = "transaction" as const;
  async normalizeParams(params: unknown): Promise<X402PayParams> { return schema.parse(params); }
  async coreAction(params: X402PayParams, context: HederaContext) {
    const sender = operator(context);
    if (sender === params.merchantAccountId) throw new Error("Payment sender and recipient must be different accounts");
    const amount = Hbar.fromTinybars(params.amountTinybars.toString());
    const memo = params.challengeId ? `PulsePay x402: ${createHash("sha256").update(params.challengeId).digest("hex").slice(0, 32)}` : `PulsePay x402: ${params.serviceId}`;
    if (Buffer.byteLength(memo) > 100) throw new Error("Transaction memo exceeds 100 bytes");
    const tx = new TransferTransaction().addHbarTransfer(sender, amount.negated()).addHbarTransfer(params.merchantAccountId, amount).setTransactionMemo(memo);
    return { params, tx };
  }
  async secondaryAction({params, tx}: Awaited<ReturnType<X402PayTool["coreAction"]>>, _client: unknown, context: HederaContext) {
    const result = await submit(tx, context);
    return { ...result, status: result.status === "PREPARED" ? "PREPARED" : "SETTLED", serviceId: params.serviceId,
      merchantAccountId: params.merchantAccountId, amountTinybars: params.amountTinybars.toString(), amountHbar: formatHbar(params.amountTinybars),
      hashScanUrl: result.status === "PREPARED" ? undefined : `https://hashscan.io/${context.network || "testnet"}/transaction/${result.transactionId}`, timestamp: Math.floor(Date.now()/1000) };
  }
}
