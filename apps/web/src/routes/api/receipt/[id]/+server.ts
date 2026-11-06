import { chainClient, errorMessage, stringify } from '$lib/chain';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const id = params.id;
		if (!/^0x[a-fA-F0-9]{64}$/.test(id)) {
			return new Response(JSON.stringify({ error: 'Invoice ID must be a bytes32 hex value.' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		const client = chainClient();
		const [invoice, payment] = await Promise.all([
			client.invoices.get(id as `0x${string}`),
			client.payments.get(id as `0x${string}`)
		]);
		if (!invoice || !payment) {
			return new Response(
				JSON.stringify({ error: 'No settled payment was found for this invoice.' }),
				{
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}
		if (!/^0x[a-fA-F0-9]{64}$/.test(payment.txHash)) {
			throw new Error('Payment is recorded, but its transaction evidence could not be read. Retry.');
		}
		return new Response(stringify({ invoice, payment }), {
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

