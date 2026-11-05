import { Plugin, HederaContext, Tool } from "./types.js";
import { X402PayTool } from "./tools/X402PayTool.js";
import { IssueRefundTool } from "./tools/IssueRefundTool.js";

/**
 * @title PulsePayHederaPlugin
 * @notice Hedera Agent Kit v4 Plugin providing autonomous x402 payment and refund tools.
 */
export class PulsePayHederaPlugin implements Plugin {
  public readonly name = "pulsepay-hedera-plugin";
  public readonly version = "1.0.0";
  public readonly description = "PulsePay agentic payment and refund tools for Hedera Agent Kit.";

  public tools(_context: HederaContext): Tool[] {
    return [new X402PayTool(), new IssueRefundTool()];
  }
}

