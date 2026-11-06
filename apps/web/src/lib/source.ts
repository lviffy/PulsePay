import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';
import { codeToHtml } from 'shiki';
import { syntaxTheme } from './highlight';

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

	async function walk(directory: string): Promise<string[]> {
		const fullDir = resolve(repoRoot, directory);
		if (!existsSync(fullDir)) return [];
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
	}

	const basePaths = [
		'README.md',
		'PulsePay_ETHGlobal_Mumbai_PRD.md',
		...(await walk('packages')),
		...(await walk('contracts/whitechain/src')),
		...(await walk('contracts/uniswap-v4/src')),
		'apps/agent-worker/src/index.ts',
		'skills/pulsepay/SKILL.md'
	];

	const validPaths = basePaths.filter((p) => existsSync(resolve(repoRoot, p)));

	cachedFiles = await Promise.all(
		validPaths.map(async (path) => {
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
		})
	);

	return cachedFiles;
}

