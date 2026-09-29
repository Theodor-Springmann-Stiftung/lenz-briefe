import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOfflineWorker } from '../src/offline/worker.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export async function buildOfflineEdition(directory, base = '/') {
  const entries = [];
  const pages = [];
  const versionMarker = 'data-offline-version="__OFFLINE_VERSION__"';
  async function visit(relative = '') {
    for (const file of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, file.name);
      // Keep the rendered license page, but don't download the source notices
      // and package metadata copied into this separate directory.
      if (name === 'licenses') continue;
      if (file.isDirectory()) await visit(name);
      else if (file.isFile() && !['sw.js', 'offline-manifest.json'].includes(name)) {
        let content = await readFile(path.join(directory, name));
        const page = name.endsWith('.html');
        // Normalize a previous stamp as well, so rebuilding the manifest on the
        // same output remains deterministic and the version cannot hash itself.
        if (page) content = Buffer.from(content.toString('utf8').replace(/data-offline-version="[a-f0-9]{64}"/g, versionMarker));
        const encoded = name.split('/').map(encodeURIComponent).join('/');
        const url = base + (encoded === 'index.html' ? '' : encoded.replace(/\/index\.html$/, '/'));
        const entry = { url, hash: hash(content), bytes: content.length, page };
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
  const runtime = `// Generated from src/offline/worker.mjs.\n(${createOfflineWorker.toString()})(self);\n`;
  const version = hash(runtime + JSON.stringify(entries));
  for (const { name, content, entry } of pages) {
    const stamped = Buffer.from(content.toString('utf8').replaceAll(versionMarker, `data-offline-version="${version}"`));
    await writeFile(path.join(directory, name), stamped);
    // Downloads must still verify the exact, stamped bytes served to browsers.
    entry.hash = hash(stamped);
    entry.bytes = stamped.length;
  }
  const manifest = { schema: 1, version, entries };
  await writeFile(path.join(directory, 'offline-manifest.json'), JSON.stringify(manifest));
  await writeFile(path.join(directory, 'sw.js'), runtime);
  return manifest;
}

export default function offlineEdition() {
  let base = '/';
  return {
    name: 'lenz:offline-edition',
    hooks: {
      'astro:config:done': ({ config }) => { base = config.base.replace(/\/?$/, '/'); },
      'astro:build:done': async ({ dir, logger }) => {
        const manifest = await buildOfflineEdition(fileURLToPath(dir), base);
        logger.info(`Offline edition: ${manifest.entries.length} files, ${(manifest.entries.reduce((sum, entry) => sum + entry.bytes, 0) / 1e6).toFixed(1)} MB`);
      },
    },
  };
}
