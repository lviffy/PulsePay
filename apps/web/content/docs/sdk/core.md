## 01 / Overview

createPulsePay constructs Whitechain and CCIP bridge adapters and exposes their real methods through typed groups.

This page follows the implementation in `packages/sdk-core/src/index.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

Install `@pulsepay/sdk-core` from the npm registry:

```bash
npm install @pulsepay/sdk-core viem
# or with pnpm
pnpm add @pulsepay/sdk-core viem
```

For workspace developers building from source:

```bash
pnpm --filter @pulsepay/sdk-core build
```

Published as [`@pulsepay/sdk-core` on npm](https://www.npmjs.com/package/@pulsepay/sdk-core). Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Configure whitechain.contractAddress and an optional rpcUrl, usdtAddress or publicClient. Supply walletClient only for wallet-authorized writes. Configure ccip for cross-chain token bridging. Invalid hub addresses are rejected before a request is sent.

Amounts use bigint in base units. The web API serializes these values as integer strings. Reconstruct bigint before calling writes; never use floating point to calculate a refund or invoice amount.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `createPulsePay` | Constructs PulsePayClient |
| `PulsePayClient.invoices` | get, create, cancel and pay |
| `PulsePayClient.payments` | refund, withdraw, fundReserve and balances |
| `PulsePayClient.subscriptions` | Plans, subscriptions, renewals and cancellation |

Source: [packages/sdk-core/src/index.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/sdk-core/src/index.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/sdk-core build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
