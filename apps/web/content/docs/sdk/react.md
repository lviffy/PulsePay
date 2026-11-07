## 01 / Overview

Wrap the checkout with PulsePayProvider. Supply the deployed merchant hub and let the widget read the amount, request the wallet and verify settlement.

This page follows the implementation in `packages/sdk-react/src/checkout.tsx`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

Install `@pulsepay/sdk-react` from the npm registry:

```bash
npm install @pulsepay/sdk-react @pulsepay/sdk-core viem react react-dom
# or with pnpm
pnpm add @pulsepay/sdk-react @pulsepay/sdk-core viem react react-dom
```

For workspace developers building from source:

```bash
pnpm --filter @pulsepay/sdk-react build
```

Published as [`@pulsepay/sdk-react` on npm](https://www.npmjs.com/package/@pulsepay/sdk-react). Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Pass invoiceId as bytes32. The SvelteKit /pricing-free page calls the SDK directly and offers direct USDT settlement. React applications can use PulsePayCheckout. The widget reads client.invoices.get, validates open status and due time, then calls WhitechainAdapter.payInvoice with a connected wallet. onSuccess receives the verified payment transaction hash.

PulsePayReceipt renders evidence supplied by the application; it does not independently verify a chain receipt. The web app renders its own Svelte receipt from the invoice and payment API. The former simulation-only MerchantBillingDashboard export has been removed.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayProvider` | Memoizes the unified client for its config |
| `PulsePayCheckout` | Reads invoice and executes direct USDT payment |
| `PulsePayReceipt` | Displays supplied verified payment evidence |

Source: [packages/sdk-react/src/checkout.tsx](https://github.com/lviffy/PulsePay/blob/main/packages/sdk-react/src/checkout.tsx).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/sdk-react build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
