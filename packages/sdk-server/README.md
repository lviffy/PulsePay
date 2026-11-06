# @pulsepay/sdk-server

Server middleware, x402 resource server gateway, and webhook handlers for PulsePay.

## Installation

```bash
npm install @pulsepay/sdk-server @pulsepay/shared
# or
pnpm add @pulsepay/sdk-server @pulsepay/shared
```

## Features

- **x402 Payment Challenges**: Protect API endpoints with HTTP 402 Payment Required challenges.
- **Hedera EVM Invoices**: Bind cryptographic invoice hashes and verify onchain settlement receipts.
- **Webhook Verifier**: Verify incoming payment notifications from PulsePay nodes.

## Quick Start

```typescript
import { createX402Middleware } from "@pulsepay/sdk-server";

const x402 = createX402Middleware({
  merchantAddress: "0x...",
  serviceId: "agent-invoice-pro",
  priceUnits: 1_000_000n,
});

// Protect Express/Node HTTP route
app.get("/api/premium", x402, (req, res) => {
  res.json({ secretData: "Protected agentic content" });
});
```

## License

MIT
