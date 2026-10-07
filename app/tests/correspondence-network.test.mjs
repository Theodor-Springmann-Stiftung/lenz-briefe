import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correspondenceStar } from '../src/lib/correspondence-network.mjs';

test('only visible letters contribute partners and repeated correspondence strengthens an edge', () => {
  const graph = correspondenceStar([
    { id: 'a', senders: ['1', '1'], recipients: ['2', '2'] },
    { id: 'b', senders: ['2'], recipients: ['1'] },
    { id: 'c', senders: ['1'], recipients: ['3'] },
  ], new Set(['a', 'b']), { '1': 'Lenz', '2': 'Goethe', '3': 'Herder' }, '1');
  assert.deepEqual(graph.nodes.map(node => [node.id, node.count]), [['1', 2], ['2', 2]]);
  assert.deepEqual(graph.edges, [{ source: '1', target: '2', count: 2 }]);
});

test('unknown partners and self connections do not create spurious edges', () => {
  const graph = correspondenceStar([
    { id: 'a', senders: ['1', 'missing'], recipients: ['1', '2'] },
  ], new Set(['a']), { '1': 'Lenz', '2': 'Goethe' }, '1');
  assert.equal(graph.nodes.length, 2);
  assert.deepEqual(graph.edges, [{ source: '1', target: '2', count: 1 }]);
  assert.deepEqual(correspondenceStar([], new Set(), {}, '1'), { nodes: [], edges: [] });
});

test('joint letters produce one spoke per partner and no partner-to-partner connections', () => {
  const graph = correspondenceStar([
    { id: 'a', senders: ['1', '2'], recipients: ['3', '3'] },
    { id: 'b', senders: ['2'], recipients: ['3'] },
  ], new Set(['a', 'b']), { '1': 'Lenz', '2': 'Goethe', '3': 'Herder' }, '1');
  assert.deepEqual(graph.edges, [
    { source: '1', target: '2', count: 1 },
    { source: '1', target: '3', count: 1 },
  ]);
  assert.equal(graph.nodes.find(node => node.id === '1').count, 1);
});
