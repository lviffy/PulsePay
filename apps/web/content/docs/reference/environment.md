## 01 / Overview

Public chain addresses may reach the browser. API credentials, signing keys, challenge state and service secrets stay on the server.

This page follows the implementation in `.env.example`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm build
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Use Node 22.13 or newer and pnpm 12.14.0. The web app reads the root .env through @next/env. Its /api/config response is an explicit allowlist of public addresses, RPC, merchant display name, topic and service origin. It does not expose keys. The demo API requires PULSEPAY_API_SECRET of at least 32 characters and a controlled HEDERA_MERCHANT_ACCOUNT_ID.

Set PULSEPAY_MERCHANT_ADDRESS and optional PULSEPAY_MERCHANT_NAME for the console. WHITECHAIN_DEPLOYMENT_BLOCK bounds event scans. PULSEPAY_SERVICE_URL defaults to PULSEPAY_APP_URL. Keep the API and web ports distinct: 3000 and 3100.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `WHITECHAIN_MERCHANT_HUB_ADDRESS` | Deployed merchant contract |
| `PULSEPAY_SERVICE_URL` | Paid API origin used by the web app |
| `HEDERA_AUDIT_TOPIC_ID` | Worker consensus topic |
| `PULSEPAY_STATE_DIRECTORY` | Persistent private state path |

Source: [.env.example](https://github.com/lviffy/PulsePay/blob/main/.env.example).

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
