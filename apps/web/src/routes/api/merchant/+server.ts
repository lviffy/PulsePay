import { readMerchant, errorMessage, stringify, publicConfig } from '$lib/chain';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const merchant = url.searchParams.get('merchant') || publicConfig().merchant;
		const before = url.searchParams.get('before') || undefined;
		const data = await readMerchant(merchant, before);
		return new Response(stringify(data), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': 'no-store'
			}
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: errorMessage(error) }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

