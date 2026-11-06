<script lang="ts">
	import { onMount } from 'svelte';
	import type { SourceFile } from '$lib/source';
	import CopyButton from './CopyButton.svelte';
	import Palette from './Palette.svelte';
	import { gsap } from '$lib/motion';

	interface Props {
		files: Pick<SourceFile, 'path'>[];
		initial: SourceFile;
		pinned?: boolean;
	}

	let { files, initial, pinned = false }: Props = $props();

	const tabs = ['React', 'Server', 'Agent', 'Contracts', 'Skill'];
	const defaults = [
		'packages/sdk-react/examples/checkout-page.tsx',
		'packages/sdk-server/src/x402.ts',
		'apps/agent-worker/src/index.ts',
		'contracts/whitechain/src/PulsePayMerchantHub.sol',
		'skills/pulsepay/SKILL.md'
	];

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

	let selected = $state(defaults[0]);
	let terminal = $state(true);
	let search = $state(false);
	let currentFile = $state<SourceFile | null>(null);
	const activeFile = $derived(currentFile ?? initial);
	let loading = $state(false);
	let error = $state<string | null>(null);

	const nodes = $derived(buildTree(files));

	let scope = $state<HTMLDivElement | null>(null);
	let stage = $state<HTMLDivElement | null>(null);
	let content = $state<HTMLDivElement | null>(null);
	const fileCache = new Map<string, SourceFile>();

	async function selectFile(path: string) {
		selected = path;
		if (path === initial.path) {
			currentFile = initial;
			error = null;
			return;
		}
		if (fileCache.has(path)) {
			currentFile = fileCache.get(path)!;
			error = null;
			return;
		}
		loading = true;
		error = null;
		try {
			const res = await fetch(`/source/${path}`);
			if (!res.ok) throw new Error('Source file not found.');
			const data = await res.json();
			fileCache.set(path, data);
			currentFile = data;
		} catch (err: any) {
			error = err.message || 'Source read failed.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (initial) fileCache.set(initial.path, initial);

		const prefetchTimer = setTimeout(() => {
			defaults.forEach(async (path) => {
				if (!fileCache.has(path)) {
					try {
						const res = await fetch(`/source/${path}`);
						if (res.ok) fileCache.set(path, await res.json());
					} catch {}
				}
			});
		}, 800);

		const handleKey = (e: KeyboardEvent) => {
			if (!(e.ctrlKey || e.metaKey) || !['k', 'j'].includes(e.key.toLowerCase())) return;
			const bounds = scope?.getBoundingClientRect();
			if (!bounds || bounds.bottom < 0 || bounds.top > window.innerHeight) return;
			e.preventDefault();
			if (e.key.toLowerCase() === 'k') {
				search = !search;
			} else {
				terminal = !terminal;
			}
		};
		window.addEventListener('keydown', handleKey);

		let mm: gsap.MatchMedia | undefined;
		if (pinned && scope && stage) {
			mm = gsap.matchMedia();
			mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
				gsap.timeline({
					scrollTrigger: {
						trigger: stage, start: 'top 24px', end: () => `+=${window.innerHeight * 2}`,
						pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true
					}
				})
					.to(scope, {
						width: () => document.documentElement.clientWidth,
						height: () => window.innerHeight,
						x: () => -stage!.getBoundingClientRect().left,
						y: -24, borderRadius: 0, duration: 0.3, ease: 'power2.inOut'
					})
					.to({}, { duration: 0.4 })
					.to(scope, {
						width: () => stage!.clientWidth,
						height: () => stage!.clientHeight,
						x: 0, y: 0, borderRadius: 14, duration: 0.3, ease: 'power2.inOut'
					});
			});
		}

		return () => {
			clearTimeout(prefetchTimer);
			window.removeEventListener('keydown', handleKey);
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
	<div class="ide-toolbar">
		<div class="ide-tabs" role="tablist" aria-label="SDK source track">
			{#each tabs as tab, i (tab)}
				<button
					role="tab"
					aria-selected={selected === defaults[i]}
					onclick={() => selectFile(defaults[i])}
				>
					{tab}
				</button>
			{/each}
		</div>
		<span class="mono ide-caption">This is the actual SDK.</span>
		<div class="ide-keys">
			<button onclick={() => (terminal = !terminal)} aria-label="Ctrl J: toggle terminal">
				CTRL J
			</button>
			<button onclick={() => (search = true)} aria-label="Ctrl K: search repository">
				CTRL K
			</button>
		</div>
	</div>

	<div class="ide-workspace">
		<aside class="file-tree" data-lenis-prevent aria-label="Repository files">
			<ul role="tree">
				{#each nodes as node (node.path)}
					{#if node.file}
						<li role="none">
							<button
								role="treeitem"
								aria-selected={selected === node.path}
								class={selected === node.path ? 'selected' : ''}
								onclick={() => selectFile(node.path)}
								title={node.path}
							>
								<span class="file-icon">⌑</span>{node.name}
							</button>
						</li>
					{:else}
						<li role="none">
							<details open={selected.startsWith(`${node.path}/`) || node.path === 'packages'}>
								<summary role="treeitem" aria-selected="false">{node.name}</summary>
								<ul role="group">
									{#each node.children as child (child.path)}
										{#if child.file}
											<li role="none">
												<button
													role="treeitem"
													aria-selected={selected === child.path}
													class={selected === child.path ? 'selected' : ''}
													onclick={() => selectFile(child.path)}
													title={child.path}
												>
													<span class="file-icon">⌑</span>{child.name}
												</button>
											</li>
										{:else}
											<li role="none">
												<details open={selected.startsWith(`${child.path}/`)}>
													<summary role="treeitem" aria-selected="false">{child.name}</summary>
													<ul role="group">
														{#each child.children as subchild (subchild.path)}
															<li role="none">
																<button
																	role="treeitem"
																	aria-selected={selected === subchild.path}
																	class={selected === subchild.path ? 'selected' : ''}
																	onclick={() => selectFile(subchild.path)}
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

		<div id="source-viewer" class="source-viewer" role="tabpanel">
			<div class="file-heading">
				<span>{selected}</span>
				{#if activeFile}
					<CopyButton text={activeFile.code} />
				{/if}
				{#if error}
					<button class="copy-button" onclick={() => selectFile(selected)}>Retry</button>
				{/if}
			</div>
			<div
				class="code-content"
				bind:this={content}
				tabindex="0"
				data-lenis-prevent
			>
				{#if loading}
					<p>Loading real source…</p>
				{:else if error}
					<p>Source read failed. Select the file again to retry.</p>
				{:else if activeFile}
					{@html activeFile.html}
				{/if}
			</div>
		</div>

		<div class="code-minimap" aria-hidden="true">
			{#each (activeFile?.code || '').split('\n').slice(0, 85) as line, i (i)}
				<i style="width: {Math.min(100, line.length * 1.4)}%; opacity: {0.15 + (i % 5) * 0.09};"></i>
			{/each}
		</div>
	</div>

	{#if terminal}
		<div class="terminal-strip">
			<span class="terminal-prompt">~/pulsepay</span> $ pnpm --filter @pulsepay/sdk-react build
			<span class="terminal-note">SOURCE / READ ONLY</span>
		</div>
	{/if}

	<Palette
		open={search}
		onclose={() => (search = false)}
		items={files.map((file) => ({ label: file.path, value: file.path }))}
		onselect={selectFile}
	/>
</div>
</div>

