## 01 / Overview

TreasuryGuardHook restricts the configured input currency and raw-unit amount for exact-input swaps, with an owner-controlled pause.

This page follows the implementation in `contracts/uniswap-v4/src/TreasuryGuardHook.sol`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm contracts:uniswap:build
pnpm contracts:uniswap:test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

Configure UNISWAP_TREASURY_HOOK_ADDRESS and UNISWAP_RPC_URL. Open /merchant/treasury to read the live policy. maxSwapAmount is expressed in limitCurrency base units, without assuming six or eighteen decimals. Exact-output trades and currencies other than the configured input are rejected.

The corrected constructor includes limitCurrency. Existing bytecode does not acquire this protection automatically; a new hook and pool configuration are required. Local frontend verification does not deploy contracts or change pool policy.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `TreasuryGuardHook` | beforeSwap policy and owner controls |
| `UniswapV4TreasuryAdapter.getHookPolicy` | Reads paused, maxSwapAmount, owner and limitCurrency |
| `UniswapV4TreasuryAdapter.setPaused` | Submits the owner pause transaction |

Source: [contracts/uniswap-v4/src/TreasuryGuardHook.sol](https://github.com/lviffy/ETHGLOBAL/blob/main/contracts/uniswap-v4/src/TreasuryGuardHook.sol).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm contracts:uniswap:build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
