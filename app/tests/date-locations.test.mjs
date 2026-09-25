import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dateLocationParts} from '../src/lib/date-locations.mjs';

test('links the heading location using its XML ID without changing the displayed text', () => {
  assert.deepEqual(dateLocationParts('St. Petersburg, 11. Februar 1780', [{ref:'46', label:'St. Petersburg'}]), [
    {text:'St. Petersburg', placeId:'46'}, {text:', 11. Februar 1780'},
  ]);
  assert.deepEqual(dateLocationParts('Dorpat (Tartu), 2. Januar 1765', [{ref:'1', label:'Dorpat [Tartu]'}]), [
    {text:'Dorpat (Tartu)', placeId:'1'}, {text:', 2. Januar 1765'},
  ]);
});

test('resolves multiple locations by name rather than XML order', () => {
  const text = 'Emmendingen, 23. Dezember 1775; Straßburg, 25. Dezember 1775; Weimar, 8. Januar 1776';
  const parts = dateLocationParts(text, [{ref:'7',label:'Straßburg'}, {ref:'12',label:'Emmendingen'}, {ref:'8',label:'Weimar'}]);
  assert.equal(parts.map(p=>p.text).join(''),text);
  assert.deepEqual(parts.filter(p=>p.placeId).map(p=>p.placeId),['12','7','8']);
});

test('links alternative places separately and leaves unresolved places unchanged', () => {
  const parts = dateLocationParts('Wahrscheinlich Berka oder Kochberg, Oktober 1776', [{ref:'14',label:'Berka'},{ref:'30',label:'Kochberg'}]);
  assert.deepEqual(parts.filter(p=>p.placeId),[{text:'Berka',placeId:'14'},{text:'Kochberg',placeId:'30'}]);
  assert.deepEqual(dateLocationParts('Hinter Frankfurt, Ende März 1776', []),[{text:'Hinter Frankfurt, Ende März 1776'}]);
});
