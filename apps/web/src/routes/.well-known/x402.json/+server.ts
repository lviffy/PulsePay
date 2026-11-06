import { generateX402Manifest } from '@pulsepay/sdk-server';
import { publicConfig, errorMessage } from '$lib/chain';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const targetUrl = new URL('/.well-known/x402.json', publicConfig().serviceUrl);
		const current = url;
		if (
			targetUrl.origin === current.origin ||
			(['localhost', '127.0.0.1', '0.0.0.0'].includes(targetUrl.hostname) &&
				['localhost', '127.0.0.1', '0.0.0.0'].includes(current.hostname) &&
				targetUrl.port === current.port)
		) {
			throw new Error(
				'PULSEPAY_SERVICE_URL must point to the paid API, on a different origin from this web app.'
			);
		}
		const response = await fetch(targetUrl, {
			cache: 'no-store',
			signal: AbortSignal.timeout(10000)
		});
		if (!response.ok) {
			throw new Error(`Service discovery returned ${response.status}`);
		}
		const manifest = await response.json();
		if (!Array.isArray(manifest.services)) {
			throw new Error('Service returned an invalid manifest.');
		}
		const generated = generateX402Manifest(
			manifest.services.map((service: any) => ({
				serviceId: service.id,
				serviceName: service.name,
				description: service.description,
				price: {
					network: service.pricing.network,
					asset: service.pricing.asset,
					amountTinybars: service.pricing.amount,
					payTo: service.pricing.recipient
				}
			}))
		);
		const body = {
			...generated,
			services: generated.services.map((service) => ({
				...service,
				endpoints: service.endpoints.map((endpoint) => ({
					...endpoint,
					path: new URL(endpoint.path, targetUrl.origin).toString()
				}))
			}))
		};
		return new Response(JSON.stringify(body), {
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

