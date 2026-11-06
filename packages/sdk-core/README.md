# @pulsepay/sdk-core

The core TypeScript SDK for PulsePay: unified onchain payments, merchant hubs, and multi-chain settlement.

## Features

- **Invoice Lifecycle**: Create, retrieve, cancel, and pay invoices on Whitechain.
- **Subscriptions & Billing**: Setup recurring subscription plans and execute renewals.
- **Universal Checkout**: Quote and route cross-token payments via Uniswap Trading API into USDT settlement.
- **Treasury Management**: Hook-level treasury rebalancing and liquidity management with Uniswap v4.

## Installation

```bash
npm install @pulsepay/sdk-core viem
# or
pnpm add @pulsepay/sdk-core viem
```

## Quick Start

```typescript
import { createPulsePay } from "@pulsepay/sdk-core";

const pulsepay = createPulsePay({
  whitechain: {
    rpcUrl: "https://rpc.testnet.whitechain.io",
    chainId: 1874,
    merchantHubAddress: "0x...",
    usdtAddress: "0x...",
  },
  uniswap: {
    routing: {
      apiKey: process.env.UNISWAP_API_KEY,
      chainId: 1301,
    },
  },
});

// Fetch invoice status
const invoice = await pulsepay.invoices.get("0x...");
console.log("Invoice status:", invoice.status);

// Universal checkout quote ("Pay With Any Token")
const quote = await pulsepay.checkout.quotePayWithToken({
  tokenInAddress: "0x...",
  tokenInSymbol: "WETH",
  tokenInDecimals: 18,
  tokenOutAddress: "0x...",
  targetUsdtAmountUnits: 10_000_000n, // 10 USDT
  payerAddress: "0x...",
});
```

## License

MIT
