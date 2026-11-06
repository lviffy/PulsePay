# PulsePay verification — 2026-11-06

> Historical verification log. For current configuration, simulation removals, read-only test results, and manual transaction steps, use [the current testing guide](TESTING.md). Earlier transaction claims below were not re-executed during this check.

## Final single-account HCS result

The user explicitly authorized one further audit message with a maximum fee of 0.02 HBAR. Transaction `0.0.11327364-1793913820-064120602` settled successfully on topic `0.0.11330043`, charging **393,132 tinybars (0.00393132 HBAR)**. The ledger independently confirmed `CONSENSUSSUBMITMESSAGE`, and the topic query returned sequence **1**, consensus timestamp `1793913869.646957104`. Its payload is `AGENT_PAYMENT_SETTLED`, references payment `0.0.11327364@1793912134.008842902`, and records the correct merchant and 1-tinybar amount.

The project's audit retry/reconciliation path verified the exact on-chain payload and acknowledged the saved record without another paid submission. Audit attempts now journal their transaction ID before submission and require ledger reconciliation if acknowledgment is lost; a regression test verifies that no second submission occurs.

**Final fee total: 1.32562968 HBAR. Last balance: 108.6743703 HBAR.** The total includes the earlier duplicate-topic mistake that exceeded the 0.6 HBAR cap, plus the separately authorized audit message. No further paid action was taken.

The user chose the existing HashPack account for the remaining tests, so a fresh merchant is no longer required for this run. Native payments, protected API access, public receipt, replay rejection, keyed topic access and actual HCS message delivery are verified. A real refund still requires a distinct merchant signer; self-transfers net to zero and are rejected. Refund bounds, reservations and receipt reconciliation pass locally. `bun run test:hedera` runs **20 adapter + 6 API tests**. Historical notes below about pending HCS delivery or lower totals are superseded by this result.

## Ledger reconciliation and single-account testing

The signing-status responses were contradicted by the ledger: all three later topic creation retries succeeded. The confirmed topics are `0.0.11330043` (transaction `0.0.11327364-1793912436-472616392`), `0.0.11330098` (`0.0.11327364-1793912753-683283431`) and `0.0.11330136` (`0.0.11327364-1793912954-890057186`). Each charged 43,909,078 tinybars, or 0.43909078 HBAR. Their admin and submit keys, memo and 30-day lifetime were independently checked via the Hedera MCP.

Total confirmed test fees are **1.32169836 HBAR**, above the user's 0.6 HBAR cap. The assistant should have checked consensus records before retrying expired signing requests. All fee-bearing tests were stopped after detecting the overrun. The reported HashPack balance was 108.67830162 HBAR; user-directed external funding means the fee total, not the balance difference alone, is the relevant spending evidence.

Topic `0.0.11330043` was reconciled through the public mirror and saved as the configured topic under `.pulsepay/testnet-0.0.11327364-audit-topic.json`. Creating a topic now journals the transaction ID before submission, rejects unresolved duplicate creation, and returns `EXISTING` for a confirmed topic. The test-only preparation script also uses this protected helper. A no-spend check confirmed that it reuses the saved topic without constructing another paid request.

The user requested testing with the existing HashPack account rather than creating a second HashPack account. The same-account payment rejection was checked locally. Real refunds between separate account roles cannot be established by a zero-net self-transfer. HCS topic access is verified; its message list was empty, and no additional message was submitted. Refund rules and HCS retry remain locally verified, with actual message submission and a merchant-signed refund still unverified.

`bun run test:hedera` now passes **19 adapter + 6 API tests** (25 total), including duplicate-topic protections. Earlier notes below about no successful topics, 0.00442602 HBAR total fees, or pending wallet approvals are superseded by this ledger reconciliation.

## Fix-and-retry run

Implemented fixes: real Agent Kit 4.2 / Hiero SDK integration, no implicit simulation, positive int64 amounts and exact formatting, persistent spending reservations, full-date budget reset, rollback after definite submission failures, original-payer/cumulative refund checks and receipt reconciliation, durable pending HCS records and retry, real agent discovery/challenge/purchase, native receipt verification, secret challenge binding, persistent replay rejection, verified Hedera revenue/CSV/public receipts, and explicit merchant configuration. `bun run test:hedera` builds the affected packages/apps and runs 17 adapter plus 6 API tests. All nine packages/apps also compiled during this run. See `HEDERA.md` for setup and the single-process file-store deployment limit.

The corrected live payment `0.0.11327364@1793912134.008842902` settled 1 tinybar to `0.0.11329845`; its fee was 147,534 tinybars (0.00147534 HBAR). The buyer then submitted the real challenge proof to the API and received the protected data. Follow-up HTTP checks confirmed forged proofs return 400, replays return 409, and the verified payment appears in the ledger and public receipt. The audit remains explicitly `PENDING` until a topic is configured.

The first keyed topic attempt, `0.0.11327364@1793912206.166235981`, failed with `INSUFFICIENT_TX_FEE` and charged 0.00147534 HBAR. The free fee estimator returned 300,000,000 tinycents, approximately 0.44260627 HBAR, for a 30-day topic with both admin and submit keys. The user approved an increased total fee cap of 0.6 HBAR and a topic transaction cap of 0.5 HBAR. Unsigned retries awaited HashPack approval and expired; no successful topic creation has yet been established. Check the current signing request before retrying; do not assume any pending request created a topic.

Confirmed fees across the original payment, corrected payment and failed topic attempt total 0.00442602 HBAR. No private keys were requested or stored. User-directed external funding is not counted as a test fee.

The user chose a fresh merchant wallet for the live refund; its address/account ID and connection are still pending. The existing `0.0.11329845` recipient was therefore not assumed to be controlled by the user for refund signing. A new 1-tinybar payment must be made to the fresh funded merchant before it can refund that payment.

Protocol limit: the implemented `hedera-native-receipt` extension secures the existing native HBAR HTTP-402 flow. It is not the standardized `@x402/hedera` partially signed facilitator protocol. HTS settlement, standardized facilitator interoperability, live HCS delivery and the merchant-signed live refund must not be claimed as verified. Earlier issue lists below describe the initial code, before these fixes.

## Confirmed minimal-spend payment

After the user supplied funded address `0x6105F7D9807998014ca12bF1D67849de7B1094Ac`, the MCP resolved it to testnet account `0.0.11329845` and reported 10 HBAR. The project payment builder and 1-tinybar spend policy were exercised with that account as the only allowed recipient. The in-memory wallet submission bridge described below prepared the project's actual native transfer for HashPack rather than invoking the app's automatic SDK submission method. The serialized maximum transaction fee was verified as 5,000,000 tinybars (0.05 HBAR), within the user's 0.1 HBAR total fee cap.

HashPack approval completed, and the Hedera MCP independently retrieved the confirmed mirror-node transaction record:

| Field | Verified value |
| --- | --- |
| Transaction | `0.0.11327364@1793911165.521929932` |
| Result | `SUCCESS` / `CRYPTOTRANSFER` |
| Sender | `0.0.11327364` |
| Recipient | `0.0.11329845` |
| Amount | 1 tinybar = 0.00000001 HBAR |
| Actual fee | 147,534 tinybars = 0.00147534 HBAR |
| Total sender debit | 147,535 tinybars = 0.00147535 HBAR |
| Sender balance before / after | 100 / 99.99852465 HBAR |
| Recipient balance before / after | 10 / 10.00000001 HBAR |
| Consensus timestamp | `1793911194.292352576` |
| Memo | `PulsePay x402: minimal-live-check` |

[View confirmed test payment](https://hashscan.io/testnet/transaction/0.0.11327364@1793911165.521929932).

This confirms native HBAR settlement of a transaction built by the project and submitted through the MCP wallet bridge. It does not verify the project's automatic SDK execution path, HTTP payment-proof verification, live refunds, or HCS logging. No further fee-bearing test was submitted. Earlier statements about no submitted transactions describe the preceding checks, before this successful test.

## Hedera MCP recheck

On the subsequent retry, read-only MCP access succeeded. HashPack is connected on testnet as `0.0.11327364`, with a reported balance of 100 HBAR. The hardcoded merchant account `0.0.12345` exists and is not deleted, but its memo is `stake to node 4:0.0.7`; existence does not establish merchant ownership. The hardcoded audit topic `0.0.987654` returned `404 Not Found`. No payment, refund or topic creation was submitted. The earlier approval-policy failures below describe the initial test run and are superseded for current MCP connectivity by this recheck.

## Minimal-spend live test attempt

The user authorized a 1-tinybar self-transfer using `0.0.11327364`, with a total transaction-fee cap of 0.1 HBAR. Starting and final reported balances were both 100 HBAR.

The project's `X402PayTool.execute` ran with its spend policy configured for a 1-tinybar request/daily limit and the connected account as the only allowed recipient. For this test only, the submission method was replaced in memory with unsigned transaction preparation for the MCP wallet; the application's automatic SDK execution path was not exercised. The native transaction built by the project was frozen with a maximum fee of 0.05 HBAR, verified by decoding the serialized protobuf transaction body. No application source was modified.

Hedera's SDK combines the same account's debit and credit into one zero-amount entry. `sign_with_wallet` rejected the prepared transaction before approval/submission: `Refusing to sign: the transfer credits no account (zero or empty amount).` No request ID was issued, no transaction was submitted and no transaction fee was incurred. The prepared ID `0.0.11327364@1793910812.349174880` is not a confirmed transaction or settlement proof.

Additional no-spend checks passed: the local policy blocks a 2-tinybar request, an unlisted merchant, and a second 1-tinybar request after exhausting its 1-tinybar daily allowance, all before submission. Refund transaction construction also passed locally; a same-account refund similarly nets to zero. The existing six local Hedera tests still pass.

A second user-controlled testnet recipient is required to exercise actual value transfer. Its account ID was requested. No fallback transfer to the unverified demo merchant was attempted, and no HCS topic was created.

Result: local contracts and TypeScript builds pass, but the application payment flows are simulations and must not be treated as verified settlement.

## Checks performed

| Component | Result | Scope |
| --- | --- | --- |
| TypeScript | PASS | All 7 packages and both apps compile with the installed `tsc`, in dependency order. |
| Root build | BLOCKED | `bun run build` reaches Turbo but fails because the configured pnpm binary is unavailable. |
| Whitechain contracts | PASS | 17 tests; both fuzz tests ran 256 cases each. Solidity 0.8.26, Forge 1.7.1. |
| Hedera existing suite | PASS | All 6 cases in `node packages/adapter-hedera/test/hedera.test.mjs`; policy, local audit formatting and plugin registration only. |
| Hedera SDK transaction construction | PASS | Payment core action builds a two-account HBAR transfer without submitting it. |
| Whitechain SDK encoding | PASS | All 11 transaction helpers decode to the expected ABI function names. No live RPC or wallet execution. |
| Demo HTTP routes | PASS | `/`, `/merchant`, `/receipt/inv_acme_pro_001`, `/api/export.csv`, `/.well-known/x402.json` return 200. CSV contains header plus 3 fixture rows; discovery price is 50,000,000 tinybars. |
| x402 challenge | PASS | POST without payment header returns 402 and a 0.5 HBAR challenge. |
| x402 payment verification | FAIL | Arbitrary nonempty payment headers grant access; repeated forged requests both return 200. |
| Hedera MCP live checks | BLOCKED | Wallet status, HBAR balance, merchant account `0.0.12345`, and HCS topic `0.0.987654` calls all rejected by session tool approval policy. |

The MCP error was: `MCP tool call requires approval, but approval policy is never`. No transaction was submitted, and no Hedera account, balance, topic, payment receipt, refund receipt or consensus audit record was verified on testnet.

## Confirmed issues

1. **Payment authorization bypass** — `packages/sdk-server/src/x402.ts:39` accepts any nonempty header and fabricates a settlement ID. With the demo running, `curl -X POST -H 'PAYMENT-SIGNATURE: not-a-payment' http://localhost:3187/v1/services/market-data-pro/query` returns 200 and paid data without payment. Two consecutive requests succeeded. Payment proofs need actual verification and settlement checks, including network, recipient, amount, service and replay protection.

2. **Unconfigured Hedera tools report successful settlement** — both payment and refund tools return `SETTLED`/`REFUNDED`, `consensusStatus: SUCCESS` and synthetic transaction IDs without a client. Executing the buyer agent succeeds even with the storefront stopped: service discovery and the 402 challenge are hardcoded, no client/operator is passed to `execute`, and its claimed HCS submission is only a local log. Simulation needs explicit labeling, and real operation needs a configured SDK client, real discovery/request/retry flow and receipt verification.

3. **Negative amounts bypass spend accounting** — payment normalization accepts zero and negative tinybars. Executing a simulated payment of `-100` with a 100-tinybar daily budget increases the remaining budget to 200. Unsafe JavaScript numeric integers are also accepted after precision loss. Validate positive, safely represented integer amounts before constructing transactions or updating policy state.

4. **Failed payments consume budget** — injecting a failure into `secondaryAction` after a 50-tinybar request leaves only 50 of a 100-tinybar daily budget. Accounting is changed before submission and never rolled back. Track pending reservations and distinguish confirmed spend from failed execution.

5. **Refund allowlist gap and missing original-payment checks** — with `issue_refund_tool` explicitly allowed, a refund to an agent outside the merchant allowlist passes local execution with an arbitrary nonexistent original transaction ID. The policy looks only at `merchantAccountId`/`toAccountId`, not `agentAccountId`; the refund tool does not verify the original payment, recipient, refundable amount or previous refunds. These checks must precede live submission.

6. **HCS failures do not affect the result** — a deliberately invalid client causes the audit hook to log a warning and resolve successfully. No durable audit acknowledgment is returned. Missing topic/client similarly produces only a local log. Report audit status separately and make failed records recoverable.


8. **Customer and merchant UI actions are simulated** — the storefront uses a timer for successful checkout; the React checkout generates a random hash. Receipts, ledger activity and merchant balances use fixture data. Rendering those pages does not verify payments, refunds, balances or swaps.

9. **Hedera Agent Kit compatibility is unverified** — the adapter defines its own `BaseTool`, `AbstractPolicy`, `AbstractHook` and `Plugin` in `types.ts`; it does not depend on the official Agent Kit. Existing tests verify those local interfaces, not registration in a real Agent Kit runtime.

## Reproduction commands


```bash
node packages/adapter-hedera/test/hedera.test.mjs
node apps/agent-worker/dist/index.js
PORT=3187 node apps/demo-store/dist/index.js
```

Contract suites were run from each contract directory with:

```bash
bunx --package @foundry-rs/forge forge test --use 0.8.26
```

The explicit compiler version avoids the missing project-local `.bin/solc`. Default package scripts also reference a missing `.bin/forge`.

## Limits
