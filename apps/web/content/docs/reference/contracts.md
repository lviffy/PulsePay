## 01 / Overview

The repository contains merchant billing and treasury contracts. Deployment addresses are environment configuration, not constants invented by the website.

This page follows the implementation in `contracts/whitechain/src/PulsePayMerchantHub.sol`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

```bash
pnpm contracts:whitechain:test
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Walkthrough

Whitechain Sepolia uses chain 1874 and RPC https://rpc.testnet.whitechain.io. The SDK’s USDT address is 0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7. Chainlink CCIP 2.0 token bridging uses official CCIP Routers on Ethereum Sepolia and Hedera Testnet.

Hedera integration is TypeScript and native HBAR; no custom Hedera Solidity contract is required. Treat the chain constants as testnet configuration and verify your deployment before sending transactions.

## 04 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayMerchantHub` | Whitechain invoice, refund and subscription ledger |

Source: [contracts/whitechain/src/PulsePayMerchantHub.sol](https://github.com/lviffy/ETHGLOBAL/blob/main/contracts/whitechain/src/PulsePayMerchantHub.sol).

## 05 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm contracts:whitechain:test
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 06 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
