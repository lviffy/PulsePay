<script lang="ts">
	interface ToolTab {
		id: string;
		label: string;
		command: string;
		targetDir: string;
		note: string;
	}

	const tabs: ToolTab[] = [
		{
			id: 'universal',
			label: 'Universal (npx skills)',
			command: 'npx skills add https://github.com/lviffy/PulsePay --skill pulsepay',
			targetDir: 'Auto-detects active agent (.agents, .claude, .cursor)',
			note: 'Universal installer. Detects your coding tool and places the skill in the appropriate directory.'
		},
		{
			id: 'claude',
			label: 'Claude Code',
			command: 'npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a claude-code',
			targetDir: '.claude/skills/pulsepay/SKILL.md',
			note: 'Native Claude Code skill. Trigger with /pulsepay or ask Claude to handle Whitechain, Chainlink CCIP, or Hedera payments.'
		},
		{
			id: 'cursor',
			label: 'Cursor',
			command: 'npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a cursor',
			targetDir: '.cursor/skills/pulsepay/SKILL.md',
			note: 'Integrates with Cursor Composer and Chat. Automatically gives Cursor context for PulsePay APIs and contracts.'
		},
		{
			id: 'windsurf',
			label: 'Windsurf',
			command: 'npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a windsurf',
			targetDir: '.windsurf/skills/pulsepay/SKILL.md',
			note: 'Empowers Cascade agent with full knowledge of PulsePay merchant invoicing, treasury guard, and x402 tools.'
		},
		{
			id: 'antigravity',
			label: 'Antigravity',
			command: 'npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a antigravity',
			targetDir: '.agents/skills/pulsepay/SKILL.md',
			note: 'Standard Antigravity skill format. Works with Antigravity IDE and agy CLI subagent workflows.'
		},
		{
			id: 'copilot',
			label: 'GitHub Copilot',
			command: 'npx skills add https://github.com/lviffy/PulsePay --skill pulsepay -a copilot',
			targetDir: '.github/skills/pulsepay/SKILL.md',
			note: 'Equips GitHub Copilot agent mode with PulsePay contracts, schemas, and integration patterns.'
		}
	];

	let activeTab = $state('universal');
	const current = $derived(tabs.find((t) => t.id === activeTab) || tabs[0]);

	let copied = $state(false);

	async function copyCommand() {
		try {
			await navigator.clipboard.writeText(current.command);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch {
			// fallback
		}
	}
</script>

<div class="skill-widget" aria-label="NPX Skill Installer">
	<div class="skill-header">
		<div class="skill-title mono">
			<span class="status-pulse"></span>
			<span>Agent Skill Installer / NPX</span>
		</div>
		<div class="skill-tabs-nav" role="tablist" aria-label="Coding Tool Selector">
			{#each tabs as tab (tab.id)}
				<button
					role="tab"
					class="skill-tab-btn {activeTab === tab.id ? 'active' : ''}"
					aria-selected={activeTab === tab.id}
					onclick={() => (activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="skill-terminal" role="tabpanel">
		<div class="terminal-body">
			<span class="terminal-prompt mono">$</span>
			<code class="terminal-code mono">{current.command}</code>
			<button
				class="terminal-copy-btn mono"
				onclick={copyCommand}
				aria-label="Copy install command"
			>
				{copied ? 'Copied ✓' : 'Copy'}
			</button>
		</div>
		<div class="terminal-meta mono">
			<div class="meta-item">
				<span class="meta-label">Target:</span>
				<span class="meta-val">{current.targetDir}</span>
			</div>
			<div class="meta-note">{current.note}</div>
		</div>
	</div>
</div>

<style>
	.skill-widget {
		background: var(--ink);
		color: var(--cream);
		border: 1px solid #3e3e37;
		border-radius: 12px;
		margin: 28px 0 40px;
		overflow: hidden;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
	}

	.skill-header {
		padding: 14px 18px 0;
		border-bottom: 1px solid #42423a;
		background: #191917;
	}

	.skill-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #b4b3a6;
		margin-bottom: 12px;
	}

	.status-pulse {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--orange);
		box-shadow: 0 0 8px var(--orange);
		display: inline-block;
	}

	.skill-tabs-nav {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		scrollbar-width: none;
		margin-bottom: -1px;
	}

	.skill-tabs-nav::-webkit-scrollbar {
		display: none;
	}

	.skill-tab-btn {
		font-family: var(--mono);
		font-size: 10px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 9px 14px;
		background: transparent;
		color: #a4a396;
		border: 1px solid transparent;
		border-bottom: 2px solid transparent;
		border-radius: 6px 6px 0 0;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s ease;
	}

	.skill-tab-btn:hover {
		color: var(--cream);
		background: #2a2a26;
	}

	.skill-tab-btn.active {
		color: var(--cream);
		background: var(--ink);
		border-color: #42423a #42423a transparent;
		border-bottom: 2px solid var(--orange);
		font-weight: 500;
	}

	.skill-terminal {
		padding: 20px 22px;
		background: var(--ink);
	}

	.terminal-body {
		display: flex;
		align-items: center;
		gap: 12px;
		background: #141412;
		border: 1px solid #33332c;
		border-radius: 6px;
		padding: 14px 18px;
	}

	.terminal-prompt {
		color: var(--orange);
		font-size: 14px;
		font-weight: bold;
		user-select: none;
	}

	.terminal-code {
		flex: 1;
		font-size: 13px;
		color: var(--cream);
		word-break: break-all;
	}

	.terminal-copy-btn {
		background: #2e2e28;
		color: var(--cream);
		border: 1px solid #4a4a40;
		border-radius: 4px;
		padding: 7px 14px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.terminal-copy-btn:hover {
		background: var(--orange);
		color: #000;
		border-color: var(--orange);
	}

	.terminal-meta {
		margin-top: 14px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 11px;
	}

	.meta-item {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #bab9ad;
	}

	.meta-label {
		color: #7a796e;
		text-transform: uppercase;
		font-size: 10px;
	}

	.meta-val {
		color: #e5e3d8;
		background: #1f1f1b;
		padding: 2px 7px;
		border-radius: 3px;
		border: 1px solid #383830;
	}

	.meta-note {
		color: #8f8e83;
		font-size: 11px;
		line-height: 1.5;
	}

	@media (max-width: 768px) {
		.terminal-body {
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
		}

		.terminal-copy-btn {
			align-self: flex-end;
		}
	}
</style>

