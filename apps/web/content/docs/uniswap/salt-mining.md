## 01 / Overview

Uniswap v4 encodes hook permissions in the deployment address. The deployment script mines a deterministic CREATE2 salt for the required flags.

This page follows the implementation in `contracts/uniswap-v4/script/DeployHook.s.sol`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm contracts:uniswap:build
pnpm contracts:uniswap:test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use. Foundry is required for contract tests. Read-only browsing does not require signing keys.

## 03 / Walkthrough

Set DEPLOYER_ADDRESS, TREASURY_INPUT_TOKEN and TREASURY_MAX_INPUT_UNITS before preparing a deployment. The input token must be an existing ERC-20 on Unichain Sepolia, chain 1301. The script validates network and token configuration before deploying the hook with the mined salt.

Building and testing the script is read-only. Broadcasting a deployment costs network fees and is a separate wallet action. Never copy a sample token address or decimal assumption into treasury policy.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `TreasuryGuardHook` | Hook permission flags |
| `DeployHook` | Deterministic hook deployment script |

Source: [contracts/uniswap-v4/script/DeployHook.s.sol](https://github.com/lviffy/ETHGLOBAL/blob/main/contracts/uniswap-v4/script/DeployHook.s.sol).

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
