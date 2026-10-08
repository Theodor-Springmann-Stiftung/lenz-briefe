import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { buildLetterImages } from '../scripts/letter-images.mjs';

test('TIFF replacements regenerate preview and lossless full-size images; missing sources fail', async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), 'lenz-letter-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const destination = path.join(root, 'output');
  await mkdir(source);
  const original = path.join(source, 'BJK1050.tif');
  const writeOriginal = (file, background) => sharp({ create: {
    width: 1600, height: 800, channels: 3, background,
  } }).tiff().toFile(file);
  await writeOriginal(original, 'red');
  await writeOriginal(path.join(source, 'BJK1051.tif'), 'white');
  await buildLetterImages({ source, destination });
  const preview = await sharp(path.join(destination, 'BJK1050.webp')).metadata();
  assert.equal(preview.width, 1200);
  assert.equal(preview.height, 600);
  const fullPath = path.join(destination, 'BJK1050-full.webp');
  const full = await sharp(fullPath).metadata();
  assert.equal(full.width, 1600);
  assert.equal(full.height, 800);
  assert.deepEqual(await sharp(fullPath).raw().toBuffer(), await sharp(original).raw().toBuffer());
  const before = await readFile(fullPath);
  await writeOriginal(original, 'blue');
  await buildLetterImages({ source, destination });
  assert.notDeepEqual(await readFile(fullPath), before);
  await rm(original);
  await assert.rejects(buildLetterImages({ source, destination }), /Input file is missing/);
});
