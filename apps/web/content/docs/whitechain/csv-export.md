## 01 / Overview

Export actual payment and refund events with UTC timestamps, raw units and transaction evidence using the shared workspace formatter.

This page follows the implementation in `packages/shared/src/csv.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm --filter @pulsepay/shared build
pnpm --filter @pulsepay/web build
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

Choose Export CSV in the merchant console. The API scans the displayed Whitechain block window for PaymentSettled and RefundIssued, reads event block timestamps and calls formatAccountantCsv. Raw USDT values remain integer strings; formatted values use six decimals. The filename includes the export date.

An export is scoped to the displayed event window. Load an older window to export that range. A failed chain read returns an error, never an empty success file. The existing demo API also exposes /api/export.csv for its verified Hedera receipts; it is a separate ledger.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `formatAccountantCsv` | Formats NormalizedActivity into the shared twelve-column CSV |
| `NormalizedActivity` | Defines asset, event, raw units, counterparties and evidence |

Source: [packages/shared/src/csv.ts](https://github.com/lviffy/PulsePay/blob/main/packages/shared/src/csv.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/shared build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
