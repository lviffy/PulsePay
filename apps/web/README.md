# PulsePay web

SvelteKit 3, Svelte 5, Vite 8, TypeScript, Tailwind 4 and self-hosted Space Grotesk / JetBrains Mono. The four PNGs in `wireframes/` supplied the anchor layouts. The interaction reference informed pacing and materials; all identity, copy and procedural artwork are PulsePay's.

From the repository root:

```bash
pnpm install --frozen-lockfile --ignore-scripts
npm run dev
```

Open `http://localhost:3100`. `npm run dev:web` excludes the paid API. The supervisor builds SDK dependencies with concurrency two, watches packages, and runs the SvelteKit frontend. Production web builds never run in the watcher. `pnpm test:dev` verifies the launcher and rejection of a recursive `npx`-backed pnpm shim.

Set the root `.env` using `.env.example`. The frontend requires no signing keys. Reads without the required deployment configuration show errors with retries.

| Setting | Purpose |
| --- | --- |
| `WHITECHAIN_MERCHANT_HUB_ADDRESS` | Real deployed merchant contract |
| `WHITECHAIN_RPC_URL` | Whitechain Sepolia RPC, chain 1874 |
| `WHITECHAIN_USDT_ADDRESS` | Settlement token checked by checkout |
| `WHITECHAIN_DEPLOYMENT_BLOCK` | Earliest event scan block |
| `PULSEPAY_MERCHANT_ADDRESS` | Initial merchant read address; may be selected in Settings |
| `PULSEPAY_MERCHANT_NAME` | Merchant console title |
| `PULSEPAY_WEB_URL` | Canonical web origin for social metadata |
| `UNISWAP_TREASURY_HOOK_ADDRESS` | Deployed treasury guard on Unichain Sepolia |
| `UNISWAP_RPC_URL` | Treasury policy RPC |
| `HEDERA_AUDIT_TOPIC_ID` | Actual worker topic displayed in the Hedera tab |
| `HEDERA_NETWORK` | `testnet` or `mainnet` |
| `PULSEPAY_SERVICE_URL` | Existing paid API origin; defaults to port 3000 |

Invoices and subscriptions are discovered from real contract events, then read through `@pulsepay/sdk-core` / `@pulsepay/adapter-whitechain`. The console reads explicit 20,000-block windows in 2,000-block RPC chunks. Older windows are loaded on demand. Gross/refunded totals and CSV cover the displayed window; held balances and reserve policy are current. Writes require the matching connected merchant wallet and a successful transaction receipt. The legacy simulation dashboard has been removed.

The Svelte checkout calls the SDK directly; the Svelte receipt renders actual payment evidence. The React SDK separately exports `PulsePayProvider`, `PulsePayCheckout` and `PulsePayReceipt`. All packages are published on the npm registry under `@pulsepay/*` (`@pulsepay/sdk-core`, `@pulsepay/sdk-react`, `@pulsepay/sdk-server`, and adapters). Other-token quotes do not bridge into Whitechain invoices, so checkout offers direct USDT only. HCS messages are displayed as consensus records, without claiming their embedded payment payloads were independently verified by this view.

`/.well-known/x402.json` fetches the actual paid API manifest and validates it with sdk-server's `generateX402Manifest`. It publishes absolute paid endpoints, rather than advertising a protected resource served by the frontend. A self-referential service origin is rejected.

Documentation has 23 Markdown source pages under `content/docs`, one shared template, search, scroll spy and explicit `.md` twins. Sending `Accept: text/markdown` to the same `/docs` URL returns Markdown with `Vary: Accept`. Machine entry points are `/llms.txt` and `/openapi.json`.

The source explorers read curated real repository files and use Shiki at build time. The initial page includes the actual `packages/sdk-react/examples/checkout-page.tsx`; other files come from static `/source/...` endpoints when selected. No `.env`, key, worker state or dependency source is exposed.

Motion uses one GSAP ticker, Lenis with `autoRaf: false`, GSAP matchMedia cleanup, and one shared Three.js renderer for the tunnel and ASCII field. GLSL files share a noise chunk. Canvas work pauses offscreen, DPR is capped at two, and reduced motion keeps the generated static artwork. Phone entry text stays static to preserve first paint; the tunnel's WebGL loads when the panel enters view. The mark, token flow, dither art, receipts and OG images are procedural. Receipt/OG patterns share a generator seeded by invoice ID.

Verification:

```bash
pnpm --filter @pulsepay/web typecheck
pnpm --filter @pulsepay/web build
pnpm test:dev
pnpm --filter @pulsepay/adapter-whitechain test
```

See [the testing guide](../../docs/TESTING.md) and [historical verification](../../docs/VERIFICATION.md) for browser checks, performance measurements and integrations that need a configured deployment for live write verification.

The homepage links to real invoice, treasury and audit pages. Its former timed protocol simulations are removed, along with the legacy React simulation dashboard. Configuration and network errors remain visible; no fabricated success replaces a failed read.
