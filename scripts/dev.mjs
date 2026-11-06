import { spawn } from 'node:child_process';
import { existsSync, openSync, readSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, delimiter } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const turbo = resolve(root, 'node_modules/turbo/bin/turbo');
const next = resolve(root, 'apps/web/node_modules/next/dist/bin/next');
const prepare = resolve(root, 'apps/web/scripts/prepare.mjs');
const children = new Set();
let stopping = false;

// Each command owns its process group, so Ctrl-C also stops its workers.
function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    ...options,
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (process.platform === 'win32') child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') console.error(error.message);
    }
  }
}
process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop());
function run(script, args = [], options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = start(process.execPath, [script, ...args], options);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${script} exited ${signal || code}`));
    });
  });
}
function supervise(child) {
  child.once('error', error => {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  });
  child.once('exit', code => {
    if (!stopping) {
      process.exitCode = code ?? 1;
      stop();
    }
  });
}
try {
  // Fail before Turbo can resolve an npx-backed pnpm shim into itself.
  const pnpmPath = process.env.PATH?.split(delimiter).map(directory => resolve(directory, 'pnpm')).find(existsSync);
  if (pnpmPath) {
    const fd = openSync(pnpmPath, 'r');
    const header = Buffer.alloc(2048);
    const count = readSync(fd, header, 0, header.length, 0);
    closeSync(fd);
    const source = header.subarray(0, count).toString('utf8');
    if (source.startsWith('#!') && /\bnpx\b[^\n]*\bpnpm\b/.test(source)) {
      throw new Error(`Recursive pnpm launcher detected at ${pnpmPath}. Point pnpm at its installed standalone binary instead of npx.`);
    }
  }
  for (const entry of [turbo, next, prepare]) {
    if (!existsSync(entry)) throw new Error(`Missing ${entry}. Install workspace dependencies first.`);
  }
  if (process.argv.includes('--check')) {
    console.log('Dev launcher ready: package build → package watch + Next.js on http://localhost:3100');
    console.log('Commands use Node directly; production web builds are excluded from the watcher.');
  } else {
    await run(turbo, ['run', 'build', '--filter=./packages/*', '--concurrency=2']);
    if (!stopping) await run(prepare);
    if (!stopping) {
      supervise(start(process.execPath, [turbo, 'watch', 'build', '--filter=./packages/*', '--concurrency=2']));
      supervise(start(process.execPath, [next, 'dev', '--hostname', '0.0.0.0', '--port', '3100'], {
        cwd: resolve(root, 'apps/web'),
        env: { ...process.env, PULSEPAY_WEB_DEV: '1' },
      }));
      const envPath = resolve(root, '.env');
      if (existsSync(envPath)) process.loadEnvFile(envPath);
      if (!process.argv.includes('--web-only') && process.env.PULSEPAY_API_SECRET?.length >= 32 && /^\d+\.\d+\.\d+$/.test(process.env.HEDERA_MERCHANT_ACCOUNT_ID || '')) {
        const compiler = resolve(root, 'node_modules/typescript/bin/tsc');
        await run(compiler, ['-p', resolve(root, 'apps/demo-store/tsconfig.json')]);
        if (!stopping) supervise(start(process.execPath, [resolve(root, 'scripts/run-app.mjs'), 'demo-store', '--watch']));
      } else {
        console.log('Web: http://localhost:3100 · paid API runs separately until its .env is configured.');
      }
    }
  }
} catch (error) {
  if (!stopping) {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  }
}
