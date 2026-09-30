import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createOfflineWorker } from '../src/offline/worker.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export async function buildOfflineEdition(directory, base = '/') {
  const entries = [];
  const pages = [];
  const licenseFiles = [];
  let transferBytes = 0;
  const versionMarker = 'data-offline-version="__OFFLINE_VERSION__"';
  const labelPattern = /(<span\b[^>]*\bdata-offline-label(?:="[^"]*")?[^>]*>)[^<]*(<\/span>)/g;
  const compressedBytes = (content) => Math.min(content.length, gzipSync(content).length);
  async function visit(relative = '') {
    for (const file of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, file.name);
      if (file.isDirectory()) await visit(name);
      else if (file.isFile() && !['sw.js', 'offline-manifest.json', 'offline-licenses.json'].includes(name)) {
        let content = await readFile(path.join(directory, name));
        const page = name.endsWith('.html');
        // Normalize a previous stamp as well, so rebuilding the manifest on the
        // same output remains deterministic and the version cannot hash itself.
        if (page) content = Buffer.from(content.toString('utf8')
          .replace(/data-offline-version="[a-f0-9]{64}"/g, versionMarker)
          .replace(labelPattern, '$1auch Offline nutzen$2'));
        // Keep path-safe @ literal so scoped-package notices also work in preview.
        const encoded = name.split('/').map((part) => encodeURIComponent(part).replaceAll('%40', '@')).join('/');
        const url = base + (encoded === 'index.html' ? '' : encoded.replace(/\/index\.html$/, '/'));
        const entry = { url, hash: hash(content), bytes: content.length, page };
        if (name.startsWith('licenses/')) {
          entry.bundled = true;
          licenseFiles.push({ url, body: content.toString('base64') });
        } else transferBytes += compressedBytes(content);
        entries.push(entry);
        if (page && content.includes(versionMarker)) pages.push({ name, content, entry });
      }
    }
  }
  await visit();
  // Include every asset before the pages, not just files emitted into _astro.
  // The worker also waits for the asset batch to finish before starting HTML.
  const priority = (entry) => entry.url.startsWith(`${base}_astro/`) ? 0
    : entry.page ? 2 : 1;
  entries.sort((a, b) => priority(a) - priority(b) || a.url.localeCompare(b.url, 'en'));
  if (new Set(entries.map((entry) => entry.url)).size !== entries.length) throw new Error('Duplicate offline URL');
  let licenseBundle;
  if (licenseFiles.length) {
    licenseFiles.sort((a, b) => a.url.localeCompare(b.url, 'en'));
    const content = Buffer.from(JSON.stringify({ schema: 1, files: licenseFiles }));
    licenseBundle = { url: base + 'offline-licenses.json', hash: hash(content), bytes: content.length };
    await writeFile(path.join(directory, 'offline-licenses.json'), content);
    transferBytes += compressedBytes(content);
  }
  const runtime = `// Generated from src/offline/worker.mjs.\n(${createOfflineWorker.toString()})(self);\n`;
  transferBytes += compressedBytes(Buffer.from(runtime))
    + compressedBytes(Buffer.from(JSON.stringify({ entries, licenseBundle })));
  // Leave a small allowance for server compression differences, stamped page
  // versions and HTTP headers. Computing this at build time adds no requests.
  const downloadMB = Math.ceil(transferBytes * 1.03 / 1e6);
  const version = hash(runtime + JSON.stringify({ entries, licenseBundle, downloadMB }));
  for (const { name, content, entry } of pages) {
    const stamped = Buffer.from(content.toString('utf8')
      .replaceAll(versionMarker, `data-offline-version="${version}"`)
      .replace(labelPattern, `$1auch Offline nutzen (~${downloadMB} MB Download)$2`));
    await writeFile(path.join(directory, name), stamped);
    // Downloads must still verify the exact, stamped bytes served to browsers.
    entry.hash = hash(stamped);
    entry.bytes = stamped.length;
  }
  const manifest = { schema: 1, version, entries, downloadMB, ...(licenseBundle ? { licenseBundle } : {}) };
  await writeFile(path.join(directory, 'offline-manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(directory, 'sw.js'), runtime);
  return manifest;
}

export default function offlineEdition() {
  let base = '/';
  return {
    name: 'lenz:offline-edition',
    hooks: {
      'astro:config:setup': ({ command, updateConfig }) => {
        // Preview must also serve extensionless notices such as LICENSE.
        // Published page URLs still use the project's trailing-slash setting.
        if (command === 'preview') updateConfig({ trailingSlash: 'ignore' });
      },
      'astro:config:done': ({ config }) => { base = config.base.replace(/\/?$/, '/'); },
      'astro:build:done': async ({ dir, logger }) => {
        const manifest = await buildOfflineEdition(fileURLToPath(dir), base);
        const requests = manifest.entries.filter((entry) => !entry.bundled).length + (manifest.licenseBundle ? 1 : 0);
        const storedMB = (manifest.entries.reduce((sum, entry) => sum + entry.bytes, 0) / 1e6).toFixed(1);
        logger.info(`Offline edition: ${manifest.entries.length} files, ${requests} downloads, ~${manifest.downloadMB} MB transfer (${storedMB} MB uncompressed)`);
      },
    },
  };
}
