import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// These originals are the two illustrated pages embedded in letter 367.
export async function buildLetterImages({
  source = fileURLToPath(new URL('../../docs/import/briefe/367/', import.meta.url)),
  destination = fileURLToPath(new URL('../../assets/briefe/367/', import.meta.url)),
  signal,
} = {}) {
  await mkdir(destination, { recursive: true });
  for (const name of ['BJK1050', 'BJK1051']) {
    signal?.throwIfAborted();
    const original = sharp(path.join(source, `${name}.tif`)).toColourspace('srgb');
    // Finish decoding both versions before replacing the served files.
    const full = await original.clone().webp({ lossless: true }).toBuffer();
    const preview = await original.clone().resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 }).toBuffer();
    signal?.throwIfAborted();
    await writeFile(path.join(destination, `${name}-full.webp`), full);
    await writeFile(path.join(destination, `${name}.webp`), preview);
  }
}
