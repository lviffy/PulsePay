## 01 / Overview

PulsePayHcsAuditHook records settled agent actions on the configured HCS topic. Failed audit submission is retryable without paying again.

This page follows the implementation in `packages/adapter-hedera/src/hooks/PulsePayHcsAuditHook.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm --filter @pulsepay/adapter-hedera test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. A funded account is needed only for wallet-authorized writes. No Solidity deployment is required.

## 03 / Walkthrough

Set HEDERA_AUDIT_TOPIC_ID to the worker topic. The hook stores audit-pending.json before submission and records the HCS transaction ID before sending. If acknowledgment is lost, retryPending checks the transaction and exact message payload before deciding whether a further submission is safe.

The Hedera tab in /merchant reads topic messages directly from the mirror node, including sequence, consensus timestamp and payer account. It labels them as topic messages. A public topic message alone does not independently prove that its embedded payment is valid; validate the original payment receipt separately.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayHcsAuditHook` | Journals and delivers tool audit payloads |
| `PulsePayHcsAuditHook.retryPending` | Reconciles saved transactions before resubmission |
| `HederaMirrorClient.verifyTopicMessage` | Checks the exact public payload |

Source: [packages/adapter-hedera/src/hooks/PulsePayHcsAuditHook.ts](https://github.com/lviffy/ETHGLOBAL/blob/main/packages/adapter-hedera/src/hooks/PulsePayHcsAuditHook.ts).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm --filter @pulsepay/adapter-hedera test
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
