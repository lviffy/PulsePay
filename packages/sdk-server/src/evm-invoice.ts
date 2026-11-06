import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { HederaMirrorClient, verifyHederaInvoicePayment } from "@pulsepay/adapter-hedera";

type Address = `0x${string}`;
type Hex32 = `0x${string}`;

export interface EvmInvoiceProvisionRequest {
  invoiceId: Hex32;
  customer: Address;
  amountUnits: string;
  dueAt: number;
  metadataHash: Hex32;
}

export interface EvmInvoiceChallengeConfig {
  serviceId: string;
  serviceName: string;
  chainId: 296;
  hubAddress: Address;
  tokenAddress: Address;
  merchantAddress: Address;
  payerAddress: Address;
  amountUnits: string;
  statePath?: string;
  mirror?: HederaMirrorClient;
  provisionInvoice: (request: EvmInvoiceProvisionRequest) => Promise<{ transactionHash: string }>;
  verifyPayment?: (requirement: EvmInvoiceRequirement, transactionIdOrHash: string) => Promise<{ transactionHash: string; paidAt: bigint }>;
  createResponse?: () => unknown;
}

export interface EvmInvoiceRequirement {
  version: "1.0";
  scheme: "hedera-evm-invoice-receipt";
  network: "eip155:296";
  challengeId: string;
  serviceId: string;
  chainId: 296;
  hubAddress: Address;
  tokenAddress: Address;
  merchantAddress: Address;
  payerAddress: Address;
  invoiceId: Hex32;
  amountUnits: string;
  expiresAt: number;
}

interface StoredEvmChallenge extends EvmInvoiceRequirement {
  issuedAt: number;
  metadataHash: Hex32;
  provisionTransactionHash: string;
  paymentTransactionHash?: string;
  paidAt?: string;
  response?: unknown;
}

const inFlight = new Map<string, Promise<void>>();
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const bytes32Pattern = /^0x[a-fA-F0-9]{64}$/;

function load(path: string): Record<string, StoredEvmChallenge> {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error: any) { if (error.code === "ENOENT") return {}; throw error; }
}

function save(path: string, value: Record<string, StoredEvmChallenge>) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(`${path}.${process.pid}.tmp`, JSON.stringify(value), { mode: 0o600 });
  renameSync(`${path}.${process.pid}.tmp`, path);
}

function validate(config: EvmInvoiceChallengeConfig) {
  if (config.chainId !== 296) throw new Error("Only Hedera testnet chain 296 is supported");
  if (![config.hubAddress, config.tokenAddress, config.merchantAddress, config.payerAddress].every(value => addressPattern.test(value))) throw new Error("Invalid Hedera EVM challenge address");
  if (!/^\d+$/.test(config.amountUnits) || BigInt(config.amountUnits) <= 0n) throw new Error("Invoice amount must be positive token units");
}

const reply = (statusCode: number, body: any, headers: Record<string, string> = {}) => ({
  authorized: statusCode === 200,
  statusCode,
  headers: { "Content-Type": "application/json", ...headers },
  body,
});

export async function handleEvmInvoicePaymentCheck(config: EvmInvoiceChallengeConfig, paymentSignatureHeader?: string | null) {
  validate(config);
  const path = config.statePath || ".pulsepay/evm-invoice-challenges.json";
  if (!paymentSignatureHeader?.trim()) {
    const now = Math.floor(Date.now() / 1000);
    const challengeId = randomBytes(16).toString("hex");
    const invoiceId = `0x${randomBytes(32).toString("hex")}` as Hex32;
    const metadataHash = `0x${createHash("sha256").update(challengeId).digest("hex")}` as Hex32;
    const requirement: EvmInvoiceRequirement = {
      version: "1.0", scheme: "hedera-evm-invoice-receipt", network: "eip155:296", challengeId,
      serviceId: config.serviceId, chainId: config.chainId, hubAddress: config.hubAddress,
      tokenAddress: config.tokenAddress, merchantAddress: config.merchantAddress, payerAddress: config.payerAddress,
      invoiceId, amountUnits: config.amountUnits, expiresAt: now + 300,
    };
    let provision: { transactionHash: string };
    try {
      provision = await config.provisionInvoice({ invoiceId, customer: config.payerAddress, amountUnits: config.amountUnits, dueAt: requirement.expiresAt, metadataHash });
    } catch (error: any) {
      return reply(503, { error: `Invoice could not be provisioned: ${error.message}` });
    }
    const state = load(path);
    state[challengeId] = { ...requirement, issuedAt: now, metadataHash, provisionTransactionHash: provision.transactionHash };
    save(path, state);
    return reply(402, { error: "Payment Required", requirement }, { "PAYMENT-REQUIRED": JSON.stringify(requirement) });
  }

  let proof: { challengeId: string; transactionId: string };
  try {
    proof = JSON.parse(paymentSignatureHeader);
    if (!/^[a-f0-9]{32}$/.test(proof.challengeId) || !(bytes32Pattern.test(proof.transactionId) || /^\d+\.\d+\.\d+[@-]\d+[.-]\d{1,9}$/.test(proof.transactionId))) throw new Error();
  } catch { return reply(400, { error: "Invalid EVM invoice payment proof" }); }

  const key = `${path}:${proof.challengeId}`;
  const pending = inFlight.get(key);
  if (pending) await pending;
  const stored = load(path)[proof.challengeId];
  if (!stored || stored.serviceId !== config.serviceId || stored.hubAddress.toLowerCase() !== config.hubAddress.toLowerCase()
    || stored.tokenAddress.toLowerCase() !== config.tokenAddress.toLowerCase() || stored.merchantAddress.toLowerCase() !== config.merchantAddress.toLowerCase()
    || stored.payerAddress.toLowerCase() !== config.payerAddress.toLowerCase() || stored.amountUnits !== config.amountUnits) return reply(400, { error: "Invoice challenge does not match this service" });
  const settled = (entry: StoredEvmChallenge) => {
    const settlement = { status: "SUCCESS", scheme: entry.scheme, invoiceId: entry.invoiceId, transactionHash: entry.paymentTransactionHash, paidAt: entry.paidAt };
    return reply(200, { ...settlement, ...(entry.response === undefined ? {} : { resourceResponse: entry.response }) }, { "PAYMENT-RESPONSE": JSON.stringify(settlement) });
  };
  if (stored.paymentTransactionHash) {
    if (stored.paymentTransactionHash.toLowerCase() !== proof.transactionId.toLowerCase()) return reply(409, { error: "Invoice was redeemed with another transaction" });
    return settled(stored);
  }
  if (stored.expiresAt < Date.now() / 1000) return reply(402, { error: "Invoice challenge expired" });

  let finish!: () => void;
  inFlight.set(key, new Promise(resolve => { finish = resolve; }));
  try {
    const verifier = config.verifyPayment || ((requirement, transactionIdOrHash) => verifyHederaInvoicePayment({
      mirror: config.mirror || new HederaMirrorClient("testnet"), transactionIdOrHash,
      hubAddress: requirement.hubAddress, invoiceId: requirement.invoiceId, merchantAddress: requirement.merchantAddress,
      payerAddress: requirement.payerAddress, amountUnits: BigInt(requirement.amountUnits),
    }));
    const verified = await verifier(stored, proof.transactionId);
    if (verified.paidAt < BigInt(stored.issuedAt) || verified.paidAt > BigInt(stored.expiresAt)) throw new Error("Payment settled outside the challenge window");
    const state = load(path);
    if (Object.values(state).some(value => value.paymentTransactionHash?.toLowerCase() === verified.transactionHash.toLowerCase()) || state[proof.challengeId]?.paymentTransactionHash) return reply(409, { error: "Payment proof already redeemed" });
    const response = config.createResponse?.();
    if (response !== undefined && Buffer.byteLength(JSON.stringify(response)) > 65_536) throw new Error("Purchased response exceeds 64 KiB");
    state[proof.challengeId] = { ...stored, paymentTransactionHash: verified.transactionHash, paidAt: verified.paidAt.toString(), response };
    save(path, state);
    return settled(state[proof.challengeId]);
  } catch { return reply(503, { error: "Invoice payment could not be confirmed. Retry this proof; do not pay again." }); }
  finally { inFlight.delete(key); finish(); }
}

export function getVerifiedEvmInvoicePayments(statePath = ".pulsepay/evm-invoice-challenges.json") {
  return Object.values(load(statePath)).filter(value => value.paymentTransactionHash).map(({ challengeId: _challengeId, response: _response, metadataHash: _metadataHash, ...payment }) => payment);
}

export function generateEvmInvoiceManifest(config: Omit<EvmInvoiceChallengeConfig, "provisionInvoice" | "verifyPayment" | "createResponse" | "mirror">) {
  validate(config as EvmInvoiceChallengeConfig);
  return {
    id: config.serviceId,
    name: config.serviceName,
    description: "Contract invoice settlement on Hedera EVM with a challenge-bound receipt.",
    pricing: {
      scheme: "hedera-evm-invoice-receipt",
      network: "eip155:296",
      asset: config.tokenAddress,
      amount: config.amountUnits,
      payTo: config.merchantAddress,
      hub: config.hubAddress,
      payer: config.payerAddress,
    },
    endpoints: [{ path: `/v1/services/${config.serviceId}/query`, method: "POST" }],
  };
}

