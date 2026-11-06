# Chainlink CCIP Token Bridging

PulsePay supports live lane checks, token-pool checks, router fee quotes, unsigned transfer preparation, and message monitoring. These operations are exposed by `@pulsepay/adapter-ccip` and `PulsePayClient.bridgeOps`.

## Configuration

Set `CCIP_SOURCE_CHAIN_ID` (default 11155111), `CCIP_DESTINATION_CHAIN_ID` (default 296), and `CCIP_RPC_URL` or `SEPOLIA_RPC_URL`. The demo requires `CCIP_TOKEN_ADDRESS` to identify the source-chain token. Verify its support for the destination lane in the official CCIP Directory. Whitechain USDT is not assumed to exist or be bridgeable on another chain.

The SDK uses bigint selectors and amounts. HTTP JSON uses decimal strings. Amounts are raw token units; inspect token decimals rather than assuming six decimals.

## Quote and prepare

`quoteBridgeFee` verifies the source RPC, lane, active on-ramp, source token pool, pool destination support and remote token mapping before quoting the native or ERC-20 fee. Missing configuration and RPC errors are reported; no substitute fee is generated.

`buildBridgeTransactions` returns unsigned transfer approval, optional fee-token approval, and router calldata/value. Confirm all approvals before submitting the router call through your wallet. If a token requires allowance reset, reset a nonzero allowance first. Re-quote close to submission and estimate source gas in the wallet. The quoted fee does not include source transaction gas.

## Monitor delivery

Use the real bytes32 message ID from the source receipt or CCIP Explorer with `bridgeOps.getStatus` or `bridgeOps.waitForDelivery`. The web app also offers `/api/bridge/status?messageId=<bytes32>`. A new message may be `NOT_INDEXED` before it appears. `PENDING` is not settlement. `FAILED` needs investigation. API outages remain visible errors. Polling has cancellation and timeout controls.

## Invoice settlement

Token-only delivery transfers funds to a destination wallet with no invoice callback. Whitechain invoice payment remains a separate merchant-contract operation, verified through its settlement event. Do not treat a bridge source receipt or delivery as a paid invoice.

See [Chainlink Directory](https://docs.chain.link/ccip/directory/testnet) for current networks and tokens and [CCIP Explorer](https://ccip.chain.link) for actual messages.
