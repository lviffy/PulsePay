import { CCIPMessageMonitor } from '@pulsepay/adapter-ccip';
import { stringify, errorMessage } from '$lib/chain';
import type { RequestHandler } from './$types';

const monitor = new CCIPMessageMonitor();
export const GET: RequestHandler = async ({ url, request }) => {
	const id = url.searchParams.get('messageId') || '';
	if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return new Response(stringify({ error: 'messageId must be bytes32' }), { status: 400 });
	try {
		return new Response(stringify(await monitor.getStatus(id, request.signal)), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
		});
	} catch (error) {
		return new Response(stringify({ error: errorMessage(error) }), { status: 502 });
	}
};
