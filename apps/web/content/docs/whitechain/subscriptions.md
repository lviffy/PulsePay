## 01 / Overview

Plans define amount, interval and maximum cycles. Subscribers authorize a plan; eligible renewals settle with an explicit renewal ID.

This page follows the implementation in `packages/adapter-whitechain/src/client.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm contracts:whitechain:test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

Create a plan from /merchant/subscriptions. A subscriber must authorize it using createSubscription; the first cycle is paid during subscription creation. The adapter may request USDT allowance for future cycles, so review the wallet allowance carefully. The merchant can execute a due renewal using chargeRenewal and cancel through cancelSubscription.

The dashboard discovers SubscriptionCreated events for the merchant and reads each subscription through the adapter. Active status, cycle count and nextChargeAt come from the contract. No local timer proves a renewal happened.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WhitechainAdapter.createPlan` | Creates amountPerCycleUnits, intervalSeconds and maxCycles |
| `WhitechainAdapter.getSubscription` | Reads current cycle and active state |
| `WhitechainAdapter.chargeRenewal` | Charges a due cycle with a unique renewal ID |
| `WhitechainAdapter.cancelSubscription` | Cancels a subscription |

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
