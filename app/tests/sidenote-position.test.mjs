import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderSidenotePosition, expandSidenotePositions, sidenoteRotations } from '../src/lib/sidenote-position.mjs';

const source = readFileSync(new URL('../src/assets/SidenotePos.svg', import.meta.url), 'utf8');

test('every position uses the original SVG with only the page and chosen layer active', () => {
  for (const position of [
    'top-left',
    'top',
    'top-right',
    'right',
    'left',
    'bottom-left',
    'bottom',
    'bottom-right',
  ]) {
    const html = renderSidenotePosition(source, position);
    assert.match(html, /viewBox="0 0 56\.708019 67\.859528"/);
    const active = [...html.matchAll(/data-layer="([^"]+)" data-active="true"/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(active.sort(), ['page', position].sort());
    assert.ok(!/\sid="/.test(html));
    assert.equal(
      expandSidenotePositions(
        `<div><lkb-sidenote-position position="${position}"></lkb-sidenote-position></div>`,
        source,
      ),
      `<div>${html}</div>`,
    );
  }
});

test('code examples and comments remain literal; invalid positions fail clearly', () => {
  const html =
    '<code>&lt;lkb-sidenote-position position="top"&gt;&lt;/lkb-sidenote-position&gt;</code><!-- <lkb-sidenote-position position="top"></lkb-sidenote-position> -->';
  assert.equal(expandSidenotePositions(html, source), html);
  assert.throws(() => renderSidenotePosition(source, 'unknown'), /Unknown sidenote position/);
});

test('rotation icons use the shortest turn and preserve distinct source angles', () => {
  assert.deepEqual(sidenoteRotations('<span class="tr" data-rot="270">A</span><span class="tr" data-rot="270">B</span><span class="tr" data-rot="0">C</span>'), [270]);
  assert.match(renderSidenotePosition(source, 'left', [270]), /--sidenote-turn: -90deg/);
  assert.match(renderSidenotePosition(source, 'right', [90]), /--sidenote-turn: 90deg/);
  assert.match(renderSidenotePosition(source, 'top', [180]), /--sidenote-turn: 180deg/);
  assert.match(renderSidenotePosition(source, 'left', [270]), /data-turn-direction="counterclockwise"/);
  assert.match(renderSidenotePosition(source, 'left', [270]), /tabindex="0"/);
  assert.doesNotMatch(renderSidenotePosition(source, 'left'), /data-rotatable/);
  const mixed = renderSidenotePosition(source, 'left', [90, 270]);
  assert.match(mixed, /90° im Uhrzeigersinn.*90° gegen den Uhrzeigersinn/);
  assert.doesNotMatch(mixed, /--sidenote-turn/);
});
