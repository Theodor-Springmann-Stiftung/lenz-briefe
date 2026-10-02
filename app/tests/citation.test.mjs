import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citationDate, citationFor } from '../src/lib/citation.ts';

test('uses a German sent date from when without timezone shifts', () => {
  assert.equal(
    citationDate({ when: '1765-01-02', text: 'Dorpat, different date' }),
    '02.01.1765',
  );
});
test('fallback removes only the prefix through the first comma and space', () => {
  assert.equal(
    citationDate({ text: 'Berka, Anfang August 1776 [empfangen am 13. August]' }),
    'Anfang August 1776 [empfangen am 13. August]',
  );
  assert.equal(citationDate({ text: 'Anfang August 1776' }), 'Anfang August 1776');
  assert.equal(
    citationDate({ when: '1776-02-31', text: 'Ort, Ende Februar 1776' }),
    'Ende Februar 1776',
  );
  assert.equal(
    citationDate({ text: 'Ort, 2. September und Landau, 2. Oktober 1772' }),
    '2. September und Landau, 2. Oktober 1772',
  );
});
test('follows the citation pattern and ignores received dates', () => {
  const person = (label) => ({ label });
  const letter = {
    events: [
      {
        type: 'sent',
        persons: [person('Lenz')],
        locations: [person('Dorpat')],
        dates: [{ when: '1765-01-02', text: 'Dorpat, 2. Januar 1765' }],
      },
      {
        type: 'received',
        persons: [person('Gadebusch')],
        locations: [person('Dorpat')],
        dates: [{ when: '1765-01-05', text: '' }],
      },
    ],
  };
  assert.equal(
    citationFor(letter),
    'Lenz, Dorpat, an Gadebusch, Dorpat, 02.01.1765, in: Jakob Michael Reinhold Lenz: Kritische Briefausgabe, hrsg. v. Gregor Babelotzky (Heidelberg 2026ff).',
  );
});
test('handles missing places and dates without empty punctuation', () => {
  assert.ok(citationFor({ events: [] }).startsWith('Unbekannt, an Unbekannt, Ohne Datierung, in:'));
});
