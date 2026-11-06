import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const spec = {
		openapi: '3.1.0',
		info: {
			title: 'PulsePay Web — public chain reads',
			version: '1.0.0',
			description:
				'Read-only blockchain and service discovery endpoints. Writes are wallet-authorized through the SDK in the browser. Amounts are integer strings. Chain and configuration failures return errors.'
		},
		paths: {
			'/api/config': {
				get: {
					summary: 'Allowlisted public network configuration',
					responses: { 200: { description: 'Addresses, RPC and service origin; no secrets' } }
				}
			},
			'/api/merchant': {
				get: {
					summary: 'Merchant records and balances from Whitechain',
					parameters: [
						{
							name: 'merchant',
							in: 'query',
							required: true,
							schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' }
						},
						{ name: 'before', in: 'query', schema: { type: 'string', pattern: '^[0-9]+$' } }
					],
					responses: {
						200: {
							description:
								'Current balances, records discovered in an explicit event window, record-level errors and optional nextBefore'
						},
						503: { description: 'Chain read or configuration failed' }
					}
				}
			},
			'/api/audit': {
				get: {
					summary: 'Configured HCS topic history from Hedera mirror node',
					parameters: [{ name: 'before', in: 'query', schema: { type: 'string' } }],
					responses: {
						200: {
							description: 'Consensus sequence, timestamps, payer and decoded topic payloads'
						},
						503: { description: 'Mirror or configuration failed' }
					}
				}
			},
			'/api/receipt/{id}': {
				get: {
					summary: 'Real invoice and payment with transaction evidence',
					parameters: [
						{
							name: 'id',
							in: 'path',
							required: true,
							schema: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' }
						}
					],
					responses: {
						200: { description: 'Settled invoice and payment' },
						400: { description: 'Invalid bytes32 ID' },
						404: { description: 'No settled payment' },
						503: { description: 'Read or transaction evidence unavailable' }
					}
				}
			},
			'/api/export': {
				get: {
					summary: 'Shared accountant CSV of settlement/refund events',
					parameters: [
						{ name: 'merchant', in: 'query', required: true, schema: { type: 'string' } },
						{ name: 'before', in: 'query', schema: { type: 'string' } }
					],
					responses: {
						200: {
							description: 'CSV for an explicit block window',
							content: { 'text/csv': { schema: { type: 'string' } } }
						},
						503: { description: 'Chain read failed; no CSV generated' }
					}
				}
			},
			'/api/treasury': {
				get: {
					summary: 'Real Uniswap v4 treasury guard policy',
					responses: {
						200: { description: 'Owner, paused state, limit currency and raw input limit' },
						503: { description: 'Read or configuration failed' }
					}
				}
			},
			'/.well-known/x402.json': {
				get: {
					summary: 'Actual paid API manifest validated through sdk-server',
					responses: {
						200: { description: 'Native HBAR services with absolute endpoints at the paid API' },
						503: { description: 'Paid API unavailable or invalid manifest' }
					}
				}
			}
		}
	};

	return new Response(JSON.stringify(spec), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

