# How PulsePay uses Chainlink

**Chainlink CCIP is PulsePay’s cross-chain token-transfer rail.** It lets applications check a supported route, quote the bridge fee, prepare wallet-authorized transfers, and track delivery to a recipient on another network. The integration uses CCIP’s token-only transfer model.

## The problem it solves

A customer or merchant may hold tokens on a different network from the wallet they need to fund. A source-chain transaction alone cannot tell an application whether those tokens reached the destination. PulsePay combines route and token checks with fee quoting and delivery monitoring so applications can handle that process explicitly.

For example, an application prepares a transfer from Ethereum Sepolia to Hedera Testnet. It checks that the source token has a pool supporting that destination, requests the current router fee, and returns approval and send transactions for the wallet to sign. After submission, the application tracks the actual CCIP message ID until destination execution succeeds or fails.

## What Chainlink does in the project

| Responsibility | Actual implementation |
| --- | --- |
| Route validation | `CCIPBridgeAdapter.checkLane` checks the RPC’s source chain, router support for the destination selector, and the active on-ramp. |
| Token validation | Before quoting, the adapter checks the source token’s registered pool, the pool’s destination support, and a nonzero destination-token mapping. Lane availability alone does not establish token support. |
| Fee quotes | `quoteBridgeFee` calls the source router’s `getFee` using the actual transfer message. Missing RPC configuration or failed reads return errors. |
| Transfer preparation | `buildBridgeTransactions` returns unsigned token approval and `ccipSend` payloads. Native fees are the default; an ERC-20 fee token can require a separate approval or a combined allowance when it is also the transferred token. |
| Direct token delivery | Messages use an ABI-encoded recipient address, empty `data`, and CCIP 2.0 GenericExtraArgsV3 with `gasLimit = 0` and full finality. PulsePay does not request a destination contract callback. |
| Delivery monitoring | `CCIPMessageMonitor` queries Chainlink’s public message API. The core SDK exposes status lookup and polling with cancellation and timeout controls. |
| Merchant visibility | `/merchant/treasury` displays live lane configuration through `/api/treasury` and links to CCIP Explorer. It does not submit bridge transactions. |

## Token-transfer flow

1. The application configures the source chain and matching RPC, then chooses the destination, source token, recipient, and amount in raw token units.
2. The adapter resolves the destination’s CCIP selector, validates the lane and token-pool mapping, and requests a live router fee.
3. The application builds unsigned transactions and asks the wallet to confirm the required approvals. Some tokens require resetting an existing allowance to zero first.
4. Before sending, the application refreshes the fee and the wallet estimates source transaction gas. The wallet signs and submits the router’s `ccipSend` transaction.
5. The application obtains the real bytes32 message ID from the source receipt/on-ramp event or CCIP Explorer.
6. `bridgeOps.getStatus` or `bridgeOps.waitForDelivery` tracks destination execution. `NOT_INDEXED` means the indexer has not found the message yet; pending states are not delivery confirmation. Polling returns on `SUCCESS` or `FAILED`, and service errors remain visible.

**Source confirmation and destination delivery are separate milestones.** A successful source transaction is not proof that the recipient has received tokens. Likewise, `gasLimit = 0` describes the destination callback budget; the source transaction still consumes gas and the router still charges a transfer fee.

## Networks and tokens

The adapter’s built-in router and selector maps cover **Ethereum Sepolia** (chain `11155111`), **Arbitrum Sepolia** (`421614`), and **Hedera Testnet** (`296`). The default source is Ethereum Sepolia; the demo’s default destination is Hedera Testnet. Other source chains require an explicit router, and destinations outside the built-in map require an explicit selector. Actual lane and token support must be checked before preparing a transfer.

CCIP selectors are different from EVM chain IDs. For example, the repo maps Hedera Testnet to selector `222782988166878823`, matching the official [Hedera Testnet directory](https://docs.chain.link/ccip/directory/testnet/chain/hedera-testnet). The official [Ethereum Sepolia directory](https://docs.chain.link/ccip/directory/testnet/chain/ethereum-testnet-sepolia) lists its router and selector. Use the [CCIP testnet directory](https://docs.chain.link/ccip/directory/testnet) to confirm current network and token support.

The transfer token must exist on the source chain and be supported for the selected destination. Whitechain’s USDT settlement address is not automatically a valid bridge token on Sepolia or Hedera. Amounts use the selected token’s actual decimals.

Whitechain-to-Sepolia bridging is disabled. Whitechain is not configured as a direct CCIP source, the repository's recorded bridge and mapper addresses are not deployed, and no destination settlement relayer is implemented. `scripts/bridge-whitechain-to-sepolia.mjs` is therefore a read-only deployment diagnostic that exits with an error.

## Where to find the code

- [CCIP adapter on npm](https://www.npmjs.com/package/@pulsepay/adapter-ccip) (`npm install @pulsepay/adapter-ccip viem`)
- [Core SDK on npm](https://www.npmjs.com/package/@pulsepay/sdk-core) (`npm install @pulsepay/sdk-core viem`)
- [CCIP bridge adapter](../packages/adapter-ccip/src/bridge.ts): lane and pool checks, fee quotes, message encoding, and unsigned transaction preparation.
- [Network constants and ABIs](../packages/adapter-ccip/src/constants.ts): built-in routers, selectors, and contract interfaces.
- [Message monitor](../packages/adapter-ccip/src/monitor.ts): status lookup, polling, cancellation, and timeout handling.
- [Unified SDK](../packages/sdk-core/src/index.ts): `PulsePayClient.bridgeOps` interfaces used by applications.
- [Treasury API](../apps/web/src/routes/api/treasury/+server.ts) and [merchant console](../apps/web/src/lib/components/MerchantDashboard.svelte): live lane reads and merchant visibility.
- [Bridge status API](../apps/web/src/routes/api/bridge/status/+server.ts): read-only message lookup using `?messageId=<bytes32>`.
- [Read-only diagnostic](../scripts/ccip-check.mjs) and [SDK demo](../apps/sdk-demo/src/cli.ts): route checks and transfer preparation examples.

## Boundaries and tested status

CCIP transfers fund a destination wallet. They do not pay a Whitechain invoice, update its status, replenish its refund reserve, or execute a subscription renewal. Those actions require separate transactions through the Whitechain merchant hub. Hedera’s native HBAR HTTP-402 payments and HCS audit messages are also separate from this bridge integration. The Chainlink implementation here uses CCIP rather than Data Feeds, VRF, or Automation.

The [integration review dated 2026-11-07](CCIP_REVIEW.md) records passing adapter and monitoring regressions, live Sepolia → Hedera lane/on-ramp reads, and a read-only status lookup for a public testnet message. **No end-to-end token transfer was signed or broadcast in that review.** The public message was diagnostic evidence, not a transfer from the project wallet. Successful lane reads do not establish token delivery.

Set `CCIP_SOURCE_CHAIN_ID`, `CCIP_DESTINATION_CHAIN_ID`, and `CCIP_RPC_URL` (or `SEPOLIA_RPC_URL`). The SDK requires `ccip.chainId` and `ccip.rpcUrl`, or an injected public client; the demo additionally requires `CCIP_TOKEN_ADDRESS`. After building the adapter, `node scripts/ccip-check.mjs <sourceChainId> <rpcUrl> <destinationChainId> [sourceToken recipient rawAmount]` checks the lane and optionally the token mapping and fee without signing a transaction.

A complete live acceptance run still needs a supported token, recipient, and funded wallet. Confirm balances, allowances, pool policies/rate limits, and recipient token association where applicable, then capture the real message ID and successful destination execution. See [the adapter guide](../packages/adapter-ccip/README.md) and [the integration review](CCIP_REVIEW.md) for configuration and verification details.
