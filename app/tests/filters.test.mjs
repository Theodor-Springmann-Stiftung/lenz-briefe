import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readState,matches,queryFor,orderedRecords,hasFilters,withFilters,removeFilter,selectReferenceFilter} from '../src/lib/filters.mjs';
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
  const state = {group:'1776',people:['1','4'],places:['3','5'],sort:'desc'};
  assert.deepEqual(readState(queryFor(state),records,['1776','1777-1779']),state);
});
test('OR within a filter, AND across filters and years', () => {
  const state = {group:'1776',people:['1','4'],places:['5']};
  assert.deepEqual(records.filter(r=>matches(r,state)).map(r=>r.id),['2']);
});
test('unknown and duplicate parameters are normalized', () => {
  assert.deepEqual(readState('?group=no&person=2&person=2&person=999&place=5&sort=invalid',records,['1776']),{group:'1776',people:['2'],places:['5'],sort:'asc'});
});
test('the first year group is the default and all years is an explicit shareable choice', () => {
  assert.equal(readState('',records,['1776','1777-1779']).group,'1776');
  const state = {group:'all',people:[],places:[],sort:'asc'};
  assert.equal(queryFor(state),'group=all');
  assert.deepEqual(readState(queryFor(state),records,['1776','1777-1779']),state);
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
test('adding, changing and clearing filters returns to all years and preserves sorting', () => {
  const state = {group:'1777-1779',people:['1'],places:[],sort:'desc'};
  for (const [people,places] of [[['2'],[]],[['1'],['3']],[[],[]]]) {
    const next = withFilters(state,people,places);
    assert.deepEqual(next,{group:'all',people,places,sort:'desc'});
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
