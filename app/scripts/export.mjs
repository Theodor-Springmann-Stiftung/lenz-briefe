import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const workspace = fileURLToPath(new URL('../../transform/python/', import.meta.url));
const output = fileURLToPath(new URL('../generated/', import.meta.url));
const python = fileURLToPath(new URL('../../transform/python/.venv/bin/python', import.meta.url));
export function runExport({signal} = {}) {
  const localPython = existsSync(python);
  return new Promise((resolve, reject) => {
    const child = spawn(localPython ? python : 'uv', localPython
      ? ['-m', 'transform_python.cli', '--out', output]
      : ['run', '--project', workspace, 'transform', '--out', output],
    {cwd: workspace, stdio: 'inherit', signal});
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Edition export failed (${signal || `exit ${code}`}). See the terminal for details.`));
    });
  });
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runExport().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
