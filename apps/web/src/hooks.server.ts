import type { Handle } from '@sveltejs/kit/hooks';

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (
		path.startsWith('/docs') &&
		(event.request.headers.get('accept')?.includes('text/markdown') || path.endsWith('.md'))
	) {
		const targetSlug = path.replace(/^\/docs\/?/, '').replace(/\.md$/, '') || 'introduction';
		return event.fetch(`/markdown/${targetSlug}`);
	}
	const response = await resolve(event);
	response.headers.set('Vary', 'Accept');
	return response;
};

