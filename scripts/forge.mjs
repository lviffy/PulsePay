import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = process.argv[2];
if (!['whitechain', 'uniswap-v4'].includes(project)) throw new Error('Unknown contract project');
const localForge = `${root}.bin/forge`;
const localSolc = `${root}.bin/solc`;
const result = spawnSync(existsSync(localForge) ? localForge : 'forge', [
  ...process.argv.slice(3),
  ...(existsSync(localSolc) ? ['--use', localSolc] : []),
], { cwd: `${root}contracts/${project}`, stdio: 'inherit' });
if (result.error) console.error('Install Foundry: https://getfoundry.sh/', result.error.message);
process.exitCode = result.status ?? 1;
