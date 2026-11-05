# PulsePay — Unified Onchain Payment Stack

> **ETHGlobal Mumbai 2026 Tri-Track Submission**  
> 🏆 **Whitechain:** *Operate · Stablecoin Payments for Business* ($5,000)  
> 🏆 **Uniswap Foundation:** *Build with Uniswap* ($10,000)  
> 🏆 **Hedera:** *AI Agents That Pay: x402 on Hedera* ($6,500) + *No Solidity Allowed Bonus* ($2,000)  
> **Total Target Prize Pool:** **$21,500 – $23,500**

---

## 🌟 Executive Summary & Problem Rationale

Modern commerce is undergoing a dual transformation: human customers expect frictionless checkout with the tokens they already own, while autonomous AI agents increasingly make programmatic purchases and micro-settlements on behalf of businesses.

Traditional payment systems and existing onchain checkout tools suffer from major limitations:
1. **Volatile Currencies & Chargeback Risk:** Merchants need deterministic settlement in price-stable assets (USDT), verifiable refund guarantees without middleman processing delays, and automated recurring subscription renewal.
2. **Customer Token Fragmentation:** Requiring customers to manually bridge, swap, and acquire a merchant’s specific invoice token introduces severe checkout drop-off.
3. **Agentic Spending Governance:** AI agents lack deterministic guardrails, risking wallet draining, infinite loops, and opaque transactions without tamper-evident audit trails.

**PulsePay solves all three challenges with a unified multi-chain payment architecture:**
- **Whitechain:** Serves as the primary enterprise business hub with low gas fees and sub-second finality, executing invoice creation, official USDT settlement (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`), reserve-backed verifiable refunds, recurring subscription billing, and accountant-ready CSV exports.
- **Uniswap Foundation:** Powers **Universal Checkout ("Pay With Any Token")** via swap routing so customers can pay with WETH or USDC while merchants settle in exact USDT, paired with **Uniswap v4 Treasury Management** via a custom `TreasuryGuardHook.sol` enforcing circuit breakers and maximum swap limits.
- **Hedera:** Powers autonomous AI agent micropayments via **HTTP 402 (`ExactHederaScheme`)** in native HBAR (`asset: "0.0.0"`), governed by official **Hedera Agent Kit v4** policies (`PulsePaySpendLimitPolicy`) and immutable consensus logs (`PulsePayHcsAuditHook`) on Hedera Consensus Service (HCS) — built **100% natively with zero Solidity on Hedera**!

---

## 🏗️ Tri-Track Architecture

```mermaid
flowchart TD
    subgraph HumanCustomer ["Human Customer Flows (Web & App)"]
        HC["Customer Wallet"] -->|Pay in USDT| WCHub["PulsePayMerchantHub.sol (Whitechain Sepolia 1874)"]
        HC -->|Pay in Any Token (WETH/USDC)| UniRouter["Uniswap Universal Router / Trading API"]
        UniRouter -->|Exact Output Swap to USDT| WCHub
        WCHub -->|10% Split| Reserve["Refund Reserve Pool"]
        WCHub -->|90% Split| Avail["Available Merchant Balance"]
        Merchant["Merchant Console"] -->|One-Click Partial Refund| WCHub
        WCHub -->|Instant Refund USDT| HC
    end

    subgraph AIAgent ["Autonomous AI Agent Flows (x402 Micropayments)"]
        Agent["Autonomous Buyer Agent"] -->|1. Discovery| WellKnown["/.well-known/x402.json"]
        Agent -->|2. Check Limits| Policy["PulsePaySpendLimitPolicy (Stage 1 & 3)"]
        Agent -->|3. Probe Resource| Resource["POST /v1/services/:id/query"]
        Resource -->|4. 402 PAYMENT-REQUIRED| Agent
        Agent -->|5. Sign & Settle HBAR| Settle["Hedera Native Settlement (0.0.0)"]
        Settle -->|6. Stage 7 Audit Hook| HCS["Hedera Consensus Service (Topic Audit)"]
    end

    subgraph Treasury ["Enterprise Treasury (Uniswap v4)"]
        TreasuryMgr["Merchant Treasury"] -->|Swap & Rebalance| V4Pool["Uniswap v4 Pool"]
        V4Pool -->|beforeSwap: Enforce Max Size & Pause| Hook["TreasuryGuardHook.sol (0x00C0)"]
        V4Pool -->|afterSwap: Log Audit Event| Ledger["Normalized Multi-Chain Ledger"]
    end
```

---

## 📋 Track Qualification & Verification Matrix

### 1. Whitechain Track: *Operate · Stablecoin Payments for Business* ($5,000)

| Requirement | Implementation Details | Code Pointer |
|---|---|---|
| **Network & Chain ID** | Whitechain Sepolia (`Chain ID 1874`), RPC: `https://rpc.testnet.whitechain.io` | [`packages/adapter-whitechain/src/chain.ts`](packages/adapter-whitechain/src/chain.ts) |
| **Official Stablecoin** | Strictly bound to official Whitechain USDT contract: `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` | [`packages/shared/src/constants.ts`](packages/shared/src/constants.ts) |
| **Verified Contract** | `PulsePayMerchantHub.sol` managing invoices, payments, refunds, and subscriptions | [`contracts/whitechain/src/PulsePayMerchantHub.sol`](contracts/whitechain/src/PulsePayMerchantHub.sol) |
| **Drop-in UI Integration** | `<PulsePayCheckout />` React widget embeddable in ~20 lines | [`packages/sdk-react/src/checkout.tsx`](packages/sdk-react/src/checkout.tsx) |
| **Dual Views Demonstrated** | Customer checkout/receipt view and merchant operational console | Storefront: `/`, Console: `/merchant`, Receipt: `/receipt/:id` in `apps/demo-store` |
| **Post-First-Payment Lifecycle** | • Reserve-backed 1-click partial & full refunds<br>• Recurring subscription billing & cancellation<br>• Accountant CSV export with normalized multi-chain columns | [`packages/adapter-whitechain/src/client.ts`](packages/adapter-whitechain/src/client.ts)<br>[`packages/shared/src/csv.ts`](packages/shared/src/csv.ts) |
| **Feedback File** | Mandatory developer feedback for Whitechain testnet and Blockscout explorer | [`WHITECHAIN_FEEDBACK.md`](WHITECHAIN_FEEDBACK.md) |

### 2. Uniswap Foundation Track: *Build with Uniswap* ($10,000)

| Requirement | Implementation Details | Code Pointer |
|---|---|---|
| **Universal Checkout ("Pay With Any Token")** | Integrates Uniswap swap routing (Trading API / Universal Router) to route exact output swaps, allowing customers to pay with any asset while merchants receive exact USDT | [`packages/adapter-uniswap/src/routing.ts`](packages/adapter-uniswap/src/routing.ts) |
| **Uniswap v4 Custom Hook** | `TreasuryGuardHook.sol` enforcing enterprise risk controls: circuit-breaker emergency pause and max single trade limits (`beforeSwap`), plus accounting event emission (`afterSwap`) | [`contracts/uniswap-v4/src/TreasuryGuardHook.sol`](contracts/uniswap-v4/src/TreasuryGuardHook.sol) |
| **CREATE2 Salt Mining** | Deterministic mining script matching Uniswap v4 `0x00C0` permission bitmask | [`contracts/uniswap-v4/script/DeployHook.s.sol`](contracts/uniswap-v4/script/DeployHook.s.sol) |
| **Feedback File & Form** | Detailed feedback on Uniswap v4 tooling, HookMiner, and SDKs submitted to the Uniswap Developer Feedback Form | [`FEEDBACK.md`](FEEDBACK.md) |

### 3. Hedera Track: *AI Agents That Pay: x402 on Hedera* ($6,500 + $2,000 Bonus)

| Requirement | Implementation Details | Code Pointer |
|---|---|---|
| **x402-Protected Endpoint** | `POST /v1/services/market-data-pro/query` returning 402 with `PAYMENT-REQUIRED` header, settling in native HBAR tinybars (`asset: "0.0.0"`) | [`packages/sdk-server/src/x402.ts`](packages/sdk-server/src/x402.ts)<br>[`apps/demo-store/src/index.ts`](apps/demo-store/src/index.ts) |
| **Autonomous Buyer Agent** | Autonomous procurement agent discovers service, validates policy, signs transfer, and retrieves data with **zero human approval** | [`apps/agent-worker/src/index.ts`](apps/agent-worker/src/index.ts) |
| **Hedera Agent Kit v4 Policies** | `PulsePaySpendLimitPolicy` extending `AbstractPolicy` enforcing per-request caps, daily budgets, and merchant allowlists at Stage 1 & Stage 3 | [`packages/adapter-hedera/src/policy/PulsePaySpendLimitPolicy.ts`](packages/adapter-hedera/src/policy/PulsePaySpendLimitPolicy.ts) |
| **Consensus Audit Trail Hook** | `PulsePayHcsAuditHook` extending `AbstractHook` logging tamper-evident audit messages to a designated HCS topic at Stage 7 | [`packages/adapter-hedera/src/hooks/PulsePayHcsAuditHook.ts`](packages/adapter-hedera/src/hooks/PulsePayHcsAuditHook.ts) |
| **Official BaseTool Plugin** | `PulsePayHederaPlugin` implementing `Plugin` and providing `X402PayTool` and `IssueRefundTool` extending `BaseTool` | [`packages/adapter-hedera/src/plugin.ts`](packages/adapter-hedera/src/plugin.ts) |
| **No Solidity Allowed Bonus ($2,000)** | Hedera implementation is **100% native TypeScript/JavaScript SDK (`@hashgraph/sdk`)**; zero Solidity is deployed on Hedera | [`packages/adapter-hedera/`](packages/adapter-hedera/) |

---

## 📂 Monorepo Structure

```text
ETHGLOBAL/
├── apps/
│   ├── demo-store/             # Acme Studio demo SaaS (Checkout, Receipt, Console, x402 API)
│   └── agent-worker/           # Autonomous procurement agent using Hedera Agent Kit v4
├── contracts/
│   ├── whitechain/             # Foundry project: PulsePayMerchantHub.sol (Chain ID 1874)
│   │   ├── src/PulsePayMerchantHub.sol
│   │   ├── test/PulsePayMerchantHub.t.sol & PulsePayMerchantHubFuzz.t.sol
│   │   └── script/DeployMerchantHub.s.sol
│   └── uniswap-v4/             # Foundry project: TreasuryGuardHook.sol
│       ├── src/TreasuryGuardHook.sol
│       ├── test/TreasuryGuardHook.t.sol
│       └── script/DeployHook.s.sol
├── packages/
│   ├── shared/                 # Multi-chain constants, schemas, types, and CSV exporter
│   ├── adapter-whitechain/     # Viem Whitechain Sepolia client and typed contract bindings
│   ├── adapter-uniswap/        # Universal Checkout swap router and Uniswap v4 treasury client
│   ├── adapter-hedera/         # Hedera Agent Kit v4 plugin, spend policy, and HCS audit hook
│   ├── sdk-core/               # Unified PulsePayClient aggregating multi-chain payment actions
│   ├── sdk-server/             # HTTP 402 handler and agent discovery manifest generator
│   └── sdk-react/              # React components: Checkout widget, Receipt, Billing Dashboard
├── WHITECHAIN_FEEDBACK.md      # Developer feedback for Whitechain Foundation
├── FEEDBACK.md                 # Developer feedback for Uniswap Foundation
└── README.md                   # Master project documentation
```

---

## ⚡ Quickstart & Verification Guide

### Prerequisites
- Node.js >= 20 (Node 26 recommended)
- pnpm >= 10
- Foundry (`forge`, `cast`)

### 1. Build the Entire Monorepo
```bash
# Build all 7 packages and 2 demo applications
pnpm -r build
```

### 2. Run Smart Contract Test Suites

#### Whitechain Merchant Hub Tests (17 Passed)
```bash
cd contracts/whitechain
forge test
```
*Tests unit invoice creation, exact USDT payments, reserve allocation, partial/full refunds, recurring subscription renewals, and invariant fuzz properties.*

#### Uniswap v4 Treasury Guard Hook Tests (9 Passed)
```bash
cd contracts/uniswap-v4
forge test
```
*Tests allowed treasury swaps, blocked oversized swaps, circuit breaker emergency pause, and permission bitmask validation.*

### 3. Run Hedera Agent Kit v4 Integration Tests (6 Passed)
```bash
node packages/adapter-hedera/test/hedera.test.mjs
```
*Verifies Stage 1 tool allowlisting, Stage 3 merchant allowlisting, per-request spending limits, daily budget enforcement, Stage 7 HCS audit hooks, and plugin registration.*

### 4. Launch Demo SaaS Storefront & APIs
```bash
PORT=3000 node apps/demo-store/dist/index.js
```
Open in browser or test via curl:
- **Customer Storefront:** [http://localhost:3000](http://localhost:3000)
- **Merchant Billing Console:** [http://localhost:3000/merchant](http://localhost:3000/merchant)
- **Customer Verifiable Receipt:** [http://localhost:3000/receipt/inv_acme_pro_001](http://localhost:3000/receipt/inv_acme_pro_001)
- **Accountant CSV Export:** [http://localhost:3000/api/export.csv](http://localhost:3000/api/export.csv)
- **x402 Agent Discovery Manifest:** [http://localhost:3000/.well-known/x402.json](http://localhost:3000/.well-known/x402.json)
- **x402 Protected Endpoint:** `POST http://localhost:3000/v1/services/market-data-pro/query`

### 5. Run the Autonomous Procurement Agent
In a separate terminal, launch the autonomous buyer agent:
```bash
node apps/agent-worker/dist/index.js
```
The agent autonomously:
1. Discovers service terms via `/.well-known/x402.json`.
2. Evaluates its `PulsePaySpendLimitPolicy` against daily budget and merchant allowlists.
3. Probes the protected endpoint and captures the `402 PAYMENT-REQUIRED` challenge.
4. Completes native HBAR payment via `X402PayTool` with **zero human approval**.
5. Records the consensus timestamp and transaction hash in the merchant’s HCS audit topic!

---

## 💼 Drop-In Integration Example (~20 Lines)

Merchants can embed PulsePay into any React application with a few lines of code:

```tsx
import React from "react";
import { PulsePayProvider, PulsePayCheckout } from "@pulsepay/sdk-react";

export function CheckoutPage() {
  return (
    <PulsePayProvider
      config={{
        whitechain: { contractAddress: "0xYourMerchantHubAddress" },
        uniswap: { routing: { universalRouterAddress: "0xUniversalRouter" } },
      }}
    >
      <PulsePayCheckout
        invoiceId="inv_acme_pro_001"
        amountUsdt="20.00"
        merchantAddress="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
        onSuccess={(txHash) => console.log("Settled on Whitechain:", txHash)}
      />
    </PulsePayProvider>
  );
}
```

---

## 📜 License

MIT License. Built with passion for ETHGlobal Mumbai 2026.

