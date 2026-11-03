'use strict';

/**
 * 寻路实验室
 * ------------------------------------------------------------
 * A* 算法 + Canvas 可视化。
 * 交互：选择工具后点击/拖拽编辑地图，Enter 或按钮开始寻路。
 */
(() => {
  // =========================================================
  // 常量
  // =========================================================

  const GRID_SIZE = 20;
  const CELL_COUNT = GRID_SIZE * GRID_SIZE;

  const TOOL_INFO = {
    wall: '按住左键拖拽绘制墙壁，右键可快速擦除。',
    start: '点击地图上的任意格子，放置新的起点。',
    end: '点击地图上的任意格子，放置新的终点。',
    erase: '点击或拖拽格子，擦掉不需要的墙壁。'
  };

  // 探索顺序色板：紫色最早、粉色最晚，完整跨越彩虹光谱
  const RAINBOW_STOPS = [
    [124, 91, 255],
    [77, 156, 255],
    [41, 211, 200],
    [76, 210, 126],
    [228, 212, 70],
    [255, 158, 72],
    [241, 83, 122]
  ];

  const ICONS = {
    success: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="m5.5 12.4 4.2 4.2 8.8-9.2" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    failure: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      </svg>`
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TIMING = {
    exploreMin: 620,
    exploreMax: 1500,
    explorePerNode: 8,
    reveal: 190,
    traceLead: 170,
    traceMin: 340,
    traceMax: 950,
    tracePerStep: 38,
    failureHold: 320
  };

  // =========================================================
  // DOM
  // =========================================================

  const canvas = document.getElementById('gridCanvas');
  const context = canvas.getContext('2d');
  const canvasWrap = document.getElementById('canvasWrap');

  const dom = {
    statusPill: document.getElementById('statusPill'),
    statusText: document.getElementById('statusText'),
    hintText: document.getElementById('hintText'),
    toolButtons: Array.from(document.querySelectorAll('.tool-btn')),

    stepsValue: document.getElementById('stepsValue'),
    exploredValue: document.getElementById('exploredValue'),
    timerValue: document.getElementById('timerValue'),

    startBtn: document.getElementById('startBtn'),
    startLabel: document.getElementById('startLabel'),
    randomBtn: document.getElementById('randomBtn'),
    clearBtn: document.getElementById('clearBtn'),

    playbackPanel: document.getElementById('playbackPanel'),
    playbackMeta: document.getElementById('playbackMeta'),
    playbackReadout: document.getElementById('playbackReadout'),
    timelineSlider: document.getElementById('timelineSlider'),

    resultOverlay: document.getElementById('resultOverlay'),
    resultCard: document.querySelector('.result-card'),
    resultIcon: document.getElementById('resultIcon'),
    resultKicker: document.getElementById('resultKicker'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    resultSteps: document.getElementById('resultSteps'),
    resultExplored: document.getElementById('resultExplored'),
    resultTime: document.getElementById('resultTime'),
    resultClose: document.getElementById('resultClose'),
    resultCloseLabel: document.getElementById('resultCloseLabel'),

    toast: document.getElementById('toast'),
    liveRegion: document.getElementById('liveRegion'),
    openDocsBtn: document.getElementById('openDocsBtn')
  };

  // =========================================================
  // 游戏状态
  // =========================================================

  const state = {
    walls: createWallGrid(),
    start: { x: 3, y: 10 },
    end: { x: 16, y: 10 },
    tool: 'wall',

    phase: 'idle', // idle | exploring | tracing | success | failed | replay
    result: null,
    timeline: null,
    startedAt: 0,
    elapsed: 0,
    visibleVisited: 0,
    visibleSteps: 0,
    pathProgress: 0,
    playbackProgress: 0,
    rafId: 0,

    hover: null,
    dragMode: null,
    lastEditedKey: -1,
    overlayOpen: false,

    toastHideTimer: 0,
    toastRemoveTimer: 0,
    domCache: {
      steps: null,
      explored: null,
      timer: null
    }
  };

  // =========================================================
  // 初始化
  // =========================================================

  let resizeRaf = 0;
  let docsViewer = null;

  init();

  function init() {
    bindEvents();
    initAlgorithmDocs();
    resetPlaybackPanel();
    selectTool('wall', true);
    resizeCanvas();
    updateStats(0, 0, 0);

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(scheduleResize);
      observer.observe(canvasWrap);
    } else {
      window.addEventListener('resize', scheduleResize);
    }
  }

  function initAlgorithmDocs() {
    if (!window.AlgorithmDocsViewer || !window.ASTAR_DOCS) {
      dom.openDocsBtn.disabled = true;
      dom.openDocsBtn.title = '源码数据未加载';
      return;
    }

    docsViewer = window.AlgorithmDocsViewer.create({
      trigger: dom.openDocsBtn,
      title: 'A* 算法源码与解析',
      subtitle: '同一条寻路思路，四种常见语言实现。切换语言查看源码，对照右侧逐步拆解。',
      mark: 'A*',
      languages: window.ASTAR_DOCS,
      analysisTemplateId: 'astarDocsAnalysis',
      onOpen: () => hideResultOverlay(),
      onClose: () => {
        if (state.overlayOpen) {
          requestAnimationFrame(() => {
            dom.resultClose.focus({ preventScroll: true });
          });
        }
      }
    });
  }

  function bindEvents() {
    dom.toolButtons.forEach((button) => {
      button.addEventListener('click', () => selectTool(button.dataset.tool));
    });

    dom.startBtn.addEventListener('click', startSearch);
    dom.randomBtn.addEventListener('click', generateRandomMap);
    dom.clearBtn.addEventListener('click', clearWalls);

    dom.timelineSlider.addEventListener('input', onTimelineInput);

    // 鼠标操作后移除按钮焦点，保证直接按 Enter 仍能开始寻路；
    // 键盘 Tab 聚焦按钮时则保留焦点，Enter 仍可正常触发按钮本身。
    [...dom.toolButtons, dom.randomBtn, dom.clearBtn].forEach((button) => {
      button.addEventListener('pointerup', () => button.blur());
    });

    dom.resultClose.addEventListener('click', () => {
      hideResultOverlay({ moveFocus: true });
    });

    dom.resultOverlay.addEventListener('click', (event) => {
      if (event.target === dom.resultOverlay) {
        hideResultOverlay({ moveFocus: true });
      }
    });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('keydown', onKeyDown);
  }

  // =========================================================
  // A* 算法
  // =========================================================

  /**
   * 使用 A* 搜索最短路径。
   * 网格为四邻接，代价恒为 1，启发函数使用曼哈顿距离。
   * 返回：{ visited, path, found }
   */
  function findPath() {
    const startKey = toKey(state.start.x, state.start.y);
    const endKey = toKey(state.end.x, state.end.y);

    const open = new MinHeap((a, b) => {
      if (a.f !== b.f) return a.f - b.f;
      if (a.h !== b.h) return a.h - b.h;
      return a.key - b.key;
    });

    const gScore = new Float64Array(CELL_COUNT);
    gScore.fill(Infinity);

    const cameFrom = new Int32Array(CELL_COUNT);
    cameFrom.fill(-1);

    const closed = new Uint8Array(CELL_COUNT);
    const visited = [];

    const startH = manhattan(state.start.x, state.start.y, state.end.x, state.end.y);
    gScore[startKey] = 0;
    open.push({ key: startKey, g: 0, h: startH, f: startH });

    while (open.size > 0) {
      const current = open.pop();

      // 跳过堆中过期的旧记录
      if (closed[current.key] || current.g !== gScore[current.key]) {
        continue;
      }

      closed[current.key] = 1;
      visited.push(current.key);

      if (current.key === endKey) {
        return {
          visited,
          path: buildPath(cameFrom, startKey, endKey),
          found: true
        };
      }

      const x = current.key % GRID_SIZE;
      const y = Math.floor(current.key / GRID_SIZE);

      for (const [dx, dy] of DIRECTIONS) {
        const nx = x + dx;
        const ny = y + dy;

        if (!isInside(nx, ny) || state.walls[ny][nx]) continue;

        const neighborKey = toKey(nx, ny);
        if (closed[neighborKey]) continue;

        const tentativeG = current.g + 1;
        if (tentativeG >= gScore[neighborKey]) continue;

        cameFrom[neighborKey] = current.key;
        gScore[neighborKey] = tentativeG;

        const h = manhattan(nx, ny, state.end.x, state.end.y);
        open.push({
          key: neighborKey,
          g: tentativeG,
          h,
          f: tentativeG + h
        });
      }
    }

    return { visited, path: [], found: false };
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

  const DIRECTIONS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  function manhattan(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  function isInside(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
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

  // =========================================================
  // 寻路流程与计时
  // =========================================================

  function startSearch() {
    if (isBusy()) return;

    hideResultOverlay();
    hideToast();

    state.hover = null;
    state.dragMode = null;

    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    const result = findPath();
    const visitedCount = result.visited.length;
    const pathMoves = result.found ? Math.max(0, result.path.length - 1) : 0;

    const exploreDuration = reduceMotion
      ? 0
      : clamp(visitedCount * TIMING.explorePerNode, TIMING.exploreMin, TIMING.exploreMax);
    const revealDuration = reduceMotion ? 0 : TIMING.reveal;
    const exploreEnd = exploreDuration + revealDuration;
    const traceStart = exploreEnd + (reduceMotion ? 0 : TIMING.traceLead);
    const traceDuration = reduceMotion
      ? 0
      : clamp(pathMoves * TIMING.tracePerStep, TIMING.traceMin, TIMING.traceMax);

    state.result = result;
    state.phase = 'exploring';
    state.timeline = {
      exploreDuration,
      revealDuration,
      exploreEnd,
      traceStart,
      traceDuration,
      finishAt: result.found ? traceStart + traceDuration : exploreEnd + TIMING.failureHold
    };
    state.startedAt = performance.now();
    state.elapsed = 0;
    state.visibleVisited = 0;
    state.visibleSteps = 0;
    state.pathProgress = 0;

    preparePlaybackForSearch();
    setBusy(true);
    setStatus('exploring', 'A* 探索中…');
    updateStats(0, 0, 0);
    draw();

    announce('A* 开始寻路。');

    state.rafId = requestAnimationFrame(animationLoop);
  }

  function animationLoop(timestamp) {
    if (!isBusy() || !state.result) {
      state.rafId = 0;
      return;
    }

    const elapsed = Math.max(0, timestamp - state.startedAt);
    const timeline = state.timeline;
    state.elapsed = elapsed;

    if (state.phase === 'exploring') {
      if (elapsed < timeline.exploreEnd) {
        state.visibleVisited = getVisibleVisitCount(elapsed);
      } else {
        state.visibleVisited = state.result.visited.length;
      }

      updateStats(0, state.visibleVisited, elapsed);

      if (elapsed >= timeline.exploreEnd) {
        if (state.result.found) {
          state.phase = 'tracing';
          setStatus('exploring', '回溯最短路径…');
        } else if (elapsed >= timeline.finishAt) {
          finishSearch(false, timeline.finishAt);
          return;
        }
      }
    }

    if (state.phase === 'tracing') {
      const pathMoves = Math.max(0, state.result.path.length - 1);

      if (timeline.traceDuration <= 0) {
        state.pathProgress = 1;
      } else {
        state.pathProgress = clamp(
          (elapsed - timeline.traceStart) / timeline.traceDuration,
          0,
          1
        );
      }

      state.visibleSteps = Math.min(
        pathMoves,
        Math.floor(state.pathProgress * pathMoves + 0.0001)
      );

      updateStats(state.visibleSteps, state.visibleVisited, elapsed);

      if (elapsed >= timeline.finishAt) {
        finishSearch(true, timeline.finishAt);
        return;
      }
    }

    updatePlaybackDuringSearch(elapsed);
    draw(timestamp);
    state.rafId = requestAnimationFrame(animationLoop);
  }

  function getVisibleVisitCount(elapsed) {
    const count = state.result ? state.result.visited.length : 0;
    const duration = state.timeline ? state.timeline.exploreDuration : 0;

    if (count <= 1 || duration <= 0) return count;

    const progress = clamp(elapsed / duration, 0, 1);
    return Math.min(count, Math.floor(progress * (count - 1)) + 1);
  }

  function finishSearch(found, finalElapsed) {
    state.rafId = 0;
    state.elapsed = finalElapsed;

    const visitedCount = state.result ? state.result.visited.length : 0;
    const pathMoves = found ? Math.max(0, state.result.path.length - 1) : 0;

    state.visibleVisited = visitedCount;
    state.visibleSteps = pathMoves;
    state.pathProgress = found ? 1 : 0;

    setBusy(false);
    updateStats(pathMoves, visitedCount, finalElapsed);
    draw();
    completePlaybackPanel(found);

    if (found) {
      state.phase = 'success';
      setStatus('success', '已到达终点');
      showResultOverlay(true);
      announce(
        `寻路成功！共 ${pathMoves} 步，探索 ${visitedCount} 个节点，用时 ${formatSeconds(finalElapsed)} 秒。`
      );
    } else {
      state.phase = 'failed';
      setStatus('failed', '无法抵达');
      showResultOverlay(false);
      announce(`没有找到可行路径，共探索 ${visitedCount} 个节点。请调整障碍物后再试。`);
    }
  }

  function isBusy() {
    return state.phase === 'exploring' || state.phase === 'tracing';
  }

  function setBusy(busy) {
    dom.toolButtons.forEach((button) => {
      button.disabled = busy;
    });
    dom.startBtn.disabled = busy;
    dom.randomBtn.disabled = busy;
    dom.clearBtn.disabled = busy;
    dom.startLabel.textContent = busy ? '正在寻路…' : '开始寻路';
    canvasWrap.classList.toggle('is-running', busy);
  }

  function setStatus(visualState, text) {
    if (dom.statusPill.dataset.state !== visualState) {
      dom.statusPill.dataset.state = visualState;
    }
    if (dom.statusText.textContent !== text) {
      dom.statusText.textContent = text;
    }
  }

  function updateStats(steps, explored, elapsed) {
    if (state.domCache.steps !== steps) {
      dom.stepsValue.textContent = String(steps);
      state.domCache.steps = steps;
    }

    if (state.domCache.explored !== explored) {
      dom.exploredValue.textContent = String(explored);
      state.domCache.explored = explored;
    }

    const timeText = formatSeconds(elapsed);
    if (state.domCache.timer !== timeText) {
      dom.timerValue.textContent = timeText;
      state.domCache.timer = timeText;
    }
  }

  // =========================================================
  // 寻路过程回放
  // =========================================================

  function preparePlaybackForSearch() {
    dom.timelineSlider.disabled = true;
    dom.playbackPanel.dataset.state = 'running';
    dom.playbackMeta.textContent = 'A* 正在生成探索顺序…';
    setPlaybackProgress(0);
    updatePlaybackReadout(0, 0);
    dom.timelineSlider.setAttribute('aria-valuetext', '寻路进行中');
  }

  function updatePlaybackDuringSearch(elapsed) {
    const timeline = state.timeline;
    if (!timeline || !state.result) return;

    const progress = timeline.finishAt > 0 ? clamp(elapsed / timeline.finishAt, 0, 1) : 0;
    setPlaybackProgress(progress);
    updatePlaybackReadout(state.visibleVisited, state.visibleSteps);

    let meta = 'A* 正在扩展节点…';
    if (state.result.found && elapsed >= timeline.traceStart) {
      meta = 'A* 正在回溯最短路径…';
    } else if (!state.result.found && elapsed >= timeline.exploreEnd) {
      meta = 'A* 正在确认起点与终点的连通性…';
    }

    if (dom.playbackMeta.textContent !== meta) {
      dom.playbackMeta.textContent = meta;
    }
  }

  function completePlaybackPanel(found) {
    const visitedCount = state.result ? state.result.visited.length : 0;
    const pathMoves = found ? Math.max(0, state.result.path.length - 1) : 0;

    dom.timelineSlider.disabled = false;
    dom.playbackPanel.dataset.state = 'ready';
    setPlaybackProgress(1);
    updatePlaybackReadout(visitedCount, pathMoves);
    dom.playbackMeta.textContent = found
      ? '拖动滑块，回看探索与路径回溯'
      : '拖动滑块，回看完整的探索过程';
  }

  function resetPlaybackPanel() {
    dom.timelineSlider.disabled = true;
    dom.playbackPanel.dataset.state = 'empty';
    setPlaybackProgress(0);
    dom.playbackMeta.textContent = '完成一次寻路后，可拖动进度查看';
    dom.playbackReadout.textContent = '等待寻路';
    dom.timelineSlider.setAttribute('aria-valuetext', '尚未开始寻路');
  }

  function setPlaybackProgress(progress) {
    const normalized = clamp(progress, 0, 1);
    state.playbackProgress = normalized;

    dom.playbackPanel.style.setProperty(
      '--progress',
      `${(normalized * 100).toFixed(2)}%`
    );

    const sliderValue = String(Math.round(normalized * 1000));
    if (dom.timelineSlider.value !== sliderValue) {
      dom.timelineSlider.value = sliderValue;
    }
  }

  function updatePlaybackReadout(explored, steps) {
    if (!state.result) {
      dom.playbackReadout.textContent = '等待寻路';
      return;
    }

    const visitedTotal = state.result.visited.length;
    const stepsTotal = state.result.found
      ? Math.max(0, state.result.path.length - 1)
      : 0;

    dom.playbackReadout.textContent =
      `探索 ${explored}/${visitedTotal} · 步数 ${steps}/${stepsTotal}`;

    dom.timelineSlider.setAttribute(
      'aria-valuetext',
      `已探索 ${explored}/${visitedTotal} 个节点，路径已显示 ${steps}/${stepsTotal} 步`
    );
  }

  function onTimelineInput() {
    if (!state.result || !state.timeline || isBusy()) return;

    hideResultOverlay();
    state.hover = null;

    const fraction = clamp(Number(dom.timelineSlider.value) / 1000, 0, 1);
    const elapsed = fraction * state.timeline.finishAt;
    const totalSteps = state.result.found
      ? Math.max(0, state.result.path.length - 1)
      : 0;

    state.phase = 'replay';
    state.elapsed = elapsed;
    state.visibleVisited = getVisibleVisitCount(elapsed);
    state.pathProgress = getPathProgressAt(elapsed);
    state.visibleSteps = Math.min(
      totalSteps,
      Math.floor(state.pathProgress * totalSteps + 0.0001)
    );

    updateStats(state.visibleSteps, state.visibleVisited, elapsed);
    setPlaybackProgress(fraction);
    updatePlaybackReadout(state.visibleVisited, state.visibleSteps);

    const atEnd = fraction >= 0.9995;

    if (atEnd) {
      dom.playbackPanel.dataset.state = 'ready';
      dom.playbackMeta.textContent = state.result.found
        ? '已到达终点，可拖回起点重看'
        : '搜索结束，未找到连通路径';
    } else {
      dom.playbackPanel.dataset.state = 'replaying';
      dom.playbackMeta.textContent =
        state.result.found && elapsed >= state.timeline.traceStart
          ? '回放中 · 路径回溯'
          : '回放中 · 节点扩展';
    }

    updateReplayStatus(atEnd);
    draw();
  }

  function updateReplayStatus(atEnd) {
    if (atEnd) {
      if (state.result.found) {
        setStatus('success', '已到达终点');
      } else {
        setStatus('failed', '无法抵达');
      }
      return;
    }

    if (state.result.found && state.elapsed >= state.timeline.traceStart) {
      setStatus('replay', '回放中 · 回溯路径');
    } else {
      setStatus('replay', '回放中 · 探索节点');
    }
  }

  function getPathProgressAt(elapsed) {
    if (!state.result || !state.result.found || !state.timeline) return 0;

    const timeline = state.timeline;
    if (elapsed < timeline.traceStart) return 0;
    if (timeline.traceDuration <= 0) return 1;

    return clamp((elapsed - timeline.traceStart) / timeline.traceDuration, 0, 1);
  }

  // =========================================================
  // 重置单局状态
  // =========================================================

  function resetRunState() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }

    state.phase = 'idle';
    state.result = null;
    state.timeline = null;
    state.startedAt = 0;
    state.elapsed = 0;
    state.visibleVisited = 0;
    state.visibleSteps = 0;
    state.pathProgress = 0;

    hideResultOverlay();
    resetPlaybackPanel();
    setBusy(false);
    setStatus('idle', '准备就绪');
    updateStats(0, 0, 0);
    draw();
  }

  function formatSeconds(milliseconds) {
    return (Math.max(0, milliseconds) / 1000).toFixed(2);
  }

  // =========================================================
  // 结果浮层与轻提示
  // =========================================================

  function showResultOverlay(success) {
    const visitedCount = state.result ? state.result.visited.length : 0;
    const pathMoves = success ? Math.max(0, state.result.path.length - 1) : 0;
    const timeText = formatSeconds(state.elapsed);

    hideToast();

    dom.resultCard.classList.toggle('is-failure', !success);
    dom.resultIcon.classList.toggle('is-failure', !success);
    dom.resultIcon.innerHTML = success ? ICONS.success : ICONS.failure;

    dom.resultKicker.textContent = success ? 'ROUTE FOUND' : 'NO ROUTE';
    dom.resultTitle.textContent = success ? '寻路成功！' : '这条路走不通';
    dom.resultMessage.textContent = success
      ? 'A* 已经找到通往终点的最短路径，点击下方按钮查看完整路线。'
      : '起点和终点之间暂时没有连通路线，调整一下障碍物再试一次吧。';

    dom.resultSteps.textContent = String(pathMoves);
    dom.resultExplored.textContent = String(visitedCount);
    dom.resultTime.textContent = `${timeText}s`;
    dom.resultCloseLabel.textContent = success ? '继续探索' : '调整地图';

    dom.resultOverlay.hidden = false;
    state.overlayOpen = true;

    if (!docsViewer || !docsViewer.isOpen()) {
      requestAnimationFrame(() => {
        dom.resultClose.focus({ preventScroll: true });
      });
    }
  }

  function hideResultOverlay({ moveFocus = false } = {}) {
    const hadFocus = dom.resultOverlay.contains(document.activeElement);

    dom.resultOverlay.hidden = true;
    state.overlayOpen = false;

    if (moveFocus && hadFocus && (!docsViewer || !docsViewer.isOpen())) {
      dom.startBtn.focus({ preventScroll: true });
    }
  }

  function showToast(message, duration = 2300) {
    window.clearTimeout(state.toastHideTimer);
    window.clearTimeout(state.toastRemoveTimer);

    dom.toast.textContent = message;
    dom.toast.hidden = false;
    dom.toast.classList.remove('is-visible');

    // 强制重排后再显示，让连续提示也有入场动画
    void dom.toast.offsetWidth;
    dom.toast.classList.add('is-visible');

    state.toastHideTimer = window.setTimeout(() => {
      hideToast();
    }, duration);
  }

  function hideToast() {
    window.clearTimeout(state.toastHideTimer);
    window.clearTimeout(state.toastRemoveTimer);

    dom.toast.classList.remove('is-visible');
    state.toastRemoveTimer = window.setTimeout(() => {
      if (!dom.toast.classList.contains('is-visible')) {
        dom.toast.hidden = true;
      }
    }, 210);
  }

  function announce(message) {
    dom.liveRegion.textContent = '';
    window.setTimeout(() => {
      dom.liveRegion.textContent = message;
    }, 30);
  }

  // =========================================================
  // 工具与地图编辑
  // =========================================================

  function selectTool(tool, silent = false) {
    if (isBusy() || !TOOL_INFO[tool]) return;

    hideResultOverlay();

    state.tool = tool;
    canvasWrap.dataset.tool = tool;

    dom.toolButtons.forEach((button) => {
      const active = button.dataset.tool === tool;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    dom.hintText.textContent = TOOL_INFO[tool];

    if (!silent) {
      draw();
    }
  }

  function prepareForEdit() {
    if (isBusy()) {
      showToast('A* 正在寻路，请稍候片刻');
      return false;
    }

    if (state.phase !== 'idle' || state.result || state.overlayOpen) {
      resetRunState();
    }

    return true;
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    if (isBusy()) {
      showToast('A* 正在寻路，请稍候片刻');
      return;
    }

    const cell = cellFromEvent(event);
    if (!cell) return;

    event.preventDefault();

    if (!prepareForEdit()) return;

    const erasing = event.button === 2 || state.tool === 'erase';
    state.hover = event.pointerType === 'mouse' ? cell : null;
    state.dragMode = erasing ? 'erase' : state.tool === 'wall' ? 'wall' : null;
    state.lastEditedKey = toKey(cell.x, cell.y);

    if (erasing) {
      eraseWall(cell);
    } else if (state.tool === 'wall') {
      placeWall(cell);
    } else if (state.tool === 'start') {
      moveStart(cell);
    } else if (state.tool === 'end') {
      moveEnd(cell);
    }

    if (state.dragMode) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // 部分浏览器在触屏场景下可能拒绝指针捕获，拖拽仍可继续
      }
    }

    draw();
  }

  function onPointerMove(event) {
    const cell = cellFromEvent(event);
    let needsDraw = false;

    const hoverCell = cell && event.pointerType === 'mouse' ? cell : null;
    if (!sameCell(state.hover, hoverCell)) {
      state.hover = hoverCell;
      needsDraw = true;
    }

    if (state.dragMode && cell && !isBusy()) {
      const key = toKey(cell.x, cell.y);

      if (key !== state.lastEditedKey) {
        state.lastEditedKey = key;

        if (state.dragMode === 'erase') {
          eraseWall(cell);
        } else {
          placeWall(cell);
        }

        needsDraw = true;
      }
    }

    if (needsDraw) draw();
  }

  function onPointerEnd(event) {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }

    state.dragMode = null;
    state.lastEditedKey = -1;

    if (event.pointerType !== 'mouse' && state.hover) {
      state.hover = null;
      draw();
    }
  }

  function onPointerLeave() {
    if (state.dragMode) return;

    if (state.hover) {
      state.hover = null;
      draw();
    }
  }

  function cellFromEvent(event) {
    const rect = canvas.getBoundingClientRect();

    if (
      event.clientX < rect.left ||
      event.clientX >= rect.right ||
      event.clientY < rect.top ||
      event.clientY >= rect.bottom
    ) {
      return null;
    }

    return {
      x: Math.min(
        GRID_SIZE - 1,
        Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE))
      ),
      y: Math.min(
        GRID_SIZE - 1,
        Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE))
      )
    };
  }

  function placeWall(cell) {
    if (!cell || isEndpoint(cell)) return;
    state.walls[cell.y][cell.x] = true;
  }

  function eraseWall(cell) {
    if (!cell) return;
    state.walls[cell.y][cell.x] = false;
  }

  function moveStart(cell) {
    if (!cell) return;

    if (sameCell(cell, state.end)) {
      showToast('起点和终点不能重叠');
      return;
    }

    state.walls[cell.y][cell.x] = false;
    state.start = { x: cell.x, y: cell.y };
  }

  function moveEnd(cell) {
    if (!cell) return;

    if (sameCell(cell, state.start)) {
      showToast('起点和终点不能重叠');
      return;
    }

    state.walls[cell.y][cell.x] = false;
    state.end = { x: cell.x, y: cell.y };
  }

  function isEndpoint(cell) {
    return sameCell(cell, state.start) || sameCell(cell, state.end);
  }

  function clearWalls() {
    if (isBusy()) return;
    hideResultOverlay();

    let wallCount = 0;
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (state.walls[y][x]) wallCount += 1;
      }
    }

    if (wallCount === 0) {
      showToast('地图上还没有障碍物');
      return;
    }

    state.walls = createWallGrid();
    resetRunState();
    draw();
    showToast('障碍物已清空，重新布置地图吧');
    announce('障碍物已清空。');
  }

  function generateRandomMap() {
    if (isBusy()) return;

    hideResultOverlay();
    const generated = generateRandomWalls();

    state.walls = generated;
    resetRunState();
    draw();
    showToast('随机地图已生成 · 按 Enter 出发');
    announce('随机地图已生成，按回车键开始寻路。');
  }

  function generateRandomWalls() {
    const wallProbability = 0.24;

    for (let attempt = 0; attempt < 36; attempt += 1) {
      const candidate = createWallGrid();

      for (let y = 0; y < GRID_SIZE; y += 1) {
        for (let x = 0; x < GRID_SIZE; x += 1) {
          if (Math.random() < wallProbability) {
            candidate[y][x] = true;
          }
        }
      }

      candidate[state.start.y][state.start.x] = false;
      candidate[state.end.y][state.end.x] = false;

      if (hasPath(candidate, state.start, state.end)) {
        return candidate;
      }
    }

    // 极端情况下回退到空地图，确保随机按钮永远可用
    return createWallGrid();
  }

  function hasPath(walls, start, end) {
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

        if (!isInside(nx, ny) || walls[ny][nx]) continue;

        const neighborKey = toKey(nx, ny);
        if (seen[neighborKey]) continue;

        seen[neighborKey] = 1;
        queue[tail] = neighborKey;
        tail += 1;
      }
    }

    return false;
  }

  function createWallGrid() {
    return Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => false)
    );
  }

  function sameCell(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  // =========================================================
  // 键盘快捷键
  // =========================================================

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return;
    }

    if (event.key === 'Enter') {
      const focusedControl = target instanceof Element
        ? target.closest('button, a[href], [role="button"], [role="tab"]')
        : null;

      // 让键盘聚焦的按钮保留原生 Enter 激活行为
      if (focusedControl) return;

      event.preventDefault();

      if (state.overlayOpen) {
        hideResultOverlay({ moveFocus: true });
        return;
      }

      if (!isBusy()) {
        startSearch();
      }
      return;
    }

    if (event.key === 'Escape') {
      if (state.overlayOpen) {
        event.preventDefault();
        hideResultOverlay({ moveFocus: true });
      }
      return;
    }

    if (state.overlayOpen || isBusy() || event.repeat) return;

    if (['1', '2', '3', '4'].includes(event.key)) {
      const tools = ['wall', 'start', 'end', 'erase'];
      selectTool(tools[Number(event.key) - 1]);
      event.preventDefault();
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'r') {
      event.preventDefault();
      generateRandomMap();
    } else if (key === 'c') {
      event.preventDefault();
      clearWalls();
    }
  }

  // =========================================================
  // Canvas 尺寸与绘制
  // =========================================================

  function scheduleResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(resizeCanvas);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const bufferWidth = Math.max(1, Math.round(rect.width * dpr));
    const bufferHeight = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) {
      canvas.width = bufferWidth;
      canvas.height = bufferHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw(now = performance.now()) {
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width < 1 || height < 1) return;

    const boardSize = Math.min(width, height);
    const geometry = {
      width,
      height,
      size: boardSize,
      cell: boardSize / GRID_SIZE,
      offsetX: (width - boardSize) / 2,
      offsetY: (height - boardSize) / 2
    };

    context.clearRect(0, 0, width, height);
    drawBoard(geometry);
    drawVisitedCells(geometry, now);
    drawWalls(geometry);
    drawCurrentPath(geometry, now);
    drawHoverCell(geometry);
    drawEndpoints(geometry);
  }

  function drawBoard(geo) {
    const { offsetX, offsetY, size, cell } = geo;

    const background = context.createLinearGradient(
      offsetX,
      offsetY,
      offsetX + size,
      offsetY + size
    );
    background.addColorStop(0, '#fcfdff');
    background.addColorStop(0.55, '#f9fcff');
    background.addColorStop(1, '#f6faff');

    context.fillStyle = background;
    context.fillRect(offsetX, offsetY, size, size);

    context.save();
    context.lineWidth = 1;

    for (let i = 0; i <= GRID_SIZE; i += 1) {
      const isMajor = i % 5 === 0;
      const x = offsetX + i * cell;
      const y = offsetY + i * cell;

      context.strokeStyle = isMajor
        ? 'rgba(108, 136, 176, 0.23)'
        : 'rgba(118, 144, 182, 0.135)';

      context.beginPath();
      context.moveTo(x, offsetY);
      context.lineTo(x, offsetY + size);
      context.stroke();

      context.beginPath();
      context.moveTo(offsetX, y);
      context.lineTo(offsetX + size, y);
      context.stroke();
    }

    context.restore();
  }

  function drawVisitedCells(geo, now) {
    if (!state.result) return;

    const visited = state.result.visited;
    const count = visited.length;
    if (count === 0) return;

    const visibleCount = getVisibleVisitCount(state.elapsed);
    const exploreDuration = state.timeline ? state.timeline.exploreDuration : 0;
    const revealDuration = state.timeline ? state.timeline.revealDuration : 0;
    const exploreEnd = state.timeline ? state.timeline.exploreEnd : 0;

    for (let index = 0; index < visibleCount; index += 1) {
      const point = fromKey(visited[index]);
      let revealProgress = 1;

      if (revealDuration > 0) {
        const revealStart = count <= 1
          ? 0
          : (index / (count - 1)) * exploreDuration;
        revealProgress = clamp((state.elapsed - revealStart) / revealDuration, 0, 1);
      }

      if (revealProgress <= 0) continue;

      const eased = easeOutCubic(revealProgress);
      const orderProgress = count <= 1 ? 0 : index / (count - 1);
      const color = rainbowColor(orderProgress);

      const px = geo.offsetX + point.x * geo.cell;
      const py = geo.offsetY + point.y * geo.cell;
      const pad = geo.cell * (0.16 - 0.065 * eased);
      const insetSize = geo.cell - pad * 2;
      const radius = Math.max(2, geo.cell * (0.14 + 0.07 * eased));

      context.save();
      context.globalAlpha = 0.14 + 0.84 * eased;
      context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      roundedRectPath(context, px + pad, py + pad, insetSize, insetSize, radius);
      context.fill();
      context.restore();
    }

    // 搜索前沿的高亮边框：让“正在思考”的位置更明显
    if (state.elapsed < exploreEnd && visibleCount > 0) {
      const headPoint = fromKey(visited[visibleCount - 1]);
      const px = geo.offsetX + headPoint.x * geo.cell;
      const py = geo.offsetY + headPoint.y * geo.cell;
      const pulse = 0.5 + 0.5 * Math.sin(now / 165);
      const inset = geo.cell * 0.075;

      context.save();
      context.lineWidth = Math.max(1.2, geo.cell * 0.045);
      context.strokeStyle = `rgba(255, 255, 255, ${0.55 + pulse * 0.28})`;
      context.shadowColor = 'rgba(255, 255, 255, 0.78)';
      context.shadowBlur = geo.cell * 0.24;
      roundedRectPath(
        context,
        px + inset,
        py + inset,
        geo.cell - inset * 2,
        geo.cell - inset * 2,
        Math.max(2, geo.cell * 0.2)
      );
      context.stroke();
      context.restore();
    }
  }

  function drawWalls(geo) {
    const { cell, offsetX, offsetY } = geo;
    const pad = Math.max(1.4, cell * 0.075);
    const radius = Math.max(2.5, cell * 0.2);

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (!state.walls[y][x]) continue;

        const px = offsetX + x * cell + pad;
        const py = offsetY + y * cell + pad;
        const size = cell - pad * 2;

        const wallGradient = context.createLinearGradient(px, py, px, py + size);
        wallGradient.addColorStop(0, '#465774');
        wallGradient.addColorStop(1, '#33415a');

        context.fillStyle = wallGradient;
        roundedRectPath(context, px, py, size, size, radius);
        context.fill();

        context.strokeStyle = 'rgba(255, 255, 255, 0.085)';
        context.lineWidth = 1;
        roundedRectPath(
          context,
          px + 0.6,
          py + 0.6,
          Math.max(1, size - 1.2),
          Math.max(1, size - 1.2),
          Math.max(1, radius - 0.6)
        );
        context.stroke();
      }
    }
  }

  function drawCurrentPath(geo, now) {
    const result = state.result;
    if (!result || !result.found || result.path.length < 2) return;
    if (state.pathProgress <= 0) return;

    const path = result.path;
    const moves = path.length - 1;
    const revealed = state.pathProgress * moves;
    const fullSegments = Math.min(moves, Math.floor(revealed));

    const startPoint = cellCenter(path[0], geo);

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);

    for (let i = 1; i <= fullSegments; i += 1) {
      const point = cellCenter(path[i], geo);
      context.lineTo(point.x, point.y);
    }

    if (fullSegments < moves) {
      const segmentProgress = revealed - fullSegments;
      if (segmentProgress > 0) {
        const from = cellCenter(path[fullSegments], geo);
        const to = cellCenter(path[fullSegments + 1], geo);
        context.lineTo(
          from.x + (to.x - from.x) * segmentProgress,
          from.y + (to.y - from.y) * segmentProgress
        );
      }
    }

    // 奶白描边把路线从彩虹底上托起来，深色主线保证任何颜色上都清晰
    context.lineWidth = Math.max(5.2, geo.cell * 0.3);
    context.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    context.stroke();

    context.lineWidth = Math.max(2.4, geo.cell * 0.11);
    context.strokeStyle = '#243a5c';
    context.stroke();

    // 随进度流动的细虚线
    context.setLineDash([
      Math.max(1.2, geo.cell * 0.035),
      Math.max(4.5, geo.cell * 0.3)
    ]);
    context.lineDashOffset = -(now * 0.035);
    context.lineWidth = Math.max(1, geo.cell * 0.03);
    context.strokeStyle = 'rgba(255, 255, 255, 0.62)';
    context.stroke();

    // 路线正在延伸时的笔尖
    if (state.pathProgress < 1 && fullSegments < moves) {
      const segmentProgress = revealed - fullSegments;
      const from = cellCenter(path[fullSegments], geo);
      const to = cellCenter(path[fullSegments + 1], geo);
      const tipX = from.x + (to.x - from.x) * segmentProgress;
      const tipY = from.y + (to.y - from.y) * segmentProgress;

      context.setLineDash([]);
      context.beginPath();
      context.arc(tipX, tipY, Math.max(3, geo.cell * 0.13), 0, Math.PI * 2);
      context.fillStyle = '#fff';
      context.fill();

      context.beginPath();
      context.arc(tipX, tipY, Math.max(1.3, geo.cell * 0.055), 0, Math.PI * 2);
      context.fillStyle = '#243a5c';
      context.fill();
    }

    context.restore();
  }

  function drawHoverCell(geo) {
    if (!state.hover || isBusy()) return;
    if (!isInside(state.hover.x, state.hover.y)) return;

    const px = geo.offsetX + state.hover.x * geo.cell;
    const py = geo.offsetY + state.hover.y * geo.cell;
    const inset = Math.max(1.2, geo.cell * 0.06);

    let fill = 'rgba(53, 109, 243, 0.075)';
    let stroke = 'rgba(53, 109, 243, 0.48)';

    if (isEndpoint(state.hover)) {
      fill = state.tool === 'end'
        ? 'rgba(238, 93, 134, 0.08)'
        : 'rgba(255, 123, 89, 0.08)';
      stroke = state.tool === 'end'
        ? 'rgba(238, 93, 134, 0.46)'
        : 'rgba(255, 123, 89, 0.46)';
    } else if (state.tool === 'erase') {
      fill = 'rgba(255, 255, 255, 0.45)';
      stroke = 'rgba(255, 123, 89, 0.55)';
    }

    context.save();
    context.fillStyle = fill;
    roundedRectPath(
      context,
      px + inset,
      py + inset,
      geo.cell - inset * 2,
      geo.cell - inset * 2,
      Math.max(2, geo.cell * 0.18)
    );
    context.fill();

    context.setLineDash([3, 3]);
    context.lineWidth = 1.4;
    context.strokeStyle = stroke;
    context.stroke();
    context.restore();
  }

  function drawEndpoints(geo) {
    drawStartMarker(state.start, geo);
    drawEndMarker(state.end, geo);
  }

  function drawStartMarker(cell, geo) {
    const center = cellCenter(toKey(cell.x, cell.y), geo);
    const radius = geo.cell * 0.295;

    drawMarkerHalo(center, geo.cell, '255, 123, 89');

    context.save();
    context.translate(center.x, center.y);
    context.shadowColor = 'rgba(226, 99, 61, 0.34)';
    context.shadowBlur = geo.cell * 0.26;
    context.fillStyle = '#ff7b59';
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();

    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    context.lineWidth = Math.max(1.5, geo.cell * 0.055);
    context.stroke();

    const symbol = geo.cell * 0.09;
    context.fillStyle = '#fff';
    context.beginPath();
    context.moveTo(-symbol * 0.48, -symbol * 0.92);
    context.lineTo(symbol * 1.03, 0);
    context.lineTo(-symbol * 0.48, symbol * 0.92);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawEndMarker(cell, geo) {
    const center = cellCenter(toKey(cell.x, cell.y), geo);
    const radius = geo.cell * 0.295;

    drawMarkerHalo(center, geo.cell, '238, 93, 134');

    context.save();
    context.translate(center.x, center.y);
    context.shadowColor = 'rgba(218, 70, 115, 0.3)';
    context.shadowBlur = geo.cell * 0.26;
    context.fillStyle = '#ee5d86';
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();

    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255, 255, 255, 0.96)';
    context.lineWidth = Math.max(1.5, geo.cell * 0.055);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.stroke();

    context.strokeStyle = '#fff';
    context.lineWidth = Math.max(1.3, geo.cell * 0.045);
    context.beginPath();
    context.arc(0, 0, geo.cell * 0.145, 0, Math.PI * 2);
    context.stroke();

    context.fillStyle = '#fff';
    context.beginPath();
    context.arc(0, 0, geo.cell * 0.055, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawMarkerHalo(center, cellSize, rgb) {
    const radius = cellSize * 0.53;
    const halo = context.createRadialGradient(
      center.x,
      center.y,
      cellSize * 0.12,
      center.x,
      center.y,
      radius
    );
    halo.addColorStop(0, `rgba(${rgb}, 0.19)`);
    halo.addColorStop(1, `rgba(${rgb}, 0)`);

    context.fillStyle = halo;
    context.beginPath();
    context.arc(center.x, center.y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function cellCenter(key, geo) {
    const point = fromKey(key);
    return {
      x: geo.offsetX + (point.x + 0.5) * geo.cell,
      y: geo.offsetY + (point.y + 0.5) * geo.cell
    };
  }

  // =========================================================
  // 通用小工具
  // =========================================================

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function mixColor(from, to, progress) {
    return [
      Math.round(from[0] + (to[0] - from[0]) * progress),
      Math.round(from[1] + (to[1] - from[1]) * progress),
      Math.round(from[2] + (to[2] - from[2]) * progress)
    ];
  }

  function rainbowColor(progress) {
    const normalized = clamp(progress, 0, 1);
    const scaled = normalized * (RAINBOW_STOPS.length - 1);
    const index = Math.min(RAINBOW_STOPS.length - 2, Math.floor(scaled));
    const fraction = scaled - index;
    return mixColor(RAINBOW_STOPS[index], RAINBOW_STOPS[index + 1], fraction);
  }
})();
