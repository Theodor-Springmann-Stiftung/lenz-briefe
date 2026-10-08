import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const workspace = fileURLToPath(new URL('../../scripts/transform/python/', import.meta.url));
const output = fileURLToPath(new URL('../generated/', import.meta.url));
const python = fileURLToPath(new URL('.venv/bin/python', pathToFileURL(workspace)));
async function runXmlExport({ signal, outputDirectory }) {
  const localPython = existsSync(python);
  await new Promise((resolve, reject) => {
    const child = spawn(
      localPython ? python : 'uv',
      localPython
        ? ['-m', 'transform_python.cli', '--out', outputDirectory]
        : ['run', '--project', workspace, 'transform', '--out', outputDirectory],
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
}

async function reusableXmlExport(directory) {
  try {
    const [status] = await Promise.all(['status.json', 'catalog.json', 'search.json', 'letters/index.json']
      .map(async (file) => JSON.parse(await readFile(path.join(directory, file), 'utf8'))));
    const cmif = await readFile(path.join(directory, 'CMIF.xml'), 'utf8');
    return status?.state === 'success' && cmif.includes('</TEI>');
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return false;
    throw error;
  }
}

export async function checkXmlCache({ directory = output, githubOutput = process.env.GITHUB_OUTPUT } = {}) {
  const usable = await reusableXmlExport(directory);
  await appendFile(githubOutput, `usable=${usable}\n`);
  return usable;
}

export async function runExport({
  signal,
  outputDirectory = output,
  reuseXml = process.env.XML_EXPORT_CACHE_HIT === 'true',
  transform = runXmlExport,
  enrich,
  prepareImages,
  logger = console,
} = {}) {
  signal?.throwIfAborted();
  if (reuseXml && await reusableXmlExport(outputDirectory)) {
    // Preserve the original export's commit and timestamp; the site is built anew.
    logger.info('[XML] Reusing export for unchanged transformation inputs.');
  } else {
    await transform({ signal, outputDirectory });
  }
  const buildImages = prepareImages ?? (await import('./letter-images.mjs')).buildLetterImages;
  await buildImages({ signal });
  // The cache check runs before npm ci in CI. Load GND (and its npm
  // dependencies) only when an actual export needs enrichment.
  const enrichOutput = enrich ?? (await import('./gnd.mjs')).enrichGnd;
  const { stats } = await enrichOutput({ output: outputDirectory, signal, cacheMode: process.env.GND_CACHE_MODE || 'ttl' });
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `gnd-cache-complete=${stats.failed === 0 && stats.stale === 0 && !stats.imageFailed}\n`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const command = process.argv.includes('--check-cache') ? checkXmlCache : runExport;
  command().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
