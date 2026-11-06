import { readActivities, errorMessage, publicConfig } from '$lib/chain';
import { formatAccountantCsv } from '@pulsepay/shared';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const merchant = url.searchParams.get('merchant') || publicConfig().merchant;
		const before = url.searchParams.get('before') || undefined;
		const rows = await readActivities(merchant, before);
		return new Response(formatAccountantCsv(rows), {
			headers: {
				'Content-Type': 'text/csv; charset=utf-8',
				'Content-Disposition': `attachment; filename="pulsepay-whitechain-${new Date().toISOString().slice(0, 10)}.csv"`,
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

