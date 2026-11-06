import { error } from '@sveltejs/kit';
import { getDoc, catalog } from '$lib/server/docs';
import { renderMarkdown } from '$lib/markdown';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const cleanSlug = 'introduction';
	const doc = await getDoc(cleanSlug);
	if (!doc) {
		throw error(404, 'Documentation page not found.');
	}
	const html = await renderMarkdown(doc.markdown);
	const at = catalog.findIndex((item) => item.slug === cleanSlug);
	const prev = catalog[at - 1] || null;
	const next = catalog[at + 1] || null;

	return {
		doc,
		html,
		prev,
		next,
		slug: cleanSlug
	};
};
