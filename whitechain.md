# How PulsePay uses Whitechain

**Whitechain is PulsePay’s USDT billing and merchant-settlement rail.** It stores invoices, accepts customer payments, tracks merchant balances, processes refunds, and runs recurring subscription billing through the `PulsePayMerchantHub` smart contract.

## The problem it solves

A business needs more than a token transfer: it needs to know which invoice was paid, the exact amount, who paid, whether a refund is still possible, and which subscription cycle was charged. PulsePay puts those rules and records in a contract so the UI and SDK can read the same state.

For example, a merchant creates a 10 USDT invoice. The customer pays it through the checkout. The contract records the settlement, allocates a configured part to the refund reserve, and makes the remainder available to the merchant. A later refund goes back to the original payer and updates the recorded refund total.

## What Whitechain does in the project

| Responsibility | Actual implementation |
| --- | --- |ll
| Invoices | Creates unique bytes32 invoice IDs with merchant, optional customer, amount, due time, and status. Open invoices can be cancelled. |
| USDT checkout | Reads the actual invoice, checks network/token configuration, approves its amount when necessary, and submits payment. The SDK verifies a matching `PaymentSettled` event before reporting success. |
| Merchant balances | Tracks refund reserve and available proceeds per merchant. The reserve percentage is read from the contract and may vary by merchant. |
| Refunds | Supports partial and full refunds, limited by the remaining paid amount and the merchant’s combined held liquidity. Funds go to the original payer. |
| Subscriptions | Stores plans, subscriber authorization, cycle amounts, due times, cycle limits, and cancellation state. |
| Receipts and exports | Supplies contract state and event evidence for receipt pages, payment/refund tables, and accounting CSV. |

## Invoice and payment flow

1. The merchant connects a wallet in `/merchant/settings` and creates an invoice in `/merchant/invoices`.
2. The customer opens `/pricing-free?invoice=<invoice-id>`. The checkout reads the invoice’s amount, status, and due time from the deployed hub.
3. The wallet switches to Whitechain Sepolia. If needed, the customer first approves the hub to spend the invoice’s USDT amount.
4. The contract accepts payment, records `PaymentSettled`, and divides the funds between reserve and available balance.
5. `/merchant/payments` and `/receipt/<invoice-id>` display the resulting state and transaction evidence.
6. The merchant can withdraw available proceeds or issue a partial/full refund through the console.

**Refunds consume reserve first, then available balance.** They are not restricted to the reserve percentage alone. The contract rejects excess refunds and insufficient combined liquidity.

For the deployment tested on 2026-11-06, the merchant reserve policy was **2000 basis points (20%)**. This is an observed configuration, not a fixed percentage for every deployment. The console’s reserve bar shows the current held-balance split, which can differ from the policy after deposits, refunds, and withdrawals.

## Subscription flow

The merchant creates a plan, then a subscriber authorizes it and pays the first cycle. A later renewal must satisfy the contract’s due-time, allowance, active-state, and cycle-limit checks. The merchant or subscriber can cancel future charges.

The console currently supports creating plans, charging renewals, and cancellation. Subscriber enrollment is available through the SDK/contract rather than a dedicated console screen. Creating a plan alone does not create a subscription, and billing does not execute merely because the page is open; a transaction must trigger a due renewal.

## Network and token

The current integration targets **Whitechain Sepolia**, chain **1874** (`0x752`), with RPC `https://rpc.testnet.whitechain.io` and explorer `https://explorer.testnet.whitechain.io`. WBT pays network gas; USDT is the settlement asset. See Whitechain’s official [Sepolia setup guide](https://whitechain.io/blog/start-building-on-whitechain).

The repo’s default USDT address is `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, with six decimals. The configured token must match the hub’s `USDT()` getter. Hub and merchant addresses are deployment configuration, not universal constants.

## Where to find the code

- [Merchant hub contract](../contracts/whitechain/src/PulsePayMerchantHub.sol): invoice, balance, refund, and subscription rules.
- [Whitechain SDK adapter](../packages/adapter-whitechain/src/client.ts): contract reads, wallet transactions, settlement evidence, and transaction encoders.
- [Unified SDK](../packages/sdk-core/src/index.ts): invoice, payment, and subscription interfaces used by applications.
- [Merchant console](../apps/web/src/lib/components/MerchantDashboard.svelte): wallet-backed billing actions.
- [Checkout](../apps/web/src/routes/pricing-free/+page.svelte) and [receipt page](../apps/web/src/routes/receipt/[id]/+page.svelte): customer-facing payment and evidence views.
- [Console read helpers](../apps/web/src/lib/chain.ts): event-window reads and accounting activity.

## Boundaries and tested status


The live console test created and paid a 0.01 USDT invoice, verified its receipt, funded reserve, issued partial and full refunds, withdrew available proceeds, cancelled another invoice, created a plan, charged a due renewal, and cancelled the test subscriptions. Those were real testnet transactions, with a small server-side test-wallet bridge driving the actual UI. The private key stayed outside the browser.

See [the console test report](CONSOLE_TESTING.md) for transaction hashes, screenshots, setup performed through the SDK, and limitations. CSV exports cover the selected event window rather than automatically including the entire contract history.