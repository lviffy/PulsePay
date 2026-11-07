<script lang="ts">
	interface SdkTab {
		id: string;
		label: string;
		pkg: string;
		npmCmd: string;
		version: string;
		description: string;
		npmUrl: string;
	}

	const packages: SdkTab[] = [
		{
			id: 'core',
			label: 'Core SDK',
			pkg: '@pulsepay/sdk-core',
			npmCmd: 'npm install @pulsepay/sdk-core viem',
			version: 'v1.1.0',
			description: 'Unified client for invoices, subscriptions, universal checkout quotes, and multi-chain settlement.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/sdk-core'
		},
		{
			id: 'react',
			label: 'React Checkout',
			pkg: '@pulsepay/sdk-react',
			npmCmd: 'npm install @pulsepay/sdk-react @pulsepay/sdk-core viem react react-dom',
			version: 'v1.1.0',
			description: 'Drop-in React checkout modal, receipt view, and billing components.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/sdk-react'
		},
		{
			id: 'server',
			label: 'Server Middleware',
			pkg: '@pulsepay/sdk-server',
			npmCmd: 'npm install @pulsepay/sdk-server @pulsepay/shared',
			version: 'v1.1.0',
			description: 'x402 Payment Required middleware, Hedera EVM invoices, and webhook verification.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/sdk-server'
		},
		{
			id: 'whitechain',
			label: 'Whitechain Adapter',
			pkg: '@pulsepay/adapter-whitechain',
			npmCmd: 'npm install @pulsepay/adapter-whitechain viem',
			version: 'v1.1.0',
			description: 'EVM client bindings and transaction encoders for PulsePayMerchantHub on Whitechain.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/adapter-whitechain'
		},
		{
			id: 'hedera',
			label: 'Hedera Adapter',
			pkg: '@pulsepay/adapter-hedera',
			npmCmd: 'npm install @pulsepay/adapter-hedera @hashgraph/hedera-agent-kit @hiero-ledger/sdk viem',
			version: 'v1.1.0',
			description: 'Hedera Agent Kit v4 spend policy, HCS audit logging, and native HBAR/EVM payments.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/adapter-hedera'
		},
		{
			id: 'ccip',
			label: 'CCIP Adapter',
			pkg: '@pulsepay/adapter-ccip',
			npmCmd: 'npm install @pulsepay/adapter-ccip viem',
			version: 'v1.1.0',
			description: 'Chainlink CCIP 2.0 cross-chain token bridging and Router transaction builders.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/adapter-ccip'
		}
	];

	let activeTab = $state('core');
	const current = $derived(packages.find((p) => p.id === activeTab) || packages[0]);

	let copied = $state(false);

	async function copyCommand() {
		try {
			await navigator.clipboard.writeText(current.npmCmd);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// fallback
		}
	}
</script>

<div class="sdk-install-box" aria-label="NPM Package Installer">
	<div class="install-header">
		<div class="header-left">
			<span class="npm-tag mono">NPM REGISTRY</span>
			<a
				href={current.npmUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="pkg-link mono"
				aria-label="View on npmjs.com"
			>
				{current.pkg} <span class="badge">{current.version}</span> ↗
			</a>
		</div>
		<div class="install-tabs" role="tablist" aria-label="Package selector">
			{#each packages as item (item.id)}
				<button
					role="tab"
					class="tab-btn {activeTab === item.id ? 'active' : ''}"
					aria-selected={activeTab === item.id}
					onclick={() => (activeTab = item.id)}
				>
					{item.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="install-body" role="tabpanel">
		<div class="code-strip">
			<span class="cli-prompt mono">$</span>
			<code class="install-code mono">{current.npmCmd}</code>
			<button class="copy-pill mono" onclick={copyCommand} aria-label="Copy install command">
				{copied ? 'Copied ✓' : 'Copy'}
			</button>
		</div>
		<p class="install-desc mono">
			<span class="desc-bullet">▸</span> {current.description}
		</p>
	</div>
</div>

<style>
	.sdk-install-box {
		max-width: 1330px;
		margin: 32px auto 0;
		color: var(--ink);
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}

	.install-header, .header-left, .install-tabs, .code-strip {
		display: flex;
		align-items: center;
	}

	.install-header {
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 16px;
		padding: 18px 0;
		border-bottom: 1px solid var(--rule);
	}

	.header-left { flex-wrap: wrap; gap: 12px; min-width: 0; }
	.npm-tag { color: var(--muted); font-size: 9px; letter-spacing: .1em; }
	.pkg-link {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		text-transform: none;
		overflow-wrap: anywhere;
	}
	.pkg-link:hover { text-decoration: underline; text-underline-offset: 4px; }
	.badge { color: var(--muted); font-size: 9px; }
	.install-tabs { max-width: 100%; gap: 4px; overflow-x: auto; }
	.tab-btn {
		flex-shrink: 0;
		font: 9px var(--mono);
		letter-spacing: .04em;
		text-transform: uppercase;
		padding: 9px 10px;
		background: transparent;
		color: var(--muted);
		border: 0;
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
		transition: background-color .18s, color .18s;
	}
	.tab-btn:hover { background: var(--soft); color: var(--ink); }
	.tab-btn.active { background: var(--ink); color: var(--cream); }
	.install-body { padding: 18px 0; }
	.code-strip { gap: 12px; min-width: 0; }
	.cli-prompt { color: var(--muted); user-select: none; }
	.install-code {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		letter-spacing: 0;
		text-transform: none;
		overflow-wrap: anywhere;
	}
	.copy-pill {
		flex-shrink: 0;
		background: transparent;
		color: var(--ink);
		border: 1px solid var(--rule);
		border-radius: 4px;
		padding: 9px 14px;
		font-size: 9px;
		cursor: pointer;
		transition: background-color .18s, transform .18s;
	}
	.copy-pill:hover { background: var(--soft); transform: translateY(-2px); }
	.copy-pill:active { transform: translateY(1px); }
	.install-desc {
		margin: 12px 0 0;
		font-size: 10px;
		line-height: 1.7;
		letter-spacing: .025em;
		text-transform: none;
		color: var(--muted);
	}
	.desc-bullet { margin-right: 5px; }
	@media (max-width: 640px) {
		.install-header { align-items: flex-start; gap: 14px; }
		.install-tabs { width: 100%; }
		.install-code { font-size: 11px; }
		.code-strip { flex-wrap: wrap; }
		.copy-pill { margin-left: auto; }
	}
</style>
