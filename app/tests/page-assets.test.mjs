import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EventEmitter } from 'node:events';
import pageAssets from '../scripts/page-assets.mjs';

test('downloads preserve binary contents, work without trailing slashes, and follow file additions and deletions', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'lenz-page-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'assets');
  const output = path.join(root, 'dist');
  await mkdir(path.join(directory, 'dokumente'), { recursive: true });
  const source = path.join(directory, 'dokumente', 'Übersicht 1.pdf');
  const binary = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00, 0xff]);
  await writeFile(source, binary);
  await writeFile(path.join(directory, '.gitkeep'), '');
  await mkdir(path.join(directory, '.private'));
  await writeFile(path.join(directory, '.private', 'hidden.txt'), 'hidden');

  const integration = pageAssets({ directory });
  let middleware;
  let reloads = 0;
  const watcher = new EventEmitter();
  watcher.add = () => {};
  const httpServer = new EventEmitter();
  integration.hooks['astro:config:done']({ config: { base: '/ausgabe/' } });
  integration.hooks['astro:server:setup']({ server: {
    middlewares: { use: fn => { middleware = fn; } }, watcher, httpServer,
    ws: { send: () => reloads++ },
  } });
  t.after(() => httpServer.emit('close'));
  async function request(url, method = 'GET') {
    const result = { statusCode: 200, headers: {}, body: undefined, next: false };
    result.setHeader = (name, value) => { result.headers[name] = value; };
    result.end = body => { result.body = body; };
    await middleware({ url, method }, result, error => { if (error) throw error; result.next = true; });
    return result;
  }
  const url = '/ausgabe/seiten-assets/dokumente/%C3%9Cbersicht%201.pdf';
  const download = await request(url);
  assert.deepEqual(download.body, binary);
  assert.equal(download.headers['Content-Type'], 'application/pdf');
  assert.equal((await request(url, 'HEAD')).body, undefined);
  assert.equal((await request('/ausgabe/seiten-assets/.private/hidden.txt')).statusCode, 404);
  assert.equal((await request('/ausgabe/seiten-assets/%ZZ')).statusCode, 400);
  assert.equal((await request('/ausgabe/edition/kontakt/')).next, true);

  await integration.hooks['astro:build:done']({ dir: pathToFileURL(output + path.sep) });
  assert.deepEqual(await readFile(path.join(output, 'seiten-assets/dokumente/Übersicht 1.pdf')), binary);
  assert.deepEqual(await readdir(path.join(output, 'seiten-assets')), ['dokumente']);
  const added = path.join(directory, 'new.txt');
  await writeFile(added, 'New download');
  watcher.emit('all', 'add', added);
  assert.equal((await request('/ausgabe/seiten-assets/new.txt')).body.toString(), 'New download');
  await rm(added);
  watcher.emit('all', 'unlink', added);
  assert.equal((await request('/ausgabe/seiten-assets/new.txt')).statusCode, 404);
  assert.equal(reloads, 2);
});
