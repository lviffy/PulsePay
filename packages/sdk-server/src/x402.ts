import { randomBytes, createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { resolve } from "node:path";
import { HederaMirrorClient, mirrorTransactionId, transferCredit, amountTinybarsSchema } from "@pulsepay/adapter-hedera";

export interface X402PriceSpec {
  network: "hedera:testnet" | "hedera:mainnet";
  asset: string;
  amountTinybars: string;
  payTo: string;
}
export interface X402RouteConfig {
  serviceId: string;
  serviceName: string;
  price: X402PriceSpec;
  description?: string;
  facilitatorUrl?: string;
  statePath?: string;
  mirror?: HederaMirrorClient;
  /** Pure response builder; the result is journaled with redemption and reused on retries. */
  createResponse?: () => unknown;
  maxPendingChallenges?: number;
  maxStoredChallenges?: number;
}
export interface X402PaymentRequirement {
  version: "1.0";
  scheme: "hedera-native-receipt";
  challengeId: string;
  network: string;
  asset: string;
  amount: string;
  recipient: string;
  serviceId: string;
  expiresAt: number;
}
interface Challenge extends X402PaymentRequirement { issuedAt: number; transactionId?: string; payer?: string; consensusTimestamp?: string; response?: unknown; }
const verifying = new Map<string, Promise<void>>();
function load(path: string): Record<string, Challenge> {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error: any) { if (error.code === "ENOENT") return {}; throw error; }
}
function save(path: string, state: Record<string, Challenge>) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(`${path}.${process.pid}.tmp`, JSON.stringify(state), { mode: 0o600 });
  renameSync(`${path}.${process.pid}.tmp`, path);
}
const reply = (statusCode: number, body: any, headers: Record<string,string> = {}) => ({ authorized: statusCode === 200, statusCode, headers: { "Content-Type": "application/json", ...headers }, body });
function validate(config: X402RouteConfig) {
  if (!["hedera:testnet", "hedera:mainnet"].includes(config.price.network) || config.price.asset !== "0.0.0") throw new Error("Only native HBAR on Hedera testnet/mainnet is supported");
  if (!/^\d+\.\d+\.\d+$/.test(config.price.payTo)) throw new Error("Invalid Hedera merchant account");
  amountTinybarsSchema.parse(config.price.amountTinybars);
}

/** Native receipt extension: the server verifies consensus, price, recipient and a secret challenge. */
export async function handleX402PaymentCheck(config: X402RouteConfig, paymentSignatureHeader?: string | null) {
  validate(config);
  const path = config.statePath || ".pulsepay/challenges.json";
  if (!paymentSignatureHeader?.trim()) {
    const requirement: Challenge = { version: "1.0", scheme: "hedera-native-receipt", challengeId: randomBytes(16).toString("hex"), network: config.price.network,
      asset: config.price.asset, amount: config.price.amountTinybars, recipient: config.price.payTo, serviceId: config.serviceId,
      issuedAt: Math.floor(Date.now()/1000), expiresAt: Math.floor(Date.now()/1000) + 300 };
    const state = load(path);
    for (const [id, entry] of Object.entries(state)) {
      if (!entry.transactionId && entry.expiresAt < Date.now()/1000) delete state[id];
    }
    if (Object.keys(state).length >= (config.maxStoredChallenges ?? 10000)) {
      save(path, state);
      return reply(503, { error: "Payment storage capacity reached; merchant maintenance required" });
    }
    if (Object.values(state).filter(c => !c.transactionId).length >= (config.maxPendingChallenges ?? 1000)) {
      save(path, state);
      return reply(429, { error: "Too many pending payment challenges. Retry later." }, { "Retry-After": "60" });
    }
    state[requirement.challengeId] = requirement; save(path, state);
    return reply(402, { error: "Payment Required", requirement }, { "PAYMENT-REQUIRED": JSON.stringify(requirement) });
  }
  // The challenge ID is a bearer secret. Only its hash goes into the public transaction memo.
  let proof: { challengeId: string; transactionId: string };
  try {
    proof = JSON.parse(paymentSignatureHeader);
    if (!/^[a-f0-9]{32}$/.test(proof.challengeId)) throw new Error();
    proof.transactionId = mirrorTransactionId(proof.transactionId);
  } catch { return reply(400, { error: "Invalid payment proof" }); }
  const key = `${resolve(path)}:${proof.challengeId}`;
  const inFlight = verifying.get(key);
  if (inFlight) await inFlight;
  const challenge = load(path)[proof.challengeId];
  if (!challenge || challenge.serviceId !== config.serviceId || challenge.network !== config.price.network || challenge.asset !== config.price.asset || challenge.amount !== config.price.amountTinybars || challenge.recipient !== config.price.payTo) return reply(400, { error: "Payment challenge does not match this service" });
  const settledReply = (entry: Challenge) => {
    const network = entry.network === "hedera:testnet" ? "testnet" : "mainnet";
    const settlement = { status: "SUCCESS", serviceId: entry.serviceId, transactionId: entry.transactionId, consensusTimestamp: entry.consensusTimestamp, hashScanUrl: `https://hashscan.io/${network}/transaction/${entry.transactionId}` };
    return reply(200, { ...settlement, ...(entry.response === undefined ? {} : { resourceResponse: entry.response }) }, { "PAYMENT-RESPONSE": JSON.stringify(settlement) });
  };
  if (challenge.transactionId) {
    if (challenge.transactionId !== proof.transactionId) return reply(409, { error: "Payment challenge was redeemed with another transaction" });
    if (config.createResponse && challenge.response === undefined) return reply(409, { error: "This legacy redemption has no saved response; contact the merchant" });
    return settledReply(challenge);
  }
  if (challenge.expiresAt < Date.now()/1000) return reply(402, { error: "Payment challenge expired" });
  let finish!: () => void;
  verifying.set(key, new Promise<void>(resolve => { finish = resolve; }));
  try {
    const network = config.price.network === "hedera:testnet" ? "testnet" : "mainnet";
    const mirror = config.mirror || new HederaMirrorClient(network);
    if (mirror.network !== network) return reply(400, { error: "Payment network mismatch" });
    const tx = await mirror.transaction(proof.transactionId);
    const payer = tx.transaction_id.split("-")[0];
    const memo = `PulsePay x402: ${createHash("sha256").update(proof.challengeId).digest("hex").slice(0,32)}`;
    if (Buffer.from(tx.memo_base64, "base64").toString() !== memo || transferCredit(tx, challenge.recipient) !== BigInt(challenge.amount)
      || payer === challenge.recipient || transferCredit(tx, payer) >= 0n || Number(tx.consensus_timestamp) < challenge.issuedAt || Number(tx.consensus_timestamp) > challenge.expiresAt) return reply(400, { error: "Payment does not satisfy the challenge" });
    const state = load(path);
    if (Object.values(state).some(c => c.transactionId === proof.transactionId) || state[proof.challengeId]?.transactionId) return reply(409, { error: "Payment already redeemed" });
    const response = config.createResponse?.();
    if (response !== undefined && Buffer.byteLength(JSON.stringify(response)) > 65536) throw new Error("Purchased response exceeds the 64 KiB storage bound");
    // JSON serialization precedes redemption: builders must be pure and return JSON data.
    const entry = JSON.parse(JSON.stringify({ ...challenge, transactionId: proof.transactionId, payer, consensusTimestamp: tx.consensus_timestamp, response })) as Challenge;
    state[proof.challengeId] = entry; save(path, state);
    return settledReply(entry);
  } catch { return reply(503, { error: "Payment could not be confirmed. Retry this proof; do not pay again." }); }
  finally { verifying.delete(key); finish(); }
}

export function getVerifiedHederaPayments(statePath = ".pulsepay/challenges.json") {
  return Object.values(load(statePath)).filter(c => c.transactionId).map(({ challengeId: _challengeId, response: _response, ...payment }) => payment);
}
export function generateX402Manifest(services: X402RouteConfig[]) {
  for (const service of services) validate(service);
  return { version: "1.0", provider: "PulsePay Merchant", services: services.map(s => ({ id: s.serviceId, name: s.serviceName, description: s.description || "",
    pricing: { scheme: "hedera-native-receipt", network: s.price.network, asset: s.price.asset, amount: s.price.amountTinybars, recipient: s.price.payTo },
    endpoints: [{ path: `/v1/services/${s.serviceId}/query`, method: "POST" }] })) };
}
