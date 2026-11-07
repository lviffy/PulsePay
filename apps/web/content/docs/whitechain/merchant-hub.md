## 01 / Overview

PulsePayMerchantHub stores invoices, payments, subscription plans and per-merchant balances on Whitechain Sepolia.

This page follows the implementation in `contracts/whitechain/src/PulsePayMerchantHub.sol`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm contracts:whitechain:build
pnpm contracts:whitechain:test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

The hub transfers the configured USDT token with SafeERC20. Payment settlement allocates reserve and available balances according to getMerchantReserveBps. Do not assume a ten-percent reserve from a design reference: the frontend reads the effective policy. Each merchant may set a custom reserve; the contract enforces its bounds.

getInvoice, getPayment, getSubscription and getPlan expose the authoritative records. Index InvoiceCreated and SubscriptionCreated events to discover IDs, then read the current records. This console displays the exact event block window it has loaded.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayMerchantHub` | Ownable, ReentrancyGuard merchant billing contract |
| `getMerchantBalances` | Reads reserve and available USDT |
| `getMerchantReserveBps` | Reads the effective merchant reserve policy |

Source: [contracts/whitechain/src/PulsePayMerchantHub.sol](https://github.com/lviffy/PulsePay/blob/main/contracts/whitechain/src/PulsePayMerchantHub.sol).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm contracts:whitechain:build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
