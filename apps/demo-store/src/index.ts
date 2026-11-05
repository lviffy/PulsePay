import http, { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import { handleX402PaymentCheck, generateX402Manifest, getVerifiedHederaPayments, formatAccountantCsv } from "@pulsepay/sdk-server";
import {
  WHITECHAIN_SEPOLIA_CHAIN_ID,
  WHITECHAIN_USDT_ADDRESS,
  WHITECHAIN_SEPOLIA_EXPLORER,
  NormalizedActivity,
} from "@pulsepay/shared";

const PORT = process.env.PORT || 3000;
const merchantAccountId = process.env.HEDERA_MERCHANT_ACCOUNT_ID;
if (!merchantAccountId || !/^\d+\.\d+\.\d+$/.test(merchantAccountId)) throw new Error("Set HEDERA_MERCHANT_ACCOUNT_ID to a testnet account you control");

// Acme paid market data service config for Hedera x402
const acmeServices = [
  {
    serviceId: "market-data-pro",
    serviceName: "Acme Real-Time Orderbook API",
    description: "High-frequency real-time orderbook feeds for autonomous trading agents.",
    price: {
      network: "hedera:testnet" as const,
      asset: "0.0.0", // Native HBAR
      amountTinybars: process.env.HEDERA_SERVICE_PRICE_TINYBARS || "1",
      payTo: merchantAccountId,
    },
  },
];

const mockActivities: NormalizedActivity[] = [
  {
    id: "act_whitechain_01",
    chainKey: "whitechain",
    eventType: "INVOICE_PAID",
    from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    asset: "USDT",
    amountFormatted: "$20.00",
    amountRaw: "20000000",
    status: "CONFIRMED",
    txId: "0x89274a...312e",
    explorerUrl: `${WHITECHAIN_SEPOLIA_EXPLORER}/tx/0x89274a...312e`,
    timestamp: Math.floor(Date.now() / 1000) - 1200,
  },
  {
    id: "act_uniswap_01",
    chainKey: "uniswap",
    eventType: "TREASURY_SWAP",
    from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    to: "0x00B036bf97F650eEa2f656606A6C4F07449c25f5",
    asset: "WETH -> USDC",
    amountFormatted: "0.1 WETH -> 250 USDC",
    amountRaw: "100000000000000000",
    status: "CONFIRMED",
    txId: "0x4a123f...9821",
    explorerUrl: "https://sepolia.unichain.org/tx/0x4a123f...9821",
    timestamp: Math.floor(Date.now() / 1000) - 300,
  },
];

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

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, PAYMENT-SIGNATURE, x-api-key");
  res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route 1: Machine-readable x402 discovery manifest for autonomous agents
  if (pathname === "/.well-known/x402.json" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(generateX402Manifest(acmeServices), null, 2));
    return;
  }

  // Route 2: Hedera x402 Protected Resource Endpoint
  if (pathname === "/v1/services/market-data-pro/query" && req.method === "POST") {
    const paymentSignature = req.headers["payment-signature"] as string | undefined;
    const check = await handleX402PaymentCheck(acmeServices[0], paymentSignature);

    if (!check.authorized) {
      res.writeHead(check.statusCode, check.headers);
      res.end(JSON.stringify(check.body, null, 2));
      return;
    }

    // Settled payload returned only after payment
    res.writeHead(200, {
      ...check.headers,
      "Content-Type": "application/json",
    });
    res.end(
      JSON.stringify(
        {
          status: "SUCCESS",
          service: "Acme Real-Time Orderbook API",
          data: {
            pair: "HBAR/USD",
            bids: [
              { price: 0.0825, volume: 154000 },
              { price: 0.0824, volume: 320000 },
            ],
            asks: [
              { price: 0.0827, volume: 110000 },
              { price: 0.0828, volume: 450000 },
            ],
            consensusTimestamp: Date.now(),
          },
        },
        null,
        2
      )
    );
    return;
  }

  // Route 3: Accountant CSV Export
  if (pathname === "/api/hedera/payments" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(getVerifiedHederaPayments()));
    return;
  }
  if (pathname === "/api/export.csv" && req.method === "GET") {
    const csvData = formatAccountantCsv([...mockActivities, ...hederaActivities()]);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pulsepay-ledger-${Date.now()}.csv"`,
    });
    res.end(csvData);
    return;
  }

  // Route 4: Merchant Console View
  if (pathname === "/merchant" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderMerchantHtml());
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

  // Route 5: Customer Receipt View
  if (pathname.startsWith("/receipt") && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderReceiptHtml());
    return;
  }

  // Route 6: Acme Studio Storefront with Drop-in PulsePay Checkout
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderStorefrontHtml());
}

function hederaAmount(amount: bigint): string { return `${amount / 100000000n}.${(amount % 100000000n).toString().padStart(8, "0")}`; }
function hederaActivities(): NormalizedActivity[] {
  return getVerifiedHederaPayments().map(p => ({ id: p.transactionId!, chainKey: "hedera", eventType: "AGENT_SPEND_SETTLED",
    from: p.payer!, to: p.recipient, asset: "HBAR", amountRaw: p.amount, amountFormatted: `${hederaAmount(BigInt(p.amount))} HBAR`,
    status: "CONFIRMED", txId: p.transactionId!, explorerUrl: `https://hashscan.io/${p.network === "hedera:mainnet" ? "mainnet" : "testnet"}/transaction/${p.transactionId}`,
    timestamp: Math.floor(Number(p.consensusTimestamp)) }));
}

function renderStorefrontHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Acme Studio — Powered by PulsePay</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 40px 20px; color: #0f172a; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .badge { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-block; margin-bottom: 12px; }
    h1 { font-size: 32px; font-weight: 700; margin: 0 0 10px; }
    p.subtitle { color: #64748b; font-size: 16px; margin: 0; }
    .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
    .plan-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .checkout-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
    .btn { display: block; width: 100%; padding: 14px; text-align: center; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 16px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; margin-top: 20px; box-sizing: border-box; }
    .btn:hover { background: #1d4ed8; }
    .btn-secondary { background: #f1f5f9; color: #334155; }
    .btn-secondary:hover { background: #e2e8f0; }
    .nav-links { margin-top: 32px; text-align: center; }
    .nav-links a { margin: 0 12px; color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 500; }
    .feature-list { list-style: none; padding: 0; margin: 24px 0; }
    .feature-list li { margin-bottom: 12px; font-size: 14px; color: #334155; display: flex; align-items: center; }
    .feature-list li::before { content: "✓"; color: #16a34a; font-weight: bold; margin-right: 8px; }
    .tab-btn { padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; width: 48%; }
    .tab-btn.active { border-color: #2563eb; background: #eff6ff; color: #1d4ed8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">ETHGlobal Mumbai 2026 Demo SaaS</div>
      <h1>Acme Studio Pro</h1>
      <p class="subtitle">Accepting stablecoin payments on Whitechain & token conversion via Uniswap</p>
    </div>

    <div class="card-grid">
      <div class="plan-card">
        <h3 style="margin: 0; font-size: 20px;">Acme Pro Plan</h3>
        <div style="font-size: 36px; font-weight: 800; margin: 16px 0 8px;">$20.00 <span style="font-size: 16px; color: #64748b; font-weight: 500;">USDT / mo</span></div>
        <p style="color: #64748b; font-size: 14px; margin: 0;">Full-featured analytics, automated workflows, and high-frequency data feeds.</p>
        
        <ul class="feature-list">
          <li>Settles in official Whitechain USDT (0xcedf...5a7)</li>
          <li>Pay with any token via Uniswap Universal Router</li>
          <li>Cancel-anytime recurring subscription authorization</li>
          <li>Verifiable customer receipt with one-click refund support</li>
        </ul>
      </div>

      <div class="checkout-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600;">PulsePay Drop-In Checkout</h4>
          <span style="font-size: 11px; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-weight: 600;">Chain: 1874</span>
        </div>

        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #64748b;">Amount Due</div>
          <div style="font-size: 24px; font-weight: 700;">$20.00 USDT</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Contract: PulsePayMerchantHub.sol</div>
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">Payment Rail:</div>
          <div style="display: flex; justify-content: space-between;">
            <button class="tab-btn active" id="btn-usdt" onclick="selectTab('USDT')">Direct USDT</button>
            <button class="tab-btn" id="btn-swap" onclick="selectTab('SWAP')">Pay with WETH (Uniswap)</button>
          </div>
        </div>

        <div id="swap-details" style="display: none; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 600; color: #1e40af;">Uniswap Swap Routing</div>
          <div style="font-size: 12px; color: #3b82f6; margin-top: 4px;">Quote: <strong>0.0080 WETH</strong> → <strong>20.00 USDT</strong></div>
          <div style="font-size: 10px; color: #60a5fa; margin-top: 2px;">Slippage: 0.5% | Universal Router 2.0</div>
        </div>

        <button class="btn" id="pay-btn" onclick="executePayment()">Pay $20.00 on Whitechain</button>
        <div id="payment-status" style="display: none; margin-top: 12px; font-size: 13px; text-align: center;"></div>
      </div>
    </div>

    <div class="nav-links">
      <a href="/merchant">Merchant Operations Console →</a>
      <a href="/receipt/inv_acme_pro_001">Customer Verifiable Receipt →</a>
      <a href="/.well-known/x402.json" target="_blank">x402 Agent Discovery Manifest ↗</a>
    </div>
  </div>

  <script>
    let mode = 'USDT';
    function selectTab(tab) {
      mode = tab;
      document.getElementById('btn-usdt').className = 'tab-btn ' + (tab === 'USDT' ? 'active' : '');
      document.getElementById('btn-swap').className = 'tab-btn ' + (tab === 'SWAP' ? 'active' : '');
      document.getElementById('swap-details').style.display = tab === 'SWAP' ? 'block' : 'none';
      document.getElementById('pay-btn').innerText = tab === 'SWAP' ? 'Swap & Pay with WETH' : 'Pay $20.00 on Whitechain';
    }

    function executePayment() {
      const btn = document.getElementById('pay-btn');
      const status = document.getElementById('payment-status');
      btn.disabled = true;
      btn.innerText = 'Submitting Transaction...';
      status.style.display = 'block';
      status.style.color = '#2563eb';
      status.innerText = 'Confirming payment on Whitechain Sepolia (Chain ID 1874)...';

      setTimeout(() => {
        btn.innerText = '✓ Payment Settled';
        btn.style.background = '#16a34a';
        status.style.color = '#16a34a';
        status.innerHTML = 'Payment Confirmed! <a href="/receipt/inv_acme_pro_001" style="color:#2563eb;text-decoration:underline;">View Verifiable Receipt →</a>';
      }, 1500);
    }
  </script>
</body>
</html>`;
}

function renderReceiptHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PulsePay — Verifiable Customer Receipt</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px 20px; color: #0f172a; }
    .card { max-width: 500px; margin: 0 auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
    .label { color: #64748b; }
    .val { font-weight: 500; }
    .status-badge { background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; }
    .divider { border-top: 1px solid #f1f5f9; margin: 20px 0; }
    a.link { color: #2563eb; text-decoration: underline; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 18px;">Customer Receipt</h2>
      <span class="status-badge" id="receipt-badge">PAID (CONFIRMED)</span>
    </div>

    <div class="row"><span class="label">Invoice ID</span><span class="val">inv_acme_pro_001</span></div>
    <div class="row"><span class="label">Merchant</span><span class="val">0xf39F...2266 (Acme Studio)</span></div>
    <div class="row"><span class="label">Customer</span><span class="val">0x7099...79C8</span></div>
    <div class="row"><span class="label">Network</span><span class="val">Whitechain Sepolia (1874)</span></div>

    <div class="divider"></div>

    <div class="row"><span class="label">Total Paid</span><span class="val" style="font-size: 18px; font-weight: 700;">$20.00 USDT</span></div>
    <div class="row" id="refund-row" style="display:none; color:#b91c1c;"><span class="label">Cumulative Refund</span><span class="val" style="font-size: 16px; font-weight: 600;">-$5.00 USDT</span></div>

    <div class="divider"></div>

    <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">Onchain Explorer Proofs:</div>
    <div style="margin-bottom: 8px;">
      <a class="link" href="${WHITECHAIN_SEPOLIA_EXPLORER}/address/${WHITECHAIN_USDT_ADDRESS}" target="_blank">
        Official USDT Contract (${WHITECHAIN_USDT_ADDRESS.slice(0, 10)}...) ↗
      </a>
    </div>
    <div style="margin-bottom: 8px;">
      <a class="link" href="${WHITECHAIN_SEPOLIA_EXPLORER}/tx/0x89274a...312e" target="_blank">
        Payment Settlement Transaction ↗
      </a>
    </div>
    <div id="refund-link-box" style="display:none; margin-top: 8px;">
      <a class="link" style="color: #d97706;" href="${WHITECHAIN_SEPOLIA_EXPLORER}/tx/0xrefund...789" target="_blank">
        Refund Transaction (#1: $5.00) ↗
      </a>
    </div>

    <div style="margin-top: 24px; text-align: center;">
      <a href="/" style="font-size: 13px; color: #64748b; text-decoration: none;">← Back to Acme Studio</a>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('refunded') === 'true') {
      document.getElementById('receipt-badge').innerText = 'PARTIALLY REFUNDED';
      document.getElementById('receipt-badge').style.background = '#fef3c7';
      document.getElementById('receipt-badge').style.color = '#92400e';
      document.getElementById('refund-row').style.display = 'flex';
      document.getElementById('refund-link-box').style.display = 'block';
    }
  </script>
</body>
</html>`;
}

function renderMerchantHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PulsePay — Merchant Billing Console</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, sans-serif; background: #f8fafc; padding: 40px 20px; color: #0f172a; }
    .container { max-width: 900px; margin: 0 auto; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .metrics { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .table-box { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #f8fafc; padding: 12px; color: #475569; font-weight: 600; border-bottom: 1px solid #e2e8f0; }
    td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
    .btn-refund { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .btn-export { background: #0f172a; color: #fff; padding: 8px 16px; border-radius: 6px; border: none; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-bar">
      <div>
        <h2 style="margin: 0; font-size: 22px;">Merchant Financial Console</h2>
        <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Acme Studio (Whitechain Sepolia · Hedera x402 · Uniswap v4)</div>
      </div>
      <div>
        <a href="/api/export.csv" class="btn-export">Export Accountant CSV</a>
      </div>
    </div>

    <div class="metrics">
      <div class="card">
        <div style="font-size: 12px; color: #64748b;">Available Proceeds</div>
        <div style="font-size: 26px; font-weight: 700;" id="avail-txt">$80.00 USDT</div>
        <div style="font-size: 11px; color: #166534; margin-top: 4px;">80% of settled payments</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: #64748b;">Refund Reserve Balance</div>
        <div style="font-size: 26px; font-weight: 700;" id="reserve-txt">$20.00 USDT</div>
        <div style="font-size: 11px; color: #d97706; margin-top: 4px;">20% reserve protected onchain</div>
      </div>
      <div class="card">
        <div style="font-size: 12px; color: #64748b;">Agent API Revenue (Hedera)</div>
        <div style="font-size: 26px; font-weight: 700;">${hederaAmount(getVerifiedHederaPayments().reduce((sum, p) => sum + BigInt(p.amount), 0n))} HBAR</div>
        <div style="font-size: 11px; color: #2563eb; margin-top: 4px;">Verified native HBAR receipts</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; font-size: 15px;">Invoice #inv_acme_pro_001 — $20.00 USDT</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Customer: 0x7099...79C8 (Paid in full)</div>
        </div>
        <div>
          <button class="btn-refund" id="refund-btn" onclick="executeRefund()">Issue $5.00 Partial Refund</button>
        </div>
      </div>
      <div id="refund-msg" style="display: none; margin-top: 10px; font-size: 13px; color: #166534; font-weight: 500;"></div>
    </div>

    <div class="table-box">
      <table>
        <thead>
          <tr>
            <th>Chain</th>
            <th>Event</th>
            <th>Asset / Amount</th>
            <th>Status</th>
            <th>Explorer Reference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong style="color: #047857;">WHITECHAIN</strong></td>
            <td>Invoice Settled</td>
            <td>$20.00 USDT</td>
            <td style="color: #16a34a;">✓ CONFIRMED</td>
            <td><a href="${WHITECHAIN_SEPOLIA_EXPLORER}" target="_blank" style="color: #2563eb;">Explorer ↗</a></td>
          </tr>
          ${hederaActivities().map(a => `<tr><td>HEDERA</td><td>Agent Payment Settled</td><td>${a.amountFormatted}</td><td>CONFIRMED</td><td><a href="${a.explorerUrl}" target="_blank">HashScan ↗</a> · <a href="/receipt/hedera/${a.txId}">Receipt</a></td></tr>`).join("")}
          <tr>
            <td><strong style="color: #7e22ce;">UNISWAP V4</strong></td>
            <td>Treasury Swap Guarded</td>
            <td>0.1 WETH -> 250 USDC</td>
            <td style="color: #16a34a;">✓ CONFIRMED</td>
            <td><a href="https://sepolia.unichain.org" target="_blank" style="color: #2563eb;">Unichain ↗</a></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="margin-top: 24px; text-align: center;">
      <a href="/" style="font-size: 13px; color: #64748b; text-decoration: none;">← Return to Storefront</a>
    </div>
  </div>

  <script>
    function executeRefund() {
      const btn = document.getElementById('refund-btn');
      const msg = document.getElementById('refund-msg');
      btn.disabled = true;
      btn.innerText = 'Refunding on Whitechain...';

      setTimeout(() => {
        btn.innerText = '✓ Refunded';
        btn.style.background = '#f1f5f9';
        btn.style.color = '#94a3b8';
        document.getElementById('reserve-txt').innerText = '$15.00 USDT';
        msg.style.display = 'block';
        msg.innerHTML = 'Successfully issued $5.00 refund to customer! <a href="/receipt/inv_acme_pro_001?refunded=true" style="color:#2563eb;text-decoration:underline;">View Updated Receipt →</a>';
      }, 1200);
    }
  </script>
</body>
</html>`;
}

server.listen(PORT, () => {
  console.log(`[PulsePay Demo Store] Server running at http://localhost:${PORT}`);
  console.log(`  - Storefront Checkout:       http://localhost:${PORT}`);
  console.log(`  - Merchant Console:          http://localhost:${PORT}/merchant`);
  console.log(`  - Customer Receipt:          http://localhost:${PORT}/receipt/inv_acme_pro_001`);
  console.log(`  - x402 Discovery Manifest:   http://localhost:${PORT}/.well-known/x402.json`);
  console.log(`  - Protected API Resource:    POST http://localhost:${PORT}/v1/services/market-data-pro/query`);
});

