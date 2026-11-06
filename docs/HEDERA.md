# Hedera implementation and verification

The adapter uses the official `@hashgraph/hedera-agent-kit` 4.2 interfaces and `@hiero-ledger/sdk` 2.90. Payment and refund tools extend the real Agent Kit `BaseTool`. The SDK convenience call `tool.execute(params, context)` and the Agent Kit call `tool.execute(client, context, params)` both run the official seven-stage hook pipeline. The plugin binds its supplied context to both tools.

## Current local workflow

The configuration repair supersedes older local command and replay descriptions below. Use pnpm 12.14.0 and Node >=22.13. `pnpm verify` runs the full workspace, contract and dependency checks; the Hedera adapter now has 22 tests and its HTTP server has seven. Application `start` scripts load the root `.env` automatically. Merchant routes require the configured API secret or a signed login session.

Both processes use `PULSEPAY_STATE_DIRECTORY`; production requires an absolute persistent path. Ownership locks reject duplicate server/worker processes. After a crash, check the recorded host/PID before removing a stale lock directory. Responses are saved with redemption, so the same valid proof retrieves the same result on retry without another purchase. The buyer journals its transaction ID before submission and automatically resumes unresolved saved purchases. A different transaction or service cannot reuse the redemption.

Historical testnet evidence below was not re-executed during this repair. No further paid transactions were submitted.

## Supported flow

1. The buyer fetches the service manifest and receives a real HTTP 402 challenge.
2. The buyer validates network, native HBAR asset, recipient, expiry and its spending limits.
3. A native transfer binds the payment to a secret challenge through its hash in the public memo.
4. With an SDK operator key, the worker executes automatically. Without a key, it returns unsigned bytes with `AWAITING_WALLET`; it never claims settlement.
5. After consensus, the API checks the mirror-node transaction result, recipient, exact amount, payer debit, memo and consensus time. It persists redemption with the purchased response. The identical proof returns that response on retry; a conflicting proof is rejected with 409. A temporarily unavailable mirror returns 503 and instructs the buyer to retry the saved proof instead of paying again.
6. Confirmed payments appear at `/api/hedera/payments`, `/merchant`, `/receipt/hedera/<transactionId>` and in the accountant CSV.
7. The HCS hook saves a pending record before submission. Successful payment remains settled when HCS is unavailable; its separate audit result says `PENDING` with an error. `retryPending(context)` retries the saved record without resending the payment.
8. Refunds verify the original successful PulsePay payment, paying merchant, original buyer and remaining refundable amount. Durable reservations block concurrent or ambiguous duplicate refunds. A wallet-prepared refund is finalized through `IssueRefundTool.confirmRefund` after independent mirror verification.

Protocol scope: `hedera-native-receipt` is PulsePay's explicit native receipt extension to the existing HTTP-402 flow. It is **not** the standardized `@x402/hedera` facilitator's partially signed transaction protocol. A standards-compliant facilitator integration has not been implemented or verified; do not advertise interoperability with arbitrary x402 clients. HTS token settlement is not supported by this native-HBAR route.

## Local checks

From the repository root, `pnpm test:hedera` builds the workspace and runs the adapter and server suites. `pnpm verify` also covers the EVM SDK, quote adapter, merchant HTTP routes and both Solidity projects. All local submitters use mocks or return unsigned bytes; these test commands never broadcast payment transactions.

The older TypeScript entry points delegate to the maintained `.mjs` suite.

## Configuration

Copy `.env.example` and set the accounts and keys you control. No private key is required for wallet preparation. The operator/buyer key is required for automatic SDK execution; keep it outside version control.

```bash
node --env-file=.env apps/demo-store/dist/index.js
node --env-file=.env apps/agent-worker/dist/index.js
```

Use `PULSEPAY_APP_URL` to select the API. Default service price and per-payment policy cap are **1 tinybar**, not 0.5 HBAR. Native transfer fees default to a maximum of 0.01 HBAR per transaction; the worker's separate HCS maximum defaults to 0.02 HBAR. These are caps, not guaranteed estimates. They do not implement a global wallet fee budget.

After signing a wallet-prepared payment, rerun the buyer with `HEDERA_PAYMENT_TRANSACTION_ID` set to the confirmed transaction ID. The worker loads `.pulsepay/buyer-pending.json` and retries the original proof. Do not generate another payment when confirming the first one. Prepared payments continue to reserve daily budget across restarts.

Create a keyed audit topic using `createAuditTopic(context)` with the operator's public key, an SDK client or wallet submission callback, and an explicit fee cap. Estimate the fee before submission. The helper sets both admin and submit keys and a 30-day lifetime. A topic with these two keys was estimated at 0.44260627 HBAR during this session; topic creation can cost much more than a transfer.

The audit writer must control the topic's submit key. A merchant refund can use a separate audit writer via the hook's `client` or `submitTransaction` and `operatorAccountId` configuration.

## Storage and deployment limits

State is saved with atomic file replacement under `.pulsepay/` (ignored by git), with private directory/file permissions. Preserve this directory across worker/server restarts: it contains payment challenges and redemptions, budget reservations, cumulative refunds and pending audits. The file store supports one server/worker owner per state file. Multiple processes or replicas require a transactional database/shared locking before deployment. Do not delete refund or redemption state to retry a payment.

An ambiguous network error retains the reservation rather than risking double payment/refund. Check the original transaction on the mirror node before reconciling or retrying. HCS retries include a stable event ID in local state; consumers should deduplicate the tool/payment transaction pair if an acknowledgment is lost. Do not treat every message on a public topic as a trusted PulsePay event.

## Live test evidence

- Native transfer: `0.0.11327364@1793911165.521929932` — confirmed 1 tinybar to `0.0.11329845`.
- Corrected challenge-bound purchase: `0.0.11327364@1793912134.008842902` — confirmed 1 tinybar, fee 0.00147534 HBAR. The real API returned the protected data only after checking the receipt. Subsequent proof reuse returned 409; `not-a-payment` returned 400. The verified ledger and public receipt were checked over HTTP.
- Initial keyed-topic attempt: `0.0.11327364@1793912206.166235981` — `INSUFFICIENT_TX_FEE`, charged 0.00147534 HBAR, no topic created. The free estimator then identified the two key charges. Subsequent topic submissions require wallet approval; an expired unsigned request does not establish topic creation.
- Ledger reconciliation subsequently confirmed **three** successful topic creations despite the signing-status tool's expired responses: `0.0.11330043`, `0.0.11330098` and `0.0.11330136`. Each cost 0.43909078 HBAR. The first is now saved as the configured topic. Both its admin and submit keys match the connected HashPack public key; a read-only message query returned no messages.
- Confirmed total test fees are **1.32169836 HBAR**, exceeding the approved 0.6 HBAR cap. Paid testing was stopped. The earlier signing-status reports were not reliable evidence of non-execution. Topic creation now persists its transaction ID before submission, requires ledger reconciliation before retries, and reuses confirmed topics. Two regression tests cover this protection.
- The user chose to keep a single HashPack account. Real same-account payments/refunds net to zero and are rejected before submission. Refund rules and HCS retry are verified locally; live message submission and a merchant-signed refund remain unverified. No additional fee-bearing action is authorized under the exhausted cap.

The test-only `test/live.mjs` script prepares unsigned topic/refund/audit transactions and makes read-only HTTP/mirror queries. It never signs or broadcasts. Keep its account defaults aligned with the connected wallet before using it.

References: [official Agent Kit plugin lifecycle](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/PLUGINS.md), [Hedera topic keys and lifetime limits](https://docs.hedera.com/native/consensus/create-topic).

## Completed single-account HCS test

After the user explicitly authorized one additional audit message capped at 0.02 HBAR, transaction `0.0.11327364-1793913820-064120602` succeeded with fee **0.00393132 HBAR**. The MCP independently returned HCS message sequence **1** on `0.0.11330043`, consensus timestamp `1793913869.646957104`, with event `AGENT_PAYMENT_SETTLED` and original payment `0.0.11327364@1793912134.008842902`.

The project's `retryPending` reconciled both the successful transaction and the exact on-chain payload, then removed the pending record without another submission. Audit submissions now journal their transaction IDs; a lost acknowledgment triggers ledger reconciliation, never a blind paid retry. A regression test covers this case.

Final confirmed test fees total **1.32562968 HBAR**. The last reported account balance was **108.6743703 HBAR**. This includes the earlier duplicate-topic overrun and the separately authorized audit message. No further paid test was submitted. The suite has **20 adapter + 6 API tests**. Same-account payments/refunds are rejected because the net transfer is zero; a real merchant refund remains unverified without a distinct merchant signer.
