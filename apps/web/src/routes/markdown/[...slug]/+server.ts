import { getDoc } from '$lib/docs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const slug = params.slug || 'introduction';
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

