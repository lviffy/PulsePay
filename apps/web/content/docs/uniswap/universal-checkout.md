## 01 / Overview

Quote the input needed for an exact output amount through the server-side Uniswap Trading API. Keep the API key on the server.

This page follows the implementation in `packages/adapter-uniswap/src/routing.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

Install `@pulsepay/adapter-uniswap` from the npm registry:

```bash
npm install @pulsepay/adapter-uniswap viem
```

For workspace developers running tests:

```bash
pnpm --filter @pulsepay/adapter-uniswap test
```

Published as [`@pulsepay/adapter-uniswap` on npm](https://www.npmjs.com/package/@pulsepay/adapter-uniswap). Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

The existing API accepts POST /api/uniswap/quote with tokenInAddress, tokenInSymbol, tokenInDecimals, tokenOutAddress, targetUsdtAmountUnits, payerAddress and optional slippageTolerancePercent. Configure UNISWAP_API_KEY and UNISWAP_CHAIN_ID. The response is a real quote; API failures do not fall back to simulated prices.

A quote neither broadcasts a swap nor pays an invoice. Unichain Sepolia is chain 1301 and Whitechain Sepolia is 1874. The current adapter cannot bridge between them. The demo checkout offers direct USDT and does not imply that quoting settles a Whitechain payment.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `UniswapRoutingAdapter.getExactOutputQuote` | Validates quote input and API response |
| `PulsePayClient.checkout.quotePayWithToken` | Unified quote entry point |

Source: [packages/adapter-uniswap/src/routing.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/adapter-uniswap/src/routing.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/adapter-uniswap test
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
