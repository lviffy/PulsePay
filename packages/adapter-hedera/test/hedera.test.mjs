import assert from "assert";
import { PulsePaySpendLimitPolicy } from "../dist/policy/PulsePaySpendLimitPolicy.js";
import { PulsePayHcsAuditHook } from "../dist/hooks/PulsePayHcsAuditHook.js";
import { X402PayTool } from "../dist/tools/X402PayTool.js";
import { IssueRefundTool } from "../dist/tools/IssueRefundTool.js";
import { PulsePayHederaPlugin } from "../dist/plugin.js";

async function runTests() {
  console.log("=== Hedera Agent Kit v4 Policy & Hook Tests ===");

  // 1. Policy Allowlist Verification (Stage 1 preToolExecutionHook)
  console.log("\n[Test 1] Spending Policy: Tool Allowlist Check (Stage 1)");
  const policy = new PulsePaySpendLimitPolicy({
    maxPerRequestTinybars: 200_000_000n, // 2 HBAR
    dailyBudgetTinybars: 500_000_000n,   // 5 HBAR
    merchantAllowlist: ["0.0.987654"],
    allowedTools: ["x402_pay_tool", "issue_refund_tool"],
  });

  // Stage 1: Disallowed tool
  let blocked = false;
  try {
    await policy.preToolExecutionHook({ context: {}, rawParams: {} }, "unauthorized_transfer_tool");
  } catch (err) {
    blocked = true;
    assert(err.message.includes("is not in the approved allowlist"), "Unexpected message: " + err.message);
    console.log("  ✓ Correctly rejected unauthorized tool name at Stage 1");
  }
  assert(blocked, "Disallowed tool should have been blocked");

  // Stage 1: Allowed tool
  await policy.preToolExecutionHook({ context: {}, rawParams: {} }, "x402_pay_tool");
  console.log("  ✓ Allowed x402_pay_tool passed Stage 1 validation");

  // 2. Policy Merchant Allowlist Check (Stage 3 postParamsNormalizationHook)
  console.log("\n[Test 2] Spending Policy: Merchant Allowlist Check (Stage 3)");
  blocked = false;
  try {
    await policy.postParamsNormalizationHook(
      {
        context: {},
        rawParams: {},
        normalisedParams: { merchantAccountId: "0.0.111111", amountTinybars: 50_000_000n },
      },
      "x402_pay_tool"
    );
  } catch (err) {
    blocked = true;
    assert(err.message.includes("is not on the authorized merchant allowlist"), "Unexpected error: " + err.message);
    console.log("  ✓ Correctly blocked unapproved merchant account at Stage 3");
  }
  assert(blocked, "Unapproved merchant should have been blocked");

  // 3. Policy Single-Transaction Limit Check (Stage 3)
  console.log("\n[Test 3] Spending Policy: Per-Request Amount Limit Check (Stage 3)");
  blocked = false;
  try {
    await policy.postParamsNormalizationHook(
      {
        context: {},
        rawParams: {},
        normalisedParams: { merchantAccountId: "0.0.987654", amountTinybars: 250_000_000n }, // 2.5 HBAR > 2 HBAR limit
      },
      "x402_pay_tool"
    );
  } catch (err) {
    blocked = true;
    assert(err.message.includes("exceeds maximum per-request limit"), "Unexpected error: " + err.message);
    console.log("  ✓ Correctly blocked payment exceeding single-request cap");
  }
  assert(blocked, "Exceeding single limit should have been blocked");

  // 4. Policy Daily Budget & Cumulative Tracking Check (Stage 3)
  console.log("\n[Test 4] Spending Policy: Daily Budget Tracking");
  // Transaction 1: 1.5 HBAR (allowed)
  await policy.postParamsNormalizationHook(
    {
      context: {},
      rawParams: {},
      normalisedParams: { merchantAccountId: "0.0.987654", amountTinybars: 150_000_000n },
    },
    "x402_pay_tool"
  );
  console.log("  ✓ Tx 1: 1.5 HBAR approved (Remaining: 3.5 HBAR / 5.0 HBAR)");

  // Transaction 2: 1.5 HBAR (allowed)
  await policy.postParamsNormalizationHook(
    {
      context: {},
      rawParams: {},
      normalisedParams: { merchantAccountId: "0.0.987654", amountTinybars: 150_000_000n },
    },
    "x402_pay_tool"
  );
  console.log("  ✓ Tx 2: 1.5 HBAR approved (Remaining: 2.0 HBAR / 5.0 HBAR)");

  // Transaction 3: 1.5 HBAR (allowed)
  await policy.postParamsNormalizationHook(
    {
      context: {},
      rawParams: {},
      normalisedParams: { merchantAccountId: "0.0.987654", amountTinybars: 150_000_000n },
    },
    "x402_pay_tool"
  );
  console.log("  ✓ Tx 3: 1.5 HBAR approved (Remaining: 0.5 HBAR / 5.0 HBAR)");

  // Transaction 4: 1.0 HBAR (Exceeds remaining 0.5 HBAR of 5.0 HBAR budget)
  blocked = false;
  try {
    await policy.postParamsNormalizationHook(
      {
        context: {},
        rawParams: {},
        normalisedParams: { merchantAccountId: "0.0.987654", amountTinybars: 100_000_000n },
      },
      "x402_pay_tool"
    );
  } catch (err) {
    blocked = true;
    assert(err.message.includes("exceeds remaining daily budget"), "Unexpected error: " + err.message);
    console.log("  ✓ Correctly blocked payment that would exceed daily budget cap (4.5 + 1.0 > 5.0)");
  }
  assert(blocked, "Exceeding daily budget should have been blocked");

  // 5. HCS Audit Hook Test (Stage 7 postToolExecutionHook)
  console.log("\n[Test 5] HCS Audit Hook: Consensus Event Formatting (Stage 7)");
  const recordedLogs = [];
  const hook = new PulsePayHcsAuditHook({
    topicId: "0.0.554433",
    onAuditRecord: (log) => recordedLogs.push(log),
  });

  await hook.postToolExecutionHook(
    {
      context: { auditTopicId: "0.0.554433" },
      toolResult: { transactionId: "0.0.123456@1700000000.000000000", status: "SUCCESS" },
    },
    "x402_pay_tool"
  );

  assert.strictEqual(recordedLogs.length, 1);
  assert.strictEqual(recordedLogs[0].event, "AGENT_PAYMENT_SETTLED");
  assert.strictEqual(recordedLogs[0].tool, "x402_pay_tool");
  assert.strictEqual(recordedLogs[0].topicId, "0.0.554433");
  console.log("  ✓ Stage 7 Audit event recorded for topic:", recordedLogs[0].topicId, "event:", recordedLogs[0].event);

  // 6. Tool Schemas & Plugin Verification
  console.log("\n[Test 6] PulsePayHederaPlugin Initialization");
  const plugin = new PulsePayHederaPlugin();
  const tools = plugin.tools({});

  assert.strictEqual(plugin.name, "pulsepay-hedera-plugin");
  assert.strictEqual(tools.length, 2);
  assert.strictEqual(tools[0].method, "x402_pay_tool");
  assert.strictEqual(tools[1].method, "issue_refund_tool");
  console.log("  ✓ Plugin successfully registered BaseTools:", tools.map(t => t.method).join(", "));

  console.log("\n=======================================================");
  console.log(">>> ALL 6 HEDERA AGENT KIT V4 INTEGRATION TESTS PASSED! <<<");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
