import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-vercel';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = resolve(rootDir, '.env');

// Ensure root .env variables are populated in process.env
if (existsSync(envPath)) {
	const raw = readFileSync(envPath, 'utf8');
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq > 0) {
			const key = trimmed.slice(0, eq).trim();
			const val = trimmed.slice(eq + 1).trim();
			if (!process.env[key]) {
				process.env[key] = val;
			}
		}
	}
}

function glslPlugin() {
	return {
		name: 'vite-glsl-raw',
		transform(code: string, id: string) {
			if (id.endsWith('.glsl')) {
				return {
					code: `export default ${JSON.stringify(code)};`,
					map: null
				};
			}
		}
	};
}

export default defineConfig({
	plugins: [
		tailwindcss(),
		glslPlugin(),
		sveltekit({
			adapter: adapter(),
			alias: {
				$lib: 'src/lib'
			}
		})
	],
	server: {
		host: '0.0.0.0',
		port: 3100,
		strictPort: true
	}
});
