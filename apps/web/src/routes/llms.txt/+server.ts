import { catalog } from '$lib/docs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const body = `# PulsePay

> Unified merchant billing and native agent payments.

Whitechain Sepolia (1874): real USDT invoices, refunds and subscriptions. Chainlink CCIP 2.0: cross-chain token bridging via official testnet routers. Hedera: PulsePay's hedera-native-receipt HTTP-402 extension, native HBAR asset 0.0.0 and HCS audit.

Every docs URL supports Accept: text/markdown and an explicit .md twin. Read-only API failures return errors; no preview rows are accounting evidence.

## Documentation
${catalog.map((doc) => `- [${doc.title}](/docs/${doc.slug}.md): ${doc.lede}`).join('\n')}

## Machine endpoints
- [OpenAPI](/openapi.json)
- [Actual paid service manifest](/.well-known/x402.json)
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8'
		}
	});
};

