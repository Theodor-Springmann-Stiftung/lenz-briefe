import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { licenseEntries, licenseFileUrl, loadLicenses } from '../src/lib/licenses.mjs';

test('the generated page covers every locked npm version and classifies browser assets separately from build tools', () => {
  const entries = loadLicenses();
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const expected = [...new Set(Object.entries(lock.packages).filter(([key]) => key).map(([key, value]) => `${key.split('node_modules/').at(-1)}@${value.version}`))].sort();
  assert.deepEqual(entries.filter(entry => entry.version).map(entry => `${entry.product}@${entry.version}`).sort(), expected);
  assert.deepEqual(entries.filter(entry => entry.runtime).map(entry => entry.product).sort(), ['LinuxBiolinum', 'SourceSerif4', 'RobotoSlab', 'CormorantGaramond', 'tippy.js', '@popperjs/core', 'tailwindcss', 'remixicon'].sort());
  assert.ok(entries.find(entry => entry.product.startsWith('saxonche-') && !entry.runtime));
  assert.equal(entries.find(entry => entry.product === 'remixicon').license, 'Remix Icon License v1.0');
});

test('missing or escaping notice paths fail instead of publishing broken links', () => {
  const table = file => `## Fonts\n| Example | MIT | [License](${file}) |`;
  assert.throws(() => licenseEntries(table('missing.txt')), /Missing or invalid license file/);
  assert.throws(() => licenseEntries(table('../app/package.json')), /Missing or invalid license file/);
});

test('notice links preserve deployment prefixes and encode filenames', () => {
  assert.equal(licenseFileUrl('npm/@scope__name@1.0/License.txt', '/edition-preview/'), '/edition-preview/licenses/npm/%40scope__name%401.0/License.txt');
  assert.equal(licenseFileUrl('fonts/Übersicht 1.txt'), '/licenses/fonts/%C3%9Cbersicht%201.txt');
});
