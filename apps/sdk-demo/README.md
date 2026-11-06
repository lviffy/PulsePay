# PulsePay SDK Demonstration App & Interactive Showcase

This directory (`apps/sdk-demo`) provides a complete, runnable demonstration of the **PulsePay SDK** across all three bounty tracks: **Whitechain**, **Chainlink CCIP**, and **Hedera**.

---

## What It Demonstrates

1. **🏛️ Whitechain Track:**
   - Real-time queries to the live deployed `PulsePayMerchantHub` (`0xb115ceb2cf3c15a5c1a607284f0599ad6531bbc2`) on **Whitechain Sepolia (`Chain ID 1874`)**.
   - Inspection of live merchant available proceeds and refund reserve balances.
   - On-chain creation and retrieval of invoices with real transaction receipts and Blockscout explorer links.
2. **Chainlink CCIP:**
   - Router fee quotes and unsigned token transfer calldata.
   - Requires `SEPOLIA_RPC_URL` and a lane-supported `CCIP_TOKEN_ADDRESS`; does not use Whitechain USDT for Sepolia quotes.
3. **🌐 Hedera Track:**
   - Server-side x402 HTTP Paywall (`handleX402PaymentCheck`) generating challenge tokens and verifying consensus against the Hedera Mirror Node.
   - Consensus settlement events recorded to the live HCS Audit Topic (`0.0.11330043`).

---

## How to Run

### Option 1: Terminal Interactive Walkthrough (CLI)
Run the automated step-by-step terminal demonstration:

```bash
pnpm --filter pulsepay-sdk-demo start
```

### Option 2: Web Dashboard Demonstration
Start the visual showcase web server:

```bash
pnpm --filter pulsepay-sdk-demo web
```

Then open **[http://localhost:3005](http://localhost:3005)** in your browser.

You can click any of the action buttons:
- **"Query Contract Reserves"**: Reads live balances from the deployed Whitechain contract.
- **"Create On-Chain Invoice"**: Writes a new invoice to Whitechain Sepolia and provides a Blockscout transaction link.
- **"Generate x402 Challenge"**: Demonstrates how an AI agent or client receives an HTTP 402 challenge.

---

## Code Structure

- **`src/cli.ts`**: The terminal runner showing initialization, on-chain execution, quotes, and x402 negotiation.
- **`src/server.ts`**: Standalone HTTP server providing JSON REST endpoints and a frontend demonstration dashboard.
