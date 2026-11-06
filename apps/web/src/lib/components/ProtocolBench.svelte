<script lang="ts">
	import CopyButton from './CopyButton.svelte';

	type TabId = 'hedera' | 'whitechain' | 'uniswap' | 'skills';

	let activeTab = $state<TabId>('hedera');

	// --- Tab 1: Hedera x402 Simulation State ---
	type StepStatus = 'idle' | 'running' | 'success' | 'error';
	let x402Running = $state(false);
	let x402Step = $state(0);
	let selectedService = $state<'orderbook' | 'sentiment'>('orderbook');
	let x402Evidence = $state<{
		consensusTimestamp: string;
		payer: string;
		recipient: string;
		amount: string;
		memo: string;
		topicId: string;
	} | null>(null);

	async function runX402Sim() {
		if (x402Running) return;
		x402Running = true;
		x402Step = 1;
		x402Evidence = null;

		await new Promise((r) => setTimeout(r, 450));
		x402Step = 2;
		await new Promise((r) => setTimeout(r, 450));
		x402Step = 3;
		await new Promise((r) => setTimeout(r, 550));
		x402Step = 4;
		await new Promise((r) => setTimeout(r, 450));
		x402Step = 5;

		x402Evidence = {
			consensusTimestamp: '1793913869.646957104',
			payer: '0.0.11327364',
			recipient: '0.0.11327364',
			amount: '1 tinybars',
			memo:
				selectedService === 'orderbook'
					? 'pulsepay:market-data-pro:9481'
					: 'pulsepay:ai-sentiment-feed:3319',
			topicId: '0.0.11330043'
		};
		x402Running = false;
	}

	// --- Tab 2: Whitechain USDT Simulation State ---
	let whitechainRunning = $state(false);
	let invoiceAmount = $state(50);
	let refundAmount = $state(15);
	let whitechainStep = $state(0);
	let whitechainResult = $state<{
		gross: number;
		reserveBps: number;
		reserveAmount: number;
		availableAmount: number;
		refundAmount: number;
		remainingReserve: number;
	} | null>(null);

	async function runWhitechainSim() {
		if (whitechainRunning) return;
		whitechainRunning = true;
		whitechainStep = 1;
		whitechainResult = null;

		await new Promise((r) => setTimeout(r, 400));
		whitechainStep = 2;
		await new Promise((r) => setTimeout(r, 450));
		whitechainStep = 3;
		await new Promise((r) => setTimeout(r, 450));
		whitechainStep = 4;

		const gross = invoiceAmount;
		const reserveBps = 1000; // 10%
		const reserveAmount = (gross * reserveBps) / 10000;
		const availableAmount = gross - reserveAmount;
		const actualRefund = Math.min(refundAmount, reserveAmount);

		whitechainResult = {
			gross,
			reserveBps,
			reserveAmount,
			availableAmount,
			refundAmount: actualRefund,
			remainingReserve: reserveAmount - actualRefund
		};
		whitechainRunning = false;
	}

	// --- Tab 3: Uniswap v4 Hook State ---
	let swapAmount = $state(3500);
	let hookPaused = $state(false);
	let hookTesting = $state(false);
	let hookResult = $state<{
		allowed: boolean;
		reason: string;
		code: string;
	} | null>(null);

	async function testHook() {
		hookTesting = true;
		hookResult = null;
		await new Promise((r) => setTimeout(r, 380));

		if (hookPaused) {
			hookResult = {
				allowed: false,
				reason: 'Emergency pause is active on TreasuryGuardHook.',
				code: 'error HookPaused()'
			};
		} else if (swapAmount > 5000) {
			hookResult = {
				allowed: false,
				reason: `Requested swap of ${swapAmount.toLocaleString()} USDT exceeds limit of 5,000 USDT.`,
				code: `error SwapAmountExceedsLimit(requested: ${swapAmount}, maxLimit: 5000)`
			};
		} else {
			hookResult = {
				allowed: true,
				reason: `Swap of ${swapAmount.toLocaleString()} USDT passes currency & volume bounds.`,
				code: 'return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0)'
			};
		}
		hookTesting = false;
	}

	// --- Tab 4: Agent Skill State ---
	const skillCommands = [
		{
			id: 'universal',
			label: 'Universal',
			cmd: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay',
			note: 'Auto-detects active coding assistant in workspace'
		},
		{
			id: 'claude',
			label: 'Claude Code',
			cmd: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a claude-code',
			note: 'Installs to .claude/skills/pulsepay/SKILL.md'
		},
		{
			id: 'cursor',
			label: 'Cursor',
			cmd: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a cursor',
			note: 'Installs to .cursor/skills/pulsepay/SKILL.md'
		},
		{
			id: 'windsurf',
			label: 'Windsurf',
			cmd: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a windsurf',
			note: 'Installs to .windsurf/skills/pulsepay/SKILL.md'
		},
		{
			id: 'antigravity',
			label: 'Antigravity',
			cmd: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a antigravity',
			note: 'Installs to .agents/skills/pulsepay/SKILL.md'
		}
	];
	let selectedSkillAgent = $state('universal');
	const currentSkill = $derived(
		skillCommands.find((c) => c.id === selectedSkillAgent) || skillCommands[0]
	);
</script>

<div class="protocol-deck">
	<!-- Top Navigation Toolbar -->
	<header class="deck-toolbar">
		<div class="deck-tabs" role="tablist" aria-label="Protocol rail selector">
			<button
				role="tab"
				aria-selected={activeTab === 'hedera'}
				onclick={() => (activeTab = 'hedera')}
			>
				<span class="tab-indicator {activeTab === 'hedera' ? 'active' : ''}"></span>
				Hedera x402
			</button>
			<button
				role="tab"
				aria-selected={activeTab === 'whitechain'}
				onclick={() => (activeTab = 'whitechain')}
			>
				<span class="tab-indicator {activeTab === 'whitechain' ? 'active' : ''}"></span>
				Whitechain USDT
			</button>
			<button
				role="tab"
				aria-selected={activeTab === 'uniswap'}
				onclick={() => (activeTab = 'uniswap')}
			>
				<span class="tab-indicator {activeTab === 'uniswap' ? 'active' : ''}"></span>
				Uniswap v4 Hook
			</button>
			<button
				role="tab"
				aria-selected={activeTab === 'skills'}
				onclick={() => (activeTab = 'skills')}
			>
				<span class="tab-indicator {activeTab === 'skills' ? 'active' : ''}"></span>
				NPX Agent Skill
			</button>
		</div>

		<div class="deck-status mono">
			{#if activeTab === 'hedera'}
				<span class="status-pill"><i class="dot online"></i> Hedera Testnet 296 · HCS Topic 0.0.11330043</span>
			{:else if activeTab === 'whitechain'}
				<span class="status-pill"><i class="dot online"></i> Whitechain Sepolia 1874 · Hub 0xcedf...5a7</span>
			{:else if activeTab === 'uniswap'}
				<span class="status-pill"><i class="dot online"></i> Uniswap v4 Core · beforeSwap Guard Active</span>
			{:else}
				<span class="status-pill"><i class="dot online"></i> Universal NPX Installer · Ready</span>
			{/if}
		</div>
	</header>

	<!-- Main Rail Stage -->
	<div class="deck-body">
		<!-- TAB 1: HEDERA X402 -->
		{#if activeTab === 'hedera'}
			<div class="rail-grid">
				<div class="rail-controls">
					<div class="control-group">
						<span class="control-label mono">AUTONOMOUS SERVICE ENDPOINT</span>
						<div class="service-select">
							<button
								class="service-option {selectedService === 'orderbook' ? 'selected' : ''}"
								onclick={() => (selectedService = 'orderbook')}
								disabled={x402Running}
							>
								<strong>Acme Orderbook API</strong>
								<span class="mono muted">1 tinybar · market-data-pro</span>
							</button>
							<button
								class="service-option {selectedService === 'sentiment' ? 'selected' : ''}"
								onclick={() => (selectedService = 'sentiment')}
								disabled={x402Running}
							>
								<strong>NLP Sentiment Stream</strong>
								<span class="mono muted">1 tinybar · ai-sentiment-feed</span>
							</button>
						</div>
					</div>

					<div class="control-group">
						<span class="control-label mono">EVALUATED SPEND POLICY</span>
						<div class="policy-card mono">
							<div class="policy-row">
								<span>MERCHANT ALLOWLIST</span>
								<span class="pass-tag">0.0.11327364 [OK]</span>
							</div>
							<div class="policy-row">
								<span>DAILY BUDGET CAP</span>
								<span class="pass-tag">&lt; 500 HBAR [OK]</span>
							</div>
							<div class="policy-row">
								<span>PER-REQUEST LIMIT</span>
								<span class="pass-tag">&lt; 50 HBAR [OK]</span>
							</div>
						</div>
					</div>

					<button
						class="deck-action-button"
						onclick={runX402Sim}
						disabled={x402Running}
					>
						{#if x402Running}
							<span class="spinner"></span> EXECUTING MACHINE PAYMENT…
						{:else}
							▶ RUN AUTONOMOUS 402 HANDSHAKE
						{/if}
					</button>

					<div class="rail-links mono">
						<a href="/docs/hedera/x402-agents" class="deck-link">Read x402 Architecture ↗</a>
						<a
							href="https://hashscan.io/testnet/topic/0.0.11330043"
							target="_blank"
							rel="noreferrer"
							class="deck-link"
						>
							Live HCS Topic on HashScan ↗
						</a>
					</div>
				</div>

				<div class="rail-viewport">
					<div class="viewport-header mono">
						<span>PROTOCOL HANDSHAKE PROTOCOL LOG</span>
						<span class="badge {x402Step === 5 ? 'badge-success' : 'badge-idle'}">
							{x402Step === 5 ? 'COMPLETED' : x402Running ? 'SETTLING' : 'READY'}
						</span>
					</div>

					<div class="pipeline-steps">
						<div class="step-card {x402Step >= 1 ? 'step-active' : ''}">
							<div class="step-num mono">01</div>
							<div class="step-info">
								<div class="step-title mono">HTTP 402 PAYMENT-REQUIRED CHALLENGE</div>
								<p class="step-desc">
									Agent requests resource. Server challenges with recipient <code>0.0.11327364</code>, amount <code>1 tinybar</code>.
								</p>
							</div>
							<span class="step-status mono">{x402Step >= 1 ? 'CHALLENGED' : 'PENDING'}</span>
						</div>

						<div class="step-card {x402Step >= 2 ? 'step-active' : ''}">
							<div class="step-num mono">02</div>
							<div class="step-info">
								<div class="step-title mono">CRYPTOGRAPHIC BUDGET & POLICY CHECK</div>
								<p class="step-desc">
									Worker policy validates merchant allowlist, per-request cap and unspent daily budget.
								</p>
							</div>
							<span class="step-status mono">{x402Step >= 2 ? 'APPROVED' : 'PENDING'}</span>
						</div>

						<div class="step-card {x402Step >= 3 ? 'step-active' : ''}">
							<div class="step-num mono">03</div>
							<div class="step-info">
								<div class="step-title mono">HEDERA NATIVE HBAR SETTLEMENT</div>
								<p class="step-desc">
									Signed <code>CryptoTransferTransaction</code> broadcast to Hedera node with cryptographic memo.
								</p>
							</div>
							<span class="step-status mono">{x402Step >= 3 ? 'BROADCAST' : 'PENDING'}</span>
						</div>

						<div class="step-card {x402Step >= 4 ? 'step-active' : ''}">
							<div class="step-num mono">04</div>
							<div class="step-info">
								<div class="step-title mono">MIRROR NODE RECEIPT VERIFICATION</div>
								<p class="step-desc">
									Server verifies transaction receipt via REST mirror node; unlocks protected query payload.
								</p>
							</div>
							<span class="step-status mono">{x402Step >= 4 ? 'VERIFIED' : 'PENDING'}</span>
						</div>

						<div class="step-card {x402Step >= 5 ? 'step-active' : ''}">
							<div class="step-num mono">05</div>
							<div class="step-info">
								<div class="step-title mono">IMMUTABLE HCS AUDIT LOGGING</div>
								<p class="step-desc">
									Consensus message logged to Topic <code>0.0.11330043</code> with consensus timestamp.
								</p>
							</div>
							<span class="step-status mono">{x402Step >= 5 ? 'LOGGED' : 'PENDING'}</span>
						</div>
					</div>

					{#if x402Evidence}
						<div class="evidence-box mono">
							<div class="evidence-header">
								<span>CONSENSED ONCHAIN EVIDENCE</span>
								<CopyButton text={JSON.stringify(x402Evidence, null, 2)} />
							</div>
							<pre><code>{JSON.stringify(x402Evidence, null, 2)}</code></pre>
						</div>
					{/if}
				</div>
			</div>

		<!-- TAB 2: WHITECHAIN USDT -->
		{:else if activeTab === 'whitechain'}
			<div class="rail-grid">
				<div class="rail-controls">
					<div class="control-group">
						<span class="control-label mono">INVOICE SETTLEMENT AMOUNT</span>
						<div class="amount-presets">
							{#each [25, 50, 100, 250] as amt}
								<button
									class="preset-btn {invoiceAmount === amt ? 'active' : ''}"
									onclick={() => (invoiceAmount = amt)}
									disabled={whitechainRunning}
								>
									{amt} USDT
								</button>
							{/each}
						</div>
					</div>

					<div class="control-group">
						<span class="control-label mono">REFUND RESERVE SPLIT (10.00%)</span>
						<div class="policy-card mono">
							<div class="policy-row">
								<span>CONTRACT</span>
								<span class="muted">PulsePayMerchantHub</span>
							</div>
							<div class="policy-row">
								<span>CHAIN ID</span>
								<span class="muted">1874 (Whitechain Sepolia)</span>
							</div>
							<div class="policy-row">
								<span>RESERVE BPS</span>
								<span class="pass-tag">1000 bps (10.00%)</span>
							</div>
						</div>
					</div>

					<div class="control-group">
						<span class="control-label mono">PARTIAL REFUND SIMULATION</span>
						<div class="amount-presets">
							{#each [5, 10, 15] as ref}
								<button
									class="preset-btn {refundAmount === ref ? 'active' : ''}"
									onclick={() => (refundAmount = ref)}
									disabled={whitechainRunning}
								>
									Refund {ref} USDT
								</button>
							{/each}
						</div>
					</div>

					<button
						class="deck-action-button"
						onclick={runWhitechainSim}
						disabled={whitechainRunning}
					>
						{#if whitechainRunning}
							<span class="spinner"></span> SETTLING CONTRACT TRANSACTIONS…
						{:else}
							▶ EXECUTE SETTLEMENT & RESERVE DECOMPOSITION
						{/if}
					</button>

					<div class="rail-links mono">
						<a href="/merchant" class="deck-link">Open Live Merchant Console ↗</a>
						<a href="/docs/whitechain/merchant-hub" class="deck-link">Read Merchant Hub Spec ↗</a>
					</div>
				</div>

				<div class="rail-viewport">
					<div class="viewport-header mono">
						<span>CONTRACT SETTLEMENT LIFECYCLE</span>
						<span class="badge {whitechainStep === 4 ? 'badge-success' : 'badge-idle'}">
							{whitechainStep === 4 ? 'SETTLED' : whitechainRunning ? 'MINING' : 'IDLE'}
						</span>
					</div>

					<div class="reserve-meter-wrap">
						<div class="reserve-meter-header mono">
							<span>MERCHANT BALANCE BREAKDOWN</span>
							<span>{invoiceAmount} USDT SETTLED</span>
						</div>
						<div class="reserve-visual-bar">
							<div class="bar-available" style="width: 90%;">
								<span>90% AVAILABLE</span>
							</div>
							<div class="bar-reserve" style="width: 10%;">
								<span>10% RESERVE</span>
							</div>
						</div>
					</div>

					<div class="pipeline-steps">
						<div class="step-card {whitechainStep >= 1 ? 'step-active' : ''}">
							<div class="step-num mono">01</div>
							<div class="step-info">
								<div class="step-title mono">INVOICE REGISTRATION ONCHAIN</div>
								<p class="step-desc">
									Hub emits <code>InvoiceCreated(id, merchant, customer, {invoiceAmount * 1_000_000} units, dueAt)</code>.
								</p>
							</div>
							<span class="step-status mono">{whitechainStep >= 1 ? 'CREATED' : 'PENDING'}</span>
						</div>

						<div class="step-card {whitechainStep >= 2 ? 'step-active' : ''}">
							<div class="step-num mono">02</div>
							<div class="step-info">
								<div class="step-title mono">EXACT USDT TRANSFER VERIFICATION</div>
								<p class="step-desc">
									Contract verifies customer allowance & debits exact base units. Emits <code>PaymentSettled</code>.
								</p>
							</div>
							<span class="step-status mono">{whitechainStep >= 2 ? 'CONFIRMED' : 'PENDING'}</span>
						</div>

						<div class="step-card {whitechainStep >= 3 ? 'step-active' : ''}">
							<div class="step-num mono">03</div>
							<div class="step-info">
								<div class="step-title mono">AUTOMATIC RESERVE RETENTION</div>
								<p class="step-desc">
									{(invoiceAmount * 0.1).toFixed(2)} USDT allocated to protected refund reserve; {(invoiceAmount * 0.9).toFixed(2)} USDT to merchant balance.
								</p>
							</div>
							<span class="step-status mono">{whitechainStep >= 3 ? 'ALLOCATED' : 'PENDING'}</span>
						</div>

						<div class="step-card {whitechainStep >= 4 ? 'step-active' : ''}">
							<div class="step-num mono">04</div>
							<div class="step-info">
								<div class="step-title mono">DIRECT RESERVE-BACKED REFUND</div>
								<p class="step-desc">
									Merchant triggers refund. Hub dispatches {Math.min(refundAmount, invoiceAmount * 0.1).toFixed(2)} USDT back to original customer wallet.
								</p>
							</div>
							<span class="step-status mono">{whitechainStep >= 4 ? 'DISPATCHED' : 'PENDING'}</span>
						</div>
					</div>

					{#if whitechainResult}
						<div class="metric-summary mono">
							<div class="metric-box">
								<span class="metric-label">GROSS SETTLED</span>
								<span class="metric-val">{whitechainResult.gross}.00 USDT</span>
							</div>
							<div class="metric-box">
								<span class="metric-label">AVAILABLE WITHDRAWAL</span>
								<span class="metric-val highlight">{whitechainResult.availableAmount}.00 USDT</span>
							</div>
							<div class="metric-box">
								<span class="metric-label">REFUND TO PAYER</span>
								<span class="metric-val">{whitechainResult.refundAmount}.00 USDT</span>
							</div>
							<div class="metric-box">
								<span class="metric-label">REMAINING RESERVE</span>
								<span class="metric-val">{whitechainResult.remainingReserve}.00 USDT</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

		<!-- TAB 3: UNISWAP V4 HOOK -->
		{:else if activeTab === 'uniswap'}
			<div class="rail-grid">
				<div class="rail-controls">
					<div class="control-group">
						<span class="control-label mono">SIMULATED SWAP INPUT (USDT)</span>
						<div class="amount-presets">
							{#each [2500, 4500, 7500, 12000] as amt}
								<button
									class="preset-btn {swapAmount === amt ? 'active' : ''}"
									onclick={() => (swapAmount = amt)}
								>
									{amt.toLocaleString()} USDT
								</button>
							{/each}
						</div>
					</div>

					<div class="control-group">
						<span class="control-label mono">CIRCUIT BREAKER EMERGENCY SWITCH</span>
						<button
							class="circuit-breaker-btn {hookPaused ? 'paused' : 'normal'}"
							onclick={() => (hookPaused = !hookPaused)}
						>
							<i class="dot {hookPaused ? 'paused-dot' : 'online'}"></i>
							{hookPaused ? 'HOOK STATUS: PAUSED (REVERT ALL)' : 'HOOK STATUS: OPERATIONAL (ACTIVE)'}
						</button>
						<span class="control-note mono">Owner can halt all treasury swaps instantaneously.</span>
					</div>

					<div class="control-group">
						<span class="control-label mono">GOVERNED THRESHOLD</span>
						<div class="policy-card mono">
							<div class="policy-row">
								<span>MAX SWAP LIMIT</span>
								<span class="pass-tag">5,000 USDT</span>
							</div>
							<div class="policy-row">
								<span>HOOK INTERFACE</span>
								<span class="muted">beforeSwap(address, PoolKey, ...)</span>
							</div>
							<div class="policy-row">
								<span>TARGET CURRENCY</span>
								<span class="pass-tag">USDT Base Units (6 dec)</span>
							</div>
						</div>
					</div>

					<button
						class="deck-action-button"
						onclick={testHook}
						disabled={hookTesting}
					>
						{#if hookTesting}
							<span class="spinner"></span> VERIFYING HOOK LOGIC…
						{:else}
							▶ EVALUATE BEFORE_SWAP HOOK
						{/if}
					</button>

					<div class="rail-links mono">
						<a href="/docs/uniswap/treasury-guard-hook" class="deck-link">Read Treasury Guard Hook Docs ↗</a>
					</div>
				</div>

				<div class="rail-viewport">
					<div class="viewport-header mono">
						<span>UNISWAP V4 HOOK EVALUATION</span>
						<span class="badge {hookResult ? (hookResult.allowed ? 'badge-success' : 'badge-error') : 'badge-idle'}">
							{hookResult ? (hookResult.allowed ? 'SWAP PERMITTED' : 'SWAP BLOCKED') : 'AWAITING TEST'}
						</span>
					</div>

					<div class="hook-code-preview mono">
						<div class="code-line-comment">// TreasuryGuardHook.sol — beforeSwap Hook Execution</div>
						<div class="code-line">function beforeSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata params, bytes calldata)</div>
						<div class="code-line indent">external override returns (bytes4, BeforeSwapDelta, uint24) &#123;</div>
						<div class="code-line indent-2 {hookPaused ? 'line-hit error' : ''}">if (paused) revert HookPaused();</div>
						<div class="code-line indent-2">if (allowedCurrency != Currency.unwrap(params.zeroForOne ? key.currency0 : key.currency1)) revert CurrencyNotAllowed();</div>
						<div class="code-line indent-2 {swapAmount > 5000 && !hookPaused ? 'line-hit error' : ''}">if (abs(params.amountSpecified) &gt; maxSwapAmount) revert SwapAmountExceedsLimit();</div>
						<div class="code-line indent-2 {swapAmount <= 5000 && !hookPaused ? 'line-hit success' : ''}">return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);</div>
						<div class="code-line indent">&#125;</div>
					</div>

					{#if hookResult}
						<div class="hook-result-box {hookResult.allowed ? 'result-success' : 'result-error'} mono">
							<div class="result-status-title">
								{hookResult.allowed ? '✔ SWAP CLEARED FOR EXECUTION' : '✖ SWAP REVERTED BY HOOK'}
							</div>
							<p class="result-reason">{hookResult.reason}</p>
							<div class="result-code-tag">
								<code>{hookResult.code}</code>
							</div>
						</div>
					{:else}
						<div class="hook-prompt-box mono">
							Select a swap amount or toggle the circuit breaker, then click "Evaluate before_swap Hook" to observe contract-enforced treasury safety.
						</div>
					{/if}
				</div>
			</div>

		<!-- TAB 4: AGENT SKILL -->
		{:else if activeTab === 'skills'}
			<div class="rail-grid">
				<div class="rail-controls">
					<div class="control-group">
						<span class="control-label mono">SELECT YOUR CODING ASSISTANT</span>
						<div class="agent-pills">
							{#each skillCommands as cmd}
								<button
									class="agent-pill {selectedSkillAgent === cmd.id ? 'active' : ''}"
									onclick={() => (selectedSkillAgent = cmd.id)}
								>
									{cmd.label}
								</button>
							{/each}
						</div>
					</div>

					<div class="control-group">
						<span class="control-label mono">INSTALLATION TARGET</span>
						<div class="policy-card mono">
							<div class="policy-row">
								<span>DIRECTORY</span>
								<span class="pass-tag">{currentSkill.note}</span>
							</div>
							<div class="policy-row">
								<span>VERIFIED</span>
								<span class="muted">ETHGlobal Mumbai Release</span>
							</div>
						</div>
					</div>

					<div class="rail-links mono">
						<a href="/docs/skills/pulsepay" class="deck-link">Full NPX Skill Guide ↗</a>
						<a href="/docs/quickstart" class="deck-link">PulsePay Monorepo Quickstart ↗</a>
					</div>
				</div>

				<div class="rail-viewport">
					<div class="viewport-header mono">
						<span>ONE-COMMAND INSTALLATION</span>
						<span class="badge badge-success">ACTIVE NPM PACKAGE</span>
					</div>

					<div class="skill-terminal mono">
						<div class="terminal-bar">
							<span>TERMINAL — BASH / ZSH</span>
							<CopyButton text={currentSkill.cmd} />
						</div>
						<div class="terminal-cmd">
							<span class="prompt">$</span>
							<code class="cmd-text">{currentSkill.cmd}</code>
						</div>
					</div>

					<div class="capabilities-box">
						<span class="cap-title mono">EQUIPPED SKILL WORKFLOWS</span>
						<div class="cap-grid mono">
							<div class="cap-item">
								<span class="cap-check">✔</span>
								<div>
									<strong>Whitechain Merchant Hub</strong>
									<p class="muted">Deploy invoices, manage refund reserves, verify settlements</p>
								</div>
							</div>
							<div class="cap-item">
								<span class="cap-check">✔</span>
								<div>
									<strong>Uniswap v4 Treasury Guard</strong>
									<p class="muted">Configure hook limits, evaluate swaps, trigger emergency pauses</p>
								</div>
							</div>
							<div class="cap-item">
								<span class="cap-check">✔</span>
								<div>
									<strong>Hedera x402 Machine Payments</strong>
									<p class="muted">Fulfill HTTP 402 challenges with HBAR, record HCS audit trails</p>
								</div>
							</div>
							<div class="cap-item">
								<span class="cap-check">✔</span>
								<div>
									<strong>CSV Accounting Export</strong>
									<p class="muted">Format confirmed payment history for accountants</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.protocol-deck {
		position: relative;
		z-index: 4;
		width: 100%;
		max-width: 1330px;
		margin: auto;
		background: var(--ink);
		color: var(--cream);
		border-radius: 14px;
		overflow: hidden;
		border: 1px solid #3e3e37;
		box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
	}

	.deck-toolbar {
		min-height: 54px;
		border-bottom: 1px solid #42423a;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 16px;
		gap: 12px;
		flex-wrap: wrap;
		background: #181816;
	}

	.deck-tabs {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.deck-tabs button {
		border: 1px solid transparent;
		background: transparent;
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 8px 12px;
		color: var(--cream);
		border-radius: 4px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		transition: background-color 0.15s, border-color 0.15s;
	}

	.deck-tabs button:hover {
		background: #2b2b26;
	}

	.deck-tabs button[aria-selected='true'] {
		background: #383832;
		border-color: #55554b;
	}

	.tab-indicator {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #66665c;
	}

	.tab-indicator.active {
		background: var(--orange);
		box-shadow: 0 0 8px var(--orange);
	}

	.deck-status {
		font-size: 10px;
		color: #b4b3a6;
		display: flex;
		align-items: center;
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: #242420;
		border: 1px solid #45453c;
		padding: 6px 10px;
		border-radius: 4px;
	}

	.dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.dot.online {
		background: #10b981;
		box-shadow: 0 0 6px #10b981;
	}

	.dot.paused-dot {
		background: #ef4444;
		box-shadow: 0 0 6px #ef4444;
	}

	.deck-body {
		padding: 24px;
		min-height: 500px;
	}

	.rail-grid {
		display: grid;
		grid-template-columns: 360px minmax(0, 1fr);
		gap: 28px;
		align-items: start;
	}

	.rail-controls {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.control-label {
		font-size: 9px;
		letter-spacing: 0.12em;
		color: #9f9e92;
		text-transform: uppercase;
	}

	.service-select {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.service-option {
		background: #1c1c19;
		border: 1px solid #44443a;
		border-radius: 6px;
		padding: 12px 14px;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--cream);
		transition: border-color 0.15s, background-color 0.15s;
	}

	.service-option:hover {
		background: #282823;
		border-color: #636356;
	}

	.service-option.selected {
		border-color: var(--orange);
		background: #2b2b25;
	}

	.service-option strong {
		font-size: 12px;
	}

	.policy-card {
		background: #1a1a17;
		border: 1px solid #3c3c34;
		border-radius: 6px;
		padding: 12px 14px;
		font-size: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.policy-row {
		display: flex;
		justify-content: space-between;
		gap: 8px;
	}

	.pass-tag {
		color: #34d399;
	}

	.deck-action-button {
		background: var(--cream);
		color: var(--ink);
		border: 0;
		border-radius: 6px;
		padding: 15px 18px;
		font: 11px var(--mono);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		cursor: pointer;
		transition: background-color 0.18s, transform 0.12s;
	}

	.deck-action-button:hover:not(:disabled) {
		background: #dedcd2;
		transform: translateY(-1px);
	}

	.deck-action-button:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.rail-links {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 10px;
	}

	.deck-link {
		color: #b8b7aa;
		text-decoration: underline;
		text-underline-offset: 4px;
	}

	.deck-link:hover {
		color: var(--cream);
	}

	.rail-viewport {
		background: #151513;
		border: 1px solid #3c3c34;
		border-radius: 8px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
		min-width: 0;
	}

	.viewport-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 10px;
		letter-spacing: 0.08em;
		padding-bottom: 12px;
		border-bottom: 1px solid #34342d;
	}

	.badge {
		padding: 4px 8px;
		border-radius: 3px;
		font-size: 8px;
		letter-spacing: 0.1em;
	}

	.badge-success {
		background: #064e3b;
		color: #6ee7b7;
		border: 1px solid #059669;
	}

	.badge-error {
		background: #7f1d1d;
		color: #fca5a5;
		border: 1px solid #dc2626;
	}

	.badge-idle {
		background: #2a2a24;
		color: #a8a79b;
	}

	.pipeline-steps {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.step-card {
		display: flex;
		align-items: flex-start;
		gap: 14px;
		padding: 12px 14px;
		background: #1c1c18;
		border: 1px solid #35352d;
		border-radius: 6px;
		transition: border-color 0.2s, background-color 0.2s;
	}

	.step-card.step-active {
		border-color: #6d6d5f;
		background: #22221c;
	}

	.step-num {
		font-size: 10px;
		color: #8c8b7f;
		padding-top: 1px;
	}

	.step-info {
		flex: 1;
		min-width: 0;
	}

	.step-title {
		font-size: 10px;
		font-weight: 500;
		color: var(--cream);
		margin-bottom: 4px;
	}

	.step-desc {
		font-size: 12px;
		color: #a8a79d;
		margin: 0;
		line-height: 1.45;
	}

	.step-desc code {
		font-family: var(--mono);
		font-size: 10px;
		background: #2d2d25;
		padding: 2px 4px;
		border-radius: 3px;
		color: #dedcd2;
	}

	.step-status {
		font-size: 8px;
		letter-spacing: 0.08em;
		padding: 4px 6px;
		background: #2d2d26;
		border-radius: 3px;
		color: #b5b4a6;
		white-space: nowrap;
	}

	.evidence-box {
		background: #10100e;
		border: 1px solid #38382f;
		border-radius: 6px;
		padding: 14px;
		font-size: 10px;
	}

	.evidence-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
		color: #a4a395;
		font-size: 9px;
	}

	.evidence-box pre {
		margin: 0;
		overflow-x: auto;
		color: #dedcd0;
		line-height: 1.6;
	}

	/* Whitechain tab specific */
	.amount-presets {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.preset-btn {
		background: #1f1f1a;
		border: 1px solid #424237;
		color: var(--cream);
		padding: 8px 12px;
		border-radius: 4px;
		font: 10px var(--mono);
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.15s;
	}

	.preset-btn:hover {
		background: #2b2b24;
	}

	.preset-btn.active {
		background: var(--cream);
		color: var(--ink);
		font-weight: 600;
	}

	.reserve-meter-wrap {
		background: #1c1c18;
		border: 1px solid #37372e;
		padding: 14px;
		border-radius: 6px;
	}

	.reserve-meter-header {
		display: flex;
		justify-content: space-between;
		font-size: 9px;
		color: #a8a79c;
		margin-bottom: 10px;
	}

	.reserve-visual-bar {
		display: flex;
		height: 22px;
		border-radius: 4px;
		overflow: hidden;
		font: 8px var(--mono);
		font-weight: 600;
		letter-spacing: 0.06em;
	}

	.bar-available {
		background: var(--cream);
		color: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.bar-reserve {
		background: var(--orange);
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.metric-summary {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
	}

	.metric-box {
		background: #1d1d19;
		border: 1px solid #38382f;
		border-radius: 6px;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.metric-label {
		font-size: 8px;
		letter-spacing: 0.08em;
		color: #9a998c;
	}

	.metric-val {
		font-size: 14px;
		font-weight: 600;
	}

	.metric-val.highlight {
		color: #34d399;
	}

	/* Uniswap tab specific */
	.circuit-breaker-btn {
		width: 100%;
		padding: 12px;
		border-radius: 6px;
		font: 10px var(--mono);
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		cursor: pointer;
		transition: all 0.18s;
	}

	.circuit-breaker-btn.normal {
		background: #1c2e22;
		border: 1px solid #10b981;
		color: #a7f3d0;
	}

	.circuit-breaker-btn.normal:hover {
		background: #25402f;
	}

	.circuit-breaker-btn.paused {
		background: #3b1717;
		border: 1px solid #ef4444;
		color: #fca5a5;
	}

	.circuit-breaker-btn.paused:hover {
		background: #4e1e1e;
	}

	.control-note {
		font-size: 8px;
		color: #929184;
	}

	.hook-code-preview {
		background: #11110f;
		border: 1px solid #33332a;
		border-radius: 6px;
		padding: 14px;
		font-size: 11px;
		line-height: 1.7;
	}

	.code-line-comment {
		color: #7d7c6f;
		font-style: italic;
	}

	.code-line {
		color: #c9c7ba;
	}

	.indent {
		padding-left: 14px;
	}

	.indent-2 {
		padding-left: 28px;
	}

	.line-hit.error {
		background: rgba(239, 68, 68, 0.15);
		color: #fca5a5;
		border-left: 3px solid #ef4444;
		padding-left: 25px;
	}

	.line-hit.success {
		background: rgba(16, 185, 129, 0.15);
		color: #6ee7b7;
		border-left: 3px solid #10b981;
		padding-left: 25px;
	}

	.hook-result-box {
		padding: 16px;
		border-radius: 6px;
		font-size: 11px;
	}

	.hook-result-box.result-success {
		background: #0f291e;
		border: 1px solid #10b981;
		color: #a7f3d0;
	}

	.hook-result-box.result-error {
		background: #331515;
		border: 1px solid #ef4444;
		color: #fca5a5;
	}

	.result-status-title {
		font-weight: 600;
		margin-bottom: 6px;
		font-size: 12px;
	}

	.result-reason {
		margin: 0 0 10px 0;
		font-size: 11px;
		color: #dedcd2;
	}

	.result-code-tag code {
		font-size: 10px;
		background: rgba(0, 0, 0, 0.35);
		padding: 4px 8px;
		border-radius: 4px;
		display: inline-block;
	}

	.hook-prompt-box {
		background: #1a1a16;
		border: 1px dashed #47473b;
		padding: 16px;
		border-radius: 6px;
		font-size: 10px;
		color: #a1a093;
		line-height: 1.6;
	}

	/* Skills tab specific */
	.agent-pills {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.agent-pill {
		background: #1d1d19;
		border: 1px solid #414136;
		color: var(--cream);
		padding: 10px 14px;
		border-radius: 6px;
		font: 10px var(--mono);
		text-align: left;
		cursor: pointer;
		transition: all 0.15s;
	}

	.agent-pill:hover {
		background: #2a2a23;
	}

	.agent-pill.active {
		border-color: var(--orange);
		background: #2e2e26;
		font-weight: 600;
	}

	.skill-terminal {
		background: #0e0e0c;
		border: 1px solid #36362d;
		border-radius: 6px;
		overflow: hidden;
	}

	.terminal-bar {
		background: #191916;
		border-bottom: 1px solid #33332a;
		padding: 8px 14px;
		font-size: 9px;
		color: #9e9d8f;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.terminal-cmd {
		padding: 16px;
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.prompt {
		color: var(--orange);
		font-weight: 600;
	}

	.cmd-text {
		color: var(--cream);
		font-size: 11px;
		overflow-x: auto;
		white-space: nowrap;
	}

	.capabilities-box {
		background: #181814;
		border: 1px solid #38382d;
		border-radius: 6px;
		padding: 16px;
	}

	.cap-title {
		display: block;
		font-size: 9px;
		letter-spacing: 0.12em;
		color: #9f9e91;
		margin-bottom: 14px;
	}

	.cap-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.cap-item {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		font-size: 10px;
	}

	.cap-check {
		color: #34d399;
		font-weight: 600;
	}

	.cap-item strong {
		display: block;
		color: var(--cream);
		margin-bottom: 3px;
	}

	.cap-item p {
		margin: 0;
		font-size: 10px;
		line-height: 1.4;
	}

	.spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid rgba(0, 0, 0, 0.25);
		border-top-color: var(--ink);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 950px) {
		.rail-grid {
			grid-template-columns: 1fr;
		}

		.metric-summary {
			grid-template-columns: 1fr 1fr;
		}

		.cap-grid {
			grid-template-columns: 1fr;
		}

		.deck-toolbar {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>

