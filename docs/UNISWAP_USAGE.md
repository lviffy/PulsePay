# How PulsePay uses Uniswap

**Uniswap is PulsePay’s token-conversion and treasury-integration layer. It is partially implemented; the current checkout does not automatically convert every token into USDT.** Whitechain invoice checkout currently requires direct USDT payment.

## The intended purpose

A customer may hold a token other than USDT, while a merchant wants an exact USDT payment. Uniswap can provide a route between supported tokens where liquidity exists.

For example, an application could request a quote for the WETH needed to receive exactly 20 USDT, obtain the required approvals, execute the swap, verify the received USDT, and then pay the invoice. PulsePay includes pieces of that integration, but it does not currently connect the entire sequence in its checkout UI.

## What is implemented

| Capability | Current implementation | Limit |
| --- | --- | --- |
| Trading API quotes | `UniswapRoutingAdapter.getExactOutputQuote` requests an exact output amount through Uniswap’s `/quote` API when an API key is configured. | Accepts validated `CLASSIC` responses; a quote does not execute a swap. |
| Quote HTTP endpoint | The separate payment API exposes authenticated `POST /api/uniswap/quote`. | Requires valid token addresses, amounts, payer, supported chain, and API configuration. |
| Unified SDK entry point | `client.checkout.quotePayWithToken(...)` delegates to the routing adapter. | Returns quote information; it does not pay an invoice. |
| Transaction builders | `buildSwapTransaction` encodes a V3 exact-output swap for Universal Router or SwapRouter02. | The current builder uses a single-hop, 0.3% fee-tier path. It does not reconstruct the complete route returned by the Trading API. |
| Execution helper | `executeSwap` submits the built transaction through a supplied wallet and waits for its receipt. | The caller must provide correct chain/router configuration, approvals, liquidity, and verify successful execution and output. This helper is not wired into the customer checkout. |
| Treasury policy | `UniswapV4TreasuryAdapter` reads the hook’s owner, pause state, input currency, and raw-unit limit; it also supplies administrative encoders/writes. | Reading policy does not execute a swap or prove that an active pool uses the hook. |
| Treasury hook contract | `TreasuryGuardHook` checks pause state, input currency, and maximum input size during a v4 pool swap. | The hook is separate from conversion routing and does not itself find liquidity or settle invoices. |

## Does it support “all tokens to USDT”?

**No.** The current code does not establish that claim:

- A token needs a usable route and sufficient liquidity on the selected network. An arbitrary ERC-20 address is not automatically convertible.
- The Trading API branch supplies the same configured chain ID for input and output. It does not request bridging.
- Whitechain Sepolia, chain **1874**, is rejected by the routing adapter’s supported-chain list. Unichain Sepolia, chain **1301**, is a separate network.
- Receiving USDT on Unichain does not pay a Whitechain invoice. PulsePay has no integrated bridge-and-invoice-settlement flow.
- `tokenOutAddress` is caller-supplied. The parameter name `targetUsdtAmountUnits` does not independently establish that the output address is the correct USDT contract on that chain.
- The React checkout’s `enablePayWithAnyToken` option currently displays an explanatory notice. It does not enable an alternate-token payment flow. The Svelte checkout also pays directly in USDT.

The accurate product description is: **“Uniswap quote and swap integration helpers are available; the current invoice checkout settles directly in USDT on Whitechain.”**

## Actual quotes versus price estimates

The current routing source has different paths, which must not be treated as equivalent:

1. **With an API key:** it requests a Uniswap Trading API quote and validates the returned tokens, amounts, routing type, and failure indicators. API failures raise errors.
2. **Without an API key:** it first attempts an onchain V3 Quoter call.
3. **If that attempt fails:** it estimates an input amount using external token prices. Unknown token symbols are assigned a USD price of 1. If external feeds fail too, the code contains fixed benchmark prices.

The third path is **a price estimate, not proof of an executable Uniswap route**. It does not establish pool liquidity, actual token identity, executable input requirements, or guaranteed output. Its returned route label must not be used as evidence that a swap occurred.

The locally constructed swap transaction also differs from a full Trading API execution flow: it does not call the API’s `/swap` endpoint to obtain calldata for the quoted route. Treat the present helpers as integration code requiring further execution validation, rather than a completed universal checkout.

## The treasury hook’s separate role

The repository’s `TreasuryGuardHook` is intended to constrain treasury spending in pools that use it. It accepts exact-input swaps in one configured input currency and rejects unsupported modes/currencies or amounts above the configured limit. The limit is in token base units, not a universal dollar amount.

This differs from invoice quotes, which request an **exact output** amount. They are separate use cases and are not currently combined into a single hook-enforced checkout flow.

The merchant console can read treasury policy and request a pause/resume change from the hook owner. In the live console test, the connected signer was not that owner, so the application correctly rejected the attempted update before broadcasting. The adapter currently substitutes a zero address if its `limitCurrency` read fails; that value alone is not proof of a correctly configured input currency.

## Where to find the code

- [Uniswap adapter on npm](https://www.npmjs.com/package/@pulsepay/adapter-uniswap) (`npm install @pulsepay/adapter-uniswap viem`)
- [Routing adapter](../packages/adapter-uniswap/src/routing.ts): quotes, keyless estimate paths, swap calldata, and execution helper.
- [Treasury adapter](../packages/adapter-uniswap/src/treasury.ts): policy reads and administration.
- [Treasury hook contract](../contracts/uniswap-v4/src/TreasuryGuardHook.sol): swap-policy enforcement.
- [Unified SDK](../packages/sdk-core/src/index.ts): `checkout.quotePayWithToken` and routing access.
- [Payment API](../apps/demo-store/src/index.ts): authenticated quote endpoint.
- [React checkout](../packages/sdk-react/src/checkout.tsx) and [Svelte checkout](../apps/web/src/routes/pricing-free/+page.svelte): current direct-USDT behavior.

## Configuration and verification

Relevant settings include `UNISWAP_API_KEY`, `UNISWAP_CHAIN_ID`, `UNISWAP_RPC_URL`, and the treasury hook address. Use token and router deployments belonging to the actual selected chain. Keep the API key server-side. The routing adapter’s default router/quoter addresses are not a guarantee that those contracts exist on the configured network.

No new conversion swap was executed to produce this document. The preceding console run verified treasury reads and the owner restriction, not successful alternate-token conversion. See [the console test report](CONSOLE_TESTING.md).

To complete the intended checkout, the application still needs an executable route-to-transaction flow, the required token/Permit2 approvals, wallet submission and output verification, and a supported way to settle the resulting USDT into the Whitechain invoice. Cross-chain operation additionally needs an explicit bridge/settlement design.

Uniswap’s official [quote API reference](https://developers.uniswap.org/docs/api-reference/aggregator_quote) describes quote amounts, networks, routing, and the separate swap-calldata step. These platform capabilities do not establish that PulsePay has integrated every step.
