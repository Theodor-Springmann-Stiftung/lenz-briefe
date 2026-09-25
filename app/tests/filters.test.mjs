import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readState,matches,queryFor,orderedRecords,hasFilters,withFilters,removeFilter,resetFilters,selectReferenceFilter,normalizeYearGroup} from '../src/lib/filters.mjs';
const records = [
  {id:'1',group:'1776',people:['1','2'],places:['3']},
  {id:'2',group:'1776',people:['2','4'],places:['5']},
  {id:'3',group:'1777-1779',people:['1'],places:['5']},
];
test('reference links replace all filters with the clicked person or place across all years', () => {
  const state = {group:'1776',people:['2','4'],places:['3'],sort:'desc'};
  const person = selectReferenceFilter(state,'person','1');
  const place = selectReferenceFilter(state,'place','5');
  assert.deepEqual(person,{group:'all',people:['1'],places:[],sort:'desc'});
  assert.deepEqual(place,{group:'all',people:[],places:['5'],sort:'desc'});
  assert.deepEqual(selectReferenceFilter(person,'person','1'),person);
  assert.deepEqual(records.filter(r=>matches(r,person)).map(r=>r.id),['1','3']);
  assert.deepEqual(records.filter(r=>matches(r,place)).map(r=>r.id),['2','3']);
  for (const next of [person,place]) {
    assert.deepEqual(readState(queryFor(next),records,['1776','1777-1779']),next);
  }
  assert.deepEqual(state,{group:'1776',people:['2','4'],places:['3'],sort:'desc'});
});
test('query state round-trips multiple filters and groups', () => {
  const state = {group:'all',people:['1','4'],places:['3','5'],sort:'desc'};
  assert.deepEqual(readState(queryFor(state),records,['1776','1777-1779']),state);
});
test('search URLs survive filters, sorting and history, and default to all years', () => {
  const state = readState('?q=Mein%2C+Freund!&person=2', records, ['1776','1777-1779']);
  assert.equal(state.group, 'all');
  assert.equal(state.q, 'Mein, Freund!');
  assert.deepEqual(readState(queryFor(state), records, ['1776','1777-1779']), state);
  assert.equal(withFilters(state, ['1'], []).q, state.q);
  assert.equal(selectReferenceFilter(state, 'person', '1').q, undefined);
});
test('search pills can be removed independently, and reset clears every active filter', () => {
  const state = {group:'1776', people:['1'], places:['3'], sort:'desc', q:'Mein Freund'};
  const removed = removeFilter(state, 'search');
  assert.deepEqual(removed, {group:'1776', people:['1'], places:['3'], sort:'desc'});
  assert.equal(queryFor(removed).includes('q='), false);
  assert.equal(removeFilter(state, 'person', '1').q, 'Mein Freund');
  assert.deepEqual(resetFilters(state), {group:'all', people:[], places:[], sort:'desc'});
  assert.equal(hasFilters({...state, people:[], places:[]}), true);
  assert.equal(hasFilters({...state, people:[], places:[], q:'  '}), false);
  assert.equal(state.q, 'Mein Freund');
});
test('OR within a filter, AND across filters and years', () => {
  const state = {group:'1776',people:['1','4'],places:['5']};
  assert.deepEqual(records.filter(r=>matches(r,state)).map(r=>r.id),['2']);
});
test('unknown and duplicate parameters are normalized', () => {
  assert.deepEqual(readState('?group=no&person=2&person=2&person=999&place=5&sort=invalid',records,['1776']),{group:'all',people:['2'],places:['5'],sort:'asc'});
});
test('all years is selected exactly while a person, place or search filter is active', () => {
  const groups = ['1776','1777-1779'];
  for (const query of ['', '?group=all', '?group=all&person=999', '?group=all&q=++', '?sort=desc']) {
    assert.equal(readState(query,records,groups).group,'1776');
  }
  assert.equal(readState('?group=1777-1779&sort=desc',records,groups).group,'1777-1779');
  for (const filter of ['person=1','place=5','q=Freund']) {
    const state = readState(`?group=1776&${filter}`,records,groups);
    assert.equal(state.group,'all');
    assert.equal(hasFilters(state),true);
    assert.deepEqual(readState(queryFor(state),records,groups),state);
    assert.equal(normalizeYearGroup({...state,group:'1777-1779'},groups).group,'all');
    assert.equal(normalizeYearGroup(resetFilters(state),groups).group,'1776');
  }
});
test('removing the last filter restores the first group; remaining filters keep all years', () => {
  const groups = ['1776','1777-1779'];
  const initial = readState('?person=1&place=5&q=Freund&sort=desc',records,groups);
  const noPerson = normalizeYearGroup(removeFilter(initial,'person','1'),groups);
  const noPlace = normalizeYearGroup(removeFilter(noPerson,'place','5'),groups);
  const noSearch = normalizeYearGroup(removeFilter(noPlace,'search'),groups);
  assert.deepEqual([initial.group,noPerson.group,noPlace.group,noSearch.group],['all','all','all','1776']);
  assert.equal(noSearch.sort,'desc');
  assert.deepEqual(readState(queryFor(initial),records,groups),initial);
  assert.deepEqual(readState(queryFor(noSearch),records,groups),noSearch);
});
test('chronological sorting reverses filtered results without mutating the catalog', () => {
  const state = {group:'all',people:['1'],places:[],sort:'desc'};
  assert.deepEqual(orderedRecords(records,state.sort).filter(r=>matches(r,state)).map(r=>r.id),['3','1']);
  assert.deepEqual(orderedRecords(records,'asc').map(r=>r.id),['1','2','3']);
  assert.deepEqual(records.map(r=>r.id),['1','2','3']);
});
test('reset includes every letter and results retain input order', () => {
  assert.deepEqual(records.filter(r=>matches(r,{group:'all',people:[],places:[]})),records);
});
test('years and sorting alone never count as an active filter', () => {
  for (const group of ['1776','1777-1779','all']) {
    assert.equal(hasFilters({group,people:[],places:[],sort:'desc'}),false);
  }
  assert.equal(hasFilters({people:['1'],places:[]}),true);
  assert.equal(hasFilters({people:[],places:['3']}),true);
});
test('filter changes preserve sorting and normalize the active year selection', () => {
  const state = {group:'1777-1779',people:['1'],places:[],sort:'desc'};
  for (const [people,places] of [[['2'],[]],[['1'],['3']],[[],[]]]) {
    const next = normalizeYearGroup(withFilters(state,people,places),['1776','1777-1779']);
    assert.deepEqual(next,{group:people.length || places.length ? 'all' : '1776',people,places,sort:'desc'});
    assert.deepEqual(readState(queryFor(next),records,['1776','1777-1779']),next);
  }
  assert.equal(state.group,'1777-1779');
});
test('year availability counts matches across the active person and place filters', () => {
  const state = {group:'all',people:['2'],places:['5'],sort:'asc'};
  const counts = ['1776','1777-1779','all'].map(group => records.filter(r=>matches(r,{...state,group})).length);
  assert.deepEqual(counts,[1,0,1]);
  assert.deepEqual(['1776','1777-1779'].map(group => records.filter(r=>matches(r,{...withFilters(state,[],[]),group})).length),[2,1]);
});
test('removing a pill preserves other selections, including the same ID in another category', () => {
  const state = {group:'1776',people:['1','2'],places:['1','3'],sort:'desc'};
  const next = removeFilter(state,'person','1');
  assert.deepEqual(next,{group:'all',people:['2'],places:['1','3'],sort:'desc'});
  assert.deepEqual(removeFilter(next,'place','1'),{group:'all',people:['2'],places:['3'],sort:'desc'});
  assert.deepEqual(state.people,['1','2']);
  assert.equal(hasFilters(removeFilter({group:'1776',people:[],places:['3'],sort:'asc'},'place','3')),false);
});
