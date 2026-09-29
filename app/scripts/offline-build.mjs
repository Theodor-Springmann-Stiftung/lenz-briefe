import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOfflineWorker } from '../src/offline/worker.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');

export async function buildOfflineEdition(directory, base = '/') {
  const entries = [];
  async function visit(relative = '') {
    for (const file of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, file.name);
      // Keep the rendered license page, but don't download the source notices
      // and package metadata copied into this separate directory.
      if (name === 'licenses') continue;
      if (file.isDirectory()) await visit(name);
      else if (file.isFile() && !['sw.js', 'offline-manifest.json'].includes(name)) {
        const content = await readFile(path.join(directory, name));
        const encoded = name.split('/').map(encodeURIComponent).join('/');
        const url = base + (encoded === 'index.html' ? '' : encoded.replace(/\/index\.html$/, '/'));
        entries.push({ url, hash: hash(content), bytes: content.length, page: name.endsWith('.html') });
      }
    }
  }
  await visit();
  // Shared assets first, then pages, then downloads. Even an interrupted
  // initial download can render the pages it has already saved.
  const priority = (entry) => entry.url.startsWith(`${base}_astro/`) ? 0
    : entry.page ? 1 : 2;
  entries.sort((a, b) => priority(a) - priority(b) || a.url.localeCompare(b.url, 'en'));
  if (new Set(entries.map((entry) => entry.url)).size !== entries.length) throw new Error('Duplicate offline URL');
  const runtime = `// Generated from src/offline/worker.mjs.\n(${createOfflineWorker.toString()})(self);\n`;
  const manifest = { schema: 1, version: hash(runtime + JSON.stringify(entries)), entries };
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
