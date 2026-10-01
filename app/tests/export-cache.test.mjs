import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runExport, checkXmlCache } from '../scripts/export.mjs';

async function fixture(t) {
  const outputDirectory = await mkdtemp(path.join(tmpdir(), 'lenz-export-cache-'));
  t.after(() => rm(outputDirectory, { recursive: true, force: true }));
  await mkdir(path.join(outputDirectory, 'letters'));
  const status = { state: 'success', generatedAt: '2026-01-01T00:00:00Z', source: { commitHash: 'original' } };
  for (const [file, value] of Object.entries({
    'status.json': status, 'catalog.json': { people: {}, places: {} },
    'search.json': { blocks: [] }, 'letters/index.json': [],
  })) await writeFile(path.join(outputDirectory, file), JSON.stringify(value));
  return { outputDirectory, status };
}

const stats = { cached: 0, fetched: 0, failed: 0, stale: 0 };

test('the workflow checks restored output before deciding whether Python is needed', async (t) => {
  const { outputDirectory } = await fixture(t);
  const githubOutput = path.join(outputDirectory, 'step-output');
  assert.equal(await checkXmlCache({ directory: outputDirectory, githubOutput }), true);
  await rm(path.join(outputDirectory, 'catalog.json'));
  assert.equal(await checkXmlCache({ directory: outputDirectory, githubOutput }), false);
  assert.equal(await readFile(githubOutput, 'utf8'), 'usable=true\nusable=false\n');
});

test('an exact XML cache hit skips transformation, preserves provenance and regenerates GND summaries', async (t) => {
  const { outputDirectory, status } = await fixture(t);
  await writeFile(path.join(outputDirectory, 'gnd.json'), '{"old":true}');
  let calls = 0;
  await runExport({ outputDirectory, reuseXml: true,
    transform: () => assert.fail('unchanged XML must not be transformed again'),
    enrich: async ({ output }) => {
      assert.equal(output, outputDirectory);
      calls++;
      await writeFile(path.join(output, 'gnd.json'), '{"rebuilt":true}');
      return { stats };
    },
    logger: { info() {} },
  });
  assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(await readFile(path.join(outputDirectory, 'status.json'), 'utf8')), status);
  assert.deepEqual(JSON.parse(await readFile(path.join(outputDirectory, 'gnd.json'), 'utf8')), { rebuilt: true });
});

for (const scenario of ['miss', 'missing', 'corrupt', 'failed']) {
  test(`XML cache ${scenario} reruns transformation before GND enrichment`, async (t) => {
    const { outputDirectory } = await fixture(t);
    if (scenario === 'missing') await rm(path.join(outputDirectory, 'search.json'));
    if (scenario === 'corrupt') await writeFile(path.join(outputDirectory, 'catalog.json'), '{broken');
    if (scenario === 'failed') await writeFile(path.join(outputDirectory, 'status.json'), '{"state":"failure"}');
    const calls = [];
    await runExport({ outputDirectory, reuseXml: scenario !== 'miss',
      transform: async (options) => { assert.equal(options.outputDirectory, outputDirectory); calls.push('transform'); },
      enrich: async () => { calls.push('enrich'); return { stats }; },
    });
    assert.deepEqual(calls, ['transform', 'enrich']);
  });
}

test('failed transformations stop the build before GND enrichment', async () => {
  await assert.rejects(runExport({ reuseXml: false,
    transform: async () => { throw new Error('Invalid XML'); },
    enrich: () => assert.fail('failed XML must not be enriched'),
  }), /Invalid XML/);
});
