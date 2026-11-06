import { codeToHtml } from 'shiki';
import { syntaxTheme } from './highlight';
import { headingId } from './docs';

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function renderInline(text: string): string {
	let out = escapeHtml(text);

	// Code: `code`
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Bold: **text**
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

	// Italic: *text*
	out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

	// Links: [text](url)
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

	return out;
}

export async function renderMarkdown(markdown: string): Promise<string> {
	// First extract and highlight all code fences
	const codeBlocks: string[] = [];
	let placeholderIndex = 0;

	// Matches ```lang ... ```
	const processedMarkdown = await (async () => {
		const matches = Array.from(markdown.matchAll(/```(\w*)\r?\n([\s\S]*?)```/g));
		let result = markdown;
		for (const match of matches) {
			const lang = match[1] || 'text';
			const rawCode = match[2].trimEnd();
			const html = await codeToHtml(rawCode, { lang, theme: syntaxTheme });
			const placeholder = `__PULSEPAY_CODE_BLOCK_${placeholderIndex++}__`;
			const escapedCode = rawCode.replace(/"/g, '&quot;');
			codeBlocks.push(
				`<div class="docs-code"><button class="copy-button" onclick="navigator.clipboard.writeText(this.dataset.code);this.textContent='Copied ✓';setTimeout(()=>this.textContent='Copy',2000)" data-code="${escapedCode}">Copy</button>${html}</div>`
			);
			result = result.replace(match[0], placeholder);
		}
		return result;
	})();

	const lines = processedMarkdown.split(/\r?\n/);
	const htmlPieces: string[] = [];
	let inList: 'ul' | 'ol' | null = null;
	let inTable = false;
	let tableHeaderDone = false;
	let tableRows: string[] = [];

	function closeList() {
		if (inList) {
			htmlPieces.push(inList === 'ul' ? '</ul>' : '</ol>');
			inList = null;
		}
	}

	function closeTable() {
		if (inTable) {
			htmlPieces.push(
				`<div class="table-wrap"><table><tbody>${tableRows.join('')}</tbody></table></div>`
			);
			inTable = false;
			tableHeaderDone = false;
			tableRows = [];
		}
	}

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		// Check for code block placeholder
		if (trimmed.startsWith('__PULSEPAY_CODE_BLOCK_') && trimmed.endsWith('__')) {
			closeList();
			closeTable();
			const idx = parseInt(trimmed.replace('__PULSEPAY_CODE_BLOCK_', '').replace('__', ''), 10);
			htmlPieces.push(codeBlocks[idx]);
			continue;
		}

		if (!trimmed) {
			closeList();
			closeTable();
			continue;
		}

		// Table line: | col 1 | col 2 |
		if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
			closeList();
			// check if separator line: |---|---|
			if (/^\|(\s*[-:]+[-|\s:]*)\|$/.test(trimmed)) {
				tableHeaderDone = true;
				continue;
			}
			const cells = trimmed
				.slice(1, -1)
				.split('|')
				.map((c) => c.trim());
			if (!inTable) {
				inTable = true;
				tableHeaderDone = false;
				tableRows.push(
					`<tr>${cells.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr>`
				);
			} else if (!tableHeaderDone) {
				tableRows.push(
					`<tr>${cells.map((c) => `<th>${renderInline(c)}</th>`).join('')}</tr>`
				);
			} else {
				tableRows.push(
					`<tr>${cells.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`
				);
			}
			continue;
		} else {
			closeTable();
		}

		// Headings
		if (trimmed.startsWith('### ')) {
			closeList();
			const title = trimmed.slice(4).trim();
			htmlPieces.push(`<h3>${renderInline(title)}</h3>`);
			continue;
		}
		if (trimmed.startsWith('## ')) {
			closeList();
			const title = trimmed.slice(3).trim();
			htmlPieces.push(`<h2 id="${headingId(title)}">${renderInline(title)}</h2>`);
			continue;
		}
		if (trimmed.startsWith('# ')) {
			closeList();
			const title = trimmed.slice(2).trim();
			htmlPieces.push(`<h1>${renderInline(title)}</h1>`);
			continue;
		}

		// Blockquote
		if (trimmed.startsWith('> ')) {
			closeList();
			htmlPieces.push(`<blockquote><p>${renderInline(trimmed.slice(2).trim())}</p></blockquote>`);
			continue;
		}

		// Unordered list: - item or * item
		if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
			if (inList !== 'ul') {
				closeList();
				inList = 'ul';
				htmlPieces.push('<ul>');
			}
			htmlPieces.push(`<li>${renderInline(trimmed.slice(2).trim())}</li>`);
			continue;
		}

		// Ordered list: 1. item
		const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
		if (numMatch) {
			if (inList !== 'ol') {
				closeList();
				inList = 'ol';
				htmlPieces.push('<ol>');
			}
			htmlPieces.push(`<li>${renderInline(numMatch[2].trim())}</li>`);
			continue;
		}

		// Regular paragraph
		closeList();
		htmlPieces.push(`<p>${renderInline(trimmed)}</p>`);
	}

	closeList();
	closeTable();

	return htmlPieces.join('\n');
}

