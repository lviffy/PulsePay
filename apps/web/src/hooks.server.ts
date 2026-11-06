import { getDoc } from '$lib/server/docs';
import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (
		path.startsWith('/docs') &&
		(event.request.headers.get('accept')?.includes('text/markdown') || path.endsWith('.md'))
	) {
		let targetSlug = path.replace(/^\/docs\/?/, '').replace(/\.md$/, '') || 'introduction';
		if (targetSlug === 'skills' || targetSlug === 'skill' || targetSlug === 'agent-skills') {
			targetSlug = 'skills/pulsepay';
		}
		const doc = await getDoc(targetSlug);
		if (!doc) {
			return new Response('# 404\nDocumentation page not found.', {
				status: 404,
				headers: {
					'Content-Type': 'text/markdown; charset=utf-8',
					Vary: 'Accept'
				}
			});
		}
		return new Response(`# ${doc.title}\n\n${doc.lede}\n\n${doc.markdown}`, {
			headers: {
				'Content-Type': 'text/markdown; charset=utf-8',
				Vary: 'Accept'
			}
		});
	}
	const response = await resolve(event);
	response.headers.set('Vary', 'Accept');
	return response;
};

