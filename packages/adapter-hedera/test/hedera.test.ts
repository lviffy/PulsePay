import assert from "assert";
import { PulsePaySpendLimitPolicy } from "../src/policy/PulsePaySpendLimitPolicy";
import { PulsePayHcsAuditHook, AuditLogMessage } from "../src/hooks/PulsePayHcsAuditHook";
import { X402PayTool } from "../src/tools/X402PayTool";
import { IssueRefundTool } from "../src/tools/IssueRefundTool";
import { PulsePayHederaPlugin } from "../src/plugin";

async function runTests() {
  console.log("=== Hedera Agent Kit v4 Policy & Hook Tests ===");

  // 1. Policy Allowlist Verification
  console.log("\n[Test 1] Spending Policy: Tool Allowlist Check");
  const policy = new PulsePaySpendLimitPolicy({
    maxPerRequestTinybars: 200_000_000n, // 2 HBAR
    dailyBudgetTinybars: 500_000_000n,   // 5 HBAR
    allowedMerchants: ["0.0.987654"],
    allowedTools: ["x402_pay_tool", "issue_refund_tool"],
  });

  // Stage 1: Disallowed tool
  let blocked = false;
  try {
    await policy.validateToolInvocation({ toolName: "unauthorized_transfer_tool" });
  } catch (err: any) {
    blocked = true;
    assert(err.message.includes("is not in the approved allowlist"));
    console.log("  ✓ Correctly rejected unauthorized tool name at Stage 1");
  }
  assert(blocked, "Disallowed tool should have been blocked");

  // Stage 1: Allowed tool
  await policy.validateToolInvocation({ toolName: "x402_pay_tool" });
  console.log("  ✓ Allowed x402_pay_tool passed Stage 1 validation");

  // 2. Policy Merchant Allowlist Check
  console.log("\n[Test 2] Spending Policy: Merchant Allowlist Check");
  blocked = false;
  try {
    await policy.validateToolParameters({
      toolName: "x402_pay_tool",
      params: { merchantAccountId: "0.0.111111", amountTinybars: 50_000_000n },
    });
  } catch (err: any) {
    blocked = true;
    assert(err.message.includes("is not in the approved allowlist"));
    console.log("  ✓ Correctly blocked unapproved merchant account at Stage 3");
  }
  assert(blocked, "Unapproved merchant should have been blocked");

  // 3. Policy Single-Transaction Limit Check
  console.log("\n[Test 3] Spending Policy: Per-Request Amount Limit Check");
  blocked = false;
  try {
    await policy.validateToolParameters({
      toolName: "x402_pay_tool",
      params: { merchantAccountId: "0.0.987654", amountTinybars: 250_000_000n }, // 2.5 HBAR > 2 HBAR limit
    });
  } catch (err: any) {
    blocked = true;
    assert(err.message.includes("exceeds single-transaction limit"));
    console.log("  ✓ Correctly blocked payment exceeding single-request cap");
  }
  assert(blocked, "Exceeding single limit should have been blocked");

  // 4. Policy Daily Budget & Cumulative Tracking Check
  console.log("\n[Test 4] Spending Policy: Daily Budget Tracking");
  // Transaction 1: 1.5 HBAR (allowed)
  await policy.validateToolParameters({
    toolName: "x402_pay_tool",
    params: { merchantAccountId: "0.0.987654", amountTinybars: 150_000_000n },
  });
  console.log("  ✓ Tx 1: 1.5 HBAR approved (Cumulative: 1.5 HBAR / 5.0 HBAR)");

  // Transaction 2: 1.5 HBAR (allowed)
  await policy.validateToolParameters({
    toolName: "x402_pay_tool",
    params: { merchantAccountId: "0.0.987654", amountTinybars: 150_000_000n },
  });
  console.log("  ✓ Tx 2: 1.5 HBAR approved (Cumulative: 3.0 HBAR / 5.0 HBAR)");

  // Transaction 3: 1.5 HBAR (allowed)
  await policy.validateToolParameters({
    toolName: "x402_pay_tool",
    params: { merchantAccountId: "0.0.987654", amountTinybars: 150_000_000n },
  });
  console.log("  ✓ Tx 3: 1.5 HBAR approved (Cumulative: 4.5 HBAR / 5.0 HBAR)");

  // Transaction 4: 1.0 HBAR (Exceeds remaining 0.5 HBAR of 5.0 HBAR budget)
  blocked = false;
  try {
    await policy.validateToolParameters({
      toolName: "x402_pay_tool",
      params: { merchantAccountId: "0.0.987654", amountTinybars: 100_000_000n },
    });
  } catch (err: any) {
    blocked = true;
    assert(err.message.includes("exceeds remaining daily budget"));
    console.log("  ✓ Correctly blocked payment that would exceed daily budget cap (4.5 + 1.0 > 5.0)");
  }
  assert(blocked, "Exceeding daily budget should have been blocked");

  // 5. HCS Audit Hook Test
  console.log("\n[Test 5] HCS Audit Hook: Consensus Event Formatting");
  const recordedLogs: AuditLogMessage[] = [];
  const hook = new PulsePayHcsAuditHook({
    topicId: "0.0.554433",
    onAuditRecord: (log) => recordedLogs.push(log),
  });

  await hook.onToolExecutionSuccess({
    toolName: "x402_pay_tool",
    params: { merchantAccountId: "0.0.987654", amountTinybars: 100_000_000n },
    result: { transactionId: "0.0.123456@1700000000.000000000", status: "SUCCESS" },
  });

  assert.strictEqual(recordedLogs.length, 1);
  assert.strictEqual(recordedLogs[0].status, "SUCCESS");
  assert.strictEqual(recordedLogs[0].toolName, "x402_pay_tool");
  assert.strictEqual(recordedLogs[0].topicId, "0.0.554433");
  console.log("  ✓ Audit event successfully constructed and routed to HCS topic handler:", recordedLogs[0].action);

  // 6. Tool Schemas & Plugin Verification
  console.log("\n[Test 6] PulsePayHederaPlugin Initialization");
  const payTool = new X402PayTool();
  const refundTool = new IssueRefundTool();
  const plugin = new PulsePayHederaPlugin({
    tools: [payTool, refundTool],
    policies: [policy],
    hooks: [hook],
  });

  assert.strictEqual(plugin.name, "pulsepay-hedera-plugin");
  assert.strictEqual(plugin.getTools().length, 2);
  assert.strictEqual(plugin.getTools()[0].name, "x402_pay_tool");
  assert.strictEqual(plugin.getTools()[1].name, "issue_refund_tool");
  console.log("  ✓ Plugin exposes Hedera Agent Kit v4 BaseTools:", plugin.getTools().map(t => t.name).join(", "));

  console.log("\n>>> ALL 6 HEDERA AGENT KIT V4 TESTS PASSED! <<<\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});

