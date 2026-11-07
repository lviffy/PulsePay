<script lang="ts">
	import { onMount } from 'svelte';
	import type { SourceFile } from '$lib/source';
	import CopyButton from './CopyButton.svelte';
	import Palette from './Palette.svelte';
	import { gsap, scrollPageBy } from '$lib/motion';
	import { sdkSnippets, type SdkSnippet, defaultSnippet } from '$lib/sdk-snippets';

	interface Props {
		files?: Pick<SourceFile, 'path'>[];
		initial?: SourceFile;
		pinned?: boolean;
	}

	let { files = [], initial, pinned = false }: Props = $props();

	// Primary SDK Tracks
	let activeSnippetId = $state<string>('react');
	let viewMode = $state<'code' | 'simulation'>('code');
	let showExplorer = $state<boolean>(false);
	let terminal = $state<boolean>(true);
	let search = $state<boolean>(false);
	let copyFeedback = $state<string>('Copy Code');

	// Active snippet from the curated SDK tracks
	const currentSnippet = $derived(
		sdkSnippets.find((s) => s.id === activeSnippetId) || defaultSnippet
	);

	// File browsing state (for repo explorer mode)
	let customFilePath = $state<string | null>(null);
	let customFile = $state<SourceFile | null>(null);
	let loadingCustom = $state(false);
	let customError = $state<string | null>(null);
	const fileCache = new Map<string, SourceFile>();

	// The active file displayed in the code viewer
	const activeFile = $derived.by(() => {
		if (customFile) return customFile;
		if (customFilePath && fileCache.has(customFilePath)) return fileCache.get(customFilePath)!;
		return {
			path: currentSnippet.filename,
			code: currentSnippet.code,
			html: currentSnippet.html
		};
	});

	// Tree structure for optional full-repo browsing
	type TreeNode = {
		name: string;
		path: string;
		children: TreeNode[];
		file?: Pick<SourceFile, 'path'>;
	};

	function buildTree(allFiles: Pick<SourceFile, 'path'>[]) {
		const root: TreeNode = { name: 'root', path: '', children: [] };
		for (const file of allFiles) {
			let node = root;
			const parts = file.path.split('/');
			parts.forEach((name, i) => {
				let next = node.children.find((child) => child.name === name);
				if (!next) {
					next = { name, path: parts.slice(0, i + 1).join('/'), children: [] };
					node.children.push(next);
				}
				if (i === parts.length - 1) next.file = file;
				node = next;
			});
		}
		return root.children;
	}

	const nodes = $derived(buildTree(files.length > 0 ? files : sdkSnippets.map((s) => ({ path: s.filename }))));

	// DOM Elements
	let scope = $state<HTMLDivElement | null>(null);
	let stage = $state<HTMLDivElement | null>(null);
	let content = $state<HTMLDivElement | null>(null);

	// Interactive Simulation States
	// 1. React Checkout Simulation
	let checkoutSimState = $state<'idle' | 'authorizing' | 'paying' | 'settled'>('idle');
	let checkoutTxHash = $state<string>('');

	function runCheckoutSimulation() {
		checkoutSimState = 'authorizing';
		setTimeout(() => {
			checkoutSimState = 'paying';
			setTimeout(() => {
				checkoutSimState = 'settled';
				checkoutTxHash = '0x8f2d94b15c7e3a980b14d2e87c6532f109a47b31c948e7123456789abcdef012';
			}, 1200);
		}, 800);
	}

	function resetCheckoutSimulation() {
		checkoutSimState = 'idle';
		checkoutTxHash = '';
	}

	// 2. Server x402 Simulation
	let x402SimStep = $state<number>(0);
	let x402Running = $state<boolean>(false);

	function runX402Simulation() {
		x402Running = true;
		x402SimStep = 1;
		setTimeout(() => {
			x402SimStep = 2;
			setTimeout(() => {
				x402SimStep = 3;
				setTimeout(() => {
					x402SimStep = 4;
					x402Running = false;
				}, 1000);
			}, 900);
		}, 800);
	}

	// 3. Agent Worker Simulation
	let agentLogs = $state<string[]>([
		'Agent worker initialized. Connected to Hedera Testnet and Whitechain Sepolia.',
		'PulsePayTokenSpendPolicy: Active (Budget: 10 USDT/day, Max: 1 USDT/call)',
		'Hedera HCS Audit Hook: Active on Topic 0.0.5482920',
		'Waiting for HTTP 402 challenge…'
	]);
	let agentSimRunning = $state<boolean>(false);

	function runAgentSimulation() {
		agentSimRunning = true;
		agentLogs = ['[1/5] Probing target machine endpoint: GET https://api.pulsepay.io/inference...'];
		setTimeout(() => {
			agentLogs = [
				...agentLogs,
				'[2/5] Received HTTP 402 Payment Required: 0.5 HBAR challenge (id: 0x8a1e...281a)'
			];
			setTimeout(() => {
				agentLogs = [
					...agentLogs,
					'[3/5] Policy Check: PulsePayTokenSpendPolicy evaluated -> APPROVED (0.5 HBAR <= 10 HBAR limit)'
				];
				setTimeout(() => {
					agentLogs = [
						...agentLogs,
						'[4/5] Settlement dispatched via Hedera Transfer. Consensus confirmed at 1731002345.109283746'
					];
					setTimeout(() => {
						agentLogs = [
							...agentLogs,
							'[5/5] HCS Audit message submitted to Topic 0.0.5482920 (Seq #14,291). Resource unlocked! ✓'
						];
						agentSimRunning = false;
					}, 800);
				}, 700);
			}, 700);
		}, 600);
	}

	// 4. Contract Calculation
	let invoiceAmount = $state<number>(100);
	const merchantCut = $derived((invoiceAmount * 0.98).toFixed(2));
	const reserveEscrow = $derived((invoiceAmount * 0.015).toFixed(2));
	const protocolFee = $derived((invoiceAmount * 0.005).toFixed(2));

	// 5. Skill Tool Tester
	let selectedSkillDirective = $state<number>(0);
	const skillDirectives = [
		{
			title: 'Create Invoice',
			prompt: 'Generate an onchain invoice for 25 USDT on Whitechain Sepolia due tomorrow',
			action: 'whitechain_create_invoice',
			result: '{ "invoiceId": "0x7a3f...89ab", "amount": "25000000", "status": "OPEN", "dueAt": 1731088745 }'
		},
		{
			title: 'Pay x402 Challenge',
			prompt: 'Pay HTTP 402 payment challenge using Hedera native HBAR under 1 HBAR limit',
			action: 'hedera_pay_x402_challenge',
			result: '{ "transactionId": "0.0.5482910@1731002345.109283746", "challengeId": "0x8a1e...", "status": "SUCCESS" }'
		},
		{
			title: 'CCIP Token Bridge',
			prompt: 'Bridge 50 USDT from Ethereum Sepolia to Hedera Testnet via CCIP lane',
			action: 'ccip_bridge_tokens',
			result: '{ "messageId": "0xccip912...4a8b", "lane": "Sepolia -> Hedera", "amount": "50000000", "status": "FINALIZED" }'
		}
	];

	// Tab switcher
	function selectTrack(trackId: string) {
		activeSnippetId = trackId;
		customFilePath = null;
		customFile = null;
		customError = null;
	}

	// File selection for repo explorer mode
	async function selectRepoFile(path: string) {
		customFilePath = path;
		const matchingSnippet = sdkSnippets.find((s) => s.filename === path);
		if (matchingSnippet) {
			activeSnippetId = matchingSnippet.id;
			customFile = {
				path: matchingSnippet.filename,
				code: matchingSnippet.code,
				html: matchingSnippet.html
			};
			return;
		}

		if (fileCache.has(path)) {
			customFile = fileCache.get(path)!;
			return;
		}

		loadingCustom = true;
		customError = null;
		try {
			const res = await fetch(`/source/${path}`);
			if (!res.ok) throw new Error('File not found');
			const data = await res.json();
			fileCache.set(path, data);
			customFile = data;
		} catch (err: any) {
			customError = err.message || 'Read failed';
		} finally {
			loadingCustom = false;
		}
	}

	async function copyCurrentCode() {
		try {
			await navigator.clipboard.writeText(activeFile.code);
			copyFeedback = 'Copied ✓';
			setTimeout(() => {
				copyFeedback = 'Copy Code';
			}, 2000);
		} catch {
			copyFeedback = 'Failed to copy';
		}
	}

	onMount(() => {
		// Populate cache with default snippets
		for (const s of sdkSnippets) {
			fileCache.set(s.filename, { path: s.filename, code: s.code, html: s.html });
		}
		if (initial) {
			fileCache.set(initial.path, initial);
		}

		const handleKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey)) return;
			const key = e.key.toLowerCase();
			if (key === 'k') {
				e.preventDefault();
				search = !search;
			} else if (key === 'j') {
				e.preventDefault();
				terminal = !terminal;
			}
		};
		window.addEventListener('keydown', handleKey);

		const handleWheel = (event: WheelEvent) => {
			if (!pinned || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
			if (!(event.target instanceof Element) || !event.target.closest('.code-content, .file-tree, .sim-panel')) return;
			event.preventDefault();
			const unit = event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? window.innerHeight : 1;
			scrollPageBy(event.deltaY * unit);
		};
		scope?.addEventListener('wheel', handleWheel, { passive: false });

		let mm: gsap.MatchMedia | undefined;
		if (pinned && scope && stage) {
			mm = gsap.matchMedia();
			mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
				const zoomScale = () => {
					const height = scope!.offsetHeight;
					const scale = Math.max(
						1,
						Math.min(
							1.3,
							(document.documentElement.clientWidth - 64) / stage!.clientWidth,
							(window.innerHeight - 120) / height
						)
					);
					stage!.style.setProperty('--ide-zoom-space', `${height * (scale - 1)}px`);
					return scale;
				};
				gsap.to(scope, {
					scrollTrigger: {
						trigger: stage,
						start: 'top 85%',
						end: 'top 24px',
						scrub: true,
						invalidateOnRefresh: true
					},
					scale: zoomScale,
					transformOrigin: 'center top',
					ease: 'none'
				});
				return () => stage?.style.removeProperty('--ide-zoom-space');
			});
		}

		return () => {
			window.removeEventListener('keydown', handleKey);
			scope?.removeEventListener('wheel', handleWheel);
			mm?.revert();
		};
	});

	$effect(() => {
		if (content && activeFile) {
			content.scrollTo(0, 0);
		}
	});
</script>

<div class:ide-stage={pinned} bind:this={stage}>
	<div class="ide" class:ide-scroll={pinned} bind:this={scope}>
		<!-- Studio Header Toolbar -->
		<div class="ide-toolbar">
			<div class="window-decorations" aria-hidden="true">
				<span class="dot dot-close"></span>
				<span class="dot dot-min"></span>
				<span class="dot dot-max"></span>
			</div>

			<!-- Track selector tabs -->
			<div class="ide-tabs" role="tablist" aria-label="PulsePay SDK Tracks">
				{#each sdkSnippets as item (item.id)}
					<button
						role="tab"
						class="sdk-tab {activeSnippetId === item.id && !customFilePath ? 'selected' : ''}"
						aria-selected={activeSnippetId === item.id && !customFilePath}
						onclick={() => selectTrack(item.id)}
					>
						<span class="tab-label">{item.tab}</span>
						<span class="tab-pill">{item.badge}</span>
					</button>
				{/each}
			</div>

			<!-- View Mode & Action Buttons -->
			<div class="ide-actions">
				<div class="mode-switch" role="group" aria-label="View mode">
					<button
						class="mode-btn {viewMode === 'code' ? 'active' : ''}"
						onclick={() => (viewMode = 'code')}
						title="View verified source code"
					>
						<span class="mode-icon">‹/›</span> Code
					</button>
					<button
						class="mode-btn {viewMode === 'simulation' ? 'active' : ''}"
						onclick={() => (viewMode = 'simulation')}
						title="Interactive SDK simulator & live flow"
					>
						<span class="mode-icon">▷</span> Live Simulation
					</button>
				</div>

				<button
					class="tool-btn"
					class:active={showExplorer}
					onclick={() => (showExplorer = !showExplorer)}
					title="Toggle full repository file explorer"
					aria-label="Toggle file explorer"
				>
					<span class="tool-icon">▤</span> Files
				</button>

				<button
					class="tool-btn copy-btn"
					onclick={copyCurrentCode}
					title="Copy source code to clipboard"
					aria-label="Copy code"
				>
					<span class="tool-icon">⎘</span> {copyFeedback}
				</button>
			</div>
		</div>

		<!-- Subheader breadcrumb & metadata -->
		<div class="ide-subbar">
			<div class="subbar-path">
				<span class="path-icon">📄</span>
				<span class="path-text mono">{activeFile.path}</span>
				<span class="category-tag mono">{currentSnippet.category}</span>
			</div>
			<div class="subbar-meta">
				<span class="install-pill mono" title="Copy package install command">
					<span class="install-prefix">$</span> {currentSnippet.installCmd}
				</span>
				<button class="kbd-hint mono" onclick={() => (search = true)} title="Quick file search (Ctrl+K)">
					CTRL K
				</button>
			</div>
		</div>

		<!-- Main Workspace Area -->
		<div class="ide-workspace {showExplorer ? 'with-tree' : 'no-tree'}">
			<!-- Optional Collapsible File Tree -->
			{#if showExplorer}
				<aside class="file-tree" data-lenis-prevent aria-label="Repository files">
					<div class="tree-header mono">MONOREPO WORKSPACE</div>
					<ul role="tree">
						{#each nodes as node (node.path)}
							{#if node.file}
								<li role="none">
									<button
										role="treeitem"
										aria-selected={activeFile.path === node.path}
										class={activeFile.path === node.path ? 'selected' : ''}
										onclick={() => selectRepoFile(node.path)}
										title={node.path}
									>
										<span class="file-icon">⌑</span>{node.name}
									</button>
								</li>
							{:else}
								<li role="none">
									<details open={activeFile.path.startsWith(`${node.path}/`) || node.path === 'packages'}>
										<summary role="treeitem" aria-selected="false">{node.name}</summary>
										<ul role="group">
											{#each node.children as child (child.path)}
												{#if child.file}
													<li role="none">
														<button
															role="treeitem"
															aria-selected={activeFile.path === child.path}
															class={activeFile.path === child.path ? 'selected' : ''}
															onclick={() => selectRepoFile(child.path)}
															title={child.path}
														>
															<span class="file-icon">⌑</span>{child.name}
														</button>
													</li>
												{:else}
													<li role="none">
														<details open={activeFile.path.startsWith(`${child.path}/`)}>
															<summary role="treeitem" aria-selected="false">{child.name}</summary>
															<ul role="group">
																{#each child.children as subchild (subchild.path)}
																	<li role="none">
																		<button
																			role="treeitem"
																			aria-selected={activeFile.path === subchild.path}
																			class={activeFile.path === subchild.path ? 'selected' : ''}
																			onclick={() => selectRepoFile(subchild.path)}
																			title={subchild.path}
																		>
																			<span class="file-icon">⌑</span>{subchild.name}
																		</button>
																	</li>
																{/each}
															</ul>
														</details>
													</li>
												{/if}
											{/each}
										</ul>
									</details>
								</li>
							{/if}
						{/each}
					</ul>
				</aside>
			{/if}

			<!-- Middle Main Viewer -->
			<div id="source-viewer" class="source-viewer" role="tabpanel">
				{#if viewMode === 'code'}
					<!-- Source Code View -->
					<div
						class="code-content"
						bind:this={content}
						role="region"
						aria-label="Source code"
						data-lenis-prevent
					>
						{#if loadingCustom}
							<div class="code-message mono"><span class="spinner"></span> Loading file from repository…</div>
						{:else if customError}
							<div class="code-message error mono">
								<span>⚠ File read error: {customError}</span>
								<button class="retry-btn" onclick={() => customFilePath && selectRepoFile(customFilePath)}>Retry</button>
							</div>
						{:else}
							{@html activeFile.html}
						{/if}
					</div>
				{:else}
					<!-- Interactive Live Simulation View -->
					<div class="sim-panel" data-lenis-prevent>
						{#if currentSnippet.id === 'react'}
							<!-- React Checkout Interactive Preview -->
							<div class="sim-card checkout-preview">
								<div class="sim-header">
									<div class="sim-title mono">
										<span class="pulse-dot"></span> LIVE COMPONENT PREVIEW &middot; &lt;PulsePayCheckout /&gt;
									</div>
									<span class="sim-badge mono">WHITECHAIN SEPOLIA (1874)</span>
								</div>

								<div class="checkout-box-inner">
									<div class="checkout-brand">
										<span class="mark-icon">✦</span>
										<div>
											<h4>PulsePay Checkout</h4>
											<p class="mono text-muted">Merchant: 0x98b8...A84F &middot; Invoice #{currentSnippet.simulation.invoiceId.slice(0, 10)}</p>
										</div>
									</div>

									<div class="checkout-amount-display">
										<div class="amount-label mono">TOTAL AMOUNT DUE</div>
										<div class="amount-val">
											<span class="currency">USDT</span> 25.00
										</div>
										<div class="amount-note mono">Settles directly to merchant contract with reserve protection</div>
									</div>

									<div class="checkout-interactive-action">
										{#if checkoutSimState === 'idle'}
											<button class="sim-action-btn primary" onclick={runCheckoutSimulation}>
												Pay 25.00 USDT ↗
											</button>
										{:else if checkoutSimState === 'authorizing'}
											<button class="sim-action-btn pending" disabled>
												<span class="spinner-small"></span> Authorizing Viem Wallet…
											</button>
										{:else if checkoutSimState === 'paying'}
											<button class="sim-action-btn pending" disabled>
												<span class="spinner-small"></span> Submitting Settlement to PulsePayMerchantHub…
											</button>
										{:else if checkoutSimState === 'settled'}
											<div class="settled-banner">
												<div class="settled-status mono">✓ PAYMENT SETTLED ON-CHAIN</div>
												<div class="settled-hash mono">TxHash: {checkoutTxHash}</div>
												<div class="settled-actions">
													<a
														href="https://testnet.whitechain.io"
														target="_blank"
														rel="noreferrer"
														class="explorer-link mono"
													>
														View on Whitechain Explorer ↗
													</a>
													<button class="reset-link mono" onclick={resetCheckoutSimulation}>
														Reset Simulation
													</button>
												</div>
											</div>
										{/if}
									</div>

									<div class="sim-specs-grid">
										<div class="spec-item">
											<span class="spec-label mono">NETWORK</span>
											<span class="spec-val mono">Whitechain Sepolia</span>
										</div>
										<div class="spec-item">
											<span class="spec-label mono">SETTLEMENT ASSET</span>
											<span class="spec-val mono">USDT (6 Decimals)</span>
										</div>
										<div class="spec-item">
											<span class="spec-label mono">SLIPPAGE</span>
											<span class="spec-val mono">0.00% (Exact Transfer)</span>
										</div>
										<div class="spec-item">
											<span class="spec-label mono">REFUND RESERVE</span>
											<span class="spec-val mono">1.5% Guaranteed</span>
										</div>
									</div>
								</div>
							</div>
						{:else if currentSnippet.id === 'server'}
							<!-- Server x402 Protocol Flow Simulator -->
							<div class="sim-card server-sim">
								<div class="sim-header">
									<div class="sim-title mono">
										<span class="pulse-dot"></span> HTTP 402 PROTOCOL HANDSHAKE SIMULATOR
									</div>
									<button
										class="sim-action-btn secondary small"
										onclick={runX402Simulation}
										disabled={x402Running}
									>
										{x402Running ? 'Simulating…' : 'Run Test Handshake ▷'}
									</button>
								</div>

								<div class="handshake-steps">
									<!-- Step 1 -->
									<div class="step-card {x402SimStep >= 1 ? 'active' : ''}">
										<div class="step-num mono">STEP 1</div>
										<div class="step-content">
											<div class="step-head mono">Client requests protected machine resource</div>
											<div class="step-code mono">
												<span class="http-verb get">GET</span> /api/v1/agent-query
											</div>
										</div>
									</div>

									<!-- Step 2 -->
									<div class="step-card {x402SimStep >= 2 ? 'active' : ''}">
										<div class="step-num mono">STEP 2</div>
										<div class="step-content">
											<div class="step-head mono">Server middleware issues HTTP 402 with secret challenge</div>
											<div class="step-code mono">
												<span class="http-status warn">402 Payment Required</span><br />
												<span class="header-key">PAYMENT-REQUIRED:</span> &#123; "network": "hedera:testnet", "amount": "50000000", "payTo": "0.0.5482910", "challengeId": "8a1e...281a" &#125;
											</div>
										</div>
									</div>

									<!-- Step 3 -->
									<div class="step-card {x402SimStep >= 3 ? 'active' : ''}">
										<div class="step-num mono">STEP 3</div>
										<div class="step-content">
											<div class="step-head mono">Agent settles native HBAR on Hedera & dispatches receipt proof</div>
											<div class="step-code mono">
												<span class="http-verb post">POST</span> /api/v1/agent-query<br />
												<span class="header-key">PAYMENT-SIGNATURE:</span> &#123; "challengeId": "8a1e...281a", "txId": "0.0.5482910@1731002345.109283746" &#125;
											</div>
										</div>
									</div>

									<!-- Step 4 -->
									<div class="step-card {x402SimStep >= 4 ? 'active' : ''}">
										<div class="step-num mono">STEP 4</div>
										<div class="step-content">
											<div class="step-head mono">Server verifies mirror node consensus & unlocks response</div>
											<div class="step-code mono success">
												<span class="http-status ok">200 OK</span><br />
												&#123; "status": "success", "data": "Access Granted", "consensusTimestamp": "1731002345.109283746" &#125;
											</div>
										</div>
									</div>
								</div>
							</div>
						{:else if currentSnippet.id === 'agent'}
							<!-- Autonomous Agent Console Simulator -->
							<div class="sim-card agent-sim">
								<div class="sim-header">
									<div class="sim-title mono">
										<span class="pulse-dot"></span> AUTONOMOUS AGENT WORKER CONSOLE
									</div>
									<button
										class="sim-action-btn secondary small"
										onclick={runAgentSimulation}
										disabled={agentSimRunning}
									>
										{agentSimRunning ? 'Executing…' : 'Simulate Autonomous Payment ▷'}
									</button>
								</div>

								<div class="terminal-log-window mono" data-lenis-prevent>
									{#each agentLogs as log, i (i)}
										<div class="log-line">
											<span class="log-prompt">&gt;</span>
											<span class="log-text">{log}</span>
										</div>
									{/each}
								</div>

								<div class="agent-guardrails-row">
									<div class="guard-pill mono">
										<span class="guard-name">DAILY SPEND POLICY</span>
										<span class="guard-status pass">10 USDT CAP &middot; PASS</span>
									</div>
									<div class="guard-pill mono">
										<span class="guard-name">MAX PER REQUEST</span>
										<span class="guard-status pass">1 USDT LIMIT &middot; PASS</span>
									</div>
									<div class="guard-pill mono">
										<span class="guard-name">HCS AUDIT LOG</span>
										<span class="guard-status pass">TOPIC 0.0.5482920</span>
									</div>
								</div>
							</div>
						{:else if currentSnippet.id === 'contracts'}
							<!-- Smart Contract Settlement Inspector -->
							<div class="sim-card contracts-sim">
								<div class="sim-header">
									<div class="sim-title mono">
										<span class="pulse-dot"></span> PULSEPAY MERCHANT HUB &middot; SETTLEMENT MECHANICS
									</div>
									<span class="sim-badge mono">SOLIDITY 0.8.26</span>
								</div>

								<div class="contract-calc-box">
									<div class="calc-top">
										<label class="mono calc-label" for="amount-input">
											SIMULATE INVOICE AMOUNT (USDT):
										</label>
										<div class="calc-input-wrap">
											<input
												id="amount-input"
												type="number"
												min="1"
												max="100000"
												bind:value={invoiceAmount}
												class="calc-input mono"
											/>
											<span class="calc-unit mono">USDT</span>
										</div>
									</div>

									<div class="split-visual-bar">
										<div class="bar-slice merchant" style="width: 98%;">98% Merchant Net</div>
										<div class="bar-slice reserve" style="width: 1.5%;">1.5%</div>
										<div class="bar-slice fee" style="width: 0.5%;">0.5%</div>
									</div>

									<div class="split-breakdown-grid">
										<div class="breakdown-card">
											<div class="bd-title mono">MERCHANT PAYOUT</div>
											<div class="bd-val mono highlight">{merchantCut} USDT</div>
											<div class="bd-note mono">Transferred directly to merchant wallet</div>
										</div>
										<div class="breakdown-card">
											<div class="bd-title mono">REFUND RESERVE</div>
											<div class="bd-val mono">{reserveEscrow} USDT</div>
											<div class="bd-note mono">Escrowed for verified on-chain refunds</div>
										</div>
										<div class="breakdown-card">
											<div class="bd-title mono">PROTOCOL FEE</div>
											<div class="bd-val mono">{protocolFee} USDT</div>
											<div class="bd-note mono">50 bps protocol maintenance cut</div>
										</div>
									</div>

									<div class="contract-features-list mono">
										<span class="feat-tag">✓ Non-reentrant</span>
										<span class="feat-tag">✓ SafeERC20</span>
										<span class="feat-tag">✓ Whitechain Chain ID 1874</span>
										<span class="feat-tag">✓ Gas: ~64,820</span>
									</div>
								</div>
							</div>
						{:else if currentSnippet.id === 'skill'}
							<!-- AI Agent Skill Tester -->
							<div class="sim-card skill-sim">
								<div class="sim-header">
									<div class="sim-title mono">
										<span class="pulse-dot"></span> AGENT SKILL DIRECTIVE RUNNER
									</div>
									<span class="sim-badge mono">UNIVERSAL AGENT TOOL</span>
								</div>

								<div class="skill-tabs-row">
									{#each skillDirectives as dir, i (dir.title)}
										<button
											class="directive-tab mono {selectedSkillDirective === i ? 'active' : ''}"
											onclick={() => (selectedSkillDirective = i)}
										>
											{dir.title}
										</button>
									{/each}
								</div>

								<div class="directive-box">
									<div class="dir-prompt-row">
										<span class="dir-label mono">USER PROMPT:</span>
										<div class="dir-prompt mono">"{skillDirectives[selectedSkillDirective].prompt}"</div>
									</div>
									<div class="dir-action-row">
										<span class="dir-label mono">TOOL DISPATCH:</span>
										<div class="dir-action mono">{skillDirectives[selectedSkillDirective].action}</div>
									</div>
									<div class="dir-result-row">
										<span class="dir-label mono">AGENT OUTPUT:</span>
										<pre class="dir-result mono">{skillDirectives[selectedSkillDirective].result}</pre>
									</div>
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Right Minimap -->
			{#if viewMode === 'code'}
				<div class="code-minimap" aria-hidden="true">
					{#each (activeFile?.code || '').split('\n').slice(0, 85) as line, i (i)}
						<i style="width: {Math.min(100, line.length * 1.4)}%; opacity: {0.15 + (i % 5) * 0.09};"></i>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Terminal Prompt Footer -->
		{#if terminal}
			<div class="terminal-strip">
				<span class="terminal-prompt mono">~/pulsepay</span>
				<span class="terminal-cmd mono">$ {currentSnippet.installCmd}</span>
				<span class="terminal-status mono">
					<span class="dot-green"></span> RUNTIME TESTED &middot; ZERO DEPENDENCY LEAK
				</span>
			</div>
		{/if}

		<!-- Quick File Palette Modal (Ctrl+K) -->
		<Palette
			open={search}
			onclose={() => (search = false)}
			items={files.length > 0 ? files.map((file) => ({ label: file.path, value: file.path })) : sdkSnippets.map((s) => ({ label: s.filename, value: s.filename }))}
			onselect={selectRepoFile}
		/>
	</div>
</div>

<style>
	/* Scoped styles that guarantee the SDK studio looks world-class on all screen sizes */
	.window-decorations {
		display: flex;
		gap: 6px;
		padding-right: 12px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		display: inline-block;
	}
	.dot-close { background: #ff5f56; }
	.dot-min { background: #ffbd2e; }
	.dot-max { background: #27c93f; }

	.sdk-tab {
		border: 1px solid transparent;
		background: transparent;
		color: #98978c;
		font-family: var(--mono);
		font-size: 11px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 7px 12px;
		border-radius: 6px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		transition: all 0.15s ease;
		cursor: pointer;
	}
	.sdk-tab:hover {
		background: #2a2a26;
		color: #eae8df;
	}
	.sdk-tab.selected {
		background: #2f2f2a;
		color: #ffffff;
		border-color: #55554b;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
	}
	.tab-pill {
		font-size: 9px;
		padding: 2px 5px;
		border-radius: 4px;
		background: #1c1c1a;
		color: var(--orange, #f27b25);
		border: 1px solid #44443c;
	}

	.ide-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
	}

	.mode-switch {
		display: flex;
		background: #181816;
		border: 1px solid #3c3c35;
		border-radius: 6px;
		padding: 2px;
	}
	.mode-btn {
		background: transparent;
		border: 0;
		color: #8c8b82;
		font-family: var(--mono);
		font-size: 10px;
		text-transform: uppercase;
		padding: 5px 9px;
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		transition: all 0.15s ease;
	}
	.mode-btn:hover {
		color: #d8d6cc;
	}
	.mode-btn.active {
		background: #383832;
		color: #ffffff;
		font-weight: 600;
	}
	.mode-icon {
		font-size: 11px;
		color: var(--orange, #f27b25);
	}

	.tool-btn {
		background: #262622;
		border: 1px solid #3c3c35;
		color: #d4d2c7;
		font-family: var(--mono);
		font-size: 10px;
		text-transform: uppercase;
		padding: 6px 10px;
		border-radius: 6px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		transition: all 0.15s ease;
	}
	.tool-btn:hover {
		background: #363630;
		color: #ffffff;
	}
	.tool-btn.active {
		background: var(--orange, #f27b25);
		color: #191917;
		border-color: var(--orange, #f27b25);
		font-weight: 600;
	}

	.ide-subbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 7px 16px;
		background: #181816;
		border-bottom: 1px solid #34342d;
		font-size: 11px;
		gap: 12px;
	}
	.subbar-path {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.path-icon {
		font-size: 12px;
		opacity: 0.8;
	}
	.path-text {
		color: #e0ded4;
		font-size: 11px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.category-tag {
		font-size: 9px;
		background: #2b2b26;
		color: var(--orange, #f27b25);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid #434339;
		letter-spacing: 0.05em;
	}

	.subbar-meta {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
	}
	.install-pill {
		font-size: 10px;
		color: #a4a297;
		background: #111110;
		padding: 3px 8px;
		border-radius: 4px;
		border: 1px solid #2e2e28;
	}
	.install-prefix {
		color: var(--orange, #f27b25);
		margin-right: 4px;
	}
	.kbd-hint {
		background: transparent;
		border: 1px solid #424239;
		color: #8c8b82;
		font-size: 9px;
		padding: 2px 5px;
		border-radius: 3px;
		cursor: pointer;
	}
	.kbd-hint:hover {
		color: #ffffff;
		border-color: #66665a;
	}

	.ide-workspace.no-tree {
		grid-template-columns: minmax(0, 1fr) 55px;
	}
	.ide-workspace.with-tree {
		grid-template-columns: 240px minmax(0, 1fr) 55px;
	}

	.tree-header {
		font-size: 9px;
		color: #797870;
		padding: 4px 6px 8px;
		letter-spacing: 0.08em;
		border-bottom: 1px solid #33332b;
		margin-bottom: 8px;
	}

	.code-message {
		padding: 24px;
		color: #b0ada3;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.code-message.error {
		color: #ff8b80;
	}
	.retry-btn {
		background: #33332d;
		border: 1px solid #55554b;
		color: #ffffff;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
	}

	/* Live Simulation Styling */
	.sim-panel {
		flex: 1;
		padding: 20px 24px;
		overflow-y: auto;
		background: #181816;
		display: flex;
		flex-direction: column;
	}
	.sim-card {
		background: #1e1e1c;
		border: 1px solid #383831;
		border-radius: 10px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.sim-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #33332b;
		padding-bottom: 12px;
		flex-wrap: wrap;
		gap: 8px;
	}
	.sim-title {
		font-size: 11px;
		color: #e5e3d9;
		letter-spacing: 0.06em;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pulse-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #27c93f;
		box-shadow: 0 0 8px #27c93f;
		display: inline-block;
	}
	.sim-badge {
		font-size: 9px;
		background: #2b2b26;
		color: #c7c5b9;
		padding: 3px 7px;
		border-radius: 4px;
		border: 1px solid #434339;
	}

	/* React Checkout Preview */
	.checkout-box-inner {
		background: #151513;
		border: 1px solid #3a3a33;
		border-radius: 8px;
		padding: 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.checkout-brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.mark-icon {
		font-size: 20px;
		color: var(--orange, #f27b25);
	}
	.checkout-brand h4 {
		margin: 0;
		font-size: 16px;
		font-weight: 500;
		color: #ffffff;
	}
	.text-muted {
		color: #8c8b82;
		font-size: 10px;
		margin-top: 3px;
	}

	.checkout-amount-display {
		background: #1a1a17;
		border: 1px solid #33332b;
		border-radius: 6px;
		padding: 14px 16px;
	}
	.amount-label {
		font-size: 9px;
		color: #797870;
		letter-spacing: 0.08em;
	}
	.amount-val {
		font-size: 32px;
		font-weight: 600;
		color: #ffffff;
		margin: 4px 0;
	}
	.amount-val .currency {
		font-size: 14px;
		color: var(--orange, #f27b25);
		font-weight: 400;
		vertical-align: middle;
		margin-right: 4px;
	}
	.amount-note {
		font-size: 10px;
		color: #9c9a8f;
	}

	.sim-action-btn {
		width: 100%;
		padding: 12px;
		border-radius: 6px;
		font-family: var(--mono);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		transition: all 0.18s ease;
		border: 0;
	}
	.sim-action-btn.primary {
		background: var(--orange, #f27b25);
		color: #151513;
		font-weight: 600;
	}
	.sim-action-btn.primary:hover {
		background: #ff8c3b;
		transform: translateY(-1px);
	}
	.sim-action-btn.pending {
		background: #33332c;
		color: #e5e3d9;
		cursor: wait;
	}
	.sim-action-btn.secondary {
		background: #2b2b26;
		color: #ffffff;
		border: 1px solid #434339;
	}
	.sim-action-btn.secondary:hover {
		background: #3b3b34;
	}
	.sim-action-btn.small {
		width: auto;
		padding: 6px 12px;
		font-size: 10px;
	}

	.settled-banner {
		background: #142817;
		border: 1px solid #25582c;
		border-radius: 6px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.settled-status {
		color: #4ade80;
		font-size: 11px;
		font-weight: 600;
	}
	.settled-hash {
		color: #bbf7d0;
		font-size: 10px;
		word-break: break-all;
	}
	.settled-actions {
		display: flex;
		gap: 16px;
		margin-top: 6px;
	}
	.explorer-link {
		color: var(--orange, #f27b25);
		font-size: 10px;
		text-decoration: underline;
	}
	.reset-link {
		background: transparent;
		border: 0;
		color: #8c8b82;
		font-size: 10px;
		cursor: pointer;
		text-decoration: underline;
	}

	.sim-specs-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 10px;
		border-top: 1px solid #2e2e28;
		padding-top: 14px;
	}
	.spec-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.spec-label {
		font-size: 8px;
		color: #797870;
	}
	.spec-val {
		font-size: 10px;
		color: #d8d6cc;
	}

	/* Server Handshake Steps */
	.handshake-steps {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.step-card {
		display: flex;
		gap: 14px;
		background: #161614;
		border: 1px solid #2e2e27;
		border-radius: 6px;
		padding: 12px 14px;
		opacity: 0.45;
		transition: all 0.25s ease;
	}
	.step-card.active {
		opacity: 1;
		border-color: #555547;
		background: #1c1c19;
	}
	.step-num {
		font-size: 9px;
		color: var(--orange, #f27b25);
		background: #2b2b25;
		padding: 3px 6px;
		border-radius: 4px;
		height: fit-content;
	}
	.step-content {
		flex: 1;
		min-width: 0;
	}
	.step-head {
		font-size: 11px;
		color: #e5e3d9;
		margin-bottom: 4px;
	}
	.step-code {
		font-size: 10px;
		color: #9c9a8f;
		word-break: break-all;
	}
	.step-code.success {
		color: #86efac;
	}
	.http-verb.get { color: #60a5fa; font-weight: 600; }
	.http-verb.post { color: #34d399; font-weight: 600; }
	.http-status.warn { color: #fbbf24; font-weight: 600; }
	.http-status.ok { color: #4ade80; font-weight: 600; }
	.header-key { color: var(--orange, #f27b25); }

	/* Agent Terminal Window */
	.terminal-log-window {
		background: #121210;
		border: 1px solid #2c2c26;
		border-radius: 6px;
		padding: 14px 16px;
		font-size: 11px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 220px;
		overflow-y: auto;
	}
	.log-line {
		display: flex;
		gap: 8px;
		color: #c8c6bc;
	}
	.log-prompt {
		color: var(--orange, #f27b25);
	}
	.agent-guardrails-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.guard-pill {
		flex: 1;
		min-width: 140px;
		background: #161614;
		border: 1px solid #33332b;
		padding: 8px 10px;
		border-radius: 4px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.guard-name {
		font-size: 8px;
		color: #797870;
	}
	.guard-status.pass {
		font-size: 10px;
		color: #4ade80;
	}

	/* Contract Split Calculator */
	.calc-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		background: #151513;
		padding: 12px 14px;
		border-radius: 6px;
		border: 1px solid #2e2e28;
	}
	.calc-label {
		font-size: 10px;
		color: #a4a297;
	}
	.calc-input-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.calc-input {
		background: #242420;
		border: 1px solid #4a4a40;
		color: #ffffff;
		font-size: 14px;
		padding: 5px 8px;
		border-radius: 4px;
		width: 100px;
		text-align: right;
	}
	.calc-unit {
		font-size: 11px;
		color: var(--orange, #f27b25);
	}

	.split-visual-bar {
		display: flex;
		height: 24px;
		border-radius: 4px;
		overflow: hidden;
		font-family: var(--mono);
		font-size: 9px;
		line-height: 24px;
		text-align: center;
		color: #121210;
		font-weight: 600;
		margin: 12px 0;
	}
	.bar-slice.merchant { background: #4ade80; }
	.bar-slice.reserve { background: #60a5fa; color: #ffffff; }
	.bar-slice.fee { background: var(--orange, #f27b25); color: #ffffff; }

	.split-breakdown-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 10px;
	}
	.breakdown-card {
		background: #161614;
		border: 1px solid #33332b;
		border-radius: 6px;
		padding: 10px 12px;
	}
	.bd-title {
		font-size: 8px;
		color: #797870;
	}
	.bd-val {
		font-size: 15px;
		font-weight: 600;
		color: #ffffff;
		margin: 3px 0;
	}
	.bd-val.highlight {
		color: #4ade80;
	}
	.bd-note {
		font-size: 9px;
		color: #8c8b82;
	}

	.contract-features-list {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		border-top: 1px solid #2e2e28;
		padding-top: 12px;
	}
	.feat-tag {
		font-size: 9px;
		background: #171715;
		border: 1px solid #383830;
		padding: 3px 7px;
		border-radius: 4px;
		color: #a4a297;
	}

	/* Skill Directive Tester */
	.skill-tabs-row {
		display: flex;
		gap: 6px;
	}
	.directive-tab {
		background: #181816;
		border: 1px solid #33332c;
		color: #8c8b82;
		font-size: 10px;
		padding: 6px 10px;
		border-radius: 4px;
		cursor: pointer;
	}
	.directive-tab.active {
		background: #2e2e28;
		color: #ffffff;
		border-color: #555549;
	}
	.directive-box {
		background: #151513;
		border: 1px solid #2e2e28;
		border-radius: 6px;
		padding: 14px;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.dir-prompt-row, .dir-action-row, .dir-result-row {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.dir-label {
		font-size: 8px;
		color: #797870;
	}
	.dir-prompt {
		font-size: 11px;
		color: #ffffff;
		font-style: italic;
	}
	.dir-action {
		font-size: 11px;
		color: var(--orange, #f27b25);
	}
	.dir-result {
		margin: 0;
		background: #10100f;
		border: 1px solid #282823;
		border-radius: 4px;
		padding: 8px 10px;
		font-size: 10px;
		color: #86efac;
		overflow-x: auto;
	}

	/* Footer terminal strip */
	.terminal-status {
		margin-left: auto;
		color: #7e7d75;
		font-size: 9px;
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.dot-green {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #27c93f;
		display: inline-block;
	}

	.spinner-small {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-top-color: #ffffff;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		display: inline-block;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (max-width: 900px) {
		.ide-subbar { flex-direction: column; align-items: flex-start; gap: 6px; }
		.subbar-meta { width: 100%; justify-content: space-between; }
		.ide-actions { flex-wrap: wrap; }
		.ide-workspace.no-tree, .ide-workspace.with-tree {
			grid-template-columns: minmax(0, 1fr);
		}
		.code-minimap { display: none; }
	}
</style>
