# Whitechain Developer Feedback — ETHGlobal Mumbai 2026

**Project:** PulsePay  
**Target Track:** Whitechain — Operate · Stablecoin Payments for Business  
**Date:** November 2026  

---

## 1. Overall Experience

Building on **Whitechain Sepolia (`Chain ID 1874`)** provided an EVM-compatible experience with fast block times and low transaction costs, making it suitable for high-frequency business payments, subscriptions, and micro-refunds.

## 2. Developer Tooling & Integration

- **RPC & Network Reliability:**
  - The public RPC (`https://rpc.testnet.whitechain.io`) was responsive during contract deployments and event subscriptions via viem.
  - The rate limit (50 rps sustained / 500 burst) is reasonable for development.
- **Blockscout Explorer & API:**
  - The explorer (`https://explorer.testnet.whitechain.io`) and Blockscout v2 API (`/api/v2`) made verifying contracts seamless via Foundry's `--verifier blockscout`.
- **Official Stablecoin (USDT):**
  - Having an official designated testnet USDT (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`) allowed us to test real token allowance, transferFrom, and refund mechanisms without relying on arbitrary self-minted mocks.

## 3. Areas for Improvement & Suggestions

1. **Faucet Distribution:** Adding automated USDT faucet drips alongside native WBT drips on `faucet.testnet.whitechain.io` would streamline testing token transfers for new builders.
2. **EIP-2612 Permit Support:** Clarifying standard permit domain separator conventions for testnet tokens simplifies zero-gas authorization flows for recurring subscription billing.
3. **Indexer Webhooks:** A hosted Blockscout webhook service for contract event notifications would reduce the operational overhead for merchants monitoring invoice settlements.

