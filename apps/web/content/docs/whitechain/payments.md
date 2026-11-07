## 01 / Overview

A wallet approval is not a payment. PulsePay reports checkout success after the hub emits a matching PaymentSettled event in a successful receipt.

This page follows the implementation in `packages/adapter-whitechain/src/client.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm --filter @pulsepay/adapter-whitechain test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

payInvoice requires wallet and RPC chain 1874, an open non-expired invoice, the authorized customer when specified, and the configured USDT token. It reads allowance and approves only the invoice amount when needed. The success receipt must contain the same invoice ID, payer and amount from the configured hub.

getPayment returns amountPaidUnits, amountRefundedUnits, status and transaction evidence. If a transaction hash cannot be read, the public receipt page presents a retry instead of a fabricated explorer link.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WhitechainAdapter.payInvoice` | Checks wallet, RPC, invoice, token and settlement event |
| `WhitechainAdapter.getPayment` | Reads cumulative payment and refund amounts |
| `PulsePayCheckout` | Renders invoice reads and confirmed settlement |

Source: [packages/adapter-whitechain/src/client.ts](https://github.com/lviffy/PulsePay/blob/main/packages/adapter-whitechain/src/client.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/adapter-whitechain test
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
