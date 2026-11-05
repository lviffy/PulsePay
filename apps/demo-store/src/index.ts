import http, { IncomingMessage, ServerResponse } from "http";
import { parse } from "url";
import crypto from "crypto";
import { handleX402PaymentCheck, generateX402Manifest, getVerifiedHederaPayments, formatAccountantCsv } from "@pulsepay/sdk-server";
import {
  WHITECHAIN_SEPOLIA_CHAIN_ID,
  WHITECHAIN_USDT_ADDRESS,
  WHITECHAIN_SEPOLIA_EXPLORER,
  UNICHAIN_SEPOLIA_CHAIN_ID,
  UNICHAIN_SEPOLIA_POOL_MANAGER,
  HEDERA_TESTNET_CHAIN_ID,
  NormalizedActivity,
} from "@pulsepay/shared";

const PORT = process.env.PORT || 3000;
const merchantAccountId = process.env.HEDERA_MERCHANT_ACCOUNT_ID;
if (!merchantAccountId || !/^\d+\.\d+\.\d+$/.test(merchantAccountId)) throw new Error("Set HEDERA_MERCHANT_ACCOUNT_ID to a testnet account you control");

// ============================================================================
// Data Stores & Live State
// ============================================================================

export interface StoreInvoice {
  id: string;
  customer: string;
  title: string;
  amountUsdt: number;
  reserveHeldUsdt: number;
  rail: "Direct USDT (Whitechain)" | "Uniswap Pay-With-Any-Token";
  status: "PAID" | "PARTIALLY_REFUNDED" | "FULLY_REFUNDED" | "OPEN" | "EXPIRED";
  dueAt: string;
  paidAt?: string;
  refundedAmountUsdt: number;
  refundReason?: string;
  txHash?: string;
  receiptUrl: string;
}

export interface StoreSubscription {
  id: string;
  subscriber: string;
  planName: string;
  cycle: string;
  nextChargeDate: string;
  amountPerCycleUsdt: number;
  totalPaidUsdt: number;
  status: "ACTIVE" | "GRACE_PERIOD" | "CANCELLED";
}

export interface UniswapConfig {
  hookAddress: string;
  poolManager: string;
  hookPaused: boolean;
  maxSwapAmountUsdt: number;
  totalCustomerSwaps: number;
  totalConvertedVolumeUsdt: number;
  averageSlippagePercent: number;
  lpPosition: {
    pool: string;
    tier: string;
    range: string;
    positionValueUsdt: number;
    unclaimedFeesUsdt: number;
    aprPercent: number;
  };
}

export interface AgentCommerceState {
  hcsTopicId: string;
  merchantAccountId: string;
  totalAgentCalls: number;
  totalHbarTinybars: bigint;
  dailyBudgetHbar: number;
  maxPerRequestHbar: number;
  allowlist: string[];
}

// Initial state
const merchantState = {
  metrics: {
    totalGrossRevenueUsdt: 12480.0,
    availableProceedsUsdt: 9984.0,
    refundReserveBalanceUsdt: 2496.0,
    uniswapConvertedSalesUsdt: 4250.0,
    agentRevenueHbar: 0,
    mrrUsdt: 4120.0,
    activeSubscribersCount: 38,
    totalInvoicesCount: 184,
    totalRefundsCount: 4,
    totalRefundedUsdt: 125.0,
  },
  uniswap: {
    hookAddress: "0x00C0A5F1b837269D3E9d6092F0eF675fA5517178",
    poolManager: UNICHAIN_SEPOLIA_POOL_MANAGER,
    hookPaused: false,
    maxSwapAmountUsdt: 10000.0,
    totalCustomerSwaps: 62,
    totalConvertedVolumeUsdt: 4250.0,
    averageSlippagePercent: 0.12,
    lpPosition: {
      pool: "USDT / USDC",
      tier: "0.05%",
      range: "0.9980 - 1.0020",
      positionValueUsdt: 24500.0,
      unclaimedFeesUsdt: 184.2,
      aprPercent: 14.2,
    },
  } as UniswapConfig,
  agentCommerce: {
    hcsTopicId: process.env.HEDERA_AUDIT_TOPIC_ID || "",
    merchantAccountId,
    totalAgentCalls: 0,
    totalHbarTinybars: 0n,
    dailyBudgetHbar: Number(process.env.HEDERA_DAILY_BUDGET_TINYBARS || "10") / 1e8,
    maxPerRequestHbar: Number(process.env.HEDERA_MAX_PAYMENT_TINYBARS || "1") / 1e8,
    allowlist: [merchantAccountId],
  } as AgentCommerceState,
  webhooks: {
    endpoint: "https://api.acmestudio.com/webhooks/pulsepay",
    secret: "whsec_live_948f2a67e103b4cd81e9f1a2",
    events: ["invoice.paid", "payment.refunded", "subscription.renewed", "agent.x402_settled"],
  },
};

const storeInvoices: StoreInvoice[] = [
  {
    id: "inv_acme_pro_001",
    customer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    title: "Acme Studio Pro — Monthly Subscription",
    amountUsdt: 20.0,
    reserveHeldUsdt: 4.0,
    rail: "Direct USDT (Whitechain)",
    status: "PAID",
    dueAt: "2026-11-06",
    paidAt: "2026-11-05 23:45",
    refundedAmountUsdt: 0.0,
    txHash: "0x89274a...312e",
    receiptUrl: "/receipt/inv_acme_pro_001",
  },
  {
    id: "inv_acme_pro_002",
    customer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    title: "Acme Studio Pro — Annual Upgrade",
    amountUsdt: 200.0,
    reserveHeldUsdt: 40.0,
    rail: "Uniswap Pay-With-Any-Token",
    status: "PAID",
    dueAt: "2026-11-05",
    paidAt: "2026-11-05 21:10",
    refundedAmountUsdt: 0.0,
    txHash: "0x5a193b...8291",
    receiptUrl: "/receipt/inv_acme_pro_002",
  },
  {
    id: "inv_acme_ent_003",
    customer: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    title: "Enterprise High-Frequency Data Feed",
    amountUsdt: 150.0,
    reserveHeldUsdt: 30.0,
    rail: "Uniswap Pay-With-Any-Token",
    status: "PAID",
    dueAt: "2026-11-04",
    paidAt: "2026-11-04 18:22",
    refundedAmountUsdt: 0.0,
    txHash: "0x3f982a...4421",
    receiptUrl: "/receipt/inv_acme_ent_003",
  },
  {
    id: "inv_acme_pro_004",
    customer: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    title: "Acme Studio Pro — 3 Seats Team Pack",
    amountUsdt: 60.0,
    reserveHeldUsdt: 0.0,
    rail: "Direct USDT (Whitechain)",
    status: "OPEN",
    dueAt: "2026-11-12",
    refundedAmountUsdt: 0.0,
    receiptUrl: "/receipt/inv_acme_pro_004",
  },
  {
    id: "inv_acme_pro_005",
    customer: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    title: "Acme Custom Domain Add-on",
    amountUsdt: 50.0,
    reserveHeldUsdt: 10.0,
    rail: "Direct USDT (Whitechain)",
    status: "PARTIALLY_REFUNDED",
    dueAt: "2026-11-01",
    paidAt: "2026-11-01 12:00",
    refundedAmountUsdt: 10.0,
    refundReason: "Customer downgraded tier",
    txHash: "0x7b124a...9911",
    receiptUrl: "/receipt/inv_acme_pro_005",
  },
];

const storeSubscriptions: StoreSubscription[] = [
  {
    id: "sub_acme_01",
    subscriber: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    planName: "Acme Studio Pro ($20/mo)",
    cycle: "Cycle 3 of 12",
    nextChargeDate: "2026-12-05",
    amountPerCycleUsdt: 20.0,
    totalPaidUsdt: 60.0,
    status: "ACTIVE",
  },
  {
    id: "sub_acme_02",
    subscriber: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    planName: "Enterprise Data Stream ($150/mo)",
    cycle: "Cycle 5 of 12",
    nextChargeDate: "2026-11-20",
    amountPerCycleUsdt: 150.0,
    totalPaidUsdt: 750.0,
    status: "ACTIVE",
  },
  {
    id: "sub_acme_03",
    subscriber: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    planName: "Acme Studio Pro ($20/mo)",
    cycle: "Cycle 1 of 12",
    nextChargeDate: "2026-12-01",
    amountPerCycleUsdt: 20.0,
    totalPaidUsdt: 20.0,
    status: "ACTIVE",
  },
  {
    id: "sub_acme_04",
    subscriber: "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f",
    planName: "Acme Studio Pro ($20/mo)",
    cycle: "Cycle 2 of 12",
    nextChargeDate: "2026-11-15",
    amountPerCycleUsdt: 20.0,
    totalPaidUsdt: 40.0,
    status: "GRACE_PERIOD",
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
    id: "act_uniswap_02",
    chainKey: "uniswap",
    eventType: "TREASURY_SWAP",
    from: "0x3C44...93BC",
    to: "0xf39Fd6e5...2266",
    asset: "WETH -> USDT (Universal Router)",
    amountFormatted: "0.08 WETH -> $200.00 USDT",
    amountRaw: "200000000",
    status: "CONFIRMED",
    txId: "0x5a193b...8291",
    explorerUrl: `https://sepolia.unichain.org/tx/0x5a193b...8291`,
    timestamp: Math.floor(Date.now() / 1000) - 900,
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
  {
    serviceId: "ai-sentiment-feed",
    serviceName: "Crypto NLP Sentiment Stream",
    description: "Machine-readable sentiment vectors parsed across major onchain social graphs.",
    price: {
      network: "hedera:testnet" as const,
      asset: "0.0.0",
      amountTinybars: "120000000", // 1.20 HBAR
      payTo: merchantAccountId,
    },
  },
];

// ============================================================================
// Helper: Parse JSON Body
// ============================================================================

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
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

// ============================================================================
// HTTP Server & Routing
// ============================================================================

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

  // --- API: Get Live Merchant State ---
  if (pathname === "/api/merchant/state" && req.method === "GET") {
    const verifiedPayments = getVerifiedHederaPayments();
    const totalHbarTinybars = verifiedPayments.reduce((sum, payment) => sum + BigInt(payment.amount), 0n);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        metrics: { ...merchantState.metrics, agentRevenueHbar: Number(totalHbarTinybars) / 1e8 },
        invoices: storeInvoices,
        subscriptions: storeSubscriptions,
        uniswap: merchantState.uniswap,
        agentCommerce: {
          ...merchantState.agentCommerce,
          totalAgentCalls: verifiedPayments.length,
          totalHbarTinybars: totalHbarTinybars.toString(),
        },
        services: acmeServices,
        activities: [...mockActivities, ...hederaActivities()],
        webhooks: merchantState.webhooks,
      })
    );
    return;
  }

  // --- API: Create New Invoice ---
  if (pathname === "/api/invoices/create" && req.method === "POST") {
    try {
      const data = await parseJsonBody<{
        title: string;
        customer?: string;
        amountUsdt: number;
        dueDays?: number;
      }>(req);

      const id = `inv_acme_${Math.random().toString(36).substring(2, 7)}`;
      const amount = Number(data.amountUsdt) || 20;
      const dueDays = Number(data.dueDays) || 7;
      const dueDate = new Date(Date.now() + dueDays * 86400 * 1000).toISOString().split("T")[0];

      const newInvoice: StoreInvoice = {
        id,
        customer: data.customer || "0x0000000000000000000000000000000000000000",
        title: data.title || "Custom Service Invoice",
        amountUsdt: amount,
        reserveHeldUsdt: 0,
        rail: "Direct USDT (Whitechain)",
        status: "OPEN",
        dueAt: dueDate,
        refundedAmountUsdt: 0,
        receiptUrl: `/receipt/${id}`,
      };

      storeInvoices.unshift(newInvoice);
      merchantState.metrics.totalInvoicesCount += 1;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, invoice: newInvoice }));
      return;
    } catch (e: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  // --- API: Issue Partial or Full Refund ---
  if (pathname === "/api/invoices/refund" && req.method === "POST") {
    try {
      const data = await parseJsonBody<{
        invoiceId: string;
        amountUsdt: number;
        reason?: string;
      }>(req);

      const inv = storeInvoices.find((i) => i.id === data.invoiceId);
      if (!inv) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invoice not found" }));
        return;
      }

      const refundAmount = Number(data.amountUsdt);
      if (refundAmount <= 0 || refundAmount > inv.amountUsdt - inv.refundedAmountUsdt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid refund amount" }));
        return;
      }

      // Update invoice
      inv.refundedAmountUsdt += refundAmount;
      inv.refundReason = data.reason || "Customer requested refund";
      inv.status = inv.refundedAmountUsdt >= inv.amountUsdt ? "FULLY_REFUNDED" : "PARTIALLY_REFUNDED";

      // Deduct from reserve pool
      merchantState.metrics.refundReserveBalanceUsdt = Math.max(
        0,
        merchantState.metrics.refundReserveBalanceUsdt - refundAmount
      );
      merchantState.metrics.totalRefundsCount += 1;
      merchantState.metrics.totalRefundedUsdt += refundAmount;

      // Add to normalized activity
      const txId = `0xrefund_${Math.random().toString(36).substring(2, 8)}`;
      mockActivities.unshift({
        id: `act_refund_${Date.now()}`,
        chainKey: "whitechain",
        eventType: "REFUND_ISSUED",
        from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        to: inv.customer,
        asset: "USDT",
        amountFormatted: `-$${refundAmount.toFixed(2)} USDT`,
        amountRaw: (refundAmount * 1e6).toString(),
        status: "CONFIRMED",
        txId,
        explorerUrl: `${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${txId}`,
        timestamp: Math.floor(Date.now() / 1000),
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, invoice: inv }));
      return;
    } catch (e: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  // --- API: Configure Uniswap v4 Hook ---
  if (pathname === "/api/treasury/hook-config" && req.method === "POST") {
    try {
      const data = await parseJsonBody<{ paused?: boolean; maxSwapAmountUsdt?: number }>(req);
      if (typeof data.paused === "boolean") {
        merchantState.uniswap.hookPaused = data.paused;
      }
      if (typeof data.maxSwapAmountUsdt === "number" && data.maxSwapAmountUsdt > 0) {
        merchantState.uniswap.maxSwapAmountUsdt = data.maxSwapAmountUsdt;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, uniswap: merchantState.uniswap }));
      return;
    } catch (e: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  // --- API: Execute Guarded Treasury Swap ---
  if (pathname === "/api/treasury/swap" && req.method === "POST") {
    try {
      const data = await parseJsonBody<{
        fromAsset: string;
        toAsset: string;
        amountUsdt: number;
      }>(req);

      if (merchantState.uniswap.hookPaused) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Swap Rejected: TreasuryGuardHook emergency pause is active. Circuit breaker tripped.",
          })
        );
        return;
      }

      const amount = Number(data.amountUsdt);
      if (amount > merchantState.uniswap.maxSwapAmountUsdt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `Swap Rejected by Hook: Amount ($${amount.toLocaleString()} USDT) exceeds max swap limit of $${merchantState.uniswap.maxSwapAmountUsdt.toLocaleString()} USDT.`,
          })
        );
        return;
      }

      if (amount > merchantState.metrics.availableProceedsUsdt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Insufficient available proceeds to swap." }));
        return;
      }

      merchantState.metrics.availableProceedsUsdt -= amount;

      const txId = `0xswap_${Math.random().toString(36).substring(2, 8)}`;
      mockActivities.unshift({
        id: `act_swap_${Date.now()}`,
        chainKey: "uniswap",
        eventType: "TREASURY_SWAP",
        from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        to: UNICHAIN_SEPOLIA_POOL_MANAGER,
        asset: `${data.fromAsset} -> ${data.toAsset}`,
        amountFormatted: `$${amount.toFixed(2)} USDT -> ${data.toAsset}`,
        amountRaw: (amount * 1e6).toString(),
        status: "CONFIRMED",
        txId,
        explorerUrl: `https://sepolia.unichain.org/tx/${txId}`,
        timestamp: Math.floor(Date.now() / 1000),
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          txId,
          availableProceeds: merchantState.metrics.availableProceedsUsdt,
        })
      );
      return;
    } catch (e: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  // --- API: Claim Uniswap LP Fees ---
  if (pathname === "/api/treasury/claim-fees" && req.method === "POST") {
    const fees = merchantState.uniswap.lpPosition.unclaimedFeesUsdt;
    merchantState.metrics.availableProceedsUsdt += fees;
    merchantState.uniswap.lpPosition.unclaimedFeesUsdt = 0;

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: true,
        claimed: fees,
        newAvailableProceeds: merchantState.metrics.availableProceedsUsdt,
      })
    );
    return;
  }

  // --- API: Trigger Subscription Renewal ---
  if (pathname === "/api/subscriptions/renew" && req.method === "POST") {
    try {
      const data = await parseJsonBody<{ subscriptionId: string }>(req);
      const sub = storeSubscriptions.find((s) => s.id === data.subscriptionId);
      if (!sub) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Subscription not found" }));
        return;
      }

      sub.totalPaidUsdt += sub.amountPerCycleUsdt;
      merchantState.metrics.totalGrossRevenueUsdt += sub.amountPerCycleUsdt;
      merchantState.metrics.availableProceedsUsdt += sub.amountPerCycleUsdt * 0.8;
      merchantState.metrics.refundReserveBalanceUsdt += sub.amountPerCycleUsdt * 0.2;

      // advance date by 30 days
      const curNext = new Date(sub.nextChargeDate);
      curNext.setDate(curNext.getDate() + 30);
      sub.nextChargeDate = curNext.toISOString().split("T")[0];

      const txId = `0xsub_${Math.random().toString(36).substring(2, 8)}`;
      mockActivities.unshift({
        id: `act_sub_${Date.now()}`,
        chainKey: "whitechain",
        eventType: "SUBSCRIPTION_RENEWED",
        from: sub.subscriber,
        to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        asset: "USDT",
        amountFormatted: `$${sub.amountPerCycleUsdt.toFixed(2)} USDT`,
        amountRaw: (sub.amountPerCycleUsdt * 1e6).toString(),
        status: "CONFIRMED",
        txId,
        explorerUrl: `${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${txId}`,
        timestamp: Math.floor(Date.now() / 1000),
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, subscription: sub }));
      return;
    } catch (e: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
  }

  // --- API: Withdraw Available Proceeds ---
  if (pathname === "/api/reserves/withdraw" && req.method === "POST") {
    const amount = merchantState.metrics.availableProceedsUsdt;
    merchantState.metrics.availableProceedsUsdt = 0;
    mockActivities.unshift({
      id: `act_sweep_${Date.now()}`,
      chainKey: "whitechain",
      eventType: "TREASURY_SWEEP",
      from: "0x18747a8B99c...312e",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      asset: "USDT",
      amountFormatted: `$${amount.toFixed(2)} USDT`,
      amountRaw: (amount * 1e6).toString(),
      status: "CONFIRMED",
      txId: `0xsweep_${Math.random().toString(36).substring(2, 8)}`,
      explorerUrl: `${WHITECHAIN_SEPOLIA_EXPLORER}/tx/0x98124b...7712`,
      timestamp: Math.floor(Date.now() / 1000),
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, withdrawnAmount: amount }));
    return;
  }

  // --- API: Dispatch Test Webhook ---
  if (pathname === "/api/webhooks/test" && req.method === "POST") {
    try {
      const data = await parseJsonBody<{ eventType: string }>(req);
      const eventType = data.eventType || "invoice.paid";
      const payload = {
        eventId: `evt_${Math.random().toString(36).substring(2, 10)}`,
        eventType,
        timestamp: Date.now(),
        data: {
          merchant: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          invoiceId: "inv_acme_pro_001",
          amountUsdt: "20.00",
          currency: "USDT",
          chain: "whitechain",
          chainId: 1874,
        },
      };

      const hmac = crypto
        .createHmac("sha256", merchantState.webhooks.secret)
        .update(JSON.stringify(payload))
        .digest("hex");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          endpoint: merchantState.webhooks.endpoint,
          signatureHeader: `sha256=${hmac}`,
          payload,
          simulatedHttpStatus: 200,
        })
      );
      return;
    } catch (e: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
      return;
    }
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
    const parts = pathname.split("/");
    const requestedId = parts[2] || "inv_acme_pro_001";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(renderReceiptHtml(requestedId));
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

// ============================================================================
// HTML Renderers
// ============================================================================

function renderStorefrontHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Acme Studio — Powered by PulsePay</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; margin: 0; padding: 40px 20px; color: #f8fafc; }
    .container { max-width: 980px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 40px; }
    .badge { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; padding: 4px 14px; border-radius: 9999px; font-size: 13px; font-weight: 600; display: inline-block; margin-bottom: 14px; }
    h1 { font-size: 34px; font-weight: 800; margin: 0 0 10px; color: #ffffff; letter-spacing: -0.5px; }
    p.subtitle { color: #94a3b8; font-size: 16px; margin: 0; }
    .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; }
    .plan-card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .checkout-box { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 28px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .btn { display: block; width: 100%; padding: 14px; text-align: center; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 15px; border-radius: 8px; border: none; cursor: pointer; text-decoration: none; margin-top: 20px; box-sizing: border-box; transition: background 0.15s; }
    .btn:hover { background: #1d4ed8; }
    .nav-links { margin-top: 40px; text-align: center; }
    .nav-links a { margin: 0 14px; color: #38bdf8; text-decoration: none; font-size: 14px; font-weight: 500; }
    .feature-list { list-style: none; padding: 0; margin: 24px 0; }
    .feature-list li { margin-bottom: 12px; font-size: 14px; color: #cbd5e1; display: flex; align-items: center; }
    .feature-list li::before { content: "✓"; color: #10b981; font-weight: bold; margin-right: 10px; }
    .tab-btn { padding: 10px; border-radius: 8px; border: 1px solid #334155; background: #1e293b; color: #94a3b8; cursor: pointer; font-size: 13px; font-weight: 600; width: 48%; transition: all 0.15s; }
    .tab-btn.active { border-color: #3b82f6; background: rgba(59,130,246,0.15); color: #60a5fa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">ETHGlobal Mumbai 2026 Tri-Track Showcase</div>
      <h1>Acme Studio Pro</h1>
      <p class="subtitle">Accepting Whitechain USDT · Uniswap Pay-With-Any-Token · Hedera x402 AI Agents</p>
    </div>

    <div class="card-grid">
      <div class="plan-card">
        <h3 style="margin: 0; font-size: 22px; color: #f1f5f9;">Acme Pro Plan</h3>
        <div style="font-size: 38px; font-weight: 800; margin: 16px 0 8px; color: #fff;">$20.00 <span style="font-size: 16px; color: #94a3b8; font-weight: 500;">USDT / mo</span></div>
        <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;">Enterprise analytics suite, continuous market feeds, and autonomous agent endpoints.</p>
        
        <ul class="feature-list">
          <li>Settles in official Whitechain USDT (0xcedf...5a7)</li>
          <li>Pay with any token via Uniswap Universal Router</li>
          <li>Cancel-anytime recurring subscription authorization</li>
          <li>Verifiable customer receipt with one-click refund support</li>
        </ul>
      </div>

      <div class="checkout-box">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h4 style="margin: 0; font-size: 16px; font-weight: 600; color: #f8fafc;">PulsePay Drop-In Checkout</h4>
          <span style="font-size: 11px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 4px 8px; border-radius: 4px; font-weight: 600;">Whitechain: 1874</span>
        </div>

        <div style="background: #0f172a; border: 1px solid #1e293b; padding: 16px; border-radius: 10px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: #94a3b8;">Amount Due</div>
          <div style="font-size: 26px; font-weight: 800; color: #ffffff;">$20.00 USDT</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Contract: PulsePayMerchantHub.sol</div>
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 8px;">Select Payment Rail:</div>
          <div style="display: flex; justify-content: space-between;">
            <button class="tab-btn active" id="btn-usdt" onclick="selectTab('USDT')">Direct USDT (Whitechain)</button>
            <button class="tab-btn" id="btn-swap" onclick="selectTab('SWAP')">Pay with WETH (Uniswap)</button>
          </div>
        </div>

        <div id="swap-details" style="display: none; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 10px; padding: 14px; margin-bottom: 20px;">
          <div style="font-size: 13px; font-weight: 600; color: #60a5fa;">Uniswap Universal Router 2.0</div>
          <div style="font-size: 12px; color: #cbd5e1; margin-top: 4px;">Exact Output Quote: <strong>0.0080 WETH</strong> → <strong>20.00 USDT</strong></div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Slippage Tolerance: 0.5% | No Price Volatility Risk for Merchant</div>
        </div>

        <button class="btn" id="pay-btn" onclick="executePayment()">Pay $20.00 on Whitechain</button>
        <div id="payment-status" style="display: none; margin-top: 14px; font-size: 13px; text-align: center;"></div>
      </div>
    </div>

    <div class="nav-links">
      <a href="/merchant" style="color: #60a5fa; font-weight: 600;">⚡ Open Merchant Operations Dashboard →</a>
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
      status.style.color = '#60a5fa';
      status.innerText = 'Confirming payment on Whitechain Sepolia (Chain ID 1874)...';

      setTimeout(() => {
        btn.innerText = '✓ Payment Settled';
        btn.style.background = '#10b981';
        status.style.color = '#34d399';
        status.innerHTML = 'Payment Confirmed! <a href="/receipt/inv_acme_pro_001" style="color:#60a5fa;text-decoration:underline;">View Verifiable Receipt →</a>';
      }, 1400);
    }
  </script>
</body>
</html>`;
}

function renderReceiptHtml(invoiceId: string) {
  const inv = storeInvoices.find((i) => i.id === invoiceId) || storeInvoices[0];
  const isRefunded = inv.status === "PARTIALLY_REFUNDED" || inv.status === "FULLY_REFUNDED";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PulsePay — Verifiable Customer Receipt (${inv.id})</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0f19; padding: 40px 20px; color: #f8fafc; }
    .card { max-width: 520px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .row { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 14px; }
    .label { color: #94a3b8; }
    .val { font-weight: 500; color: #f8fafc; }
    .status-badge { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 12px; }
    .status-badge.refunded { background: rgba(245,158,11,0.15); border-color: rgba(245,158,11,0.3); color: #fbbf24; }
    .divider { border-top: 1px solid #1f2937; margin: 20px 0; }
    a.link { color: #38bdf8; text-decoration: none; font-size: 13px; }
    a.link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
      <h2 style="margin: 0; font-size: 18px; color: #ffffff;">Customer Verifiable Receipt</h2>
      <span class="status-badge ${isRefunded ? "refunded" : ""}">
        ${inv.status}
      </span>
    </div>

    <div class="row"><span class="label">Invoice ID</span><span class="val" style="font-family: monospace;">${inv.id}</span></div>
    <div class="row"><span class="label">Merchant</span><span class="val">0xf39F...2266 (Acme Studio)</span></div>
    <div class="row"><span class="label">Customer</span><span class="val" style="font-family: monospace;">${inv.customer.substring(0, 10)}...</span></div>
    <div class="row"><span class="label">Network</span><span class="val">Whitechain Sepolia (1874)</span></div>
    <div class="row"><span class="label">Payment Rail</span><span class="val">${inv.rail}</span></div>

    <div class="divider"></div>

    <div class="row"><span class="label">Total Invoiced</span><span class="val" style="font-size: 18px; font-weight: 700;">$${inv.amountUsdt.toFixed(2)} USDT</span></div>
    ${
      inv.refundedAmountUsdt > 0
        ? `<div class="row" style="color:#ef4444;"><span class="label" style="color:#ef4444;">Cumulative Refund</span><span class="val" style="font-size: 16px; font-weight: 600; color:#ef4444;">-$${inv.refundedAmountUsdt.toFixed(2)} USDT</span></div>
           <div class="row"><span class="label">Net Settled</span><span class="val" style="font-size: 16px; font-weight: 600; color:#10b981;">$${(inv.amountUsdt - inv.refundedAmountUsdt).toFixed(2)} USDT</span></div>
           <div class="row"><span class="label">Refund Reason</span><span class="val" style="color:#fbbf24;">${inv.refundReason || "Merchant initiated"}</span></div>`
        : ""
    }

    <div class="divider"></div>

    <div style="font-size: 12px; font-weight: 600; color: #94a3b8; margin-bottom: 10px;">Onchain Blockscout Verification:</div>
    <div style="margin-bottom: 8px;">
      <a class="link" href="${WHITECHAIN_SEPOLIA_EXPLORER}/address/${WHITECHAIN_USDT_ADDRESS}" target="_blank">
        Official USDT Contract (${WHITECHAIN_USDT_ADDRESS.substring(0, 10)}...) ↗
      </a>
    </div>
    <div style="margin-bottom: 8px;">
      <a class="link" href="${WHITECHAIN_SEPOLIA_EXPLORER}/tx/0x89274a...312e" target="_blank">
        Payment Settlement Proof ↗
      </a>
    </div>
    ${
      inv.refundedAmountUsdt > 0
        ? `<div style="margin-top: 8px;">
             <a class="link" style="color: #fbbf24;" href="${WHITECHAIN_SEPOLIA_EXPLORER}/tx/0xrefund...789" target="_blank">
               Refund Transaction Proof (-$${inv.refundedAmountUsdt.toFixed(2)} USDT) ↗
             </a>
           </div>`
        : ""
    }

    <div style="margin-top: 28px; text-align: center;">
      <a href="/merchant" style="font-size: 13px; color: #60a5fa; text-decoration: none; margin-right: 16px;">⚡ Merchant Console</a>
      <a href="/" style="font-size: 13px; color: #94a3b8; text-decoration: none;">← Storefront</a>
    </div>
  </div>
</body>
</html>`;
}

function renderMerchantHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PulsePay — Merchant Operations & Financial Console</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --bg-main: #090d16;
      --bg-panel: #111827;
      --bg-card: #151e32;
      --border: #1e293b;
      --border-focus: #3b82f6;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --brand-blue: #3b82f6;
      --brand-emerald: #10b981;
      --brand-purple: #a855f7;
      --brand-amber: #f59e0b;
      --brand-rose: #f43f5e;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg-main); color: var(--text-main); display: flex; height: 100vh; overflow: hidden; }

    /* Layout */
    #sidebar { width: 260px; background: var(--bg-panel); border-right: 1px solid var(--border); display: flex; flex-direction: column; flex-shrink: 0; }
    #main-content { flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: var(--bg-main); }

    /* Sidebar Components */
    .sidebar-header { padding: 24px 20px; border-bottom: 1px solid var(--border); }
    .logo-container { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .logo-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #2563eb, #a855f7); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 16px; }
    .store-badge { font-size: 11px; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-weight: 600; display: inline-block; }

    .nav-list { list-style: none; padding: 16px 12px; flex: 1; overflow-y: auto; }
    .nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; color: var(--text-muted); font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.15s; margin-bottom: 4px; }
    .nav-item:hover { background: rgba(255,255,255,0.04); color: #fff; }
    .nav-item.active { background: rgba(59,130,246,0.12); color: #60a5fa; font-weight: 600; border-left: 3px solid #3b82f6; }
    .nav-item .icon { font-size: 16px; width: 20px; text-align: center; }

    .sidebar-footer { padding: 16px 20px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text-muted); }
    .network-pill { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--brand-emerald); margin-bottom: 8px; }
    .dot-live { width: 6px; height: 6px; border-radius: 50%; background: var(--brand-emerald); animation: pulse 2s infinite; }

    /* Top Bar */
    .top-bar { height: 64px; border-bottom: 1px solid var(--border); background: var(--bg-panel); display: flex; align-items: center; justify-content: space-between; padding: 0 28px; flex-shrink: 0; }
    .top-search { display: flex; align-items: center; background: #0c121e; border: 1px solid var(--border); border-radius: 8px; padding: 6px 14px; width: 340px; }
    .top-search input { background: transparent; border: none; color: #fff; font-size: 13px; outline: none; width: 100%; margin-left: 8px; }
    .top-actions { display: flex; align-items: center; gap: 12px; }

    /* Buttons */
    .btn-primary { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background 0.15s; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #1e293b; color: var(--text-main); border: 1px solid var(--border); padding: 8px 14px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
    .btn-secondary:hover { background: #2d3b54; }
    .btn-danger { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #f87171; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-danger:hover { background: rgba(239,68,68,0.25); }
    .btn-success { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }

    /* Main Container Content */
    .content-area { padding: 28px; max-width: 1380px; margin: 0 auto; width: 100%; }
    .tab-pane { display: none; }
    .tab-pane.active { display: block; animation: fadeIn 0.2s ease-in-out; }

    /* Cards & Grids */
    .metric-grid-6 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    @media (max-width: 1100px) { .metric-grid-6 { grid-template-columns: repeat(2, 1fr); } }
    .card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); }
    .card-title { font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    .card-val { font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 4px; }
    .card-sub { font-size: 12px; color: var(--text-muted); }

    /* Table Boxes */
    .table-container { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-top: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #0c121e; padding: 12px 16px; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); font-size: 12px; }
    td { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); color: #cbd5e1; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.015); }

    /* Status Badges */
    .badge-paid { background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-refund { background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-open { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); color: #60a5fa; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge-chain { padding: 3px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; font-family: monospace; }
    .chain-whitechain { background: rgba(16,185,129,0.12); color: #34d399; }
    .chain-uniswap { background: rgba(168,85,247,0.12); color: #c084fc; }
    .chain-hedera { background: rgba(14,165,233,0.12); color: #38bdf8; }

    /* Modals */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 14px; width: 480px; max-width: 90vw; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-title { font-size: 17px; font-weight: 700; color: #fff; }
    .close-btn { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; }
    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 12px; color: var(--text-muted); font-weight: 600; margin-bottom: 6px; }
    .form-input { width: 100%; background: #0c121e; border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; color: #fff; font-size: 13px; outline: none; }
    .form-input:focus { border-color: var(--border-focus); }

    /* Toast */
    #toast { position: fixed; bottom: 24px; right: 24px; background: #1f2937; border: 1px solid #374151; color: #fff; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; z-index: 2000; display: none; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4); }

    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>

  <!-- Left Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="logo-container">
        <div class="logo-icon">P</div>
        <div>
          <h3 style="font-size: 15px; font-weight: 700; color: #fff;">PulsePay</h3>
          <span class="store-badge">Acme Studio Pro</span>
        </div>
      </div>
    </div>

    <ul class="nav-list">
      <li class="nav-item active" onclick="switchTab('overview')"><span class="icon">📊</span> Overview</li>
      <li class="nav-item" onclick="switchTab('sales')"><span class="icon">🧾</span> Sales & Invoices</li>
      <li class="nav-item" onclick="switchTab('subscriptions')"><span class="icon">🔄</span> Subscriptions</li>
      <li class="nav-item" onclick="switchTab('uniswap')"><span class="icon">🦄</span> Uniswap & Treasury</li>
      <li class="nav-item" onclick="switchTab('agent')"><span class="icon">🤖</span> AI Agent Commerce</li>
      <li class="nav-item" onclick="switchTab('reserves')"><span class="icon">🏦</span> Reserves & Payouts</li>
      <li class="nav-item" onclick="switchTab('developer')"><span class="icon">⚙️</span> Developer & Webhooks</li>
    </ul>

    <div class="sidebar-footer">
      <div class="network-pill"><span class="dot-live"></span> Tri-Track Network Live</div>
      <div style="font-size: 11px; margin-bottom: 4px;">Whitechain: 1874 · Unichain: 1301</div>
      <div style="font-size: 11px; color: #64748b; margin-bottom: 12px;">Hedera: testnet-296</div>
      <a href="/" style="color: #60a5fa; text-decoration: none; font-size: 12px;">← Customer Storefront</a>
    </div>
  </aside>

  <!-- Main Content Area -->
  <main id="main-content">
    
    <!-- Top Bar -->
    <header class="top-bar">
      <div class="top-search">
        <span>🔍</span>
        <input type="text" id="global-search" placeholder="Search invoices, customer wallets, tx hashes..." oninput="handleGlobalSearch(this.value)">
      </div>

      <div class="top-actions">
        <button class="btn-secondary" onclick="openNewInvoiceModal()">+ Create Invoice</button>
        <button class="btn-secondary" onclick="openTreasurySwapModal()">⚡ Treasury Swap</button>
        <a href="/api/export.csv" class="btn-primary">📥 Export CSV</a>
      </div>
    </header>

    <div class="content-area">

      <!-- ================================================================= -->
      <!-- TAB 1: OVERVIEW -->
      <!-- ================================================================= -->
      <section id="tab-overview" class="tab-pane active">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700; color: #fff;">Financial Overview</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Unified settlement cockpit across Whitechain stablecoins, Uniswap conversion, and Hedera agents</p>
          </div>
          <div style="font-size: 12px; color: var(--text-muted); background: #111827; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border);">
            Settlement Period: <strong style="color: #fff;">Last 30 Days</strong>
          </div>
        </div>

        <div class="metric-grid-6">
          <div class="card">
            <div class="card-title">Total Gross Revenue <span style="color: var(--brand-emerald);">+18.4%</span></div>
            <div class="card-val" id="kpi-gross">$12,480.00 USDT</div>
            <div class="card-sub">Combined 184 paid orders & subscriptions</div>
          </div>

          <div class="card">
            <div class="card-title">Available Proceeds <span style="color: var(--brand-blue);">Ready</span></div>
            <div class="card-val" id="kpi-available">$9,984.00 USDT</div>
            <div class="card-sub">80% net proceeds available for withdrawal</div>
          </div>

          <div class="card">
            <div class="card-title">Refund Reserve Pool <span style="color: var(--brand-amber);">100% Solvent</span></div>
            <div class="card-val" id="kpi-reserve">$2,496.00 USDT</div>
            <div class="card-sub">20% collateral safeguarding instant refunds</div>
          </div>

          <div class="card">
            <div class="card-title">Uniswap Any-Token Sales <span style="color: var(--brand-purple);">34.1% of GMV</span></div>
            <div class="card-val" id="kpi-uniswap">$4,250.00 USDT</div>
            <div class="card-sub">62 customer swaps via Universal Router</div>
          </div>

          <div class="card">
            <div class="card-title">Hedera AI Agent Revenue <span style="color: #38bdf8;" id="kpi-agent-calls">${getVerifiedHederaPayments().length} Queries</span></div>
            <div class="card-val" id="kpi-agent">${hederaAmount(getVerifiedHederaPayments().reduce((sum, p) => sum + BigInt(p.amount), 0n))} HBAR</div>
            <div class="card-sub">x402 native tinybars consensus-settled</div>
          </div>

          <div class="card">
            <div class="card-title">Active MRR <span style="color: var(--brand-emerald);">38 Subscribers</span></div>
            <div class="card-val" id="kpi-mrr">$4,120.00 USDT</div>
            <div class="card-sub">SaaS renewals handled on Whitechain</div>
          </div>
        </div>

        <!-- Revenue Volume Breakdown & Interactive SVG Chart -->
        <div class="card" style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 15px; font-weight: 600;">14-Day Multi-Chain Volume Breakdown</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Daily sales volume across Whitechain Direct USDT, Uniswap Any-Token Swaps, and Hedera x402 Micropayments</p>
            </div>
            <div style="display: flex; gap: 8px;">
              <span style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(16,185,129,0.15); color: #34d399;">■ Whitechain USDT</span>
              <span style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(168,85,247,0.15); color: #c084fc;">■ Uniswap Any-Token</span>
              <span style="font-size: 11px; padding: 4px 8px; border-radius: 4px; background: rgba(14,165,233,0.15); color: #38bdf8;">■ Hedera x402</span>
            </div>
          </div>

          <div style="height: 180px; width: 100%; display: flex; align-items: flex-end; gap: 14px; padding-top: 20px; border-bottom: 1px solid var(--border);">
            <!-- Day bars -->
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:40px; background:#10b981; border-radius:3px 3px 0 0;" title="Day 1: $480 USDT"></div>
              <div style="width:100%; height:20px; background:#a855f7;" title="Uniswap: $220"></div>
              <div style="width:100%; height:8px; background:#0ea5e9;" title="Hedera: $40"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Oct 23</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:55px; background:#10b981; border-radius:3px 3px 0 0;"></div>
              <div style="width:100%; height:30px; background:#a855f7;"></div>
              <div style="width:100%; height:12px; background:#0ea5e9;"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Oct 25</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:70px; background:#10b981; border-radius:3px 3px 0 0;"></div>
              <div style="width:100%; height:45px; background:#a855f7;"></div>
              <div style="width:100%; height:14px; background:#0ea5e9;"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Oct 27</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:85px; background:#10b981; border-radius:3px 3px 0 0;"></div>
              <div style="width:100%; height:50px; background:#a855f7;"></div>
              <div style="width:100%; height:18px; background:#0ea5e9;"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Oct 29</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:95px; background:#10b981; border-radius:3px 3px 0 0;"></div>
              <div style="width:100%; height:60px; background:#a855f7;"></div>
              <div style="width:100%; height:22px; background:#0ea5e9;"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Oct 31</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:110px; background:#10b981; border-radius:3px 3px 0 0;"></div>
              <div style="width:100%; height:75px; background:#a855f7;"></div>
              <div style="width:100%; height:25px; background:#0ea5e9;"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Nov 02</span>
            </div>
            <div style="flex:1; display:flex; flex-direction:column; gap:2px; align-items:center; height:100%; justify-content:flex-end;">
              <div style="width:100%; height:130px; background:#10b981; border-radius:3px 3px 0 0;"></div>
              <div style="width:100%; height:85px; background:#a855f7;"></div>
              <div style="width:100%; height:30px; background:#0ea5e9;"></div>
              <span style="font-size:10px; color:#64748b; margin-top:6px;">Today</span>
            </div>
          </div>
        </div>

        <!-- Recent Multi-Chain Activity Ledger -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="font-size: 16px; font-weight: 600;">Unified Multi-Chain Event Ledger</h3>
            <span style="font-size: 12px; color: var(--text-muted);">Synchronized across Whitechain, Unichain & Hedera Mirror Node</span>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Chain</th>
                  <th>Event Type</th>
                  <th>Counterparty</th>
                  <th>Asset / Amount</th>
                  <th>Status</th>
                  <th>Explorer Proof</th>
                </tr>
              </thead>
              <tbody id="overview-activity-tbody">
                <!-- Injected via JS -->
              </tbody>
            </table>
          </div>
        </div>

      </section>

      <!-- ================================================================= -->
      <!-- TAB 2: SALES & INVOICES -->
      <!-- ================================================================= -->
      <section id="tab-sales" class="tab-pane">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700;">Sales & Invoices Management</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Whitechain Sepolia stablecoin invoices, payment links, and reserve-backed refunds</p>
          </div>
          <button class="btn-primary" onclick="openNewInvoiceModal()">+ Create New Invoice</button>
        </div>

        <div class="card" style="margin-bottom: 20px; display: flex; gap: 24px; padding: 16px 24px;">
          <div>
            <div style="font-size: 12px; color: var(--text-muted);">Total Invoiced</div>
            <div style="font-size: 20px; font-weight: 700; color: #fff;">$12,480.00 USDT</div>
          </div>
          <div style="border-left: 1px solid var(--border); padding-left: 24px;">
            <div style="font-size: 12px; color: var(--text-muted);">Collection Rate</div>
            <div style="font-size: 20px; font-weight: 700; color: var(--brand-emerald);">98.4%</div>
          </div>
          <div style="border-left: 1px solid var(--border); padding-left: 24px;">
            <div style="font-size: 12px; color: var(--text-muted);">Total Refunds Issued</div>
            <div style="font-size: 20px; font-weight: 700; color: var(--brand-amber);">$125.00 USDT</div>
          </div>
          <div style="border-left: 1px solid var(--border); padding-left: 24px;">
            <div style="font-size: 12px; color: var(--text-muted);">Avg. Settlement Finality</div>
            <div style="font-size: 20px; font-weight: 700; color: #38bdf8;">1.2 Seconds</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice ID</th>
                <th>Title / Customer</th>
                <th>Payment Rail</th>
                <th>Amount</th>
                <th>Reserve Held</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="invoices-tbody">
              <!-- Injected via JS -->
            </tbody>
          </table>
        </div>

      </section>

      <!-- ================================================================= -->
      <!-- TAB 3: SUBSCRIPTIONS -->
      <!-- ================================================================= -->
      <section id="tab-subscriptions" class="tab-pane">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700;">Recurring Billing & Subscriptions</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Automated customer-authorized token pulls on Whitechain with transparent cancel controls</p>
          </div>
          <button class="btn-primary" onclick="showToast('Subscription Plan Creator opened', 'info')">+ Create Subscription Plan</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 16px; font-weight: 700;">Acme Studio Pro</h3>
              <span class="badge-paid">ACTIVE PLAN</span>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">$20.00 <span style="font-size: 14px; color: var(--text-muted); font-weight: 500;">USDT / 30 Days</span></div>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Core developer and SaaS plan with unlimited API usage and automated renewals.</p>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 12px;">
              <span>Subscribers: <strong style="color: #fff;">32 active</strong></span>
              <span>MRR: <strong style="color: var(--brand-emerald);">$640.00 USDT</strong></span>
            </div>
          </div>

          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 16px; font-weight: 700;">Enterprise Data Stream</h3>
              <span class="badge-paid">ACTIVE PLAN</span>
            </div>
            <div style="font-size: 28px; font-weight: 800; margin-bottom: 8px;">$150.00 <span style="font-size: 14px; color: var(--text-muted); font-weight: 500;">USDT / 30 Days</span></div>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">High-throughput direct stream for algorithmic trading firms and institutional research.</p>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); border-top: 1px solid var(--border); padding-top: 12px;">
              <span>Subscribers: <strong style="color: #fff;">6 active</strong></span>
              <span>MRR: <strong style="color: var(--brand-emerald);">$900.00 USDT</strong></span>
            </div>
          </div>
        </div>

        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Active Subscribers Registry</h3>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Subscriber Wallet</th>
                <th>Plan Name</th>
                <th>Billing Cycle</th>
                <th>Next Scheduled Charge</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="subscribers-tbody">
              <!-- Injected via JS -->
            </tbody>
          </table>
        </div>

      </section>

      <!-- ================================================================= -->
      <!-- TAB 4: UNISWAP & TREASURY -->
      <!-- ================================================================= -->
      <section id="tab-uniswap" class="tab-pane">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700;">Uniswap Foundation Integration & Treasury</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Universal Router checkout conversion and Uniswap v4 custom hook risk controls</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn-secondary" id="btn-toggle-pause" onclick="toggleHookPause()">⏸️ Emergency Pause Swaps</button>
            <button class="btn-primary" onclick="openTreasurySwapModal()">⚡ Swap Treasury Funds</button>
          </div>
        </div>

        <!-- Hook Status & Guard Card -->
        <div class="card" style="margin-bottom: 24px; border-left: 4px solid var(--brand-purple);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--brand-purple); text-transform: uppercase;">Uniswap v4 Custom Risk Hook</div>
              <h3 style="font-size: 17px; font-weight: 700; margin-top: 2px;">TreasuryGuardHook.sol (Salt Mined: 0x00C0 Bitmask)</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Enforces beforeSwap maximum single trade limits and emergency circuit breaker directly onchain</p>
            </div>
            <div style="text-align: right;">
              <span id="hook-status-badge" class="badge-paid" style="font-size: 12px;">🟢 HOOK ACTIVE (NORMAL)</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Max Single Swap Limit</div>
              <div style="font-size: 18px; font-weight: 700;" id="hook-max-limit">$10,000.00 USDT</div>
              <div style="font-size: 11px; color: var(--brand-emerald); margin-top: 2px;">Circuit breaker threshold</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Hook Permissions</div>
              <div style="font-size: 16px; font-weight: 600; font-family: monospace;">beforeSwap | afterSwap</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Flags: 0x00C0 Bitmask</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Connected PoolManager</div>
              <div style="font-size: 13px; font-family: monospace; color: #60a5fa;">0x00B0...25f5</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Unichain Sepolia 1301</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Hook Configuration</div>
              <button class="btn-secondary" style="padding: 4px 10px; font-size: 12px; margin-top: 4px;" onclick="promptUpdateGuardLimit()">Adjust Max Limit</button>
            </div>
          </div>
        </div>

        <!-- Universal Checkout Analytics -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
          <div class="card">
            <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Universal Checkout ("Pay With Any Token")</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Allows customers to pay with WETH, USDC, or DAI while the merchant is guaranteed exact USDT settlement.</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-muted);">Swapped Volume Converted</div>
                <div style="font-size: 20px; font-weight: 700; color: #fff;">$4,250.00 USDT</div>
              </div>
              <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-muted);">Average Observed Slippage</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--brand-emerald);">0.12% <span style="font-size: 11px; color: var(--text-muted);">(Max 0.5%)</span></div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              Most Popular Source Tokens: <strong style="color: #fff;">WETH (62%)</strong> · <strong style="color: #fff;">USDC (26%)</strong> · <strong style="color: #fff;">DAI (12%)</strong>
            </div>
          </div>

          <!-- Uniswap v4 Concentrated Liquidity Position -->
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 15px; font-weight: 600;">Uniswap v4 Treasury LP Position</h3>
              <span class="badge-paid">IN RANGE</span>
            </div>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Corporate treasury earning swap fees on concentrated stablecoin liquidity (USDT/USDC 0.05%).</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-muted);">Position Liquidity Value</div>
                <div style="font-size: 20px; font-weight: 700; color: #fff;">$24,500.00</div>
              </div>
              <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
                <div style="font-size: 11px; color: var(--text-muted);">Accrued Unclaimed Fees</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--brand-emerald);" id="lp-fees-txt">$184.20 USDT</div>
              </div>
            </div>

            <button class="btn-secondary" style="width: 100%;" onclick="claimLpFees()">Claim $184.20 Accrued LP Fees</button>
          </div>
        </div>

      </section>

      <!-- ================================================================= -->
      <!-- TAB 5: AI AGENT COMMERCE -->
      <!-- ================================================================= -->
      <section id="tab-agent" class="tab-pane">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700;">AI Agent Commerce (x402 on Hedera)</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Zero-human-approval machine micropayments, Hedera Agent Kit v4 policies, and HCS consensus audit trails</p>
          </div>
          <a href="/.well-known/x402.json" target="_blank" class="btn-secondary">View Discovery Manifest ↗</a>
        </div>

        <div class="card" style="margin-bottom: 24px; border-left: 4px solid #0ea5e9;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Hedera Agent Kit v4 Governance</div>
              <h3 style="font-size: 17px; font-weight: 700; margin-top: 2px;">PulsePaySpendLimitPolicy & Consensus Audit</h3>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">100% Native TypeScript SDK (@hiero-ledger/sdk) — Zero Solidity on Hedera!</p>
            </div>
            <div>
              <span class="badge-paid" style="font-size: 12px; background: rgba(14,165,233,0.15); color: #38bdf8; border-color: rgba(14,165,233,0.3);">HCS TOPIC: ${merchantState.agentCommerce.hcsTopicId || "Not configured"}</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Daily Spend Budget</div>
              <div style="font-size: 18px; font-weight: 700;">${merchantState.agentCommerce.dailyBudgetHbar.toFixed(8)} HBAR</div>
              <div style="font-size: 11px; color: var(--brand-emerald); margin-top: 2px;">Per-agent threshold</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Max Per-Request Limit</div>
              <div style="font-size: 18px; font-weight: 700;">${merchantState.agentCommerce.maxPerRequestHbar.toFixed(8)} HBAR</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${Math.round(merchantState.agentCommerce.maxPerRequestHbar * 1e8)} tinybars</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Human Approvals Needed</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--brand-emerald);">0 Approvals</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">100% Autonomous</div>
            </div>
            <div>
              <div style="font-size: 11px; color: var(--text-muted);">Audit Topic HashScan</div>
              <a href="${merchantState.agentCommerce.hcsTopicId ? `https://hashscan.io/testnet/topic/${merchantState.agentCommerce.hcsTopicId}` : "#"}" target="_blank" style="color: #38bdf8; font-size: 13px; text-decoration: underline; display: inline-block; margin-top: 4px;">HashScan Topic Explorer ↗</a>
            </div>
          </div>
        </div>

        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Registered x402 Agent Services</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
          <div class="card">
            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">Acme Real-Time Orderbook API</h4>
            <div style="font-size: 12px; color: #60a5fa; font-family: monospace; margin-bottom: 12px;">POST /v1/services/market-data-pro/query</div>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">High-frequency real-time orderbook feeds queried by autonomous arbitrage agents.</p>
            <div style="display: flex; justify-content: space-between; font-size: 13px; border-top: 1px solid var(--border); padding-top: 12px;">
              <span>Price: <strong style="color: #fff;">0.50 HBAR</strong></span>
              <span>Settled Queries: <strong style="color: var(--brand-emerald);">142</strong></span>
            </div>
          </div>

          <div class="card">
            <h4 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">Crypto NLP Sentiment Stream</h4>
            <div style="font-size: 12px; color: #60a5fa; font-family: monospace; margin-bottom: 12px;">POST /v1/services/ai-sentiment-feed/query</div>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">Real-time natural language sentiment vectors extracted from decentralized channels.</p>
            <div style="display: flex; justify-content: space-between; font-size: 13px; border-top: 1px solid var(--border); padding-top: 12px;">
              <span>Price: <strong style="color: #fff;">1.20 HBAR</strong></span>
              <span>Settled Queries: <strong style="color: var(--brand-emerald);">48</strong></span>
            </div>
          </div>
        </div>

      </section>

      <!-- ================================================================= -->
      <!-- TAB 6: RESERVES & PAYOUTS -->
      <!-- ================================================================= -->
      <section id="tab-reserves" class="tab-pane">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700;">Treasury Reserves & Corporate Payouts</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Solvency management, reserve pool allocation, and corporate profit withdrawals</p>
          </div>
          <button class="btn-primary" onclick="withdrawProceeds()">Withdraw Available Proceeds</button>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
          <div class="card">
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Refund Reserve Solvency Meter</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">20% of every settled payment is retained in the PulsePayMerchantHub smart contract to fund instant, zero-wait customer refunds.</p>
            
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                <span>Current Reserve Solvency: <strong style="color: var(--brand-emerald);">100% (Healthy)</strong></span>
                <span>$2,496.00 / $2,496.00</span>
              </div>
              <div style="width: 100%; height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden;">
                <div style="width: 100%; height: 100%; background: var(--brand-emerald);"></div>
              </div>
            </div>

            <div style="font-size: 12px; color: var(--text-muted); margin-top: 16px;">
              Status: <span style="color: var(--brand-emerald); font-weight: 600;">✓ Fully Backed by Onchain Collateral</span>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Corporate Profit Payout</h3>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Available proceeds can be swept directly to the merchant corporate treasury wallet at any time.</p>
            
            <div style="background: #0c121e; padding: 14px; border-radius: 8px; margin-bottom: 16px;">
              <div style="font-size: 12px; color: var(--text-muted);">Payout Destination (Whitechain Sepolia)</div>
              <div style="font-size: 13px; font-family: monospace; color: #fff; margin-top: 4px;">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</div>
            </div>

            <button class="btn-secondary" style="width: 100%;" onclick="withdrawProceeds()">Sweep $9,984.00 to Corporate Wallet</button>
          </div>
        </div>

      </section>

      <!-- ================================================================= -->
      <!-- TAB 7: DEVELOPER & WEBHOOKS -->
      <!-- ================================================================= -->
      <section id="tab-developer" class="tab-pane">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div>
            <h2 style="font-size: 22px; font-weight: 700;">Developer Integration & Webhooks</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-top: 4px;">Verified contract bindings, HMAC-signed event dispatchers, and drop-in SDK code</p>
          </div>
          <button class="btn-primary" onclick="simulateWebhook('invoice.paid')">⚡ Test Webhook Dispatch</button>
        </div>

        <div class="card" style="margin-bottom: 24px;">
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 14px;">Verified Smart Contract Endpoints</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px;">
            <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">Whitechain Merchant Hub (Chain ID: 1874)</div>
              <div style="font-family: monospace; color: #34d399; margin-top: 4px;">0x18747a8B99c...312e</div>
            </div>
            <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">Official Whitechain USDT Contract</div>
              <div style="font-family: monospace; color: #34d399; margin-top: 4px;">0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7</div>
            </div>
            <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">Uniswap v4 TreasuryGuardHook (Unichain Sepolia)</div>
              <div style="font-family: monospace; color: #c084fc; margin-top: 4px;">0x00C0A5F1b837269D3E9d6092F0eF675fA5517178</div>
            </div>
            <div style="background: #0c121e; padding: 12px; border-radius: 8px;">
              <div style="font-size: 11px; color: var(--text-muted);">Hedera HCS Audit Topic (Testnet 296)</div>
              <div style="font-family: monospace; color: #38bdf8; margin-top: 4px;">${merchantState.agentCommerce.hcsTopicId || "Not configured"}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Real-Time Webhook Simulator</h3>
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Test webhook deliveries with SHA-256 HMAC signatures verified against your secret.</p>
          
          <div style="display: flex; gap: 10px; margin-bottom: 16px;">
            <button class="btn-secondary" onclick="simulateWebhook('invoice.paid')">Test invoice.paid</button>
            <button class="btn-secondary" onclick="simulateWebhook('payment.refunded')">Test payment.refunded</button>
            <button class="btn-secondary" onclick="simulateWebhook('subscription.renewed')">Test subscription.renewed</button>
            <button class="btn-secondary" onclick="simulateWebhook('agent.x402_settled')">Test agent.x402_settled</button>
          </div>

          <div id="webhook-log" style="background: #0c121e; border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px; color: #94a3b8; max-height: 220px; overflow-y: auto;">
            Click any button above to simulate a live signed webhook event.
          </div>
        </div>

      </section>

    </div>
  </main>

  <!-- ===================================================================== -->
  <!-- MODALS -->
  <!-- ===================================================================== -->

  <!-- Modal: Create New Invoice -->
  <div id="modal-invoice" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Create New Store Invoice</h3>
        <button class="close-btn" onclick="closeModal('modal-invoice')">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">Invoice Title / Memo</label>
        <input type="text" id="inv-title" class="form-input" placeholder="e.g. Acme Pro Annual License">
      </div>
      <div class="form-group">
        <label class="form-label">Customer Wallet (Optional)</label>
        <input type="text" id="inv-customer" class="form-input" placeholder="0x... (Leave empty for open checkout)">
      </div>
      <div class="form-group">
        <label class="form-label">Amount (USDT)</label>
        <input type="number" id="inv-amount" class="form-input" placeholder="20.00" value="20.00">
      </div>
      <div class="form-group">
        <label class="form-label">Due in Days</label>
        <input type="number" id="inv-due" class="form-input" placeholder="7" value="7">
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button class="btn-secondary" onclick="closeModal('modal-invoice')">Cancel</button>
        <button class="btn-primary" onclick="submitCreateInvoice()">Generate Invoice</button>
      </div>
    </div>
  </div>

  <!-- Modal: Issue Refund -->
  <div id="modal-refund" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Issue Reserve-Backed Refund</h3>
        <button class="close-btn" onclick="closeModal('modal-refund')">✕</button>
      </div>
      <input type="hidden" id="refund-inv-id">
      <div class="form-group">
        <label class="form-label">Target Invoice</label>
        <input type="text" id="refund-inv-display" class="form-input" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">Refund Amount (USDT)</label>
        <input type="number" id="refund-amount" class="form-input" placeholder="5.00" value="5.00">
      </div>
      <div class="form-group">
        <label class="form-label">Reason for Refund</label>
        <input type="text" id="refund-reason" class="form-input" placeholder="Customer downgrade / satisfaction">
      </div>
      <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); padding: 12px; border-radius: 6px; font-size: 12px; color: #fbbf24; margin-bottom: 16px;">
        ⚠️ This amount will be paid directly to the customer from the Whitechain Refund Reserve Pool.
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button class="btn-secondary" onclick="closeModal('modal-refund')">Cancel</button>
        <button class="btn-danger" onclick="submitRefund()">Execute Onchain Refund</button>
      </div>
    </div>
  </div>

  <!-- Modal: Treasury Swap -->
  <div id="modal-swap" class="modal-overlay">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Uniswap v4 Guarded Treasury Swap</h3>
        <button class="close-btn" onclick="closeModal('modal-swap')">✕</button>
      </div>
      <div class="form-group">
        <label class="form-label">From Asset (Merchant Proceeds)</label>
        <input type="text" class="form-input" value="USDT (Whitechain Sepolia)" disabled>
      </div>
      <div class="form-group">
        <label class="form-label">To Asset</label>
        <select id="swap-to" class="form-input">
          <option value="WETH">WETH (Wrapped Ether)</option>
          <option value="USDC">USDC (USD Coin)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Swap Amount (USDT)</label>
        <input type="number" id="swap-amount" class="form-input" value="500.00">
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Guard Hook Ceiling: $10,000.00 USDT</div>
      </div>
      <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
        <button class="btn-secondary" onclick="closeModal('modal-swap')">Cancel</button>
        <button class="btn-primary" onclick="submitTreasurySwap()">Execute Guarded Swap</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast"></div>

  <!-- ===================================================================== -->
  <!-- JAVASCRIPT APP LOGIC -->
  <!-- ===================================================================== -->
  <script>
    let appState = null;

    // Load initial state from server
    async function loadState() {
      try {
        const res = await fetch('/api/merchant/state');
        appState = await res.json();
        renderOverview();
        renderInvoices();
        renderSubscriptions();
        renderUniswap();
      } catch (e) {
        console.error('Failed to load merchant state', e);
      }
    }

    function switchTab(tabId) {
      document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');

      const navs = document.querySelectorAll('.nav-item');
      navs.forEach(nav => {
        if (nav.innerText.toLowerCase().includes(tabId)) {
          nav.classList.add('active');
        }
      });
    }

    function renderOverview() {
      if (!appState) return;
      document.getElementById('kpi-gross').innerText = '$' + appState.metrics.totalGrossRevenueUsdt.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' USDT';
      document.getElementById('kpi-available').innerText = '$' + appState.metrics.availableProceedsUsdt.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' USDT';
      document.getElementById('kpi-reserve').innerText = '$' + appState.metrics.refundReserveBalanceUsdt.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' USDT';
      document.getElementById('kpi-uniswap').innerText = '$' + appState.metrics.uniswapConvertedSalesUsdt.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' USDT';
      document.getElementById('kpi-agent').innerText = appState.metrics.agentRevenueHbar.toFixed(8) + ' HBAR';
      document.getElementById('kpi-agent-calls').innerText = appState.agentCommerce.totalAgentCalls + ' Queries';
      document.getElementById('kpi-mrr').innerText = '$' + appState.metrics.mrrUsdt.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' USDT';

      const tbody = document.getElementById('overview-activity-tbody');
      tbody.innerHTML = appState.activities.map(act => {
        const chainClass = 'chain-' + act.chainKey;
        return \`
          <tr>
            <td><span class="badge-chain \${chainClass}">\${act.chainKey.toUpperCase()}</span></td>
            <td><strong>\${act.eventType}</strong></td>
            <td style="font-family: monospace;">\${act.from.substring(0, 10)}...</td>
            <td style="font-weight: 600; color: #fff;">\${act.amountFormatted}</td>
            <td><span class="badge-paid">✓ \${act.status}</span></td>
            <td><a href="\${act.explorerUrl}" target="_blank" style="color: #60a5fa; text-decoration: underline;">Proof ↗</a></td>
          </tr>
        \`;
      }).join('');
    }

    function renderInvoices() {
      if (!appState) return;
      const tbody = document.getElementById('invoices-tbody');
      tbody.innerHTML = appState.invoices.map(inv => {
        const isPaid = inv.status === 'PAID';
        const isRefund = inv.status === 'PARTIALLY_REFUNDED' || inv.status === 'FULLY_REFUNDED';
        const badgeClass = isPaid ? 'badge-paid' : isRefund ? 'badge-refund' : 'badge-open';

        return \`
          <tr>
            <td style="font-family: monospace; font-weight: 600;">\${inv.id}</td>
            <div>
              <div style="font-weight: 600; color: #fff;">\${inv.title}</div>
              <div style="font-size: 11px; color: var(--text-muted); font-family: monospace;">Customer: \${inv.customer.substring(0, 12)}...</div>
            </div>
            <td>\${inv.rail}</td>
            <td style="font-weight: 700; color: #fff;">$\${inv.amountUsdt.toFixed(2)} USDT</td>
            <td style="color: var(--brand-amber);">$\${inv.reserveHeldUsdt.toFixed(2)} USDT</td>
            <td><span class="\${badgeClass}">\${inv.status}</span></td>
            <td style="display: flex; gap: 8px;">
              <a href="\${inv.receiptUrl}" class="btn-secondary" style="padding: 4px 8px; font-size: 11px; text-decoration: none;">Receipt</a>
              \${isPaid ? \`<button class="btn-danger" style="padding: 4px 8px; font-size: 11px;" onclick="openRefundModal('\${inv.id}', \${inv.amountUsdt})">Refund</button>\` : ''}
            </td>
          </tr>
        \`;
      }).join('');
    }

    function renderSubscriptions() {
      if (!appState) return;
      const tbody = document.getElementById('subscribers-tbody');
      tbody.innerHTML = appState.subscriptions.map(sub => {
        return \`
          <tr>
            <td style="font-family: monospace;">\${sub.subscriber.substring(0, 12)}...</td>
            <td><strong>\${sub.planName}</strong></td>
            <td>\${sub.cycle}</td>
            <td>\${sub.nextChargeDate}</td>
            <td style="font-weight: 600; color: var(--brand-emerald);">$\${sub.totalPaidUsdt.toFixed(2)} USDT</td>
            <td><span class="badge-paid">\${sub.status}</span></td>
            <td>
              <button class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="renewSubscription('\${sub.id}')">Charge Cycle</button>
            </td>
          </tr>
        \`;
      }).join('');
    }

    function renderUniswap() {
      if (!appState) return;
      const hookBadge = document.getElementById('hook-status-badge');
      const pauseBtn = document.getElementById('btn-toggle-pause');
      if (appState.uniswap.hookPaused) {
        hookBadge.className = 'badge-refund';
        hookBadge.innerText = '⏸️ HOOK PAUSED (CIRCUIT BREAKER)';
        pauseBtn.innerText = '▶️ Resume Swaps';
      } else {
        hookBadge.className = 'badge-paid';
        hookBadge.innerText = '🟢 HOOK ACTIVE (NORMAL)';
        pauseBtn.innerText = '⏸️ Emergency Pause Swaps';
      }
      document.getElementById('hook-max-limit').innerText = '$' + appState.uniswap.maxSwapAmountUsdt.toLocaleString(undefined, {minimumFractionDigits: 2}) + ' USDT';
    }

    // --- Actions ---

    function openNewInvoiceModal() {
      document.getElementById('modal-invoice').style.display = 'flex';
    }

    function openRefundModal(invoiceId, maxAmount) {
      document.getElementById('refund-inv-id').value = invoiceId;
      document.getElementById('refund-inv-display').value = invoiceId + ' ($' + maxAmount.toFixed(2) + ' USDT)';
      document.getElementById('modal-refund').style.display = 'flex';
    }

    function openTreasurySwapModal() {
      document.getElementById('modal-swap').style.display = 'flex';
    }

    function closeModal(modalId) {
      document.getElementById(modalId).style.display = 'none';
    }

    async function submitCreateInvoice() {
      const title = document.getElementById('inv-title').value;
      const customer = document.getElementById('inv-customer').value;
      const amountUsdt = parseFloat(document.getElementById('inv-amount').value);
      const dueDays = parseInt(document.getElementById('inv-due').value);

      const res = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, customer, amountUsdt, dueDays })
      });
      const data = await res.json();
      if (data.success) {
        closeModal('modal-invoice');
        showToast('✓ Invoice ' + data.invoice.id + ' created successfully!', 'success');
        loadState();
      }
    }

    async function submitRefund() {
      const invoiceId = document.getElementById('refund-inv-id').value;
      const amountUsdt = parseFloat(document.getElementById('refund-amount').value);
      const reason = document.getElementById('refund-reason').value;

      const res = await fetch('/api/invoices/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amountUsdt, reason })
      });
      const data = await res.json();
      if (data.success) {
        closeModal('modal-refund');
        showToast('✓ Issued $' + amountUsdt.toFixed(2) + ' refund on Whitechain!', 'success');
        loadState();
      } else {
        alert(data.error);
      }
    }

    async function toggleHookPause() {
      const newStatus = !appState.uniswap.hookPaused;
      const res = await fetch('/api/treasury/hook-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(newStatus ? '🚨 Circuit Breaker: Swaps Paused' : '✓ Swaps Resumed', 'info');
        loadState();
      }
    }

    async function promptUpdateGuardLimit() {
      const limit = prompt('Enter new maximum swap limit (USDT):', appState.uniswap.maxSwapAmountUsdt);
      if (!limit) return;
      const val = parseFloat(limit);
      if (isNaN(val) || val <= 0) return alert('Invalid number');

      const res = await fetch('/api/treasury/hook-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSwapAmountUsdt: val })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Updated TreasuryGuardHook limit to $' + val.toLocaleString(), 'success');
        loadState();
      }
    }

    async function submitTreasurySwap() {
      const toAsset = document.getElementById('swap-to').value;
      const amountUsdt = parseFloat(document.getElementById('swap-amount').value);

      const res = await fetch('/api/treasury/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromAsset: 'USDT', toAsset, amountUsdt })
      });
      const data = await res.json();
      if (data.success) {
        closeModal('modal-swap');
        showToast('✓ Treasury Swap confirmed on Unichain Sepolia!', 'success');
        loadState();
      } else {
        alert(data.error);
      }
    }

    async function claimLpFees() {
      const res = await fetch('/api/treasury/claim-fees', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Claimed $' + data.claimed.toFixed(2) + ' USDT in LP fees!', 'success');
        loadState();
      }
    }

    async function renewSubscription(subscriptionId) {
      const res = await fetch('/api/subscriptions/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Subscription renewal cycle charged on Whitechain!', 'success');
        loadState();
      }
    }

    async function withdrawProceeds() {
      const res = await fetch('/api/reserves/withdraw', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✓ Withdrawn proceeds to corporate treasury wallet!', 'success');
        loadState();
      }
    }

    async function simulateWebhook(eventType) {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType })
      });
      const data = await res.json();
      if (data.success) {
        const box = document.getElementById('webhook-log');
        box.innerHTML = '<span style="color:#34d399;">[200 OK] Dispatched ' + eventType + '</span>\\n' +
          'Header: x-pulsepay-signature: ' + data.signatureHeader + '\\n' +
          JSON.stringify(data.payload, null, 2);
        showToast('✓ Dispatched signed webhook: ' + eventType, 'info');
      }
    }

    function handleGlobalSearch(query) {
      if (!appState) return;
      const q = query.toLowerCase();
      const rows = document.querySelectorAll('#invoices-tbody tr');
      rows.forEach(r => {
        r.style.display = r.innerText.toLowerCase().includes(q) ? '' : 'none';
      });
    }

    function showToast(msg, type) {
      const t = document.getElementById('toast');
      t.innerText = msg;
      t.style.display = 'block';
      setTimeout(() => { t.style.display = 'none'; }, 3000);
    }

    // Run on load
    loadState();
  </script>
</body>
</html>`;
}

// Start HTTP Server
server.listen(PORT, () => {
  console.log(`[PulsePay Demo Store] Server running at http://localhost:${PORT}`);
  console.log(`  - Storefront Checkout:       http://localhost:${PORT}`);
  console.log(`  - Merchant Console:          http://localhost:${PORT}/merchant`);
  console.log(`  - Customer Receipt:          http://localhost:${PORT}/receipt/inv_acme_pro_001`);
  console.log(`  - x402 Discovery Manifest:   http://localhost:${PORT}/.well-known/x402.json`);
  console.log(`  - Protected API Resource:    POST http://localhost:${PORT}/v1/services/market-data-pro/query`);
});
