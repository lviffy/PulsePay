import catalog from '../../content/docs-index.json';

export { catalog };
export type Doc = (typeof catalog)[number];

export function headingId(text: string) {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-');
}
