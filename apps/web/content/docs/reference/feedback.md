## 01 / Overview

Use the repository’s test and feedback records to make reproducible reports with a route, chain, transaction and expected outcome.

This page follows the implementation in `docs/VERIFICATION.md`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm verify
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Run pnpm lint, pnpm build and the relevant unit and contract tests. Local test suites use mocked submitters or local EVM execution; they do not broadcast payments. Browser verification should cover desktop and phone layouts, keyboard navigation, reduced motion and explicit read failures.

Report the exact route and action, expected behavior, chain ID and a public transaction hash when relevant. Exclude signing keys, the merchant API secret, challenge IDs and stored responses. Historical live evidence is not proof that today’s deployment remains configured.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `README.md` | Current setup and API behavior |
| `docs/HEDERA.md` | Native payment protocol and historical live evidence |
| `WHITECHAIN_FEEDBACK.md` | Whitechain integration findings |
| `FEEDBACK.md` | Chainlink CCIP integration findings |

Source: [docs/VERIFICATION.md](https://github.com/lviffy/PulsePay/blob/main/docs/VERIFICATION.md).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm verify
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
