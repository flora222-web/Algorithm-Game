'use strict';

/**
 * Pure A* engine with an event trace.
 * The UI consumes events; it should not re-run or duplicate the search.
 */
(() => {
  const GRID_SIZE = 20;
  const CELL_COUNT = GRID_SIZE * GRID_SIZE;
  const DIRECTIONS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  // Kept in sync with the pseudo-code labels used by the UI.
  const CODE_LINES = {
    init: 1,
    pop: 2,
    goal: 3,
    neighbor: 4,
    relax: 5,
    path: 6,
    done: 7
  };

  class MinHeap {
    constructor(compare) {
      this.items = [];
      this.compare = compare;
    }

    get size() {
      return this.items.length;
    }

    push(item) {
      this.items.push(item);
      this.bubbleUp(this.items.length - 1);
    }

    pop() {
      const items = this.items;
      if (items.length === 0) return null;

      const top = items[0];
      const last = items.pop();

      if (items.length > 0) {
        items[0] = last;
        this.bubbleDown(0);
      }

      return top;
    }

    bubbleUp(index) {
      const items = this.items;

      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (this.compare(items[index], items[parent]) >= 0) break;
        [items[index], items[parent]] = [items[parent], items[index]];
        index = parent;
      }
    }

    bubbleDown(index) {
      const items = this.items;
      const length = items.length;

      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;

        if (left < length && this.compare(items[left], items[smallest]) < 0) {
          smallest = left;
        }

        if (right < length && this.compare(items[right], items[smallest]) < 0) {
          smallest = right;
        }

        if (smallest === index) break;

        [items[index], items[smallest]] = [items[smallest], items[index]];
        index = smallest;
      }
    }
  }

  function createNodeComparator(tieBreak = 'h') {
    return function compare(a, b) {
      if (a.f !== b.f) return a.f - b.f;

      if (tieBreak === 'g') {
        if (a.g !== b.g) return b.g - a.g;
        return a.key - b.key;
      }

      if (tieBreak === 'key') {
        return a.key - b.key;
      }

      if (a.h !== b.h) return a.h - b.h;
      return a.key - b.key;
    };
  }

  const compareNodes = createNodeComparator('h');

  function now() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function createWallGrid() {
    return Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => false)
    );
  }

  function toKey(x, y) {
    return y * GRID_SIZE + x;
  }

  function fromKey(key) {
    return {
      x: key % GRID_SIZE,
      y: Math.floor(key / GRID_SIZE)
    };
  }

  function manhattan(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  function isInside(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  }

  function sameCell(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  function isBlocked(walls, x, y, start, end) {
    if (!isInside(x, y)) return true;
    if (sameCell({ x, y }, start) || sameCell({ x, y }, end)) return false;
    return Boolean(walls[y] && walls[y][x]);
  }

  function buildPath(cameFrom, startKey, endKey) {
    const path = [];
    let current = endKey;

    while (current !== -1) {
      path.push(current);
      if (current === startKey) break;
      current = cameFrom[current];
    }

    path.reverse();
    return path[0] === startKey ? path : [];
  }

  function collectOpen(open, closed, gScore) {
    const result = [];

    for (const item of open.items) {
      if (closed[item.key]) continue;
      if (item.g !== gScore[item.key]) continue;
      result.push(item);
    }

    return result;
  }

  function findPathTrace(walls, start, end, options = {}) {
    const tieBreak = options.tieBreak === 'g' || options.tieBreak === 'key'
      ? options.tieBreak
      : 'h';
    const requestedWeight = Number(options.heuristicWeight);
    const heuristicWeight = Number.isFinite(requestedWeight)
      ? Math.max(0, requestedWeight)
      : 1;
    const compare = createNodeComparator(tieBreak);
    const startedAt = now();
    const startKey = toKey(start.x, start.y);
    const endKey = toKey(end.x, end.y);
    const open = new MinHeap(compare);
    const gScore = new Float64Array(CELL_COUNT);
    const cameFrom = new Int32Array(CELL_COUNT);
    const closed = new Uint8Array(CELL_COUNT);
    const visited = [];
    const events = [];
    let eventIndex = 0;
    let expanded = 0;

    gScore.fill(Infinity);
    cameFrom.fill(-1);

    function pushEvent(event) {
      event.i = eventIndex;
      eventIndex += 1;
      events.push(event);
      return event;
    }

    function finish(found, path) {
      const pathMoves = found ? Math.max(0, path.length - 1) : 0;
      pushEvent({
        type: 'done',
        found,
        phase: 'done',
        codeLine: CODE_LINES.done
      });

      return {
        found,
        path,
        visited,
        events,
        metrics: {
          expanded,
          pathMoves,
          computeMs: now() - startedAt
        }
      };
    }

    if (!start || !end || !isInside(start.x, start.y) || !isInside(end.x, end.y)) {
      return finish(false, []);
    }

    const startH = manhattan(start.x, start.y, end.x, end.y);
    gScore[startKey] = 0;
    open.push({ key: startKey, g: 0, h: startH, f: heuristicWeight * startH });

    while (open.size > 0) {
      const current = open.pop();

      // Skip closed nodes and stale heap entries.
      if (closed[current.key] || current.g !== gScore[current.key]) continue;

      closed[current.key] = 1;
      visited.push(current.key);
      expanded += 1;

      const x = current.key % GRID_SIZE;
      const y = Math.floor(current.key / GRID_SIZE);
      const openItems = collectOpen(open, closed, gScore);
      const openTop = openItems
        .slice()
        .sort(compare)
        .slice(0, 5)
        .map((item) => {
          const point = fromKey(item.key);
          return {
            key: item.key,
            x: point.x,
            y: point.y,
            g: item.g,
            h: item.h,
            f: item.f
          };
        });

      const isGoal = current.key === endKey;

      pushEvent({
        type: 'expand',
        key: current.key,
        x,
        y,
        g: current.g,
        h: current.h,
        f: current.f,
        openSize: openItems.length,
        closedCount: expanded,
        openTop,
        phase: isGoal ? 'goal' : 'pop',
        codeLine: isGoal ? CODE_LINES.goal : CODE_LINES.pop
      });

      if (isGoal) {
        const path = buildPath(cameFrom, startKey, endKey);
        if (path.length === 0) return finish(false, []);

        for (let step = 1; step < path.length; step += 1) {
          pushEvent({
            type: 'path',
            key: path[step],
            step,
            phase: 'path',
            codeLine: CODE_LINES.path
          });
        }

        return finish(true, path);
      }

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;

        if (isBlocked(walls, nx, ny, start, end)) continue;

        const neighborKey = toKey(nx, ny);
        if (closed[neighborKey]) continue;

        const tentativeG = current.g + 1;
        if (tentativeG >= gScore[neighborKey]) continue;

        cameFrom[neighborKey] = current.key;
        gScore[neighborKey] = tentativeG;

        const h = manhattan(nx, ny, end.x, end.y);
        open.push({
          key: neighborKey,
          g: tentativeG,
          h,
          f: tentativeG + heuristicWeight * h
        });
      }
    }

    return finish(false, []);
  }

  function searchBfs(walls, start, end) {
    const startedAt = now();

    if (!start || !end || !isInside(start.x, start.y) || !isInside(end.x, end.y)) {
      return { found: false, pathMoves: 0, expanded: 0, computeMs: now() - startedAt };
    }

    const startKey = toKey(start.x, start.y);
    const endKey = toKey(end.x, end.y);
    const parent = new Int32Array(CELL_COUNT);
    const seen = new Uint8Array(CELL_COUNT);
    const queue = new Int32Array(CELL_COUNT);
    let head = 0;
    let tail = 0;
    let expanded = 0;

    parent.fill(-1);
    queue[tail] = startKey;
    tail += 1;
    seen[startKey] = 1;

    while (head < tail) {
      const key = queue[head];
      head += 1;
      expanded += 1;

      if (key === endKey) {
        const path = buildPath(parent, startKey, endKey);
        return {
          found: path.length > 0,
          pathMoves: Math.max(0, path.length - 1),
          expanded,
          computeMs: now() - startedAt
        };
      }

      const x = key % GRID_SIZE;
      const y = Math.floor(key / GRID_SIZE);

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;

        if (isBlocked(walls, nx, ny, start, end)) continue;

        const neighborKey = toKey(nx, ny);
        if (seen[neighborKey]) continue;

        seen[neighborKey] = 1;
        parent[neighborKey] = key;
        queue[tail] = neighborKey;
        tail += 1;
      }
    }

    return { found: false, pathMoves: 0, expanded, computeMs: now() - startedAt };
  }

  function searchDijkstra(walls, start, end) {
    const startedAt = now();

    if (!start || !end || !isInside(start.x, start.y) || !isInside(end.x, end.y)) {
      return { found: false, pathMoves: 0, expanded: 0, computeMs: now() - startedAt };
    }

    const startKey = toKey(start.x, start.y);
    const endKey = toKey(end.x, end.y);
    const open = new MinHeap((a, b) => {
      if (a.g !== b.g) return a.g - b.g;
      return a.key - b.key;
    });
    const gScore = new Float64Array(CELL_COUNT);
    const parent = new Int32Array(CELL_COUNT);
    const closed = new Uint8Array(CELL_COUNT);
    let expanded = 0;

    gScore.fill(Infinity);
    parent.fill(-1);
    gScore[startKey] = 0;
    open.push({ key: startKey, g: 0 });

    while (open.size > 0) {
      const current = open.pop();

      if (closed[current.key] || current.g !== gScore[current.key]) continue;

      closed[current.key] = 1;
      expanded += 1;

      if (current.key === endKey) {
        const path = buildPath(parent, startKey, endKey);
        return {
          found: path.length > 0,
          pathMoves: Math.max(0, path.length - 1),
          expanded,
          computeMs: now() - startedAt
        };
      }

      const x = current.key % GRID_SIZE;
      const y = Math.floor(current.key / GRID_SIZE);

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;

        if (isBlocked(walls, nx, ny, start, end)) continue;

        const neighborKey = toKey(nx, ny);
        if (closed[neighborKey]) continue;

        const nextG = current.g + 1;
        if (nextG >= gScore[neighborKey]) continue;

        gScore[neighborKey] = nextG;
        parent[neighborKey] = current.key;
        open.push({ key: neighborKey, g: nextG });
      }
    }

    return { found: false, pathMoves: 0, expanded, computeMs: now() - startedAt };
  }

  function compareAlgorithms(walls, start, end, options = {}) {
    const astarTrace = findPathTrace(walls, start, end, options);
    const bfs = searchBfs(walls, start, end);
    const dijkstra = searchDijkstra(walls, start, end);

    return {
      astar: {
        found: astarTrace.found,
        pathMoves: astarTrace.metrics.pathMoves,
        expanded: astarTrace.metrics.expanded,
        computeMs: astarTrace.metrics.computeMs
      },
      bfs,
      dijkstra
    };
  }

  function hasPath(walls, start, end) {
    if (!start || !end) return false;

    const startKey = toKey(start.x, start.y);
    const endKey = toKey(end.x, end.y);
    const seen = new Uint8Array(CELL_COUNT);
    const queue = new Int32Array(CELL_COUNT);
    let head = 0;
    let tail = 0;

    queue[tail] = startKey;
    tail += 1;
    seen[startKey] = 1;

    while (head < tail) {
      const key = queue[head];
      head += 1;

      if (key === endKey) return true;

      const x = key % GRID_SIZE;
      const y = Math.floor(key / GRID_SIZE);

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;

        if (isBlocked(walls, nx, ny, start, end)) continue;

        const neighborKey = toKey(nx, ny);
        if (seen[neighborKey]) continue;

        seen[neighborKey] = 1;
        queue[tail] = neighborKey;
        tail += 1;
      }
    }

    return false;
  }

  function generateRandomWalls(start, end, wallProbability = 0.24) {
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const candidate = createWallGrid();

      for (let y = 0; y < GRID_SIZE; y += 1) {
        for (let x = 0; x < GRID_SIZE; x += 1) {
          if (Math.random() < wallProbability) {
            candidate[y][x] = true;
          }
        }
      }

      candidate[start.y][start.x] = false;
      candidate[end.y][end.x] = false;

      if (hasPath(candidate, start, end)) {
        return candidate;
      }
    }

    return createWallGrid();
  }

  window.AStarEngine = {
    GRID_SIZE,
    CELL_COUNT,
    CODE_LINES,
    createWallGrid,
    toKey,
    fromKey,
    manhattan,
    isInside,
    hasPath,
    generateRandomWalls,
    findPathTrace,
    searchBfs,
    searchDijkstra,
    compareAlgorithms
  };
})();
