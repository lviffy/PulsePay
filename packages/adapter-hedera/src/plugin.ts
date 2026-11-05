import { Plugin, HederaContext, Tool } from "./types.js";
import { X402PayTool } from "./tools/X402PayTool.js";
import { IssueRefundTool } from "./tools/IssueRefundTool.js";

export class PulsePayHederaPlugin implements Plugin {
  readonly name = "pulsepay-hedera-plugin";
  readonly version = "1.0.0";
  readonly description = "Native HBAR payments, verified refunds, spend policies and HCS audit support.";
  tools(context: HederaContext): Tool[] { return [new X402PayTool(context), new IssueRefundTool(context)]; }
}
