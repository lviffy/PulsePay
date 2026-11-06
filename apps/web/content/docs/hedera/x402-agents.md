## 01 / Overview

An agent discovers a service, clears its spend policy, answers a 402 challenge and settles in native HBAR. The worker writes an audit trail to consensus.

This page follows the implementation in `packages/sdk-server/src/x402.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm build
pnpm --filter pulsepay-demo-store start
pnpm --filter pulsepay-agent-worker start
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. A funded account is needed only for wallet-authorized writes. No Solidity deployment is required.

## 03 / Walkthrough

Fetch /.well-known/x402.json from the API. POST /v1/services/market-data-pro/query without proof returns 402 with PAYMENT-REQUIRED. The challenge specifies native asset 0.0.0, amount, network, recipient and expiry. X402PayTool validates the terms, journals its transaction ID, pays once and retries the original request with PAYMENT-SIGNATURE.

The API checks the successful mirror receipt, payer debit, exact recipient and amount, challenge-bound memo and consensus time. Identical redeemed proof returns the saved response across restarts. A conflicting proof returns 409. This is PulsePay’s hedera-native-receipt extension; arbitrary facilitator interoperability is not implemented.

## 04 / Discovery and the challenge

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/.well-known/x402.json` | GET | Actual service discovery manifest |
| `/v1/services/market-data-pro/query` | POST | Native receipt protected resource |
| `/api/hedera/payments` | GET | Merchant-only verified payments |

```text
POST /v1/services/market-data-pro/query
← 402 PAYMENT-REQUIRED
  validate terms, reserve budget, sign and settle HBAR
POST /v1/services/market-data-pro/query (PAYMENT-SIGNATURE)
← 200 saved resource response
```

The service returns sample orderbook data. It is not a live market feed. Network and HCS fees are separate from the transfer budget.

## 05 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `generateX402Manifest` | Publishes native receipt discovery |
| `handleX402PaymentCheck` | Issues challenges and independently verifies proof |
| `X402PayTool` | Journals a transfer and redeems its receipt |

Source: [packages/sdk-server/src/x402.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/sdk-server/src/x402.ts).

## 06 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 07 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
