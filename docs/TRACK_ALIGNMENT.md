# PulsePay — ETHGlobal Mumbai Tri-Track Alignment Matrix

This document maps PulsePay's architectural features, deliverables, and demo flows directly against the exact prize criteria and qualification requirements for the three target tracks at **ETHGlobal Mumbai**:

1. **Hedera** — *AI Agents That Pay: x402 on Hedera* ($6,500) + Optional *No Solidity Allowed* ($2,000)
2. **Whitechain** — *Operate · Stablecoin Payments for Business* ($5,000)

**Total Target Prize Pool:** **$21,500 – $23,500**

---

## 1. Track Alignment Master Matrix

| Track | Prize Pool | Core Qualification Requirements | PulsePay Architectural Implementation | Verified in PRD / Code |
|---|---|---|---|---|
| **Hedera** | $6,500 (1st: $3,000, 2nd: $2,000, 3rd: $1,500) | • At least one x402-protected endpoint<br>• Settles on Hedera testnet/mainnet via facilitator<br>• Autonomous agent completes payment end-to-end with no human approval<br>• Public repo + README with real Hedera tx ID<br>• Demo video $\le$ 5 min with HashScan links | • Protected route `POST /v1/services/:id/query`<br>• `@x402/core` + `@x402/hedera/exact/server` (`ExactHederaScheme`)<br>• Autonomous buyer agent using `@hashgraph/hedera-agent-kit` (v4) + `x402_pay_tool`<br>• Settle in native HBAR (`asset: "0.0.0"`) & tinybars (`100_000_000n`)<br>• Real testnet tx ID and HashScan URL captured | PRD §7.5, §8.4, §9.2, §16 (Phases 5-7), §19.2 |
| **Hedera (Extra Points)** | Top scoring boost | • Spending controls: budgets, per-merchant caps, allowlists, human-in-the-loop threshold<br>• HCS topic tamper-evident audit log<br>• Hedera Agent Kit usage<br>• Multi-agent comparison / research agent<br>• Native HTS / HBAR refunds<br>• *No Solidity Allowed* ($2,000) | • `PulsePaySpendLimitPolicy` extending `AbstractPolicy` (Stage 1 & 3 blocking)<br>• `PulsePayHcsAuditHook` extending `AbstractHook` emitting consensus audit logs to merchant topic<br>• Built with `@hashgraph/hedera-agent-kit` v4 + `BaseTool`<br>• Research agent compares services from registry before buying<br>• Native HBAR refund via `issue_refund_tool`<br>• Zero Solidity deployed on Hedera | PRD §9.2, §16, §19.2, §19.4 |
| **Whitechain** | $5,000 (1st: $2,500, 2nd: $1,500, 3rd: $1,000) | • Whitechain Sepolia (Chain ID `1874`)<br>• Verified contract on Whitechain explorer<br>• Payment in official USDT (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`)<br>• README explains why onchain stablecoin settlement is needed<br>• Drop-in widget/SDK added in ~20 lines<br>• Both views in demo: merchant & customer<br>• Post-first-payment flow: refund, subscription renewal, CSV export<br>• `WHITECHAIN_FEEDBACK.md`<br>• 2–4 min demo video | • `PulsePayMerchantHub.sol` deployed on Whitechain Sepolia (`1874`)<br>• Explicitly bound to official USDT contract<br>• Drop-in `<PulsePayCheckout />` in ~20 lines<br>• Dual UI views: Customer Checkout/Receipt & Merchant Console<br>• One-click reserve-backed partial/full refund onchain<br>• Permit/allowance subscription billing + background renewal worker<br>• Accountant CSV export with normalized multi-chain columns<br>• `WHITECHAIN_FEEDBACK.md` file in root | PRD §7.1–7.4, §8.3, §9.1, §16 (Phases 1-4), §19.1 |

---

## 2. Detailed Verification by Track

### 2.1 Hedera: "AI Agents That Pay: x402 on Hedera" ($6,500)

#### Qualification Compliance:
- [x] **x402 Endpoint:** Hosted at `POST /v1/services/:id/query` using `@x402/core` + `@x402/hedera/exact/server`.
- [x] **Facilitator Settlement:** Facilitator verifies ECDSA client signature, co-signs network submission fees, and settles on Hedera testnet.
- [x] **Zero Human Approval:** Agent discovers service, evaluates policy, signs payment payload, and retrieves response autonomously.
- [x] **Verifiable HashScan Evidence:** Testnet transaction ID captured and linked directly in the UI and README.
- [x] **Demo Length:** Hedera segment allocated ~1 min within a master 3:45 demo video ($\le$ 5 min).

#### Extra-Credit Capabilities Integrated:
- [x] **Spending Controls:** `PulsePaySpendLimitPolicy` (`AbstractPolicy`) enforces per-request limit, daily budget, and merchant allowlist.
- [x] **Tamper-Evident HCS Audit Log:** `PulsePayHcsAuditHook` (`AbstractHook`) automatically logs every settled payment and refund to an HCS topic with consensus timestamps.
- [x] **Official Hedera Agent Kit v4:** Custom `PulsePayHederaPlugin` implementing `Plugin` and tools extending `BaseTool`.
- [x] **Multi-Agent Price Comparison:** Research agent queries `/v1/agent/services`, compares competing data providers, and selects the most cost-effective option within budget.
- [x] **No Solidity on Hedera Bonus:** Hedera module is 100% native (HCS + native HBAR x402 transfers), keeping Solidity exclusively on Whitechain.

---

### 2.2 Whitechain: "Operate · Stablecoin Payments for Business" ($5,000)

#### Qualification Compliance:
- [x] **Network & Chain ID:** Whitechain Sepolia (`1874`), RPC `https://rpc.testnet.whitechain.io`.
- [x] **Official USDT Address:** `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` strictly enforced; no custom minted tokens.
- [x] **Contract Deployment & Verification:** `PulsePayMerchantHub.sol` deployed and verified on Whitechain explorer.
- [x] **README Business Rationale:** Contains explicit statement on why onchain stablecoin settlement on Whitechain is essential for automated, borderless merchant checkout without intermediary chargeback risks.
- [x] **Drop-in Integration:** `<PulsePayCheckout />` in `@pulsepay/react` embeddable in ~20 lines.
- [x] **Dual Views Demonstrated:** Merchant operations console and customer hosted checkout/receipt view.
- [x] **Post-First-Payment Lifecycle:**
  - One-click partial/full refund backed by dedicated onchain reserve.
  - Subscription billing with recurring renewals and instant customer cancel.
  - Accountant CSV export with normalized multi-chain transaction logs.
- [x] **Mandatory Deliverables:** `WHITECHAIN_FEEDBACK.md` and 2–4 minute demo video.

---

## 3. Demo Video Storyboard (3m 45s Total)

| Timestamp | Target Track | Screen & Action | Key Message & Evidence |
|---|---|---|---|
| **0:00 – 0:20** | Unified Intro | Product Landing & Overview | "PulsePay: The unified onchain payment stack for human customers and autonomous AI agents." |
| **0:20 – 1:10** | **Whitechain** | Customer Checkout (Hosted UI) | Pay $20 in official Whitechain USDT (`0xcedf...5a7`); transaction confirms on Whitechain explorer. |
| **1:10 – 1:50** | **Whitechain** | Merchant Console + Customer Receipt | Issue $5 partial refund with one click; show reserve accounting and customer receipt page with explorer link. |
| **1:50 – 2:20** | **Whitechain** | Subscriptions & Renewals | Active plan with next charge date, cancel-anytime authorization, and accountant CSV export. |
| **2:20 – 3:10** | **Hedera** | Agent Terminal + Resource API | Autonomous Buyer Agent receives 402 challenge, validates `PulsePaySpendLimitPolicy`, settles via x402 facilitator in native HBAR, and unboxes data with zero human clicks. Open HashScan. |
| **3:10 – 3:30** | **Hedera** | HCS Consensus Audit Explorer | Show tamper-evident consensus topic with sequence number and settled transaction reference; highlight "No Solidity" native implementation. |

