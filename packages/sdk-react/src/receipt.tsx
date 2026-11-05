import React from "react";
import { WHITECHAIN_SEPOLIA_EXPLORER, PaymentStatus } from "@pulsepay/shared";

export interface PulsePayReceiptProps {
  invoiceId: string;
  merchantAddress: string;
  customerAddress: string;
  amountPaidUsdt: string;
  amountRefundedUsdt?: string;
  status: PaymentStatus;
  paymentTxHash: string;
  refundTxHashes?: string[];
}

export function PulsePayReceipt({
  invoiceId,
  merchantAddress,
  customerAddress,
  amountPaidUsdt,
  amountRefundedUsdt = "0.00",
  status,
  paymentTxHash,
  refundTxHashes = [],
}: PulsePayReceiptProps) {
  const isRefunded = status === "PARTIALLY_REFUNDED" || status === "FULLY_REFUNDED";

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "24px",
        maxWidth: "480px",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a", fontWeight: "600" }}>Verified Customer Receipt</h3>
        <span
          style={{
            fontSize: "12px",
            fontWeight: "600",
            backgroundColor:
              status === "FULLY_REFUNDED"
                ? "#fef2f2"
                : status === "PARTIALLY_REFUNDED"
                ? "#fffbeb"
                : "#f0fdf4",
            color:
              status === "FULLY_REFUNDED"
                ? "#991b1b"
                : status === "PARTIALLY_REFUNDED"
                ? "#92400e"
                : "#166534",
            padding: "4px 8px",
            borderRadius: "6px",
          }}
        >
          {status}
        </span>
      </div>

      <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px", marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Invoice ID</span>
          <span style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
            {invoiceId.slice(0, 10)}...{invoiceId.slice(-6)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Merchant</span>
          <span style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
            {merchantAddress.slice(0, 8)}...{merchantAddress.slice(-6)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Payer</span>
          <span style={{ fontSize: "13px", fontWeight: "500", color: "#0f172a" }}>
            {customerAddress.slice(0, 8)}...{customerAddress.slice(-6)}
          </span>
        </div>
      </div>

      <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "14px", marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: "14px", color: "#334155" }}>Original Payment (USDT)</span>
          <span style={{ fontSize: "15px", fontWeight: "600", color: "#0f172a" }}>${amountPaidUsdt}</span>
        </div>
        {isRefunded && (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#b91c1c" }}>
            <span style={{ fontSize: "14px" }}>Refunded Amount</span>
            <span style={{ fontSize: "15px", fontWeight: "600" }}>-${amountRefundedUsdt}</span>
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "6px" }}>
          Onchain Settlement Evidence
        </div>
        <div style={{ marginBottom: "6px" }}>
          <a
            href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${paymentTxHash}`}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: "12px", color: "#2563eb", textDecoration: "underline" }}
          >
            Payment Transaction on Explorer ↗
          </a>
        </div>
        {refundTxHashes.map((rTx, idx) => (
          <div key={idx} style={{ marginTop: "4px" }}>
            <a
              href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${rTx}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "12px", color: "#d97706", textDecoration: "underline" }}
            >
              Refund #{idx + 1} on Explorer ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

