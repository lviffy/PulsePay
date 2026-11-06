import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalog, headingId, type Doc } from '$lib/docs';

export { catalog, headingId, type Doc };

const docCache = new Map<string, any>();

function resolveDocsDir(): string {
	const candidates = [
		resolve(process.cwd(), 'content/docs'),
		resolve(process.cwd(), 'apps/web/content/docs'),
		resolve(import.meta.dirname, '../../../content/docs')
	];
	for (const candidate of candidates) {
		if (existsSync(candidate)) return candidate;
	}
	return resolve(process.cwd(), 'content/docs');
}

const docsDir = resolveDocsDir();

export async function getDoc(slug: string) {
	if (docCache.has(slug)) return docCache.get(slug);
	const entry = catalog.find((doc) => doc.slug === slug);
	if (!entry) return null;
	const filePath = resolve(docsDir, `${entry.slug}.md`);
	if (!existsSync(filePath)) {
		return null;
	}
	const markdown = await readFile(filePath, 'utf8');
	const toc = Array.from(markdown.matchAll(/^## (.+)$/gm), (match) => ({
		label: match[1],
		id: headingId(match[1])
	}));
	const result = { ...entry, markdown, toc };
	docCache.set(slug, result);
	return result;
}

