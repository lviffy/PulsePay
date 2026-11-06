import React, { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom, formatUnits, type EIP1193Provider } from "viem";
import { whitechainSepolia, type Invoice } from "@pulsepay/sdk-core";
import { usePulsePay } from "./context.js";
import { WHITECHAIN_SEPOLIA_EXPLORER } from "@pulsepay/shared";

export interface PulsePayCheckoutProps {
  invoiceId: string;
  enablePayWithAnyToken?: boolean;
  onSuccess?: (txHash: string) => void;
  onError?: (err: Error) => void;
}

export function PulsePayCheckout({ invoiceId, enablePayWithAnyToken = false, onSuccess, onError }: PulsePayCheckoutProps) {
  const { client } = usePulsePay();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "CONFIRMED">("IDLE");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true); setError(null); setInvoice(null); setStatus("IDLE"); setTxHash(null);
    const read = async () => {
      if (!/^0x[a-fA-F0-9]{64}$/.test(invoiceId)) throw new Error("Invoice ID must be a bytes32 hex value.");
      const result = await client.invoices.get(invoiceId as `0x${string}`);
      if (!result) throw new Error("Invoice not found on the configured merchant hub.");
      if (current) setInvoice(result);
    };
    read().catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : "Invoice read failed."); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [client, invoiceId, attempt]);

  const handlePay = useCallback(async () => {
    try {
      setStatus("PENDING"); setError(null);
      const ethereum = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
      if (!ethereum) throw new Error("Connect an EVM browser wallet to pay this invoice.");
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0];
      if (!account) throw new Error("No wallet account was authorized.");
      if (await ethereum.request({ method: "eth_chainId" }) !== "0x752") {
        await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x752" }] });
      }
      const wallet = createWalletClient({ account, chain: whitechainSepolia, transport: custom(ethereum) });
      const result = await client.whitechain.payInvoice(invoiceId as `0x${string}`, wallet);
      if (result.receipt.status !== "success") throw new Error(`Payment reverted: ${result.txHash}`);
      setTxHash(result.txHash); setStatus("CONFIRMED"); onSuccess?.(result.txHash);
    } catch (reason: unknown) {
      const failure = reason instanceof Error ? reason : new Error("Payment could not be confirmed.");
      setError(failure.message); setStatus("IDLE"); onError?.(failure);
    }
  }, [client, invoiceId, onSuccess, onError]);

  const payable = invoice?.status === "OPEN" && invoice.dueAt > Date.now() / 1000;
  return <div className="sdk-widget">
    <div className="sdk-widget-head"><h3>PulsePay checkout</h3><span className="sdk-network">Whitechain Sepolia</span></div>
    {loading ? <p role="status">Reading invoice from Whitechain…</p> : invoice && <div className="sdk-total"><small>Amount due / USDT</small><div className="sdk-amount">{formatUnits(invoice.amountUnits, 6)}</div><div className="sdk-invoice-id">{invoice.id}</div><div className="sdk-invoice-id">{invoice.status} · Due {new Date(invoice.dueAt * 1000).toISOString()}</div></div>}
    {enablePayWithAnyToken && <p className="sdk-invoice-id">Other-token quotes are available through the server SDK. Cross-chain swap-to-invoice settlement is not yet supported. This checkout settles directly in USDT.</p>}
    {error && <div className="sdk-error" role="alert">{error}<br/><button type="button" className="sdk-retry" onClick={() => setAttempt(n => n + 1)} disabled={status === "PENDING"}>Retry invoice read</button></div>}
    {status === "CONFIRMED" && txHash ? <div className="sdk-success" role="status">Payment settled.<br/><a href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View confirmed transaction ↗</a></div> : <button type="button" className="sdk-pay" onClick={handlePay} disabled={loading || !payable || status === "PENDING"}>{status === "PENDING" ? "Confirm in wallet · awaiting settlement…" : payable ? `Pay ${formatUnits(invoice!.amountUnits, 6)} USDT ↗` : "No payable invoice"}</button>}
  </div>;
}
