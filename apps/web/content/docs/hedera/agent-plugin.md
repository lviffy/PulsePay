## 01 / Overview

PulsePayHederaPlugin binds native HBAR payment and refund tools to the supplied Agent Kit context and its seven-stage lifecycle.

This page follows the implementation in `packages/adapter-hedera/src/plugin.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm --filter @pulsepay/adapter-hedera build
pnpm --filter @pulsepay/adapter-hedera test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. A funded account is needed only for wallet-authorized writes. No Solidity deployment is required.

## 03 / Walkthrough

Use @hashgraph/hedera-agent-kit 4.2 interfaces with @hiero-ledger/sdk 2.90. The plugin binds its supplied context to the real tools. Both SDK convenience execution and the Agent Kit execution form run the hook pipeline. Without an operator or wallet submitter, a prepared transfer remains AWAITING_WALLET.

Do not treat unsigned transaction bytes as settlement. Refund tools reject same-account net-zero transfers, verify the original buyer and retain reservations after ambiguous submission errors. Confirm a wallet-prepared refund through IssueRefundTool.confirmRefund after mirror verification.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayHederaPlugin` | Registers the payment and refund tools |
| `X402PayTool` | Native receipt payment lifecycle |
| `IssueRefundTool` | Verifies the original receipt and refundable remainder |

Source: [packages/adapter-hedera/src/plugin.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/adapter-hedera/src/plugin.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/adapter-hedera build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
