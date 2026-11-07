import { getSourceFiles } from '$lib/source';
import { sdkSnippets } from '$lib/sdk-snippets';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const path = params.path;
	const files = await getSourceFiles();
	let file = files.find((f) => f.path === path);

	if (!file) {
		const snippet = sdkSnippets.find((s) => s.filename === path);
		if (snippet) {
			file = {
				path: snippet.filename,
				code: snippet.code,
				html: snippet.html
			};
		}
	}

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


