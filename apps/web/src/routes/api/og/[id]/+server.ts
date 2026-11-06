import { seededPattern } from '$lib/art';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	const points = seededPattern(id, 40, 42);
	const cells = points
		.map(
			(point) =>
				`<rect x="${600 + point.x * 15}" y="${point.y * 15}" width="12" height="12" fill="#20201e" opacity="${point.alpha}" />`
		)
		.join('');

	const snippet = id ? `${id.slice(0, 20)}…` : '';

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f1efe7" />
  <g>${cells}</g>
  <text x="60" y="80" font-family="monospace" font-size="24" fill="#20201e" letter-spacing="2">PULSEPAY / RECEIPT</text>
  <text x="60" y="260" font-family="sans-serif" font-weight="600" font-size="80" fill="#20201e" letter-spacing="-3">A payment.</text>
  <text x="60" y="350" font-family="sans-serif" font-weight="600" font-size="80" fill="#20201e" letter-spacing="-3">A paper trail.</text>
  <text x="60" y="580" font-family="monospace" font-size="18" fill="#62625a">${snippet}</text>
</svg>`;

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};

