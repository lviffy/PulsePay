# @pulsepay/sdk-core

PulsePay TypeScript SDK for Whitechain invoices, subscriptions, reserves, and Chainlink CCIP token bridging.

Install with `pnpm add @pulsepay/sdk-core viem`.

Configure `whitechain.contractAddress` and `whitechain.rpcUrl` for merchant operations.
Configure `ccip.chainId` and `ccip.rpcUrl` for bridging. `bridgeOps.quoteFee` requires a live RPC on the source chain and a supported destination lane. `bridgeOps.buildTransactions` returns unsigned approval and send calldata. Confirm all returned approvals before sending. Token support is specific to the source token and destination lane; Whitechain settlement tokens are not automatically bridgeable.

See [CCIP review](../../docs/CCIP_REVIEW.md) for verification limits.
