import React, { useState, useEffect } from "react";
import { createWalletClient, custom, whitechainSepolia } from "@pulsepay/sdk-core";
import { usePulsePay } from "./context.js";
import {
  WHITECHAIN_USDT_ADDRESS,
  WHITECHAIN_SEPOLIA_EXPLORER,
  SwapQuote,
} from "@pulsepay/shared";

export interface PulsePayCheckoutProps {
  invoiceId: string;
  enablePayWithAnyToken?: boolean;
  onSuccess?: (txHash: string) => void;
  onError?: (err: Error) => void;
}

export function PulsePayCheckout({
  invoiceId,
  enablePayWithAnyToken = true,
  onSuccess,
  onError,
}: PulsePayCheckoutProps) {
  const { client } = usePulsePay();

  const [paymentMethod, setPaymentMethod] = useState<"USDT" | "SWAP">("USDT");
  const [selectedToken, setSelectedToken] = useState<"WETH" | "USDC">("WETH");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "PENDING" | "CONFIRMED" | "ERROR">("IDLE");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Default invoice values (in production fetched via client.invoices.get)
  const invoiceAmountUsdt = "20.00";
  const invoiceAmountUnits = 20_000_000n; // 20 USDT (6 decimals)

  useEffect(() => {
    if (paymentMethod === "SWAP") {
      setLoadingQuote(true);
      client.checkout
        .quotePayWithToken({
          tokenInAddress:
            selectedToken === "WETH"
              ? "0x7b79995e5f793a07bc00c21412e50ecae098e7f9"
              : "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
          tokenInSymbol: selectedToken,
          tokenInDecimals: selectedToken === "WETH" ? 18 : 6,
          tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
          targetUsdtAmountUnits: invoiceAmountUnits,
          payerAddress: "0x0000000000000000000000000000000000000000",
        })
        .then((q: SwapQuote) => {
          setQuote(q);
          setLoadingQuote(false);
        })
        .catch((err: Error) => {
          console.error("Quote error:", err);
          setLoadingQuote(false);
        });
    }
  }, [paymentMethod, selectedToken, client]);

  const handlePay = async () => {
    try {
      setStatus("PENDING");
      setErrorMessage(null);

      // Verify browser Web3 wallet provider
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error(
          "No Web3 wallet detected. Please install MetaMask or another Web3 browser extension."
        );
      }

      const ethereum = (window as any).ethereum;

      // Request user account authorization
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No account authorized by wallet");
      }
      const userAccount = accounts[0] as `0x${string}`;

      // Ensure wallet is switched to Whitechain Sepolia (chainId 1874 / hex 0x752)
      try {
        await ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x752" }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x752",
                chainName: "Whitechain Sepolia",
                nativeCurrency: { name: "WBT", symbol: "WBT", decimals: 18 },
                rpcUrls: ["https://rpc.testnet.whitechain.io"],
                blockExplorerUrls: [WHITECHAIN_SEPOLIA_EXPLORER],
              },
            ],
          });
        } else {
          throw switchError;
        }
      }

      const walletClient = createWalletClient({
        account: userAccount,
        chain: whitechainSepolia,
        transport: custom(ethereum),
      });

      let genuineTxHash: string;

      if (paymentMethod === "SWAP") {
        // Real Swap & Pay execution using Uniswap routing
        const tokenInAddress = (
          selectedToken === "WETH"
            ? "0x7b79995e5f793a07bc00c21412e50ecae098e7f9"
            : "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"
        ) as `0x${string}`;

        const swapResult = await client.routing.executeSwap(
          walletClient,
          {
            tokenInAddress,
            tokenInSymbol: selectedToken,
            tokenInDecimals: selectedToken === "WETH" ? 18 : 6,
            tokenOutAddress: WHITECHAIN_USDT_ADDRESS,
            targetUsdtAmountUnits: invoiceAmountUnits,
            maxInputAmountUnits: quote ? BigInt(quote.inputAmount) : undefined,
            recipient: userAccount,
            payerAddress: userAccount,
            slippageTolerancePercent: quote?.slippageTolerance ?? 0.5,
          },
          userAccount
        );
        genuineTxHash = swapResult.txHash;
      } else {
        // Format invoiceId to bytes32 hex
        let formattedInvoiceId: `0x${string}`;
        if (invoiceId.startsWith("0x") && invoiceId.length === 66) {
          formattedInvoiceId = invoiceId as `0x${string}`;
        } else {
          let hex = "";
          for (let i = 0; i < invoiceId.length; i++) {
            hex += invoiceId.charCodeAt(i).toString(16).padStart(2, "0");
          }
          formattedInvoiceId = `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
        }

        // Execute real onchain USDT payment & settlement via Whitechain contract
        const result = await client.whitechain.payInvoice(formattedInvoiceId, walletClient);
        genuineTxHash = result.txHash;
      }

      setTxHash(genuineTxHash);
      setStatus("CONFIRMED");
      onSuccess?.(genuineTxHash);
    } catch (err: any) {
      setStatus("ERROR");
      setErrorMessage(err.message || "Payment transaction failed");
      onError?.(err);
    }
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "24px",
        maxWidth: "460px",
        backgroundColor: "#ffffff",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ margin: 0, fontSize: "18px", color: "#0f172a", fontWeight: "600" }}>PulsePay Checkout</h3>
        <span
          style={{
            fontSize: "12px",
            backgroundColor: "#f1f5f9",
            color: "#475569",
            padding: "4px 8px",
            borderRadius: "6px",
          }}
        >
          Whitechain Sepolia
        </span>
      </div>

      <div style={{ backgroundColor: "#f8fafc", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
        <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "4px" }}>Total Amount Due</div>
        <div style={{ fontSize: "28px", fontWeight: "700", color: "#0f172a" }}>
          ${invoiceAmountUsdt} <span style={{ fontSize: "16px", color: "#64748b", fontWeight: "500" }}>USDT</span>
        </div>
        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
          Invoice ID: {invoiceId.slice(0, 10)}...{invoiceId.slice(-6)}
        </div>
      </div>

      {enablePayWithAnyToken && (
        <div style={{ marginBottom: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: "500", color: "#334155", marginBottom: "8px" }}>
            Select Payment Asset
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setPaymentMethod("USDT")}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: paymentMethod === "USDT" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                backgroundColor: paymentMethod === "USDT" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "14px",
                color: paymentMethod === "USDT" ? "#1d4ed8" : "#334155",
              }}
            >
              Direct USDT
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("SWAP")}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: paymentMethod === "SWAP" ? "2px solid #2563eb" : "1px solid #cbd5e1",
                backgroundColor: paymentMethod === "SWAP" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "14px",
                color: paymentMethod === "SWAP" ? "#1d4ed8" : "#334155",
              }}
            >
              Pay With Any Token (via Uniswap)
            </button>
          </div>
        </div>
      )}

      {paymentMethod === "SWAP" && (
        <div
          style={{
            border: "1px solid #e0e7ff",
            backgroundColor: "#eef2ff",
            padding: "14px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
            <span style={{ fontSize: "13px", color: "#4338ca", fontWeight: "500" }}>Hold a different token?</span>
            <select
              value={selectedToken}
              onChange={(e) => setSelectedToken(e.target.value as any)}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #c7d2fe",
                fontSize: "13px",
              }}
            >
              <option value="WETH">WETH</option>
              <option value="USDC">USDC</option>
            </select>
          </div>

          {loadingQuote ? (
            <div style={{ fontSize: "12px", color: "#6366f1" }}>Fetching real-time Uniswap routing quote...</div>
          ) : quote ? (
            <div>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#312e81" }}>
                You pay: ~{selectedToken === "WETH" ? (Number(quote.inputAmount) / 1e18).toFixed(4) : (Number(quote.inputAmount) / 1e6).toFixed(2)} {selectedToken}
              </div>
              <div style={{ fontSize: "11px", color: "#6366f1", marginTop: "4px" }}>
                {quote.route} (Slippage: {quote.slippageTolerance}%)
              </div>
            </div>
          ) : null}
        </div>
      )}

      {status === "CONFIRMED" ? (
        <div style={{ padding: "16px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px" }}>
          <div style={{ color: "#166534", fontWeight: "600", fontSize: "15px" }}>✓ Payment Settled Successfully</div>
          {txHash && (
            <div style={{ marginTop: "6px" }}>
              <a
                href={`${WHITECHAIN_SEPOLIA_EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: "12px", color: "#2563eb", textDecoration: "underline" }}
              >
                View on Whitechain Explorer →
              </a>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePay}
          disabled={status === "PENDING" || (paymentMethod === "SWAP" && loadingQuote)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "8px",
            border: "none",
            backgroundColor: status === "PENDING" ? "#94a3b8" : "#2563eb",
            color: "#ffffff",
            fontSize: "15px",
            fontWeight: "600",
            cursor: status === "PENDING" ? "not-allowed" : "pointer",
          }}
        >
          {status === "PENDING"
            ? "Confirming Onchain..."
            : paymentMethod === "SWAP"
            ? `Swap & Pay $${invoiceAmountUsdt} USDT`
            : `Pay $${invoiceAmountUsdt} in Official USDT`}
        </button>
      )}

      {errorMessage && (
        <div style={{ marginTop: "12px", color: "#dc2626", fontSize: "13px" }}>{errorMessage}</div>
      )}
    </div>
  );
}

