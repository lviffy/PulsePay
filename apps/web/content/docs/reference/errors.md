## 01 / Overview

The interface keeps the last request’s error visible and provides a retry. It never fills an unavailable chain with demonstration activity.

This page follows the implementation in `packages/adapter-whitechain/src/client.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm test:unit
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

A 400 indicates invalid input. A 402 is a payment challenge. A 409 indicates a proof conflict. A 503 means a dependency or configuration could not complete verification. For ambiguous payments and audits, retain the transaction ID and reconcile it before considering another submission.

Wallet rejection leaves the write unconfirmed. A mined transaction with receipt.status reverted is a failure. The frontend must never report success based only on a returned transaction hash. For topic messages, distinguish malformed payloads from mirror transport failures.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WhitechainAdapter` | Throws on invalid configuration and failed reads |
| `HederaMirrorClient` | Rejects unindexed or unsuccessful receipts |
| `handleX402PaymentCheck` | Returns status-specific protocol failures |

Source: [packages/adapter-whitechain/src/client.ts](https://github.com/lviffy/PulsePay/blob/main/packages/adapter-whitechain/src/client.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm test:unit
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
