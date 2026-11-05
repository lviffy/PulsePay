import { TopicMessageSubmitTransaction, Client } from "@hashgraph/sdk";
import { AbstractHook, PostSecondaryActionParams } from "../types.js";

export interface HcsAuditHookConfig {
  topicId?: string;
  client?: Client;
  onAuditRecord?: (log: any) => void;
}

/**
 * @title PulsePayHcsAuditHook
 * @notice Hedera Agent Kit v4 Hook extending AbstractHook.
 * Observes executed payments and refunds at Stage 7 of the BaseTool lifecycle,
 * submitting tamper-evident consensus audit logs directly to the merchant's HCS topic.
 */
export class PulsePayHcsAuditHook extends AbstractHook {
  public readonly name = "PulsePay HCS Audit Hook";
  public readonly description = "Writes tamper-evident audit logs to Hedera Consensus Service (HCS) after tool execution.";
  public readonly relevantTools = ["x402_pay_tool", "issue_refund_tool"];

  public topicId?: string;
  private client?: Client;
  private onAuditRecord?: (log: any) => void;

  constructor(config?: HcsAuditHookConfig) {
    super();
    this.topicId = config?.topicId;
    this.client = config?.client;
    this.onAuditRecord = config?.onAuditRecord;
  }

  override async postToolExecutionHook(params: PostSecondaryActionParams, method: string): Promise<any> {
    if (!this.relevantTools.includes(method)) return;

    const topicId = this.topicId || params.context.auditTopicId;
    const client = this.client || params.context.client;

    const auditPayload = {
      event: method === "x402_pay_tool" ? "AGENT_PAYMENT_SETTLED" : "AGENT_REFUND_SETTLED",
      tool: method,
      topicId: topicId || "default-topic",
      result: params.toolResult,
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (this.onAuditRecord) {
      this.onAuditRecord(auditPayload);
    }

    if (topicId && client) {
      try {
        const messageString = JSON.stringify(auditPayload);
        const tx = await new TopicMessageSubmitTransaction()
          .setTopicId(topicId)
          .setMessage(messageString)
          .execute(client);

        const receipt = await tx.getReceipt(client);
        console.log(
          `[HCS Audit] Message submitted to topic ${topicId}. Status: ${receipt.status.toString()}, TxId: ${tx.transactionId.toString()}`
        );
      } catch (err) {
        console.warn(`[HCS Audit Warning] Failed to submit message to HCS topic ${topicId}:`, err);
      }
    } else {
      console.log(`[HCS Audit Local Log] No topic ID or client configured:`, auditPayload);
    }
  }
}

