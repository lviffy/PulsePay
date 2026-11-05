# PulsePay — Unified Onchain Payment Stack (SvelteKit)

PulsePay is an enterprise B2B financial-operations SDK designed for businesses that need to serve both human customers and autonomous AI agents. Built with **SvelteKit + TypeScript + Tailwind CSS** with a strictly disciplined **purple-and-cream** institutional aesthetic.

---

## 🎨 Design Tokens & Visual Language

- **Background:** Refined ultra-light cream (`#FDFDFC` to `#F8F7F4`), providing an elevated, formal B2B look.
- **Ink & Outlines:** `#2B2170` (used for all primary text, container 2px outlines, and solid buttons).
- **Muted text & Lines:** `#645C9A` for metadata/subtitles and `#E2DEF3` for structural dividers.
- **Strict Purple Brand Palette (Zero pink, Zero blue):**
  - Primary Lavender: `#C8C3F2`
  - Secondary Light Purple: `#EAE7FA`
  - Accent Deep Purple: `#B4ADEB`
  - Subtle Lavender Fill: `#D6D2F7`
  - Border & Ink: `#2B2170`
- **Cards & Tabs:** 22px border-radius white cards with straddling pill tabs filled with `#C8C3F2`.
- **Typography:**
  - Headings & Big Numbers: Noto Serif / Liberation Serif (`font-serif`)
  - UI Controls: Inter (`font-sans`)
  - Code, Hashes & Addresses: JetBrains Mono (`font-mono`)

---

## 🧭 Pages & Routes

1. **[`/`](http://localhost:5173/) — Enterprise Landing Page (PRD-Aligned)**
   - **Hero (`01-landing.png` wireframe)**: *"One SDK for getting paid."* with multi-tab code runner (`React / Svelte`, `Vanilla JS`, `x402 Agent Client`), interactive execution simulation console, and direct links to Whitechain, Hedera, and Uniswap.
   - **Tri-Track Architectural Specification**: Interactive tabbed breakdown of the 3 execution adapters:
     - *Whitechain 1874*: Official USDT (`0xcedfB561...`), 20% onchain refund reserves, keeper daemon.
     - *Hedera Testnet*: x402 HTTP micropayments with zero Solidity, Hedera Agent Kit v4 spend policy, and HCS topic `0.0.123456`.
     - *Uniswap v4*: Universal checkout routing ("Pay With Any Token") and `TreasuryGuardHook` policy enforcement.
   - **Acme Studio User Journey**: 5-stage sequential lifecycle illustrating checkout, partial refunds, keeper renewal, AI agent consumption, and treasury protection.
   - **Live Interactive Sandbox**: Test onchain invoice creation and calculate real-time universal token conversion quotes.
   - **Market Benchmark Matrix**: Feature-by-feature comparison with legacy card rails (Stripe) and fragmented Web3 plugins.

2. **[`/checkout`](http://localhost:5173/checkout) — Universal Customer Checkout (`02-checkout.png`)**
   - Interactive `STATES` selector: *Wallet not connected*, *Wrong network*, *Insufficient balance*, *Approval required*, *Pending confirmation*, *Reverted/rejected*, and *Confirmed*.
   - `CUSTOMER CHECKOUT` card with token selection (USDT, WETH, USDC), dashed Uniswap route, and step progress.
   - `RECEIPT` card with verified invoice data and block explorer links.

3. **[`/merchant`](http://localhost:5173/merchant) — Merchant Overview (`03-merchant.png`)**
   - 6 KPI metric cards (*Collected*, *Open invoices*, *Active subs*, *Refunds*, *Agent spend*, *Treasury*).
   - `INVOICES` table with status filters (*All*, *Paid*, *Open*, *Refunded*).
   - `REFUND` card with 20% reserve tracking and *"Goes to original payer only"* banner.

4. **[`/merchant/subscriptions`](http://localhost:5173/merchant/subscriptions) — Subscriptions (`04-subscriptions-receipt.png`)**
   - `PLAN` card (Pro 20.00 USDT / 30 days) and `RENEWAL WORKER` keeper specs.
   - `SUBSCRIBERS` table with cycle progress (`2 / 12`, `5 / 12`).
   - `CUSTOMER RECEIPT` with timeline nodes and *"Cancel subscription"* onchain action.

5. **[`/agents`](http://localhost:5173/agents) — AI Agent Payments (`05-agents.png`)**
   - `PAID SERVICES` catalogue and `+ Publish service` modal.
   - `AGENT ACTIVITY` 5-stage pipeline (*402 quote* &rarr; *Policy pass* &rarr; *Signed* &rarr; *Settled* &rarr; *HCS written*).
   - `SPEND CONTROLS` with daily budget ($5.00), max per request ($0.10), merchant allowlist, budget progress, emergency stop, and mirror node audit log.

6. **[`/treasury`](http://localhost:5173/treasury) — Treasury & Unified Ledger (`06-treasury-ledger.png`)**
   - `TREASURY SWAP` on Unichain Sepolia (`1301`) for swapping USDC to WETH governed by `TreasuryGuardHook`.
   - `HOOK POLICY` with emergency pause and max swap size.
   - `UNIFIED LEDGER` covering Whitechain, Hedera, and Uniswap with chain filtering and `Export CSV`.

---

## 🚀 Run Steps

```bash
# Type check with SvelteKit
pnpm run web:check

# Production build
pnpm run web:build

# Start development server
pnpm run web:dev

# Preview production build (port 4173)
pnpm run web:preview
```
