import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';
import { codeToHtml } from 'shiki';
import { syntaxTheme } from './highlight';
import { sdkSnippets } from './sdk-snippets';

export type SourceFile = { path: string; code: string; html: string };

function findRepoRoot(): string {
	let curr = process.cwd();
	for (let i = 0; i < 5; i++) {
		if (existsSync(resolve(curr, 'pnpm-workspace.yaml'))) {
			return curr;
		}
		curr = resolve(curr, '..');
	}
	return resolve(process.cwd(), '../..');
}

export const repoRoot = findRepoRoot();
const ignored = new Set(['node_modules', 'dist', 'lib', 'out', 'cache', 'broadcast', '.git', '.next', '.svelte-kit']);

let cachedFiles: SourceFile[] | null = null;

export async function getSourceFiles(): Promise<SourceFile[]> {
	if (cachedFiles) return cachedFiles;

	const fallbackFiles: SourceFile[] = sdkSnippets.map((s) => ({
		path: s.filename,
		code: s.code,
		html: s.html
	}));

	async function walk(directory: string): Promise<string[]> {
		const fullDir = resolve(repoRoot, directory);
		if (!existsSync(fullDir)) return [];
		try {
			const entries = await readdir(fullDir, { withFileTypes: true });
			const files = await Promise.all(
				entries
					.filter((entry) => !ignored.has(entry.name))
					.map(async (entry) => {
						const path = `${directory}/${entry.name}`;
						return entry.isDirectory() ? walk(path) : /\.(ts|tsx|sol|md)$/.test(path) ? [path] : [];
					})
			);
			return files.flat();
		} catch {
			return [];
		}
	}

	try {
		const basePaths = [
			'README.md',
			'PulsePay_ETHGlobal_Mumbai_PRD.md',
			...(await walk('packages')),
			...(await walk('contracts/whitechain/src')),
			'apps/agent-worker/src/index.ts',
			'skills/pulsepay/SKILL.md'
		];

		const validPaths = basePaths.filter((p) => existsSync(resolve(repoRoot, p)));

		if (validPaths.length === 0) {
			cachedFiles = fallbackFiles;
			return cachedFiles;
		}

		const loaded = await Promise.all(
			validPaths.map(async (path) => {
				try {
					const code = await readFile(resolve(repoRoot, path), 'utf8');
					const lang =
						({
							'.ts': 'typescript',
							'.tsx': 'tsx',
							'.sol': 'solidity',
							'.md': 'markdown'
						} as Record<string, string>)[extname(path)] || 'text';
					return {
						path: relative(repoRoot, resolve(repoRoot, path)),
						code,
						html: await codeToHtml(code, { lang, theme: syntaxTheme })
					};
				} catch {
					return null;
				}
			})
		);

		const validLoaded = loaded.filter((f): f is SourceFile => f !== null);

		// Ensure fallback snippets exist in the list if they weren't found on disk
		for (const fallback of fallbackFiles) {
			if (!validLoaded.some((f) => f.path === fallback.path)) {
				validLoaded.push(fallback);
			}
		}

		cachedFiles = validLoaded;
	} catch {
		cachedFiles = fallbackFiles;
	}

	return cachedFiles;
}


