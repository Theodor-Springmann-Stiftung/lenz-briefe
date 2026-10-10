import test from 'node:test';
import assert from 'node:assert/strict';
import { letterDateLabel, letterDescription, pageTitle } from '../src/lib/page-titles.mjs';

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

test('page metadata preserves menu labels and conjunctions after the LKB prefix', () => {
  assert.equal(pageTitle('Verzeichnis & Suche'), 'LKB – Verzeichnis & Suche');
  assert.equal(pageTitle('Zur Edition'), 'LKB – Zur Edition');
  assert.equal(pageTitle('Seite nicht gefunden'), 'LKB – Seite nicht gefunden');
  assert.equal(pageTitle('Jakob Michael Reinhold Lenz und Friedrich David Lenz an Christian David Lenz, 24. November 1767'),
    'LKB – Jakob Michael Reinhold Lenz und Friedrich David Lenz an Christian David Lenz, 24. November 1767');
});

test('letter descriptions identify the letter and preserve qualified editorial dates', () => {
  const letter = { letter: '5', events: [{ type: 'sent', dates: [{
    text: 'Dorpat (Tartu), wahrscheinlich Ende Januar 1768 [nach dem 24. Januar]',
  }] }] };
  const description = letterDescription(letter, 'Jakob Michael Reinhold Lenz und Obristin von Albedyll an Friedrich David Lenz und Christine Margarethe Lenz');
  assert.match(description, /^Brief 5: Jakob Michael Reinhold Lenz und Obristin von Albedyll an Friedrich David Lenz und Christine Margarethe Lenz,/);
  assert.ok(description.includes('wahrscheinlich Ende Januar 1768 [nach dem 24. Januar]'));
  assert.ok(!description.includes('Dorpat'));
  assert.ok(!description.includes('Original'));
  assert.notEqual(letterDescription({ ...letter, letter: '6' }, 'Unbekannt an Lenz'), description);
});

test('descriptions distinguish drafts and do not invent missing dates', () => {
  const letter = { letter: '200', isDraft: true, events: [{ type: 'received', dates: [{ text: 'Zürich, 11. Mai 1777' }] }] };
  const description = letterDescription(letter, 'Lenz an Unbekannt');
  assert.match(description, /^Briefentwurf 200: Lenz an Unbekannt, Ohne Datierung\./);
  assert.ok(!description.includes('11. Mai'));
});
