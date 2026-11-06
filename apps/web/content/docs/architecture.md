## 01 / Overview

Follow value and evidence separately: contract state, transaction receipts, challenge redemption and audit consensus each answer a different question.

This page follows the implementation in `README.md`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm build
pnpm test:unit
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

The web app uses public chain reads for invoices and the browser wallet for writes. The paid API owns private challenge state. The worker owns budget reservations, pending purchases and audit retry state. An HCS message records worker activity; it is not itself a payment receipt.

One server and one worker may own their file-backed stores. Keep PULSEPAY_STATE_DIRECTORY on a persistent volume. Multiple replicas need a transactional shared store before deployment.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WhitechainAdapter` | EVM invoice and billing operations |
| `UniswapRoutingAdapter` | Exact-output quote client |
| `PulsePayHederaPlugin` | Agent Kit tools with spend policy and audit hooks |

Source: [README.md](https://github.com/lviffy/ETHGLOBAL/blob/main/README.md).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
