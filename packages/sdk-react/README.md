# @pulsepay/sdk-react

React components and hooks for PulsePay onchain checkout, billing dashboards, and verifiable receipts.

## Installation

```bash
npm install @pulsepay/sdk-react @pulsepay/sdk-core viem react react-dom
# or
pnpm add @pulsepay/sdk-react @pulsepay/sdk-core viem react react-dom
```

## Quick Start

Wrap your application in `PulsePayProvider` and mount checkout modals or receipt components:

```tsx
import { PulsePayProvider, CheckoutWidget } from "@pulsepay/sdk-react";

export function App() {
  return (
    <PulsePayProvider
      config={{
        whitechain: {
          rpcUrl: "https://rpc.testnet.whitechain.io",
          chainId: 1874,
          merchantHubAddress: "0x...",
          usdtAddress: "0x...",
        },
      }}
    >
      <CheckoutWidget invoiceId="0x..." onPaid={(receipt) => console.log(receipt)} />
    </PulsePayProvider>
  );
}
```

## License

MIT
