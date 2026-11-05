import { Hbar, Transaction, TransactionId, AccountId, ReceiptStatusError, PrecheckStatusError } from "@hiero-ledger/sdk";
import { z } from "zod";
import { AgentMode, HederaContext } from "./types.js";

export const amountTinybarsSchema = z.union([z.string().regex(/^\d+$/), z.bigint(), z.number().int().safe()])
  .transform(value => BigInt(value)).refine(value => value > 0n && value <= 9223372036854775807n, "Amount must be a positive int64 tinybar integer");

export function formatHbar(amount: bigint): string {
  return `${amount / 100000000n}.${(amount % 100000000n).toString().padStart(8, "0")}`;
}

export function operator(context: HederaContext): string {
  const id = context.operatorAccountId || context.accountId || context.client?.operatorAccountId?.toString();
  if (!id || !/^\d+\.\d+\.\d+$/.test(id)) throw new Error("A Hedera operator account is required; simulation is disabled");
  return id;
}

export async function submit(tx: Transaction, context: HederaContext): Promise<any> {
  if (context.client?.ledgerId && context.client.ledgerId.toString() !== (context.network || "testnet")) throw new Error("Client network does not match the configured Hedera network");
  const maxFee = context.maxTransactionFeeTinybars ?? 1000000n;
  if (maxFee <= 0n) throw new Error("Transaction fee cap must be positive");
  tx.setMaxTransactionFee(Hbar.fromTinybars(maxFee.toString()));
  if (context.mode === AgentMode.RETURN_BYTES) {
    if (!tx.transactionId) tx.setTransactionId(TransactionId.generate(operator(context)));
    tx.setNodeAccountIds([AccountId.fromString("0.0.3")]).freeze();
    return { status: "PREPARED", bytes: Buffer.from(tx.toBytes()).toString("base64"), transactionId: tx.transactionId!.toString() };
  }
  if (!context.submitTransaction && !context.client) throw new Error("A Hedera client or wallet submitter is required; simulation is disabled");
  context.submissionStarted = true;
  if (context.submitTransaction) {
    const result = await context.submitTransaction(tx);
    if (result.consensusStatus !== "SUCCESS") { context.submissionStarted = false; throw new Error(`Transaction failed: ${result.consensusStatus}`); }
    return result;
  }
  try {
    const response = await tx.execute(context.client!);
    const receipt = await response.getReceipt(context.client!);
    if (receipt.status.toString() !== "SUCCESS") { context.submissionStarted = false; throw new Error(`Transaction failed: ${receipt.status}`); }
    return { transactionId: response.transactionId.toString(), consensusStatus: receipt.status.toString(), topicId: receipt.topicId?.toString() };
  } catch (error) {
    if (error instanceof ReceiptStatusError || (error instanceof PrecheckStatusError && error.status.toString() !== "DUPLICATE_TRANSACTION")) context.submissionStarted = false;
    throw error;
  }
}
