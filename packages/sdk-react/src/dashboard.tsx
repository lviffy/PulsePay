import React, { useState, useMemo } from "react";
import { usePulsePay } from "./context.js";
import { formatAccountantCsv, NormalizedActivity } from "@pulsepay/shared";

export type DashboardTab =
  | "overview"
  | "sales"
  | "subscriptions"
  | "uniswap"
  | "agent"
  | "reserves"
  | "developer";

export interface DashboardInvoice {
  id: string;
  customer: string;
  title: string;
  amountUsdt: number;
  reserveHeldUsdt: number;
  rail: "Direct USDT (Whitechain)" | "Uniswap Pay-With-Any-Token";
  status: "PAID" | "PARTIALLY_REFUNDED" | "FULLY_REFUNDED" | "OPEN";
  dueAt: string;
  paidAt?: string;
  refundedAmountUsdt: number;
  refundReason?: string;
}

export interface DashboardSubscription {
  id: string;
  subscriber: string;
  planName: string;
  cycle: string;
  nextChargeDate: string;
  amountPerCycleUsdt: number;
  totalPaidUsdt: number;
  status: "ACTIVE" | "GRACE_PERIOD" | "CANCELLED";
}

export function MerchantBillingDashboard() {
  const { client } = usePulsePay();
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Financial Metrics State
  const [grossRevenue, setGrossRevenue] = useState(12480.0);
  const [availableBal, setAvailableBal] = useState(9984.0);
  const [reserveBal, setReserveBal] = useState(2496.0);
  const [uniswapSales, setUniswapSales] = useState(4250.0);
  const [agentRevenueHbar, setAgentRevenueHbar] = useState(71.0);
  const [mrr, setMrr] = useState(4120.0);

  // Uniswap Hook & Treasury State
  const [hookPaused, setHookPaused] = useState(false);
  const [maxSwapAmount, setMaxSwapAmount] = useState(10000.0);
  const [lpFeesAccrued, setLpFeesAccrued] = useState(184.2);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapToAsset, setSwapToAsset] = useState("WETH");
  const [swapAmountInput, setSwapAmountInput] = useState("500.00");

  // Invoices State
  const [invoices, setInvoices] = useState<DashboardInvoice[]>([
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
    },
  ]);

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState<DashboardSubscription[]>([
    {
      id: "sub_01",
      subscriber: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      planName: "Acme Studio Pro ($20/mo)",
      cycle: "Cycle 3 of 12",
      nextChargeDate: "2026-12-05",
      amountPerCycleUsdt: 20.0,
      totalPaidUsdt: 60.0,
      status: "ACTIVE",
    },
    {
      id: "sub_02",
      subscriber: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      planName: "Enterprise Data Stream ($150/mo)",
      cycle: "Cycle 5 of 12",
      nextChargeDate: "2026-11-20",
      amountPerCycleUsdt: 150.0,
      totalPaidUsdt: 750.0,
      status: "ACTIVE",
    },
  ]);

  // Refund Modal State
  const [refundTargetInv, setRefundTargetInv] = useState<DashboardInvoice | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState("5.00");
  const [refundReasonInput, setRefundReasonInput] = useState("Customer Satisfaction / Downgrade");

  // Webhook Simulator State
  const [webhookLog, setWebhookLog] = useState<string | null>(null);

  // Normalized Activity Ledger
  const [activities, setActivities] = useState<NormalizedActivity[]>([
    {
      id: "act_001",
      chainKey: "whitechain",
      eventType: "INVOICE_PAID",
      from: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      asset: "USDT",
      amountFormatted: "$20.00",
      amountRaw: "20000000",
      status: "CONFIRMED",
      txId: "0x89274a...312e",
      explorerUrl: "https://explorer.testnet.whitechain.io/tx/0x89274a...312e",
      timestamp: Math.floor(Date.now() / 1000) - 1200,
    },
    {
      id: "act_002",
      chainKey: "uniswap",
      eventType: "TREASURY_SWAP",
      from: "0x3C44...93BC",
      to: "0xf39Fd6e5...2266",
      asset: "WETH -> USDT (Universal Router)",
      amountFormatted: "0.08 WETH -> $200.00 USDT",
      amountRaw: "200000000",
      status: "CONFIRMED",
      txId: "0x5a193b...8291",
      explorerUrl: "https://sepolia.unichain.org/tx/0x5a193b...8291",
      timestamp: Math.floor(Date.now() / 1000) - 900,
    },
    {
      id: "act_003",
      chainKey: "hedera",
      eventType: "AGENT_SPEND_SETTLED",
      from: "0.0.456789",
      to: "0.0.12345",
      asset: "HBAR",
      amountFormatted: "0.50 HBAR",
      amountRaw: "50000000",
      status: "CONFIRMED",
      txId: "0.0.456789@1730851200.000",
      explorerUrl: "https://hashscan.io/testnet/transaction/0.0.456789@1730851200.000",
      timestamp: Math.floor(Date.now() / 1000) - 600,
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Handlers ---

  const handleIssueRefund = () => {
    if (!refundTargetInv) return;
    const amount = parseFloat(refundAmountInput);
    if (isNaN(amount) || amount <= 0 || amount > refundTargetInv.amountUsdt - refundTargetInv.refundedAmountUsdt) {
      alert("Invalid refund amount");
      return;
    }

    const updated = invoices.map((inv) => {
      if (inv.id === refundTargetInv.id) {
        const newRef = inv.refundedAmountUsdt + amount;
        return {
          ...inv,
          refundedAmountUsdt: newRef,
          refundReason: refundReasonInput,
          status: (newRef >= inv.amountUsdt ? "FULLY_REFUNDED" : "PARTIALLY_REFUNDED") as any,
        };
      }
      return inv;
    });

    setInvoices(updated);
    setReserveBal((prev) => Math.max(0, prev - amount));
    setRefundTargetInv(null);

    const txId = `0xrefund_${Math.random().toString(36).substring(2, 8)}`;
    setActivities((prev) => [
      {
        id: `act_${Date.now()}`,
        chainKey: "whitechain",
        eventType: "REFUND_ISSUED",
        from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        to: refundTargetInv.customer,
        asset: "USDT",
        amountFormatted: `-$${amount.toFixed(2)} USDT`,
        amountRaw: (amount * 1e6).toString(),
        status: "CONFIRMED",
        txId,
        explorerUrl: `https://explorer.testnet.whitechain.io/tx/${txId}`,
        timestamp: Math.floor(Date.now() / 1000),
      },
      ...prev,
    ]);

    showToast(`✓ Issued $${amount.toFixed(2)} refund on Whitechain!`);
  };

  const handleToggleHookPause = () => {
    setHookPaused((prev) => !prev);
    showToast(!hookPaused ? "🚨 Circuit Breaker: Swaps Paused" : "✓ Swaps Resumed");
  };

  const handleExecuteTreasurySwap = () => {
    if (hookPaused) {
      alert("Swap Rejected: TreasuryGuardHook circuit breaker is tripped.");
      return;
    }
    const amount = parseFloat(swapAmountInput);
    if (isNaN(amount) || amount <= 0) return alert("Invalid swap amount");
    if (amount > maxSwapAmount) {
      alert(`Swap Rejected by Hook: Amount ($${amount.toLocaleString()} USDT) exceeds max swap limit of $${maxSwapAmount.toLocaleString()} USDT.`);
      return;
    }
    if (amount > availableBal) {
      alert("Insufficient available proceeds.");
      return;
    }

    setAvailableBal((prev) => prev - amount);
    setSwapModalOpen(false);

    const txId = `0xswap_${Math.random().toString(36).substring(2, 8)}`;
    setActivities((prev) => [
      {
        id: `act_${Date.now()}`,
        chainKey: "uniswap",
        eventType: "TREASURY_SWAP",
        from: "0xf39Fd6e5...2266",
        to: "0x00B0...25f5",
        asset: `USDT -> ${swapToAsset}`,
        amountFormatted: `$${amount.toFixed(2)} USDT -> ${swapToAsset}`,
        amountRaw: (amount * 1e6).toString(),
        status: "CONFIRMED",
        txId,
        explorerUrl: `https://sepolia.unichain.org/tx/${txId}`,
        timestamp: Math.floor(Date.now() / 1000),
      },
      ...prev,
    ]);

    showToast(`✓ Swapped $${amount.toFixed(2)} USDT -> ${swapToAsset} on Uniswap v4!`);
  };

  const handleClaimLpFees = () => {
    setAvailableBal((prev) => prev + lpFeesAccrued);
    const claimed = lpFeesAccrued;
    setLpFeesAccrued(0);
    showToast(`✓ Claimed $${claimed.toFixed(2)} USDT in Uniswap v4 LP fees!`);
  };

  const handleWithdrawProceeds = () => {
    if (availableBal <= 0) {
      showToast("No proceeds currently available to withdraw.");
      return;
    }
    const swept = availableBal;
    setAvailableBal(0);
    const txId = `0xsweep_${Math.random().toString(36).substring(2, 8)}`;
    setActivities((prev) => [
      {
        id: `act_${Date.now()}`,
        chainKey: "whitechain",
        eventType: "TREASURY_SWEEP",
        from: "0x18747a8B99c...312e",
        to: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        asset: "USDT",
        amountFormatted: `$${swept.toFixed(2)} USDT`,
        amountRaw: (swept * 1e6).toString(),
        status: "CONFIRMED",
        txId,
        explorerUrl: `https://explorer.testnet.whitechain.io/tx/${txId}`,
        timestamp: Math.floor(Date.now() / 1000),
      },
      ...prev,
    ]);
    showToast(`✓ Swept $${swept.toFixed(2)} USDT proceeds to corporate treasury wallet on Whitechain!`);
  };

  const handleRenewSubscription = (subId: string) => {
    setSubscriptions((prev) =>
      prev.map((s) => {
        if (s.id === subId) {
          const cur = new Date(s.nextChargeDate);
          cur.setDate(cur.getDate() + 30);
          return {
            ...s,
            totalPaidUsdt: s.totalPaidUsdt + s.amountPerCycleUsdt,
            nextChargeDate: cur.toISOString().split("T")[0],
          };
        }
        return s;
      })
    );
    setGrossRevenue((prev) => prev + 20);
    setAvailableBal((prev) => prev + 16);
    setReserveBal((prev) => prev + 4);
    showToast("✓ Subscription renewal cycle charged on Whitechain!");
  };

  const handleDownloadCsv = () => {
    const csvContent = formatAccountantCsv(activities);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pulsepay-ledger-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("✓ Downloaded Accountant CSV");
  };

  const handleSimulateWebhook = (eventType: string) => {
    const payload = {
      eventId: `evt_${Math.random().toString(36).substring(2, 9)}`,
      eventType,
      timestamp: Date.now(),
      merchant: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      amountUsdt: "20.00",
    };
    setWebhookLog(
      `[200 OK] Dispatched ${eventType}\nHeader: x-pulsepay-signature: sha256=9f82...31a\n` +
        JSON.stringify(payload, null, 2)
    );
    showToast(`✓ Webhook event simulated: ${eventType}`);
  };

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter(
      (i) => i.id.toLowerCase().includes(q) || i.customer.toLowerCase().includes(q) || i.title.toLowerCase().includes(q)
    );
  }, [invoices, searchQuery]);

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#090d16",
        color: "#f8fafc",
        minHeight: "100vh",
        display: "flex",
      }}
    >
      {/* Toast */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            backgroundColor: "#1f2937",
            border: "1px solid #374151",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: "500",
            zIndex: 9999,
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{
          width: "250px",
          backgroundColor: "#111827",
          borderRight: "1px solid #1e293b",
          padding: "24px 16px",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              background: "linear-gradient(135deg, #2563eb, #a855f7)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#fff",
            }}
          >
            P
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#fff" }}>PulsePay</h3>
            <span
              style={{
                fontSize: "11px",
                background: "rgba(59,130,246,0.15)",
                border: "1px solid rgba(59,130,246,0.3)",
                color: "#60a5fa",
                padding: "2px 6px",
                borderRadius: "4px",
                fontWeight: 600,
              }}
            >
              Acme Studio Pro
            </span>
          </div>
        </div>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "sales", label: "Sales & Invoices", icon: "🧾" },
            { id: "subscriptions", label: "Subscriptions", icon: "🔄" },
            { id: "uniswap", label: "Uniswap & Treasury", icon: "🦄" },
            { id: "agent", label: "AI Agent Commerce", icon: "🤖" },
            { id: "reserves", label: "Reserves & Payouts", icon: "🏦" },
            { id: "developer", label: "Developer & Webhooks", icon: "⚙️" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DashboardTab)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 12px",
                borderRadius: "8px",
                backgroundColor: activeTab === tab.id ? "rgba(59,130,246,0.15)" : "transparent",
                color: activeTab === tab.id ? "#60a5fa" : "#94a3b8",
                border: "none",
                textAlign: "left",
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? "600" : "500",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid #1e293b", paddingTop: "16px", fontSize: "11px", color: "#64748b" }}>
          <div>Whitechain: Sepolia (1874)</div>
          <div>Unichain: 1301 · Hedera: 296</div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#fff" }}>
              Merchant Financial Operations
            </h1>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "13px" }}>
              Multi-chain settlement across Whitechain USDT, Uniswap v4 Treasury, and Hedera x402 Agents
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setSwapModalOpen(true)}
              style={{
                padding: "8px 14px",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
              }}
            >
              ⚡ Treasury Swap
            </button>
            <button
              onClick={handleDownloadCsv}
              style={{
                padding: "8px 14px",
                backgroundColor: "#2563eb",
                border: "none",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              📥 Export CSV
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ================================================================= */}
        {activeTab === "overview" && (
          <div>
            {/* KPI Cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                  Total Gross Revenue
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
                  ${grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </div>
                <div style={{ fontSize: "11px", color: "#10b981", marginTop: "4px" }}>+18.4% last 30 days</div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                  Available Proceeds
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
                  ${availableBal.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </div>
                <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "4px" }}>80% liquid proceeds ready to withdraw</div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                  Refund Reserve Pool
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
                  ${reserveBal.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </div>
                <div style={{ fontSize: "11px", color: "#f59e0b", marginTop: "4px" }}>20% collateral safeguarding customer refunds</div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                  Uniswap Any-Token Sales
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
                  ${uniswapSales.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </div>
                <div style={{ fontSize: "11px", color: "#c084fc", marginTop: "4px" }}>Universal Router exact output swaps</div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                  Hedera AI Agent Revenue
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
                  {agentRevenueHbar.toFixed(2)} HBAR
                </div>
                <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "4px" }}>142 queries consensus-settled</div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "#94a3b8", textTransform: "uppercase", fontWeight: 600 }}>
                  Monthly Recurring Revenue (MRR)
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
                  ${mrr.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                </div>
                <div style={{ fontSize: "11px", color: "#10b981", marginTop: "4px" }}>38 active recurring subscriptions</div>
              </div>
            </div>

            {/* Unified Activity Table */}
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", fontWeight: 600, fontSize: "14px" }}>
                Unified Multi-Chain Event Ledger
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead style={{ background: "#0c121e", color: "#94a3b8" }}>
                  <tr>
                    <th style={{ padding: "12px 16px" }}>Chain</th>
                    <th style={{ padding: "12px 16px" }}>Event</th>
                    <th style={{ padding: "12px 16px" }}>Counterparty</th>
                    <th style={{ padding: "12px 16px" }}>Amount</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Explorer Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act) => (
                    <tr key={act.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 6px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor:
                              act.chainKey === "whitechain"
                                ? "rgba(16,185,129,0.15)"
                                : act.chainKey === "uniswap"
                                ? "rgba(168,85,247,0.15)"
                                : "rgba(14,165,233,0.15)",
                            color:
                              act.chainKey === "whitechain"
                                ? "#34d399"
                                : act.chainKey === "uniswap"
                                ? "#c084fc"
                                : "#38bdf8",
                          }}
                        >
                          {act.chainKey.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{act.eventType}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{act.from.substring(0, 10)}...</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#fff" }}>{act.amountFormatted}</td>
                      <td style={{ padding: "12px 16px", color: "#34d399" }}>✓ {act.status}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <a
                          href={act.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#60a5fa", textDecoration: "underline" }}
                        >
                          Proof ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: SALES & INVOICES */}
        {/* ================================================================= */}
        {activeTab === "sales" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="Search invoices by ID, customer wallet, or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: "#0c121e",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  color: "#fff",
                  fontSize: "13px",
                  width: "380px",
                }}
              />
            </div>

            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead style={{ background: "#0c121e", color: "#94a3b8" }}>
                  <tr>
                    <th style={{ padding: "12px 16px" }}>Invoice ID</th>
                    <th style={{ padding: "12px 16px" }}>Title & Customer</th>
                    <th style={{ padding: "12px 16px" }}>Rail</th>
                    <th style={{ padding: "12px 16px" }}>Amount</th>
                    <th style={{ padding: "12px 16px" }}>Reserve Held</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: 600 }}>{inv.id}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{inv.title}</div>
                        <div style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                          {inv.customer.substring(0, 12)}...
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>{inv.rail}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#fff" }}>
                        ${inv.amountUsdt.toFixed(2)} USDT
                      </td>
                      <td style={{ padding: "12px 16px", color: "#f59e0b" }}>${inv.reserveHeldUsdt.toFixed(2)} USDT</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor:
                              inv.status === "PAID"
                                ? "rgba(16,185,129,0.15)"
                                : inv.status.includes("REFUND")
                                ? "rgba(245,158,11,0.15)"
                                : "rgba(59,130,246,0.15)",
                            color:
                              inv.status === "PAID"
                                ? "#34d399"
                                : inv.status.includes("REFUND")
                                ? "#fbbf24"
                                : "#60a5fa",
                          }}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {inv.status === "PAID" && (
                          <button
                            onClick={() => {
                              setRefundTargetInv(inv);
                              setRefundAmountInput("5.00");
                            }}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "rgba(239,68,68,0.15)",
                              border: "1px solid rgba(239,68,68,0.3)",
                              color: "#f87171",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Issue Refund
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: SUBSCRIPTIONS */}
        {/* ================================================================= */}
        {activeTab === "subscriptions" && (
          <div>
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b", fontWeight: 600, fontSize: "14px" }}>
                Active Recurring Subscribers
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                <thead style={{ background: "#0c121e", color: "#94a3b8" }}>
                  <tr>
                    <th style={{ padding: "12px 16px" }}>Subscriber</th>
                    <th style={{ padding: "12px 16px" }}>Plan</th>
                    <th style={{ padding: "12px 16px" }}>Cycle</th>
                    <th style={{ padding: "12px 16px" }}>Next Charge</th>
                    <th style={{ padding: "12px 16px" }}>Total Paid</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id} style={{ borderBottom: "1px solid #1e293b" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace" }}>{sub.subscriber.substring(0, 12)}...</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600 }}>{sub.planName}</td>
                      <td style={{ padding: "12px 16px" }}>{sub.cycle}</td>
                      <td style={{ padding: "12px 16px" }}>{sub.nextChargeDate}</td>
                      <td style={{ padding: "12px 16px", color: "#34d399", fontWeight: 600 }}>
                        ${sub.totalPaidUsdt.toFixed(2)} USDT
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ padding: "3px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => handleRenewSubscription(sub.id)}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#1e293b",
                            border: "1px solid #334155",
                            color: "#fff",
                            borderRadius: "4px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                        >
                          Charge Cycle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: UNISWAP & TREASURY */}
        {/* ================================================================= */}
        {activeTab === "uniswap" && (
          <div>
            {/* Hook Status Banner */}
            <div
              style={{
                background: "#111827",
                border: "1px solid #1e293b",
                borderLeft: "4px solid #a855f7",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#c084fc", textTransform: "uppercase" }}>
                    Uniswap v4 Custom Risk Hook
                  </div>
                  <h3 style={{ margin: "4px 0 0 0", fontSize: "17px", fontWeight: 700 }}>
                    TreasuryGuardHook.sol (Salt Mined: 0x00C0 Bitmask)
                  </h3>
                </div>
                <button
                  onClick={handleToggleHookPause}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                    backgroundColor: hookPaused ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                    border: hookPaused ? "1px solid #10b981" : "1px solid #ef4444",
                    color: hookPaused ? "#34d399" : "#f87171",
                  }}
                >
                  {hookPaused ? "▶️ Resume Swaps" : "⏸️ Emergency Pause Swaps"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Max Single Swap Limit</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "2px" }}>
                    ${maxSwapAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Circuit Breaker Status</div>
                  <div style={{ fontSize: "16px", fontWeight: 700, marginTop: "2px", color: hookPaused ? "#f87171" : "#34d399" }}>
                    {hookPaused ? "⏸️ CIRCUIT BREAKER TRIPPED" : "🟢 NORMAL (SWAPS ACTIVE)"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>PoolManager Address</div>
                  <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#60a5fa", marginTop: "2px" }}>
                    0x00B036bf97F650eEa2f656606A6C4F07449c25f5
                  </div>
                </div>
              </div>
            </div>

            {/* LP Position Card */}
            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Uniswap v4 Treasury LP Position (USDT/USDC)</h3>
                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "rgba(16,185,129,0.15)", color: "#34d399" }}>
                  IN RANGE
                </span>
              </div>
              <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Position Value</div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>$24,500.00</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Accrued Unclaimed Fees</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#34d399" }}>
                    ${lpFeesAccrued.toFixed(2)} USDT
                  </div>
                </div>
              </div>
              <button
                onClick={handleClaimLpFees}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  color: "#fff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Claim ${lpFeesAccrued.toFixed(2)} Accrued Fees
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: AI AGENT COMMERCE */}
        {/* ================================================================= */}
        {activeTab === "agent" && (
          <div>
            <div
              style={{
                background: "#111827",
                border: "1px solid #1e293b",
                borderLeft: "4px solid #0ea5e9",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "24px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
                    Hedera Agent Kit v4 Policies & Consensus Logging
                  </div>
                  <h3 style={{ margin: "4px 0 2px 0", fontSize: "17px", fontWeight: 700 }}>
                    PulsePaySpendLimitPolicy & HCS Audit Topic 0.0.789123
                  </h3>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    100% Native TypeScript SDK (@hashgraph/sdk) — Zero Solidity on Hedera!
                  </div>
                </div>
                <span
                  style={{
                    fontSize: "12px",
                    background: "rgba(14,165,233,0.15)",
                    color: "#38bdf8",
                    border: "1px solid rgba(14,165,233,0.3)",
                    padding: "4px 10px",
                    borderRadius: "6px",
                    fontWeight: 600,
                  }}
                >
                  TOPIC: 0.0.789123
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", borderTop: "1px solid #1e293b", paddingTop: "16px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Daily Spend Budget</div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>50.00 HBAR</div>
                  <div style={{ fontSize: "11px", color: "#34d399", marginTop: "2px" }}>Per-agent threshold</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Max Per Request Limit</div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }}>1.00 HBAR</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>100,000,000 tinybars</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Human Approvals Needed</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#34d399" }}>0 Approvals</div>
                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>100% Autonomous</div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Audit Topic HashScan</div>
                  <a
                    href="https://hashscan.io/testnet/topic/0.0.789123"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#38bdf8", fontSize: "13px", textDecoration: "underline", display: "inline-block", marginTop: "4px" }}
                  >
                    HashScan Topic Explorer ↗
                  </a>
                </div>
              </div>
            </div>

            <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px 0" }}>Registered x402 Agent Services</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>Acme Real-Time Orderbook API</h4>
                <div style={{ fontSize: "12px", color: "#60a5fa", fontFamily: "monospace", marginBottom: "10px" }}>
                  POST /v1/services/market-data-pro/query
                </div>
                <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 12px 0" }}>
                  High-frequency real-time orderbook feeds queried by autonomous arbitrage agents.
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
                  <span>Price: <strong style={{ color: "#fff" }}>0.50 HBAR (asset: 0.0.0)</strong></span>
                  <span>Settled Queries: <strong style={{ color: "#34d399" }}>142</strong></span>
                </div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "16px", fontWeight: 700 }}>Crypto NLP Sentiment Stream</h4>
                <div style={{ fontSize: "12px", color: "#60a5fa", fontFamily: "monospace", marginBottom: "10px" }}>
                  POST /v1/services/ai-sentiment-feed/query
                </div>
                <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 12px 0" }}>
                  Real-time natural language sentiment vectors extracted from decentralized channels.
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", borderTop: "1px solid #1e293b", paddingTop: "12px" }}>
                  <span>Price: <strong style={{ color: "#fff" }}>1.20 HBAR</strong></span>
                  <span>Settled Queries: <strong style={{ color: "#34d399" }}>48</strong></span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: RESERVES & PAYOUTS */}
        {/* ================================================================= */}
        {activeTab === "reserves" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Treasury Reserves & Corporate Payouts</h2>
                <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0 0" }}>
                  Solvency management, reserve pool allocation, and corporate profit withdrawals
                </p>
              </div>
              <button
                onClick={handleWithdrawProceeds}
                style={{
                  padding: "8px 16px",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Withdraw Available Proceeds
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700 }}>Refund Reserve Pool Solvency</h3>
                <p style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: "13px" }}>
                  20% collateral held onchain in PulsePayMerchantHub ensures instant zero-wait customer refunds.
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px" }}>
                  <span>Solvency Ratio: <strong style={{ color: "#34d399" }}>100% Fully Solvent</strong></span>
                  <span>${reserveBal.toFixed(2)} / $2,496.00</span>
                </div>
                <div style={{ height: "8px", width: "100%", background: "#1e293b", borderRadius: "4px", overflow: "hidden", marginBottom: "16px" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (reserveBal / 2496) * 100)}%`, background: "#10b981" }} />
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Status: <span style={{ color: "#34d399", fontWeight: 600 }}>✓ Fully Backed by Onchain Collateral</span>
                </div>
              </div>

              <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "24px" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", fontWeight: 700 }}>Corporate Profit Payout</h3>
                <p style={{ margin: "0 0 16px 0", color: "#94a3b8", fontSize: "13px" }}>
                  Available proceeds can be swept directly to the merchant corporate treasury wallet at any time.
                </p>
                <div style={{ background: "#0c121e", padding: "14px", borderRadius: "8px", marginBottom: "16px" }}>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>Payout Destination (Whitechain Sepolia)</div>
                  <div style={{ fontSize: "13px", fontFamily: "monospace", color: "#fff", marginTop: "4px" }}>
                    0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
                  </div>
                </div>
                <button
                  onClick={handleWithdrawProceeds}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#fff",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Sweep ${availableBal.toFixed(2)} USDT to Corporate Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: DEVELOPER & WEBHOOKS */}
        {/* ================================================================= */}
        {activeTab === "developer" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Developer Integration & Webhooks</h2>
                <p style={{ color: "#94a3b8", fontSize: "13px", margin: "4px 0 0 0" }}>
                  Verified smart contract bindings, HMAC-signed webhooks, and multi-chain CSV accounting
                </p>
              </div>
              <button
                onClick={handleDownloadCsv}
                style={{
                  padding: "8px 16px",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                📥 Download Accountant CSV
              </button>
            </div>

            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px", marginBottom: "20px" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "15px", fontWeight: 600 }}>Verified Smart Contract Endpoints</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
                <div style={{ background: "#0c121e", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Whitechain Merchant Hub (Chain ID: 1874)</div>
                  <div style={{ fontFamily: "monospace", color: "#34d399", marginTop: "4px" }}>0x18747a8B99c...312e</div>
                </div>
                <div style={{ background: "#0c121e", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Official Whitechain USDT Contract</div>
                  <div style={{ fontFamily: "monospace", color: "#34d399", marginTop: "4px" }}>0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7</div>
                </div>
                <div style={{ background: "#0c121e", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Uniswap v4 TreasuryGuardHook (Unichain Sepolia)</div>
                  <div style={{ fontFamily: "monospace", color: "#c084fc", marginTop: "4px" }}>0x00C0A5F1b837269D3E9d6092F0eF675fA5517178</div>
                </div>
                <div style={{ background: "#0c121e", padding: "12px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "11px", color: "#94a3b8" }}>Hedera HCS Audit Topic (Testnet 296)</div>
                  <div style={{ fontFamily: "monospace", color: "#38bdf8", marginTop: "4px" }}>0.0.789123</div>
                </div>
              </div>
            </div>

            <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: "12px", padding: "20px" }}>
              <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: 600 }}>Test Webhook Event Dispatcher</h3>
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                {["invoice.paid", "payment.refunded", "subscription.renewed", "agent.x402_settled"].map((evt) => (
                  <button
                    key={evt}
                    onClick={() => handleSimulateWebhook(evt)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      color: "#fff",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Test {evt}
                  </button>
                ))}
              </div>
              {webhookLog && (
                <pre
                  style={{
                    background: "#0c121e",
                    padding: "14px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    color: "#94a3b8",
                    overflowX: "auto",
                  }}
                >
                  {webhookLog}
                </pre>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Refund Modal */}
      {refundTargetInv && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "24px",
              width: "440px",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: 700 }}>
              Issue Reserve Refund ({refundTargetInv.id})
            </h3>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Refund Amount (USDT)
              </label>
              <input
                type="number"
                value={refundAmountInput}
                onChange={(e) => setRefundAmountInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0c121e",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Reason
              </label>
              <input
                type="text"
                value={refundReasonInput}
                onChange={(e) => setRefundReasonInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0c121e",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setRefundTargetInv(null)}
                style={{
                  padding: "8px 14px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#fff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleIssueRefund}
                style={{
                  padding: "8px 14px",
                  background: "#ef4444",
                  border: "none",
                  color: "#fff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Treasury Swap Modal */}
      {swapModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid #1e293b",
              borderRadius: "14px",
              padding: "24px",
              width: "440px",
            }}
          >
            <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: 700 }}>
              Uniswap v4 Guarded Treasury Swap
            </h3>
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Target Token
              </label>
              <select
                value={swapToAsset}
                onChange={(e) => setSwapToAsset(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0c121e",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              >
                <option value="WETH">WETH (Wrapped Ether)</option>
                <option value="USDC">USDC (USD Coin)</option>
              </select>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
                Amount (USDT)
              </label>
              <input
                type="number"
                value={swapAmountInput}
                onChange={(e) => setSwapAmountInput(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0c121e",
                  border: "1px solid #1e293b",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "13px",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px" }}>
                Protected by TreasuryGuardHook ceiling: $10,000.00 USDT
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                onClick={() => setSwapModalOpen(false)}
                style={{
                  padding: "8px 14px",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#fff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteTreasurySwap}
                style={{
                  padding: "8px 14px",
                  background: "#2563eb",
                  border: "none",
                  color: "#fff",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Execute Swap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
