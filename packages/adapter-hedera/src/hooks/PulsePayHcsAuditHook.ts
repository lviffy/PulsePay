import { TopicMessageSubmitTransaction, TransactionId } from "@hiero-ledger/sdk";
import { join } from "node:path";
import { AbstractHook, HederaContext, PostSecondaryActionParams } from "../types.js";
import { submit, operator } from "../transactions.js";
import { HederaMirrorClient } from "../mirror.js";
import { readJson, writeJson } from "../storage/json.js";

export interface HcsAuditHookConfig {
  topicId?: string;
  client?: HederaContext["client"];
  onAuditRecord?: (log: any) => void;
  storageDirectory?: string;
  operatorAccountId?: string;
  submitTransaction?: HederaContext["submitTransaction"];
  maxTransactionFeeTinybars?: bigint;
}
interface AuditEntry { id: string; topicId?: string; payload: any; error?: string; transactionId?: string; }

export class PulsePayHcsAuditHook extends AbstractHook {
  readonly name = "PulsePay HCS Audit Hook";
  readonly description = "Persists audit records and reports confirmed or retryable HCS submission.";
  readonly relevantTools = ["x402_pay_tool", "issue_refund_tool"];
  public topicId?: string;
  constructor(private config: HcsAuditHookConfig = {}) { super(); this.topicId = config.topicId; }
  private path(context: HederaContext) { return join(this.config.storageDirectory || context.storageDirectory || ".pulsepay", "audit-pending.json"); }

  override async postToolExecutionHook(params: PostSecondaryActionParams, method: string) {
    if (!this.appliesToMethod(method) || !["SETTLED", "REFUNDED"].includes(params.toolResult.status)) return;
    const context = params.context as HederaContext;
    const topicId = this.topicId || context.auditTopicId;
    const payload = { event: method === "x402_pay_tool" ? "AGENT_PAYMENT_SETTLED" : "AGENT_REFUND_SETTLED", tool: method,
      topicId, result: { ...params.toolResult }, timestamp: Math.floor(Date.now()/1000) };
    const entry: AuditEntry = { id: `${method}:${params.toolResult.transactionId}`, topicId, payload };
    let persisted = false;
    try {
      const pending = readJson<Record<string, AuditEntry>>(this.path(context), {});
      pending[entry.id] = entry; writeJson(this.path(context), pending);
      persisted = true;
      try { this.config.onAuditRecord?.(payload); } catch { /* Observers must not turn a settled payment into a reported failure. */ }
      params.toolResult.audit = await this.deliver(entry, context);
    } catch (error: any) {
      params.toolResult.audit = { status: "PENDING", topicId, persisted, error: error.message, ...(!persisted ? { record: payload } : {}) };
    }
  }
  private async deliver(entry: AuditEntry, context: HederaContext) {
    if (!entry.topicId) throw new Error("HCS audit topic is not configured; record retained for retry");
    if (entry.transactionId) {
      const mirror = context.mirror || new HederaMirrorClient(context.network);
      const receipt = await mirror.transaction(entry.transactionId);
      if (receipt.name !== "CONSENSUSSUBMITMESSAGE" || !await mirror.verifyTopicMessage(entry.topicId, receipt.consensus_timestamp, JSON.stringify(entry.payload))) throw new Error("Prior audit submission is unresolved; no new transaction was sent");
      const pending = readJson<Record<string, AuditEntry>>(this.path(context), {});
      delete pending[entry.id]; writeJson(this.path(context), pending);
      return { status: "CONFIRMED", topicId: entry.topicId, transactionId: receipt.transaction_id, consensusStatus: "SUCCESS" };
    }
    if (!this.config.client && !context.client && !this.config.submitTransaction && !context.submitTransaction) throw new Error("HCS submitter is not configured; record retained for retry");
    const tx = new TopicMessageSubmitTransaction().setTopicId(entry.topicId).setMessage(JSON.stringify(entry.payload));
    tx.setMaxChunks(1);
    const writer: HederaContext = { ...context, client: this.config.client || context.client,
      operatorAccountId: this.config.operatorAccountId || context.operatorAccountId,
      maxTransactionFeeTinybars: this.config.maxTransactionFeeTinybars || context.maxTransactionFeeTinybars,
      submitTransaction: this.config.submitTransaction || context.submitTransaction };
    tx.setTransactionId(TransactionId.generate(operator(writer)));
    entry.transactionId = tx.transactionId!.toString();
    const journal = readJson<Record<string, AuditEntry>>(this.path(context), {});
    journal[entry.id] = entry; writeJson(this.path(context), journal);
    const result = await submit(tx, writer);
    if (result.status === "PREPARED") throw new Error("HCS record has not been submitted");
    const pending = readJson<Record<string, AuditEntry>>(this.path(context), {});
    delete pending[entry.id]; writeJson(this.path(context), pending);
    return { status: "CONFIRMED", topicId: entry.topicId, transactionId: result.transactionId, consensusStatus: result.consensusStatus };
  }
  async retryPending(context: HederaContext = {}) {
    const pending = readJson<Record<string, AuditEntry>>(this.path(context), {});
    const results = [];
    for (const entry of Object.values(pending)) {
      entry.topicId ||= this.topicId || context.auditTopicId;
      try { results.push({ id: entry.id, ...await this.deliver(entry, context) }); }
      catch (error: any) { results.push({ id: entry.id, status: "PENDING", error: error.message }); }
    }
    return results;
  }
}
