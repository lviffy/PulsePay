import { CCIPBridgeAdapter, CCIP_CHAIN_SELECTORS } from '@pulsepay/adapter-ccip';
import { stringify, errorMessage } from '$lib/chain';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const chainId = Number(process.env.CCIP_SOURCE_CHAIN_ID || '11155111');
		const destinationChainId = Number(process.env.CCIP_DESTINATION_CHAIN_ID || '296');
		const adapter = new CCIPBridgeAdapter({ chainId, rpcUrl: process.env.CCIP_RPC_URL || process.env.SEPOLIA_RPC_URL });
		const selector = adapter.resolveChainSelector(undefined, destinationChainId);
		const lane = await adapter.checkLane(selector);
		return new Response(stringify({
			...lane, status: 'LANE_AVAILABLE', protocol: 'Chainlink CCIP',
			sourceChain: `Testnet (${chainId})`, destinationChain: `Testnet (${destinationChainId})`,
			sourceSelector: CCIP_CHAIN_SELECTORS[chainId]?.toString(), destinationSelector: selector.toString(),
			tokenSupport: 'Not checked — quote the selected token before preparing a transfer',
			gasLimit: 0, explorerUrl: 'https://ccip.chain.link'
		}), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
	} catch (error) {
		return new Response(stringify({ error: errorMessage(error) }), {
			status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
		});
	}
};
