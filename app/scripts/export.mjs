import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const workspace = fileURLToPath(new URL('../../transform/python/', import.meta.url));
const output = fileURLToPath(new URL('../generated/', import.meta.url));
const python = fileURLToPath(new URL('../../transform/python/.venv/bin/python', import.meta.url));
const result = existsSync(python)
  ? spawnSync(python, ['-m', 'transform_python.cli', '--out', output], {cwd: workspace, stdio: 'inherit'})
  : spawnSync('uv', ['run', '--project', workspace, 'transform', '--out', output], {cwd: workspace, stdio: 'inherit'});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
