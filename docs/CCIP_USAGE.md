# How PulsePay uses Chainlink CCIP 2.0

PulsePay uses **Chainlink CCIP 2.0** for cross-chain token bridging between supported EVM networks (Ethereum Sepolia, Arbitrum Sepolia) and Hedera Testnet.

## The Token-Only Architecture

PulsePay simplifies cross-chain transfers by utilizing CCIP's native **Token-Only Transfer** model:
- **Zero Callback Overhead**: `data = ""` and `gasLimit = 0` eliminate arbitrary code execution risk and callback gas costs on the destination.
- **Direct Wallet Delivery**: Tokens bridge directly to the recipient wallet address (`abi.encode(recipient)`).
- **Native Gas Payments**: CCIP fees are quoted and paid directly in native gas (`feeToken = address(0)`).

## Usage via the SDK

```typescript
import { createPulsePay } from "@pulsepay/sdk-core";

const pulsepay = createPulsePay({
  whitechain: { contractAddress: "0x..." },
  ccip: { chainId: 11155111 },
});

// 1. Quote bridging fee from CCIP Router
const quote = await pulsepay.bridgeOps.quoteFee({
  destinationChainId: 296, // Hedera testnet (CCIP selector: 222782988166878823)
  tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  amountUnits: 10_000_000n, // 10 units
  recipientAddress: "0xRecipient...",
});

// 2. Build unsigned approve and ccipSend transactions
const txs = await pulsepay.bridgeOps.buildTransactions({
  destinationChainId: 296,
  tokenAddress: "0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7",
  amountUnits: 10_000_000n,
  recipientAddress: "0xRecipient...",
});

// 3. Track execution status on CCIP Explorer
const explorerUrl = pulsepay.bridgeOps.getExplorerUrl(messageId);
```

