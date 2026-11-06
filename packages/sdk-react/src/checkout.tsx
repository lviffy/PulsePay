import React, { useEffect, useRef, useState } from "react";
import { usePulsePay } from "./context.js";
import { WHITECHAIN_SEPOLIA_EXPLORER, type Invoice } from "@pulsepay/shared";

export interface PulsePayCheckoutProps {
  invoiceId: string;
  enablePayWithAnyToken?: boolean;
  onSuccess?: (txHash: string) => void;
  onError?: (err: Error) => void;
}

/** Direct USDT checkout. Success requires a matching onchain PaymentSettled event. */
export function PulsePayCheckout({ invoiceId, enablePayWithAnyToken = false, onSuccess, onError }: PulsePayCheckoutProps) {
  const { client } = usePulsePay();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [status, setStatus] = useState<"LOADING" | "READY" | "PENDING" | "CONFIRMED" | "ERROR">("LOADING");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const paying = useRef(false);

  useEffect(() => {
    let active = true;
    setStatus("LOADING"); setInvoice(null); setError(null); setTxHash(null);
    if (!/^0x[a-fA-F0-9]{64}$/.test(invoiceId)) {
      setError("Invoice ID must be a bytes32 hex value"); setStatus("ERROR"); return;
    }
    client.invoices.get(invoiceId as `0x${string}`).then(value => {
      if (!active) return;
      if (!value || value.status !== "OPEN" || value.dueAt < Date.now()/1000) throw new Error("Invoice is missing, expired or already paid");
      setInvoice(value); setStatus("READY");
    }).catch((error: unknown) => {
      if (active) { setError(error instanceof Error ? error.message : "Invoice could not be loaded"); setStatus("ERROR"); }
    });
    return () => { active = false; };
  }, [client, invoiceId]);

  const pay = async () => {
    if (paying.current || !invoice || status !== "READY") return;
    paying.current = true; setStatus("PENDING"); setError(null);
    let hash: string;
    try {
      hash = await client.whitechain.payInvoice(invoiceId as `0x${string}`);
    } catch (cause: unknown) {
      const error = cause instanceof Error ? cause : new Error("Payment failed");
      setError(error.message); setStatus("ERROR"); paying.current = false; onError?.(error); return;
    }
    setTxHash(hash); setStatus("CONFIRMED"); paying.current = false;
    onSuccess?.(hash);
  };
  const amount = invoice ? `${invoice.amountUnits / 1000000n}.${(invoice.amountUnits % 1000000n).toString().padStart(6, "0")}` : "—";
  return (
    <section aria-label="PulsePay checkout" style={{ fontFamily: "system-ui", border: "1px solid #cbd5e1", borderRadius: 12, padding: 24, maxWidth: 460 }}>
      <h3>PulsePay Checkout</h3>
      <p>Whitechain Sepolia · USDT</p>
      <p>Invoice: <code>{invoiceId}</code></p>
      <p><strong>{amount} USDT</strong></p>
      {enablePayWithAnyToken && <p>Token swaps cannot settle a Whitechain invoice through the Unichain router. Pay this invoice directly in USDT.</p>}
      {status === "CONFIRMED" && txHash ? <p role="status">Payment confirmed. <a href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View verified transaction</a></p> :
        <button type="button" onClick={pay} disabled={status !== "READY" || !client.whitechain.walletClient}>
          {status === "LOADING" ? "Loading invoice…" : status === "PENDING" ? "Waiting for wallet and settlement…" : "Pay invoice in USDT"}
        </button>}
      {!client.whitechain.walletClient && <p>Connect a Whitechain wallet through the provider configuration to pay.</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
