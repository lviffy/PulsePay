import { getSourceFiles } from '$lib/source';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const allFiles = await getSourceFiles();
	const initial =
		allFiles.find((f) => f.path === 'packages/sdk-react/examples/checkout-page.tsx') || allFiles[0];

	return {
		files: allFiles.map((f) => ({ path: f.path })),
		initial
	};
};

