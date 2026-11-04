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

console.log('astar-engine tests passed');
