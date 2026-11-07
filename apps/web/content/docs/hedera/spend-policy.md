## 01 / Overview

PulsePaySpendLimitPolicy validates tool and merchant permissions and reserves a bounded transfer budget before the worker spends.

This page follows the implementation in `packages/adapter-hedera/src/policy/PulsePaySpendLimitPolicy.ts`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm --filter @pulsepay/adapter-hedera test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. A funded account is needed only for wallet-authorized writes. No Solidity deployment is required.

## 03 / Walkthrough

Configure HEDERA_MAX_PAYMENT_TINYBARS and HEDERA_DAILY_BUDGET_TINYBARS. The repository defaults are one tinybar per transfer and ten per day. Policy checks apply before execution and reserve the pending transfer across restarts. A rejected request never becomes a successful payment in the UI.

Transfer limits exclude network and HCS fees. HEDERA_MAX_FEE_TINYBARS and HEDERA_AUDIT_MAX_FEE_TINYBARS cap those transactions separately; they do not implement a global wallet fee budget. Preserve the worker state directory to retain reservations.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePaySpendLimitPolicy` | Agent Kit policy hooks |
| `SpendPolicyConfig` | Tool allowlist, merchant allowlist and transfer limits |

Source: [packages/adapter-hedera/src/policy/PulsePaySpendLimitPolicy.ts](https://github.com/lviffy/PulsePay/blob/main/packages/adapter-hedera/src/policy/PulsePaySpendLimitPolicy.ts).

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
