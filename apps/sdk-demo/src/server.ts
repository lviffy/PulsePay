import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createPulsePay, whitechainSepolia } from "@pulsepay/sdk-core";
import { handleX402PaymentCheck, X402RouteConfig } from "@pulsepay/sdk-server";
import { stringToHex, formatUnits, createWalletClient, http as viemHttp } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Load .env from root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../../.env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const PORT = process.env.DEMO_PORT || 3005;
const WHITECHAIN_RPC = process.env.WHITECHAIN_RPC_URL || "https://rpc.testnet.whitechain.io";
const WHITECHAIN_HUB = (process.env.WHITECHAIN_MERCHANT_HUB_ADDRESS || "0xb115ceb2cf3c15a5c1a607284f0599ad6531bbc2") as `0x${string}`;
const WHITECHAIN_USDT = (process.env.WHITECHAIN_USDT_ADDRESS || "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7") as `0x${string}`;
const WHITECHAIN_KEY = process.env.WHITECHAIN_PRIVATE_KEY
  ? ((process.env.WHITECHAIN_PRIVATE_KEY.startsWith("0x")
      ? process.env.WHITECHAIN_PRIVATE_KEY
      : `0x${process.env.WHITECHAIN_PRIVATE_KEY}`) as `0x${string}`)
  : undefined;
const EXPLORER_URL = process.env.WHITECHAIN_EXPLORER_URL || "https://explorer.testnet.whitechain.io";

let walletClient: any = undefined;
let merchantAddress = "0x6105F7D9807998014ca12bF1D67849de7B1094Ac" as `0x${string}`;
if (WHITECHAIN_KEY) {
  const acct = privateKeyToAccount(WHITECHAIN_KEY);
  merchantAddress = acct.address;
  walletClient = createWalletClient({
    account: acct,
    chain: whitechainSepolia,
    transport: viemHttp(WHITECHAIN_RPC),
  });
}

const pulsepay = createPulsePay({
  whitechain: {
    contractAddress: WHITECHAIN_HUB,
    usdtAddress: WHITECHAIN_USDT,
    rpcUrl: WHITECHAIN_RPC,
    walletClient,
  },
  ccip: {
    chainId: 11155111,
    rpcUrl: process.env.CCIP_RPC_URL || process.env.SEPOLIA_RPC_URL,
  },
});

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(
    JSON.stringify(
      data,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2
    )
  );
}

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  // --- API Routes ---
  if (url.pathname === "/api/status") {
    return sendJson(res, 200, {
      status: "online",
      whitechain: {
        contractHub: WHITECHAIN_HUB,
        usdtAddress: WHITECHAIN_USDT,
        rpcUrl: WHITECHAIN_RPC,
        merchantAddress,
        explorerUrl: `${EXPLORER_URL}/address/${WHITECHAIN_HUB}`,
      },
      ccip: {
        network: "Ethereum Sepolia -> Hedera Testnet",
        router: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
      },
      hedera: {
        network: "hedera:testnet",
        auditTopicId: "0.0.11330043",
      },
    });
  }

  if (url.pathname === "/api/whitechain/balances") {
    try {
      const balances = await pulsepay.payments.getBalances(merchantAddress);
      return sendJson(res, 200, {
        merchant: merchantAddress,
        refundReserveUnits: balances.reserve.toString(),
        refundReserveFormatted: `${formatUnits(balances.reserve, 6)} USDT`,
        merchantAvailableUnits: balances.available.toString(),
        merchantAvailableFormatted: `${formatUnits(balances.available, 6)} USDT`,
      });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (url.pathname === "/api/whitechain/create-invoice" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const code = body.code || `INV-${Date.now().toString().slice(-6)}`;
      const amount = BigInt(body.amountUsdt || 20) * 1_000_000n;
      const invoiceIdHex = stringToHex(code, { size: 32 });
      const dueAtSeconds = Math.floor(Date.now() / 1000) + 86400 * 7;

      if (!walletClient) {
        const calldata = pulsepay.invoices.encodeCreate(
          invoiceIdHex,
          "0x0000000000000000000000000000000000000000",
          amount,
          dueAtSeconds
        );
        return sendJson(res, 200, {
          mode: "encoded",
          code,
          invoiceIdHex,
          amountUsdt: body.amountUsdt || 20,
          calldata,
        });
      }

      const txResult = await pulsepay.invoices.create({
        invoiceId: invoiceIdHex,
        amountUnits: amount,
        dueAtSeconds,
      });

      return sendJson(res, 200, {
        mode: "on-chain",
        code,
        invoiceIdHex,
        amountUsdt: body.amountUsdt || 20,
        txHash: txResult.txHash,
        blockNumber: txResult.receipt.blockNumber.toString(),
        explorerUrl: `${EXPLORER_URL}/tx/${txResult.txHash}`,
      });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (url.pathname.startsWith("/api/whitechain/invoice/")) {
    try {
      const id = url.pathname.split("/").pop() as `0x${string}`;
      const inv = await pulsepay.invoices.get(id);
      return sendJson(res, 200, inv);
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (url.pathname === "/api/ccip/quote" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      if (!process.env.CCIP_TOKEN_ADDRESS) throw new Error("Set CCIP_TOKEN_ADDRESS to a supported source-chain token");
      const targetUnits = BigInt(body.amountUnits || 10_000_000);
      const quote = await pulsepay.bridgeOps.quoteFee({
        destinationChainSelector: 222782988166878823n, // Hedera testnet selector
        tokenAddress: process.env.CCIP_TOKEN_ADDRESS as `0x${string}`,
        amountUnits: targetUnits,
        recipientAddress: merchantAddress,
      });

      return sendJson(res, 200, quote);
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (url.pathname === "/api/ccip/build-bridge" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      if (!process.env.CCIP_TOKEN_ADDRESS) throw new Error("Set CCIP_TOKEN_ADDRESS to a supported source-chain token");
      const targetUnits = BigInt(body.amountUnits || 10_000_000);
      const bridgeTxs = await pulsepay.bridgeOps.buildTransactions({
        destinationChainSelector: 222782988166878823n,
        tokenAddress: process.env.CCIP_TOKEN_ADDRESS as `0x${string}`,
        amountUnits: targetUnits,
        recipientAddress: merchantAddress,
        payerAddress: merchantAddress,
      });

      return sendJson(res, 200, {
        routerTarget: bridgeTxs.to,
        nativeFeeWei: bridgeTxs.value.toString(),
        calldata: bridgeTxs.data,
        calldataBytes: bridgeTxs.data.length / 2,
        approvalTx: bridgeTxs.approvalTx ? { ...bridgeTxs.approvalTx, value: "0" } : undefined,
        monitoring: "After wallet submission, use the actual bytes32 message ID with bridgeOps.getStatus or waitForDelivery.",
      });
    } catch (err: any) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (url.pathname === "/api/hedera/challenge") {
    const routeConfig: X402RouteConfig = {
      serviceId: "market-data-pro",
      serviceName: "Pro Orderbook Stream",
      price: {
        network: "hedera:testnet",
        asset: "0.0.0",
        amountTinybars: "50000000", // 0.5 HBAR
        payTo: "0.0.11327364",
      },
    };

    const auth = await handleX402PaymentCheck(routeConfig, null);

    return sendJson(res, 200, {
      httpStatus: auth.statusCode,
      challenge: auth.body,
      instructions: "Autonomous AI Agent signs a TransferTransaction to the recipient with memo: PulsePay x402: <hash>",
    });
  }

  // --- Serve HTML UI ---
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PulsePay SDK Showcase & Demonstration</title>
  <style>
    :root {
      --bg: #090d16;
      --card: #121826;
      --border: #1e293b;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --green: #10b981;
      --purple: #8b5cf6;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 30px; min-height: 100vh; }
    .header { max-width: 1100px; margin: 0 auto 30px auto; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
    .logo { font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .badge { background: rgba(16, 185, 129, 0.15); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.3); padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
    .container { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; flex-direction: column; }
    .card h3 { font-size: 18px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .card p.desc { color: var(--muted); font-size: 13px; line-height: 1.5; margin-bottom: 18px; flex-grow: 1; }
    .btn { background: var(--accent); color: white; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
    .btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
    .btn-green { background: #059669; }
    .btn-green:hover { background: #047857; }
    .btn-purple { background: #7c3aed; }
    .btn-purple:hover { background: #6d28d9; }
    .output { margin-top: 14px; background: #050811; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px; color: #a5f3fc; max-height: 220px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
    .link { color: #60a5fa; text-decoration: none; font-size: 12px; font-weight: 600; display: inline-block; margin-top: 10px; }
    .link:hover { text-decoration: underline; }
    .status-bar { max-width: 1100px; margin: 30px auto 0 auto; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 20px; font-size: 13px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo" style="display: flex; align-items: center;"><svg width="28" height="28" viewBox="0 0 100 100" fill="#60a5fa" style="vertical-align: middle; margin-right: 10px; display: inline-block;"><path d="M 50.32 2.79 c -2.64 0.25 -4.63 0.84 -6.51 1.92 -0.77 0.44 -0.97 0.59 -1.90 1.37 -0.82 0.68 -1.52 1.48 -2.75 3.11 -2.00 2.66 -3.89 4.21 -5.94 4.87 -1.44 0.47 -2.37 0.56 -5.67 0.53 -2.52 -0.02 -2.60 -0.02 -3.65 0.20 -3.29 0.65 -5.79 1.93 -8.13 4.18 -1.66 1.60 -2.96 3.56 -3.84 5.79 -0.98 2.49 -1.21 4.77 -0.81 7.86 0.41 3.20 0.25 5.26 -0.57 7.34 -0.63 1.58 -1.52 2.87 -3.59 5.17 -2.71 3.02 -4.25 5.91 -5.00 9.40 -0.95 4.46 0.42 9.90 3.53 13.97 1.37 1.79 2.44 2.75 4.99 4.46 2.86 1.92 3.33 2.27 4.17 3.12 0.64 0.64 1.71 2.03 1.71 2.21 0.00 0.02 0.10 0.21 0.22 0.42 0.40 0.69 1.01 2.38 1.20 3.37 0.34 1.75 0.82 3.64 1.03 4.16 0.04 0.09 0.21 0.50 0.37 0.91 0.58 1.45 1.56 3.09 2.63 4.37 0.66 0.79 1.93 2.03 2.61 2.55 2.06 1.58 4.55 2.72 7.06 3.26 0.76 0.16 1.10 0.18 2.62 0.18 1.63 -0.00 1.82 -0.02 2.78 -0.23 1.77 -0.38 3.35 -1.00 4.76 -1.84 1.80 -1.07 3.75 -1.92 5.12 -2.25 0.37 -0.09 0.87 -0.20 1.11 -0.26 0.68 -0.17 3.81 -0.14 4.72 0.04 2.25 0.44 4.00 1.14 6.98 2.83 0.40 0.22 0.74 0.40 0.77 0.40 0.03 -0.00 0.29 0.11 0.58 0.24 0.29 0.13 0.55 0.24 0.59 0.24 0.04 -0.00 0.22 0.07 0.41 0.15 0.19 0.09 0.78 0.26 1.30 0.40 3.66 0.91 7.21 0.32 10.75 -1.82 3.09 -1.86 5.33 -4.31 6.83 -7.48 0.60 -1.27 1.01 -2.56 1.31 -4.07 0.06 -0.35 0.16 -0.78 0.20 -0.95 0.04 -0.17 0.15 -0.67 0.25 -1.11 0.33 -1.56 1.02 -3.40 1.69 -4.53 0.59 -0.99 1.07 -1.60 1.97 -2.46 0.90 -0.86 1.58 -1.35 3.52 -2.53 2.44 -1.49 3.83 -2.67 5.31 -4.52 1.46 -1.82 2.64 -4.26 3.17 -6.56 0.26 -1.14 0.36 -1.79 0.41 -2.98 0.10 -1.85 -0.18 -3.93 -0.74 -5.59 -0.82 -2.42 -2.08 -4.48 -4.12 -6.67 -1.22 -1.33 -1.77 -2.06 -2.40 -3.25 -1.04 -1.94 -1.40 -4.06 -1.09 -6.31 0.06 -0.44 0.18 -1.08 0.28 -1.43 0.09 -0.35 0.21 -0.82 0.25 -1.03 0.05 -0.22 0.12 -0.56 0.16 -0.75 0.38 -1.79 0.41 -4.92 0.07 -6.39 -0.27 -1.16 -0.35 -1.46 -0.61 -2.16 -1.46 -3.97 -4.84 -7.03 -9.11 -8.23 -0.94 -0.26 -2.79 -0.52 -3.75 -0.52 -4.38 -0.01 -7.08 -1.29 -9.63 -4.59 -2.13 -2.75 -2.94 -3.67 -4.21 -4.71 -1.37 -1.14 -2.77 -1.99 -4.44 -2.71 -1.01 -0.44 -2.83 -0.88 -4.25 -1.06 -1.03 -0.12 -3.60 -0.13 -4.72 -0.02 Z m 3.56 11.67 c 1.45 0.16 3.33 0.92 4.50 1.81 1.17 0.90 1.99 1.78 3.20 3.41 2.28 3.10 4.29 4.77 6.85 5.69 1.02 0.37 3.21 0.67 4.90 0.67 1.62 -0.00 3.45 0.60 4.93 1.60 2.48 1.68 3.81 4.18 3.81 7.13 0.00 0.84 -0.06 1.35 -0.43 3.69 -0.25 1.55 -0.26 2.56 -0.05 3.87 0.35 2.12 1.13 3.70 3.00 6.04 1.08 1.37 1.26 1.63 2.06 3.08 0.23 0.42 0.70 1.68 0.89 2.42 0.28 1.09 0.40 2.73 0.27 3.90 -0.13 1.25 -0.15 1.39 -0.44 2.28 -0.99 2.98 -3.05 5.20 -6.22 6.71 -2.77 1.33 -4.40 2.89 -5.37 5.16 -0.45 1.07 -0.51 1.26 -0.89 3.17 -0.06 0.33 -0.16 0.79 -0.21 1.03 -0.09 0.44 -0.27 1.07 -0.56 1.94 -0.25 0.72 -0.90 1.99 -1.40 2.68 -0.91 1.27 -2.48 2.55 -3.82 3.11 -1.31 0.55 -1.79 0.63 -3.54 0.63 -1.50 -0.00 -1.63 -0.02 -2.37 -0.22 -1.44 -0.41 -2.61 -0.97 -4.25 -2.02 -0.90 -0.58 -0.97 -0.62 -1.39 -0.85 -0.20 -0.11 -0.52 -0.29 -0.73 -0.40 -0.73 -0.40 -2.17 -0.95 -3.08 -1.17 -1.35 -0.33 -3.20 -0.39 -4.60 -0.17 -0.99 0.16 -2.67 0.71 -3.75 1.24 -0.45 0.21 -1.35 0.71 -1.99 1.10 -2.17 1.30 -3.34 1.78 -4.98 2.03 -3.30 0.52 -6.59 -0.84 -8.48 -3.52 -0.72 -1.02 -1.42 -2.63 -1.64 -3.77 -0.19 -1.02 -0.31 -2.05 -0.31 -2.75 0.00 -2.63 -0.73 -4.79 -2.22 -6.63 -1.06 -1.30 -2.47 -2.25 -4.48 -3.06 -3.34 -1.33 -5.37 -3.33 -6.43 -6.35 -0.50 -1.44 -0.61 -2.59 -0.40 -4.10 0.13 -0.98 0.41 -1.83 0.92 -2.81 0.54 -1.06 1.18 -1.91 2.58 -3.42 1.94 -2.11 2.53 -2.87 3.33 -4.39 1.18 -2.24 1.56 -4.61 1.14 -7.09 -0.21 -1.25 -0.28 -2.73 -0.17 -3.66 0.38 -3.06 2.63 -5.79 5.61 -6.82 1.45 -0.51 2.20 -0.59 5.03 -0.57 2.57 0.02 3.14 -0.04 4.40 -0.48 2.30 -0.80 3.74 -1.94 5.90 -4.64 1.17 -1.48 2.52 -2.87 3.39 -3.52 1.18 -0.88 3.14 -1.71 4.48 -1.91 1.25 -0.18 1.91 -0.20 3.00 -0.08 Z" fill-rule="evenodd"/></svg><span>PulsePay SDK Live Demonstration</span></div>
      <div style="color: var(--muted); font-size: 14px; margin-top: 4px;">Universal on-chain settlement across Whitechain, Chainlink CCIP 2.0, and Hedera</div>
    </div>
    <div class="badge">● Live Testnets Connected</div>
  </div>

  <div class="container">
    <!-- Card 1: Whitechain -->
    <div class="card">
      <h3>🏛️ Whitechain Sepolia</h3>
      <p class="desc">Execute real on-chain merchant settlements, reserve-backed verifiable refunds, and view live balances on the deployed <code>PulsePayMerchantHub</code>.</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="btn" onclick="checkBalances()">Query Contract Reserves</button>
        <button class="btn btn-green" onclick="createInvoice()">Create On-Chain Invoice</button>
      </div>
      <a class="link" href="${EXPLORER_URL}/address/${WHITECHAIN_HUB}" target="_blank">↗ View Contract on Blockscout</a>
      <div id="whitechain-out" class="output">// Click a button above to execute live contract call...</div>
    </div>

    <!-- Card 2: Chainlink CCIP 2.0 Token Bridging -->
    <div class="card">
      <h3>🔗 Chainlink CCIP 2.0</h3>
      <p class="desc">Cross-chain token bridging via official CCIP Routers with 0-gas destination callbacks directly to recipient wallets.</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="btn btn-purple" onclick="getQuote()">Get CCIP Bridge Fee Quote</button>
        <button class="btn" onclick="buildBridge()">Build CCIP Router Calldata</button>
      </div>
      <a class="link" href="https://ccip.chain.link" target="_blank">↗ Chainlink CCIP Explorer</a>
      <div id="ccip-out" class="output">// Click a button to quote cross-chain bridge fee...</div>
    </div>

    <!-- Card 3: Hedera x402 -->
    <div class="card">
      <h3>🌐 Hedera Agent Paywall</h3>
      <p class="desc">Server-side x402 micropayment challenge generator and mirror-node consensus verifier for autonomous AI agents.</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button class="btn" onclick="getChallenge()">Generate x402 Challenge</button>
      </div>
      <a class="link" href="https://hashscan.io/testnet/topic/0.0.11330043" target="_blank">↗ View HCS Audit Topic on HashScan</a>
      <div id="hedera-out" class="output">// Request an actual HTTP 402 challenge (no payment is submitted)...</div>
    </div>
  </div>

  <div class="status-bar">
    <div><strong>Deployed Hub:</strong> <code style="color: #60a5fa;">${WHITECHAIN_HUB}</code></div>
    <div><strong>Hedera Topic:</strong> <code style="color: #a78bfa;">0.0.11330043</code></div>
    <div><strong>USDT Token:</strong> <code style="color: #34d399;">${WHITECHAIN_USDT}</code></div>
  </div>

  <script>
    async function checkBalances() {
      const out = document.getElementById('whitechain-out');
      out.textContent = "Querying live contract balances...";
      try {
        const res = await fetch('/api/whitechain/balances');
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = "Error: " + err.message;
      }
    }

    async function createInvoice() {
      const out = document.getElementById('whitechain-out');
      out.textContent = "Submitting createInvoice() on Whitechain Sepolia...";
      try {
        const res = await fetch('/api/whitechain/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountUsdt: 25 })
        });
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = "Error: " + err.message;
      }
    }

    async function getQuote() {
      const out = document.getElementById('ccip-out');
      out.textContent = "Querying live CCIP bridge fee from Sepolia -> Hedera...";
      try {
        const res = await fetch('/api/ccip/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountUnits: '10000000' })
        });
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = "Error: " + err.message;
      }
    }

    async function buildBridge() {
      const out = document.getElementById('ccip-out');
      out.textContent = "Building CCIP ccipSend() router calldata with gasLimit = 0...";
      try {
        const res = await fetch('/api/ccip/build-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountUnits: '10000000' })
        });
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = "Error: " + err.message;
      }
    }

    async function getChallenge() {
      const out = document.getElementById('hedera-out');
      out.textContent = "Negotiating x402 challenge...";
      try {
        const res = await fetch('/api/hedera/challenge');
        const data = await res.json();
        out.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        out.textContent = "Error: " + err.message;
      }
    }
  </script>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`
===========================================================
  ⚡ PulsePay SDK Interactive Web Demonstration
===========================================================
  Local Dashboard: http://localhost:${PORT}
  Whitechain Hub:  ${WHITECHAIN_HUB}
  Explorer:        ${EXPLORER_URL}/address/${WHITECHAIN_HUB}
===========================================================
`);
});
