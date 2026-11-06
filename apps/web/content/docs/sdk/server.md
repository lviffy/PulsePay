## 01 / Overview

The server SDK publishes service terms and gates paid API responses on independently verified native Hedera receipts.

This page follows the implementation in `packages/sdk-server/src/x402.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm --filter @pulsepay/sdk-server test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Configure a native-HBAR price using network hedera:testnet or hedera:mainnet, asset 0.0.0, amountTinybars and payTo. The challenge ID is a bearer secret: only its hash belongs in the public transaction memo. Payment proof binds the original challenge to a transaction ID.

Keep challenges.json private and durable. Public receipts and accounting exports must omit the challenge ID and saved response. Failed mirror confirmation returns 503 and instructs callers to retry the saved proof, not to pay again.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `generateX402Manifest` | Validates and publishes service configuration |
| `handleX402PaymentCheck` | Challenge issuance, receipt verification and durable redemption |
| `getVerifiedHederaPayments` | Reads redeemed payments without challenge secrets |

Source: [packages/sdk-server/src/x402.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/sdk-server/src/x402.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/sdk-server test
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
