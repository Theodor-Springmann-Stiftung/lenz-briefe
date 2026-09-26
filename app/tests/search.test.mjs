import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearch, prepareSearch, searchBlocks, matchRanges, searchPreview, matchPages, metadataSearchBlocks, searchSection, defaultSearchSection} from '../src/lib/search.mjs';

test('accordion defaults to text, then transmission, then metadata within the active filters', () => {
  const hits = [{letter:'1',kind:'metadata'}, {letter:'2',kind:'tradition'}, {letter:'3',kind:'text'}];
  assert.equal(defaultSearchSection(hits, ['1','2','3']), 'text');
  assert.equal(defaultSearchSection(hits, ['1','2']), 'tradition');
  assert.equal(defaultSearchSection(hits, ['1']), 'metadata');
  assert.equal(defaultSearchSection(hits, ['4']), null);
  assert.equal(defaultSearchSection([{letter:'1',kind:'sidenote'}], ['1']), 'text');
});

test('metadata search covers correspondents, places, dates, number and sources', () => {
  const letter = {letter:'20', hasOriginal:true, isDraft:true, isProofread:true,
    traditions:[{isOriginal:true, type:'manuscript'}, {isOriginal:false, type:'print'}],
    events:[
      {type:'sent', persons:[{label:'Johann Christian Lenz', annotationText:'Bruder'}],
        locations:[{label:'Arensburg [Kuressaare]'}], dates:[{text:'24. September 1772'}]},
      {type:'received', persons:[{label:'Jakob Michael Reinhold Lenz'}],
        locations:[{label:'Fort Louis'}], dates:[]},
    ]};
  const blocks = prepareSearch(metadataSearchBlocks([letter]));
  for (const [query, label] of [['Christian Lenz','Absender'], ['Reinhold','Empfänger'],
    ['kuressaare','Absendeort'], ['Fort Louis','Empfangsort'], ['September 1772','Absendedatum'],
    ['LKB 20','Briefnummer'], ['Original','Quelle'], ['Druck','Quelle'], ['Entwurf','Status']]) {
    const hits = searchBlocks(blocks, query);
    assert.equal(hits.length, 1, query);
    assert.equal(hits[0].label, label);
    assert.equal(hits[0].kind, 'metadata');
    assert.equal(hits[0].letter, '20');
  }
  assert.equal(searchBlocks(blocks, '1772 Jakob').length, 0);
});

test('letter numbers require an exact number, with or without the LKB prefix', () => {
  const blocks = prepareSearch(metadataSearchBlocks(['2', '20', '120', '201'].map(letter => ({
    letter, events: [], traditions: [],
  }))));
  for (const query of ['20', 'LKB 20', 'lkb 20']) {
    assert.deepEqual(searchBlocks(blocks, query).map(hit => hit.letter), ['20']);
  }
  assert.deepEqual(searchBlocks(blocks, '2').map(hit => hit.letter), ['2']);
  for (const query of ['LKB', '0', '12', '020']) {
    assert.equal(searchBlocks(blocks, query).length, 0, query);
  }
});

test('metadata precedes text hits and is not included in the text section', () => {
  const blocks = prepareSearch([
    ...metadataSearchBlocks([{letter:'1', events:[{type:'sent', persons:[{label:'Goethe'}], locations:[], dates:[]}], traditions:[]}]),
    {letter:'2', kind:'text', text:'Goethe'}, {letter:'3', kind:'sidenote', text:'Goethe'},
    {letter:'4', kind:'tradition', text:'Goethe'},
  ]);
  assert.deepEqual(searchBlocks(blocks, 'Goethe').map(hit => searchSection(hit.kind)), ['metadata','text','text','tradition']);
});

test('literal substring search ignores case, Unicode punctuation and whitespace', () => {
  const blocks = prepareSearch([{text: 'Mein, lieber\u00a0Freund!'}, {text: 'Kein Freund'}]);
  assert.equal(searchBlocks(blocks, 'MEINLIEBER freund').length, 1);
  assert.equal(searchBlocks(blocks, 'lieberfr').length, 1);
  assert.equal(normalizeSearch('„Ja“—nein…\n!'), 'janein');
  assert.equal(searchBlocks(blocks, ' \n…?!').length, 0);
  assert.equal(searchBlocks(blocks, '.*').length, 0);
  assert.notEqual(normalizeSearch('schön'), normalizeSearch('schon'));
  assert.notEqual(normalizeSearch('Straße'), normalizeSearch('Strasse'));
});

test('search cannot bridge independently exported blocks or table cells', () => {
  const blocks = prepareSearch([{text: 'Mein lieber'}, {text: 'Freund'}]);
  assert.equal(searchBlocks(blocks, 'lieber Freund').length, 0);
});

test('highlight offsets retain punctuation, whitespace and composed/decomposed Unicode', () => {
  const text = '😀 — Mein, lieber\u00a0Freund!';
  const [range] = matchRanges(text, 'meinlieberfreund');
  assert.equal(text.slice(range.start, range.end), 'Mein, lieber\u00a0Freund');
  const decomposed = 'Mit gru\u0308ßendem Herzen';
  const [accent] = matchRanges(decomposed, 'GRÜSSEND'.replace('SS', 'ẞ'));
  assert.equal(decomposed.slice(accent.start, accent.end), 'gru\u0308ßend');
});

test('previews shorten both sides around the first match and mark every visible match', () => {
  const text = 'Vorlauf '.repeat(40) + 'Mein, Freund! Mein Freund.' + ' Nachlauf'.repeat(40);
  const parts = searchPreview(text, 'meinfreund', 35);
  assert.equal(parts[0].text, '… ');
  assert.equal(parts.at(-1).text, ' …');
  assert.deepEqual(parts.filter(p => p.match).map(p => p.text), ['Mein, Freund', 'Mein Freund']);
  assert.ok(parts.map(p => p.text).join('').length < 110);
  assert.deepEqual(searchPreview(text, 'nicht vorhanden'), []);
});

test('overlapping matches do not duplicate preview text', () => {
  const parts = searchPreview('Banana', 'ana');
  assert.equal(parts.map(p => p.text).join(''), 'Banana');
  assert.equal(parts.filter(p => p.match).map(p => p.text).join(''), 'anana');
});

test('page labels identify the match itself, including matches across a page break', () => {
  const block = {text:'Mein lieber Freund', pages:[[0, '1'], [15, '2']]};
  assert.deepEqual(matchPages(block, 'mein'), ['1']);
  assert.deepEqual(matchPages(block, 'Freund'), ['1', '2']);
  assert.deepEqual(matchPages(block, 'und'), ['2']);
  assert.deepEqual(matchPages({text:'Text ohne Seitenmarken'}, 'Text'), []);
  assert.deepEqual(matchPages(block, 'nicht vorhanden'), []);
});
