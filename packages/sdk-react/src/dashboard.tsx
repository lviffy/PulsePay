import React, { useState } from "react";
import { usePulsePay } from "./context.js";
import { formatAccountantCsv, NormalizedActivity } from "@pulsepay/shared";

export function MerchantBillingDashboard() {
  const { client } = usePulsePay();

  // Mock data for live dashboard presentation
  const [reserveBal, setReserveBal] = useState("20.00");
  const [availableBal, setAvailableBal] = useState("80.00");
  const [refundStatus, setRefundStatus] = useState<string | null>(null);

  const mockActivities: NormalizedActivity[] = [
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
    {
      id: "act_003",
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

  const handleIssuePartialRefund = async () => {
    setRefundStatus("Processing $5.00 partial refund on Whitechain...");
    await new Promise((r) => setTimeout(r, 1200));
    setReserveBal("15.00");
    setRefundStatus("✓ $5.00 refund settled on Whitechain. Customer receipt updated!");
  };

  const handleDownloadCsv = () => {
    const csvContent = formatAccountantCsv(mockActivities);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pulsepay-ledger-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "24px", color: "#0f172a" }}>Merchant Financial Operations</h2>
          <p style={{ margin: "4px 0 0 0", color: "#64748b", fontSize: "14px" }}>
            Unified ledger across Whitechain payments, Hedera agent commerce, and Uniswap treasury
          </p>
        </div>
        <button
          onClick={handleDownloadCsv}
          style={{
            padding: "8px 16px",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            fontWeight: "500",
            fontSize: "13px",
          }}
        >
          Export Accountant CSV
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b" }}>Merchant Available Balance</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>${availableBal} USDT</div>
          <div style={{ fontSize: "11px", color: "#166534", marginTop: "4px" }}>Settled on Whitechain Sepolia</div>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b" }}>Refund Reserve (20%)</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>${reserveBal} USDT</div>
          <div style={{ fontSize: "11px", color: "#d97706", marginTop: "4px" }}>Reserved for customer refunds</div>
        </div>
        <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: "12px", color: "#64748b" }}>Active Subscriptions</div>
          <div style={{ fontSize: "24px", fontWeight: "700", color: "#0f172a" }}>1 Active</div>
          <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "4px" }}>Next charge in 30 days</div>
        </div>
      </div>

      {/* Quick Action: Issue Refund */}
      <div
        style={{
          padding: "16px",
          backgroundColor: "#ffffff",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: "600", fontSize: "15px", color: "#0f172a" }}>Recent Payment (#inv_001)</div>
            <div style={{ fontSize: "13px", color: "#64748b" }}>$20.00 USDT paid by 0x7099...79C8</div>
          </div>
          <button
            onClick={handleIssuePartialRefund}
            style={{
              padding: "8px 14px",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "500",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Issue $5.00 Partial Refund
          </button>
        </div>
        {refundStatus && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: "#166534", fontWeight: "500" }}>{refundStatus}</div>
        )}
      </div>

      {/* Unified Multi-Chain Activity Ledger */}
      <div>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#0f172a" }}>Unified Multi-Chain Event Ledger</h4>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
            <thead style={{ backgroundColor: "#f8fafc", color: "#475569" }}>
              <tr>
                <th style={{ padding: "10px 12px" }}>Chain</th>
                <th style={{ padding: "10px 12px" }}>Event</th>
                <th style={{ padding: "10px 12px" }}>Asset / Amount</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Explorer Evidence</th>
              </tr>
            </thead>
            <tbody>
              {mockActivities.map((act) => (
                <tr key={act.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontWeight: "500" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        backgroundColor:
                          act.chainKey === "whitechain"
                            ? "#ecfdf5"
                            : act.chainKey === "hedera"
                            ? "#eff6ff"
                            : "#fdf4ff",
                        color:
                          act.chainKey === "whitechain"
                            ? "#065f46"
                            : act.chainKey === "hedera"
                            ? "#1e40af"
                            : "#86198f",
                      }}
                    >
                      {act.chainKey.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#1e293b" }}>{act.eventType}</td>
                  <td style={{ padding: "10px 12px", fontWeight: "600", color: "#0f172a" }}>
                    {act.amountFormatted}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#16a34a" }}>✓ {act.status}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <a
                      href={act.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#2563eb", textDecoration: "underline" }}
                    >
                      {act.txId} ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

