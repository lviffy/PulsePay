## 01 / Overview

PulsePay brings merchant billing, treasury controls and native agent payments into one TypeScript workspace. Each chain has an explicit job and its own verification path.

This page follows the implementation in `README.md`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm build
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Whitechain records invoices and USDT settlement. Uniswap supplies exact-output quotes and a v4 treasury hook. Hedera handles native HBAR HTTP-402 receipts and HCS audit messages. These paths are independent: a Uniswap swap cannot currently bridge into a Whitechain invoice.

Read README.md before configuring a deployment. Start with direct USDT checkout or the native HBAR flow, then add treasury controls as needed.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayClient` | Unified SDK entry point; whitechain, routing and optional treasury adapters |

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
