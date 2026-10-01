import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { enrichGnd } from './gnd.mjs';
const workspace = fileURLToPath(new URL('../../scripts/transform/python/', import.meta.url));
const output = fileURLToPath(new URL('../generated/', import.meta.url));
const python = fileURLToPath(new URL('.venv/bin/python', pathToFileURL(workspace)));
export async function runExport({ signal } = {}) {
  const localPython = existsSync(python);
  await new Promise((resolve, reject) => {
    const child = spawn(
      localPython ? python : 'uv',
      localPython
        ? ['-m', 'transform_python.cli', '--out', output]
        : ['run', '--project', workspace, 'transform', '--out', output],
      { cwd: workspace, stdio: 'inherit', signal },
    );
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `Edition export failed (${signal || `exit ${code}`}). See the terminal for details.`,
          ),
        );
    });
  });
  const { stats } = await enrichGnd({ output, signal, cacheMode: process.env.GND_CACHE_MODE || 'ttl' });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `gnd-cache-complete=${stats.failed === 0 && stats.stale === 0}\n`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runExport().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
