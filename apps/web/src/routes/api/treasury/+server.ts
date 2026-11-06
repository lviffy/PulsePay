import { UniswapV4TreasuryAdapter } from '@pulsepay/adapter-uniswap';
import { publicConfig, errorMessage, stringify } from '$lib/chain';
import { isAddress } from 'viem';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const hook = publicConfig().hook;
		if (!isAddress(hook) || /^0x0{40}$/i.test(hook)) {
			throw new Error('Set UNISWAP_TREASURY_HOOK_ADDRESS to read the deployed treasury policy.');
		}
		const client = new UniswapV4TreasuryAdapter({
			hookAddress: hook,
			rpcUrl: process.env.UNISWAP_RPC_URL
		});
		const policy = await client.getHookPolicy();
		return new Response(stringify(policy), {
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

