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
			version: 'v1.0.0',
			description: 'Unified client for invoices, subscriptions, universal checkout quotes, and multi-chain settlement.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/sdk-core'
		},
		{
			id: 'react',
			label: 'React Checkout',
			pkg: '@pulsepay/sdk-react',
			npmCmd: 'npm install @pulsepay/sdk-react @pulsepay/sdk-core viem react react-dom',
			version: 'v1.0.0',
			description: 'Drop-in React checkout modal, receipt view, and billing components.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/sdk-react'
		},
		{
			id: 'server',
			label: 'Server Middleware',
			pkg: '@pulsepay/sdk-server',
			npmCmd: 'npm install @pulsepay/sdk-server @pulsepay/shared',
			version: 'v1.0.0',
			description: 'x402 Payment Required middleware, Hedera EVM invoices, and webhook verification.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/sdk-server'
		},
		{
			id: 'whitechain',
			label: 'Whitechain Adapter',
			pkg: '@pulsepay/adapter-whitechain',
			npmCmd: 'npm install @pulsepay/adapter-whitechain viem',
			version: 'v1.0.0',
			description: 'EVM client bindings and transaction encoders for PulsePayMerchantHub on Whitechain.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/adapter-whitechain'
		},
		{
			id: 'hedera',
			label: 'Hedera Adapter',
			pkg: '@pulsepay/adapter-hedera',
			npmCmd: 'npm install @pulsepay/adapter-hedera @hashgraph/hedera-agent-kit @hiero-ledger/sdk viem',
			version: 'v1.0.0',
			description: 'Hedera Agent Kit v4 spend policy, HCS audit logging, and native HBAR/EVM payments.',
			npmUrl: 'https://www.npmjs.com/package/@pulsepay/adapter-hedera'
		},
		{
			id: 'ccip',
			label: 'CCIP Adapter',
			pkg: '@pulsepay/adapter-ccip',
			npmCmd: 'npm install @pulsepay/adapter-ccip viem',
			version: 'v1.0.0',
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
		background: #141412;
		color: var(--cream, #f7f6f0);
		border: 1px solid #383830;
		border-radius: 10px;
		margin: 20px 0 28px;
		overflow: hidden;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}

	.install-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px 18px 0;
		background: #191916;
		border-bottom: 1px solid #33332c;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}

	.npm-tag {
		background: #cb3837;
		color: #ffffff;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.pkg-link {
		color: var(--cream, #f7f6f0);
		font-size: 12px;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: color 0.15s ease;
	}

	.pkg-link:hover {
		color: var(--orange, #ff6b35);
	}

	.badge {
		background: #272722;
		color: #9c9a8e;
		font-size: 10px;
		padding: 1px 6px;
		border-radius: 3px;
		border: 1px solid #3c3c34;
	}

	.install-tabs {
		display: flex;
		gap: 2px;
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: -1px;
	}

	.install-tabs::-webkit-scrollbar {
		display: none;
	}

	.tab-btn {
		font-family: var(--mono, monospace);
		font-size: 10px;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 8px 12px;
		background: transparent;
		color: #9a988c;
		border: 1px solid transparent;
		border-bottom: 2px solid transparent;
		border-radius: 5px 5px 0 0;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.tab-btn:hover {
		color: var(--cream, #f7f6f0);
		background: #22221e;
	}

	.tab-btn.active {
		color: var(--cream, #f7f6f0);
		background: #141412;
		border-color: #383830 #383830 transparent;
		border-bottom: 2px solid var(--orange, #ff6b35);
		font-weight: 500;
	}

	.install-body {
		padding: 16px 18px;
	}

	.code-strip {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #0d0d0c;
		border: 1px solid #282823;
		border-radius: 6px;
		padding: 10px 14px;
	}

	.cli-prompt {
		color: var(--orange, #ff6b35);
		font-weight: bold;
		user-select: none;
	}

	.install-code {
		flex: 1;
		font-size: 12px;
		color: #e5e4dc;
		word-break: break-all;
	}

	.copy-pill {
		background: #242420;
		color: var(--cream, #f7f6f0);
		border: 1px solid #44443b;
		border-radius: 4px;
		padding: 5px 12px;
		font-size: 10px;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.copy-pill:hover {
		background: var(--orange, #ff6b35);
		color: #000;
		border-color: var(--orange, #ff6b35);
	}

	.install-desc {
		margin-top: 10px;
		font-size: 11px;
		color: #8c8b80;
		line-height: 1.5;
	}

	.desc-bullet {
		color: var(--orange, #ff6b35);
	}

	@media (max-width: 640px) {
		.code-strip {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}

		.copy-pill {
			align-self: flex-end;
		}
	}
</style>
