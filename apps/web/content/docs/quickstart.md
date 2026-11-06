## 01 / Overview

Build the workspace, configure the merchant hub, then open a real invoice in the web checkout. The amount comes from the contract.

This page follows the implementation in `README.md`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm --filter @pulsepay/web dev
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Set WHITECHAIN_MERCHANT_HUB_ADDRESS to your deployed contract and PULSEPAY_MERCHANT_ADDRESS to its merchant wallet. Open /merchant/settings and connect a browser wallet on chain 1874. Create an invoice in /merchant/invoices, then paste its bytes32 ID into /pricing-free. Confirm the exact allowance and payment in your wallet.

The web app listens on port 3100. The separate demo API uses port 3000. For Hedera service discovery, set PULSEPAY_SERVICE_URL to the running API origin. The frontend is SvelteKit. Keep private keys and PULSEPAY_API_SECRET server-side; never expose them through public client variables.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayProvider` | Provides the configured unified client |
| `PulsePayCheckout` | Reads an invoice, requests wallet authorization and verifies settlement |

Source: [README.md](https://github.com/lviffy/ETHGLOBAL/blob/main/README.md).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm install --frozen-lockfile --ignore-scripts
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
