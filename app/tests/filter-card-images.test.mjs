import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindFilterCardImages } from '../src/lib/filter-card-images.mjs';

function image(src, properties = {}) {
  const element = Object.assign(new EventTarget(), {
    src, complete: false, currentSrc: '', naturalWidth: 0, column: { hidden: false },
    ...properties,
  });
  element.closest = () => element.column;
  return element;
}
const root = (...images) => ({ querySelectorAll: () => images });

test('a failed image hides its whole column without hiding another card image', () => {
  const bad = image('https://example.org/missing.jpg');
  const good = image('https://example.org/good.jpg', { naturalWidth: 270 });
  bindFilterCardImages(root(bad, good), new Set());
  bad.dispatchEvent(new Event('error'));
  good.dispatchEvent(new Event('load'));
  assert.equal(bad.column.hidden, true);
  assert.equal(good.column.hidden, false);
});

test('already failed and zero-width images are hidden, while pending lazy images remain visible', () => {
  const cached = image('https://example.org/cached.jpg', { complete: true, currentSrc: 'https://example.org/cached.jpg' });
  const pending = image('https://example.org/lazy.jpg', { complete: true });
  const invalid = image('https://example.org/invalid.jpg');
  bindFilterCardImages(root(cached, pending, invalid), new Set());
  invalid.dispatchEvent(new Event('load'));
  assert.equal(cached.column.hidden, true);
  assert.equal(invalid.column.hidden, true);
  assert.equal(pending.column.hidden, false);
});

test('rebuilding a selected card does not restore an image known to have failed', () => {
  const failed = new Set();
  const first = image('https://example.org/missing.jpg');
  bindFilterCardImages(root(first), failed);
  first.dispatchEvent(new Event('error'));
  const next = image(first.src);
  bindFilterCardImages(root(next), failed);
  assert.equal(next.column.hidden, true);
});
