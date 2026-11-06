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
      <div class="logo">⚡ PulsePay SDK Live Demonstration</div>
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
