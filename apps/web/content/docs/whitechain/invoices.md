## 01 / Overview

Create an amount, a due time and an optional customer restriction. Discover the ID from InvoiceCreated and read its current state before payment.

This page follows the implementation in `packages/adapter-whitechain/src/client.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

Install `@pulsepay/adapter-whitechain` from the npm registry:

```bash
npm install @pulsepay/adapter-whitechain viem
```

For workspace developers building and testing from source:

```bash
pnpm --filter @pulsepay/adapter-whitechain build
pnpm --filter @pulsepay/adapter-whitechain test
```

Published as [`@pulsepay/adapter-whitechain` on npm](https://www.npmjs.com/package/@pulsepay/adapter-whitechain). Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

Call client.invoices.create with amountUnits as bigint and dueAtSeconds as a Unix timestamp. USDT uses six decimals. The invoice ID is bytes32; the adapter can generate it. Optional customer and metadataHash values must be valid addresses and bytes32 values. Use client.invoices.get(id) to read amountUnits, customer, dueAt and status.

The frontend uses adapter reads after discovering real creation events. A failed invoice read remains an error row with its ID. The list is never replaced with seeded or preview invoices.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WhitechainAdapter.createInvoice` | Submits invoice creation and returns invoiceId, txHash and receipt |
| `WhitechainAdapter.getInvoice` | Reads a current invoice or null |
| `WhitechainAdapter.cancelInvoice` | Cancels an open invoice |

Source: [packages/adapter-whitechain/src/client.ts](https://github.com/lviffy/PulsePay/blob/main/packages/adapter-whitechain/src/client.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/adapter-whitechain build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
