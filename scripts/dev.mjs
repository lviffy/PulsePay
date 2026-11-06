import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const children = [
  spawn('pnpm', ['exec', 'turbo', 'watch', 'build'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [`${root}scripts/run-app.mjs`, 'demo-store', '--watch'], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); };
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, stop);
for (const child of children) {
  child.once('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
  child.once('exit', code => { if (!stopping) { process.exitCode = code ?? 1; stop(); } });
}
