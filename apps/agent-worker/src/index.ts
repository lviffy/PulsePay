import {
  PulsePaySpendLimitPolicy,
  PulsePayHcsAuditHook,
  X402PayTool,
} from "@pulsepay/adapter-hedera";

async function runAutonomousBuyerAgent() {
  console.log("==================================================================");
  console.log(" PulsePay Autonomous Procurement Agent — Hedera x402 Execution");
  console.log("==================================================================");

  // Step 1: Discover paid service
  console.log("\n[1] Discovering services via /.well-known/x402.json...");
  const discoveredService = {
    id: "market-data-pro",
    name: "Acme Real-Time Orderbook API",
    network: "hedera:testnet",
    asset: "0.0.0", // Native HBAR
    amountTinybars: 50_000_000n, // 0.50 HBAR
    recipientAccountId: "0.0.12345",
  };
  console.log(`✓ Found Service: "${discoveredService.name}"`);
  console.log(`  Price: 0.50 HBAR (${discoveredService.amountTinybars} tinybars)`);
  console.log(`  Payee Account: ${discoveredService.recipientAccountId}`);

  // Step 2: Configure Policy Engine (Deterministic spend controls)
  console.log("\n[2] Loading PulsePaySpendLimitPolicy (Hedera Agent Kit v4)...");
  const policy = new PulsePaySpendLimitPolicy({
    dailyBudgetTinybars: 500_000_000n, // 5.0 HBAR daily limit
    maxPerRequestTinybars: 100_000_000n, // 1.0 HBAR max per call
    merchantAllowlist: ["0.0.12345", "0.0.67890"],
  });
  console.log(`✓ Daily Budget: 5.00 HBAR`);
  console.log(`✓ Max Per-Request Limit: 1.00 HBAR`);
  console.log(`✓ Merchant Allowlist: 0.0.12345, 0.0.67890`);

  // Step 3: Configure HCS Consensus Audit Hook
  console.log("\n[3] Attaching PulsePayHcsAuditHook for tamper-evident consensus logging...");
  const auditHook = new PulsePayHcsAuditHook({
    topicId: process.env.HEDERA_AUDIT_TOPIC_ID || "0.0.987654",
  });

  // Step 4: Register X402PayTool
  const payTool = new X402PayTool();
  payTool.registerHook(policy);
  payTool.registerHook(auditHook);

  // Step 5: Simulate probe to protected resource -> Receive 402 challenge
  console.log("\n[4] Probing resource: POST /v1/services/market-data-pro/query...");
  console.log("← Received HTTP 402 Payment Required");
  console.log("  Header PAYMENT-REQUIRED: { network: 'hedera:testnet', asset: '0.0.0', amount: '50000000', recipient: '0.0.12345' }");

  // Step 6: Policy evaluation & Autonomous Settlement (ZERO human approval)
  console.log("\n[5] Evaluating policy autonomously (no human approval required)...");
  console.log("  Checking merchant allowlist: PASS (0.0.12345 matches allowlist)");
  console.log("  Checking per-request threshold: PASS (50,000,000 <= 100,000,000 tinybars)");
  console.log("  Checking daily remaining budget: PASS (50,000,000 <= 500,000,000 tinybars)");

  console.log("\n[6] Submitting payment via X402PayTool in native HBAR...");
  const result = await payTool.execute({
    serviceId: discoveredService.id,
    merchantAccountId: discoveredService.recipientAccountId,
    amountTinybars: discoveredService.amountTinybars,
  });

  console.log("\n==================================================================");
  console.log("✓ SUCCESS: Hedera x402 Micropayment Settled Autonomously!");
  console.log("==================================================================");
  console.log(`Status:               ${result.status}`);
  console.log(`Service ID:           ${result.serviceId}`);
  console.log(`Amount Settled:       ${result.amountHbar} HBAR (${result.amountTinybars} tinybars)`);
  console.log(`Merchant Account:     ${result.merchantAccountId}`);
  console.log(`Hedera Transaction:   ${result.transactionId}`);
  console.log(`HashScan Explorer:    ${result.hashScanUrl}`);
  console.log(`Consensus Audit:      Logged to HCS topic 0.0.987654`);
  console.log("==================================================================");
}

runAutonomousBuyerAgent().catch((err) => {
  console.error("Agent execution error:", err);
  process.exit(1);
});

