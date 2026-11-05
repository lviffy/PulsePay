import { Client } from "@hiero-ledger/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { AgentMode, HederaMirrorClient, PulsePaySpendLimitPolicy, PulsePayHcsAuditHook, X402PayTool, transferCredit, getConfiguredAuditTopic } from "@pulsepay/adapter-hedera";
import type { HederaContext } from "@pulsepay/adapter-hedera";

async function runAutonomousBuyerAgent() {
  const base = process.env.PULSEPAY_APP_URL || "http://localhost:3000";
  const operatorId = process.env.HEDERA_BUYER_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID;
  if (!operatorId) throw new Error("Configure HEDERA_BUYER_ACCOUNT_ID (or HEDERA_OPERATOR_ID). No simulated settlement is available.");
  const key = process.env.HEDERA_BUYER_KEY || process.env.HEDERA_OPERATOR_KEY;
  const recipient = process.env.HEDERA_MERCHANT_ACCOUNT_ID;
  if (!recipient) throw new Error("Configure HEDERA_MERCHANT_ACCOUNT_ID to an account you control");
  const network = process.env.HEDERA_NETWORK || "testnet";
  if (network !== "testnet" && network !== "mainnet") throw new Error("Unsupported Hedera network");
  const mirror = new HederaMirrorClient(network);
  const context: HederaContext = { operatorAccountId: operatorId, network, mirror,
    maxTransactionFeeTinybars: BigInt(process.env.HEDERA_MAX_FEE_TINYBARS || "1000000"), auditTopicId: process.env.HEDERA_AUDIT_TOPIC_ID };
  context.auditTopicId ||= getConfiguredAuditTopic(context);
  const client = key ? (network === "testnet" ? Client.forTestnet() : Client.forMainnet()) : undefined;
  if (client) { client.setOperator(operatorId, key!); client.setMaxAttempts(1); context.client = client; }
  const pendingPath = ".pulsepay/buyer-pending.json";
  try {
    let requirement: any;
    let transactionId = process.env.HEDERA_PAYMENT_TRANSACTION_ID;
    let endpoint: string;
    if (transactionId) {
      const pending = JSON.parse(readFileSync(pendingPath, "utf8"));
      requirement = pending.requirement; endpoint = pending.endpoint;
    } else {
      const manifestResponse = await fetch(new URL("/.well-known/x402.json", base), { signal: AbortSignal.timeout(10000) });
      if (!manifestResponse.ok) throw new Error(`Discovery failed: ${manifestResponse.status}`);
      const manifest = await manifestResponse.json() as any;
      const service = manifest.services.find((s: any) => s.id === (process.env.HEDERA_SERVICE_ID || "market-data-pro"));
      if (!service) throw new Error("Service was not found in the manifest");
      endpoint = new URL(service.endpoints[0].path, base).toString();
      if (new URL(endpoint).origin !== new URL(base).origin) throw new Error("Discovery endpoint changed origin");
      const challenge = await fetch(endpoint, { method: "POST", signal: AbortSignal.timeout(10000) });
      if (challenge.status !== 402) throw new Error(`Expected payment challenge, got ${challenge.status}`);
      requirement = JSON.parse(challenge.headers.get("payment-required") || "null");
    }
    if (!requirement || requirement.scheme !== "hedera-native-receipt" || requirement.network !== `hedera:${network}` || requirement.asset !== "0.0.0"
      || requirement.recipient !== recipient || requirement.expiresAt < Date.now()/1000 || !/^[a-f0-9]{32}$/.test(requirement.challengeId)) throw new Error("Unsupported, expired or untrusted payment challenge");
    const policy = new PulsePaySpendLimitPolicy({ dailyBudgetTinybars: BigInt(process.env.HEDERA_DAILY_BUDGET_TINYBARS || "10"),
      maxPerRequestTinybars: BigInt(process.env.HEDERA_MAX_PAYMENT_TINYBARS || "1"), merchantAllowlist: [recipient], statePath: ".pulsepay/spend-policy.json" });
    const audit = new PulsePayHcsAuditHook({ topicId: context.auditTopicId,
      maxTransactionFeeTinybars: BigInt(process.env.HEDERA_AUDIT_MAX_FEE_TINYBARS || "2000000") });
    let settlement: any;
    if (!transactionId) {
      const tool = new X402PayTool(); tool.registerHook(policy);
      tool.registerHook(audit);
      if (!client) context.mode = AgentMode.RETURN_BYTES;
      settlement = await tool.execute({ serviceId: requirement.serviceId, merchantAccountId: recipient, amountTinybars: requirement.amount, challengeId: requirement.challengeId }, context);
      transactionId = settlement.transactionId;
      mkdirSync(".pulsepay", { recursive: true, mode: 0o700 });
      writeFileSync(pendingPath, JSON.stringify({ requirement, endpoint, transactionId }), { mode: 0o600 });
      if (settlement.status === "PREPARED") {
        console.log(JSON.stringify({ ...settlement, status: "AWAITING_WALLET", nextStep: "Submit bytes using your wallet, then rerun with HEDERA_PAYMENT_TRANSACTION_ID. Do not pay twice." }, null, 2));
        return;
      }
    }
    const record = await mirror.transaction(transactionId!);
    if (record.transaction_id.split("-")[0] !== operatorId || transferCredit(record, recipient) !== BigInt(requirement.amount)) throw new Error("Settlement does not match the buyer and amount");
    if (!settlement) policy.recordConfirmedSpend(transactionId!, BigInt(requirement.amount));
    const response = await fetch(endpoint!, { method: "POST", headers: { "PAYMENT-SIGNATURE": JSON.stringify({ challengeId: requirement.challengeId, transactionId }) }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Resource returned ${response.status}: ${await response.text()}. Retry the saved proof; do not pay again.`);
    if (!settlement) {
      settlement = { status: "SETTLED", transactionId, consensusStatus: "SUCCESS", merchantAccountId: recipient, amountTinybars: requirement.amount };
      await audit.postToolExecutionHook({ context, toolResult: settlement } as any, "x402_pay_tool");
    }
    console.log(JSON.stringify({ settlement, data: await response.json() }, null, 2));
  } finally { client?.close(); }
}
runAutonomousBuyerAgent().catch(error => { console.error(error.message); process.exitCode = 1; });
