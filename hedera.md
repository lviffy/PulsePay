# How PulsePay uses Hedera

**Hedera is PulsePay’s payment and audit rail for AI agents buying access to APIs.** An agent can discover a paid service, transfer native HBAR, prove that payment, and retrieve the protected response. The project also records agent activity using Hedera Consensus Service (HCS).

## The problem it solves

A software agent cannot always use a human checkout page or wait for someone to approve every small API purchase. PulsePay gives it a machine-readable payment challenge, spending rules, and a verifiable receipt.

For example, an agent requests a protected API resource. The server responds with HTTP 402 and the required HBAR payment. The agent checks its budget and merchant allowlist, pays, and retries with payment evidence. The server verifies that evidence before releasing the response.

## What Hedera does in the project

| Responsibility | Actual implementation |
| --- | --- |
| Agent payments | Native HBAR transfers through `X402PayTool` and the Hedera adapter. The supported native asset identifier is `0.0.0`. |
| Payment verification | The server checks the transaction’s consensus result, recipient, amount, network, and challenge binding using Hedera Mirror Node data. A claimed transaction ID alone is insufficient. |
| Spending controls | `PulsePaySpendLimitPolicy` checks the merchant allowlist, maximum payment, and daily transfer budget before submission. Transaction and audit fees have separate caps. |
| Audit trail | `PulsePayHcsAuditHook` submits agent activity to a configured HCS topic, retaining pending records for reconciliation and retry. |
| Recovery | The worker journals pending purchases and resumes unresolved transactions, reducing the risk of paying twice after an interrupted request. |
| Merchant visibility | `/merchant/agents` displays real topic messages and service discovery. Verified payment records and CSV are available through the separate payment API. |

## Payment flow

1. The buyer reads `/.well-known/x402.json` to discover the service, price, and endpoint.
2. It requests the protected resource and receives HTTP 402 with a payment requirement.
3. The worker checks the requirement against its trusted merchant, network, expiry, and spending policy.
4. The buyer signs and submits a native HBAR transfer, or prepares unsigned bytes for a wallet to authorize.
5. The buyer retries the request with the transaction evidence.
6. The server verifies the actual transaction and its binding to that challenge, then returns the saved resource response. Reusing the same valid proof retrieves the same response rather than creating another purchase.
7. The audit hook records the agent action in HCS. A failed audit submission can be retried without paying for the API resource again.

**Payment and audit submission are separate transactions.** An HCS message proves that a message reached consensus; its text does not independently prove that the payment it mentions is valid. Verify the original payment receipt separately.

## Where to find the code

- [Hedera adapter](../packages/adapter-hedera/src/index.ts): payment tools, policies, audit hooks, and mirror-node integration.
- [Buyer worker](../apps/agent-worker/src/index.ts): discovery, challenge handling, purchase execution, and recovery.
- [Payment verification middleware](../packages/sdk-server/src/x402.ts): challenge issuance and receipt verification.
- [Payment API](../apps/demo-store/src/index.ts): protected sample resources, discovery, verified payment records, and CSV.
- [Console read helpers](../apps/web/src/lib/chain.ts): HCS history reads used by the merchant console.

## What it does not do

- Hedera does not settle the Whitechain USDT invoices or hold their refund reserve.
- PulsePay does not currently bridge an HBAR payment into a Whitechain invoice.
- This implementation uses PulsePay’s `hedera-native-receipt` HTTP-402 extension. It does not claim compatibility with every standardized x402 facilitator.
- The protected API currently serves explicitly labelled sample content. The payment verification is real; the content is not a live market feed.

## Configuration and tested status

The relevant settings include `HEDERA_NETWORK`, buyer/operator accounts and keys, `HEDERA_MERCHANT_ACCOUNT_ID`, `HEDERA_AUDIT_TOPIC_ID`, transfer/fee limits, and persistent worker state. Never expose signing keys to the frontend. The buyer worker is started separately; opening the console does not make it spend.

In the current console test, the HCS topic and paid-service discovery rendered successfully, authenticated API reads returned real verified-payment records, and an unpaid protected request returned HTTP 402. **That test did not submit a new HBAR payment or HCS message.** Earlier signed Hedera evidence is recorded separately in [the historical verification log](VERIFICATION.md).

See [the console test report](CONSOLE_TESTING.md) for the latest test scope, and [the Hedera implementation guide](HEDERA.md) for setup and recovery details. Hedera’s official [Mirror Node topic documentation](https://docs.hedera.com/reference/rest-api/topics) describes the topic/message endpoints used for audit reads.