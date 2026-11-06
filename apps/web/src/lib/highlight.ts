export const syntaxTheme = {
	name: 'pulsepay',
	type: 'dark' as const,
	colors: { 'editor.background': '#20201e', 'editor.foreground': '#eeece3' },
	tokenColors: [
		{ scope: ['comment', 'punctuation'], settings: { foreground: '#98988f' } },
		{ scope: ['keyword', 'storage'], settings: { foreground: '#b8bdb1' } },
		{ scope: ['string'], settings: { foreground: '#d4d7c2' } }
	]
};

