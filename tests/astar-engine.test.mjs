import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const enginePath = path.resolve(here, '../algorithms/astar/astar-engine.js');
const sandbox = { window: {}, performance, console };
vm.runInNewContext(fs.readFileSync(enginePath, 'utf8'), sandbox, { filename: enginePath });
const E = sandbox.window.AStarEngine;

assert.ok(E, 'AStarEngine should be exported');
assert.equal(E.GRID_SIZE, 20);
assert.equal(E.CELL_COUNT, 400);

const start = { x: 3, y: 10 };
const end = { x: 16, y: 10 };

// 1. Empty grid: shortest path is 13 moves.
const empty = E.createWallGrid();
const openResult = E.findPathTrace(empty, start, end);
assert.equal(openResult.found, true);
assert.equal(openResult.metrics.pathMoves, 13);
assert.equal(openResult.path.length, 14);
assert.equal(openResult.path[0], E.toKey(start.x, start.y));
assert.equal(openResult.path.at(-1), E.toKey(end.x, end.y));
assert.equal(openResult.visited.length, openResult.events.filter((event) => event.type === 'expand').length);
assert.equal(openResult.events.at(-1).type, 'done');
assert.equal(openResult.events.at(-1).found, true);
assert.ok(openResult.metrics.computeMs >= 0);

// 2. Event indices and f = g + h.
openResult.events.forEach((event, index) => assert.equal(event.i, index));
for (const event of openResult.events) {
  if (event.type === 'expand') {
    assert.equal(event.f, event.g + event.h);
    const sorted = event.openTop.every((item, index, list) => {
      if (index === 0) return true;
      const prev = list[index - 1];
      if (prev.f !== item.f) return prev.f < item.f;
      if (prev.h !== item.h) return prev.h < item.h;
      return prev.key < item.key;
    });
    assert.ok(sorted, 'openTop should be sorted by f/h/key');
  }
}

// 3. Blocked end.
const blocked = E.createWallGrid();
blocked[10][15] = true;
blocked[10][17] = true;
blocked[9][16] = true;
blocked[11][16] = true;
const blockedResult = E.findPathTrace(blocked, start, end);
assert.equal(blockedResult.found, false);
assert.equal(blockedResult.path.length, 0);
assert.equal(blockedResult.events.at(-1).type, 'done');
assert.equal(blockedResult.events.at(-1).found, false);
assert.equal(E.hasPath(blocked, start, end), false);

// 4. Deterministic repeat.
const again = E.findPathTrace(empty, start, end);
assert.deepEqual(again.visited, openResult.visited);
assert.deepEqual(again.path, openResult.path);

// 5. Helpers.
assert.equal(E.fromKey(E.toKey(7, 13)).x, 7);
assert.equal(E.fromKey(E.toKey(7, 13)).y, 13);
assert.equal(E.manhattan(0, 0, 3, 4), 7);
assert.equal(E.hasPath(empty, start, end), true);
assert.equal(E.hasPath(E.generateRandomWalls(start, end), start, end), true);

// 6. P1 comparison metrics.
const compare = E.compareAlgorithms(empty, start, end);
for (const name of ['astar', 'bfs', 'dijkstra']) {
  assert.equal(compare[name].found, true, `${name} should find a path`);
  assert.equal(compare[name].pathMoves, 13, `${name} path should be 13 moves`);
  assert.ok(compare[name].expanded > 0, `${name} should expand nodes`);
}
assert.ok(compare.astar.expanded <= compare.bfs.expanded, 'A* should not expand more than BFS here');

const compareBlocked = E.compareAlgorithms(blocked, start, end);
for (const name of ['astar', 'bfs', 'dijkstra']) {
  assert.equal(compareBlocked[name].found, false, `${name} should not find a path`);
}

// 7. Tie-break options are accepted and preserve path length.
const hTrace = E.findPathTrace(empty, start, end, { tieBreak: 'h' });
const keyTrace = E.findPathTrace(empty, start, end, { tieBreak: 'key' });
assert.equal(hTrace.metrics.pathMoves, keyTrace.metrics.pathMoves);
assert.ok(hTrace.visited.length > 0 && keyTrace.visited.length > 0);

// 8. Heuristic weight is accepted; w=0 still finds a path.
const weightedTrace = E.findPathTrace(empty, start, end, { heuristicWeight: 0 });
assert.equal(weightedTrace.found, true);
assert.equal(weightedTrace.metrics.pathMoves, 13);
const weightedCompare = E.compareAlgorithms(empty, start, end, { heuristicWeight: 2 });
assert.equal(weightedCompare.astar.found, true);
assert.ok(weightedCompare.astar.expanded > 0);

console.log('astar-engine tests passed');
