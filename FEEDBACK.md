# Uniswap Developer Feedback — ETHGlobal Mumbai 2026

**Project:** PulsePay  
**Track:** Uniswap Foundation — Build with Uniswap  
**Date:** November 2026  
**Repository:** Public GitHub Repository  
**Contract Pointers:**
- Hook Contract: [`contracts/uniswap-v4/src/TreasuryGuardHook.sol`](contracts/uniswap-v4/src/TreasuryGuardHook.sol)
- Address Mining Script: [`contracts/uniswap-v4/script/DeployHook.s.sol`](contracts/uniswap-v4/script/DeployHook.s.sol)
- Hook Tests: [`contracts/uniswap-v4/test/TreasuryGuardHook.t.sol`](contracts/uniswap-v4/test/TreasuryGuardHook.t.sol)

---

## 1. Developer Experience with Uniswap v4 & Hook Development

Developing `TreasuryGuardHook.sol` demonstrated the flexibility of Uniswap v4's callback architecture. Using `beforeSwap` to enforce enterprise treasury risk controls (maximum single swap input size and emergency circuit-breaker pause) and `afterSwap` for emitting normalized audit events proved to be a clean pattern for institutional treasury management.

### What Worked Well:
- **`BaseHook` Abstraction:** The base contract provided clear override signatures for all 14 lifecycle hooks.
- **HookMiner Pattern:** Mining salt offsets to match specific hook permission bitmasks works deterministically across Foundry scripts.
- **Trading API & Universal Router:** Integrating swap routing for our **Universal Checkout ("Pay With Any Token")** flow allowed buyers holding WETH or USDC to settle merchant invoices in exact USDT seamlessly.

## 2. Friction Points & Technical Suggestions

1. **Hook Address Mining Overhead:** Finding valid salts with `HookMiner` in Solidity scripts can be CPU-intensive during local tests. A native CLI or Rust-accelerated `forge mine-hook` utility built directly into Foundry would improve iteration speed.
2. **Dynamic Fee Clarity:** The exact conventions around fee overrides and return delta accounting in v4 are powerful but require extensive caution to avoid no-op or reentrancy vectors. Providing more standardized templates for dynamic policy hooks would accelerate adoption.
3. **Multi-Chain Testnet Faucets & Routing:** Having automated testnet liquidity for native testnet pools on Unichain Sepolia enabled smooth testing, but standard testnet token list registries with predictable mock liquidity pools would streamline integration testing for hackathons.

