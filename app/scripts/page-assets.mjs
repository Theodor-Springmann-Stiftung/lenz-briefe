import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { lookup } from 'mrmime';

export async function listPageAssets(directory) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  return entries.filter(entry => entry.isFile()).map(entry => {
    const source = path.join(entry.parentPath, entry.name);
    const name = path.relative(directory, source).split(path.sep).join('/');
    return { source, name };
  }).filter(file => !file.name.split('/').some(part => part.startsWith('.')));
}

// Publish the originals alongside Astro's optimized Markdown images. Serving
// these as files also keeps download URLs independent of page trailing slashes.
export default function pageAssets({ directory = fileURLToPath(new URL('../../seiten/assets/', import.meta.url)) } = {}) {
  const assets = path.resolve(directory) + path.sep;
  let prefix = '/seiten-assets/';
  return {
    name: 'lenz:page-assets',
    hooks: {
      'astro:config:done': ({ config }) => {
        prefix = `${config.base.replace(/\/$/, '')}/seiten-assets/`;
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const pathname = new URL(request.url || '/', 'http://localhost').pathname;
          if (!pathname.startsWith(prefix) || !['GET', 'HEAD'].includes(request.method)) return next();
          try {
            let name;
            try { name = decodeURIComponent(pathname.slice(prefix.length)); }
            catch { response.statusCode = 400; response.end(); return; }
            const file = (await listPageAssets(assets)).find(file => file.name === name);
            if (!file) { response.statusCode = 404; response.end('Not found'); return; }
            const contents = await readFile(file.source);
            response.setHeader('Content-Type', lookup(file.name) || 'application/octet-stream');
            response.setHeader('Content-Length', contents.length);
            response.setHeader('Cache-Control', 'no-cache');
            response.end(request.method === 'HEAD' ? undefined : contents);
          } catch (error) { next(error); }
        });
        const onChange = (event, file) => {
          if (['add', 'change', 'unlink'].includes(event) && path.resolve(file).startsWith(assets)) {
            server.ws.send({ type: 'full-reload', path: '*' });
          }
        };
        server.watcher.add(assets);
        server.watcher.on('all', onChange);
        server.httpServer?.once('close', () => server.watcher.off('all', onChange));
      },
      'astro:build:done': async ({ dir }) => {
        const output = fileURLToPath(new URL('seiten-assets/', dir));
        await Promise.all((await listPageAssets(assets)).map(async file => {
          const target = path.join(output, file.name);
          await mkdir(path.dirname(target), { recursive: true });
          await copyFile(file.source, target);
        }));
      },
    },
  };
}
