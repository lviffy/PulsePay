# Hedera autonomous subscriptions and agent invoice payments

Status: local contract, adapter, worker, server, configuration, and test implementation complete. Items 2, 5, and 6 are implemented locally; items 3, 4, 7, and 8 have working core paths but still require the live-network evidence and console/reconciliation follow-ups stated below. No testnet deployment was performed.

Build features 2 and 4 on a shared Hedera testnet merchant hub: HSS executes subscription renewals, and an agent pays contract invoices to unlock an API response. Include the minimum Hedera deployment and settlement-token support required by those flows. Keep the existing native HBAR payment path and Whitechain behavior working.

## Scope and decisions

- In: Hedera chain 296, a Hedera hub variant, one configured settlement token, HSS scheduling, token-aware agent policy, invoice receipt verification, restart recovery, focused console controls, tests and testnet evidence.
- Out: loyalty tokens, multiple settlement tokens per hub, native HBAR invoice settlement, bridging, a general event-to-HCS indexer, and standardized facilitator interoperability.
- Use ERC-20 units for settlement and a separate HBAR execution budget. Never reinterpret tinybars as token units. Use a clearly labelled test token for the first deployment; validate an HTS settlement token and required associations before claiming HTS support.
- Retain subscriber wallet custody and pull payments using an explicit allowance. Require bounded consent: immutable price/interval, finite cycle or cumulative spend cap, and expiry. An off-chain daily policy cannot govern future HSS calls; automatic renewals must enforce their own on-chain mandate. Calendar-based daily renewal limits are outside the first version and must not be implied by the UI.
- Advertise a distinct custom HTTP-402 scheme, provisionally `hedera-evm-invoice-receipt`, with EVM network identifier `eip155:296`. The installed x402 skill describes native HBAR transfers, not this invoice scheme.

## Current integration points

| Area | Existing code | Required change |
| --- | --- | --- |
| Hub | `contracts/whitechain/src/PulsePayMerchantHub.sol` | Extract small reusable settlement hooks/internal functions where necessary; implement Hedera-specific scheduling in a variant. Preserve Whitechain ABI and behavior. |
| EVM client | `packages/adapter-whitechain/src/client.ts` | Reuse ABI/encoding without inheriting fixed chain 1874 assumptions; introduce a Hedera EVM client. |
| Agent tools | `packages/adapter-hedera/src/tools/`, `plugin.ts`, `types.ts` | Add an invoice payment tool using the policy lifecycle and viem, rather than an unrestricted worker write. |
| Policy | `packages/adapter-hedera/src/policy/PulsePaySpendLimitPolicy.ts` | Add explicitly separated token budgets, trusted chain/hub/token/merchant validation and durable reservations. |
| Server | `packages/sdk-server/src/x402.ts` | Add a separate invoice challenge and redemption implementation with shared persistence helpers only where useful. |
| Mirror | `packages/adapter-hedera/src/mirror.ts` | Add contract result/log verification, hash/transaction-ID normalization and retryable indexing delays. |
| Worker | `apps/agent-worker/src/index.ts` | Dispatch by payment scheme and recover approval/payment transactions across restarts. |
| Demo and console | `apps/demo-store/src/`, `apps/web/src/lib/chain.ts`, `MerchantDashboard.svelte` | Expose an invoice-paid resource and minimal Hedera subscription/invoice controls. |

## Ordered implementation checklist

- [ ] **1. Prove Hedera prerequisites.** Add an isolated `contracts/hedera` Foundry workspace and pin official HSS dependencies. Probe `hasScheduleCapacity`, `scheduleCall`, scheduled callback sender/timestamps, cancellation and fee behavior on testnet. Validate the settlement token's ID, address, decimals and transfer behavior. Check HTS association and SafeERC20 compatibility on-network instead of relying only on local ERC-20 mocks. Record the supported scheduling horizon; reject unsupported billing intervals explicitly.

- [ ] **2. Add the Hedera merchant hub.** Implement a Hedera variant using shared invoice, reserve and refund accounting. Add explicit token initialization/association when using HTS, HBAR funding for scheduled execution, and shared internal renewal logic. Preserve existing Whitechain functionality. Pin the chosen token per deployment and publish the ABI/configuration needed by both new features.

- [ ] **3. Implement the HSS subscription lifecycle.** Schedule the first renewal after initial payment, and schedule the following cycle after each successful renewal. Check response code 22 and a nonzero schedule address. Use capacity checks with bounded later-slot selection, finite mandate limits, canonical cycle IDs and callback generation nonces. Route every renewal entry point through the same checks to prevent duplicate billing. Choose due-time offsets from the network probe without opening an early-charge window. Charge at most once per due cycle; resume from a future due date rather than burst-billing missed periods.

- [ ] **4. Handle cancellation, funding and failures.** Invalidate callbacks before attempting schedule deletion so cancellation remains effective if deletion fails. Track deletion failures for retry. Separate execution funding from settlement reserves and restrict its use to bounded renewal calls. When tokens, allowance or scheduling capacity are unavailable, retain successful payment accounting and expose a paused/unarmed state rather than reverting away evidence of a completed charge. Require explicit resume/re-arm with nonce checks. Show fee funding and last observed execution status; reconcile failed network executions because an unfunded scheduled call cannot emit an EVM event. Keep optional recovery distinct from normal operation, which needs no worker.

- [ ] **5. Add the invoice payment client and policy.** Read the invoice from the configured hub and validate chain, hub, token, merchant, payer, amount, expiry and open status against the challenge. Execute through a registered Agent Kit tool and enforced policy. Reserve spend before signing, approve only the required payment amount when allowance is insufficient, and simulate before submitting. Budget token spend by chain/token and cap HBAR fees separately. Journal signed transaction/hash information before broadcast, then reconcile ambiguous submissions and same-nonce replacement attempts without buying again.

- [ ] **6. Implement contract invoice challenges and verification.** Extend discovery with the new custom scheme. Create or provision an actual merchant invoice through an explicitly configured merchant signer, bind its ID to the challenge, and journal invoice creation for recovery. Carry chain, hub, token, invoice ID, merchant, amount, payer and expiry in the challenge. Retain the secret challenge separately from public invoice identifiers. Verify successful contract execution and a decoded `PaymentSettled` from the trusted hub against every bound field, using Mirror Node results/logs and trusted chain configuration. Bind proof redemption to the secret challenge and its intended payer. Persist one redemption per invoice and proof; return the saved resource response on retries. Treat mirror lag as pending and instruct the worker to retry the existing proof.

- [ ] **7. Wire the worker and focused console flow.** Add scheme dispatch while preserving native HBAR purchases. Configure Hedera RPC, hub, token, deployment block and ECDSA signer explicitly. Add create/pay invoice, subscribe/cancel, bounded consent display, execution funding status, next billing time and verified receipt links. Generalize the specific chain checks used by these screens and server reads; avoid a broad UI redesign. Keep custom invoice receipt support labelled accurately.

- [ ] **8. Verify and capture demo evidence.** Add contract tests for repeated callbacks, stale schedules, cancellation/deletion failure, cycle/amount caps, insufficient allowance/balance, scheduling failure and re-arm recovery. Test policy denial before signing, wrong chain/token/hub/merchant/payer/amount, failed transactions, forged logs, reused invoices/proofs, mirror lag, budget retention and worker restarts around approval/broadcast/redemption. Run lint, builds and the relevant existing/new suites, then the repository verification command. Record deployment addresses, transaction IDs, scheduling costs and reproducible testnet instructions.

## Acceptance demonstrations

1. Create a finite subscription and observe at least two successful HSS renewals while the worker and any keeper are stopped. Verify scheduled executions through transaction records and contract logs; do not assume a single contract-history endpoint includes every scheduled call.
2. Cancel it, wait past the next billing time, and prove there was no additional charge. Show cap enforcement and one failure/resume case.
3. Request an API resource, receive 402, pass the agent policy, approve/pay its invoice, verify the settlement and retrieve the resource. Replay the same proof and receive the same saved response without another payment.
4. Repeat with an over-budget request and demonstrate rejection before any signing or submission. Interrupt a paid purchase and resume it without paying twice.

## Skills and primary references

Installed using `npx skills@latest add hedera-dev/hedera-skills --yes --agent codex` (24 skills). Relevant project-local skills:

- [HSS system contract](../.agents/skills/hss-system-contract/SKILL.md)
- [HTS system contract](../.agents/skills/hts-system-contract/SKILL.md)
- [Hedera policy creation](../.agents/skills/hedera-policy-creation/SKILL.md)
- [Hedera x402 payments](../.agents/skills/x402-payments/SKILL.md)

Consult the installed viem integration guidance for the EVM client. Confirm exact APIs against pinned dependencies during implementation; skill examples are guidance rather than evidence of a successful deployment.

- [HIP-1215 source](https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-1215.md)
- [Hedera recurring HSS tutorial](https://github.com/hedera-dev/tutorial-hss-rebalancer-capacity-aware)
- [Mirror Node contract results and logs](https://docs.hedera.com/reference/rest-api/contracts)
- [Circle Hedera USDC network addresses](https://www.circle.com/multi-chain-usdc/hedera)
