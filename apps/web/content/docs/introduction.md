## 01 / Overview

PulsePay brings merchant billing, treasury controls and native agent payments into one TypeScript workspace. Each chain has an explicit job and its own verification path.

This page follows the implementation in `README.md`. The source explorer on the landing page exposes the workspace files used by the site.

## 02 / Quickstart

Install the core SDK and adapters directly from npm:

```bash
npm install @pulsepay/sdk-core viem
# or for React checkout:
npm install @pulsepay/sdk-react @pulsepay/sdk-core viem
```

Or build and run the full monorepo workspace locally:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
```

Node 22.13 or newer · pnpm 12.14.0. Configure only the networks you will use.

## 03 / Packages

All packages are published under the `@pulsepay` scope on the npm registry:

| Package | npm registry | Responsibility |
| --- | --- | --- |
| `@pulsepay/sdk-core` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/sdk-core) | Unified SDK entry point, CCIP bridging, invoice/subscription lifecycle |
| `@pulsepay/sdk-react` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/sdk-react) | Drop-in React checkout widget & billing components |
| `@pulsepay/sdk-server` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/sdk-server) | Server middleware, x402 resource server gateway, and webhooks |
| `@pulsepay/adapter-whitechain` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/adapter-whitechain) | Whitechain EVM client & contract ABI bindings |
| `@pulsepay/adapter-ccip` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/adapter-ccip) | Chainlink CCIP 2.0 cross-chain token bridging |
| `@pulsepay/adapter-hedera` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/adapter-hedera) | Hedera Agent Kit v4 spend policy & HCS audit hook |
| `@pulsepay/shared` | [npm v1.1.0](https://www.npmjs.com/package/@pulsepay/shared) | Shared schemas, Zod types, and accountant CSV utilities |

## 04 / Walkthrough

Whitechain records invoices and USDT settlement. Chainlink CCIP 2.0 provides cross-chain token bridging across testnets. Hedera handles native HBAR HTTP-402 receipts and HCS audit messages.

Read README.md before configuring a deployment. Start with direct USDT checkout or the native HBAR flow, then add cross-chain token bridging as needed.

## 05 / Anatomy

| Class or file | Responsibility |
| --- | --- |
| `PulsePayClient` | Unified SDK entry point; whitechain and CCIP bridge adapters |

Source: [README.md](https://github.com/lviffy/ETHGLOBAL/blob/main/README.md).

## 06 / Verification

Build the owning package before running the app. Confirm the requested network and address in `/merchant/settings`. Compare the UI against the contract read or mirror response, and use the public explorer transaction as independent evidence. A wallet signature or an unsigned transaction is not evidence of settlement.

```bash
pnpm build
```

For a failed read, use Retry and inspect the error attached to the real record. Test with reduced motion enabled and keyboard-only navigation. Do not submit paid network actions merely to verify rendering.

## 07 / Troubleshooting

| Symptom | Check | Next action |
| --- | --- | --- |
| Configuration unavailable | Root `.env` and the configured deployment | Set the required public address, restart the web server, then retry. |
| Chain or service read failed | RPC, mirror or paid API response | Retry the read; retain transaction evidence for an ambiguous write. |
| Wallet cannot execute | Authorized account, chain and balance | Connect the intended account and review the transaction in the wallet. |
| Data differs from an older screenshot | Current source and onchain state | Use the real record. Historical and preview values are not accounting evidence. |
