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
			command: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay',
			targetDir: 'Auto-detects active agent (.agents, .claude, .cursor)',
			note: 'Universal installer. Detects your coding tool and places the skill in the appropriate directory.'
		},
		{
			id: 'claude',
			label: 'Claude Code',
			command: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a claude-code',
			targetDir: '.claude/skills/pulsepay/SKILL.md',
			note: 'Native Claude Code skill. Trigger with /pulsepay or ask Claude to handle Whitechain, Chainlink CCIP, or Hedera payments.'
		},
		{
			id: 'cursor',
			label: 'Cursor',
			command: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a cursor',
			targetDir: '.cursor/skills/pulsepay/SKILL.md',
			note: 'Integrates with Cursor Composer and Chat. Automatically gives Cursor context for PulsePay APIs and contracts.'
		},
		{
			id: 'windsurf',
			label: 'Windsurf',
			command: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a windsurf',
			targetDir: '.windsurf/skills/pulsepay/SKILL.md',
			note: 'Empowers Cascade agent with full knowledge of PulsePay merchant invoicing, treasury guard, and x402 tools.'
		},
		{
			id: 'antigravity',
			label: 'Antigravity',
			command: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a antigravity',
			targetDir: '.agents/skills/pulsepay/SKILL.md',
			note: 'Standard Antigravity skill format. Works with Antigravity IDE and agy CLI subagent workflows.'
		},
		{
			id: 'copilot',
			label: 'GitHub Copilot',
			command: 'npx skills add https://github.com/lviffy/ETHGLOBAL --skill pulsepay -a copilot',
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
		color: var(--ink);
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		margin: 28px 0 40px;
		min-width: 0;
	}
	.skill-header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 18px 0;
		border-bottom: 1px solid var(--rule);
	}
	.skill-title { color: var(--muted); font-size: 9px; letter-spacing: .1em; }
	.skill-tabs-nav { display: flex; max-width: 100%; gap: 4px; overflow-x: auto; }
	.skill-tab-btn {
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
	.skill-tab-btn:hover { background: var(--soft); color: var(--ink); }
	.skill-tab-btn.active { background: var(--ink); color: var(--cream); }
	.skill-terminal { padding: 18px 0; }
	.terminal-body { display: flex; align-items: center; gap: 12px; min-width: 0; }
	.terminal-prompt { color: var(--muted); user-select: none; }
	.terminal-code {
		flex: 1;
		min-width: 0;
		font-size: 12px;
		letter-spacing: 0;
		text-transform: none;
		overflow-wrap: anywhere;
	}
	.terminal-copy-btn {
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
	.terminal-copy-btn:hover { background: var(--soft); transform: translateY(-2px); }
	.terminal-copy-btn:active { transform: translateY(1px); }
	.terminal-meta {
		margin-top: 14px;
		display: grid;
		gap: 8px;
		color: var(--muted);
		font-size: 10px;
		letter-spacing: .025em;
		text-transform: none;
		line-height: 1.7;
	}
	.meta-item { display: flex; flex-wrap: wrap; gap: 8px; }
	.meta-label { text-transform: uppercase; font-size: 9px; }
	.meta-val { color: var(--ink); overflow-wrap: anywhere; min-width: 0; }
	@media (max-width: 640px) {
		.skill-header { align-items: flex-start; gap: 14px; }
		.skill-tabs-nav { width: 100%; }
		.terminal-code { font-size: 11px; }
		.terminal-body { flex-wrap: wrap; }
		.terminal-copy-btn { margin-left: auto; }
	}
</style>
