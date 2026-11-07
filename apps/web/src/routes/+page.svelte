<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import RepoExplorer from '$lib/components/RepoExplorer.svelte';
	import TokenFlow from '$lib/components/TokenFlow.svelte';
	import SkillInstallWidget from '$lib/components/SkillInstallWidget.svelte';
	import SdkInstallWidget from '$lib/components/SdkInstallWidget.svelte';
	import ProceduralScenes from '$lib/components/ProceduralScenes.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { gsap, ScrollTrigger } from '$lib/motion';

	interface Props {
		data: PageData;
	}
	let { data }: Props = $props();

	const features = [
		[
			'Universal checkout.',
			'One checkout surface for your customers. Direct USDT settlement is live on Whitechain; cross-chain token bridging is powered by Chainlink CCIP 2.0.'
		],
		[
			'The amount stays exact.',
			'Price invoices in USDT base units. The contract checks the invoice and the amount before it records a payment.'
		],
		[
			'Refunds have a reserve.',
			'Keep a configurable share of settlement in reserve. Send a full or partial refund back to the original payer, with an onchain record.'
		],
		[
			'Billing that keeps time.',
			'Create a plan, let a subscriber authorize it, and charge eligible renewals. Every cycle has a unique renewal ID.'
		],
		[
			'Cross-chain token bridging.',
			'Chainlink CCIP 2.0 bridges tokens across Ethereum Sepolia and Hedera Testnet directly to recipient wallets with zero callback gas overhead.'
		],
		[
			'A 402 is an invitation.',
			'An agent discovers a service, receives a payment challenge and settles native HBAR. A verified receipt unlocks the saved response.'
		],
		[
			'Policy before payment.',
			'Tool and merchant allowlists, per-request limits and a daily transfer budget are evaluated before the agent spends.'
		],
		[
			'Every call leaves a trail.',
			'The worker journals its HCS audit message. If consensus submission fails, it retains the record and reconciles before retrying.'
		],
		[
			'Your accountant gets a file.',
			'Export confirmed activity with the shared CSV formatter: UTC time, asset, raw units, payer, recipient and explorer evidence.'
		],
		[
			'React. Drop in. Settle.',
			'Use PulsePayProvider, PulsePayCheckout and PulsePayReceipt from the workspace SDK. The widget reads the invoice and waits for settlement evidence.'
		]
	];

	let ready = $state(false);
	let scope = $state<HTMLElement | null>(null);

	onMount(() => {
		if (
			window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
			((navigator as any).deviceMemory || 8) <= 2
		)
			return;

		if (window.matchMedia('(max-width: 767px)').matches) {
			const panel = document.querySelector('[data-scene=rings]');
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
						ready = true;
						observer.disconnect();
					}
				},
				{ threshold: 0.45 }
			);
			if (panel) observer.observe(panel);
			return () => observer.disconnect();
		}

		const id = window.setTimeout(() => (ready = true), 250);

		let mm: gsap.MatchMedia | undefined;
		if (scope) {
			mm = gsap.matchMedia();
			mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
				const hero = scope!.querySelector<HTMLElement>('.hero')!;
				gsap.timeline({
					scrollTrigger: {
						trigger: hero, start: 'top top', end: () => `+=${window.innerHeight * 1.35}`,
						pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
						refreshPriority: 1
					}
				})
					.to('.hero-copy', { autoAlpha: 0, duration: 0.3 }, 0)
					.to('.hero-art', {
						width: () => hero.clientWidth,
						x: () => -hero.clientWidth / 2,
						duration: 0.75, ease: 'power2.inOut'
					}, 0)
					.to('.dither-rise', { autoAlpha: 0, duration: 0.3 }, 0)
					.to({}, { duration: 0.25 });
			});
			mm.add('(min-width: 1000px) and (prefers-reduced-motion: no-preference)', () => {
				gsap
					.timeline({
						scrollTrigger: { trigger: '.cost-section', start: 'top 70%', end: 'bottom 65%', scrub: true }
					})
					.from('.cost-table tbody tr', { opacity: 0.15, stagger: 0.25, ease: 'none' });
			});
		}

		return () => {
			clearTimeout(id);
			mm?.revert();
		};
	});
</script>

<svelte:head>
	<title>PulsePay — Payments for people and agents.</title>
	<meta
		name="description"
		content="Accept crypto payments, automate subscriptions, and let agents pay for services. One SDK connects checkout, settlement, refunds, and verifiable receipts."
	/>
</svelte:head>

<main id="main" bind:this={scope}>
	<section class="hero">
		<div class="hero-copy">
			<a href="/" class="brand hero-brand" aria-label="PulsePay home">
				<Mark /> <span>PulsePay</span>
			</a>
			<p class="eyebrow">One SDK. Every payment.</p>
			<h1 data-hero-title>Payments for <br />people. <br />And agents.</h1>
			<p class="hero-lede">
				Accept crypto at checkout, run subscriptions, and let agents pay for services.
				Connect it all with one SDK, from the first invoice to a verifiable receipt.
			</p>
			<div class="actions">
				<a href="/merchant" class="button">Open console ↗</a>
				<a href="/docs" class="button">Read docs</a>
				<a href="/pricing-free" class="button soft">Try checkout</a>
			</div>
			<a href="#sdk" class="scroll-cue mono">⊙ Scroll to dive in</a>
		</div>
		<div class="hero-art" data-scene="rings">
			<div class="hero-static" aria-hidden="true"></div>
			<div class="hero-disc" aria-hidden="true" title="PulsePay">
				<Mark class="hero-disc-mark" />
			</div>
			<div class="dither-rise" aria-hidden="true"></div>
		</div>
	</section>

	<section id="sdk" class="sdk-section section-pad">
		<div class="dither-band" aria-hidden="true"></div>
		<p class="eyebrow" data-decode>001 / THE SDK</p>
		<h2>One component to a<br class="mobile-break" /> live checkout.</h2>
		<RepoExplorer files={data.files} initial={data.initial} pinned={true} />
		<SdkInstallWidget />
	</section>

	<section class="feature-section section-pad" id="features">
		<div class="ascii-field" data-scene="field" aria-hidden="true"></div>
		<div class="feature-intro">
			<p class="eyebrow" data-decode>002 / THE PAYMENT PATH</p>
			<h2>Every payment <br />has a next step. <br />We built it in.</h2>
			<p>From the first invoice to the last line in your ledger. One workspace, ten connected pieces.</p>
		</div>
		<div class="feature-grid">
			{#each features as [title, body], i (title)}
				<article class="feature-entry" data-offset={i % 2 ? 'true' : undefined}>
					<span class="feature-number mono" aria-hidden="true">{String(i + 1).padStart(3, '0')} /</span>
					<h3>{title}</h3>
					<p>{body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="cost-section section-pad">
		<div>
			<p class="eyebrow" data-decode>003 / THE COST OF FRICTION</p>
			<h2>Less payment code. <br />More product.</h2>
			<div class="cost-number mono">SDK</div>
			<p>
				Your app owns the experience. PulsePay handles invoice reads, token allowances,
				settlement checks and refunds, with tools for agents to pay for services.
			</p>
		</div>
		<div class="cost-table-wrap">
			<table class="cost-table">
				<thead>
					<tr>
						<th>Integration task</th>
						<th>Build yourself</th>
						<th>With PulsePay</th>
					</tr>
				</thead>
				<tbody>
					{#each [
						['Read the invoice', 'Contract calls and status mapping', 'Amount, customer and due date'],
						['Authorize tokens', 'Allowance checks and approvals', 'Approve when allowance is insufficient'],
						['Confirm payment', 'Submit, wait and decode logs', 'Verify a matching settlement event'],
						['Handle refunds', 'Payer checks and balance accounting', 'Full or partial refund to the payer'],
						['Let agents pay', 'Challenge parsing and receipt verification', '402 tools with spend policy hooks']
					] as [step, manual, pulsepay], i (step)}
						<tr>
							<td><span class="muted">0{i + 1}</span> {step}</td>
							<td>{manual}</td>
							<td>{pulsepay}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="mono small">Direct checkout: USDT on Whitechain. Agent payments: Hedera. Wallet or agent signing is required.</p>
		</div>
	</section>

	<section class="checkout-story section-pad">
		<p class="eyebrow" data-decode>004 / FROM MANY, ONE</p>
		<h2>Different inputs. <br />A clear settlement.</h2>
		<TokenFlow />
		<div class="flow-labels mono">
			<span>Tokens / Bridge on Chainlink CCIP</span>
			<span>USDT / Settle on Whitechain</span>
		</div>
		<p>
			Direct USDT settlement is live on Whitechain; cross-chain bridging across Ethereum Sepolia and
			Hedera Testnet is handled directly through Chainlink CCIP 2.0 Routers.
		</p>
		<a href="/docs/ccip/token-bridge" class="text-link mono">Read the bridge guide ↗</a>
	</section>

	<section id="protocol" class="repo-section section-pad">
		<div id="repo" aria-hidden="true"></div>
		<p class="eyebrow" data-decode>005 / INTEGRATION TOOLS</p>
		<h2>Inspect the rails. <br />Use the real integrations.</h2>
		<div class="actions integration-links">
			<a href="/merchant/invoices" class="button">Whitechain invoices ↗</a>
			<a href="/merchant/treasury" class="button">CCIP bridge ↗</a>
			<a href="/merchant/agents" class="button">Hedera audit trail ↗</a>
		</div>
		<SkillInstallWidget />
	</section>

	<section class="final-cta section-pad">
		<p class="eyebrow">YOUR NEXT PAYMENT STARTS HERE</p>
		<h2>Make it settle.</h2>
		<div class="actions">
			<a href="/merchant" class="button light">Open console ↗</a>
			<a href="/docs" class="button outline-light">Read the docs ↗</a>
		</div>
		<p class="mono">Whitechain · Chainlink CCIP 2.0 · Hedera x402</p>
	</section>

	{#if ready}
		<ProceduralScenes />
	{/if}
</main>

