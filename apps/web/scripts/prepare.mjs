import { mkdir, writeFile } from 'node:fs/promises';
import './generate-snippets.mjs';

const staticDir = new URL('../static/', import.meta.url);
await mkdir(staticDir, { recursive: true });

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
let cells = '';
for (let y = 0; y < 120; y++) {
	for (let x = 0; x < 240; x++) {
		const wave = (Math.sin(x * 0.045 + Math.sin(y * 0.07) * 2) + Math.cos(y * 0.045)) * 0.2 + y / 170;
		if (wave > bayer[(x % 4) + (y % 4) * 4] / 16) {
			cells += `<rect x="${x * 6}" y="${y * 6}" width="6" height="6"/>`;
		}
	}
}

const ditherSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 720"><rect width="1440" height="720" fill="#f1efe7"/><g fill="#20201e">${cells}</g></svg>`;
await writeFile(new URL('dither.svg', staticDir), ditherSvg);

const phrases = [
	'PULSEPAY · ',
	'EXACT USDT OUT · ',
	'WHITECHAIN · HEDERA · ',
	'PAY WITH ANY TOKEN · ',
	'REFUNDS FROM RESERVE · ',
	'AGENTS PAY · NOBODY APPROVES · ',
	'EVERY CALL AUDITED · ',
	'SUBSCRIPTIONS · CSV EXPORT · ',
	'PULSEPAY · ',
	'ANY TOKEN IN · EXACT USDT OUT · '
];

const paths = phrases
	.map((phrase, i) => {
		const r = 46 + i * 48;
		return `<defs><path id="r${i}" d="M ${600 - r},600 a ${r},${r} 0 1,1 ${2 * r},0 a ${r},${r} 0 1,1 ${-2 * r},0"/></defs><text fill="#f1efe7" opacity="${0.9 - i * 0.06}" font-family="monospace" font-size="${11 + i * 1.2}" letter-spacing="3"><textPath href="#r${i}" textLength="${2 * Math.PI * r}">${phrase.repeat(Math.ceil((2 * Math.PI * r) / (phrase.length * (8 + i))))}</textPath></text>`;
	})
	.join('');

const ringsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200"><rect width="1200" height="1200" fill="#20201e"/>${paths}<circle cx="600" cy="600" r="29" fill="#f1efe7"/><text x="600" y="607" fill="#20201e" font-family="monospace" font-size="18" text-anchor="middle">402</text></svg>`;
await writeFile(new URL('rings.svg', staticDir), ringsSvg);
