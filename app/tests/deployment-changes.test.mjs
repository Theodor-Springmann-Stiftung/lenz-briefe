import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { changedFiles, needsSiteBuild } from '../scripts/deployment-changes.mjs';

test('unpublished documentation skips deployment, including mixed documentation changes', () => {
  assert.equal(needsSiteBuild(['docs/questions.md', 'docs/import/source.docx', 'README.md',
    'app/README.md', 'scripts/transform/python/README.md', 'seiten/README.md', 'seiten/components/README.md']), false);
});

test('published content, build inputs and unknown paths still deploy even alongside docs', () => {
  for (const file of ['seiten/kontakt.md', 'seiten/components/legende.html',
    'docs/import/briefe/367/BJK1050.tif', 'assets/logo.svg', 'licenses/README.md', 'LICENSE.md', 'data/xml/briefe.xml',
    'data/xsd/briefe.xsd', 'data/xslt/letter.xsl', 'app/src/styles/global.css',
    'app/package-lock.json', 'scripts/transform/python/src/transform_python/exporter.py',
    '.github/workflows/pages.yml', 'new-build-input']) {
    assert.equal(needsSiteBuild(['README.md', file]), true, file);
  }
});

test('manual runs, initial pushes and incomplete events always build', () => {
  const git = () => assert.fail('full build should not need a diff');
  for (const [name, event] of [['workflow_dispatch', {}], ['push', { before: '0'.repeat(40), after: 'head' }],
    ['push', {}], ['pull_request', {}], ['unknown', {}]]) {
    assert.equal(changedFiles(name, event, git), null);
  }
});

test('an unavailable previous revision falls back to a full build', () => {
  assert.equal(changedFiles('push', { before: 'old', after: 'new' }, () => {
    throw new Error('Previous revision is no longer available');
  }), null);
});

test('pushes include all commits, PRs exclude base-only changes, and moves into docs still deploy', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lenz-deployment-diff-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim();
  const execute = (command, args, options) => execFileSync(command, args, { ...options, cwd: directory });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'tests@example.invalid');
  git('config', 'user.name', 'Tests');
  await mkdir(path.join(directory, 'docs'));
  await mkdir(path.join(directory, 'seiten'));
  await writeFile(path.join(directory, 'seiten/kontakt.md'), 'Published');
  git('add', '.'); git('commit', '-m', 'Initial');
  const before = git('rev-parse', 'HEAD');
  git('checkout', '-b', 'feature');
  await rename(path.join(directory, 'seiten/kontakt.md'), path.join(directory, 'docs/kontakt.md'));
  git('add', '-A'); git('commit', '-m', 'Move page');
  await writeFile(path.join(directory, 'docs/questions.md'), 'Questions');
  git('add', '.'); git('commit', '-m', 'Documentation');
  const head = git('rev-parse', 'HEAD');
  const files = changedFiles('push', { before, after: head }, execute);
  assert.deepEqual(files, ['docs/kontakt.md', 'docs/questions.md', 'seiten/kontakt.md']);
  assert.equal(needsSiteBuild(files), true);
  git('checkout', 'main');
  await writeFile(path.join(directory, 'seiten/base-only.md'), 'Base change');
  git('add', '.'); git('commit', '-m', 'Base change');
  const base = git('rev-parse', 'HEAD');
  assert.deepEqual(changedFiles('pull_request', { pull_request: { base: { sha: base }, head: { sha: head } } }, execute), files);
});
