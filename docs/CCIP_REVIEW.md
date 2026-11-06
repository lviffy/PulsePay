# CCIP integration review — 2026-11-07

## Implemented

The adapter requires live RPC fees, verifies source chain and destination lane, discovers the active on-ramp, checks the source token's registered pool, confirms pool destination support, and requires a nonzero destination-token mapping. Offline failures cannot produce a substitute fee. Selectors are bounded uint64 values; amounts are positive uint256 token units; transfer token and recipient must be nonzero addresses. Unknown source chains require an explicit router.

The Hedera router is 0x802C5F84eAD128Ff36fD6a3f8a418e339f467Ce4. Fee-token approvals are returned separately, or combined with the transfer allowance when the same token pays both. The demo requires a source-chain token setting instead of borrowing Whitechain's settlement token address. JSON amount/selector serialization is corrected. Wallets estimate source gas after approval; the adapter no longer presents a fixed source gas estimate as a live estimate.

`CCIPMessageMonitor` and `bridgeOps.getStatus` / `waitForDelivery` provide live message monitoring, with pending indexing, destination success/failure, outages, cancellation and timeout. `/api/bridge/status?messageId=<bytes32>` exposes read-only status lookup to the web app. Sample transaction hashes have been removed from the demo results.

The merchant treasury API checks the live RPC/lane before reporting availability. Missing RPC and unavailable lanes return errors, rather than a static active flag. Lane availability does not imply token support or successful transfer.

Legacy exchange-specific requirements, feedback, example configuration and stale alternative lockfile have been removed. pnpm remains authoritative. The merchant wallet connects to Whitechain, and settlement explorer links point to Whitechain.

## Validation

Workspace lint, production build, web TypeScript checks, all unit/HTTP regressions and all 22 Solidity tests pass. CCIP tests cover fee failures, chain mismatch, selector bounds, invalid transfer addresses, pool registration and mapping failures, fee approvals, and delivery lifecycle monitoring.

The read-only message monitor was also exercised against a public testnet message from Chainlink’s API and returned its live in-flight status. This was a public diagnostic, not a transfer from the project wallet.

Dependency audit reports one low-severity `deepmerge` finding (GHSA-gcqx-w48m-w2h4) in Svelte build tooling, with no published patched version. No high-severity findings were reported.

Live public RPC confirms Sepolia → Hedera lane availability and the active Sepolia on-ramp. The previous review also checked Hedera → Sepolia router availability. These reads do not submit transactions or prove transfer delivery.

## Configuration and live acceptance

Set `CCIP_SOURCE_CHAIN_ID`, `CCIP_DESTINATION_CHAIN_ID`, and `CCIP_RPC_URL` (or `SEPOLIA_RPC_URL` for Sepolia). Set `CCIP_TOKEN_ADDRESS` for the demo to a token registered on the source and supported for the destination. Demo transfer examples remain Sepolia → Hedera. Do not substitute a token from another network or assume token decimals.

The read-only diagnostic is `node scripts/ccip-check.mjs <sourceChainId> <rpcUrl> <destinationChainId> [sourceToken recipient rawAmount]`. It checks the lane and, when all optional arguments are provided, pool support, destination mapping and live router fee. No wallet credentials are required.

A real token and recipient have not been supplied for live acceptance. A funded wallet must confirm balances, allowances, allowance-reset requirements, pool policies/rate limits and recipient token association where applicable. After wallet-authorized approvals and submission, capture the real message ID and monitor it to successful destination execution. No end-to-end token transfer has been signed or broadcast in this review.

Token-only bridging funds a destination wallet; invoice settlement remains a separate Whitechain merchant-contract payment. Neither source confirmation nor bridge delivery marks an invoice paid. This prevents an unverified cross-chain payment from being credited.

## Official references

- https://docs.chain.link/ccip/directory/testnet/chain/ethereum-testnet-sepolia
- https://docs.chain.link/ccip/directory/testnet/chain/hedera-testnet
- https://docs.chain.link/ccip/evm/api-reference/v2.0.0/onramp
- https://docs.chain.link/ccip/tools/llms.txt
