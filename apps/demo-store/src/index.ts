import http, { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { join } from "node:path";
import { createPulsePay } from "@pulsepay/sdk-core";
import { config } from "./config.js";
import { merchantAuth, equalSecret, RequestLimits } from "./security.js";
import { acquireStateOwner, hederaMerchantHubAbi, hederaTestnet } from "@pulsepay/adapter-hedera";
import { handleX402PaymentCheck, generateX402Manifest, getVerifiedHederaPayments, handleEvmInvoicePaymentCheck, generateEvmInvoiceManifest, getVerifiedEvmInvoicePayments, formatAccountantCsv } from "@pulsepay/sdk-server";
import type { NormalizedActivity } from "@pulsepay/shared";
import { UniswapRoutingAdapter } from "@pulsepay/adapter-uniswap";
import { createPublicClient, createWalletClient, http as evmHttp, isAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const releaseState = acquireStateOwner(config.stateDirectory, "server");
for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { releaseState(); process.exit(0); });
const PORT = config.port;
const merchantAccountId = config.merchantAccountId;
const auth = merchantAuth(config.secret, config.origin);
const requestLimits = new RequestLimits();
const paymentStatePath = join(config.stateDirectory, "challenges.json");
const evmInvoiceStatePath = join(config.stateDirectory, "evm-invoice-challenges.json");
const verifiedPayments = () => getVerifiedHederaPayments(paymentStatePath);
const verifiedEvmPayments = () => getVerifiedEvmInvoicePayments(evmInvoiceStatePath);
const routing = new UniswapRoutingAdapter({ apiKey: process.env.UNISWAP_API_KEY, chainId: Number(process.env.UNISWAP_CHAIN_ID || "1301") });
const evm = process.env.WHITECHAIN_MERCHANT_HUB_ADDRESS ? createPulsePay({
  whitechain: { contractAddress: process.env.WHITECHAIN_MERCHANT_HUB_ADDRESS as `0x${string}`, rpcUrl: process.env.WHITECHAIN_RPC_URL, usdtAddress: process.env.WHITECHAIN_USDT_ADDRESS as `0x${string}` | undefined },
  uniswap: { routing: { apiKey: process.env.UNISWAP_API_KEY, chainId: Number(process.env.UNISWAP_CHAIN_ID || "1301") },
    ...(process.env.UNISWAP_TREASURY_HOOK_ADDRESS ? { treasury: { hookAddress: process.env.UNISWAP_TREASURY_HOOK_ADDRESS as `0x${string}`, rpcUrl: process.env.UNISWAP_RPC_URL, poolManagerAddress: process.env.UNISWAP_POOL_MANAGER as `0x${string}` | undefined } } : {}) },
}) : undefined;
const webOrigin = new URL(process.env.PULSEPAY_WEB_URL || "http://localhost:3100").origin;
const removedRoutes = new Set(["/api/invoices/create", "/api/invoices/refund", "/api/treasury/hook-config", "/api/treasury/swap", "/api/treasury/claim-fees", "/api/subscriptions/renew", "/api/reserves/withdraw", "/api/webhooks/test"]);

const acmeServices = [
  {
    statePath: paymentStatePath,
    serviceId: "market-data-pro",
    serviceName: "Sample Orderbook API",
    description: "Fixed sample orderbook content protected by real Hedera receipt verification.",
    price: {
      network: `hedera:${config.network}` as "hedera:testnet" | "hedera:mainnet",
      asset: "0.0.0", // Native HBAR
      amountTinybars: process.env.HEDERA_SERVICE_PRICE_TINYBARS || "1",
      payTo: merchantAccountId,
    },
  },
  {
    statePath: paymentStatePath,
    serviceId: "ai-sentiment-feed",
    serviceName: "Sample Sentiment API",
    description: "Fixed sample content for testing real Hedera payment verification.",
    price: {
      network: `hedera:${config.network}` as "hedera:testnet" | "hedera:mainnet",
      asset: "0.0.0",
      amountTinybars: "120000000", // 1.20 HBAR
      payTo: merchantAccountId,
    },
  },
];

const evmHubAddress = process.env.HEDERA_EVM_MERCHANT_HUB_ADDRESS;
const evmTokenAddress = process.env.HEDERA_EVM_SETTLEMENT_TOKEN_ADDRESS;
const evmBuyerAddress = process.env.HEDERA_EVM_BUYER_ADDRESS;
const evmMerchantKey = (process.env.HEDERA_EVM_MERCHANT_KEY || process.env.PRIVATE_KEY) as Hex | undefined;
const evmRpcUrl = process.env.HEDERA_EVM_RPC_URL || hederaTestnet.rpcUrls.default.http[0];
const evmMerchantAccount = evmMerchantKey ? privateKeyToAccount(evmMerchantKey) : undefined;
for (const [name, value] of Object.entries({
  HEDERA_EVM_MERCHANT_HUB_ADDRESS: evmHubAddress,
  HEDERA_EVM_SETTLEMENT_TOKEN_ADDRESS: evmTokenAddress,
  HEDERA_EVM_BUYER_ADDRESS: evmBuyerAddress,
  HEDERA_EVM_MERCHANT_ADDRESS: process.env.HEDERA_EVM_MERCHANT_ADDRESS,
})) if (value && !isAddress(value)) throw new Error(`${name} must be a valid EVM address`);
if (process.env.HEDERA_EVM_MERCHANT_ADDRESS && evmMerchantAccount?.address.toLowerCase() !== process.env.HEDERA_EVM_MERCHANT_ADDRESS.toLowerCase()) throw new Error("HEDERA_EVM_MERCHANT_ADDRESS does not match the merchant key");
if (evmMerchantKey && !evmMerchantAccount) throw new Error("Invalid Hedera EVM merchant key");
const evmPublicClient = evmHubAddress ? createPublicClient({ chain: hederaTestnet, transport: evmHttp(evmRpcUrl) }) : undefined;
const evmMerchantWallet = evmMerchantAccount ? createWalletClient({ account: evmMerchantAccount, chain: hederaTestnet, transport: evmHttp(evmRpcUrl) }) : undefined;
const evmInvoiceService = evmHubAddress && evmTokenAddress && evmBuyerAddress && evmMerchantAccount && evmPublicClient && evmMerchantWallet ? {
  statePath: evmInvoiceStatePath,
  serviceId: "agent-invoice-pro",
  serviceName: "Sample Contract Invoice API",
  chainId: 296 as const,
  hubAddress: evmHubAddress as Address,
  tokenAddress: evmTokenAddress as Address,
  merchantAddress: evmMerchantAccount.address,
  payerAddress: evmBuyerAddress as Address,
  amountUnits: process.env.HEDERA_EVM_SERVICE_PRICE_UNITS || "1000000",
  provisionInvoice: async (invoice: { invoiceId: Hex; customer: Address; amountUnits: string; dueAt: number; metadataHash: Hex }) => {
    if (await evmPublicClient.getChainId() !== 296) throw new Error("Configured EVM RPC is not Hedera testnet");
    const configuredToken = await evmPublicClient.readContract({ address: evmHubAddress as Address, abi: hederaMerchantHubAbi, functionName: "settlementToken" });
    if (configuredToken.toLowerCase() !== evmTokenAddress.toLowerCase()) throw new Error("Configured settlement token does not match the hub");
    const simulation = await evmPublicClient.simulateContract({ account: evmMerchantAccount, address: evmHubAddress as Address, abi: hederaMerchantHubAbi,
      functionName: "createInvoice", args: [invoice.invoiceId, invoice.customer, BigInt(invoice.amountUnits), BigInt(invoice.dueAt), invoice.metadataHash] });
    const transactionHash = await evmMerchantWallet.writeContract(simulation.request);
    const receipt = await evmPublicClient.waitForTransactionReceipt({ hash: transactionHash });
    if (receipt.status !== "success") throw new Error("Invoice creation reverted");
    return { transactionHash };
  },
} : undefined;

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 16384) { reject(new Error("Request body exceeds 16 KiB")); req.resume(); return; }
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  void handleRequest(req, res).catch((error) => {
    console.error("Request failed:", error.message);
    if (!res.headersSent) res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Service unavailable" }));
  });
});

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const parsed = parse(req.url || "/", true);
  const pathname = parsed.pathname || "/";

  auth.headers(req, res);
  const respond = (status: number, body: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)); };
  if (req.headers.origin && req.headers.origin !== config.origin) { respond(403, { error: "Origin is not allowed" }); return; }
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const remote = req.socket.remoteAddress || "unknown";
  if (!requestLimits.allow(`all:${remote}`, 300)) { res.setHeader("Retry-After", "60"); respond(429, { error: "Too many requests" }); return; }
  if (pathname === "/merchant/login" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Merchant sign in</title><h1>Merchant sign in</h1><form method="post" action="/api/auth/login"><label>Merchant access key <input name="secret" type="password" required autocomplete="current-password"></label><button>Sign in</button></form></html>'); return;
  }
  if (pathname === "/api/auth/login" && req.method === "POST") {
    if (!requestLimits.allow(`login:${remote}`, 10)) { respond(429, { error: "Too many sign-in attempts" }); return; }
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 4096) { respond(413, { error: "Request too large" }); return; } chunks.push(chunk); }
    const supplied = new URLSearchParams(Buffer.concat(chunks).toString()).get("secret") || "";
    if (!equalSecret(supplied, config.secret)) { respond(401, { error: "Invalid merchant access key" }); return; }
    res.writeHead(303, { "Set-Cookie": auth.cookie(), Location: "/merchant" }); res.end(); return;
  }
  if (pathname === "/merchant" && req.method === "GET") {
    res.writeHead(303, { Location: new URL("/merchant", webOrigin).toString() }); res.end(); return;
  }
  if (pathname.startsWith("/api/")) {
    if (!auth.authorized(req)) {
      respond(401, { error: "Merchant authentication required" });
      return;
    }
  }
  if (removedRoutes.has(pathname)) { respond(410, { error: "This preview endpoint has been removed. Use the wallet-backed merchant console on the web app." }); return; }
  if (pathname.startsWith("/v1/services/") && !req.headers["payment-signature"] && !requestLimits.allow(`challenge:${remote}`, 30)) {
    res.setHeader("Retry-After", "60"); respond(429, { error: "Too many payment challenges" }); return;
  }
  if (pathname.startsWith("/api/whitechain/invoices/") && req.method === "GET") {
    const id = pathname.slice("/api/whitechain/invoices/".length);
    if (!evm) { respond(503, { error: "Configure WHITECHAIN_MERCHANT_HUB_ADDRESS" }); return; }
    if (!/^0x[a-fA-F0-9]{64}$/.test(id)) { respond(400, { error: "Invoice ID must be bytes32" }); return; }
    const invoice = await evm.invoices.get(id as `0x${string}`);
    respond(invoice ? 200 : 404, invoice || { error: "Invoice not found" }); return;
  }
  if (pathname === "/api/treasury/policy" && req.method === "GET") {
    if (!evm?.treasury) { respond(503, { error: "Configure a deployed UNISWAP_TREASURY_HOOK_ADDRESS and Whitechain hub" }); return; }
    respond(200, await evm.treasury.getHookPolicy()); return;
  }
  if (pathname === "/api/uniswap/quote" && req.method === "POST") {
    try {
      const data = await parseJsonBody<any>(req);
      if (typeof data.targetUsdtAmountUnits !== "string" || !/^[0-9]{1,78}$/.test(data.targetUsdtAmountUnits)) throw new Error("Use positive integer output token units");
      const quote = await routing.getExactOutputQuote({ ...data, targetUsdtAmountUnits: BigInt(data.targetUsdtAmountUnits) });
      respond(200, quote);
    } catch (error: any) { respond(400, { error: error.message }); }
    return;
  }

  if (pathname === "/api/merchant/state" && req.method === "GET") {
    const payments = verifiedPayments();
    const totalHbarTinybars = payments.reduce((sum, payment) => sum + BigInt(payment.amount), 0n);
    respond(200, {
      mode: "LIVE_HEDERA",
      network: config.network,
      merchantAccountId,
      totalAgentCalls: payments.length,
      totalHbarTinybars,
      activities: hederaActivities(),
      services: [...generateX402Manifest(acmeServices).services, ...(evmInvoiceService ? [generateEvmInvoiceManifest(evmInvoiceService)] : [])],
      evmInvoicePayments: verifiedEvmPayments(),
    });
    return;
  }

  // Route 1: Machine-readable x402 discovery manifest for autonomous agents
  if (pathname === "/.well-known/x402.json" && req.method === "GET") {
    const manifest = generateX402Manifest(acmeServices);
    if (evmInvoiceService) manifest.services.push(generateEvmInvoiceManifest(evmInvoiceService) as any);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(manifest, null, 2));
    return;
  }

  // Route 2: Hedera x402 Protected Resource Endpoint
  const paidService = acmeServices.find(service => pathname === `/v1/services/${service.serviceId}/query`);
  if (paidService && req.method === "POST") {
    const paymentSignature = req.headers["payment-signature"] as string | undefined;
    const check = await handleX402PaymentCheck({ ...paidService, createResponse: () => ({
      status: "SUCCESS", service: paidService.serviceName, sampleData: true,
      data: { pair: "HBAR/USD", bids: [{ price: 0.0825, volume: 154000 }], asks: [{ price: 0.0827, volume: 110000 }], generatedAt: Date.now() },
    }) }, paymentSignature);

    if (!check.authorized) {
      res.writeHead(check.statusCode, check.headers);
      res.end(JSON.stringify(check.body, null, 2));
      return;
    }

    res.writeHead(200, check.headers);
    res.end(JSON.stringify(check.body.resourceResponse));
    return;
  }
  if (evmInvoiceService && pathname === `/v1/services/${evmInvoiceService.serviceId}/query` && req.method === "POST") {
    const check = await handleEvmInvoicePaymentCheck({ ...evmInvoiceService, createResponse: () => ({
      status: "SUCCESS", service: evmInvoiceService.serviceName, sampleData: true,
      data: { report: "Hedera EVM invoice payment verified", generatedAt: Date.now() },
    }) }, req.headers["payment-signature"] as string | undefined);
    res.writeHead(check.statusCode, check.headers);
    res.end(JSON.stringify(check.authorized ? check.body.resourceResponse : check.body, null, 2));
    return;
  }

  // Route 3: Accountant CSV Export
  if (pathname === "/api/hedera/payments" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(verifiedPayments()));
    return;
  }
  if (pathname === "/api/export.csv" && req.method === "GET") {
    const csvData = formatAccountantCsv(hederaActivities());
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulsepay-ledger-${Date.now()}.csv"`,
    });
    res.end(csvData);
    return;
  }

  if (pathname.startsWith("/receipt/hedera/") && req.method === "GET") {
    const id = pathname.slice("/receipt/hedera/".length);
    const payment = hederaActivities().find(p => p.txId === id);
    if (!payment) { res.writeHead(404); res.end("Verified receipt not found"); return; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Hedera payment receipt</title><h1>Verified Hedera payment</h1><p>${payment.amountFormatted}</p><p>From ${payment.from} to ${payment.to}</p><p>Transaction ${payment.txId}</p><a href="${payment.explorerUrl}">Verify on HashScan</a></html>`);
    return;
  }

  if (pathname.startsWith("/receipt/") && req.method === "GET") {
    const id = pathname.slice("/receipt/".length);
    if (!/^0x[a-fA-F0-9]{64}$/.test(id)) { respond(404, { error: "Receipt not found" }); return; }
    res.writeHead(303, { Location: new URL(`/receipt/${id}`, webOrigin).toString() }); res.end(); return;
  }
  if (pathname !== "/" || req.method !== "GET") { respond(404, { error: "Route not found" }); return; }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>PulsePay payment API</title>
    <h1>PulsePay payment API</h1><p>Protected sample resources use real Hedera payment verification.</p>
    <p><a href="/.well-known/x402.json">Service discovery manifest</a></p>
    <p><a href="/merchant">Open the wallet-backed merchant console</a></p></html>`);
}

function hederaAmount(amount: bigint): string { return `${amount / 100000000n}.${(amount % 100000000n).toString().padStart(8, "0")}`; }
function hederaActivities(): NormalizedActivity[] {
  return verifiedPayments().map(p => ({ id: p.transactionId!, chainKey: "hedera", eventType: "AGENT_SPEND_SETTLED",
    from: p.payer!, to: p.recipient, asset: "HBAR", amountRaw: p.amount, amountFormatted: `${hederaAmount(BigInt(p.amount))} HBAR`,
    status: "CONFIRMED", txId: p.transactionId!, explorerUrl: `https://hashscan.io/${p.network === "hedera:mainnet" ? "mainnet" : "testnet"}/transaction/${p.transactionId}`,
    timestamp: Math.floor(Number(p.consensusTimestamp)) }));
}

server.listen(PORT, () => {
  console.log(`[PulsePay Payment API] Listening on http://localhost:${PORT}`);
  console.log(`Merchant console: ${webOrigin}/merchant`);
  console.log(`Discovery: http://localhost:${PORT}/.well-known/x402.json`);
});
