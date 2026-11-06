import { getSourceFiles } from '$lib/source';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const path = params.path;
	const files = await getSourceFiles();
	const file = files.find((f) => f.path === path);
	if (!file) {
		return new Response(JSON.stringify({ error: 'Source file not found.' }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		});
	}
	return new Response(JSON.stringify(file), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

