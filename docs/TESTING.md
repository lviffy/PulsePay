# PulsePay testing guide

Checked against the current source on 2026-11-06. The frontend is **SvelteKit 3 / Svelte 5**, not Next.js. Local test results, live read results, and signed transaction verification are separate checks.

## What the application actually does

| Surface | Implementation and limits |
| --- | --- |
| `/merchant/invoices`, `/payments`, `/refunds`, `/subscriptions` | `/api/merchant` reads Whitechain events and SDK contract state. It requires a deployed hub and a selected merchant. No fixture rows are returned. |
| Balances and reserve bar | Current `getMerchantBalances` and `getMerchantReserveBps` reads. The bar shows the current held-balance split; it is not necessarily the configured reserve percentage. |
| `/pricing-free` | A Svelte page calling the Whitechain SDK directly. Reads a real bytes32 invoice; browser-wallet USDT approval/payment is required. React applications can separately use `PulsePayCheckout`. |
| `/receipt/[id]` | A Svelte receipt backed by `/api/receipt/[id]`, which reads invoice/payment state and requires a settlement transaction hash. Receipt artwork alone proves nothing. |
| `/merchant/exports` | `/api/export` formats Whitechain settlement/refund events. Each request covers one 20,000-block window, split into 2,000-block RPC ranges. It is not an automatic export of all history. |
| `/merchant/agents` | Reads HCS topic messages from the Hedera Mirror Node and discovery from the separate paid API. HCS message contents are not independently verified payment receipts. |
| Homepage `/#protocol` | Links to the real merchant pages and the agent skill installer. The former x402, reserve-math and hook simulators are removed. |
| Payment API on port 3000 | Authenticated quote/read/ledger endpoints and real Hedera payment-proof verification. Its paid resource content is explicitly sample content, not live financial market data. |

The legacy React `MerchantBillingDashboard` component/export and legacy fixture storefront have been removed. The old preview mutation endpoints return **410 Gone**, including when an old environment sets `PULSEPAY_DEMO_MODE=true`. Port 3000 `/merchant` redirects to the real web console; fabricated receipt IDs return 404. Test doubles inside automated unit tests remain isolated from application data.

## 1. Install and start

Use Node >=22.13 and pnpm 12.14.0. Turbo needs pnpm on PATH even when the entry command is `bun run dev` or `npm run dev`.

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev:web
```

Open **http://localhost:3100**. Port 3100 is strict: an occupied port is an error, not an automatic fallback to 3000. Port 3000 belongs to the separate paid API.

The root `.env` was empty in this check. Populate only the integrations you intend to test, using `.env.example` as the template. Do not overwrite an existing `.env` with a template. Restart the dev server after changing configuration.

Whitechain browsing requires:

```dotenv
WHITECHAIN_RPC_URL=https://rpc.testnet.whitechain.io
WHITECHAIN_USDT_ADDRESS=0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7
WHITECHAIN_MERCHANT_HUB_ADDRESS=<your deployed hub>
PULSEPAY_MERCHANT_ADDRESS=<merchant address to inspect>
WHITECHAIN_DEPLOYMENT_BLOCK=<actual hub deployment block>
```

The merchant address can instead be entered in Settings and is retained in browser local storage. Public reads require no private key.


```bash
pnpm dev:api
```

That API requires `PULSEPAY_API_SECRET` (at least 32 characters) and a `HEDERA_MERCHANT_ACCOUNT_ID` you control. It uses server-side authentication; the frontend's public Whitechain reads do not require that secret. `pnpm dev` starts both processes only when the API's required settings are present. It never automatically starts the spending agent.

## 2. Confirm configuration and read failures first

Open `/merchant/settings` and inspect the public deployment settings. Enter the intended merchant with **Use this address** or connect its browser wallet. Entering an address selects what to read; it does not authorize spending.

```bash
curl -i http://localhost:3100/api/config
curl -i 'http://localhost:3100/api/merchant?merchant=<merchant-address>'
curl -i http://localhost:3100/api/treasury
curl -i http://localhost:3100/api/audit
curl -i http://localhost:3100/.well-known/x402.json
```

Observed with the current unconfigured root `.env`:

| Request | Observed result |
| --- | --- |
| `/api/config` | 200, empty hub/merchant/hook/topic, public RPC/token defaults |
| `/api/merchant` | 503, select a merchant address |
| `/api/export` | 503, a valid merchant address is required |
| `/api/audit` | 503, configure `HEDERA_AUDIT_TOPIC_ID` |
| `/api/receipt/not-an-id` | 400, invoice ID must be bytes32 |
| `/api/receipt/0x` followed by 64 zeroes | 503, configure the merchant hub |
| `/.well-known/x402.json` | 503, paid API unavailable |

These are expected configuration failures, not evidence that a payment was tested. A configured read can still fail because of the RPC, contract address, network, or block range; inspect the returned error instead of treating every 503 as missing configuration.

An isolated preview was also started with the report’s hub/owner addresses and historical topic `0.0.11330043` supplied only to that process. This did not change `.env`:

| Configured read | Observed result |
| --- | --- |
| Whitechain RPC `eth_chainId` | `0x752` (1874) |
| `/api/merchant?merchant=0x6105F7D9807998014ca12bF1D67849de7B1094Ac` | 200; zero rows in blocks 12,344,489–12,364,488, zero held balances, merchant reserve policy 2000 bps |
| `/api/audit` with topic `0.0.11330043` | 200; one actual topic message, sequence 1 |
| `/api/export?merchant=...` | 200; header-only CSV for the empty current window |
| `/api/receipt/<zero-bytes32-id>` | 404; no settled payment found |
| `/api/treasury` | 503; no hook address supplied, so live hook state is unverified |

An empty current window does not mean there is no older history. The explorer reports hub creation at block 12,323,365 and an `InvoiceCreated` event at block 12,325,556, both outside the current 20,000-block window. Use **Load older** to inspect earlier events. The browser checkout also successfully displayed the real invoice amount (25 USDT), open status, and due time; the pay button was not clicked. The older-window request (`before=12344488`) returned that real invoice: ID `0x494e562d44454d4f2d3135340000000000000000000000000000000000000000`, amount `25000000` units (25 USDT), status `OPEN`, no payment. These historical reads do not establish a new payment or control of the listed accounts.

## 3. Browser-wallet setup

Use Whitechain **Sepolia**, chain **1874** (`0x752`), RPC `https://rpc.testnet.whitechain.io`, WBT for gas, explorer `https://explorer.testnet.whitechain.io`. Checkout attempts to switch/add this chain.

The payer needs testnet WBT and the settlement token actually used by the deployed hub. The repo's default USDT is `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, with six decimals. Verify the hub's `USDT()` getter matches the configured token. Do not substitute older Whitechain chain IDs or a token from another network.

## 4. Create an invoice and pay it

1. Select the merchant in `/merchant/settings`. Connect that same merchant wallet for writes; an arbitrary read address does not confer merchant authority.
2. In `/merchant/invoices`, choose **Create invoice +**. Enter an amount, a due time of 1–365 days, and optionally a specific customer address. A blank customer allows any payer.
3. Choose **Review transaction**, inspect the confirmation, choose **Create invoice**, then confirm in the wallet. Wait for **Transaction confirmed** and the explorer transaction. Copy the bytes32 invoice ID from the table or creation transaction's `InvoiceCreated` event.
4. Open `/pricing-free?invoice=<invoice-id>` or paste the ID and choose **Load invoice**. Check merchant/customer, exact amount, due time and status. An expired or non-open invoice is not payable.
5. Switch to the intended customer wallet and pay. If allowance is insufficient, approval and payment are separate transactions. A pending signature or transaction hash alone is not settlement evidence.
6. After confirmation, open `/receipt/<invoice-id>`. Compare the transaction's `PaymentSettled` event, payer and amount against the receipt and merchant payment table.

This signed flow was **not executed in this check**. No wallet funds were moved.

## 5. Refund and check balances

1. In `/merchant/payments` or `/merchant/refunds`, choose **Refund** on a settled invoice. The initial amount is its remaining refundable amount.
2. Enter a positive partial or full refund, optionally a reason, and review/confirm with the matching merchant wallet.
3. Verify `RefundIssued`, the original customer recipient, cumulative refunded amount and the resulting payment status.
4. Reload balances. The contract consumes **reserve first, then available balance**. It rejects a refund exceeding the remaining refundable amount or the merchant's combined held liquidity. It does not cap every refund at the reserve percentage.

Reserve policy is configurable. A read-only check of the hub cited in the previous report, `0xb115ceb2cf3c15a5c1a607284f0599ad6531bbc2`, confirmed deployed bytecode, the configured default USDT, owner `0x6105F7D9807998014ca12bF1D67849de7B1094Ac`, and **`defaultReserveBps() = 2000` (20%)** on 2026-11-06. That is an observed deployment, not an address automatically selected by this app. Check `getMerchantReserveBps(merchant)` for the actual merchant policy instead of assuming 10% or 20% universally.

## 6. Subscriptions, treasury and CSV

- **Plans:** `/merchant/subscriptions` can create a plan and charge due subscriptions. Creating a plan does not create a subscriber. The frontend has no subscriber-enrollment screen; use the SDK's `client.subscriptions.subscribe(subscriptionId, planId, subscriberWallet)` or the deployed contract from the subscriber wallet. That pays the first cycle and requires token allowance. The SDK currently approves 12 cycles when initial allowance is insufficient; inspect that approval explicitly. Charge only an active, due subscription with adequate balance/allowance.
- **Whitechain funds:** `/merchant/treasury` offers **Fund reserve** and **Withdraw available**. Funding may require an ERC-20 approval. Verify confirmed contract events and current balances.
- **CSV:** use `/merchant/exports` with Whitechain selected. Verify transaction hashes, UTC timestamps, raw units and the displayed block window. Load/select older windows separately; this is not a lifetime ledger. The Hedera audit download contains topic messages and must not be confused with the API's verified-payment CSV at `/api/export.csv`.

## 7. Hedera discovery and audit checks

1. Run the paid API and inspect its `/.well-known/x402.json`; the frontend proxy should advertise absolute API endpoints.
2. Request a protected endpoint **without** a proof. Expect HTTP **402**, not a successful purchase. HTTP 402 alone verifies the challenge path only.
3. In `/merchant/agents`, compare returned topic messages with the configured Mirror Node topic. Topic sequence/timestamp/payer are consensus evidence for that message, not automatic evidence for its embedded payment claim.
4. A full purchase requires the real worker/wallet, a funded buyer, and receipt verification followed by a protected-resource retry. HCS submission is a separate transaction. Neither was submitted during this check.

## 8. Repeat local checks

```bash
pnpm lint
pnpm build
pnpm --filter @pulsepay/web typecheck
pnpm test:dev
pnpm test:unit
pnpm test:contracts
```

Unit tests use isolated temporary state and test doubles; they do not broadcast payments. The HTTP regression tests verify authentication, real 402 challenge handling, rejection of invalid proofs, removal of preview endpoints even with the old flag enabled, absence of fabricated ledger data, missing-receipt 404s and the merchant-console redirect. Foundry is required for contract tests.

Results from this run:

| Check | Result |
| --- | --- |
| `pnpm lint` | PASS, 10 workspace tasks |
| `pnpm build` | PASS, 11 workspace tasks |
| Web typecheck | PASS |
| Launcher tests | PASS, 3 tests |
| `pnpm test:unit` | PASS, 44 tests across 5 test tasks; includes 2 updated HTTP regression tests |
| Browser captures | PASS, desktop 1440×900 and phone 390×844 homepage; no captured browser exceptions. Configured checkout displayed the actual 25 USDT invoice without submitting payment. |
| HTTP page smoke checks | PASS, homepage, all 8 merchant sections, checkout, invalid receipt page and relevant docs render; removed dashboard source returns 404 and its SDK export is absent |
| New signed network transactions | NOT RUN; no payment, refund, subscription, hook write or HCS submission was broadcast |

The production build still reports existing Svelte accessibility/deprecation and bundle-size warnings. Those are not live settlement verification.

For browser checks, inspect the homepage, all merchant sections, checkout and an invalid receipt at desktop and phone sizes. Confirm configuration errors remain visible, tabs/links work, reduced motion remains readable, and `/#protocol` contains no fabricated protocol execution controls.

## References

- [Whitechain's current Sepolia setup](https://whitechain.io/blog/start-building-on-whitechain) — chain 1874, RPC, WBT gas and explorer.
- [Hedera Mirror Node topics](https://docs.hedera.com/reference/rest-api/topics) — topic/message query endpoints.
- [Whitechain contract source](../contracts/whitechain/src/PulsePayMerchantHub.sol), [wallet checkout](../apps/web/src/routes/pricing-free/+page.svelte), [live read helpers](../apps/web/src/lib/chain.ts), and [SDK subscription implementation](../packages/adapter-whitechain/src/client.ts).
- [Historical verification log](VERIFICATION.md) — earlier runs and transactions; historical entries do not establish the current configuration or this run's results.
