import { getDoc } from '$lib/server/docs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const rawSlug = params.slug || 'introduction';
	let slug = rawSlug.replace(/\.md$/, '');
	if (slug === 'skills' || slug === 'skill' || slug === 'agent-skills') {
		slug = 'skills/pulsepay';
	}
	const doc = await getDoc(slug);
	if (!doc) {
		return new Response('# 404\nDocumentation page not found.', {
			status: 404,
			headers: { 'Content-Type': 'text/markdown; charset=utf-8' }
		});
	}
	return new Response(`# ${doc.title}\n\n${doc.lede}\n\n${doc.markdown}`, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			Vary: 'Accept'
		}
	});
};

