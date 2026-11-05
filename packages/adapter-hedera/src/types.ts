import { Client } from "@hashgraph/sdk";

export interface HederaContext {
  client?: Client;
  operatorAccountId?: string;
  auditTopicId?: string;
  metadata?: Record<string, unknown>;
}

export interface PreToolExecutionParams {
  context: HederaContext;
  rawParams: Record<string, any>;
  client?: Client;
}

export interface PostParamsNormalizationParams {
  context: HederaContext;
  rawParams: Record<string, any>;
  normalisedParams: Record<string, any>;
  client?: Client;
}

export interface PostSecondaryActionParams {
  context: HederaContext;
  toolResult: any;
  client?: Client;
}

export abstract class AbstractHook {
  abstract name: string;
  abstract description?: string;
  abstract relevantTools: string[];

  async preToolExecutionHook(_params: PreToolExecutionParams, _method: string): Promise<any> {}
  async postParamsNormalizationHook(_params: PostParamsNormalizationParams, _method: string): Promise<any> {}
  async postToolExecutionHook(_params: PostSecondaryActionParams, _method: string): Promise<any> {}
}

export abstract class AbstractPolicy extends AbstractHook {
  protected shouldBlockPreToolExecution(_params: PreToolExecutionParams, _method: string): boolean | Promise<boolean> {
    return false;
  }

  protected shouldBlockPostParamsNormalization(_params: PostParamsNormalizationParams, _method: string): boolean | Promise<boolean> {
    return false;
  }

  override async preToolExecutionHook(params: PreToolExecutionParams, method: string): Promise<any> {
    const shouldBlock = await this.shouldBlockPreToolExecution(params, method);
    if (shouldBlock) {
      throw new Error(`[Policy Blocked] ${this.name} rejected tool execution before invocation.`);
    }
  }

  override async postParamsNormalizationHook(params: PostParamsNormalizationParams, method: string): Promise<any> {
    const shouldBlock = await this.shouldBlockPostParamsNormalization(params, method);
    if (shouldBlock) {
      throw new Error(`[Policy Blocked] ${this.name} rejected tool execution after parameters validation.`);
    }
  }
}

export interface Tool {
  method: string;
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context?: HederaContext) => Promise<any>;
}

export abstract class BaseTool implements Tool {
  abstract method: string;
  abstract name: string;
  abstract description: string;
  abstract parameters: any;

  protected hooks: AbstractHook[] = [];

  public registerHook(hook: AbstractHook) {
    this.hooks.push(hook);
  }

  abstract normalizeParams(rawParams: any, context: HederaContext): Promise<any>;
  abstract coreAction(normalisedParams: any, context: HederaContext): Promise<any>;
  abstract secondaryAction(coreResult: any, context: HederaContext): Promise<any>;

  async execute(rawParams: any, context: HederaContext = {}): Promise<any> {
    // Stage 1: Pre-tool execution hooks & policies
    for (const hook of this.hooks) {
      await hook.preToolExecutionHook({ context, rawParams, client: context.client }, this.method);
    }

    // Stage 2: Normalization
    const normalisedParams = await this.normalizeParams(rawParams, context);

    // Stage 3: Post-params normalization hooks & policies
    for (const hook of this.hooks) {
      await hook.postParamsNormalizationHook(
        { context, rawParams, normalisedParams, client: context.client },
        this.method
      );
    }

    // Stage 4: Core action
    const coreResult = await this.coreAction(normalisedParams, context);

    // Stage 6: Secondary action (execution / submission)
    const toolResult = await this.secondaryAction(coreResult, context);

    // Stage 7: Post-tool execution hooks
    for (const hook of this.hooks) {
      await hook.postToolExecutionHook({ context, toolResult, client: context.client }, this.method);
    }

    return toolResult;
  }
}

export interface Plugin {
  name: string;
  version?: string;
  description?: string;
  tools: (context: HederaContext) => Tool[];
}

