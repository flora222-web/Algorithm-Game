'use strict';

/**
 * 寻路实验室 · A* UI 层
 * ------------------------------------------------------------
 * 纯算法、事件流和随机地图都由 window.AStarEngine 提供；
 * 本文件只负责地图编辑、事件级回放、语义/彩虹绘制、预测与结果展示。
 */
(() => {
  // =========================================================
  // 常量与引擎引用
  // =========================================================

  const Engine = window.AStarEngine;
  const GRID_SIZE = Number(Engine && Engine.GRID_SIZE) || 20;
  const CELL_COUNT = Number(Engine && Engine.CELL_COUNT) || GRID_SIZE * GRID_SIZE;

  const TOOL_INFO = {
    wall: '按住左键拖拽绘制墙壁，右键可快速擦除。',
    start: '点击地图上的任意格子，放置新的起点。',
    end: '点击地图上的任意格子，放置新的终点。',
    erase: '点击或拖拽格子，擦掉不需要的墙壁。'
  };

  // 彩虹模式沿用原有探索顺序色板：紫色最早、粉色最晚
  const RAINBOW_STOPS = [
    [124, 91, 255],
    [77, 156, 255],
    [41, 211, 200],
    [76, 210, 126],
    [228, 212, 70],
    [255, 158, 72],
    [241, 83, 122]
  ];

  const SEMANTIC_FROM = [77, 156, 255];
  const SEMANTIC_TO = [32, 190, 170];

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

  const PLAYBACK = {
    targetMs: 2600,
    minStepMs: 24,
    maxStepMs: 140
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const traceUtils = window.TraceUtils || {};
  const formatMs = typeof traceUtils.formatMs === 'function'
    ? traceUtils.formatMs
    : (ms) => (Math.max(0, Number(ms) || 0)).toFixed(2);
  const formatSeconds = typeof traceUtils.formatSeconds === 'function'
    ? traceUtils.formatSeconds
    : (ms) => (Math.max(0, Number(ms) || 0) / 1000).toFixed(2);

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

    currentNodeValue: document.getElementById('currentNodeValue'),
    phaseValue: document.getElementById('phaseValue'),
    gValue: document.getElementById('gValue'),
    hValue: document.getElementById('hValue'),
    fValue: document.getElementById('fValue'),
    openValue: document.getElementById('openValue'),
    exploredValue: document.getElementById('exploredValue'),
    stepsValue: document.getElementById('stepsValue'),
    eventValue: document.getElementById('eventValue'),
    algoMsValue: document.getElementById('algoMsValue'),
    timerValue: document.getElementById('timerValue'),

    predictionInput: document.getElementById('predictionInput'),
    predictionResult: document.getElementById('predictionResult'),
    predictionResultText: document.getElementById('predictionResultText'),
    predictionVerdict: document.getElementById('predictionVerdict'),
    predictionStats: document.getElementById('predictionStats'),

    startBtn: document.getElementById('startBtn'),
    startLabel: document.getElementById('startLabel'),
    randomBtn: document.getElementById('randomBtn'),
    clearBtn: document.getElementById('clearBtn'),

    playbackPanel: document.getElementById('playbackPanel'),
    playbackMeta: document.getElementById('playbackMeta'),
    playbackReadout: document.getElementById('playbackReadout'),
    timelineSlider: document.getElementById('timelineSlider'),
    stepBackBtn: document.getElementById('stepBackBtn'),
    stepNextBtn: document.getElementById('stepNextBtn'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    playPauseLabel: document.getElementById('playPauseLabel'),
    playIcon: document.getElementById('playIcon'),
    pauseIcon: document.getElementById('pauseIcon'),
    speedButtons: Array.from(document.querySelectorAll('.speed-btn')),

    semanticViewBtn: document.getElementById('semanticViewBtn'),
    rainbowViewBtn: document.getElementById('rainbowViewBtn'),
    semanticLegend: document.getElementById('semanticLegend'),
    rainbowLegend: document.getElementById('rainbowLegend'),

    resultOverlay: document.getElementById('resultOverlay'),
    resultCard: document.querySelector('.result-card'),
    resultIcon: document.getElementById('resultIcon'),
    resultKicker: document.getElementById('resultKicker'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    resultSteps: document.getElementById('resultSteps'),
    resultExplored: document.getElementById('resultExplored'),
    resultTime: document.getElementById('resultTime'),
    resultPrediction: document.getElementById('resultPrediction'),
    resultTimers: document.getElementById('resultTimers'),
    resultClose: document.getElementById('resultClose'),
    resultCloseLabel: document.getElementById('resultCloseLabel'),

    toast: document.getElementById('toast'),
    liveRegion: document.getElementById('liveRegion'),
    openDocsBtn: document.getElementById('openDocsBtn')
  };

  // =========================================================
  // 状态
  // =========================================================

  const state = {
    walls: makeWallGrid(),
    start: { x: 3, y: 10 },
    end: { x: 16, y: 10 },
    tool: 'wall',
    viewMode: 'semantic',

    trace: null,
    eventIndex: 0,
    phase: 'idle', // idle | paused | playing | done
    playing: false,
    speed: 1,
    animMs: 0,
    accMs: 0,
    lastFrame: 0,
    rafId: 0,
    viewCache: null,
    pendingPrediction: null,
    prediction: null,
    predictionRecorded: false,
    completionAnnounced: false,
    overlayDismissed: false,

    hover: null,
    dragMode: null,
    lastEditedKey: -1,
    overlayOpen: false,

    toastHideTimer: 0,
    toastRemoveTimer: 0,
    domCache: {
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
    updatePredictionStats();
    resetRunState({ silent: true });
    selectTool('wall', true);
    resizeCanvas();
    updateControlsState();

    if (!isEngineReady()) {
      setStatus('failed', '引擎未加载');
      console.warn('AStarEngine 尚未加载：页面可编辑地图，但无法运行寻路。');
    }

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
    dom.stepBackBtn.addEventListener('click', () => seekTo(state.eventIndex - 1));
    dom.stepNextBtn.addEventListener('click', () => seekTo(state.eventIndex + 1));
    dom.playPauseBtn.addEventListener('click', togglePlayback);

    dom.speedButtons.forEach((button) => {
      button.addEventListener('click', () => setSpeed(Number(button.dataset.speed)));
    });

    dom.semanticViewBtn.addEventListener('click', () => setViewMode('semantic'));
    dom.rainbowViewBtn.addEventListener('click', () => setViewMode('rainbow'));

    dom.predictionInput.addEventListener('input', () => {
      dom.predictionInput.classList.remove('is-invalid');
    });

    // 鼠标操作后移除按钮焦点，保证直接按 Enter / Space 仍作用于页面。
    [
      ...dom.toolButtons,
      dom.randomBtn,
      dom.clearBtn,
      dom.startBtn,
      ...dom.speedButtons,
      dom.stepBackBtn,
      dom.stepNextBtn,
      dom.playPauseBtn,
      dom.semanticViewBtn,
      dom.rainbowViewBtn
    ].forEach((button) => {
      button.addEventListener('pointerup', () => button.blur());
    });

    dom.resultClose.addEventListener('click', () => {
      state.overlayDismissed = true;
      hideResultOverlay({ moveFocus: true });
    });

    dom.resultOverlay.addEventListener('click', (event) => {
      if (event.target === dom.resultOverlay) {
        state.overlayDismissed = true;
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
  // 引擎调用与搜索入口
  // =========================================================

  function isEngineReady() {
    return Boolean(
      Engine &&
      typeof Engine.findPathTrace === 'function'
    );
  }

  function startSearch() {
    hideToast();
    hideResultOverlay();
    cancelPlayback();
    state.hover = null;
    state.dragMode = null;
    state.overlayDismissed = false;

    if (!isEngineReady()) {
      setStatus('failed', '引擎未加载');
      showToast('寻路引擎未加载，请刷新页面后重试');
      return;
    }

    const prediction = readPredictionInput();
    if (prediction.invalid) {
      dom.predictionInput.classList.add('is-invalid');
      dom.predictionInput.focus({ preventScroll: true });
      showToast('请输入不小于 -1 的整数；无路可走填 -1');
      return;
    }
    dom.predictionInput.classList.remove('is-invalid');

    let trace;
    try {
      trace = Engine.findPathTrace(state.walls, state.start, state.end);
    } catch (error) {
      console.error('A* 引擎运行失败：', error);
      setStatus('failed', '引擎异常');
      showToast('寻路引擎运行失败，请重试');
      return;
    }

    if (
      !trace ||
      !Array.isArray(trace.events) ||
      trace.events.length === 0 ||
      !Array.isArray(trace.path)
    ) {
      setStatus('failed', '数据异常');
      showToast('引擎返回的数据不完整，请重试');
      return;
    }

    state.trace = trace;
    state.eventIndex = 0;
    state.animMs = 0;
    state.accMs = 0;
    state.phase = 'paused';
    state.playing = false;
    state.viewCache = null;
    state.pendingPrediction = prediction.value;
    state.prediction = null;
    state.predictionRecorded = false;
    state.completionAnnounced = false;
    dom.predictionResult.hidden = true;
    dom.predictionVerdict.className = 'prediction-verdict is-neutral';

    dom.timelineSlider.max = String(trace.events.length - 1);
    syncEventView(0);
    setStatus('exploring', 'A* 事件回放中');
    dom.playbackMeta.textContent = '搜索已完成 · 按空格播放，或按事件单步';
    announce(`搜索完成，共 ${trace.events.length} 个事件。可以播放或单步查看。`);

    if (reduceMotion || trace.events.length === 1) {
      seekTo(trace.events.length - 1, { skipPause: true });
    } else {
      startPlayback();
    }
  }

  // =========================================================
  // 事件索引、播放与单步
  // =========================================================

  function syncEventView(index) {
    if (!state.trace) return;

    const last = state.trace.events.length - 1;
    const next = clamp(Math.round(index), 0, last);

    state.eventIndex = next;
    renderEvent();
    updateControlsState();
  }

  function renderEvent() {
    if (!state.trace) {
      resetStatePanel();
      draw();
      return;
    }

    const view = buildEventView(state.eventIndex);
    const metrics = state.trace.metrics || {};

    setText(dom.currentNodeValue, view.current ? `(${view.current.x}, ${view.current.y})` : '—');
    setText(dom.phaseValue, phaseText(view.event));
    setText(dom.gValue, view.current ? view.current.g : 0);
    setText(dom.hValue, view.current ? view.current.h : 0);
    setText(dom.fValue, view.current ? view.current.f : 0);
    setText(dom.openValue, view.openSize);
    setText(dom.exploredValue, view.closedCount);
    setText(dom.stepsValue, view.pathStep);
    setText(dom.eventValue, `${view.index + 1}/${view.eventsCount}`);
    setText(dom.algoMsValue, formatMs(metrics.computeMs));
    setText(dom.timerValue, formatSeconds(state.animMs));

    dom.playbackReadout.textContent = `${view.index + 1}/${view.eventsCount} · ${shortPhaseText(view.event)}`;
    dom.timelineSlider.setAttribute(
      'aria-valuetext',
      `事件 ${view.index + 1} / ${view.eventsCount}，${phaseText(view.event)}，当前节点 ${view.current ? `(${view.current.x}, ${view.current.y})` : '无'}`
    );

    const last = view.eventsCount - 1;
    const progress = last > 0 ? view.index / last : 0;
    dom.playbackPanel.style.setProperty('--progress', `${(progress * 100).toFixed(2)}%`);

    const sliderValue = String(view.index);
    if (dom.timelineSlider.value !== sliderValue) {
      dom.timelineSlider.value = sliderValue;
    }

    draw();
  }

  function startPlayback() {
    if (!state.trace || state.playing) return;

    const last = state.trace.events.length - 1;
    if (last <= 0) return;

    if (state.eventIndex >= last) {
      state.eventIndex = 0;
      state.animMs = 0;
      state.accMs = 0;
      state.overlayDismissed = false;
      state.completionAnnounced = false;
      hideResultOverlay();
      syncEventView(0);
    }

    state.playing = true;
    state.phase = 'playing';
    state.accMs = 0;
    state.lastFrame = performance.now();
    setStatus('exploring', 'A* 事件回放中');
    dom.playbackMeta.textContent = '播放中 · 每个事件前进一格';
    updateControlsState();
    renderEvent();
    state.rafId = requestAnimationFrame(playbackTick);
  }

  function playbackTick(timestamp) {
    if (!state.playing || !state.trace) {
      state.rafId = 0;
      return;
    }

    const stepMs = getEventStepMs();
    const dt = Math.min(220, Math.max(0, timestamp - state.lastFrame));
    state.lastFrame = timestamp;
    state.animMs += dt;
    state.accMs += dt * state.speed;

    const last = state.trace.events.length - 1;
    let nextIndex = state.eventIndex;

    while (nextIndex < last && state.accMs >= stepMs) {
      state.accMs -= stepMs;
      nextIndex += 1;
    }

    if (nextIndex !== state.eventIndex) {
      state.eventIndex = nextIndex;
      renderEvent();
      updateControlsState();

      if (nextIndex >= last) {
        finishTrace();
        return;
      }
    }

    updateAnimationDisplay();
    state.rafId = requestAnimationFrame(playbackTick);
  }

  function togglePlayback() {
    if (!state.trace) return;

    if (state.playing) {
      pausePlayback();
    } else {
      startPlayback();
    }
  }

  function pausePlayback({ silent = false } = {}) {
    if (!state.playing) return;

    state.playing = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.phase = 'paused';
    updateControlsState();

    if (!silent) {
      setStatus('replay', '回放已暂停');
      dom.playbackMeta.textContent = '已暂停 · 可单步或拖动滑块';
    }
  }

  function cancelPlayback() {
    state.playing = false;
    state.phase = state.phase === 'done' ? 'done' : 'idle';
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
  }

  function seekTo(index, { skipPause = false } = {}) {
    if (!state.trace) return;
    if (!skipPause) pausePlayback({ silent: true });

    const last = state.trace.events.length - 1;
    const next = clamp(Math.round(index), 0, last);

    if (next < last) {
      state.overlayDismissed = false;
      hideResultOverlay();
      state.phase = 'paused';
      setStatus('replay', '回放中 · 单步验证');
      dom.playbackMeta.textContent = '已暂停 · 可单步或拖动滑块';
      state.completionAnnounced = false;
    }

    syncEventView(next);

    if (next >= last) {
      finishTrace();
    } else {
      updateControlsState();
    }
  }

  function onTimelineInput() {
    if (!state.trace) return;
    seekTo(Number(dom.timelineSlider.value));
  }

  function setSpeed(speed) {
    if (![1, 2, 4].includes(speed)) return;
    state.speed = speed;
    updateSpeedButtons();
  }

  function finishTrace() {
    if (!state.trace) return;

    const last = state.trace.events.length - 1;
    state.eventIndex = last;
    state.playing = false;
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = 0;
    }
    state.phase = 'done';
    state.animMs = Math.max(0, state.animMs);

    renderEvent();
    evaluatePrediction();
    updateControlsState();

    const found = Boolean(state.trace.found);
    setStatus(found ? 'success' : 'failed', found ? '已到达终点' : '无法抵达');
    dom.playbackMeta.textContent = found
      ? '回放结束 · 可拖动滑块重看'
      : '回放结束 · 没有连通路径';

    if (!state.overlayDismissed && !state.overlayOpen) {
      showResultOverlay(found);
    }

    if (!state.completionAnnounced) {
      state.completionAnnounced = true;
      const metrics = state.trace.metrics || {};
      announce(
        found
          ? `寻路成功！共 ${getActualMoves()} 步，探索 ${Number(metrics.expanded) || 0} 个节点。`
          : `没有找到可行路径，共探索 ${Number(metrics.expanded) || 0} 个节点。`
      );
    }
  }

  function getEventStepMs() {
    if (!state.trace) return PLAYBACK.maxStepMs;
    const steps = Math.max(1, state.trace.events.length - 1);
    return clamp(PLAYBACK.targetMs / steps, PLAYBACK.minStepMs, PLAYBACK.maxStepMs);
  }

  function updateAnimationDisplay() {
    const text = formatSeconds(state.animMs);
    if (state.domCache.timer !== text) {
      dom.timerValue.textContent = text;
      state.domCache.timer = text;
    }
  }

  function updateControlsState() {
    const hasTrace = Boolean(state.trace && state.trace.events.length);
    const last = hasTrace ? state.trace.events.length - 1 : 0;
    const atEnd = hasTrace && state.eventIndex >= last;

    dom.timelineSlider.disabled = !hasTrace || last === 0;
    dom.stepBackBtn.disabled = !hasTrace || state.eventIndex <= 0;
    dom.stepNextBtn.disabled = !hasTrace || atEnd;
    dom.playPauseBtn.disabled = !hasTrace || last === 0;

    dom.playIcon.hidden = state.playing;
    dom.pauseIcon.hidden = !state.playing;

    if (state.playing) {
      dom.playPauseLabel.textContent = '暂停';
    } else if (!hasTrace) {
      dom.playPauseLabel.textContent = '播放';
    } else if (atEnd) {
      dom.playPauseLabel.textContent = '重播';
    } else if (state.eventIndex > 0) {
      dom.playPauseLabel.textContent = '继续';
    } else {
      dom.playPauseLabel.textContent = '播放';
    }

    dom.playbackPanel.dataset.state = hasTrace
      ? state.playing ? 'replaying' : 'ready'
      : 'empty';

    updateSpeedButtons();
  }

  function updateSpeedButtons() {
    dom.speedButtons.forEach((button) => {
      const active = Number(button.dataset.speed) === state.speed;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = !state.trace;
    });
  }

  function buildEventView(index) {
    const trace = state.trace;
    const last = trace.events.length - 1;
    const target = clamp(Math.round(index), 0, last);

    if (state.viewCache && state.viewCache.trace === trace && state.viewCache.index === target) {
      return state.viewCache.view;
    }

    const closed = [];
    const closedSet = new Set();
    let current = null;
    let pathStep = 0;
    let doneFound = null;

    for (let i = 0; i <= target; i += 1) {
      const event = trace.events[i];

      if (event.type === 'expand') {
        closed.push(event.key);
        closedSet.add(event.key);
        current = event;
      } else if (event.type === 'path') {
        if (Number.isFinite(event.step)) {
          pathStep = Math.max(pathStep, event.step);
        }
      } else if (event.type === 'done') {
        doneFound = Boolean(event.found);
      }
    }

    const metrics = trace.metrics || {};
    const totalVisited = trace.visited && trace.visited.length ? trace.visited.length : closed.length;
    const actualMoves = trace.found
      ? Math.max(0, Number(metrics.pathMoves) || Math.max(0, trace.path.length - 1))
      : -1;

    if (doneFound === true) {
      pathStep = actualMoves;
    }

    const view = {
      index: target,
      event: trace.events[target],
      eventsCount: trace.events.length,
      closed,
      closedSet,
      current,
      openTop: current && Array.isArray(current.openTop) ? current.openTop : [],
      openSize: current ? Math.max(0, Number(current.openSize) || 0) : 0,
      closedCount: current
        ? Math.max(0, Number.isFinite(current.closedCount) ? current.closedCount : closed.length)
        : closed.length,
      pathStep,
      totalVisited,
      actualMoves,
      doneFound
    };

    state.viewCache = { trace, index: target, view };
    return view;
  }

  function phaseText(event) {
    if (!event) return '等待开始';
    if (event.type === 'expand') {
      return event.phase === 'goal' ? '目标节点弹出' : '扩展当前节点';
    }
    if (event.type === 'path') {
      return `回溯路径第 ${event.step} 步`;
    }
    if (event.type === 'done') {
      return event.found ? '搜索完成 · 已找到路径' : '搜索完成 · 无可行路径';
    }
    return '回放中';
  }

  function shortPhaseText(event) {
    if (!event) return '等待';
    if (event.type === 'expand') {
      return event.phase === 'goal' ? '目标' : '扩展';
    }
    if (event.type === 'path') return '回溯';
    if (event.type === 'done') return event.found ? '完成' : '无路';
    return '回放';
  }

  // =========================================================
  // 预测
  // =========================================================

  function readPredictionInput() {
    const raw = dom.predictionInput.value.trim();
    if (raw === '') return { value: null, invalid: false };

    const value = Number(raw);
    if (!Number.isInteger(value) || value < -1) {
      return { value: null, invalid: true };
    }

    return { value, invalid: false };
  }

  function getActualMoves() {
    if (!state.trace) return -1;
    if (!state.trace.found) return -1;
    const metrics = state.trace.metrics || {};
    return Math.max(0, Number(metrics.pathMoves) || Math.max(0, state.trace.path.length - 1));
  }

  function evaluatePrediction() {
    if (!state.trace || state.prediction) return;

    const actual = getActualMoves();
    const guess = state.pendingPrediction;
    const actualText = formatActual(actual);

    if (guess === null) {
      state.prediction = { guess: null, actual, ok: null };
      dom.predictionResult.hidden = false;
      dom.predictionResultText.textContent = `未做预测 / 实际 ${actualText}`;
      dom.predictionVerdict.textContent = '—';
      dom.predictionVerdict.className = 'prediction-verdict is-neutral';
    } else {
      const ok = guess === actual;
      state.prediction = { guess, actual, ok };
      state.predictionRecorded = true;

      let record = null;
      try {
        if (window.ProgressStore && typeof window.ProgressStore.recordPrediction === 'function') {
          record = window.ProgressStore.recordPrediction('astar', ok);
        }
      } catch (error) {
        console.warn('预测记录写入失败：', error);
      }

      dom.predictionResult.hidden = false;
      dom.predictionResultText.textContent = `预测 ${guess} / 实际 ${actualText}`;
      dom.predictionVerdict.textContent = ok ? '✓ 预测正确' : '✗ 预测错误';
      dom.predictionVerdict.className = `prediction-verdict ${ok ? 'is-correct' : 'is-wrong'}`;
      updatePredictionStats(record);
    }

    updateResultPrediction();
  }

  function updatePredictionStats(record) {
    let stats = record;

    if (!stats && window.ProgressStore && typeof window.ProgressStore.get === 'function') {
      try {
        stats = window.ProgressStore.get('astar');
      } catch (error) {
        stats = null;
      }
    }

    const predictions = stats && stats.predictions ? stats.predictions : null;
    const attempts = predictions ? Number(predictions.attempts) || 0 : 0;

    if (attempts <= 0) {
      dom.predictionStats.textContent = '历史预测正确率 —';
      return;
    }

    const correct = Number(predictions.correct) || 0;
    const accuracy = Math.round((correct / attempts) * 1000) / 10;
    dom.predictionStats.textContent = `历史预测正确率 ${accuracy}% · ${correct}/${attempts}`;
  }

  function updateResultPrediction() {
    if (!state.prediction) {
      dom.resultPrediction.hidden = true;
      return;
    }

    const { guess, actual, ok } = state.prediction;
    const actualText = formatActual(actual);

    dom.resultPrediction.hidden = false;
    dom.resultPrediction.className = 'result-prediction';

    if (guess === null) {
      dom.resultPrediction.textContent = `未做预测 · 实际 ${actualText}`;
      dom.resultPrediction.classList.add('is-neutral');
    } else {
      dom.resultPrediction.textContent =
        `预测 ${guess} / 实际 ${actualText} · ${ok ? '预测正确' : '预测错误'}`;
      dom.resultPrediction.classList.add(ok ? 'is-correct' : 'is-wrong');
    }
  }

  function formatActual(actual) {
    return actual === -1 ? '无路' : `${actual}`;
  }

  // =========================================================
  // 重置单局状态
  // =========================================================

  function resetRunState({ silent = false, clearPredictionInput = false } = {}) {
    cancelPlayback();
    state.phase = 'idle';
    state.trace = null;
    state.eventIndex = 0;
    state.animMs = 0;
    state.accMs = 0;
    state.viewCache = null;
    state.pendingPrediction = null;
    state.prediction = null;
    state.predictionRecorded = false;
    state.completionAnnounced = false;
    state.overlayDismissed = false;
    state.overlayOpen = false;

    if (clearPredictionInput) {
      dom.predictionInput.value = '';
      dom.predictionInput.classList.remove('is-invalid');
    }

    dom.predictionResult.hidden = true;
    dom.predictionVerdict.className = 'prediction-verdict is-neutral';

    hideResultOverlay();
    resetPlaybackPanel();
    resetStatePanel();
    updateControlsState();

    if (!silent) {
      setStatus('idle', '准备就绪');
      draw();
    }
  }

  function resetPlaybackPanel() {
    dom.timelineSlider.disabled = true;
    dom.timelineSlider.max = '0';
    dom.timelineSlider.value = '0';
    dom.timelineSlider.setAttribute('aria-valuetext', '尚未开始寻路');
    dom.playbackPanel.dataset.state = 'empty';
    dom.playbackPanel.style.setProperty('--progress', '0%');
    dom.playbackMeta.textContent = '完成一次寻路后，按事件单步验证';
    dom.playbackReadout.textContent = '等待寻路';
    dom.playIcon.hidden = false;
    dom.pauseIcon.hidden = true;
    dom.playPauseLabel.textContent = '播放';
  }

  function resetStatePanel() {
    setText(dom.currentNodeValue, '—');
    setText(dom.phaseValue, '等待开始');
    setText(dom.gValue, 0);
    setText(dom.hValue, 0);
    setText(dom.fValue, 0);
    setText(dom.openValue, 0);
    setText(dom.exploredValue, 0);
    setText(dom.stepsValue, 0);
    setText(dom.eventValue, '0/0');
    setText(dom.algoMsValue, '0.00');
    setText(dom.timerValue, '0.00');
    state.domCache.timer = '0.00';
  }

  function setText(element, value) {
    const text = String(value);
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
  }

  // =========================================================
  // 视图模式
  // =========================================================

  function setViewMode(mode, { silent = false } = {}) {
    state.viewMode = mode === 'rainbow' ? 'rainbow' : 'semantic';

    const semantic = state.viewMode === 'semantic';
    dom.semanticViewBtn.classList.toggle('is-active', semantic);
    dom.rainbowViewBtn.classList.toggle('is-active', !semantic);
    dom.semanticViewBtn.setAttribute('aria-pressed', String(semantic));
    dom.rainbowViewBtn.setAttribute('aria-pressed', String(!semantic));
    dom.semanticLegend.hidden = !semantic;
    dom.rainbowLegend.hidden = semantic;
    dom.playbackPanel.dataset.view = state.viewMode;

    if (!silent) draw();
  }

  // =========================================================
  // 结果浮层与轻提示
  // =========================================================

  function showResultOverlay(success) {
    if (!state.trace) return;

    const metrics = state.trace.metrics || {};
    const pathMoves = success ? getActualMoves() : 0;
    const expanded = Number(metrics.expanded)
      || (state.trace.visited ? state.trace.visited.length : 0);

    hideToast();
    updateResultPrediction();

    dom.resultCard.classList.toggle('is-failure', !success);
    dom.resultIcon.classList.toggle('is-failure', !success);
    dom.resultIcon.innerHTML = success ? ICONS.success : ICONS.failure;

    dom.resultKicker.textContent = success ? 'ROUTE FOUND' : 'NO ROUTE';
    dom.resultTitle.textContent = success ? '寻路成功！' : '这条路走不通';
    dom.resultMessage.textContent = success
      ? 'A* 已经找到通往终点的最短路径。拖动事件滑块，可以回看每一次开放集变化。'
      : '起点和终点之间暂时没有连通路线，调整一下障碍物再试一次吧。';

    dom.resultSteps.textContent = String(pathMoves);
    dom.resultExplored.textContent = String(expanded);
    dom.resultTime.textContent = `${formatMs(metrics.computeMs)} ms`;
    dom.resultTimers.textContent =
      `算法 ${formatMs(metrics.computeMs)} ms · 动画 ${formatSeconds(state.animMs)} s`;
    dom.resultCloseLabel.textContent = success ? '继续探索' : '调整地图';

    dom.resultOverlay.hidden = false;
    state.overlayOpen = true;

    if (
      (!docsViewer || !docsViewer.isOpen()) &&
      document.activeElement !== dom.timelineSlider
    ) {
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
    if (!TOOL_INFO[tool]) return;

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
    if (state.trace || state.playing || state.phase !== 'idle') {
      resetRunState({ clearPredictionInput: true });
      showToast('地图已修改，本次回放已重置');
    }
    return true;
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;

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

    if (state.dragMode && cell) {
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

    state.walls = makeWallGrid();
    resetRunState({ clearPredictionInput: true });
    draw();
    showToast('障碍物已清空，重新布置地图吧');
    announce('障碍物已清空。');
  }

  function generateRandomMap() {
    hideResultOverlay();

    if (!Engine || typeof Engine.generateRandomWalls !== 'function') {
      showToast('寻路引擎未加载，无法生成随机地图');
      return;
    }

    let generated = null;

    try {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        generated = Engine.generateRandomWalls(state.start, state.end, 0.24);
        if (
          !Engine.hasPath ||
          typeof Engine.hasPath !== 'function' ||
          Engine.hasPath(generated, state.start, state.end)
        ) {
          break;
        }
      }
    } catch (error) {
      console.error('随机地图生成失败：', error);
      showToast('随机地图生成失败，请重试');
      return;
    }

    if (!generated) {
      showToast('随机地图生成失败，请重试');
      return;
    }

    // 地图编辑层的不变量：起点和终点永远保持可通行
    generated[state.start.y][state.start.x] = false;
    generated[state.end.y][state.end.x] = false;

    state.walls = generated;
    resetRunState({ clearPredictionInput: true });
    draw();
    showToast('随机地图已生成 · 按 Enter 开始并验证');
    announce('随机地图已生成，按回车键开始寻路。');
  }

  // =========================================================
  // 键盘快捷键
  // =========================================================

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (docsViewer && docsViewer.isOpen()) return;

    const target = event.target;
    const isEditable = target instanceof HTMLElement && (
      target.isContentEditable ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    );

    if (event.key === 'Enter') {
      if (target === dom.predictionInput) {
        event.preventDefault();
        startSearch();
        return;
      }

      if (isEditable) return;

      const focusedControl = target instanceof Element
        ? target.closest('button, a[href], [role="button"], [role="tab"]')
        : null;

      if (focusedControl) return;

      event.preventDefault();

      if (state.overlayOpen) {
        state.overlayDismissed = true;
        hideResultOverlay({ moveFocus: true });
        return;
      }

      startSearch();
      return;
    }

    if (event.key === 'Escape') {
      if (state.overlayOpen) {
        event.preventDefault();
        state.overlayDismissed = true;
        hideResultOverlay({ moveFocus: true });
      }
      return;
    }

    if (isEditable) return;

    if (event.repeat) return;

    if (event.key === ' ' || event.code === 'Space') {
      if (target instanceof Element && target.closest('button, a[href]')) return;
      if (state.trace && !state.overlayOpen) {
        event.preventDefault();
        togglePlayback();
      }
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      if (target instanceof Element && target.closest('input, button, a[href]')) return;
      if (!state.trace || state.overlayOpen) return;
      event.preventDefault();
      seekTo(state.eventIndex + (event.key === 'ArrowRight' ? 1 : -1));
      return;
    }

    if (state.overlayOpen) return;

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

  function draw() {
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

    const view = state.trace ? buildEventView(state.eventIndex) : null;

    context.clearRect(0, 0, width, height);
    drawBoard(geometry);

    if (view) {
      if (state.viewMode === 'rainbow') {
        drawRainbowVisited(geometry, view);
      } else {
        drawSemanticVisited(geometry, view);
      }
    }

    drawWalls(geometry);

    if (view && state.viewMode === 'semantic') {
      drawOpenSet(geometry, view);
    }

    if (view) {
      drawEventPath(geometry, view);
      drawCurrentNode(geometry, view.current);
    }

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

  function drawSemanticVisited(geo, view) {
    if (view.closed.length === 0) return;

    const total = Math.max(1, view.totalVisited - 1);

    for (let i = 0; i < view.closed.length; i += 1) {
      const point = fromKey(view.closed[i]);
      const progress = view.totalVisited <= 1 ? 0 : i / total;
      const color = mixColor(SEMANTIC_FROM, SEMANTIC_TO, progress);
      const alpha = 0.24 + progress * 0.16;

      const px = geo.offsetX + point.x * geo.cell;
      const py = geo.offsetY + point.y * geo.cell;
      const pad = geo.cell * 0.11;
      const size = geo.cell - pad * 2;

      context.save();
      context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
      roundedRectPath(context, px + pad, py + pad, size, size, Math.max(2, geo.cell * 0.15));
      context.fill();
      context.restore();
    }
  }

  function drawRainbowVisited(geo, view) {
    if (view.closed.length === 0) return;

    const total = Math.max(1, view.totalVisited - 1);

    for (let i = 0; i < view.closed.length; i += 1) {
      const point = fromKey(view.closed[i]);
      const progress = view.totalVisited <= 1 ? 0 : i / total;
      const color = rainbowColor(progress);

      const px = geo.offsetX + point.x * geo.cell;
      const py = geo.offsetY + point.y * geo.cell;
      const pad = geo.cell * 0.1;
      const size = geo.cell - pad * 2;

      context.save();
      context.globalAlpha = 0.92;
      context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      roundedRectPath(context, px + pad, py + pad, size, size, Math.max(2, geo.cell * 0.16));
      context.fill();
      context.restore();
    }
  }

  function drawOpenSet(geo, view) {
    if (!view.openTop || view.openTop.length === 0) return;

    const dash = Math.max(2, geo.cell * 0.13);
    const gap = Math.max(1.5, geo.cell * 0.09);

    for (let i = 0; i < view.openTop.length; i += 1) {
      const node = view.openTop[i];
      if (!node || view.closedSet.has(node.key)) continue;

      const x = Number.isFinite(node.x) ? node.x : fromKey(node.key).x;
      const y = Number.isFinite(node.y) ? node.y : fromKey(node.key).y;

      if (!isInside(x, y) || state.walls[y][x]) continue;

      const px = geo.offsetX + x * geo.cell;
      const py = geo.offsetY + y * geo.cell;
      const pad = geo.cell * (i === 0 ? 0.13 : 0.16);
      const size = geo.cell - pad * 2;
      const radius = Math.max(2, geo.cell * 0.16);

      context.save();
      context.fillStyle = i === 0
        ? 'rgba(77, 156, 255, 0.12)'
        : 'rgba(77, 156, 255, 0.06)';
      roundedRectPath(context, px + pad, py + pad, size, size, radius);
      context.fill();

      context.setLineDash([dash, gap]);
      context.lineWidth = Math.max(1.3, geo.cell * (i === 0 ? 0.07 : 0.055));
      context.strokeStyle = i === 0
        ? 'rgba(41, 107, 232, 0.92)'
        : 'rgba(53, 109, 243, 0.55)';
      roundedRectPath(context, px + pad, py + pad, size, size, radius);
      context.stroke();
      context.restore();
    }
  }

  function drawCurrentNode(geo, current) {
    if (!current) return;

    const center = cellCenter(current.key, geo);
    const inset = Math.max(1.5, geo.cell * 0.055);
    const radius = Math.max(2.5, geo.cell * 0.2);
    const px = center.x - geo.cell / 2 + inset;
    const py = center.y - geo.cell / 2 + inset;
    const size = geo.cell - inset * 2;

    context.save();
    roundedRectPath(context, px, py, size, size, radius);

    context.lineWidth = Math.max(3.4, geo.cell * 0.16);
    context.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    context.stroke();

    context.shadowColor = 'rgba(17, 94, 89, 0.32)';
    context.shadowBlur = geo.cell * 0.28;
    context.lineWidth = Math.max(1.8, geo.cell * 0.075);
    context.strokeStyle = '#0f766e';
    context.stroke();

    context.shadowBlur = 0;
    context.beginPath();
    context.arc(center.x, center.y, Math.max(1.8, geo.cell * 0.075), 0, Math.PI * 2);
    context.fillStyle = '#0f766e';
    context.fill();
    context.restore();
  }

  function drawEventPath(geo, view) {
    const path = state.trace ? state.trace.path : null;
    if (!path || path.length < 2 || view.pathStep <= 0) return;

    const visibleStep = Math.min(view.pathStep, path.length - 1);
    if (visibleStep < 1) return;

    const startPoint = cellCenter(path[0], geo);

    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);

    for (let i = 1; i <= visibleStep; i += 1) {
      const point = cellCenter(path[i], geo);
      context.lineTo(point.x, point.y);
    }

    context.lineWidth = Math.max(5.2, geo.cell * 0.3);
    context.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    context.stroke();

    context.lineWidth = Math.max(2.4, geo.cell * 0.11);
    context.strokeStyle = '#243a5c';
    context.stroke();

    // 正在回溯时的笔尖
    if (visibleStep < path.length - 1) {
      const tip = cellCenter(path[visibleStep], geo);

      context.beginPath();
      context.arc(tip.x, tip.y, Math.max(3, geo.cell * 0.13), 0, Math.PI * 2);
      context.fillStyle = '#fff';
      context.fill();

      context.beginPath();
      context.arc(tip.x, tip.y, Math.max(1.3, geo.cell * 0.055), 0, Math.PI * 2);
      context.fillStyle = '#243a5c';
      context.fill();
    }

    context.restore();
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

  function drawHoverCell(geo) {
    if (!state.hover) return;
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

  function setStatus(visualState, text) {
    if (dom.statusPill.dataset.state !== visualState) {
      dom.statusPill.dataset.state = visualState;
    }
    setText(dom.statusText, text);
  }

  // =========================================================
  // 引擎辅助与通用小工具
  // =========================================================

  function makeWallGrid() {
    if (Engine && typeof Engine.createWallGrid === 'function') {
      return Engine.createWallGrid();
    }

    return Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => false)
    );
  }

  function toKey(x, y) {
    if (Engine && typeof Engine.toKey === 'function') {
      return Engine.toKey(x, y);
    }
    return y * GRID_SIZE + x;
  }

  function fromKey(key) {
    if (Engine && typeof Engine.fromKey === 'function') {
      return Engine.fromKey(key);
    }
    return { x: key % GRID_SIZE, y: Math.floor(key / GRID_SIZE) };
  }

  function isInside(x, y) {
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
  }

  function sameCell(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

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
