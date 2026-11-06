'use strict';

/**
 * 寻路实验室 · A* UI 层
 * ------------------------------------------------------------
 * 纯算法、事件流和随机地图都由 window.AStarEngine 提供；
 * 本文件只负责地图编辑、事件级回放、语义绘制、预测、算法对比与关卡展示。
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

  // ---------- P1：算法对比与关卡 ----------

  const COMPARE_ROWS = [
    { key: 'astar', label: 'A*' },
    { key: 'bfs', label: 'BFS' },
    { key: 'dijkstra', label: 'Dijkstra' }
  ];

  // 概念先导：先用“稳妥 / 标准 / 激进”讲走法，技术名与 w 只在二级说明出现
  const NAV_STYLES = [
    { weight: 0, label: '稳妥', summary: '更接近 Dijkstra：多探索一些，最短路径有保证。' },
    { weight: 1, label: '标准', summary: '标准 A*：在方向感和搜索量之间取平衡。' },
    { weight: 2, label: '激进', summary: '更相信终点方向的估计：可能更快，但不保证最短。' }
  ];

  const WHY_STORAGE_KEY = 'astar.whyTutorialDone.v1';
  const CANVAS_MONO = '"SFMono-Regular", "Cascadia Code", "Roboto Mono", Consolas, monospace';

  // 固定陷阱图：两处缺口；激进会先钻近处缺口，再绕上廊，最终多走 4 步。
  const TRAP_MAP = {
    start: { x: 1, y: 10 },
    end: { x: 18, y: 10 },
    walls: [[7, 9], [8, 9], [3, 10], [9, 10], [15, 10], [9, 11]]
  };

  const WHY_CANDIDATES = {
    plain: [
      { key: 'A', g: 3, h: 6, f: 9, correct: true },
      { key: 'B', g: 7, h: 3, f: 10, correct: false },
      { key: 'C', g: 5, h: 7, f: 12, correct: false }
    ],
    weighted: [
      { key: 'A', g: 3, h: 6, f: 15, correct: false },
      { key: 'B', g: 7, h: 3, f: 13, correct: true },
      { key: 'C', g: 5, h: 7, f: 19, correct: false }
    ]
  };

  const WHY_QUIZ_OPTIONS = [
    { key: 'A', text: 'h 会变成真实距离，f 更准确', correct: false },
    { key: 'B', text: '不管怎么加权，路径一定仍然最短', correct: false },
    { key: 'C', text: '扩展可能更少，但路径可能变长（不再保证最短）', correct: true }
  ];

  const LEVELS = {
    heuristic: {
      id: 'heuristic',
      order: 1,
      kicker: 'LEVEL 1 · HEURISTIC',
      name: '启发对比',
      goal: '固定空地图，起点 (3, 10)、终点 (16, 10)。运行 A* / BFS / Dijkstra 对比，验证 A* 扩展节点少于 BFS。',
      meta: '起点 (3,10) → 终点 (16,10) · 固定空地图',
      quiz: {
        question: '同样一张空地图，为什么 A* 通常比 BFS 扩展更少节点？',
        hint: 'A* 的 f = g + h，曼哈顿启发会优先考虑离终点更近的节点。',
        options: [
          { text: '曼哈顿启发让 A* 优先朝终点方向扩展', correct: true },
          { text: 'BFS 会重复扩展同一个节点，所以更慢', correct: false },
          { text: 'A* 完全不需要检查邻居，因此扩展更少', correct: false }
        ]
      }
    },
    tiebreak: {
      id: 'tiebreak',
      order: 2,
      kicker: 'LEVEL 2 · TIE-BREAK',
      name: '平局打破',
      goal: '固定墙体地图。点击「运行两种平局」，比较 tieBreak:"h" 与 "key" 的路径步数与访问顺序。',
      meta: '起点 (3,3) → 终点 (16,16) · 固定墙体地图',
      start: { x: 3, y: 3 },
      end: { x: 16, y: 16 },
      walls: [
        [8, 7], [8, 8], [8, 9], [9, 9],
        [12, 12], [12, 13], [13, 13]
      ],
      quiz: {
        question: '改变平局时的出堆顺序（tieBreak）通常会带来什么影响？',
        hint: '平局只决定同样 f 值的节点谁先扩展；距离估计不高估时，最短路径长度不变。',
        options: [
          { text: '路径长度与访问顺序都会变长', correct: false },
          { text: '访问顺序可能不同，但最短路径长度不变', correct: true },
          { text: '只有 tieBreak:"h" 才能找到最短路径', correct: false }
        ]
      }
    },
    unreachable: {
      id: 'unreachable',
      order: 3,
      kicker: 'LEVEL 3 · UNREACHABLE',
      name: '无路可达',
      goal: '固定地图已封死终点四邻。开始搜索，验证 A* 返回 found=false 且 expanded > 0。',
      meta: '起点 (3,10) → 终点 (16,10) · 固定地图 · 终点四邻封死',
      quiz: {
        question: '当终点四邻被封死时，A* 的正确行为是？',
        hint: '堆被清空之前，算法必须确认所有可达节点都扩展完了，才能断言无路。',
        options: [
          { text: '立刻返回无路，扩展节点数为 0', correct: false },
          { text: '扩展完可达区域后返回无路，扩展数大于 0', correct: true },
          { text: '穿过墙壁强行连到终点', correct: false }
        ]
      }
    }
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
    appShell: document.querySelector('main.app'),
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

    resultOverlay: document.getElementById('resultOverlay'),
    resultCard: document.querySelector('.result-card'),
    resultIcon: document.getElementById('resultIcon'),
    resultKicker: document.getElementById('resultKicker'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    resultSteps: document.getElementById('resultSteps'),
    resultExplored: document.getElementById('resultExplored'),
    resultTime: document.getElementById('resultTime'),
    resultStyle: document.getElementById('resultStyle'),
    resultPrediction: document.getElementById('resultPrediction'),
    resultTimers: document.getElementById('resultTimers'),
    resultClose: document.getElementById('resultClose'),
    resultCloseLabel: document.getElementById('resultCloseLabel'),

    toast: document.getElementById('toast'),
    liveRegion: document.getElementById('liveRegion'),
    openDocsBtn: document.getElementById('openDocsBtn'),

    compareBtn: document.getElementById('compareBtn'),
    compareStatus: document.getElementById('compareStatus'),
    compareTableWrap: document.getElementById('compareTableWrap'),
    compareBody: document.getElementById('compareBody'),

    navStyleButtons: Array.from(document.querySelectorAll('.nav-style-btn')),
    navStyleBadge: document.getElementById('navStyleBadge'),
    navStyleResult: document.getElementById('navStyleResult'),
    navStyleNote: document.getElementById('navStyleNote'),
    navStyleTech: document.getElementById('navStyleTech'),
    navStyleDivergence: document.getElementById('navStyleDivergence'),
    dataFootLabel: document.getElementById('dataFootLabel'),

    whyBtn: document.getElementById('whyBtn'),
    whyBtnHint: document.getElementById('whyBtnHint'),
    whyBackdrop: document.getElementById('whyBackdrop'),
    whyModal: document.getElementById('whyModal'),
    whyClose: document.getElementById('whyClose'),
    whyBack: document.getElementById('whyBack'),
    whyNext: document.getElementById('whyNext'),
    whyDone: document.getElementById('whyDone'),
    whyStepCount: document.getElementById('whyStepCount'),
    whySteps: Array.from(document.querySelectorAll('[data-why-step]')),
    whyDots: Array.from(document.querySelectorAll('[data-why-dot]')),
    whyOptionsPredict1: document.getElementById('whyOptionsPredict1'),
    whyOptionsPredict2: document.getElementById('whyOptionsPredict2'),
    whyOptionsQuiz: document.getElementById('whyOptionsQuiz'),
    whyFeedbackPredict1: document.getElementById('whyFeedbackPredict1'),
    whyFeedbackPredict2: document.getElementById('whyFeedbackPredict2'),
    whyFeedbackQuiz: document.getElementById('whyFeedbackQuiz'),
    whyTerms: document.getElementById('whyTerms'),

    trapMapBtn: document.getElementById('trapMapBtn'),
    trapMapPanel: document.getElementById('trapMapPanel'),
    trapMapText: document.getElementById('trapMapText'),
    trapRestoreBtn: document.getElementById('trapRestoreBtn'),

    decisionHint: document.getElementById('decisionHint'),
    decisionHintText: document.getElementById('decisionHintText'),

    railTabs: Array.from(document.querySelectorAll('.rail-tab')),
    railPanels: Array.from(document.querySelectorAll('.rail-panel')),
    levelDetailBtn: document.getElementById('levelDetailBtn'),
    levelDetailDrawer: document.getElementById('levelDetailDrawer'),
    levelDetailBackdrop: document.getElementById('levelDetailBackdrop'),
    levelDetailClose: document.getElementById('levelDetailClose'),

    playBackLink: document.getElementById('playBackLink'),
    playBackLabel: document.getElementById('playBackLabel'),
    playToplineNote: document.getElementById('playToplineNote'),
    missionBar: document.getElementById('missionBar'),
    missionEyebrowNote: document.getElementById('missionEyebrowNote'),
    levelInlineState: document.getElementById('levelInlineState'),
    levelGoalBadge: document.getElementById('levelGoalBadge'),
    levelLiveText: document.getElementById('levelLiveText'),

    levelTabs: Array.from(document.querySelectorAll('.level-tab')),
    levelKicker: document.getElementById('levelKicker'),
    levelGoal: document.getElementById('levelGoal'),
    levelMeta: document.getElementById('levelMeta'),
    levelActionBtn: document.getElementById('levelActionBtn'),
    loadLevelBtn: document.getElementById('loadLevelBtn'),
    levelCta: document.getElementById('levelCta'),
    levelQuizPill: document.getElementById('levelQuizPill'),
    levelFeedback: document.getElementById('levelFeedback'),
    levelMasteryText: document.getElementById('levelMasteryText'),
    levelQuizLock: document.getElementById('levelQuizLock'),
    levelQuizBlock: document.getElementById('levelQuizBlock'),
    quizSolvedNote: document.getElementById('quizSolvedNote'),
    levelNextCta: document.getElementById('levelNextCta'),
    levelDrawerFoot: document.getElementById('levelDrawerFoot'),
    quizQuestion: document.getElementById('quizQuestion'),
    quizOptions: document.getElementById('quizOptions'),
    quizSubmitBtn: document.getElementById('quizSubmitBtn'),
    quizFeedback: document.getElementById('quizFeedback')
  };

  // =========================================================
  // 状态
  // =========================================================

  const state = {
    walls: makeWallGrid(),
    start: { x: 3, y: 10 },
    end: { x: 16, y: 10 },
    tool: 'wall',
    heuristicWeight: 1,
    navStyleSelected: false,

    tutorialOpen: false,
    tutorialDone: false,
    tutorialStep: 0,
    tutorialAnswers: {
      predict1: { picked: null, solved: false },
      predict2: { picked: null, solved: false },
      quiz: { picked: null, solved: false }
    },
    trapSnapshot: null,
    trapActive: false,

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
    detailDrawerOpen: false,

    toastHideTimer: 0,
    toastRemoveTimer: 0,
    domCache: {
      timer: null
    },

    playMode: 'custom', // level | custom
    requestedLevel: null,
    openDocsOnInit: false,
    levelId: 'heuristic',
    levelRuntime: {
      heuristic: createLevelRuntime(),
      tiebreak: createLevelRuntime(),
      unreachable: createLevelRuntime()
    }
  };

  function createLevelRuntime() {
    return {
      loaded: false,
      checked: false,
      passed: false,
      quizCorrect: false,
      quizIndex: null,
      feedback: null
    };
  }

  // =========================================================
  // 初始化
  // =========================================================

  let resizeRaf = 0;
  let docsViewer = null;

  init();

  function init() {
    const playConfig = readPlayConfig();
    state.playMode = playConfig.mode;
    state.requestedLevel = playConfig.level;
    state.openDocsOnInit = playConfig.openDocs;
    document.body.dataset.playMode = state.playMode;

    state.tutorialDone = readWhyTutorialDone();
    bindEvents();
    initWhyTutorial();
    initAlgorithmDocs();
    updatePredictionStats();
    initLevels();
    renderNavStyle();
    resetRunState({ silent: true });
    selectTool('wall', true);
    resizeCanvas();
    updateControlsState();
    applyPlayMode();
    openDocsFromQuery();

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

  function readPlayConfig() {
    let params = null;
    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      params = null;
    }

    const requested = params ? params.get('level') : null;
    const validLevel = Boolean(requested && LEVELS[requested]);

    return {
      mode: validLevel ? 'level' : 'custom',
      level: validLevel ? requested : null,
      openDocs: Boolean(params && params.get('docs') === '1')
    };
  }

  function applyPlayMode() {
    const levelMode = state.playMode === 'level';
    document.body.dataset.playMode = state.playMode;
    document.body.classList.toggle('is-level-mode', levelMode);

    if (dom.playBackLabel) {
      dom.playBackLabel.textContent = levelMode ? '关卡选择' : 'A* 算法首页';
    }
    if (dom.playToplineNote) {
      dom.playToplineNote.textContent = levelMode
        ? '关卡模式 · 固定地图'
        : '自由探索 · 完整驾驶舱';
    }

    if (levelMode) {
      const level = LEVELS[state.levelId];
      if (dom.missionEyebrowNote && level) {
        dom.missionEyebrowNote.textContent = `LEVEL ${level.order} / 3`;
      }
      document.body.dataset.levelId = state.levelId;
      loadLevel(state.levelId, { initial: true });
      lockEditingTools();
      selectRailTab(state.levelId === 'heuristic' ? 'compare' : 'status');
      selectLevel(state.levelId);
    } else {
      removeLevelQueryHint();
      if (dom.missionBar) dom.missionBar.hidden = false;
    }
  }

  function removeLevelQueryHint() {
    if (dom.loadLevelBtn) dom.loadLevelBtn.hidden = false;
    if (dom.levelActionBtn) dom.levelActionBtn.hidden = true;
    if (dom.levelCta) dom.levelCta.hidden = true;
    if (dom.levelDetailBtn) dom.levelDetailBtn.hidden = true;
  }

  function openDocsFromQuery() {
    if (!state.openDocsOnInit) return;

    requestAnimationFrame(() => {
      if (docsViewer && typeof docsViewer.open === 'function') {
        docsViewer.open();
      } else {
        showToast('源码数据未加载，暂时无法打开解析');
      }
    });
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

    dom.predictionInput.addEventListener('input', () => {
      dom.predictionInput.classList.remove('is-invalid');
    });

    dom.compareBtn.addEventListener('click', runComparison);

    dom.navStyleButtons.forEach((button) => {
      button.addEventListener('click', () => selectNavStyle(Number(button.dataset.weight)));
    });

    dom.whyBtn.addEventListener('click', openWhyTutorial);
    dom.whyClose.addEventListener('click', () => closeWhyTutorial());
    dom.whyBackdrop.addEventListener('click', () => closeWhyTutorial());
    dom.whyBack.addEventListener('click', () => goToWhyStep(state.tutorialStep - 1));
    dom.whyNext.addEventListener('click', () => goToWhyStep(state.tutorialStep + 1));
    dom.whyDone.addEventListener('click', () => closeWhyTutorial({ completed: true }));
    dom.whyOptionsPredict1.addEventListener('click', onWhyOptionClick);
    dom.whyOptionsPredict2.addEventListener('click', onWhyOptionClick);
    dom.whyOptionsQuiz.addEventListener('click', onWhyOptionClick);
    dom.whyModal.addEventListener('keydown', onWhyModalKeyDown);

    dom.trapMapBtn.addEventListener('click', loadTrapMap);
    dom.trapRestoreBtn.addEventListener('click', restoreTrapMap);

    dom.railTabs.forEach((tab) => {
      tab.addEventListener('click', () => selectRailTab(tab.dataset.rail, true));
      tab.addEventListener('keydown', onRailTabKeyDown);
    });
    dom.levelDetailBtn.addEventListener('click', openLevelDetails);
    dom.levelDetailClose.addEventListener('click', () => closeLevelDetails());
    dom.levelDetailBackdrop.addEventListener('click', () => closeLevelDetails());

    dom.levelTabs.forEach((button) => {
      button.addEventListener('click', () => selectLevel(button.dataset.level));
    });
    if (dom.levelActionBtn) {
      dom.levelActionBtn.addEventListener('click', runLevelAction);
    }
    dom.loadLevelBtn.addEventListener('click', () => {
      if (state.playMode !== 'level') return;
      loadLevel(state.levelId);
    });
    dom.quizOptions.addEventListener('click', onQuizOptionClick);
    dom.quizSubmitBtn.addEventListener('click', submitQuiz);

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
      ...dom.railTabs,
      ...dom.navStyleButtons,
      dom.whyBtn,
      dom.trapMapBtn,
      dom.trapRestoreBtn,
      dom.levelDetailBtn,
      dom.levelDetailClose,
      ...dom.levelTabs,
      dom.compareBtn,
      dom.levelActionBtn,
      dom.loadLevelBtn,
      dom.quizSubmitBtn
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
  // 驾驶舱：右侧标签与任务详情抽屉
  // =========================================================

  function selectRailTab(rail, focusTab = false) {
    if (rail !== 'status' && rail !== 'compare') return;

    dom.railTabs.forEach((tab) => {
      const active = tab.dataset.rail === rail;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focusTab) tab.focus({ preventScroll: true });
    });

    dom.railPanels.forEach((panel) => {
      panel.hidden = panel.dataset.panel !== rail;
    });
  }

  function onRailTabKeyDown(event) {
    const tabs = dom.railTabs;
    const index = tabs.indexOf(event.currentTarget);
    if (index < 0) return;

    let next = null;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (index + tabs.length - 1) % tabs.length;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (index + 1) % tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = tabs.length - 1;
    }

    if (next === null) return;
    event.preventDefault();
    selectRailTab(tabs[next].dataset.rail, true);
  }

  function openLevelDetails({ focusQuiz = false } = {}) {
    if (!dom.levelDetailDrawer || !dom.levelDetailDrawer.hidden) {
      if (focusQuiz && dom.levelQuizBlock && !dom.levelQuizBlock.hidden) {
        focusQuizOption();
      }
      return;
    }

    dom.levelDetailDrawer.hidden = false;
    dom.levelDetailBackdrop.hidden = false;
    dom.levelDetailBtn.setAttribute('aria-expanded', 'true');
    state.detailDrawerOpen = true;
    document.body.classList.add('astar-drawer-open');
    if (dom.appShell) dom.appShell.inert = true;
    renderLevelFeedback();
    renderLevelProgress();
    renderQuizGate();
    renderNextCta();

    requestAnimationFrame(() => {
      if (focusQuiz && dom.levelQuizBlock && !dom.levelQuizBlock.hidden) {
        focusQuizOption();
      } else {
        dom.levelDetailClose.focus({ preventScroll: true });
      }
    });
  }

  function focusQuizOption() {
    const firstOption = dom.quizOptions.querySelector('.quiz-option');
    if (firstOption) {
      firstOption.focus({ preventScroll: true });
    } else if (dom.quizSubmitBtn) {
      dom.quizSubmitBtn.focus({ preventScroll: true });
    }
  }

  function closeLevelDetails({ moveFocus = true } = {}) {
    if (!dom.levelDetailDrawer || dom.levelDetailDrawer.hidden) return;

    dom.levelDetailDrawer.hidden = true;
    dom.levelDetailBackdrop.hidden = true;
    dom.levelDetailBtn.setAttribute('aria-expanded', 'false');
    state.detailDrawerOpen = false;
    document.body.classList.remove('astar-drawer-open');
    if (dom.appShell) dom.appShell.inert = false;

    if (moveFocus) dom.levelDetailBtn.focus({ preventScroll: true });
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
      trace = Engine.findPathTrace(state.walls, state.start, state.end, {
        heuristicWeight: state.heuristicWeight
      });
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

    evaluateAfterTraceForLevel();
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

    updateDecisionHint(view);
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

    evaluateAfterTraceForLevel();
  }

  function evaluateAfterTraceForLevel() {
    if (state.playMode !== 'level' || !state.trace) return;

    const expanded = Math.max(
      0,
      Number(state.trace.metrics && state.trace.metrics.expanded) || 0
    );
    const alreadyPassed = isLevelPassed(state.levelId);

    if (state.levelId === 'unreachable') {
      if (alreadyPassed) {
        if (!state.trace.found) {
          setStatus('success', '目标完成 · 无路可达');
        }
        return;
      }

      if (!state.trace.found && expanded > 0) {
        completeLevel(
          'unreachable',
          `A* 返回 found=false，并扩展了 ${expanded} 个可达节点。`
        );
      } else if (state.trace.found) {
        setLevelHint('fail', '当前搜索仍能抵达终点；请用「重置关卡」恢复固定地图。');
      } else {
        setLevelHint('fail', '搜索返回无路，但扩展节点数为 0；请重置关卡后再试。');
      }
      return;
    }

    if (alreadyPassed) return;

    if (state.levelId === 'heuristic') {
      setLevelHint('info', '本关请点击「运行对比」，验证 A* 扩展节点少于 BFS。');
    } else if (state.levelId === 'tiebreak') {
      setLevelHint('info', '本关请点击「运行两种平局」，比较 h 与 key 的访问顺序。');
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
  // 决策提示：每一步解释“为什么选它”
  // =========================================================

  function fFormulaText(g, h, weight) {
    const weightedH = weight * h;

    if (state.tutorialDone) {
      return `g=${g} + w×h = ${g} + ${weight}×${h} = ${g + weightedH}`;
    }

    return weight === 0
      ? `g=${g} + 0×h = ${g}`
      : `g=${g} + ${weight}×h=${h} = ${g + weightedH}`;
  }

  function updateDecisionHint(view = null) {
    if (!dom.decisionHint || !dom.decisionHintText) return;

    if (!state.trace) {
      dom.decisionHint.dataset.state = 'idle';
      dom.decisionHintText.textContent = '开始寻路后，这里会解释开放集里谁最该先走。';
      return;
    }

    const eventView = view || buildEventView(state.eventIndex);
    const event = eventView.event;
    const weight = state.heuristicWeight;

    if (!event) {
      dom.decisionHint.dataset.state = 'idle';
      dom.decisionHintText.textContent = '拖动滑块或单步，查看每一步为什么选它。';
      return;
    }

    if (event.type === 'expand') {
      const currentText = `(${event.x}, ${event.y})：${fFormulaText(event.g, event.h, weight)}`;

      if (event.phase === 'goal') {
        dom.decisionHint.dataset.state = 'goal';
        dom.decisionHintText.textContent =
          `刚扩展目标 ${currentText}；搜索结束，开始沿 parent 回溯路径。`;
        return;
      }

      const next = eventView.openTop && eventView.openTop[0];

      if (!next) {
        dom.decisionHint.dataset.state = 'empty';
        dom.decisionHintText.textContent =
          `刚扩展 ${currentText}；开放集此刻为空，正在把可用邻居加入。`;
        return;
      }

      dom.decisionHint.dataset.state = 'expand';
      dom.decisionHintText.textContent =
        `刚扩展 ${currentText}。开放集里 f 最小的是 (${next.x}, ${next.y})：${fFormulaText(next.g, next.h, weight)}；先扩展它。`;
      return;
    }

    if (event.type === 'path') {
      const point = fromKey(event.key);
      dom.decisionHint.dataset.state = 'path';
      dom.decisionHintText.textContent =
        `回溯路径第 ${event.step} 步：(${point.x}, ${point.y})。f 最小的节点优先推进到目标，再沿 parent 连回起点。`;
      return;
    }

    if (event.type === 'done') {
      dom.decisionHint.dataset.state = event.found ? 'goal' : 'empty';
      dom.decisionHintText.textContent = event.found
        ? '搜索完成：每次都先扩展开放集里 f 最小的节点，直到目标被弹出。'
        : '搜索完成：开放集已经为空，终点不可达。';
    }
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
    updateDecisionHint();
  }

  function setText(element, value) {
    const text = String(value);
    if (element && element.textContent !== text) {
      element.textContent = text;
    }
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

    const style = navStyleFor(state.heuristicWeight);
    const aggressive = state.heuristicWeight > 1;
    const weightLabel = state.tutorialDone
      ? `启发权重 w = ${state.heuristicWeight}`
      : state.heuristicWeight === 0
        ? 'h 不参与排序'
        : state.heuristicWeight === 1
          ? '标准估计'
          : `h 放大 ${state.heuristicWeight} 倍`;
    dom.resultStyle.hidden = false;
    dom.resultStyle.dataset.state = aggressive ? 'warn' : 'info';
    dom.resultStyle.textContent =
      `导航风格：${style.label} · ${weightLabel}`
      + (aggressive ? ' · 不保证最短路径' : '');

    dom.resultMessage.textContent = success
      ? aggressive
        ? 'A* 已经找到一条可行路径；激进模式不保证最短，拖动滑块看看它的取舍。'
        : 'A* 已经找到通往终点的最短路径。拖动事件滑块，可以回看每一次开放集变化。'
      : '起点和终点之间暂时没有连通路线，调整一下障碍物再试一次吧。';

    dom.resultSteps.textContent = String(pathMoves);
    dom.resultExplored.textContent = String(expanded);
    dom.resultTime.textContent = `${formatMs(metrics.computeMs)} ms`;
    dom.resultTimers.textContent =
      `算法 ${formatMs(metrics.computeMs)} ms · 动画 ${formatSeconds(state.animMs)} s`;
    dom.resultCloseLabel.textContent = success ? '继续探索' : '调整地图';

    dom.resultOverlay.hidden = false;
    state.overlayOpen = true;

    if (!docsViewer || !docsViewer.isOpen()) {
      requestAnimationFrame(() => {
        // 窄屏下开始按钮在页面下方，确保结果浮层不会停留在视口之外
        const cardRect = dom.resultCard.getBoundingClientRect();
        if (cardRect.top < 8 || cardRect.bottom > window.innerHeight - 8) {
          dom.resultOverlay.scrollIntoView({
            block: 'center',
            behavior: reduceMotion ? 'auto' : 'smooth'
          });
        }

        if (document.activeElement !== dom.timelineSlider) {
          dom.resultClose.focus({ preventScroll: true });
        }
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

  function isEditingLocked() {
    return state.playMode === 'level';
  }

  function lockEditingTools() {
    dom.toolButtons.forEach((button) => {
      button.disabled = true;
      button.title = '关卡模式：固定地图，编辑工具已锁定';
    });
    dom.randomBtn.disabled = true;
    dom.clearBtn.disabled = true;
    dom.randomBtn.title = '关卡模式：固定地图，随机地图已锁定';
    dom.clearBtn.title = '关卡模式：固定地图，清空障碍已锁定';
    if (dom.trapMapBtn) {
      dom.trapMapBtn.disabled = true;
      dom.trapMapBtn.title = '关卡模式：固定地图，绕路陷阱已锁定';
    }
    if (dom.trapRestoreBtn) {
      dom.trapRestoreBtn.disabled = true;
    }
    canvasWrap.classList.add('is-locked');
    dom.hintText.textContent = '关卡模式：地图、起点与终点已锁定；请使用上方关卡动作。';
    canvas.setAttribute(
      'aria-label',
      '20 乘 20 的关卡固定地图，编辑已锁定。使用顶部关卡动作完成目标。'
    );
    announce('关卡模式，地图编辑已锁定。完成上方关卡动作后会自动判定目标。');
  }

  function selectTool(tool, silent = false) {
    if (!TOOL_INFO[tool]) return;
    if (isEditingLocked() && !silent) return;

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
    if (isEditingLocked()) {
      showToast('关卡模式地图已锁定，请使用上方关卡动作', 1800);
      return false;
    }

    exitTrapMode();
    invalidateComparison();

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
    if (isEditingLocked()) {
      showToast('关卡模式地图已锁定，请使用「重置关卡」', 1800);
      return;
    }

    hideResultOverlay();
    exitTrapMode();

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
    invalidateComparison();
    resetRunState({ clearPredictionInput: true });
    draw();
    showToast('障碍物已清空，重新布置地图吧');
    announce('障碍物已清空。');
  }

  function generateRandomMap() {
    if (isEditingLocked()) {
      showToast('关卡模式地图已锁定，请使用「重置关卡」', 1800);
      return;
    }

    hideResultOverlay();
    exitTrapMode();

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
    invalidateComparison();
    resetRunState({ clearPredictionInput: true });
    draw();
    showToast('随机地图已生成 · 按 Enter 开始并验证');
    announce('随机地图已生成，按回车键开始寻路。');
  }

  // =========================================================
  // P1：三算法对比
  // =========================================================

  function engineHasCompare() {
    return Boolean(Engine && typeof Engine.compareAlgorithms === 'function');
  }

  function navStyleFor(weight) {
    return NAV_STYLES.find((style) => style.weight === weight) || NAV_STYLES[1];
  }

  function renderNavStyle() {
    const current = navStyleFor(state.heuristicWeight);

    dom.navStyleButtons.forEach((button) => {
      const active = Number(button.dataset.weight) === current.weight;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    dom.navStyleBadge.textContent = current.label;

    if (dom.dataFootLabel) {
      dom.dataFootLabel.textContent = state.tutorialDone ? '算法 / 启发函数' : '算法 / 距离估计';
    }

    // 术语在教程小测通过后才解锁；此前只用 g / h / f 讲机制。
    if (state.tutorialDone) {
      dom.navStyleTech.hidden = false;
      dom.navStyleTech.textContent =
        `技术名：启发函数 h（曼哈顿估计）· 启发权重 w = ${current.weight} · 加权 A*：f = g + w·h`;
    } else {
      dom.navStyleTech.hidden = true;
      dom.navStyleTech.textContent = '';
    }

    if (dom.whyBtnHint) {
      dom.whyBtnHint.textContent = state.tutorialDone ? '复习 3 步 + 小测' : '3 步 + 小测';
    }
  }

  function selectNavStyle(weight) {
    if (![0, 1, 2].includes(weight)) return;

    state.heuristicWeight = weight;
    state.navStyleSelected = true;
    renderNavStyle();

    // 切换风格后，旧 trace 与旧对比都不再对应当前设置
    resetRunState();
    clearComparisonView('导航风格已切换；卡片显示本次预演，打开「对比」可看完整表格。');
    clearNavStyleResult();

    const comparison = computeStyleComparison(weight);
    if (!comparison) {
      dom.navStyleResult.hidden = false;
      dom.navStyleResult.textContent = '对比接口尚未就绪，暂时无法预演这一风格。';
      renderFirstDivergence(weight);
      if (state.trapSnapshot) refreshTrapPanel(null);
      return;
    }

    renderStyleComparison(comparison, weight);
    if (state.trapSnapshot) refreshTrapPanel(comparison);
  }

  function computeStyleComparison(weight) {
    if (!isEngineReady() || !engineHasCompare()) return null;

    try {
      return Engine.compareAlgorithms(state.walls, state.start, state.end, {
        heuristicWeight: weight
      });
    } catch (error) {
      console.error('导航风格对比失败：', error);
      return null;
    }
  }

  function renderStyleComparison(comparison, weight) {
    const astarData = comparison && comparison.astar ? comparison.astar : {};
    const dijkstraData = comparison && comparison.dijkstra ? comparison.dijkstra : {};
    const astarPath = astarData.found
      ? Math.max(0, Number(astarData.pathMoves) || 0)
      : null;
    const dijkstraPath = dijkstraData.found
      ? Math.max(0, Number(dijkstraData.pathMoves) || 0)
      : null;
    const expanded = Math.max(0, Number(astarData.expanded) || 0);

    dom.navStyleResult.hidden = false;
    dom.navStyleResult.textContent =
      `A* 扩展 ${expanded} · A* 路径 ${pathText(astarPath)} · Dijkstra 路径 ${pathText(dijkstraPath)}`;

    let note = '';
    let noteState = 'info';

    if (weight > 1) {
      if (astarPath !== null && dijkstraPath !== null && astarPath > dijkstraPath) {
        note = `这次激进绕远了：A* ${astarPath} 步 / Dijkstra ${dijkstraPath} 步。`;
        noteState = 'warn';
      } else if (astarPath === null || dijkstraPath === null) {
        note = '这张地图没有可比较的路径；激进模式仍然不保证最短。';
        noteState = 'caution';
      } else {
        note = '这次没绕远，但激进模式不再保证最短。';
        noteState = 'caution';
      }
    }

    dom.navStyleNote.hidden = !note;
    dom.navStyleNote.dataset.state = noteState;
    dom.navStyleNote.textContent = note;

    renderFirstDivergence(weight);
  }

  function pathText(pathMoves) {
    return pathMoves === null ? '无路' : `${pathMoves} 步`;
  }

  function clearNavStyleResult() {
    dom.navStyleResult.hidden = true;
    dom.navStyleResult.textContent = '';
    dom.navStyleNote.hidden = true;
    dom.navStyleNote.textContent = '';
    dom.navStyleNote.dataset.state = 'info';
    dom.navStyleDivergence.hidden = true;
    dom.navStyleDivergence.textContent = '';
  }

  function collectExpandEvents(trace) {
    if (!trace || !Array.isArray(trace.events)) return [];
    return trace.events.filter((event) => event && event.type === 'expand');
  }

  function makeDivRow(label, node, alt) {
    const row = document.createElement('div');
    row.className = alt ? 'why-div-row why-div-row--alt' : 'why-div-row';

    const tag = document.createElement('span');
    tag.className = 'why-div-tag';
    tag.textContent = label;

    const text = document.createElement('span');
    const x = Number.isFinite(node.x) ? node.x : Engine.fromKey(node.key).x;
    const y = Number.isFinite(node.y) ? node.y : Engine.fromKey(node.key).y;
    text.textContent = `选 (${x}, ${y})：g=${node.g} h=${node.h} f=${node.f}`;

    row.append(tag, text);
    return row;
  }

  function makeDivEmpty(message, warn = false) {
    const line = document.createElement('p');
    line.className = warn ? 'why-div-empty why-div-empty--warn' : 'why-div-empty';
    line.textContent = message;
    return line;
  }

  function computeVisitedDivergence(weight) {
    if (!isEngineReady()) return { status: 'unavailable' };

    let baseTrace;
    let currentTrace;

    try {
      baseTrace = Engine.findPathTrace(state.walls, state.start, state.end, {
        heuristicWeight: 1
      });
      currentTrace = weight === 1
        ? baseTrace
        : Engine.findPathTrace(state.walls, state.start, state.end, {
          heuristicWeight: weight
        });
    } catch (error) {
      console.error('首次分歧计算失败：', error);
      return { status: 'error' };
    }

    if (!baseTrace || !currentTrace) {
      return { status: 'unavailable', baseTrace, currentTrace };
    }

    if (!baseTrace.found || !currentTrace.found) {
      return {
        status: 'unfound',
        baseTrace,
        currentTrace,
        bothLost: !baseTrace.found && !currentTrace.found
      };
    }

    if (weight === 1) {
      return { status: 'baseline', baseTrace, currentTrace };
    }

    const diffIndex = firstArrayDifference(
      traceVisitOrder(baseTrace),
      traceVisitOrder(currentTrace)
    );

    if (diffIndex < 0) {
      return { status: 'none', baseTrace, currentTrace };
    }

    const baseNode = collectExpandEvents(baseTrace)[diffIndex];
    const currentNode = collectExpandEvents(currentTrace)[diffIndex];

    if (!baseNode || !currentNode) {
      return { status: 'missing', diffIndex, baseTrace, currentTrace };
    }

    return {
      status: 'diff',
      diffIndex,
      baseNode,
      currentNode,
      baseTrace,
      currentTrace
    };
  }

  // 首次分歧：标准（w=1）与当前风格在 visited 里第一个不同的扩展节点。
  function renderFirstDivergence(weight) {
    if (!dom.navStyleDivergence) return;

    dom.navStyleDivergence.textContent = '';
    dom.navStyleDivergence.hidden = false;

    const result = computeVisitedDivergence(weight);
    const style = navStyleFor(weight);

    if (result.status === 'unavailable' || result.status === 'error') {
      dom.navStyleDivergence.appendChild(
        makeDivEmpty(
          result.status === 'error'
            ? '分歧计算失败，请重试。'
            : '引擎未加载，无法比较扩展顺序。',
          true
        )
      );
      return;
    }

    if (result.status === 'unfound') {
      dom.navStyleDivergence.appendChild(
        makeDivEmpty(
          result.bothLost
            ? '无路/不可比较：两种风格都找不到路径，先清出可通行路线。'
            : '无路/不可比较：其中一种风格找不到路径。',
          true
        )
      );
      return;
    }

    if (result.status === 'baseline') {
      dom.navStyleDivergence.appendChild(
        makeDivEmpty('「标准」就是比较基准，没有放大 h，所以没有分歧；选「稳妥」或「激进」看差别，或试绕路陷阱地图。')
      );
      return;
    }

    if (result.status === 'none') {
      dom.navStyleDivergence.appendChild(
        makeDivEmpty('这张图没有产生顺序分歧；试试绕路陷阱地图。')
      );
      return;
    }

    if (result.status === 'missing') {
      dom.navStyleDivergence.appendChild(
        makeDivEmpty('分歧位置缺少评分数据，无法显示。', true)
      );
      return;
    }

    const { diffIndex, baseNode, currentNode, baseTrace, currentTrace } = result;

    const head = document.createElement('p');
    head.className = 'why-div-head';
    const headName = document.createElement('b');
    headName.textContent = `标准 vs ${style.label}`;
    head.append(
      headName,
      document.createTextNode(`：第一次分歧在第 ${diffIndex + 1} 个扩展节点`)
    );
    dom.navStyleDivergence.appendChild(head);
    dom.navStyleDivergence.appendChild(makeDivRow('标准', baseNode, false));
    dom.navStyleDivergence.appendChild(makeDivRow(style.label, currentNode, true));

    if (weight === 0) {
      dom.navStyleDivergence.appendChild(
        makeDivFoot(state.tutorialDone
          ? 'w = 0：h 不参与排序，f = g；搜索只按已走代价扩展。'
          : '放大倍数 0：h 不参与排序，f = g；搜索只按已走代价扩展。')
      );
    } else {
      const weightedH = weight * currentNode.h;
      dom.navStyleDivergence.appendChild(
        makeDivFoot(state.tutorialDone
          ? `w = ${weight}：${weight}×h=${weightedH}，f=${currentNode.g} + ${weightedH} = ${currentNode.f}。`
          : `h 放大 ${weight} 倍：${weight}×${currentNode.h} = ${weightedH}，f=${currentNode.g} + ${weightedH} = ${currentNode.f}。`)
      );
    }

    const baseMoves = traceMoves(baseTrace);
    const currentMoves = traceMoves(currentTrace);
    const delta = currentMoves - baseMoves;
    const deltaText = delta > 0
      ? `多走 ${delta} 步`
      : delta < 0
        ? `少走 ${-delta} 步`
        : '只有顺序分歧，步数相同';

    dom.navStyleDivergence.appendChild(
      makeDivFoot(`最终路径：标准 ${baseMoves} 步 → ${style.label} ${currentMoves} 步（${deltaText}）`)
    );
  }

  function makeDivFoot(text) {
    const foot = document.createElement('div');
    foot.className = 'why-div-foot';
    foot.textContent = text;
    return foot;
  }

  // ---------- 绕路陷阱 ----------

  function cloneWallGrid(walls) {
    return walls.map((row) => row.slice());
  }

  function loadTrapMap() {
    if (isEditingLocked()) {
      showToast('关卡模式地图已锁定，请使用「重置关卡」', 1800);
      return;
    }

    hideToast();
    hideResultOverlay();

    if (!isEngineReady()) {
      showToast('寻路引擎未加载，无法载入陷阱地图');
      return;
    }

    if (!state.trapSnapshot) {
      state.trapSnapshot = {
        walls: cloneWallGrid(state.walls),
        start: { ...state.start },
        end: { ...state.end },
        weight: state.heuristicWeight,
        navStyleSelected: state.navStyleSelected
      };
    }

    state.walls = wallGridFromPairs(TRAP_MAP.walls);
    state.start = { ...TRAP_MAP.start };
    state.end = { ...TRAP_MAP.end };
    state.walls[state.start.y][state.start.x] = false;
    state.walls[state.end.y][state.end.x] = false;
    state.heuristicWeight = 2;
    state.navStyleSelected = true;
    state.trapActive = true;

    invalidateComparison();
    resetRunState({ clearPredictionInput: true });
    renderNavStyle();

    const comparison = computeStyleComparison(2);

    if (comparison) {
      renderStyleComparison(comparison, 2);
    } else {
      dom.navStyleResult.hidden = false;
      dom.navStyleResult.textContent = '陷阱地图已载入，但对比接口尚未就绪。';
      renderFirstDivergence(2);
    }

    renderTrapPanel(comparison);
    draw();
    setStatus('idle', '陷阱地图已载入');
    showToast('已载入绕路陷阱 · 激进风格');
    announce('已载入绕路陷阱地图；激进风格可能绕远，看看路径差。');
  }

  function restoreTrapMap() {
    if (isEditingLocked()) {
      showToast('关卡模式地图已锁定，请使用「重置关卡」', 1800);
      return;
    }

    const snapshot = state.trapSnapshot;

    if (!snapshot) {
      showToast('没有可恢复的原地图');
      return;
    }

    state.walls = cloneWallGrid(snapshot.walls);
    state.start = { ...snapshot.start };
    state.end = { ...snapshot.end };
    state.heuristicWeight = snapshot.weight;
    state.navStyleSelected = snapshot.navStyleSelected;
    state.trapSnapshot = null;
    state.trapActive = false;

    dom.trapMapPanel.hidden = true;
    dom.trapMapPanel.dataset.state = 'info';
    dom.trapMapText.textContent = '';

    invalidateComparison();
    resetRunState({ clearPredictionInput: true });
    renderNavStyle();

    if (state.navStyleSelected) {
      const comparison = computeStyleComparison(state.heuristicWeight);
      if (comparison) {
        renderStyleComparison(comparison, state.heuristicWeight);
      } else {
        renderFirstDivergence(state.heuristicWeight);
      }
    }

    draw();
    setStatus('idle', '已回到原地图');
    showToast('已回到原地图');
    announce('已恢复载入陷阱前的地图。');
  }

  function refreshTrapPanel(comparison = null) {
    if (!state.trapSnapshot) {
      dom.trapMapPanel.hidden = true;
      return;
    }

    renderTrapPanel(comparison);
  }

  function exitTrapMode() {
    state.trapSnapshot = null;
    state.trapActive = false;
    dom.trapMapPanel.hidden = true;
    dom.trapMapPanel.dataset.state = 'info';
    dom.trapMapText.textContent = '';
  }

  function renderTrapPanel(comparison) {
    if (!state.trapSnapshot) {
      dom.trapMapPanel.hidden = true;
      return;
    }

    dom.trapMapPanel.hidden = false;
    dom.trapMapPanel.dataset.state = 'info';

    if (!state.trapActive || state.heuristicWeight !== 2) {
      dom.trapMapText.textContent = state.tutorialDone
        ? '陷阱地图仍载入中；绕远演示使用「激进」（w = 2），切回激进可重新对比。'
        : '陷阱地图仍载入中；绕远演示使用「激进」并把 h 放大 2 倍，切回激进可重新对比。';
      return;
    }

    if (!comparison) {
      dom.trapMapText.textContent = '陷阱地图已载入，但对比接口尚未就绪，暂时无法展示路径差。';
      return;
    }

    const astar = comparison.astar || {};
    const dijkstra = comparison.dijkstra || {};

    if (!astar.found || !dijkstra.found) {
      dom.trapMapPanel.dataset.state = 'warn';
      dom.trapMapText.textContent = '这张图上有一方无路，无法比较路径；点「回到原地图」恢复。';
      return;
    }

    const astarMoves = Math.max(0, Number(astar.pathMoves) || 0);
    const dijkstraMoves = Math.max(0, Number(dijkstra.pathMoves) || 0);
    const astarExpanded = Math.max(0, Number(astar.expanded) || 0);
    const dijkstraExpanded = Math.max(0, Number(dijkstra.expanded) || 0);
    const delta = astarMoves - dijkstraMoves;

    if (delta > 0) {
      dom.trapMapPanel.dataset.state = 'warn';
      dom.trapMapText.textContent =
        `陷阱生效：激进 ${astarMoves} 步，最短 ${dijkstraMoves} 步，多走 ${delta} 步；扩展 ${astarExpanded} / Dijkstra ${dijkstraExpanded}。`;
      return;
    }

    const divergence = computeVisitedDivergence(2);

    if (divergence.status === 'diff') {
      dom.trapMapText.textContent =
        `这张图只有顺序分歧：路径同为 ${astarMoves} 步，第一次分歧在第 ${divergence.diffIndex + 1} 个扩展节点；没有更长路径，不伪造。`;
    } else if (divergence.status === 'none' || divergence.status === 'baseline') {
      dom.trapMapText.textContent =
        `这张图没有顺序分歧：路径同为 ${astarMoves} 步，不伪造绕路。`;
    } else {
      dom.trapMapText.textContent =
        `路径没有变长（${astarMoves} 步），顺序分歧也无法比较；不伪造绕路。`;
    }
  }

  // ---------- 3 步教程 + 机制小测 ----------

  function readWhyTutorialDone() {
    try {
      return window.localStorage.getItem(WHY_STORAGE_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function persistWhyTutorialDone() {
    try {
      window.localStorage.setItem(WHY_STORAGE_KEY, '1');
    } catch (error) {
      // 隐私模式或存储被禁用时静默失败
    }
  }

  function initWhyTutorial() {
    renderWhyOptions('predict1', WHY_CANDIDATES.plain, dom.whyOptionsPredict1);
    renderWhyOptions('predict2', WHY_CANDIDATES.weighted, dom.whyOptionsPredict2);
    renderWhyOptions('quiz', WHY_QUIZ_OPTIONS, dom.whyOptionsQuiz);
    renderWhyTutorial();
  }

  function renderWhyOptions(questionKey, options, container) {
    if (!container) return;

    container.textContent = '';
    container.setAttribute('role', 'group');
    container.setAttribute(
      'aria-label',
      questionKey === 'quiz' ? '机制小测选项' : '候选节点'
    );

    options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'why-option';
      button.dataset.whyQuestion = questionKey;
      button.dataset.whyKey = option.key;
      button.setAttribute('aria-pressed', 'false');

      const key = document.createElement('span');
      key.className = 'why-option-key';
      key.setAttribute('aria-hidden', 'true');
      key.textContent = option.key;
      button.appendChild(key);

      if (questionKey === 'quiz') {
        const title = document.createElement('span');
        title.className = 'why-option-title';
        title.textContent = option.text;
        button.appendChild(title);
      } else {
        const math = document.createElement('span');
        math.className = 'why-option-math';
        math.textContent = questionKey === 'predict2'
          ? `${option.g} + 2×${option.h} = ${option.f}`
          : `g=${option.g} · h=${option.h} · f=${option.f}`;
        button.appendChild(math);
      }

      container.appendChild(button);
    });
  }

  function onWhyOptionClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest('.why-option')
      : null;
    if (!button) return;

    const questionKey = button.dataset.whyQuestion;
    const answer = state.tutorialAnswers[questionKey];
    if (!answer || answer.solved) return;

    const options = questionKey === 'predict1'
      ? WHY_CANDIDATES.plain
      : questionKey === 'predict2'
        ? WHY_CANDIDATES.weighted
        : WHY_QUIZ_OPTIONS;
    const option = options.find((item) => item.key === button.dataset.whyKey);
    if (!option) return;

    answer.picked = option.key;
    answer.solved = Boolean(option.correct);

    if (questionKey === 'quiz' && answer.solved) {
      unlockWhyTerms();
      renderWhyTutorial();
      requestAnimationFrame(() => {
        dom.whyTerms.scrollIntoView({
          block: 'nearest',
          behavior: reduceMotion ? 'auto' : 'smooth'
        });
        dom.whyDone.focus({ preventScroll: true });
      });
      return;
    }

    renderWhyTutorial();

    if (answer.solved) {
      requestAnimationFrame(() => {
        dom.whyNext.focus({ preventScroll: true });
      });
    }
  }

  function unlockWhyTerms() {
    dom.whyTerms.hidden = false;

    if (state.tutorialDone) return;

    state.tutorialDone = true;
    persistWhyTutorialDone();
    renderNavStyle();

    if (state.navStyleSelected) {
      const comparison = computeStyleComparison(state.heuristicWeight);
      if (comparison) {
        renderStyleComparison(comparison, state.heuristicWeight);
        if (state.trapSnapshot) refreshTrapPanel(comparison);
      } else {
        renderFirstDivergence(state.heuristicWeight);
      }
    }

    updateDecisionHint(state.trace ? buildEventView(state.eventIndex) : null);
  }

  function getWhyAnswerForStep(step) {
    if (step === 1) return state.tutorialAnswers.predict1;
    if (step === 2) return state.tutorialAnswers.predict2;
    if (step === 3) return state.tutorialAnswers.quiz;
    return null;
  }

  function renderWhyTutorial() {
    if (!state.tutorialOpen) return;

    const step = clamp(state.tutorialStep, 0, 3);
    state.tutorialStep = step;

    dom.whySteps.forEach((section) => {
      section.hidden = Number(section.dataset.whyStep) !== step;
    });

    dom.whyDots.forEach((dot) => {
      const index = Number(dot.dataset.whyDot);
      dot.classList.toggle('is-active', index === step);
      dot.classList.toggle(
        'is-done',
        index < step || (index === 3 && state.tutorialDone)
      );
    });

    dom.whyStepCount.textContent = `${step + 1} / 4`;

    const currentAnswer = getWhyAnswerForStep(step);
    const quizSolved = state.tutorialAnswers.quiz.solved;

    dom.whyBack.disabled = step === 0;
    dom.whyNext.hidden = step === 3;
    dom.whyDone.hidden = step !== 3;
    dom.whyDone.disabled = !(quizSolved || state.tutorialDone);
    dom.whyNext.disabled = step > 0
      && !state.tutorialDone
      && !(currentAnswer && currentAnswer.solved);

    syncWhyOptions('predict1', WHY_CANDIDATES.plain, dom.whyOptionsPredict1);
    syncWhyOptions('predict2', WHY_CANDIDATES.weighted, dom.whyOptionsPredict2);
    syncWhyOptions('quiz', WHY_QUIZ_OPTIONS, dom.whyOptionsQuiz);

    renderWhyFeedback(
      dom.whyFeedbackPredict1,
      state.tutorialAnswers.predict1,
      'A 的 f=9 最小（B=10，C=12），所以先扩展 A。',
      '先只看 f 这一列：9 < 10 < 12。再点一次。'
    );

    renderWhyFeedback(
      dom.whyFeedbackPredict2,
      state.tutorialAnswers.predict2,
      '现在变成 B：7 + 2×3 = 13 最小。A 从 9 变成 15，B 从 10 变成 13——h 更小的 B 反超了；但 h 仍然只是估计。',
      '把每个 h 乘以 2 再和 g 相加：A=15，B=13，C=19。再选一次。'
    );

    renderWhyFeedback(
      dom.whyFeedbackQuiz,
      state.tutorialAnswers.quiz,
      '对。放大的只是 h 的估计，它不会变成真实距离；搜索因此可能更少，但路径可能变长，不再保证最短。',
      '再想想：h 只是估计，放大它不会变成真实距离；把 h 放大后也不保证最短。可以再选一次。'
    );

    dom.whyTerms.hidden = !(quizSolved || state.tutorialDone);
  }

  function syncWhyOptions(questionKey, options, container) {
    if (!container) return;

    const answer = state.tutorialAnswers[questionKey];
    const optionByKey = new Map(options.map((option) => [option.key, option]));

    Array.from(container.querySelectorAll('.why-option')).forEach((button) => {
      const key = button.dataset.whyKey;
      const option = optionByKey.get(key);
      const isCorrect = Boolean(option && option.correct);
      const isPicked = answer.picked === key;

      button.classList.toggle('is-selected', isPicked && !answer.solved);
      button.classList.toggle('is-correct', answer.solved && isCorrect);
      button.classList.toggle('is-wrong', isPicked && !answer.solved && !isCorrect);
      button.setAttribute('aria-pressed', String(isPicked));
      button.disabled = answer.solved;
    });
  }

  function renderWhyFeedback(element, answer, correctText, wrongText) {
    if (!element) return;

    if (answer.solved) {
      element.hidden = false;
      element.className = 'why-feedback is-correct';
      element.textContent = correctText;
    } else if (answer.picked) {
      element.hidden = false;
      element.className = 'why-feedback is-wrong';
      element.textContent = wrongText;
    } else {
      element.hidden = true;
      element.className = 'why-feedback';
      element.textContent = '';
    }
  }

  function goToWhyStep(nextStep) {
    const target = clamp(nextStep, 0, 3);

    if (target > state.tutorialStep && state.tutorialStep > 0 && !state.tutorialDone) {
      const answer = getWhyAnswerForStep(state.tutorialStep);
      if (!answer || !answer.solved) return;
    }

    state.tutorialStep = target;
    renderWhyTutorial();
  }

  function openWhyTutorial() {
    if (state.tutorialOpen) return;

    if (state.tutorialDone) {
      state.tutorialStep = 0;
    }

    state.tutorialOpen = true;
    pausePlayback({ silent: true });
    hideResultOverlay();

    dom.whyBackdrop.hidden = false;
    dom.whyModal.hidden = false;
    dom.whyBtn.setAttribute('aria-expanded', 'true');
    document.body.classList.add('astar-why-open');
    if (dom.appShell) dom.appShell.inert = true;

    renderWhyTutorial();

    requestAnimationFrame(() => {
      dom.whyClose.focus({ preventScroll: true });
    });
  }

  function onWhyModalKeyDown(event) {
    if (event.key !== 'Tab') return;

    const focusables = Array.from(
      dom.whyModal.querySelectorAll(
        'button:not(:disabled):not([hidden]), [href], [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.getClientRects().length > 0);

    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeWhyTutorial({ completed = false } = {}) {
    if (!state.tutorialOpen) return;

    state.tutorialOpen = false;
    dom.whyBackdrop.hidden = true;
    dom.whyModal.hidden = true;
    dom.whyBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('astar-why-open');
    if (dom.appShell && !state.detailDrawerOpen) {
      dom.appShell.inert = false;
    }
    dom.whyBtn.focus({ preventScroll: true });

    if (completed) {
      showToast('教程完成 · 术语已解锁');
      announce('教程完成，已解锁启发函数、启发权重与加权 A* 术语。');
    }
  }

  function clearComparisonView(message = '尚未运行对比；点击按钮分析当前地图。') {
    dom.compareTableWrap.hidden = true;
    dom.compareBody.textContent = '';
    dom.compareStatus.textContent = message;
  }

  function invalidateComparison() {
    const hadResults = !dom.compareTableWrap.hidden || !dom.navStyleResult.hidden;
    if (hadResults) {
      clearComparisonView('地图已修改，请重新运行对比。');
    }
    clearNavStyleResult();
  }

  function runComparison() {
    hideToast();

    if (!isEngineReady() || !engineHasCompare()) {
      dom.compareStatus.textContent = '对比接口尚未就绪：等待 astar-engine.js 提供 compareAlgorithms。';
      showToast('对比接口尚未就绪，请等待引擎更新');
      return;
    }

    let comparison;
    try {
      comparison = Engine.compareAlgorithms(state.walls, state.start, state.end, {
        heuristicWeight: state.heuristicWeight
      });
    } catch (error) {
      console.error('算法对比失败：', error);
      dom.compareStatus.textContent = '对比运行失败，请重试。';
      showToast('对比运行失败，请重试');
      return;
    }

    if (!renderComparison(comparison)) {
      dom.compareStatus.textContent = '引擎返回的对比数据不完整。';
      showToast('对比数据不完整，请重试');
      return;
    }

    evaluateHeuristicLevelAuto(comparison);
    announce(`算法对比完成。${dom.compareStatus.textContent}`);
  }

  function evaluateHeuristicLevelAuto(comparison) {
    if (state.playMode !== 'level' || state.levelId !== 'heuristic') return;

    const astarExpanded = Math.max(0, Number(comparison && comparison.astar && comparison.astar.expanded) || 0);
    const bfsExpanded = Math.max(0, Number(comparison && comparison.bfs && comparison.bfs.expanded) || 0);

    if (astarExpanded < bfsExpanded) {
      completeLevel(
        'heuristic',
        `A* 扩展 ${astarExpanded} 个节点，BFS 扩展 ${bfsExpanded} 个，A* 更少。`
      );
    } else if (!isLevelPassed('heuristic')) {
      setLevelHint(
        'fail',
        `A* 扩展 ${astarExpanded} 个，BFS 扩展 ${bfsExpanded} 个；A* 没有更少。把导航风格切回「标准」后再运行一次对比。`
      );
      showToast('目标未达成：让 A* 扩展节点少于 BFS');
    }
  }

  function renderComparison(comparison) {
    if (!comparison || typeof comparison !== 'object') return false;

    const rows = COMPARE_ROWS.map((meta) => {
      const data = comparison[meta.key];
      return data && typeof data === 'object' ? { ...meta, data } : null;
    });

    if (rows.some((row) => row === null)) return false;

    dom.compareBody.textContent = '';

    rows.forEach(({ key, label, data }) => {
      const row = document.createElement('tr');
      if (key === 'astar') row.className = 'is-astar';

      const nameCell = document.createElement('th');
      nameCell.scope = 'row';
      nameCell.textContent = label;

      const expandedCell = document.createElement('td');
      expandedCell.textContent = String(Math.max(0, Number(data.expanded) || 0));

      const found = Boolean(data.found);
      const pathCell = document.createElement('td');
      pathCell.textContent = found ? String(Math.max(0, Number(data.pathMoves) || 0)) : '无路';
      if (!found) pathCell.className = 'is-empty';

      const timeCell = document.createElement('td');
      timeCell.textContent = formatMs(data.computeMs);

      row.append(nameCell, expandedCell, pathCell, timeCell);
      dom.compareBody.appendChild(row);
    });

    const astarExpanded = Math.max(0, Number(comparison.astar.expanded) || 0);
    const bfsExpanded = Math.max(0, Number(comparison.bfs.expanded) || 0);

    let summary;
    if (astarExpanded < bfsExpanded) {
      summary = `A* 比 BFS 少扩展 ${bfsExpanded - astarExpanded} 个节点。`;
    } else if (astarExpanded === bfsExpanded) {
      summary = 'A* 与 BFS 的扩展节点数相同。';
    } else {
      summary = `A* 比 BFS 多扩展 ${astarExpanded - bfsExpanded} 个节点。`;
    }

    const pathSet = new Set(
      rows.map(({ data }) => (data.found ? Math.max(0, Number(data.pathMoves) || 0) : 'none'))
    );
    if (rows.every(({ data }) => !data.found)) {
      summary += ' 三种算法都报告无路。';
    } else if (pathSet.size === 1) {
      summary += ' 三种算法的路径步数一致。';
    } else {
      summary += ' 三种算法的路径步数或可达性不同。';
    }

    const style = navStyleFor(state.heuristicWeight);
    let styleNote = state.tutorialDone
      ? `当前风格：${style.label}（w = ${state.heuristicWeight}）`
      : `当前风格：${style.label}`;
    if (state.heuristicWeight > 1) {
      styleNote += ' · 不保证最短路径';
      if (
        comparison.astar.found &&
        comparison.dijkstra.found &&
        astarPathMoves(comparison.astar) > astarPathMoves(comparison.dijkstra)
      ) {
        styleNote += ` · 这次激进绕远了（A* ${astarPathMoves(comparison.astar)} 步 / Dijkstra ${astarPathMoves(comparison.dijkstra)} 步）`;
      }
    }

    dom.compareStatus.textContent = `${styleNote}。${summary}`;
    dom.compareTableWrap.hidden = false;
    return true;
  }

  function astarPathMoves(data) {
    return Math.max(0, Number(data && data.pathMoves) || 0);
  }

  // =========================================================
  // P1：关卡地图、检查与小测
  // =========================================================

  function initLevels() {
    state.levelId = state.requestedLevel || 'heuristic';
    refreshLevelMastery();
    selectLevel(state.levelId);
  }

  function selectLevel(levelId) {
    const level = LEVELS[levelId];
    if (!level) return;

    state.levelId = levelId;
    if (state.playMode === 'level') {
      document.body.dataset.levelId = levelId;
    }

    dom.levelTabs.forEach((button) => {
      const active = button.dataset.level === levelId;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    dom.levelKicker.textContent = level.kicker;
    dom.levelGoal.textContent = level.goal;
    dom.levelMeta.textContent = level.meta;
    dom.quizQuestion.textContent = level.quiz.question;
    dom.quizFeedback.hidden = true;
    dom.quizFeedback.className = 'quiz-feedback';
    if (dom.levelActionBtn) dom.levelActionBtn.textContent = levelActionLabel(levelId);
    if (dom.missionEyebrowNote) {
      dom.missionEyebrowNote.textContent = `LEVEL ${level.order} / 3`;
    }

    renderQuizOptions();
    refreshLevelMastery();
    renderLevelFeedback();
    renderLevelLive();
    renderLevelCta();
    renderNextCta();
    renderQuizGate();
  }

  function levelActionLabel(levelId) {
    if (levelId === 'tiebreak') return '运行两种平局';
    if (levelId === 'unreachable') return '开始并验证';
    return '运行对比';
  }

  function loadLevel(levelId, { initial = false } = {}) {
    if (state.playMode !== 'level') return;

    const level = LEVELS[levelId];
    if (!level) return;

    hideToast();
    applyLevelMap(levelId);
    clearComparisonView('固定关卡地图已就绪；运行关卡动作后会自动判定目标。');

    const runtime = state.levelRuntime[levelId];
    const record = getLevelRecord(levelId);
    runtime.loaded = true;
    runtime.checked = Boolean(record.passed);
    runtime.passed = Boolean(record.passed);
    runtime.quizCorrect = Boolean(record.quizCorrect);
    runtime.quizIndex = null;
    runtime.feedback = record.quizCorrect
      ? { state: 'pass', text: '✓ 本关已掌握。可以复习目标，或从下方进入下一关。' }
      : record.passed
        ? { state: 'pass', text: '✓ 目标已完成，小测已解锁。' }
        : { state: 'info', text: '固定地图已就绪。使用上方关卡动作，系统会自动判定目标。' };

    selectLevel(levelId);
    setStatus('idle', initial ? '关卡已就绪' : '关卡已重置');
    if (!initial) {
      showToast(`已重置关卡：${level.name}`);
    }
    announce(`关卡 ${level.name}。${level.goal}`);
  }

  function runLevelAction() {
    if (state.playMode !== 'level') return;

    hideToast();
    if (!isEngineReady()) {
      setStatus('failed', '引擎未加载');
      showToast('引擎未加载，暂时无法运行关卡动作');
      return;
    }

    if (state.levelId === 'heuristic') {
      selectRailTab('compare');
      runComparison();
    } else if (state.levelId === 'tiebreak') {
      runTiebreakDemo();
    } else {
      selectRailTab('status');
      startSearch();
    }
  }

  function runTiebreakDemo() {
    let outcome;
    try {
      outcome = evaluateTiebreakLevel();
    } catch (error) {
      console.error('平局对比失败：', error);
      setLevelHint('fail', `平局对比失败：${error.message || '请稍后重试'}`);
      showToast('平局对比失败，请重试');
      return;
    }

    if (!outcome) return;

    if (outcome.passed) {
      completeLevel('tiebreak', outcome.detail);
      setStatus('success', '两种平局已比较');
    } else if (!isLevelPassed('tiebreak')) {
      setLevelHint('fail', outcome.detail);
      setStatus('failed', '平局对比未通过');
      showToast('尚未达成目标：访问顺序或路径步数不满足条件');
    }

    announce(outcome.detail);
  }

  function applyLevelMap(levelId) {
    const level = LEVELS[levelId];
    exitTrapMode();

    if (levelId === 'tiebreak' && level) {
      state.walls = wallGridFromPairs(level.walls);
      state.start = { x: level.start.x, y: level.start.y };
      state.end = { x: level.end.x, y: level.end.y };
    } else {
      state.walls = makeWallGrid();
      state.start = { x: 3, y: 10 };
      state.end = { x: 16, y: 10 };

      if (levelId === 'unreachable') {
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
          const x = state.end.x + dx;
          const y = state.end.y + dy;
          if (isInside(x, y)) {
            state.walls[y][x] = true;
          }
        });
      }
    }

    // 编辑层不变量：起点和终点永远可通行
    state.walls[state.start.y][state.start.x] = false;
    state.walls[state.end.y][state.end.x] = false;
    invalidateComparison();
    resetRunState({ clearPredictionInput: true });
  }

  function getLevelRecord(levelId) {
    const stored = getStoredLevels();
    return stored[levelId] || {};
  }

  function isLevelPassed(levelId) {
    const runtime = state.levelRuntime[levelId] || {};
    return Boolean(getLevelRecord(levelId).passed || runtime.passed);
  }

  function isLevelMastered(levelId) {
    const runtime = state.levelRuntime[levelId] || {};
    return Boolean(getLevelRecord(levelId).quizCorrect || runtime.quizCorrect);
  }

  function setLevelHint(stateName, text) {
    const runtime = state.levelRuntime[state.levelId];
    if (!runtime) return;
    runtime.feedback = { state: stateName, text };
    renderLevelFeedback();
    renderLevelLive();
  }

  function completeLevel(levelId, detail) {
    const runtime = state.levelRuntime[levelId];
    if (!runtime) return;

    const alreadyPassed = isLevelPassed(levelId);
    runtime.passed = true;
    runtime.checked = true;
    runtime.feedback = { state: 'pass', text: `✓ 目标完成。${detail}` };

    if (!alreadyPassed) {
      persistLevel(levelId);
      setStatus('success', '目标完成 · 待小测');
      showToast('✓ 目标完成 · 去答小测', 3200);
      announce(`目标完成。${detail} 小测已解锁。`);
    } else {
      refreshLevelMastery();
      renderLevelFeedback();
      renderLevelLive();
    }

    renderLevelCta();
    renderNextCta();
    renderQuizGate();
  }

  function renderLevelLive() {
    if (!dom.levelGoalBadge || !dom.levelInlineState || !dom.levelLiveText) return;

    const levelId = state.levelId;
    const runtime = state.levelRuntime[levelId] || {};
    const record = getLevelRecord(levelId);
    const passed = Boolean(record.passed || runtime.passed);
    const mastered = Boolean(record.quizCorrect || runtime.quizCorrect);

    let dataState = 'idle';
    let badge = '目标未完成';
    let text = '使用上方关卡动作，系统会自动判定目标。';

    if (mastered) {
      dataState = 'mastered';
      badge = '已掌握';
      text = '本关目标与小测都已完成，可以复习或前往下一关。';
    } else if (passed) {
      dataState = 'pass';
      badge = '目标完成';
      text = runtime.feedback && runtime.feedback.state === 'pass'
        ? `${runtime.feedback.text} 小测已解锁。`
        : '目标已通过，点击「目标完成 · 去答小测」完成最后一步。';
    } else if (runtime.feedback) {
      text = runtime.feedback.text;
      dataState = runtime.feedback.state === 'fail' ? 'fail' : 'idle';
    }

    dom.levelGoalBadge.dataset.state = dataState;
    dom.levelGoalBadge.textContent = badge;
    dom.levelInlineState.dataset.state = dataState;
    dom.levelLiveText.textContent = text;
  }

  function renderLevelCta() {
    if (!dom.levelCta) return;

    dom.levelCta.textContent = '';
    const levelId = state.levelId;
    const runtime = state.levelRuntime[levelId] || {};
    const record = getLevelRecord(levelId);
    const passed = Boolean(record.passed || runtime.passed);
    const mastered = Boolean(record.quizCorrect || runtime.quizCorrect);

    dom.levelCta.hidden = state.playMode !== 'level' || (!passed && !mastered);
    if (dom.levelCta.hidden) return;

    if (mastered) {
      appendMasteredCtas(dom.levelCta);
      return;
    }

    const quizButton = document.createElement('button');
    quizButton.type = 'button';
    quizButton.className = 'level-cta-primary';
    quizButton.textContent = '目标完成 · 去答小测';
    quizButton.addEventListener('click', () => openLevelDetails({ focusQuiz: true }));
    dom.levelCta.appendChild(quizButton);
  }

  function renderNextCta() {
    if (!dom.levelNextCta) return;

    dom.levelNextCta.textContent = '';
    const levelId = state.levelId;
    const runtime = state.levelRuntime[levelId] || {};
    const record = getLevelRecord(levelId);
    const mastered = Boolean(record.quizCorrect || runtime.quizCorrect);

    dom.levelNextCta.hidden = state.playMode !== 'level' || !mastered;
    if (dom.levelNextCta.hidden) return;

    appendMasteredCtas(dom.levelNextCta);
  }

  function appendMasteredCtas(container) {
    const nextId = nextLevelId(state.levelId);
    const primary = document.createElement('a');
    primary.className = 'level-cta-primary';

    if (nextId) {
      primary.href = `play.html?level=${nextId}`;
      primary.textContent = '已掌握 · 下一关 →';
      primary.dataset.nextLevel = nextId;
    } else {
      primary.href = 'play.html?mode=custom';
      primary.textContent = '已掌握 · 去自由探索 →';
    }

    const secondary = document.createElement('a');
    secondary.className = 'level-cta-secondary';
    secondary.href = 'index.html';
    secondary.textContent = '返回关卡选择';

    container.append(primary, secondary);
  }

  function nextLevelId(levelId) {
    const order = ['heuristic', 'tiebreak', 'unreachable'];
    const index = order.indexOf(levelId);
    return index >= 0 && index < order.length - 1 ? order[index + 1] : null;
  }

  function renderQuizGate() {
    if (state.playMode !== 'level') {
      if (dom.levelQuizBlock) dom.levelQuizBlock.hidden = true;
      if (dom.levelQuizLock) dom.levelQuizLock.hidden = true;
      return;
    }

    const levelId = state.levelId;
    const runtime = state.levelRuntime[levelId] || {};
    const record = getLevelRecord(levelId);
    const passed = Boolean(record.passed || runtime.passed);
    const mastered = Boolean(record.quizCorrect || runtime.quizCorrect);

    if (dom.levelQuizLock) {
      dom.levelQuizLock.hidden = passed;
      dom.levelQuizLock.textContent = '目标未完成，小测暂时锁定。';
    }
    if (dom.levelQuizBlock) {
      dom.levelQuizBlock.hidden = !passed;
      dom.levelQuizBlock.classList.toggle('is-solved', mastered);
    }
    if (dom.quizSolvedNote) {
      dom.quizSolvedNote.hidden = !mastered;
    }
    if (dom.quizSubmitBtn) {
      dom.quizSubmitBtn.disabled = !passed || mastered;
    }
  }

  function evaluateLevel(levelId) {
    if (levelId === 'heuristic') return evaluateHeuristicLevel();
    if (levelId === 'tiebreak') return evaluateTiebreakLevel();
    if (levelId === 'unreachable') return evaluateUnreachableLevel();
    return null;
  }

  function evaluateHeuristicLevel() {
    if (!engineHasCompare()) {
      throw new Error('对比接口尚未就绪，请等待引擎更新');
    }

    const comparison = Engine.compareAlgorithms(state.walls, state.start, state.end);
    if (!renderComparison(comparison)) {
      throw new Error('引擎返回的对比数据不完整');
    }

    const astarExpanded = Math.max(0, Number(comparison.astar.expanded) || 0);
    const bfsExpanded = Math.max(0, Number(comparison.bfs.expanded) || 0);
    const passed = astarExpanded < bfsExpanded;

    const detail = passed
      ? `A* 扩展 ${astarExpanded} 个节点，BFS 扩展 ${bfsExpanded} 个，A* 更少。`
      : `A* 扩展 ${astarExpanded} 个，BFS 扩展 ${bfsExpanded} 个；A* 没有更少。试试载入关卡地图，保持空地图与 (3,10) → (16,10)。`;

    return { passed, detail };
  }

  function evaluateTiebreakLevel() {
    if (!Engine || typeof Engine.findPathTrace !== 'function') {
      throw new Error('寻路引擎未加载');
    }

    const level = LEVELS.tiebreak;
    const walls = wallGridFromPairs(level.walls);
    const traceH = Engine.findPathTrace(walls, level.start, level.end, { tieBreak: 'h' });
    const traceKey = Engine.findPathTrace(walls, level.start, level.end, { tieBreak: 'key' });

    if (!traceH || !traceKey) {
      throw new Error('引擎没有返回完整的 trace');
    }

    const movesH = traceMoves(traceH);
    const movesK = traceMoves(traceKey);
    const visitedH = traceVisitOrder(traceH);
    const visitedK = traceVisitOrder(traceKey);
    const diffIndex = firstArrayDifference(visitedH, visitedK);
    const orderDiff = diffIndex >= 0;
    const sameMoves = Boolean(traceH.found && traceKey.found && movesH === movesK);
    const passed = sameMoves && orderDiff;

    let detail = `固定地图：路径步数 h=${movesH} / key=${movesK}；访问顺序${orderDiff ? '不同' : '相同'}。`;
    if (orderDiff) {
      detail += ` 首次分歧在第 ${diffIndex + 1} 个访问节点：h→(${pointText(visitedH[diffIndex])})，key→(${pointText(visitedK[diffIndex])})。`;
    } else {
      detail += ' 若引擎尚未实现 tieBreak，请等待引擎更新后再检查。';
    }
    detail += ` 扩展节点 h=${traceExpanded(traceH)} / key=${traceExpanded(traceKey)}。`;

    return { passed, detail };
  }

  function evaluateUnreachableLevel() {
    if (!Engine || typeof Engine.findPathTrace !== 'function') {
      throw new Error('寻路引擎未加载');
    }

    const trace = Engine.findPathTrace(state.walls, state.start, state.end);
    if (!trace || typeof trace.found !== 'boolean') {
      throw new Error('引擎没有返回完整的 trace');
    }

    const expanded = traceExpanded(trace);
    const passed = trace.found === false && expanded > 0;

    let detail;
    if (trace.found) {
      detail = '当前地图仍能到达终点；请载入关卡地图，封死终点的上下左右四个邻居。';
    } else if (expanded <= 0) {
      detail = 'A* 返回了无路，但扩展节点数为 0；请保留至少一个可达节点供搜索。';
    } else {
      detail = `A* 返回无路，并扩展了 ${expanded} 个可达节点。`;
    }

    return { passed, detail };
  }

  function traceMoves(trace) {
    if (!trace || !trace.found) return -1;
    const metrics = trace.metrics || {};
    const moves = Number(metrics.pathMoves);
    if (Number.isFinite(moves)) return Math.max(0, moves);
    return Array.isArray(trace.path) ? Math.max(0, trace.path.length - 1) : 0;
  }

  function traceExpanded(trace) {
    return Math.max(0, Number(trace && trace.metrics && trace.metrics.expanded) || 0);
  }

  function traceVisitOrder(trace) {
    if (!trace) return [];
    if (Array.isArray(trace.visited) && trace.visited.length > 0) {
      return trace.visited;
    }
    if (Array.isArray(trace.events)) {
      return trace.events
        .filter((event) => event && event.type === 'expand')
        .map((event) => event.key);
    }
    return [];
  }

  function firstArrayDifference(a, b) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      if (a[i] !== b[i]) return i;
    }
    return -1;
  }

  function pointText(key) {
    if (!Number.isFinite(key)) return '—';
    const point = fromKey(key);
    return `${point.x}, ${point.y}`;
  }

  function wallGridFromPairs(pairs) {
    const grid = makeWallGrid();
    (Array.isArray(pairs) ? pairs : []).forEach(([x, y]) => {
      if (isInside(x, y)) grid[y][x] = true;
    });
    return grid;
  }

  function renderQuizOptions() {
    const level = LEVELS[state.levelId];
    const runtime = state.levelRuntime[state.levelId];
    if (!level) return;

    dom.quizOptions.textContent = '';

    level.quiz.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.index = String(index);
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(runtime.quizIndex === index));
      if (runtime.quizIndex === index) button.classList.add('is-selected');

      const key = document.createElement('span');
      key.className = 'quiz-option-key';
      key.setAttribute('aria-hidden', 'true');
      key.textContent = String.fromCharCode(65 + index);

      const text = document.createElement('span');
      text.className = 'quiz-option-text';
      text.textContent = option.text;

      button.append(key, text);
      dom.quizOptions.appendChild(button);
    });
  }

  function onQuizOptionClick(event) {
    const button = event.target instanceof Element
      ? event.target.closest('.quiz-option')
      : null;
    if (!button || !dom.quizOptions.contains(button)) return;

    const runtime = state.levelRuntime[state.levelId];
    runtime.quizIndex = Number(button.dataset.index);

    Array.from(dom.quizOptions.querySelectorAll('.quiz-option')).forEach((option, index) => {
      const selected = index === runtime.quizIndex;
      option.classList.toggle('is-selected', selected);
      option.classList.remove('is-correct', 'is-wrong');
      option.setAttribute('aria-checked', String(selected));
    });

    dom.quizFeedback.hidden = true;
  }

  function submitQuiz() {
    if (state.playMode !== 'level') return;

    const level = LEVELS[state.levelId];
    const runtime = state.levelRuntime[state.levelId];
    if (!level || !runtime) return;

    if (!isLevelPassed(state.levelId)) {
      showToast('先完成关卡目标，小测才会解锁');
      renderQuizGate();
      return;
    }

    if (isLevelMastered(state.levelId)) {
      showToast('本关小测已通过，可以进行下一关');
      return;
    }

    if (runtime.quizIndex === null) {
      showToast('请先选择一个答案');
      return;
    }

    const selected = level.quiz.options[runtime.quizIndex];
    if (!selected) return;

    runtime.quizCorrect = Boolean(selected.correct) || runtime.quizCorrect;

    Array.from(dom.quizOptions.querySelectorAll('.quiz-option')).forEach((button, index) => {
      button.classList.remove('is-correct', 'is-wrong');
      if (index === runtime.quizIndex) {
        button.classList.add(selected.correct ? 'is-correct' : 'is-wrong');
      } else if (!selected.correct && level.quiz.options[index].correct) {
        button.classList.add('is-correct');
      }
    });

    dom.quizFeedback.hidden = false;
    dom.quizFeedback.className = `quiz-feedback ${selected.correct ? 'is-correct' : 'is-wrong'}`;
    dom.quizFeedback.textContent = selected.correct
      ? `✓ 回答正确。${level.quiz.hint}`
      : `✗ 再想想。提示：${level.quiz.hint}`;

    persistLevel(state.levelId);
    renderLevelCta();
    renderNextCta();
    renderQuizGate();
    renderLevelLive();

    if (selected.correct) {
      showToast('✓ 已掌握本关 · 下一关已解锁', 3200);
      announce('小测回答正确，本关已掌握。');
    } else {
      announce('小测回答错误，可以再试一次。');
    }
  }

  function persistLevel(levelId) {
    const runtime = state.levelRuntime[levelId];
    if (!runtime) return;

    const record = getStoredLevels()[levelId] || {};
    const passed = Boolean(runtime.passed || record.passed);
    const quizCorrect = Boolean(runtime.quizCorrect || record.quizCorrect);

    let saved = false;
    try {
      if (window.ProgressStore && typeof window.ProgressStore.recordLevel === 'function') {
        window.ProgressStore.recordLevel('astar', levelId, { passed, quizCorrect });
        saved = true;
      }
    } catch (error) {
      console.warn('关卡进度写入失败：', error);
    }

    refreshLevelMastery();

    if (!saved) {
      showToast('进度存储不可用，本次仅保留在页面内');
    }
  }

  function getStoredLevels() {
    try {
      if (window.ProgressStore && typeof window.ProgressStore.getLevels === 'function') {
        return window.ProgressStore.getLevels('astar') || {};
      }
    } catch (error) {
      console.warn('关卡进度读取失败：', error);
    }
    return {};
  }

  function refreshLevelMastery() {
    updateLevelBadges();
    renderLevelProgress();
    renderLevelCta();
    renderNextCta();
    renderQuizGate();
    renderLevelLive();
  }

  function updateLevelBadges() {
    const stored = getStoredLevels();

    dom.levelTabs.forEach((button) => {
      const levelId = button.dataset.level;
      const badge = button.querySelector('.level-mastery');
      if (!badge) return;

      const record = stored[levelId] || {};
      const runtime = state.levelRuntime[levelId] || {};
      const passed = Boolean(record.passed || runtime.passed);
      const quizCorrect = Boolean(record.quizCorrect || runtime.quizCorrect);
      const mastered = quizCorrect;
      const partial = passed && !quizCorrect;

      badge.textContent = mastered ? '已掌握' : partial ? '待小测' : '未掌握';
      badge.dataset.state = mastered ? 'mastered' : partial ? 'partial' : 'idle';
      button.classList.toggle('is-mastered', mastered);
    });
  }

  function renderLevelProgress() {
    const levelId = state.levelId;
    const runtime = state.levelRuntime[levelId];
    if (!runtime) return;

    const record = getStoredLevels()[levelId] || {};
    const passed = Boolean(record.passed || runtime.passed);
    const quizCorrect = Boolean(record.quizCorrect || runtime.quizCorrect);

    dom.levelQuizPill.dataset.state = quizCorrect ? 'pass' : 'idle';
    dom.levelQuizPill.textContent = quizCorrect
      ? '小测已通过'
      : passed
        ? '小测已解锁'
        : '小测未解锁';

    let masteryState = 'idle';
    let masteryText = '目标未完成';
    if (quizCorrect) {
      masteryState = 'mastered';
      masteryText = '已掌握';
    } else if (passed) {
      masteryState = 'partial';
      masteryText = '目标完成 · 待小测';
    }

    dom.levelMasteryText.dataset.state = masteryState;
    dom.levelMasteryText.textContent = masteryText;
  }

  function renderLevelFeedback() {
    const runtime = state.levelRuntime[state.levelId];
    if (!runtime) return;

    if (!runtime.feedback) {
      dom.levelFeedback.dataset.state = 'idle';
      dom.levelFeedback.textContent = '完成关卡目标后，这里会显示判定结果与小测入口。';
      return;
    }

    dom.levelFeedback.dataset.state = runtime.feedback.state || 'idle';
    dom.levelFeedback.textContent = runtime.feedback.text || '';
  }

  // =========================================================
  // 键盘快捷键
  // =========================================================

  function onKeyDown(event) {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (state.tutorialOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWhyTutorial();
      }
      return;
    }

    if (docsViewer && docsViewer.isOpen()) return;

    if (state.detailDrawerOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeLevelDetails();
      }
      return;
    }

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
      if (isEditingLocked()) return;
      const tools = ['wall', 'start', 'end', 'erase'];
      selectTool(tools[Number(event.key) - 1]);
      event.preventDefault();
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'r') {
      if (isEditingLocked()) return;
      event.preventDefault();
      generateRandomMap();
    } else if (key === 'c') {
      if (isEditingLocked()) return;
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
      drawSemanticVisited(geometry, view);
    }

    drawWalls(geometry);

    if (view) {
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

      drawOpenSetFLabel(geo, node, x, y, i);
    }
  }

  function drawOpenSetFLabel(geo, node, x, y, order) {
    if (!node || !Number.isFinite(node.f)) return;
    if (!isInside(x, y)) return;
    if (sameCell({ x, y }, state.start) || sameCell({ x, y }, state.end)) return;

    const text = `f${Math.round(node.f)}`;
    const padX = Math.max(1.4, geo.cell * 0.055);
    const padY = Math.max(1, geo.cell * 0.04);
    const inset = Math.max(1.2, geo.cell * 0.055);
    let fontSize = clamp(geo.cell * 0.27, 7, 10.5);

    context.save();
    context.font = `700 ${fontSize}px ${CANVAS_MONO}`;
    context.textAlign = 'left';
    context.textBaseline = 'top';

    const maxTextWidth = Math.max(4, geo.cell - inset * 2 - padX * 2);
    let textWidth = context.measureText(text).width;

    if (textWidth > maxTextWidth) {
      fontSize = Math.max(5, fontSize * (maxTextWidth / textWidth));
      context.font = `700 ${fontSize}px ${CANVAS_MONO}`;
      textWidth = context.measureText(text).width;
    }

    const boxWidth = textWidth + padX * 2;
    const boxHeight = fontSize + padY * 2;
    const boxX = geo.offsetX + x * geo.cell + inset;
    const boxY = geo.offsetY + y * geo.cell + inset;

    context.globalAlpha = order === 0 ? 0.98 : 0.86;
    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    roundedRectPath(
      context,
      boxX,
      boxY,
      boxWidth,
      boxHeight,
      Math.max(2, geo.cell * 0.1)
    );
    context.fill();

    context.lineWidth = 1;
    context.strokeStyle = order === 0
      ? 'rgba(41, 107, 232, 0.42)'
      : 'rgba(53, 109, 243, 0.2)';
    context.stroke();

    context.fillStyle = order === 0 ? '#1f4fae' : '#3b5d8f';
    context.fillText(text, boxX + padX, boxY + padY);
    context.restore();
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

})();
