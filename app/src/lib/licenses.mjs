import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Astro bundles this module into a different directory when prerendering.
// Resolve from the application root, as the edition data loader does.
export const licensesDirectory = path.resolve(process.cwd(), '../licenses');
const runtimePackages = new Set(['tippy.js', '@popperjs/core', 'tailwindcss', 'remixicon', '@vivliostyle/core', 'fast-diff']);
const fontNames = {
  LinuxBiolinum: 'Linux Biolinum',
  SourceSerif4: 'Source Serif 4',
  SourceSans3: 'Source Sans 3',
  RobotoSlab: 'Roboto Slab',
  CormorantGaramond: 'Cormorant Garamond',
};

// The checked-in notice index is the source of truth, including shared notices
// for native bindings and supplements absent from package metadata.
export function licenseEntries(markdown, directory = licensesDirectory) {
  let section;
  const entries = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) section = line.slice(3).trim();
    if (
      !line.startsWith('| ') ||
      !['Fonts', 'Python runtime dependencies', 'npm packages'].includes(section)
    )
      continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells[0] === 'Product' || /^[- :]+$/.test(cells[0])) continue;
    const npm = section === 'npm packages';
    if (cells.length !== (npm ? 4 : 3)) throw new Error(`Invalid license index row: ${line}`);
    const [product] = cells;
    const files = [...cells.at(-1).matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(([, label, url]) => {
      const file = decodeURIComponent(url);
      const target = path.resolve(directory, file);
      const relative = path.relative(directory, target);
      if (
        relative.startsWith('..') ||
        path.isAbsolute(relative) ||
        !statSync(target, { throwIfNoEntry: false })?.isFile()
      ) {
        throw new Error(`Missing or invalid license file for ${product}: ${file}`);
      }
      return { label, file };
    });
    if (!files.length) throw new Error(`No license files for ${product}`);
    const runtime = npm
      ? runtimePackages.has(product)
      : section === 'Fonts' && product !== 'SourceSans3';
    let license = cells[npm ? 2 : 1];
    if (product === 'remixicon') license = 'Remix Icon License v1.0';
    else
      license = license
        .replace(
          'OFL-1.1 / GPL-2.0 with font exception (dual-licensed)',
          'OFL-1.1 oder GPL-2.0 mit Font-Ausnahme',
        )
        .replace('; repository only', ' (nur im Quellcode enthalten)')
        .replace('plus bundled-library notices', 'und Hinweise zu enthaltenen Bibliotheken')
        .replace('plus bundled notices; SaxonC-HE', 'und weitere Hinweise; SaxonC-HE')
        .replace(' — declaration only', ' (Lizenzangabe des Pakets)');
    entries.push({
      product,
      name: fontNames[product] ?? product,
      version: npm ? cells[1] : '',
      license,
      files,
      runtime,
    });
  }
  if (!entries.length) throw new Error('License index contains no products');
  return entries;
}

export function licenseFileUrl(file, base = '/') {
  return `${base.replace(/\/$/, '')}/licenses/${file.split('/').map(encodeURIComponent).join('/')}`;
}

export function readLicenseFile(file) {
  return readFileSync(path.join(licensesDirectory, file), 'utf8');
}

export function loadLicenses() {
  return licenseEntries(readLicenseFile('README.md'));
}
