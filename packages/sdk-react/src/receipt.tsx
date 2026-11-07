import React from "react";
import { WHITECHAIN_SEPOLIA_EXPLORER, type PaymentStatus } from "@pulsepay/shared";
import { PulsePayMark } from "./mark.js";

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

export function PulsePayReceipt({ invoiceId, merchantAddress, customerAddress, amountPaidUsdt, amountRefundedUsdt = "0", status, paymentTxHash, refundTxHashes = [] }: PulsePayReceiptProps) {
  const compact = (value: string) => `${value.slice(0, 10)}…${value.slice(-6)}`;
  return <section className="sdk-receipt" aria-label="Payment receipt" style={{ fontFamily: "var(--font-space, sans-serif)", background: "#f1efe7", color: "#20201e" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, borderBottom: "1px solid #d2d0c7", paddingBottom: 20 }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><PulsePayMark size={20} /><h3 style={{ fontSize: 21, margin: 0 }}>Customer receipt</h3></div><span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9 }}>{status.replaceAll("_", " ")}</span></div>
    <dl style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", fontFamily: "var(--font-mono, monospace)", fontSize: 10, lineHeight: 1.7, padding: "20px 0", margin: 0, borderBottom: "1px solid #d2d0c7" }}>
      <dt>INVOICE</dt><dd style={{ margin: 0, textAlign: "right" }} title={invoiceId}>{compact(invoiceId)}</dd>
      <dt>MERCHANT</dt><dd style={{ margin: 0, textAlign: "right" }} title={merchantAddress}>{compact(merchantAddress)}</dd>
      <dt>PAYER</dt><dd style={{ margin: 0, textAlign: "right" }} title={customerAddress}>{compact(customerAddress)}</dd>
      <dt>PAID / USDT</dt><dd style={{ margin: 0, textAlign: "right" }}>{amountPaidUsdt}</dd>
      <dt>REFUNDED / USDT</dt><dd style={{ margin: 0, textAlign: "right" }}>{amountRefundedUsdt}</dd>
    </dl>
    <div style={{ paddingTop: 20, fontFamily: "var(--font-mono, monospace)", fontSize: 10, lineHeight: 1.9 }}>
      {/^(0x)[a-fA-F0-9]{64}$/.test(paymentTxHash) && <a style={{ display: "block", textDecoration: "underline" }} href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${paymentTxHash}`} target="_blank" rel="noreferrer">PAYMENT TRANSACTION ↗</a>}
      {refundTxHashes.filter(hash => /^0x[a-fA-F0-9]{64}$/.test(hash)).map((hash, i) => <a key={hash} style={{ display: "block", textDecoration: "underline" }} href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${hash}`} target="_blank" rel="noreferrer">REFUND {i + 1} ↗</a>)}
    </div>
  </section>;
}
