import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = process.argv[2];
if (!['demo-store', 'agent-worker'].includes(app)) throw new Error('Unknown application');
const envPath = `${root}.env`;
const args = [
  ...(existsSync(envPath) ? [`--env-file=${envPath}`] : []),
  ...(process.argv.includes('--watch') ? ['--watch'] : []),
  `${root}apps/${app}/dist/index.js`,
];
const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
