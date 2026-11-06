import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('npm dev enters the Node supervisor without recursively resolving pnpm', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(manifest.scripts.dev, 'node scripts/dev.mjs');
  const check = spawnSync(process.execPath, ['scripts/dev.mjs', '--check'], {
    cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024,
  });
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /http:\/\/localhost:3100/);
  assert.equal(check.stdout.split('\n').filter(Boolean).length, 2);
});

test('an npx-backed pnpm shim fails closed before any recursive command starts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pulsepay-dev-'));
  try {
    writeFileSync(join(directory, 'pnpm'), '#!/bin/sh\nexec npx --no-install pnpm "$@"\n', { mode: 0o755 });
    const check = spawnSync(process.execPath, ['scripts/dev.mjs', '--check'], {
      cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024,
      env: { ...process.env, PATH: `${directory}${delimiter}${process.env.PATH || ''}` },
    });
    assert.equal(check.status, 1);
    assert.match(check.stderr, /Recursive pnpm launcher detected/);
    assert.equal(check.stdout, '');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
