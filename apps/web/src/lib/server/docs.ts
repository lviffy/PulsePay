import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalog, headingId, type Doc } from '$lib/docs';

export { catalog, headingId, type Doc };

const docCache = new Map<string, any>();

export async function getDoc(slug: string) {
	if (docCache.has(slug)) return docCache.get(slug);
	const entry = catalog.find((doc) => doc.slug === slug);
	if (!entry) return null;
	const markdown = await readFile(resolve(process.cwd(), 'content/docs', `${entry.slug}.md`), 'utf8');
	const toc = Array.from(markdown.matchAll(/^## (.+)$/gm), (match) => ({
		label: match[1],
		id: headingId(match[1])
	}));
	const result = { ...entry, markdown, toc };
	docCache.set(slug, result);
	return result;
}

