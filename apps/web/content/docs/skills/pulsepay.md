## 01 / Overview

PulsePay provides an official Agent Skill for AI coding assistants. Installing this skill equips your coding agent (Cursor, Claude Code, Windsurf, Antigravity, GitHub Copilot) with deep knowledge of PulsePay’s multi-rail architecture: Whitechain USDT settlement, Uniswap v4 treasury guard hooks, and Hedera x402 autonomous machine payments.

Once installed, your agent can scaffold payment components, formulate Viem contract calls, gate HTTP APIs with HTTP 402, and set up cryptographic budget policies without needing manual prompt guidance.

## 02 / Quick Installation

You can install the PulsePay skill directly into any supported AI coding tool using `npx`:

```bash
# Universal (Auto-detects active agent in workspace)
npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay
```

The command scans your current repository for tool-specific configuration folders (such as `.claude/`, `.cursor/`, `.windsurf/`, or `.agents/`) and writes the skill specification to the appropriate location.

## 03 / Tool-Specific Commands

If you prefer to target a specific tool or configure multiple assistants explicitly, use the `-a` (agent) flag:

| Tool | Target Directory | NPX Command |
| --- | --- | --- |
| **Claude Code** | `.claude/skills/` | `npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a claude-code` |
| **Cursor** | `.cursor/skills/` | `npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a cursor` |
| **Windsurf** | `.windsurf/skills/` | `npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a windsurf` |
| **Antigravity** | `.agents/skills/` | `npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a antigravity` |
| **GitHub Copilot** | `.github/skills/` | `npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a copilot` |

## 04 / Capabilities & Workflows

With the PulsePay skill enabled, your coding tool automatically understands how to execute and verify operations across all three tracks:

### Whitechain Track (1874)
- **Invoice Creation**: Generates unique `bytes32` invoice identifiers, due date timestamps, and calls `createInvoice` on `PulsePayMerchantHub`.
- **Payment Settlement**: Requests exact USDT allowance, calls `payInvoice`, and verifies the `PaymentSettled` event from the receipt before signaling completion.
- **Refund Reserves**: Issues merchant refunds against specific settled invoices backed by the contract's reserve balance.
- **SaaS Subscriptions**: Creates recurring subscription plans and authorizations.

### Uniswap V4 Track (1301)
- **Universal Checkout**: Quotes exact-output token swaps via the Uniswap Trading API and builds Universal Router calldata.
- **Treasury Guard Hook**: Interacts with `TreasuryGuardHook` to pause/unpause swaps and configure maximum swap volume limits.

### Hedera Track (x402 & HCS)
- **HTTP 402 Gating**: Implements `handleX402PaymentCheck` to challenge autonomous clients for native HBAR (`0.0.0`) payments.
- **Spend Limit Policies**: Configures daily tinybar limits and merchant allowlists using `PulsePaySpendLimitPolicy`.
- **Audit Trails**: Binds `PulsePayHcsAuditHook` to log all settlements to an immutable Hedera Consensus Service topic.

## 05 / Anatomy

| Artifact | Location | Purpose |
| --- | --- | --- |
| `SKILL.md` | `agent/skills/pulsepay/SKILL.md` | Authoritative skill instructions and YAML trigger rules |
| `SkillInstallWidget` | `apps/web/src/lib/components/` | Interactive browser switcher for NPX commands |
| `PulsePayCheckout` | `@pulsepay/sdk-react` | Drop-in React checkout modal for invoices |
| `PulsePayMerchantHub` | `contracts/whitechain/` | Solidity contract for invoicing, balances, and refunds |
| `TreasuryGuardHook` | `contracts/uniswap-v4/` | Uniswap v4 pool boundary guard hook |

## 06 / Verification & Testing

Verify that your coding tool has picked up the skill:

1. Open your assistant prompt (e.g. Claude Code terminal or Cursor Composer).
2. Prompt: `"Add a PulsePay checkout button that opens invoice 0x1111... on Whitechain Sepolia."`
3. Observe that the agent uses `@pulsepay/sdk-react` with `PulsePayProvider`, references the correct chain ID (`1874`), and avoids fabricating fake settlement steps.

