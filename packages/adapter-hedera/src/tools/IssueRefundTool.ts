import { z } from "zod";
import { TransferTransaction, Hbar } from "@hiero-ledger/sdk";
import { join } from "node:path";
import { BaseTool, HederaContext } from "../types.js";
import { amountTinybarsSchema, formatHbar, operator, submit } from "../transactions.js";
import { HederaMirrorClient, mirrorTransactionId, transferCredit } from "../mirror.js";
import { readJson, writeJson } from "../storage/json.js";

export const ISSUE_REFUND_TOOL = "issue_refund_tool";
const schema = z.object({
  serviceId: z.string().min(1).max(64),
  agentAccountId: z.string().regex(/^\d+\.\d+\.\d+$/),
  originalTransactionId: z.string().transform(mirrorTransactionId),
  amountTinybars: amountTinybarsSchema,
  reason: z.string().max(256).default("Customer Refund"),
});
export type IssueRefundParams = z.infer<typeof schema>;
interface LedgerEntry { refunded: string; pending?: { amount: string; transactionId?: string }; transactions?: string[]; }

export class IssueRefundTool extends BaseTool {
  readonly method = ISSUE_REFUND_TOOL;
  readonly name = "Issue Refund Tool";
  readonly description = "Refund a verified HBAR payment to its original payer, bounded by its remaining amount.";
  readonly parameters = schema;
  override toolType = "transaction" as const;
  async normalizeParams(params: unknown): Promise<IssueRefundParams> { return schema.parse(params); }
  async coreAction(params: IssueRefundParams, context: HederaContext) {
    const merchant = operator(context);
    const mirror = context.mirror || new HederaMirrorClient(context.network);
    if (mirror.network && mirror.network !== (context.network || "testnet")) throw new Error("Refund mirror network mismatch");
    const original = await mirror.transaction(params.originalTransactionId);
    const payer = original.transaction_id.split("-")[0];
    if (params.agentAccountId !== payer || merchant === payer) throw new Error("Refund must go to the original payer from its merchant");
    const paid = transferCredit(original, merchant);
    if (paid <= 0n || transferCredit(original, payer) >= 0n) throw new Error("Original transaction did not pay this merchant");
    const memo = Buffer.from(original.memo_base64, "base64").toString();
    if (!memo.startsWith("PulsePay x402: ")) throw new Error("Original transaction is not a PulsePay payment");
    const amount = Hbar.fromTinybars(params.amountTinybars.toString());
    const tx = new TransferTransaction().addHbarTransfer(merchant, amount.negated()).addHbarTransfer(payer, amount).setTransactionMemo(`PulsePay Refund: ${params.originalTransactionId}`);
    return { params, tx, paid };
  }
  async secondaryAction({params, tx, paid}: Awaited<ReturnType<IssueRefundTool["coreAction"]>>, _client: unknown, context: HederaContext) {
    const path = join(context.storageDirectory || ".pulsepay", "refunds.json");
    const ledger = readJson<Record<string, LedgerEntry>>(path, {});
    const entry = ledger[params.originalTransactionId] || { refunded: "0" };
    if (entry.pending) throw new Error("Refund is pending reconciliation");
    if (BigInt(entry.refunded) + params.amountTinybars > paid) throw new Error("Refund exceeds remaining original payment amount");
    entry.pending = { amount: params.amountTinybars.toString() }; ledger[params.originalTransactionId] = entry; writeJson(path, ledger);
    let result;
    try { result = await submit(tx, context); }
    catch (error) {
      if (!context.submissionStarted) { delete entry.pending; writeJson(path, ledger); }
      throw error;
    }
    if (result.status !== "PREPARED") {
      entry.refunded = (BigInt(entry.refunded) + params.amountTinybars).toString(); delete entry.pending;
      (entry.transactions ||= []).push(mirrorTransactionId(result.transactionId));
      writeJson(path, ledger);
    } else { entry.pending.transactionId = mirrorTransactionId(result.transactionId); writeJson(path, ledger); }
    return { ...result, status: result.status === "PREPARED" ? "PREPARED" : "REFUNDED", serviceId: params.serviceId,
      agentAccountId: params.agentAccountId, originalTransactionId: params.originalTransactionId,
      amountTinybars: params.amountTinybars.toString(), amountHbar: formatHbar(params.amountTinybars),
      hashScanUrl: result.status === "PREPARED" ? undefined : `https://hashscan.io/${context.network || "testnet"}/transaction/${result.transactionId}`, timestamp: Math.floor(Date.now()/1000) };
  }

  async confirmRefund(originalTransactionId: string, refundTransactionId: string, context: HederaContext) {
    const originalId = mirrorTransactionId(originalTransactionId), refundId = mirrorTransactionId(refundTransactionId);
    const merchant = operator(context), mirror = context.mirror || new HederaMirrorClient(context.network);
    if (mirror.network && mirror.network !== (context.network || "testnet")) throw new Error("Refund mirror network mismatch");
    const original = await mirror.transaction(originalId), refund = await mirror.transaction(refundId);
    const buyer = originalId.split("-")[0];
    const memo = Buffer.from(refund.memo_base64, "base64").toString();
    const amount = transferCredit(refund, buyer);
    if (refundId.split("-")[0] !== merchant || buyer === merchant || memo !== `PulsePay Refund: ${originalId}` || amount <= 0n || transferCredit(original, merchant) < amount) throw new Error("Refund receipt does not match the original payment");
    const path = join(context.storageDirectory || ".pulsepay", "refunds.json");
    const ledger = readJson<Record<string, LedgerEntry>>(path, {});
    const entry = ledger[originalId] || { refunded: "0" };
    if (!entry.transactions?.includes(refundId)) {
      if (entry.pending?.transactionId && entry.pending.transactionId !== refundId) throw new Error("A different refund is pending");
      if (entry.pending && BigInt(entry.pending.amount) !== amount) throw new Error("Refund amount differs from its reservation");
      if (BigInt(entry.refunded) + amount > transferCredit(original, merchant)) throw new Error("Refund exceeds original payment");
      entry.refunded = (BigInt(entry.refunded) + amount).toString(); delete entry.pending;
      (entry.transactions ||= []).push(refundId); ledger[originalId] = entry; writeJson(path, ledger);
    }
    return { status: "REFUNDED", transactionId: refundId, originalTransactionId: originalId, agentAccountId: buyer, amountTinybars: amount.toString(), consensusStatus: "SUCCESS" };
  }
}
