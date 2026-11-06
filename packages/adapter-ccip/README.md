# @pulsepay/adapter-ccip

Read-only CCIP route checks, live fee quotes, unsigned token transfer preparation, and message monitoring for PulsePay testnets.

Configure `chainId` and `rpcUrl` (or inject `publicClient`). The built-in router map covers Ethereum Sepolia, Hedera Testnet, and Arbitrum Sepolia. Another source requires an explicit router. The RPC must match the source chain.

- `checkLane(selector)` checks the RPC chain and router lane, returning the active on-ramp.
- `quoteBridgeFee(params)` checks the source token's registered pool, remote-chain support and destination token mapping before requesting the router fee. Amounts use raw bigint token units. Selectors use bigint in TypeScript and decimal strings in JSON.
- `buildBridgeTransactions(params)` returns unsigned `approvalTx`, optional `feeApprovalTx`, and send calldata/value. Confirm approvals before sending, estimate source gas in the wallet, and refresh fees immediately before submission. Tokens requiring allowance reset need a zero approval first when an existing allowance is nonzero. Pool rate limits, balances, recipient association, and execution-time policies can still reject a transfer.
- `CCIPMessageMonitor.getStatus(messageId)` looks up a real bytes32 ID using the public Chainlink API. `NOT_INDEXED` means pending indexer visibility, not success.
- `CCIPMessageMonitor.waitForDelivery(messageId, options)` polls until `SUCCESS` or `FAILED`; it supports cancellation, a timeout and a polling interval. Outages throw errors. The core SDK exposes both through `bridgeOps`.

Capture the actual message ID from the source receipt/on-ramp event or CCIP Explorer. An example hash is never delivery evidence. The web app exposes `GET /api/bridge/status?messageId=<bytes32>` for status lookup.

A bridge transfer funds a destination wallet. Whitechain invoices are paid only through the Whitechain merchant contract. A CCIP source receipt or destination delivery does not mark an invoice paid.

After building, run `node scripts/ccip-check.mjs <sourceChainId> <rpcUrl> <destinationChainId> [sourceToken recipient rawAmount]` from the repository root for read-only diagnostics. No wallet credentials are needed.
