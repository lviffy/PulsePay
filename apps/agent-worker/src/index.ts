import { Client } from "@hiero-ledger/sdk";
import { dirname, join, resolve, isAbsolute } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { AgentMode, HederaMirrorClient, PulsePaySpendLimitPolicy, PulsePayTokenSpendPolicy, PulsePayHcsAuditHook, X402PayTool, HederaEvmInvoicePayTool, transferCredit, getConfiguredAuditTopic, acquireStateOwner, hederaTestnet } from "@pulsepay/adapter-hedera";
import type { HederaContext } from "@pulsepay/adapter-hedera";
import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

function persist(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(`${path}.tmp`, JSON.stringify(value), { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

async function runEvmInvoicePurchase(requirement: any, endpoint: string, pendingPath: string, existingTransactionHash: string | undefined, storageDirectory: string) {
  const key = process.env.HEDERA_EVM_BUYER_KEY || process.env.HEDERA_BUYER_KEY;
  if (!key || !/^0x[a-fA-F0-9]{64}$/.test(key)) throw new Error("Configure HEDERA_EVM_BUYER_KEY for contract invoice payments");
  const account = privateKeyToAccount(key as `0x${string}`);
  if (requirement.scheme !== "hedera-evm-invoice-receipt" || requirement.network !== "eip155:296" || requirement.chainId !== 296
    || ![requirement.hubAddress, requirement.tokenAddress, requirement.merchantAddress, requirement.payerAddress].every((value: unknown) => typeof value === "string" && isAddress(value))
    || requirement.payerAddress.toLowerCase() !== account.address.toLowerCase() || !/^0x[a-fA-F0-9]{64}$/.test(requirement.invoiceId)
    || !/^[a-f0-9]{32}$/.test(requirement.challengeId) || !/^\d+$/.test(requirement.amountUnits)) throw new Error("Unsupported or untrusted Hedera EVM invoice challenge");
  const trustedHub = process.env.HEDERA_EVM_MERCHANT_HUB_ADDRESS;
  const trustedToken = process.env.HEDERA_EVM_SETTLEMENT_TOKEN_ADDRESS;
  const trustedMerchant = process.env.HEDERA_EVM_MERCHANT_ADDRESS;
  if (!trustedHub || requirement.hubAddress.toLowerCase() !== trustedHub.toLowerCase() || !trustedToken || requirement.tokenAddress.toLowerCase() !== trustedToken.toLowerCase()
    || (trustedMerchant && requirement.merchantAddress.toLowerCase() !== trustedMerchant.toLowerCase())) throw new Error("Invoice challenge does not match the trusted contract configuration");

  let transactionHash = process.env.HEDERA_EVM_PAYMENT_TRANSACTION_HASH || existingTransactionHash;
  let settlement: any;
  if (!transactionHash) {
    const rpcUrl = process.env.HEDERA_EVM_RPC_URL || hederaTestnet.rpcUrls.default.http[0];
    const publicClient = createPublicClient({ chain: hederaTestnet, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain: hederaTestnet, transport: http(rpcUrl) });
    const policy = new PulsePayTokenSpendPolicy({
      chainId: 296,
      tokenAddress: trustedToken,
      hubAllowlist: [trustedHub],
      merchantAllowlist: trustedMerchant ? [trustedMerchant] : undefined,
      dailyBudgetUnits: BigInt(process.env.HEDERA_EVM_DAILY_BUDGET_UNITS || "10000000"),
      maxPerRequestUnits: BigInt(process.env.HEDERA_EVM_MAX_PAYMENT_UNITS || "1000000"),
      statePath: join(storageDirectory, "evm-token-spend-policy.json"),
    });
    const tool = new HederaEvmInvoicePayTool();
    tool.registerHook(policy);
    const context: HederaContext = { evmPublicClient: publicClient, evmWalletClient: walletClient,
      onEvmTransactionSubmitted: (hash, kind) => {
        const prior = existsSync(pendingPath) ? JSON.parse(readFileSync(pendingPath, "utf8")) : {};
        persist(pendingPath, { ...prior, requirement, endpoint, ...(kind === "approval" ? { approvalTransactionHash: hash } : { transactionId: hash }), completed: false });
      } };
    settlement = await tool.execute({
      chainId: 296, hubAddress: requirement.hubAddress, tokenAddress: requirement.tokenAddress,
      merchantAddress: requirement.merchantAddress, payerAddress: requirement.payerAddress,
      invoiceId: requirement.invoiceId, amountUnits: requirement.amountUnits, challengeId: requirement.challengeId,
    }, context);
    transactionHash = settlement.transactionHash;
    persist(pendingPath, { requirement, endpoint, transactionId: transactionHash, completed: false });
  }
  const response = await fetch(endpoint, { method: "POST", headers: { "PAYMENT-SIGNATURE": JSON.stringify({ challengeId: requirement.challengeId, transactionId: transactionHash }) }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Invoice resource returned ${response.status}: ${await response.text()}. Retry the saved proof; do not pay again.`);
  const data = await response.json();
  persist(pendingPath, { requirement, endpoint, transactionId: transactionHash, completed: true });
  console.log(JSON.stringify({ settlement: settlement || { status: "SETTLED", transactionHash, recovered: true }, data }, null, 2));
}

async function runAutonomousBuyerAgent() {
  const configuredDirectory = process.env.PULSEPAY_STATE_DIRECTORY;
  if (process.env.NODE_ENV === "production" && (!configuredDirectory || !isAbsolute(configuredDirectory))) throw new Error("Production requires an absolute PULSEPAY_STATE_DIRECTORY on persistent storage");
  const storageDirectory = resolve(configuredDirectory || ".pulsepay");
  const releaseState = acquireStateOwner(storageDirectory, "worker");
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { releaseState(); process.exit(0); });
  const base = process.env.PULSEPAY_APP_URL || "http://localhost:3000";
  const operatorId = process.env.HEDERA_BUYER_ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID;
  const key = process.env.HEDERA_BUYER_KEY || process.env.HEDERA_OPERATOR_KEY;
  const recipient = process.env.HEDERA_MERCHANT_ACCOUNT_ID;
  const network = process.env.HEDERA_NETWORK || "testnet";
  let client: Client | undefined;
  const pendingPath = join(storageDirectory, "buyer-pending.json");
  try {
    let requirement: any;
    const saved = existsSync(pendingPath) ? JSON.parse(readFileSync(pendingPath, "utf8")) : undefined;
    let transactionId = process.env.HEDERA_PAYMENT_TRANSACTION_ID || process.env.HEDERA_EVM_PAYMENT_TRANSACTION_HASH || (!saved?.completed ? saved?.transactionId : undefined);
    let endpoint: string;
    if (transactionId) {
      const pending = JSON.parse(readFileSync(pendingPath, "utf8"));
      requirement = pending.requirement; endpoint = pending.endpoint;
      if (new URL(endpoint).origin !== new URL(base).origin) throw new Error("Saved endpoint changed origin");
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
    if (requirement?.scheme === "hedera-evm-invoice-receipt") {
      await runEvmInvoicePurchase(requirement, endpoint!, pendingPath, transactionId, storageDirectory);
      return;
    }
    if (!operatorId) throw new Error("Configure HEDERA_BUYER_ACCOUNT_ID (or HEDERA_OPERATOR_ID) for native HBAR payments");
    if (!recipient) throw new Error("Configure HEDERA_MERCHANT_ACCOUNT_ID for native HBAR payments");
    if (network !== "testnet" && network !== "mainnet") throw new Error("Unsupported Hedera network");
    const mirror = new HederaMirrorClient(network);
    const context: HederaContext = { storageDirectory, operatorAccountId: operatorId, network, mirror,
      maxTransactionFeeTinybars: BigInt(process.env.HEDERA_MAX_FEE_TINYBARS || "1000000"), auditTopicId: process.env.HEDERA_AUDIT_TOPIC_ID };
    context.auditTopicId ||= getConfiguredAuditTopic(context);
    client = key ? (network === "testnet" ? Client.forTestnet() : Client.forMainnet()) : undefined;
    if (client) { client.setOperator(operatorId, key!); client.setMaxAttempts(1); context.client = client; }
    if (!requirement || requirement.scheme !== "hedera-native-receipt" || requirement.network !== `hedera:${network}` || requirement.asset !== "0.0.0"
      || requirement.recipient !== recipient || (!transactionId && requirement.expiresAt < Date.now()/1000) || !/^[a-f0-9]{32}$/.test(requirement.challengeId)) throw new Error("Unsupported, expired or untrusted payment challenge");
    const policy = new PulsePaySpendLimitPolicy({ dailyBudgetTinybars: BigInt(process.env.HEDERA_DAILY_BUDGET_TINYBARS || "10"),
      maxPerRequestTinybars: BigInt(process.env.HEDERA_MAX_PAYMENT_TINYBARS || "1"), merchantAllowlist: [recipient], statePath: join(storageDirectory, "spend-policy.json") });
    const audit = new PulsePayHcsAuditHook({ topicId: context.auditTopicId,
      maxTransactionFeeTinybars: BigInt(process.env.HEDERA_AUDIT_MAX_FEE_TINYBARS || "2000000") });
    let settlement: any;
    if (!transactionId) {
      const tool = new X402PayTool(); tool.registerHook(policy);
      tool.registerHook(audit);
      if (!client) context.mode = AgentMode.RETURN_BYTES;
      context.onPaymentPrepared = transactionId => {
        mkdirSync(storageDirectory, { recursive: true, mode: 0o700 });
        writeFileSync(`${pendingPath}.tmp`, JSON.stringify({ requirement, endpoint, transactionId, completed: false }), { mode: 0o600 });
        renameSync(`${pendingPath}.tmp`, pendingPath);
      };
      settlement = await tool.execute({ serviceId: requirement.serviceId, merchantAccountId: recipient, amountTinybars: requirement.amount, challengeId: requirement.challengeId }, context);
      transactionId = settlement.transactionId;
      mkdirSync(storageDirectory, { recursive: true, mode: 0o700 });
      writeFileSync(`${pendingPath}.tmp`, JSON.stringify({ requirement, endpoint, transactionId, completed: false }), { mode: 0o600 });
      renameSync(`${pendingPath}.tmp`, pendingPath);
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
    const data = await response.json();
    writeFileSync(`${pendingPath}.tmp`, JSON.stringify({ requirement, endpoint, transactionId, completed: true }), { mode: 0o600 });
    renameSync(`${pendingPath}.tmp`, pendingPath);
    console.log(JSON.stringify({ settlement, data }, null, 2));
  } finally { client?.close(); releaseState(); }
}
runAutonomousBuyerAgent().catch(error => { console.error(error.message); process.exitCode = 1; });
