---
name: pulsepay
description: >
  Integrate PulsePay payment rails, merchant invoicing, refund reserves, Hedera
  x402 autonomous machine payments, and Chainlink CCIP 2.0 token bridging. Use
  when the user asks to accept crypto payments, set up merchant checkout, invoice
  customers in USDT on Whitechain, bridge tokens across testnets with Chainlink CCIP,
  or enable AI agents to pay HTTP-402 pay-per-use endpoints with HBAR.
version: 1.0.0
---

# PulsePay Integration Skill

Unified merchant billing, cross-chain token bridging, and autonomous agent payments across Whitechain, Chainlink CCIP 2.0, and Hedera.

## Quick Installation

Install this skill into your AI coding tool with one command:

```bash
# Universal (Auto-detects Cursor, Claude Code, Windsurf, Copilot, Antigravity)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay
```

### Tool-Specific Commands

```bash
# Claude Code (.claude/skills)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a claude-code

# Cursor (.cursor/skills)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a cursor

# Windsurf (.windsurf/skills)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a windsurf

# Antigravity (.agents/skills)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a antigravity

# GitHub Copilot (.github/skills)
npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a copilot
```

---

## When to Use This Skill

Activate this skill when:
- Creating or querying onchain invoices or recurring subscriptions on **Whitechain Sepolia** (Chain ID `1874`).
- Integrating the `@pulsepay/sdk-react` drop-in checkout (`<PulsePayCheckout />`).
- Bridging tokens across Ethereum Sepolia and Hedera Testnet using **Chainlink CCIP 2.0** with zero destination callback gas.
- Gating HTTP APIs behind autonomous AI agent payments with **Hedera x402** (`hedera-native-receipt`).
- Enforcing spend limits (`PulsePaySpendLimitPolicy`) and recording audit trails to Hedera Consensus Service (`PulsePayHcsAuditHook`).

---

## Architecture at a Glance

| Rail / Track | Network | Primary Contracts / Packages | Purpose |
| :--- | :--- | :--- | :--- |
| **Whitechain** | Sepolia (1874) | `PulsePayMerchantHub.sol`, `@pulsepay/adapter-whitechain` | USDT invoicing, payments, subscription consent, refund reserve pool |
| **Chainlink CCIP 2.0** | Testnets (11155111, 296) | `@pulsepay/adapter-ccip`, CCIP Routers | Cross-chain token bridging directly to destination wallets |
| **Hedera x402** | Testnet / Mainnet | `@pulsepay/adapter-hedera`, `@pulsepay/sdk-server` | Machine payment protocol, HBAR asset `0.0.0`, HCS audit trail |
| **React SDK** | Frontend | `@pulsepay/sdk-react`, `@pulsepay/sdk-core` | Drop-in `<PulsePayCheckout />` component with modal & inline modes |

---

## 1. Whitechain Merchant Settlement

### Creating an Invoice
```typescript
import { createPulsePay, whitechainSepolia } from "@pulsepay/sdk-core";
import { stringToHex } from "viem";

const pulsepay = createPulsePay({
  whitechain: {
    contractAddress: process.env.WHITECHAIN_MERCHANT_HUB_ADDRESS as `0x${string}`,
    usdtAddress: process.env.WHITECHAIN_USDT_ADDRESS as `0x${string}`,
    rpcUrl: "https://rpc.testnet.whitechain.io",
    walletClient, // Viem wallet client
  },
});

// Create a $20.00 USDT invoice
const invoiceId = stringToHex("INV-2026-001", { size: 32 });
const amountUnits = 20_000_000n; // 6 decimals for USDT
const dueAtSeconds = Math.floor(Date.now() / 1000) + 86400 * 7; // 7 days

const tx = await pulsepay.invoices.create({
  invoiceId,
  amountUnits,
  dueAtSeconds,
});
console.log(`Invoice created on Whitechain: ${tx.txHash}`);
```

### Paying an Invoice
```typescript
// Payer approves USDT and pays invoice
const payTx = await pulsepay.payments.pay(invoiceId);
console.log(`Payment confirmed: ${payTx.txHash}`);
```

---

## 2. React Checkout Component

```tsx
import { PulsePayProvider, PulsePayCheckout } from "@pulsepay/sdk-react";

export function CheckoutModal({ invoiceId }: { invoiceId: `0x${string}` }) {
  return (
    <PulsePayProvider
      config={{
        whitechain: {
          contractAddress: "0xb115ceb2cf3c15a5c1a607284f0599ad6531bbc2",
          rpcUrl: "https://rpc.testnet.whitechain.io",
        },
      }}
    >
      <PulsePayCheckout
        invoiceId={invoiceId}
        enablePayWithAnyToken={true}
        onSuccess={(txHash) => console.log("Paid successfully:", txHash)}
        onError={(err) => console.error("Payment error:", err)}
      />
    </PulsePayProvider>
  );
}
```

---

## 3. Hedera x402 Autonomous Machine Payments

### Server-Side Payment Gate (Resource Server)
```typescript
import { handleX402PaymentCheck } from "@pulsepay/sdk-server";

export async function handlePaidApi(req: Request) {
  const paymentSignature = req.headers.get("payment-signature");

  const check = await handleX402PaymentCheck({
    serviceId: "orderbook-stream",
    serviceName: "Acme Orderbook Feed",
    statePath: "./.pulsepay/challenges.json",
    price: {
      network: "hedera:testnet",
      asset: "0.0.0", // Native HBAR
      amountTinybars: "100000000", // 1.00 HBAR
      payTo: "0.0.11329845",
    },
    createResponse: () => ({
      status: "SUCCESS",
      bids: [[0.0825, 150000]],
      asks: [[0.0827, 120000]],
    }),
  }, paymentSignature);

  return new Response(JSON.stringify(check.body), {
    status: check.statusCode,
    headers: check.headers,
  });
}
```

### Agent Client Spend Policy
```typescript
import { PulsePaySpendLimitPolicy, X402PayTool } from "@pulsepay/adapter-hedera";

const policy = new PulsePaySpendLimitPolicy({
  dailyBudgetTinybars: 10_00000000n, // 10 HBAR daily limit
  maxPerRequestTinybars: 1_00000000n, // 1 HBAR max per query
  merchantAllowlist: ["0.0.11329845"],
});

const tool = new X402PayTool();
tool.registerHook(policy);
```

---

## 4. Chainlink CCIP 2.0 Token Bridging

```typescript
import { CCIPBridgeAdapter } from "@pulsepay/adapter-ccip";

const bridge = new CCIPBridgeAdapter();

// 1. Get real-time CCIP bridge fee
const quote = await bridge.quoteBridgeFee({
  destinationChainId: 296, // Hedera testnet
  tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  amountUnits: 10_000_000n, // 10 units
  recipientAddress: "0xYourWalletAddress",
});

// 2. Build unsigned approve & ccipSend transactions
const txs = await bridge.buildBridgeTransactions({
  destinationChainId: 296,
  tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  amountUnits: 10_000_000n,
  recipientAddress: "0xYourWalletAddress",
});
console.log(`Router target: ${txs.to}, value: ${txs.value}`);
```

