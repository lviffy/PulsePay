# Chainlink CCIP Token Bridging & Whitechain Bridge

PulsePay supports live lane checks, token-pool checks, router fee quotes, unsigned transfer preparation, message monitoring, and Whitechain USDT cross-chain bridging to Ethereum Sepolia. These operations are exposed by `@pulsepay/adapter-ccip`, `@pulsepay/adapter-whitechain`, and `PulsePayClient.bridgeOps`.

## Whitechain USDT to Ethereum Sepolia Bridge

PulsePay integrates **Whitechain USDT** (`0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7` on Whitechain Sepolia, Chain ID `1874`) to **Ethereum Sepolia** (Chain ID `11155111`, CCIP Chain Selector `16015286601757825753`) using the canonical dual-contract architecture adapted from [`whitechain-labs/bridge-contracts`](https://github.com/whitechain-labs/bridge-contracts):

1. **`WhitechainBridgeMapper`**:
   - Manages token registry mappings between Whitechain and destination chains (`16015286601757825753`).
   - Configures `LOCK_RELEASE` / `BURN_MINT` transfer types, min/max transfer bounds (10 USDT to 5,000 USDT), and daily rolling volume limits (20,000 USDT).
   - Authorizes trusted bridge contracts to record and debit volume allowances.

2. **`WhitechainCCIPBridge`**:
   - User deposit entrypoint `bridgeTokens(token, amount, destChainSelector, recipient, nonce, signature)`.
   - Pulls user tokens via `SafeERC20.safeTransferFrom` into escrow/custody.
   - Enforces cryptographic backend/validator signature verification (EIP-712 / ECDSA) and anti-replay protection (`usedHashes[depositId] = true`).
   - Emits canonical `Deposit` event containing `depositId`, `token`, `sender`, `recipient`, `amount`, and `destChainSelector`.

### SDK Usage

Bridge Whitechain USDT directly with `@pulsepay/sdk-core` or `@pulsepay/adapter-ccip`:

```typescript
import { buildWhitechainBridgeDeposit, WHITECHAIN_USDT_ADDRESS } from "@pulsepay/adapter-ccip";
import { parseUnits } from "viem";

const payload = await buildWhitechainBridgeDeposit({
  tokenAddress: WHITECHAIN_USDT_ADDRESS,
  amountUnits: parseUnits("100", 6), // 100 USDT
  recipientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  senderAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  nonce: 0n,
  signerPrivateKey: process.env.BRIDGE_SIGNER_KEY, // optional backend voucher
});

// 1. Submit approval transaction: payload.approvalTx
// 2. Submit bridge transaction: payload.bridgeTx
```

Or using `PulsePayClient`:

```typescript
const deposit = await client.bridge.bridgeWhitechainUsdtToSepolia({
  amountUnits: parseUnits("100", 6),
  recipientAddress: "0xRecipient...",
  senderAddress: "0xSender...",
});
```

### Runnable CLI Script

Run the end-to-end testnet bridging script:

```bash
node scripts/bridge-whitechain-to-sepolia.mjs 100 0xRecipient... 0xSender...
```

---

## Configuration

Set `CCIP_SOURCE_CHAIN_ID` (default 11155111), `CCIP_DESTINATION_CHAIN_ID` (default 296), and `CCIP_RPC_URL` or `SEPOLIA_RPC_URL`. The demo requires `CCIP_TOKEN_ADDRESS` to identify the source-chain token. Verify its support for the destination lane in the official CCIP Directory.

The SDK uses bigint selectors and amounts. HTTP JSON uses decimal strings. Amounts are raw token units; inspect token decimals rather than assuming six decimals.

## Quote and prepare

`quoteBridgeFee` verifies the source RPC, lane, active on-ramp, source token pool, pool destination support and remote token mapping before quoting the native or ERC-20 fee. Missing configuration and RPC errors are reported; no substitute fee is generated.

`buildBridgeTransactions` returns unsigned transfer approval, optional fee-token approval, and router calldata/value. Confirm all approvals before submitting the router call through your wallet. If a token requires allowance reset, reset a nonzero allowance first. Re-quote close to submission and estimate source gas in the wallet. The quoted fee does not include source transaction gas.

## Monitor delivery

Use the real bytes32 message ID from the source receipt or CCIP Explorer with `bridgeOps.getStatus` or `bridgeOps.waitForDelivery`. The web app also offers `/api/bridge/status?messageId=<bytes32>`. A new message may be `NOT_INDEXED` before it appears. `PENDING` is not settlement. `FAILED` needs investigation. API outages remain visible errors. Polling has cancellation and timeout controls.

## Invoice settlement

Token-only delivery transfers funds to a destination wallet with no invoice callback. Whitechain invoice payment remains a separate merchant-contract operation, verified through its settlement event. Do not treat a bridge source receipt or delivery as a paid invoice.

See [Chainlink Directory](https://docs.chain.link/ccip/directory/testnet) for current networks and tokens and [CCIP Explorer](https://ccip.chain.link) for actual messages.
