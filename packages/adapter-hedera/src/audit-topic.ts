import { PublicKey, TopicCreateTransaction, TransactionId } from "@hiero-ledger/sdk";
import { join } from "node:path";
import { AgentMode, HederaContext } from "./types.js";
import { operator, submit } from "./transactions.js";
import { HederaMirrorClient } from "./mirror.js";
import { readJson, writeJson } from "./storage/json.js";

interface TopicState { status: "PENDING" | "PREPARED" | "CONFIRMED"; transactionId: string; topicId?: string; }
function statePath(context: HederaContext) {
  return join(context.storageDirectory || ".pulsepay", `${context.network || "testnet"}-${operator(context)}-audit-topic.json`);
}

export function getConfiguredAuditTopic(context: HederaContext): string | undefined {
  return readJson<TopicState | null>(statePath(context), null)?.topicId;
}

/** Reconcile against consensus, never a wallet-request timeout or expired signing-status response. */
export async function reconcileAuditTopic(transactionId: string, context: HederaContext) {
  const mirror = context.mirror || new HederaMirrorClient(context.network);
  if (mirror.network && mirror.network !== (context.network || "testnet")) throw new Error("Topic mirror network mismatch");
  const record = await mirror.transaction(transactionId);
  if (record.name !== "CONSENSUSCREATETOPIC" || !record.entity_id || record.transaction_id.split("-")[0] !== operator(context)) throw new Error("Receipt is not an audit topic creation by this operator");
  const topic = await mirror.topic(record.entity_id);
  const key = context.accountPublicKey || context.client?.operatorPublicKey?.toStringRaw();
  if (topic.memo !== "PulsePay Audit Log" || !key || topic.admin_key?.key !== key || topic.submit_key?.key !== key) throw new Error("Topic memo or access keys do not match this operator");
  const state: TopicState = { status: "CONFIRMED", topicId: record.entity_id, transactionId: record.transaction_id };
  writeJson(statePath(context), state);
  return state;
}

/** A persistent creation journal prevents duplicate paid retries after lost wallet acknowledgments. */
export async function createAuditTopic(context: HederaContext) {
  const existing = readJson<TopicState | null>(statePath(context), null);
  if (existing?.status === "CONFIRMED") return { ...existing, status: "EXISTING" };
  if (existing) {
    try { return { ...await reconcileAuditTopic(existing.transactionId, context), status: "EXISTING" }; }
    catch { throw new Error(`Prior topic creation ${existing.transactionId} is unresolved. Reconcile its ledger record before any new creation; a wallet timeout is not proof of failure.`); }
  }
  if (!context.maxTransactionFeeTinybars) throw new Error("Estimate the topic fee and provide an explicit creation fee cap");
  const key = context.accountPublicKey ? PublicKey.fromString(context.accountPublicKey) : context.client?.operatorPublicKey;
  if (!key) throw new Error("Merchant public key is required to secure the audit topic");
  if (context.mode !== AgentMode.RETURN_BYTES && !context.client && !context.submitTransaction) throw new Error("A client or wallet submitter is required");
  const tx = new TopicCreateTransaction().setTopicMemo("PulsePay Audit Log").setAdminKey(key).setSubmitKey(key).setAutoRenewPeriod(2592000)
    .setTransactionId(TransactionId.generate(operator(context)));
  const state: TopicState = { status: "PENDING", transactionId: tx.transactionId!.toString() };
  writeJson(statePath(context), state);
  const result = await submit(tx, context);
  if (result.status === "PREPARED") writeJson(statePath(context), { ...state, status: "PREPARED", transactionId: result.transactionId });
  else await reconcileAuditTopic(result.transactionId, context);
  return result;
}
