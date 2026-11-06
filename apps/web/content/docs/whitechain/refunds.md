## 01 / Overview

The reserve backs full and partial refunds against an actual settled invoice. Every refund produces a transaction and cumulative accounting evidence.

This page follows the implementation in `packages/adapter-whitechain/src/client.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm contracts:whitechain:test
pnpm --filter @pulsepay/adapter-whitechain test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

Open /merchant/refunds, choose a paid invoice and enter an amount up to the remaining refundable balance. Review the invoice, original payer and amount in the confirmation modal. Confirm your wallet transaction. The frontend checks receipt.status before reporting success and then reloads contract state.

The reserve belongs to the merchant. A reason string is hashed with keccak256 by issueRefund. A refund sends settlement USDT to the original customer, not to an arbitrary recipient. The contract consumes refundReserve first, then merchantAvailable. Insufficient combined liquidity and excess refunds revert.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WhitechainAdapter.issueRefund` | Calls issueRefund with invoice, amount and reason hash |
| `WhitechainAdapter.fundRefundReserve` | Approves and deposits additional reserve USDT |
| `PulsePayMerchantHub.issueRefund` | Enforces merchant, reserve and refundable remainder |

Source: [packages/adapter-whitechain/src/client.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/adapter-whitechain/src/client.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm contracts:whitechain:test
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
