import { Client, Transaction } from "@hiero-ledger/sdk";
import { BaseTool as KitBaseTool, AbstractHook, AbstractPolicy, AgentMode } from "@hashgraph/hedera-agent-kit";
import type { Context, Plugin, Tool, PreToolExecutionParams, PostParamsNormalizationParams, PostSecondaryActionParams } from "@hashgraph/hedera-agent-kit";
import type { HederaMirrorClient } from "./mirror.js";

export { AbstractHook, AbstractPolicy, AgentMode };
export type { Plugin, Tool, PreToolExecutionParams, PostParamsNormalizationParams, PostSecondaryActionParams };

export interface HederaContext extends Context {
  client?: Client;
  operatorAccountId?: string;
  auditTopicId?: string;
  network?: "testnet" | "mainnet";
  mirror?: HederaMirrorClient;
  maxTransactionFeeTinybars?: bigint;
  storageDirectory?: string;
  submitTransaction?: (tx: Transaction) => Promise<{ transactionId: string; consensusStatus: string }>;
  executionId?: object;
  submissionStarted?: boolean;
}

/** Accept both the SDK API and the official Agent Kit (client, context, params) call. */
export abstract class BaseTool extends KitBaseTool {
  private registeredHooks: AbstractHook[] = [];
  protected defaultContext: HederaContext;
  constructor(context: HederaContext = {}) { super(); this.defaultContext = context; }
  registerHook(hook: AbstractHook) { this.registeredHooks.push(hook); }
  override async execute(first: any, second: HederaContext = {}, third?: any): Promise<any> {
    const kitCall = third !== undefined;
    const context: HederaContext = { ...this.defaultContext, ...second, executionId: {}, submissionStarted: false };
    const supplied = [...(this.defaultContext.hooks || []), ...(second.hooks || []), ...this.registeredHooks];
    context.hooks = [...new Set(supplied)];
    const client = kitCall ? first as Client : context.client;
    context.client = client;
    context.operatorAccountId ||= context.accountId || client?.operatorAccountId?.toString();
    context.accountId ||= context.operatorAccountId;
    try {
      return await super.execute(client as Client, context, kitCall ? third : first);
    } catch (error) {
      for (const hook of context.hooks) {
        if ("executionFailed" in hook && typeof hook.executionFailed === "function") hook.executionFailed(context);
      }
      throw error;
    }
  }
  override async handleError(error: unknown): Promise<never> { throw error; }
}
