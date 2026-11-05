import { PulsePaySpendLimitPolicy } from "../src/policy/PulsePaySpendLimitPolicy.ts";
import { PulsePayHcsAuditHook } from "../src/hooks/PulsePayHcsAuditHook.ts";
import { X402PayTool } from "../src/tools/X402PayTool.ts";
import { IssueRefundTool } from "../src/tools/IssueRefundTool.ts";

async function runTests() {
  console.log("--- Running Hedera Adapter & Agent Kit v4 Tests ---");

  const policy = new PulsePaySpendLimitPolicy({
    dailyBudgetTinybars: 500_000_000n, // 5 HBAR daily budget
    maxPerRequestTinybars: 100_000_000n, // 1 HBAR max per request
    merchantAllowlist: ["0.0.12345", "0.0.67890"],
  });

  const auditHook = new PulsePayHcsAuditHook({
    topicId: "0.0.99999",
  });

  const payTool = new X402PayTool();
  payTool.registerHook(policy);
  payTool.registerHook(auditHook);

  // Test 1: Successful payment within policy
  console.log("Test 1: Normal payment within limit & allowlist...");
  const res1 = await payTool.execute({
    serviceId: "market-data-pro",
    merchantAccountId: "0.0.12345",
    amountTinybars: 50_000_000n, // 0.5 HBAR
  });
  if (res1.status !== "SETTLED") throw new Error("Test 1 Failed: Status not SETTLED");
  console.log("✓ Test 1 Passed: Settled with TxId", res1.transactionId);

  // Test 2: Blocking non-allowlisted merchant
  console.log("Test 2: Blocking non-allowlisted merchant...");
  let blockedAllowlist = false;
  try {
    await payTool.execute({
      serviceId: "unknown-api",
      merchantAccountId: "0.0.99999", // not in allowlist
      amountTinybars: 10_000_000n,
    });
  } catch (err: any) {
    if (err.message.includes("is not on the authorized merchant allowlist")) {
      blockedAllowlist = true;
    } else {
      throw err;
    }
  }
  if (!blockedAllowlist) throw new Error("Test 2 Failed: Did not block non-allowlisted merchant");
  console.log("✓ Test 2 Passed: Successfully blocked unauthorized merchant");

  // Test 3: Blocking exceeding per-request limit
  console.log("Test 3: Blocking exceeding per-request limit...");
  let blockedPerRequest = false;
  try {
    await payTool.execute({
      serviceId: "expensive-gpu",
      merchantAccountId: "0.0.12345",
      amountTinybars: 150_000_000n, // 1.5 HBAR > 1 HBAR limit
    });
  } catch (err: any) {
    if (err.message.includes("exceeds maximum per-request limit")) {
      blockedPerRequest = true;
    } else {
      throw err;
    }
  }
  if (!blockedPerRequest) throw new Error("Test 3 Failed: Did not block oversized request");
  console.log("✓ Test 3 Passed: Successfully blocked request exceeding cap");

  // Test 4: Refund Tool execution
  console.log("Test 4: Issue refund tool execution...");
  const refundTool = new IssueRefundTool();
  refundTool.registerHook(auditHook);
  const refundRes = await refundTool.execute({
    serviceId: "market-data-pro",
    agentAccountId: "0.0.55555",
    originalTransactionId: res1.transactionId,
    amountTinybars: 50_000_000n,
    reason: "API downtime credit",
  });
  if (refundRes.status !== "REFUNDED") throw new Error("Test 4 Failed: Status not REFUNDED");
  console.log("✓ Test 4 Passed: Refund executed with TxId", refundRes.transactionId);

  console.log("\n All Hedera Agent Kit v4 tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

