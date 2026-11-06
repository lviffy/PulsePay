# Configuration and integration audit — 2026-11-06

## Remediation update

The user subsequently requested fixes. The original findings below are retained as a historical record; their original verdict and statements about unchanged application code describe the audit phase, not the repaired tree.

`pnpm verify` now passes: effective lint across all nine workspaces, all nine TypeScript builds, **37 JavaScript tests + 32 Solidity tests = 69 tests**, and **no known dependency vulnerabilities**. A frozen-lockfile installation succeeds, all seven package runtime imports succeed, and all advertised package entry files exist. The HTTP regressions run against isolated servers without live credentials. No blockchain transactions or deployments were submitted.

| Finding | Repair |
| --- | --- |
| 1. Merchant authentication | Timing-safe API-key validation, expiring signed HttpOnly sessions, merchant login, same-origin restrictions, rate limits and secret redaction. |
| 2. Simulated settlement | Direct React USDT checkout now submits through a configured wallet and verifies a matching settlement event. EVM preview mutations require explicit demo mode, return `simulated: true`, and never enter verified CSV exports. The storefront cannot report timer-only payment success. |
| 3. Uniswap estimates | Real exact-output HTTP quote requests, strict input/response validation and fail-closed missing-key/API-error behavior. Whitechain cross-chain settlement remains explicitly unsupported. Quotes do not broadcast swaps. |
| 4. Amount corruption | Positive bounded six-decimal monetary inputs, integer-unit arithmetic for swaps/refunds, refundable-status/reserve checks and restricted asset choices. |
| 5. Treasury limits | Each deployment binds its raw-unit limit to one ERC-20 input currency. Exact-output and other-input-currency swaps are rejected. Four new integration cases exercise a real local PoolManager, including a six-decimal token. A new deployment is required for existing pools. |
| 6. Dependency graph | pnpm is authoritative, its lockfile matches manifests, the stale Bun lockfile was removed, and vulnerable Zod/WebSocket/minimatch resolutions were updated. Full audit reports no known vulnerabilities. |
| 7. HTML injection | Invoice titles are escaped before HTML insertion, refund reasons are escaped in receipts, and customer addresses/field lengths are validated. |
| 8. Environment settings | Root `.env` loading in startup scripts, validated server settings, consistent Hedera networks and shared state location, configured EVM invoice/policy reads and a server-side quote route. Unused settings were removed from the example. The local placeholder API secret was replaced without printing it or changing signing keys; `.env` has owner-only permissions. |
| 9. Verification | Workspace lint, working build/watch startup, aggregate JavaScript + Solidity checks, uncached security regressions and a CI verification workflow. |
| 10. State deployment | Persistent production-directory requirement, server/worker ownership locks, expired-challenge pruning, rate limits, bounded HTTP/response sizes and active/total challenge caps. Multiple replicas are rejected; scaling still requires a transactional store. |
| 11. Lost responses | Purchased data is persisted with redemption. Identical proof retries return the saved result; concurrent retries execute the response builder once. The worker journals transaction IDs before submission and resumes unresolved purchases. |
| 12. Package entries | ESM module targets point to actual emitted `.js` files, verified by runtime imports. |
| 13. Foundry setup | Standard pinned compiler/EVM settings and a wrapper supporting normal Foundry installations, with existing local binaries as optional fallbacks. |

The explicitly disabled EVM preview admin actions have not been replaced with a complete live merchant application. Cross-chain invoice settlement, standardized x402 facilitator interoperability and multi-replica deployment are outside the supported implementation. These capabilities are no longer represented as completed settlement. Current setup and limitations are documented in the root README.

## Original audit


Verdict: the installed workspace builds and its existing tests pass, but the application is not fully configured for real payment operation or public deployment. Several advertised flows remain simulations, and merchant HTTP routes lack authentication and input validation.

This was an audit only. No application code or secrets were changed. The existing edit to `contracts/uniswap-v4/script/DeployHook.s.sol` was preserved. No blockchain transactions, live agent purchases, or deployments were executed. Local HTTP probes used a temporary working directory, a dummy merchant account and no signing keys.

## Validation results

| Check | Result | Scope |
| --- | --- | --- |
| Root TypeScript build | PASS | All seven packages and both applications; installed dependency graph. |
| JavaScript regression tests | PASS | 20 Hedera adapter tests and six server tests. |
| Whitechain contracts | PASS | 17 tests, including two fuzz tests at 256 runs each. |
| Uniswap contracts | PASS | Nine tests; callbacks use a mocked PoolManager. |
| Lint | INEFFECTIVE | Root command succeeds with zero tasks; no workspace has a lint script. |
| Unpaid / forged payment HTTP checks | PASS | Unpaid request returns 402; `not-a-payment` returns 400. |
| Merchant authorization | FAIL | Unauthenticated state reads and hook configuration changes return 200. |
| Amount validation | FAIL | Negative swaps/invoices and a malformed refund are accepted. |
| Main README startup command | FAIL in a clean environment | Does not load `.env`; server exits because merchant account is missing. |
| Dependency audit | FAIL for committed pnpm graph | 18 advisories: one critical, nine high, six moderate, two low. The lockfile is stale; these are not verified counts for installed runtime dependencies. |

## Findings, in priority order

### 1. High — Merchant APIs are unauthenticated and disclose a webhook secret

References: `apps/demo-store/src/index.ts:344`, `:359`, `:376`, `:383`, `:487`.

There is no authentication gate before merchant reads or mutations. The `x-api-key` CORS allowance does not validate a key. The configured `PULSEPAY_API_SECRET` is never consumed. `/api/merchant/state` also returns `merchantState.webhooks.secret`. Wildcard CORS permits arbitrary websites to access these routes from a browser.

Reproduced without credentials: state read returned 200 and included a secret; changing the hook pause returned 200. Current EVM mutations affect demo state, but exposing these routes compromises that state and becomes more serious when real execution is connected.

Fix: authenticate and authorize merchant routes, remove webhook secrets from response objects, and restrict browser origins appropriately.

### 2. High — Payment success and treasury activity are simulated

References: `packages/sdk-react/src/checkout.tsx:43`, `:62`; `apps/demo-store/src/index.ts:459`, `:545`, `:920`.

The React checkout waits 1.5 seconds, generates a random hash, sets `CONFIRMED` and invokes `onSuccess` without wallet submission or receipt verification. It also hardcodes every invoice to 20 USDT. The storefront uses a timer to show payment confirmation. Merchant refunds, swaps and renewals update in-memory objects and generate synthetic transaction IDs. EVM balances and activity are fixtures and reset on restart.

Fix: connect invoice reads, wallet transactions and independently verified receipts. Until implemented, explicitly identify these actions and receipts as simulations and keep them out of real accounting exports.

### 3. High — Configuring the Uniswap API key never enables real routing

Reference: `packages/adapter-uniswap/src/routing.ts:30`.

The quote function constructs headers but never calls `fetch` or uses its base URL. It computes fixed benchmark pricing even with an API key. Token addresses and payer do not influence a real route. A probe with a configured dummy key returned a quote with exactly zero HTTP requests.

Fix: implement and validate real quotes and executable swap transactions, including supported chain/token pairs. The Whitechain invoice and Unichain treasury cannot be treated as a single-chain settlement path without an explicit cross-chain design.

### 4. High — Monetary input validation permits accounting corruption

References: `apps/demo-store/src/index.ts:393`, `:439`, `:525`, `:543`.

Reproduced on an isolated server:

- A swap amount of `-100` returned success and increased available proceeds from 9,984 to 10,084.
- An invoice amount of `-20` returned success.
- A refund amount of `"invalid"` returned success, changed the invoice to partially refunded and serialized its corrupted refunded amount as `null` because the internal value was `NaN`.

Refunds also lack a paid-status requirement. Fix: validate request schemas before mutation, require positive finite amounts, use exact integer token units, enforce refundable status and reserve constraints, and reject malformed values with 400.

### 5. High — Treasury input limits do not enforce the stated policy for exact-output swaps

References: `contracts/uniswap-v4/src/TreasuryGuardHook.sol:101`; `contracts/uniswap-v4/script/DeployHook.s.sol:14`; vendored `v4-core/src/types/PoolOperation.sol:22`.

The hook compares the absolute `amountSpecified` with an input-token limit. In v4, positive `amountSpecified` specifies output. An exact-output trade can therefore consume input above the advertised input limit while passing this comparison. The callback ignores the pool currencies and applies one raw-unit limit across assets. The deployment limit assumes 18 decimals, while shared USDT constants assume six; it cannot represent the UI's stated USDT ceiling consistently.

Fix: define the limit by currency and units, then reject unsupported swap modes or verify actual input deltas before allowing the transaction to complete. Add exact-output and mixed-decimal integration coverage with a real local PoolManager. Existing tests cover negative exact-input requests with 18-decimal dummy assets only.

### 6. High — pnpm lockfile does not describe current manifests

References: `pnpm-lock.yaml:176`, `:214`; `packages/adapter-hedera/package.json`; `apps/agent-worker/package.json`; `bun.lock`.

The pnpm graph still lists `@hashgraph/sdk` and adapter Zod 3, omitting the current official Agent Kit / Hiero dependency declarations. Current manifests and Bun lockfile use `@hiero-ledger/sdk`, `@hashgraph/hedera-agent-kit` and adapter Zod 4. The pnpm build's automatic installation rewrote the lockfile during this audit; that tracked change was restored to preserve audit-only scope.

`pnpm audit` reported 18 advisories against the stale graph, including a critical protobufjs advisory. Spot checks of installed Hiero dependencies instead found protobufjs 8.6.6, grpc-js 1.13.6 and adapter Zod 4.6.7. Those checks do not constitute a full audit of the installed graph.

Fix: choose the authoritative package manager, regenerate and review its lockfile, verify a clean frozen installation, then audit that exact graph. Do not report the stale graph's critical advisory as a demonstrated exploit in the installed application.

### 7. Medium — Untrusted invoice fields reach HTML without escaping

References: `apps/demo-store/src/index.ts:400`, `:1866`, `:1875`.

The public invoice creation route accepts arbitrary titles and customer strings. The merchant page interpolates those fields directly into `innerHTML`. This provides a stored DOM injection path within the running server's in-memory state. Browser payload execution was not tested.

Fix: render untrusted text through text nodes or escape it for its exact HTML context, and validate field lengths/types. Authentication alone does not make unescaped data safe.

### 8. Medium — Environment settings do not consistently control runtime behavior

References: `.env.example:8`; `apps/demo-store/src/index.ts:15`, `:292`, `:304`; `README.md:167`; `docs/HEDERA.md`.

Most EVM environment variables have no application consumer. In particular, setting deployment addresses, router addresses and the Uniswap API key does not wire them into the demo. `DATABASE_URL` is unused. `PULSEPAY_API_URL` defaults to port 3001, but the application serves APIs on its single `PORT` (3000). The server hardcodes both Hedera services to testnet while the buyer honors `HEDERA_NETWORK`, so mainnet configuration cannot work end to end.

The local `.env` has populated settings, but its API secret still has the example placeholder. Its presence does not establish that keys match accounts or contracts exist. No secret values were printed. The main README's Node launch commands do not load `.env`; the corrected `node --env-file=.env ...` commands already exist in `docs/HEDERA.md`.

Fix: establish one validated configuration entry point, consume supported settings, remove unused settings and update all startup instructions. Fail early on contradictory network settings.

### 9. Medium — Lint, development and test orchestration provide incomplete coverage

References: `package.json:8`, `:9`, `:10`; workspace package scripts; `turbo.json`.

No workspace defines `lint` or `dev`, despite root commands advertising them. The observed lint run reported zero tasks. Only two packages define JavaScript tests. Root `test` excludes both Solidity suites, so a passing root test does not cover the whole repository. There is no first-party root CI workflow.

Fix: implement working development and lint scripts, add an aggregate verification command including Solidity tests, and run it in CI. Add integration coverage for merchant APIs and payment execution; current passing tests do not exercise the failures above.

### 10. Medium — File-based payment state needs bounded growth and durable deployment storage

References: `packages/sdk-server/src/x402.ts:34`, `:54`; `packages/adapter-hedera/src/storage/json.ts`; `docs/HEDERA.md`.

Every unpaid request creates a persisted challenge. Expired challenges are never pruned, and every operation synchronously reads/writes the whole JSON file. Unauthenticated requests can grow storage and request latency. Replay/budget/refund state is also local to the working directory; ephemeral deployment storage or multiple replicas violate the documented single-owner assumption.

Fix: expire unused challenges, rate-limit challenge creation and bound request bodies. Use persistent single-owner storage for a local demo or a transactional shared database for replicated deployment. Preserve redeemed transaction identifiers when pruning challenges.

### 11. Medium — A lost successful resource response cannot be replayed safely

References: `packages/sdk-server/src/x402.ts:70`, `:84`; `apps/agent-worker/src/index.ts:64`.

The server marks a challenge redeemed before returning the resource. If the response is lost, retrying the same valid proof returns 409 rather than the original result. The worker advises retrying the proof, so a paid buyer can remain unable to obtain its purchased response. Replay rejection tests currently require this behavior.

Fix: persist the purchased result or an authenticated retrieval capability and return the original result for the same completed request, without authorizing a second execution or requesting another payment.

### 12. Medium — Five package module entries point to missing build files

References: `packages/sdk-react/package.json:6` and the corresponding manifests for shared, sdk-core, adapter-whitechain and adapter-uniswap.

These packages advertise `dist/index.mjs`, but `tsc` emits `dist/index.js`. All five `.mjs` targets were absent after a successful build. Consumers honoring the `module` field can fail or select an unintended fallback.

Fix: point ESM metadata to emitted `.js` files or configure matching outputs, and verify package imports through a representative consumer bundler.

### 13. Medium — Contract build setup depends on ignored local binaries

References: `package.json:13`; both contract `foundry.toml:5`; `.gitignore`.

Root contract scripts reference `.bin/forge`, and both Foundry configurations require `../../.bin/solc`. These binaries exist locally and the suites pass when run from their project directories, but `.bin` is ignored and no reproducible bootstrap is documented. Installing standard Foundry alone does not provide the required project-local compiler path.

Fix: use a pinned compiler version with standard Foundry commands, or document and automate a checksum-verified local binary bootstrap.

## Recommended repair sequence

1. Protect merchant endpoints, stop secret disclosure, validate monetary inputs and escape HTML.
2. Make simulated payment behavior explicit; connect real settlement and receipt verification before claiming success.
3. Correct treasury limit semantics and implement real Uniswap routing.
4. Align package manager, lockfile, package exports, environment loading and Foundry setup.
5. Add effective lint/CI and integration tests; harden payment state and response recovery.

## Limits

Passing local tests establishes only the tested behavior. This audit did not verify current RPC availability, deployed bytecode, contract ownership, wallet connectivity, API-key validity, live swaps, browser payload execution, facilitator interoperability or secret history. The Hedera HTTP scheme is the project's documented `hedera-native-receipt` extension; a standardized x402 facilitator integration is not implemented. Existing live-test records in other documents were not independently revalidated here.
