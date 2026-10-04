import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, projectPlace, gndCoordinates, buildCorrespondenceMap, fitLetterMap, alternateLetterMapFit, mapImagePoint, routeLabelPositions, combinedRouteDot, mergeLetterMapDots, curvedRoute } from '../src/lib/correspondence-map.mjs';

test('label bounds clear routes and arrowheads in every direction, including near-coincident endpoints', () => {
  const a = { x:180, y:100 };
  for (const delta of [{x:0,y:80},{x:0,y:-80},{x:100,y:0},{x:-100,y:0},
    {x:100,y:60},{x:-100,y:-60},{x:0.1,y:0.1},{x:0,y:0}]) {
    const b = {x:a.x+delta.x,y:a.y+delta.y};
    for (const label of routeLabelPositions(a,b)) {
      // Conservative 11px font box + halo; reserve 8px around the arrow.
      assert.ok(label.y + 5 < Math.min(a.y,b.y) - 8 || label.y - 14 > Math.max(a.y,b.y) + 8);
    }
  }
  assert.equal(routeLabelPositions(a,a,true)[0].y,125);
});

test('letter crops preserve padding and aspect ratio for horizontal, vertical and local routes', () => {
  for (const points of [[{x:300,y:400},{x:1000,y:405}], [{x:600,y:300},{x:601,y:800}], [{x:500,y:600},{x:500,y:600}]]) {
    const fit = fitLetterMap(points);
    assert.ok(Number.isFinite(fit.scale) && fit.scale > 0 && fit.scale <= 0.65);
    for (const point of points) {
      const x = point.x * fit.scale + fit.x, y = point.y * fit.scale + fit.y;
      assert.ok(x >= 48 - 1e-8 && x <= 212 + 1e-8);
      assert.ok(y >= 48 - 1e-8 && y <= 152 + 1e-8);
    }
  }
  const registered = mapImagePoint({x:0,y:0});
  assert.ok(registered.x > 0 && registered.x < 4);
  assert.ok(registered.y > 0 && registered.y < 4);
});

test('same-place letters stay wide while close-route zoom is capped to retain geography', () => {
  const place = { x:500, y:600 };
  const same = fitLetterMap([place, place]);
  const distinct = fitLetterMap([place, { x:510, y:610 }]);
  assert.equal(same.scale, 0.38);
  assert.ok(Math.abs(distinct.scale * Math.hypot(10,10) - 24) < 1e-8);
  assert.equal(fitLetterMap([place, {x:600,y:650}]).scale, 0.65);
  for (const delta of [{x:0.01,y:0}, {x:0,y:0.01}, {x:1,y:1}]) {
    const close = fitLetterMap([place, {x:place.x+delta.x,y:place.y+delta.y}]);
    assert.equal(close.scale, 3);
    assert.ok(close.x <= 0 && close.y <= 0);
    assert.ok(close.x + MAP.width * close.scale >= 260);
    assert.ok(close.y + MAP.height * close.scale >= 200);
  }
  assert.equal(place.x * same.scale + same.x, 130);
  assert.equal(place.y * same.scale + same.y, 100);
});

test('Berka–Weimar retains regional context without changing ordinary route zoom', () => {
  const berka = mapImagePoint(projectPlace(11.2825, 50.899722));
  const weimar = mapImagePoint(projectPlace(11.329029, 50.980299));
  assert.equal(fitLetterMap([berka, weimar]).scale, 3);
  assert.equal(fitLetterMap([weimar, weimar]).scale, 0.38);
  const strasbourg = mapImagePoint(projectPlace(7.75, 48.58));
  assert.equal(fitLetterMap([strasbourg, weimar]).scale, 0.65);
});

test('map crops pan inward at every edge, including the Moscow letter 366', () => {
  for (const point of [{x:996.9963,y:447.5272}, {x:100,y:600}, {x:1300,y:600}, {x:700,y:100}, {x:700,y:1100}]) {
    const fit = fitLetterMap([point,point]);
    assert.equal(fit.scale, 0.38);
    assert.ok(fit.x <= 0 && fit.y <= 0);
    assert.ok(fit.x + MAP.width * fit.scale >= 260 - 1e-8);
    assert.ok(fit.y + MAP.height * fit.scale >= 200 - 1e-8);
    assert.ok(point.x * fit.scale + fit.x >= 0 && point.x * fit.scale + fit.x <= 260);
    assert.ok(point.y * fit.scale + fit.y >= 0 && point.y * fit.scale + fit.y <= 200);
  }
});

test('LAEA projection centre matches EPSG:3035 false easting/northing with screen y reversed', () => {
  const point = projectPlace(10, 52);
  assert.ok(Math.abs(point.x / MAP.width * (MAP.xmax - MAP.xmin) + MAP.xmin - 4321000) < 0.01);
  assert.ok(Math.abs(MAP.ymax - point.y / MAP.height * (MAP.ymax - MAP.ymin) - 3210000) < 0.01);
  assert.ok(projectPlace(11, 52).x > point.x);
  assert.ok(projectPlace(10, 53).y < point.y);
  assert.equal(projectPlace(NaN, 52), null);
  assert.equal(projectPlace(10, 100), null);
});

test('GND WKT uses longitude then latitude and rejects non-place or invalid geometry', () => {
  const record = { type: ['PlaceOrGeographicName'], hasGeometry: [{ asWKT: ['Point ( +026.725090 +058.380620 )'] }] };
  assert.deepEqual(gndCoordinates(record), { longitude: 26.72509, latitude: 58.38062 });
  assert.equal(gndCoordinates({ ...record, type: ['Person'] }), null);
  assert.equal(gndCoordinates({ ...record, hasGeometry: [{ asWKT: ['Point ( 8 999 )'] }] }), null);
});

test('one route per letter preserves repeated and local correspondence, omits drafts and unresolved alternatives', () => {
  const places = { a: { name: 'A', ref: 'gnd:a' }, b: { name: 'B', ref: null } };
  const saved = Object.fromEntries(Object.entries(places).map(([id, p]) => [id, { name: p.name, reference: p.ref, longitude: 10, latitude: 52 }]));
  const letter = (id, from, to, isDraft = false) => ({ letter: id, isDraft, events: [
    { type: 'sent', locations: from.map(ref => ({ ref })) }, { type: 'received', locations: to.map(ref => ({ ref })) },
  ] });
  const network = buildCorrespondenceMap({ places, letters: [letter('1', ['a'], ['b']), letter('2', ['a'], ['b']),
    letter('3', ['a'], ['a']), letter('4', ['a'], ['b'], true), letter('5', ['a', 'b'], ['b']),
    letter('6', [], ['b']), letter('7', ['a'], ['unknown'])] }, saved);
  assert.deepEqual(network.routes.map(r => r.letter), ['1', '2', '3']);
  assert.equal(network.omitted.length, 4);
  assert.equal(buildCorrespondenceMap({ places: { a: { name: 'Changed', ref: 'gnd:a' } }, letters: [] }, saved).places.length, 0);
});

test('curved route tangents point at dot centres and preserve endpoint gaps', () => {
  const source = {x:130, y:100};
  for (const target of [{x:200,y:160}, {x:70,y:30}, {x:130,y:150}, {x:154,y:100}]) {
    const {start,end,control} = curvedRoute(source,target);
    for (const [point, endpoint, gap] of [[source,start,4], [target,end,4.5]]) {
      const ux = endpoint.x - control.x, uy = endpoint.y - control.y;
      const vx = point.x - endpoint.x, vy = point.y - endpoint.y;
      assert.ok(Math.abs(ux * vy - uy * vx) < 1e-8);
      assert.ok(ux * vx + uy * vy > 0);
      assert.ok(Math.abs(Math.hypot(vx,vy) - gap) < 1e-8);
    }
  }
});


test('click zoom is available only for close routes and keeps the map covering its frame', () => {
  for (const points of [
    [{x:500,y:600},{x:502,y:601}],
    [{x:200,y:300},{x:1000,y:800}],
    [{x:1300,y:100},{x:1300,y:100}],
  ]) {
    const initial = fitLetterMap(points);
    const alternate = alternateLetterMapFit(points, initial);
    if (initial.scale <= 0.65) {
      assert.equal(alternate, null);
      continue;
    }
    assert.ok(alternate.scale < initial.scale);
    assert.ok(alternate.x <= 0 && alternate.y <= 0);
    assert.ok(alternate.x + MAP.width * alternate.scale >= 260 - 1e-8);
    assert.ok(alternate.y + MAP.height * alternate.scale >= 200 - 1e-8);
  }
});


test('overlapping and same-place endpoints use a combined dot, while separated endpoints remain distinct', () => {
  const a = {x:100, y:100};
  assert.deepEqual(combinedRouteDot(a, {x:103, y:104}), {x:101.5, y:102});
  assert.equal(combinedRouteDot(a, {x:106, y:100}), null);
  assert.deepEqual(combinedRouteDot(a, a, true), a);
  assert.deepEqual(combinedRouteDot(a, a), a);
});

test('letter map merges touching chains of any size and preserves all place roles and IDs', () => {
  const dots = [
    {id:'a', x:0, y:0, source:true, target:false},
    {id:'b', x:5.625, y:0, source:false, target:true},
    {id:'c', x:10.625, y:0, source:false, target:true},
    {id:'d', x:30, y:0, source:true, target:false},
  ];
  const groups = mergeLetterMapDots(dots);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], {x:16.25 / 3, y:0, ids:['a','b','c'], source:true, target:true, merged:true});
  assert.deepEqual(groups[1], {x:30, y:0, ids:['d'], source:true, target:false, merged:false});
  assert.deepEqual(mergeLetterMapDots([...dots].reverse()).map(group => [...group.ids].sort()).sort(),
    groups.map(group => [...group.ids].sort()).sort());
});

test('letter map touching thresholds include borders for targets, origins, and shared places', () => {
  for (const [first, second, distance] of [
    [{source:false,target:true}, {source:false,target:true}, 5],
    [{source:true,target:false}, {source:true,target:false}, 6.25],
    [{source:true,target:false}, {source:false,target:true}, 5.625],
    [{source:true,target:true}, {source:false,target:true}, 6.5],
    [{source:true,target:true}, {source:true,target:false}, 7.125],
  ]) {
    const dots = [{id:'a',x:0,y:0,...first}, {id:'b',x:distance,y:0,...second}];
    const [group] = mergeLetterMapDots(dots);
    assert.deepEqual(group.ids, ['a','b']);
    assert.equal(group.source, first.source || second.source);
    assert.equal(group.target, first.target || second.target);
    assert.equal(mergeLetterMapDots([dots[0], {...dots[1],x:distance + 0.000001}]).length, 2);
  }
});

test('letter map does not extend merging to nearby dots because a group marker is larger', () => {
  const dots = [0, 1, 6.1].map((x, i) => ({id:String(i), x, y:0, source:false, target:true}));
  assert.deepEqual(mergeLetterMapDots(dots).map(group => group.ids), [['0','1'], ['2']]);
  assert.equal(mergeLetterMapDots(dots.map(dot => ({...dot, x:dot.x * 10}))).length, 3);
  assert.deepEqual(mergeLetterMapDots([{id:'shared',x:2,y:3,source:true,target:true}]),
    [{x:2,y:3,ids:['shared'],source:true,target:true,merged:false}]);
});

test('letter map groups three targets or three origins and measures circular contact diagonally', () => {
  for (const source of [false, true]) {
    const dots = [0, 5, 10].map((x, i) => ({id:String(i), x, y:0, source, target:!source}));
    assert.deepEqual(mergeLetterMapDots(dots), [{x:5,y:0,ids:['0','1','2'],source,target:!source,merged:true}]);
  }
  const a = {id:'a',x:0,y:0,source:false,target:true};
  assert.equal(mergeLetterMapDots([a, {...a,id:'b',x:3,y:4}]).length, 1);
  assert.equal(mergeLetterMapDots([a, {...a,id:'b',x:4,y:4}]).length, 2);
});
