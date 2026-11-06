import { seededPattern } from '$lib/art';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	if (!/^0x[a-fA-F0-9]{64}$/.test(id)) {
		return new Response('Invalid invoice ID', { status: 400 });
	}
	const cells = seededPattern(id)
		.map((point) => `<rect x="${point.x * 12.5}" y="${point.y * 12.5}" width="10" height="10" opacity="${point.alpha}"/>`)
		.join('');
	return new Response(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 480"><rect width="1000" height="480" fill="#f1efe7"/><g fill="#20201e">${cells}</g></svg>`,
		{
			headers: {
				'Content-Type': 'image/svg+xml',
				'Cache-Control': 'public, max-age=31536000, immutable',
				'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
			}
		}
	);
};

