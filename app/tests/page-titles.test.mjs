import test from 'node:test';
import assert from 'node:assert/strict';
import { letterDateLabel } from '../src/lib/page-titles.mjs';

const label = (...texts) => letterDateLabel([{ type: 'sent', dates: texts.map((text) => ({ text })) }]);

test('letter titles use readable editorial dates, including uncertainty and ranges', () => {
  assert.equal(label('Dorpat (Tartu), 2. Januar 1765'), '2. Januar 1765');
  assert.equal(label('Schinznach, 12. bis 15. Mai 1777'), '12. bis 15. Mai 1777');
  assert.equal(label('Dorpat (Tartu), wahrscheinlich Ende Januar 1768 [nach dem 24. Januar]'), 'wahrscheinlich Ende Januar 1768 [nach dem 24. Januar]');
  assert.equal(label('Unbekannter Ort; nach der Abreise aus Aya [Ahja], wahrscheinlich September/Oktober 1780'), 'wahrscheinlich September/Oktober 1780');
});

test('multiple dates and authors keep their dates without place prefixes', () => {
  assert.equal(label('Weißenburg (Wissembourg), 2. September und Landau, 2. Oktober 1772'), '2. September und 2. Oktober 1772');
  assert.equal(label('Emmendingen, 23. Dezember 1775 (Schlosser); Straßburg, 25. Dezember 1775 (Lenz); Weimar, 8. Januar 1776 (Goethe)'), '23. Dezember 1775 (Schlosser); 25. Dezember 1775 (Lenz); 8. Januar 1776 (Goethe)');
  assert.equal(label('Zürich, 11. Mai 1777', 'Zürich, 11. Mai 1777'), '11. Mai 1777');
});

test('undated letters use the editorial fallback; received dates are not substituted', () => {
  assert.equal(label(), 'Ohne Datierung');
  assert.equal(label('Mai 1777'), 'Mai 1777');
  assert.equal(letterDateLabel([{ type: 'received', dates: [{ text: 'Zürich, 11. Mai 1777' }] }]), 'Ohne Datierung');
});
