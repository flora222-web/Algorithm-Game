'use strict';

/**
 * 二分拆弹 · UI 层
 * ------------------------------------------------------------
 * 所有游戏规则、区间收缩、线路消耗与猜测验证都由 window.BinaryEngine 负责。
 * 本文件只处理 DOM 渲染、输入路由、预测记录与页面切换守卫，不复制状态机。
 */
(() => {
  const ENGINE = window.BinaryEngine;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ICONS = {
    success: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="m5.5 12.4 4.2 4.2 8.8-9.2" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M4.2 5.1c1.4-1.2 3.1-1.8 4.8-1.8M19.8 18.9c-1.4 1.2-3.1 1.8-4.8 1.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity=".45"/>
      </svg>`,
    explosion: `
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3.2 13.4 8l4.1-2.5-1.1 4.4 4.5.7-3.4 3 3.4 3-4.5.7 1.1 4.4-4.1-2.5L12 20.8l-1.4-4.8-4.1 2.5 1.1-4.4-4.5-.7 3.4-3-3.4-3 4.5-.7-1.1-4.4 4.1 2.5L12 3.2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
      </svg>`
  };

  const dom = {
    bombCard: document.getElementById('bombCard'),
    bombVisual: document.getElementById('bombVisual'),
    bombTime: document.getElementById('bombTime'),
    bombTimeLabel: document.getElementById('bombTimeLabel'),
    bombStatus: document.getElementById('bombStatus'),
    bombStatusText: document.getElementById('bombStatusText'),
    bombLead: document.getElementById('bombLead'),

    predictionCard: document.getElementById('predictionCard'),
    predictForm: document.getElementById('predictForm'),
    predictInput: document.getElementById('predictInput'),
    predictSubmit: document.getElementById('predictSubmit'),
    predictFeedback: document.getElementById('predictFeedback'),

    guessForm: document.getElementById('guessForm'),
    guessInput: document.getElementById('guessInput'),
    guessSubmit: document.getElementById('guessSubmit'),
    guessHelp: document.getElementById('guessHelp'),
    guessWireNote: document.getElementById('guessWireNote'),
    feedbackBox: document.getElementById('feedbackBox'),
    feedbackText: document.getElementById('feedbackText'),

    candidateCount: document.getElementById('candidateCount'),
    eliminatedCount: document.getElementById('eliminatedCount'),
    attemptCount: document.getElementById('attemptCount'),

    predictionAccuracy: document.getElementById('predictionAccuracy'),
    predictionRecord: document.getElementById('predictionRecord'),
    predictMeterFill: document.getElementById('predictMeterFill'),

    wirePanel: document.getElementById('wirePanel'),
    wireStrip: document.getElementById('wireStrip'),
    wireCount: document.getElementById('wireCount'),
    wireNote: document.getElementById('wireNote'),

    stateLow: document.getElementById('stateLow'),
    stateHigh: document.getElementById('stateHigh'),
    stateMid: document.getElementById('stateMid'),
    stateRemaining: document.getElementById('stateRemaining'),
    stateInvariant: document.getElementById('stateInvariant'),
    stateInvariantRange: document.getElementById('stateInvariantRange'),
    stateWires: document.getElementById('stateWires'),
    midFormulaRule: document.getElementById('midFormulaRule'),
    midFormulaCalc: document.getElementById('midFormulaCalc'),

    historyCount: document.getElementById('historyCount'),
    guessTableBody: document.getElementById('guessTableBody'),

    startBombBtn: document.getElementById('startBombBtn'),
    startBombLabel: document.getElementById('startBombLabel'),
    inlineStartRow: document.getElementById('inlineStartRow'),
    startBombBtnInline: document.getElementById('startBombBtnInline'),
    startBombLabelInline: document.getElementById('startBombLabelInline'),

    bombResultOverlay: document.getElementById('bombResultOverlay'),
    bombResultIcon: document.getElementById('bombResultIcon'),
    bombResultKicker: document.getElementById('bombResultKicker'),
    bombResultTitle: document.getElementById('bombResultTitle'),
    bombResultMessage: document.getElementById('bombResultMessage'),
    bombResultTarget: document.getElementById('bombResultTarget'),
    bombResultGuesses: document.getElementById('bombResultGuesses'),
    bombResultTime: document.getElementById('bombResultTime'),
    bombResultAction: document.getElementById('bombResultAction'),

    switchDialog: document.getElementById('switchDialog'),
    switchMessage: document.getElementById('switchMessage'),
    switchCancel: document.getElementById('switchCancel'),
    switchConfirm: document.getElementById('switchConfirm'),

    screenFlash: document.getElementById('screenFlash'),
    bombToast: document.getElementById('bombToast'),
    openDocsBtn: document.getElementById('openDocsBtn'),

    oracleOpenBtn: document.getElementById('oracleOpenBtn'),
    oracleDialog: document.getElementById('oracleDialog'),
    oracleCloseBtn: document.getElementById('oracleCloseBtn'),
    oracleMastery: document.getElementById('oracleMastery'),
    oracleSecretInput: document.getElementById('oracleSecretInput'),
    oracleSecretRange: document.getElementById('oracleSecretRange'),
    oracleStartBtn: document.getElementById('oracleStartBtn'),
    oracleSecretError: document.getElementById('oracleSecretError'),
    oracleRoundBadge: document.getElementById('oracleRoundBadge'),
    oracleGuessStage: document.getElementById('oracleGuessStage'),
    oracleRangeBadge: document.getElementById('oracleRangeBadge'),
    oracleConsistency: document.getElementById('oracleConsistency'),
    oracleGuessValue: document.getElementById('oracleGuessValue'),
    oracleGuessFormula: document.getElementById('oracleGuessFormula'),
    oracleAnswerHigh: document.getElementById('oracleAnswerHigh'),
    oracleAnswerHit: document.getElementById('oracleAnswerHit'),
    oracleAnswerLow: document.getElementById('oracleAnswerLow'),
    oraclePlayHint: document.getElementById('oraclePlayHint'),
    oracleConsistencyNote: document.getElementById('oracleConsistencyNote'),
    oracleHistory: document.getElementById('oracleHistory'),
    oracleHistoryCount: document.getElementById('oracleHistoryCount'),
    oracleEndSection: document.getElementById('oracleEndSection'),
    oracleEndText: document.getElementById('oracleEndText'),
    oracleEndGuesses: document.getElementById('oracleEndGuesses'),
    oracleEndLayers: document.getElementById('oracleEndLayers'),
    oracleEndConsistency: document.getElementById('oracleEndConsistency'),
    oracleTreeMeta: document.getElementById('oracleTreeMeta'),
    oracleTree: document.getElementById('oracleTree'),
    oracleQuiz: document.getElementById('oracleQuiz'),
    oracleQuizQ1: document.getElementById('oracleQuizQ1'),
    oracleQuizQ2: document.getElementById('oracleQuizQ2'),
    oracleQuizQ1Feedback: document.getElementById('oracleQuizQ1Feedback'),
    oracleQuizQ2Feedback: document.getElementById('oracleQuizQ2Feedback'),
    oracleQuizResult: document.getElementById('oracleQuizResult'),

    playBackLink: document.getElementById('playBackLink'),
    playModeKicker: document.getElementById('playModeKicker'),
    levelTitle: document.getElementById('levelTitle'),
    levelCompletion: document.getElementById('levelCompletion'),
    levelCompletionTitle: document.getElementById('levelCompletionTitle'),
    levelCompletionText: document.getElementById('levelCompletionText'),
    levelQuizJump: document.getElementById('levelQuizJump'),
    levelNextLink: document.getElementById('levelNextLink'),
    levelCompletionBack: document.getElementById('levelCompletionBack'),
    exampleQuizOptions: document.getElementById('exampleQuizOptions'),
    exampleQuizFeedback: document.getElementById('exampleQuizFeedback'),
    levelTabs: document.getElementById('levelTabs'),
    levelMastery: document.getElementById('levelMastery'),
    levelGoal: document.getElementById('levelGoal'),
    levelStatus: document.getElementById('levelStatus'),
    levelQuizStatus: document.getElementById('levelQuizStatus'),
    railTabs: document.getElementById('railTabs'),
    railTabData: document.getElementById('railTabData'),
    railTabLevel: document.getElementById('railTabLevel'),
    railPaneData: document.getElementById('railPaneData'),
    railPaneLevel: document.getElementById('railPaneLevel'),
    taskDetailsBtn: document.getElementById('taskDetailsBtn'),
    exampleProgress: document.getElementById('exampleProgress'),
    exampleNote: document.getElementById('exampleNote'),
    exampleSteps: document.getElementById('exampleSteps'),
    exampleStart: document.getElementById('exampleStart'),
    exampleNext: document.getElementById('exampleNext'),
    exampleAuto: document.getElementById('exampleAuto'),
    midpointStart: document.getElementById('midpointStart'),
    midpointQuizOptions: document.getElementById('midpointQuizOptions'),
    midpointQuizFeedback: document.getElementById('midpointQuizFeedback'),
    invariantStart: document.getElementById('invariantStart'),
    invariantStreak: document.getElementById('invariantStreak'),
    invariantPrompt: document.getElementById('invariantPrompt'),
    invariantLow: document.getElementById('invariantLow'),
    invariantHigh: document.getElementById('invariantHigh'),
    invariantCheck: document.getElementById('invariantCheck'),
    invariantFeedback: document.getElementById('invariantFeedback'),
    invariantHint: document.getElementById('invariantHint'),
    boundaryRun: document.getElementById('boundaryRun'),
    boundaryOutput: document.getElementById('boundaryOutput'),
    boundarySummary: document.getElementById('boundarySummary'),
    boundarySteps: document.getElementById('boundarySteps'),
    boundaryQuizOptions: document.getElementById('boundaryQuizOptions'),
    boundaryQuizFeedback: document.getElementById('boundaryQuizFeedback'),

    duplicatesTitle: document.getElementById('duplicatesTitle'),
    duplicatesTargetGroup: document.getElementById('duplicatesTargetGroup'),
    duplicatesModeGroup: document.getElementById('duplicatesModeGroup'),
    duplicatesArray: document.getElementById('duplicatesArray'),
    duplicatesState: document.getElementById('duplicatesState'),
    duplicatesDecision: document.getElementById('duplicatesDecision'),
    duplicatesSteps: document.getElementById('duplicatesSteps'),
    duplicatesNext: document.getElementById('duplicatesNext'),
    duplicatesAuto: document.getElementById('duplicatesAuto'),
    duplicatesReset: document.getElementById('duplicatesReset'),
    duplicatesProgress: document.getElementById('duplicatesProgress'),
    duplicatesResult: document.getElementById('duplicatesResult'),
    duplicatesResultText: document.getElementById('duplicatesResultText'),
    duplicatesReveal: document.getElementById('duplicatesReveal'),
    duplicatesQuizPrompt: document.getElementById('duplicatesQuizPrompt'),
    duplicatesQuizOptions: document.getElementById('duplicatesQuizOptions'),
    duplicatesQuizFeedback: document.getElementById('duplicatesQuizFeedback'),

    thresholdAsk: document.getElementById('thresholdAsk'),
    thresholdQuestion: document.getElementById('thresholdQuestion'),
    thresholdAnswer: document.getElementById('thresholdAnswer'),
    thresholdLow: document.getElementById('thresholdLow'),
    thresholdHigh: document.getElementById('thresholdHigh'),
    thresholdMid: document.getElementById('thresholdMid'),
    thresholdDecision: document.getElementById('thresholdDecision'),
    thresholdSteps: document.getElementById('thresholdSteps'),
    thresholdNext: document.getElementById('thresholdNext'),
    thresholdAuto: document.getElementById('thresholdAuto'),
    thresholdReset: document.getElementById('thresholdReset'),
    thresholdProgress: document.getElementById('thresholdProgress'),
    thresholdResult: document.getElementById('thresholdResult'),
    thresholdResultText: document.getElementById('thresholdResultText'),
    thresholdReveal: document.getElementById('thresholdReveal'),
    thresholdQuizOptions: document.getElementById('thresholdQuizOptions'),
    thresholdQuizFeedback: document.getElementById('thresholdQuizFeedback'),

    liveRegion: document.getElementById('liveRegion')
  };

  const ui = {
    game: null,
    events: [],
    prediction: { locked: false },
    resultOpen: false,
    resultPending: false,
    navigationPending: false,
    pendingHref: null,
    switchConfirmed: false,
    docsViewer: null,
    lastCut: null,
    railTab: 'data',
    levels: {
      active: 'example',
      session: {
        example: { passed: false, quizCorrect: false },
        midpoint: { passed: false, quizCorrect: false },
        invariant: { passed: false, quizCorrect: false },
        boundary: { passed: false, quizCorrect: false },
        duplicates: { passed: false, quizCorrect: false },
        threshold: { passed: false, quizCorrect: false }
      },
      invariant: { streak: 0, promptOpen: false, answered: false },
      boundary: { result: null },
      duplicates: { target: 2, mode: 'first', state: null, auto: false },
      threshold: { state: null, auto: false }
    },
    oracle: {
      open: false,
      status: 'ready',
      secret: 62,
      low: 1,
      high: 100,
      guess: null,
      step: 0,
      guesses: [],
      inconsistent: false,
      endReason: null,
      quiz: { q1: false, q2: false, recorded: false }
    },
    demo: {
      active: false,
      auto: false,
      index: 0,
      total: 0,
      events: [],
      done: false
    },
    timers: {
      toast: 0,
      toastHide: 0,
      result: 0,
      navigation: 0,
      flash: 0,
      shake: 0,
      error: 0,
      cut: 0,
      demo: 0,
      duplicates: 0,
      threshold: 0
    }
  };

  const wireEls = [];

  if (!ENGINE) {
    showFatalEngineError();
    return;
  }

  const LOWER_BOUND = ENGINE.LOWER_BOUND;
  const UPPER_BOUND = ENGINE.UPPER_BOUND;
  const MAX_WIRES = ENGINE.MAX_WIRES || 7;
  const LEVEL_IDS = ['example', 'midpoint', 'invariant', 'boundary', 'duplicates', 'threshold'];
  const LEVEL_BOMB_IDS = ['example', 'midpoint', 'invariant'];
  const LEVEL_NEXT = {
    example: 'midpoint',
    midpoint: 'invariant',
    invariant: 'boundary',
    boundary: 'duplicates',
    duplicates: 'threshold',
    threshold: null
  };
  const LEVEL_FIXED_SECRET = { example: 62, midpoint: 37, invariant: 74 };
  const DUPLICATE_VALUES = [1, 2, 2, 2, 4, 5, 5, 7, 9];
  const THRESHOLD_CONFIG = { low: 1, high: 100, threshold: 60 };
  const PLAY = parsePlayRoute();

  const LEVEL_META = {
    example: {
      name: '示例演示',
      goal: '目标：跟随固定 secret = 62 的最优二分演示，观察每次 mid 与新区间；演示结束即通过。'
    },
    midpoint: {
      name: '7 根线',
      goal: '目标：固定 secret = 37，用 7 根线拆弹成功即通过；再答对「最坏为什么是 7 次」点亮掌握徽章。'
    },
    invariant: {
      name: '区间不变量',
      goal: '目标：固定 secret = 74，每次猜错后写出新的 [low, high]；连续 3 次正确完成小测，本局结束即通过。'
    },
    boundary: {
      name: '死循环排查',
      goal: '目标：运行 secret = 51 的 low = mid 二分，复现 [50, 51] 死循环，并指出错误的那一行。'
    },
    duplicates: {
      name: '重复元素',
      goal: '目标：在固定重复数组里，用目标 2 找第一个位置；走完演示后答对小测。'
    },
    threshold: {
      name: '最小电量',
      goal: '目标：容量固定 1–100，只靠“容量 x 能撑过 8 小时吗”的是/否回答，找出最小可用容量。'
    }
  };

  const EXAMPLE_QUIZ = [
    {
      text: '50。mid = 1 + floor((100 − 1) / 2) = 50。',
      correct: true,
      explain: 'mid 由当前区间 [low, high] 决定，与 secret 本身无关。'
    },
    {
      text: '62。secret 是 62，所以第一次直接猜 62。',
      correct: false,
      hint: 'mid 由区间中点决定，猜谜时并不知道 secret。'
    },
    {
      text: '51。中点总是区间中间偏右的那个数。',
      correct: false,
      hint: '公式向下取整：1–100 的第一次中点是 50。'
    }
  ];

  const MIDPOINT_QUIZ = [
    {
      text: '每次比较都把候选数量至少减半，⌈log₂100⌉ = 7。',
      correct: true,
      explain: '100 → 50 → 25 → 12 → 6 → 3 → 1，7 次后最多只剩一个候选。'
    },
    {
      text: '100 ÷ 7 ≈ 14，所以每轮要排除 14 个数字。',
      correct: false,
      hint: '除法不是二分的收缩方式，观察候选数量如何变化。'
    },
    {
      text: '7 是 1–100 的中位数，所以最多猜 7 次。',
      correct: false,
      hint: '中位数是 50，不是 7；最坏次数来自折半。'
    }
  ];

  const BOUNDARY_QUIZ = [
    {
      text: '第 4 行 low = mid：猜小后没有排除 mid，区间不再缩小。',
      correct: true,
      explain: 'low 应该更新为 mid + 1；停在 mid 会让 [50, 51] 反复出现。'
    },
    {
      text: '第 6 行 high = mid − 1：猜大后右边界收缩得太快。',
      correct: false,
      hint: '这行是正确的排除方式，问题不在它。'
    },
    {
      text: '第 2 行 mid = low + Math.floor(...)：中点公式写错了。',
      correct: false,
      hint: '取中点公式没有问题，检查边界更新。'
    }
  ];

  const DUPLICATES_QUIZ = [
    {
      text: '因为命中目标不代表它就是第一个/最后一个，还要继续向边界收缩。',
      correct: true,
      explain: '找第一个时保留 mid（high = mid），找最后一个时把 mid 当作可继续向右的边界（low = mid + 1），直到区间收敛。'
    },
    {
      text: '因为 mid − 1 一定会越界。',
      correct: false,
      hint: 'mid − 1 不一定越界；真正的问题是会不会漏掉更早或更晚的目标。'
    },
    {
      text: '因为数组里有重复元素，所以每次 high 都必须减 1。',
      correct: false,
      hint: '重复元素恰恰要求保留可能的目标位置，而不是盲目排除。'
    }
  ];

  const THRESHOLD_QUIZ = [
    {
      text: '因为“容量越大越容易撑过 8 小时”，答案只会从否变成是，具有单调性。',
      correct: true,
      explain: '存在一个分界点：小于它都失败，大于等于它都成功，所以能每次砍掉一半。'
    },
    {
      text: '因为 1–100 只有 100 个数，逐个试也很快。',
      correct: false,
      hint: '线性试最坏要 100 次；关键在于答案单调，而不是数字少。'
    },
    {
      text: '因为容量越大耗电越慢，所以随便猜一个就行。',
      correct: false,
      hint: '不能随便猜；是/否回答会告诉我们该保留哪一半。'
    }
  ];

  // 角色反转：学习者当裁判，电脑只用 nextMid(low, high) 猜，不读取 secret。
  const ORACLE_MAX_STEPS = 10;
  const ORACLE_QUIZ = {
    q1: {
      options: [
        {
          text: '每轮把候选数至少减半：100 → 50 → 25 → 12 → 6 → 3 → 1，⌈log₂100⌉ = 7。',
          correct: true,
          explain: '7 来自折半次数的上界，不是把 100 平分成 7 份。'
        },
        {
          text: '100 ÷ 7 ≈ 14，所以每次固定排除 14 个数字。',
          correct: false,
          hint: '二分每次砍掉一半，不是等分成 7 份。'
        },
        {
          text: '7 是 1–100 的中位数，所以最多猜 7 次。',
          correct: false,
          hint: '中位数是 50；7 是 ⌈log₂100⌉。'
        }
      ]
    },
    q2: {
      options: [
        {
          text: '不能。比较结果一旦不可信，secret 可能被排除出区间，二分失去正确性保证。',
          correct: true,
          explain: '二分依赖每次回答真实；裁判说谎时，不变式 secret ∈ [low, high] 会被破坏。'
        },
        {
          text: '能。只要把次数上限放宽到 10 次，就一定能找到。',
          correct: false,
          hint: '增加次数无法弥补错误的方向信息。'
        },
        {
          text: '能。二分每次都在一半里找，所以总有答案。',
          correct: false,
          hint: '“在一半里”的前提是回答真实；假回答会指向错误的一半。'
        }
      ]
    }
  };

  init();

  // =========================================================
  // 初始化
  // =========================================================

  function init() {
    buildWires();
    buildLevelQuizOptions();
    initWalkthroughs();
    initOracle();
    bindEvents();
    initDocs();
    initNavigationGuard();
    syncShellCopy();
    resetPredictionForRound();
    renderAll();
    refreshProgress();
    applyPlayRoute();
  }

  function bindEvents() {
    dom.startBombBtn.addEventListener('click', handleStartBombClick);
    dom.startBombBtnInline.addEventListener('click', handleStartBombClick);
    dom.guessForm.addEventListener('submit', submitGuess);
    dom.predictForm.addEventListener('submit', submitPrediction);

    if (dom.exampleQuizOptions) {
      dom.exampleQuizOptions.addEventListener('click', (event) => handleLevelQuizClick('example', event));
    }
    if (dom.levelQuizJump) {
      dom.levelQuizJump.addEventListener('click', jumpToLevelQuiz);
    }

    dom.guessInput.addEventListener('input', () => {
      dom.guessForm.classList.remove('is-shaking');
    });
    dom.predictInput.addEventListener('input', () => {
      dom.predictionCard.classList.remove('is-shaking');
    });

    dom.bombResultAction.addEventListener('click', () => {
      hideBombResult();
      startRound();
    });

    dom.bombResultOverlay.addEventListener('click', (event) => {
      if (event.target === dom.bombResultOverlay) {
        hideBombResult({ focusStart: true });
      }
    });

    dom.switchCancel.addEventListener('click', closeSwitchDialog);
    dom.switchConfirm.addEventListener('click', confirmSwitch);

    dom.switchDialog.addEventListener('close', handleSwitchDialogClosed);
    dom.switchDialog.addEventListener('click', (event) => {
      if (event.target === dom.switchDialog) {
        closeSwitchDialog();
      }
    });

    dom.levelTabs.addEventListener('click', handleLevelTabClick);
    dom.railTabs.addEventListener('click', handleRailTabClick);
    dom.taskDetailsBtn.addEventListener('click', openTaskDetails);
    dom.exampleStart.addEventListener('click', startExampleDemo);
    dom.exampleNext.addEventListener('click', () => stepDemo());
    dom.exampleAuto.addEventListener('click', toggleDemoAuto);
    dom.midpointStart.addEventListener('click', () => startRound());
    dom.invariantStart.addEventListener('click', () => startRound());
    dom.invariantCheck.addEventListener('click', checkInvariantRange);
    dom.invariantLow.addEventListener('keydown', handleInvariantKeydown);
    dom.invariantHigh.addEventListener('keydown', handleInvariantKeydown);
    dom.boundaryRun.addEventListener('click', runBoundaryBug);

    dom.duplicatesTargetGroup.addEventListener('click', handleDuplicatesSetupClick);
    dom.duplicatesModeGroup.addEventListener('click', handleDuplicatesSetupClick);
    dom.duplicatesNext.addEventListener('click', () => stepDuplicates(false));
    dom.duplicatesAuto.addEventListener('click', toggleDuplicatesAuto);
    dom.duplicatesReset.addEventListener('click', resetDuplicatesWalkthrough);
    dom.thresholdNext.addEventListener('click', () => stepThreshold(false));
    dom.thresholdAuto.addEventListener('click', toggleThresholdAuto);
    dom.thresholdReset.addEventListener('click', resetThresholdWalkthrough);

    dom.oracleOpenBtn.addEventListener('click', openOracleDialog);
    dom.oracleCloseBtn.addEventListener('click', closeOracleDialog);
    dom.oracleDialog.addEventListener('close', handleOracleDialogClosed);
    dom.oracleDialog.addEventListener('click', (event) => {
      if (event.target === dom.oracleDialog) closeOracleDialog();
    });
    dom.oracleSecretInput.addEventListener('input', handleOracleSecretInput);
    dom.oracleSecretRange.addEventListener('input', handleOracleSecretRange);
    dom.oracleStartBtn.addEventListener('click', startOracleSession);
    dom.oracleAnswerHigh.addEventListener('click', () => submitOracleAnswer('high'));
    dom.oracleAnswerHit.addEventListener('click', () => submitOracleAnswer('hit'));
    dom.oracleAnswerLow.addEventListener('click', () => submitOracleAnswer('low'));
    dom.oracleQuiz.addEventListener('click', handleOracleQuizClick);

    document.addEventListener('keydown', handleGlobalKeydown);
  }

  function initWalkthroughs() {
    ui.levels.duplicates.state = ENGINE.createBoundState(
      DUPLICATE_VALUES.slice(),
      ui.levels.duplicates.target,
      ui.levels.duplicates.mode
    );
    ui.levels.threshold.state = ENGINE.createPredicateState(THRESHOLD_CONFIG);
  }

  function buildWires() {
    const tones = ['#ff7b59', '#f2b63b', '#25c49a', '#6f9bff', '#ee5d86', '#a78bfa', '#ff9b54'];
    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= MAX_WIRES; index += 1) {
      const wire = document.createElement('li');
      wire.className = 'wire';
      wire.style.setProperty('--wire-tone', tones[(index - 1) % tones.length]);

      const topCap = document.createElement('span');
      topCap.className = 'wire-cap wire-cap--top';
      topCap.setAttribute('aria-hidden', 'true');

      const cable = document.createElement('span');
      cable.className = 'wire-cable';
      cable.setAttribute('aria-hidden', 'true');

      const bottomCap = document.createElement('span');
      bottomCap.className = 'wire-cap wire-cap--bottom';
      bottomCap.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'wire-num';
      label.setAttribute('aria-hidden', 'true');
      label.textContent = String(index).padStart(2, '0');

      wire.append(topCap, cable, bottomCap, label);
      wire.setAttribute('aria-label', `线路 ${index}：完好`);
      fragment.appendChild(wire);
      wireEls.push(wire);
    }

    dom.wireStrip.appendChild(fragment);
  }

  function initDocs() {
    if (!window.AlgorithmDocsViewer || !window.BINARY_SEARCH_DOCS) {
      dom.openDocsBtn.disabled = true;
      dom.openDocsBtn.title = '源码数据未加载';
      return;
    }

    ui.docsViewer = window.AlgorithmDocsViewer.create({
      trigger: dom.openDocsBtn,
      title: '二分查找源码与解析',
      subtitle: '用 7 根拆弹线理解二分查找：先预测 mid，再用比较结果砍掉一半候选。',
      mark: '1–100',
      languages: window.BINARY_SEARCH_DOCS,
      analysisTemplateId: 'binaryDocsAnalysis',
      onOpen: hideToast
    });
  }

  function initNavigationGuard() {
    if (!window.SiteShell || typeof window.SiteShell.setNavigationGuard !== 'function') return;

    window.SiteShell.setNavigationGuard((href) => {
      if (!ui.game || ui.game.status !== 'playing' || ui.navigationPending) return true;
      openSwitchDialog(href);
      return false;
    });
  }

  /**
   * 共享外壳的文案仍停留在“60 秒”时代；只在当前页面做运行时文案同步，
   * 不修改 shared/*。
   */
  function syncShellCopy() {
    const subtitle = document.querySelector('.brand-subtitle');
    if (subtitle) {
      subtitle.textContent = '先预测下一次中点，再用 7 根拆弹线锁定 1–100 中的密码。';
    }

    const pills = document.querySelectorAll('.top-meta .meta-pill');
    if (pills[0]) {
      pills[0].innerHTML = '<span class="meta-dot" aria-hidden="true"></span>1–100 · 7 根线';
    }
    if (pills[1]) {
      pills[1].textContent = '二分查找';
    }

    const currentDescription = document.querySelector('.switcher-item.is-current .switcher-item-description');
    if (currentDescription) {
      currentDescription.textContent = '用 7 根线从 1–100 中找出密码';
    }
  }

  // =========================================================
  // 路由 · 算法首页 → 固定关卡 / 自由探索
  // =========================================================

  function parsePlayRoute() {
    let params = null;

    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      params = null;
    }

    const requestedLevel = params ? params.get('level') : null;
    const levelId = LEVEL_IDS.indexOf(requestedLevel) >= 0 ? requestedLevel : null;
    const mode = params ? params.get('mode') : null;

    return {
      mode: levelId ? 'level' : 'custom',
      levelId,
      oracle: !levelId && mode === 'oracle',
      docs: Boolean(params && params.get('docs') === '1')
    };
  }

  function applyPlayRoute() {
    const isLevel = PLAY.mode === 'level';
    document.body.dataset.playMode = PLAY.mode;

    if (isLevel) {
      document.body.dataset.level = PLAY.levelId;
    } else {
      delete document.body.dataset.level;
    }

    if (dom.levelTabs) {
      dom.levelTabs.hidden = true;
      dom.levelTabs.setAttribute('aria-hidden', 'true');
    }

    if (dom.playBackLink) {
      dom.playBackLink.hidden = false;
      dom.playBackLink.textContent = isLevel ? '← 关卡选择' : '← 二分首页';
      dom.playBackLink.href = 'index.html';
    }

    if (isLevel) {
      setActiveLevel(PLAY.levelId);
      if (PLAY.levelId === 'duplicates') lockDuplicatesLevel();
      setRailTab('level');
      announce(`已进入「${LEVEL_META[PLAY.levelId].name}」关卡。`);
    } else {
      setRailTab('data');
      announce('已进入自由探索。随机 secret，随时开始拆弹。');
    }

    renderLevels();
    updateControls();
    refreshProgress();

    if (PLAY.oracle) {
      window.setTimeout(() => openOracleDialog(), 80);
    }

    if (PLAY.docs) {
      window.setTimeout(() => {
        if (ui.docsViewer && !ui.docsViewer.isOpen()) ui.docsViewer.open();
      }, 140);
    }
  }

  function lockDuplicatesLevel() {
    const view = ui.levels.duplicates;
    view.target = 2;
    view.mode = 'first';

    [dom.duplicatesTargetGroup, dom.duplicatesModeGroup].forEach((group) => {
      if (!group) return;
      group.querySelectorAll('button').forEach((button) => {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      });
    });

    resetDuplicatesWalkthrough();
  }

  // =========================================================
  // 关卡 · 掌握徽章
  // =========================================================

  function buildLevelQuizOptions() {
    fillQuizOptions(dom.exampleQuizOptions, EXAMPLE_QUIZ);
    fillQuizOptions(dom.midpointQuizOptions, MIDPOINT_QUIZ);
    fillQuizOptions(dom.boundaryQuizOptions, BOUNDARY_QUIZ);
    fillQuizOptions(dom.duplicatesQuizOptions, DUPLICATES_QUIZ);
    fillQuizOptions(dom.thresholdQuizOptions, THRESHOLD_QUIZ);

    dom.midpointQuizOptions.addEventListener('click', (event) => handleLevelQuizClick('midpoint', event));
    dom.boundaryQuizOptions.addEventListener('click', (event) => handleLevelQuizClick('boundary', event));
    dom.duplicatesQuizOptions.addEventListener('click', (event) => handleLevelQuizClick('duplicates', event));
    dom.thresholdQuizOptions.addEventListener('click', (event) => handleLevelQuizClick('threshold', event));
  }

  function fillQuizOptions(container, options) {
    if (!container) return;

    const fragment = document.createDocumentFragment();
    options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.index = String(index);
      button.textContent = option.text;
      fragment.appendChild(button);
    });
    container.appendChild(fragment);
  }

  function handleLevelTabClick(event) {
    const tab = event.target.closest('[data-level]');
    if (!tab || !dom.levelTabs.contains(tab)) return;
    setActiveLevel(tab.dataset.level);
    setRailTab('level');
  }

  function handleRailTabClick(event) {
    const tab = event.target.closest('[data-rail-tab]');
    if (!tab || !dom.railTabs.contains(tab)) return;
    setRailTab(tab.dataset.railTab);
  }

  function openTaskDetails() {
    setRailTab('level');

    if (!window.matchMedia('(max-width: 900px)').matches || !dom.railPaneLevel) return;
    dom.railPaneLevel.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  function setRailTab(tab) {
    const next = tab === 'level' ? 'level' : 'data';
    const isData = next === 'data';
    ui.railTab = next;

    [[dom.railTabData, isData], [dom.railTabLevel, !isData]].forEach(([button, active]) => {
      if (!button) return;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });

    if (dom.railPaneData) dom.railPaneData.hidden = !isData;
    if (dom.railPaneLevel) dom.railPaneLevel.hidden = isData;
  }

  function setActiveLevel(levelId) {
    if (!LEVEL_META[levelId] || ui.levels.active === levelId) return;

    if (ui.levels.active === 'invariant' && levelId !== 'invariant') {
      ui.levels.invariant.promptOpen = false;
      ui.levels.invariant.answered = false;
    }

    if (levelId !== 'duplicates') stopDuplicatesAuto();
    if (levelId !== 'threshold') stopThresholdAuto();

    ui.levels.active = levelId;

    if (levelId !== 'example' && ui.demo.auto) {
      ui.demo.auto = false;
      window.clearTimeout(ui.timers.demo);
    }

    renderLevels();
    announce(`已切换到「${LEVEL_META[levelId].name}」关卡。`);
  }

  function startExampleDemo() {
    const demo = ENGINE.simulateOptimal(62);

    startRound({ secret: 62, demo: true });

    ui.demo.events = demo.events;
    ui.demo.total = demo.events.length;
    ui.demo.index = 0;
    ui.demo.done = false;
    ui.demo.auto = false;
    ui.demo.active = true;

    setFeedback('neutral', `演示开始：secret = 62，最优二分共 ${demo.events.length} 步。点击「下一步」或「自动演示」。`);
    dom.bombLead.textContent = '示例关卡：密码固定为 62。观察 mid 如何把候选区间不断减半。';
    renderAll();

    window.requestAnimationFrame(() => {
      dom.exampleNext.focus({ preventScroll: true });
    });
  }

  function stepDemo() {
    if (!ui.demo.active || !ui.game || ui.game.status !== 'playing') return;

    window.clearTimeout(ui.timers.demo);

    const nextEvent = ui.demo.events[ui.demo.index];
    if (!nextEvent) {
      finishDemo();
      return;
    }

    const result = ENGINE.applyGuess(ui.game, nextEvent.mid);
    if (!result.ok) {
      finishDemo();
      return;
    }

    const eventData = result.event;
    ui.game = result.state;
    ui.events.push(eventData);
    ui.demo.index += 1;
    resetPredictionForRound();

    if (eventData.feedback === 'hit') {
      setFeedback('success', `第 ${ui.events.length} 步：mid = ${eventData.mid}，命中 62！`);
    } else {
      const direction = eventData.feedback === 'low' ? '太小 ↑' : '太大 ↓';
      setFeedback(eventData.feedback, `第 ${ui.events.length} 步：mid = ${eventData.mid} ${direction}，新区间 ${eventData.newLow}–${eventData.newHigh}。`);
    }
    dom.bombLead.textContent = `示例 secret = 62；已执行 ${ui.demo.index} / ${ui.demo.total} 步。`;

    renderAll();

    if (ui.game.status !== 'playing' || ui.demo.index >= ui.demo.events.length) {
      finishDemo();
    } else if (ui.demo.auto) {
      scheduleDemoStep();
    }
  }

  function finishDemo() {
    if (ui.demo.done) return;

    window.clearTimeout(ui.timers.demo);
    const completed = Boolean(ui.game && ui.game.status === 'defused');

    ui.demo.auto = false;
    ui.demo.active = false;
    ui.demo.done = true;

    if (completed) {
      setFeedback('success', `示例完成：secret = 62，按最优二分用 ${ui.events.length} 步锁定。`);
      dom.bombLead.textContent = '示例完成。切换到「7 根线」或「区间不变量」继续训练。';
      announce(`示例关卡完成，共 ${ui.events.length} 步，通过进度已记录。`);
      recordLevelResult('example', { passed: true });
    } else {
      setFeedback('neutral', '示例演示结束。');
      announce('示例演示结束。');
    }

    renderAll();
  }

  function toggleDemoAuto() {
    if (!ui.demo.active) return;

    ui.demo.auto = !ui.demo.auto;

    if (ui.demo.auto) {
      scheduleDemoStep();
      announce('自动演示开始。');
    } else {
      window.clearTimeout(ui.timers.demo);
      announce('自动演示已暂停。');
    }

    renderLevels();
  }

  function scheduleDemoStep() {
    window.clearTimeout(ui.timers.demo);
    ui.timers.demo = window.setTimeout(() => {
      if (!ui.demo.active || !ui.demo.auto) return;
      stepDemo();
    }, reduceMotion ? 320 : 950);
  }

  function renderExamplePanel() {
    if (!dom.exampleSteps) return;

    const total = ui.demo.total || ui.demo.events.length;
    dom.exampleProgress.textContent = `${ui.demo.index} / ${total} 步`;

    if (ui.demo.active) {
      dom.exampleNote.textContent = ui.demo.auto ? '自动演示中…' : '点击「下一步」逐步观察';
    } else if (ui.demo.done) {
      dom.exampleNote.textContent = '演示完成 · 进度已保存';
    } else {
      dom.exampleNote.textContent = '点击开始，逐步观察区间';
    }

    renderExampleSteps();
  }

  function renderExampleSteps() {
    dom.exampleSteps.replaceChildren();

    const visible = (ui.demo.active || ui.demo.done) && ui.events.length > 0;
    if (!visible) {
      const empty = document.createElement('li');
      empty.className = 'level-step-empty';
      empty.textContent = '尚未开始演示';
      dom.exampleSteps.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    ui.events.forEach((event, index) => {
      const item = document.createElement('li');
      item.className = 'level-step';
      if (event.feedback === 'hit') item.classList.add('is-hit');

      const number = document.createElement('span');
      number.className = 'level-step-no';
      number.textContent = `#${index + 1}`;

      const body = document.createElement('span');
      body.className = 'level-step-body';
      const mid = document.createElement('b');
      mid.textContent = `mid ${event.mid}`;
      const feedback = document.createElement('span');
      feedback.textContent = event.feedback === 'low'
        ? '太小 ↑'
        : event.feedback === 'high'
          ? '太大 ↓'
          : '命中 ✓';
      const range = document.createElement('span');
      range.className = 'level-step-range';
      range.textContent = event.feedback === 'hit'
        ? '已锁定'
        : `新区间 ${event.newLow}–${event.newHigh}`;

      body.append(mid, ' · ', feedback, ' · ', range);
      item.append(number, body);
      fragment.appendChild(item);
    });

    dom.exampleSteps.appendChild(fragment);
  }

  function showInvariantPrompt() {
    if (!ui.game || ui.game.status !== 'playing' || ui.demo.active) return;
    if (ui.levels.active !== 'invariant') return;

    ui.levels.invariant.promptOpen = true;
    ui.levels.invariant.answered = false;
    dom.invariantLow.value = '';
    dom.invariantHigh.value = '';
    setInvariantFeedback('neutral', `当前候选区间还剩 ${ui.game.high - ui.game.low + 1} 个数字，写出新的 low 与 high。`);
    renderLevels();
  }

  function handleInvariantKeydown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    checkInvariantRange();
  }

  function checkInvariantRange() {
    if (!ui.game || ui.game.status !== 'playing') {
      setInvariantFeedback('wrong', '本局已经结束，下一局再继续练习。');
      return;
    }

    if (ui.levels.invariant.answered) {
      setInvariantFeedback('neutral', '这个区间已经校验过了；再猜错一次会出现新题。');
      return;
    }

    const low = Number(dom.invariantLow.value);
    const high = Number(dom.invariantHigh.value);
    const expectedLow = ui.game.low;
    const expectedHigh = ui.game.high;

    if (dom.invariantLow.value === '' || dom.invariantHigh.value === '' || !Number.isInteger(low) || !Number.isInteger(high)) {
      setInvariantFeedback('wrong', '请输入两个整数：新的 low 和 high。');
      return;
    }

    if (low === expectedLow && high === expectedHigh) {
      const flags = mergeLevelFlags('invariant');
      ui.levels.invariant.answered = true;
      ui.levels.invariant.streak = Math.min(3, ui.levels.invariant.streak + 1);

      if (ui.levels.invariant.streak >= 3 && !flags.quizCorrect) {
        setInvariantFeedback('correct', `✓ 正确！新区间是 [${low}, ${high}]。连续 3 次正确，小测徽章点亮。`);
        recordLevelResult('invariant', { quizCorrect: true });
      } else {
        const shown = flags.quizCorrect ? 3 : ui.levels.invariant.streak;
        setInvariantFeedback('correct', `✓ 正确！新区间是 [${low}, ${high}]。连续 ${shown} / 3 次。`);
        renderLevels();
      }

      dom.invariantLow.value = '';
      dom.invariantHigh.value = '';
    } else {
      const flags = mergeLevelFlags('invariant');
      if (!flags.quizCorrect) ui.levels.invariant.streak = 0;
      setInvariantFeedback('wrong', `✗ 还不对。看上方状态面板：当前 low = ${expectedLow}，high = ${expectedHigh}。`);
      renderLevels();
    }
  }

  function setInvariantFeedback(tone, text) {
    dom.invariantFeedback.dataset.tone = tone;
    dom.invariantFeedback.textContent = text;
  }

  function runBoundaryBug() {
    let result = null;

    try {
      result = ENGINE.runBuggySearch(51, { bug: 'low-mid', maxSteps: 16 });
    } catch {
      setQuizFeedback('boundary', 'wrong', '运行失败，请刷新页面后重试。');
      return;
    }

    ui.levels.boundary.result = result;
    renderBoundaryResult(result);
    renderLevels();

    if (!mergeLevelFlags('boundary').quizCorrect) {
      setQuizFeedback('boundary', 'neutral', result.loopDetected
        ? '已复现死循环。哪一行让它停不下来？'
        : '运行结束，未检测到重复区间。');
    }

    if (result.loopDetected) {
      recordLevelResult('boundary', { passed: true });
      announce(`已复现死循环，重复区间是 ${result.repeatedState.low} 到 ${result.repeatedState.high}。`);
    }
  }

  function renderBoundaryResult(result) {
    dom.boundarySteps.replaceChildren();

    const repeated = result.repeatedState;
    if (result.loopDetected && repeated) {
      const lastStep = result.steps[result.steps.length - 1];
      dom.boundarySummary.textContent = `检测到死循环：区间 [${repeated.low}, ${repeated.high}] 再次出现，mid 停在 ${lastStep ? lastStep.mid : '—'}，low 不再前进。`;
    } else if (result.solved) {
      dom.boundarySummary.textContent = `运行结束：已命中 secret，未触发死循环。`;
    } else {
      dom.boundarySummary.textContent = `运行了 ${result.maxSteps} 步仍未结束，但没有捕获到重复状态。`;
    }

    const fragment = document.createDocumentFragment();
    result.steps.forEach((step, index) => {
      const item = document.createElement('li');
      item.className = 'level-step';

      const repeats = Boolean(repeated && step.low === repeated.low && step.high === repeated.high);
      const leadsToRepeat = Boolean(repeated && step.newLow === repeated.low && step.newHigh === repeated.high);
      if (repeats || leadsToRepeat) item.classList.add('is-repeat');

      const number = document.createElement('span');
      number.className = 'level-step-no';
      number.textContent = `#${index + 1}`;

      const body = document.createElement('span');
      body.className = 'level-step-body';
      const range = document.createElement('b');
      range.textContent = `[${step.low}, ${step.high}]`;
      const mid = document.createElement('span');
      mid.textContent = ` mid ${step.mid} · `;
      const feedback = document.createElement('span');
      feedback.textContent = step.feedback === 'low' ? '太小 ↑' : step.feedback === 'high' ? '太大 ↓' : '命中 ✓';
      const nextRange = document.createElement('span');
      nextRange.className = 'level-step-range';
      nextRange.textContent = ` → [${step.newLow}, ${step.newHigh}]`;

      body.append(range, mid, feedback, nextRange);

      if (repeats) {
        const flag = document.createElement('span');
        flag.className = 'level-step-flag';
        flag.textContent = '重复';
        body.appendChild(flag);
      }

      item.append(number, body);
      fragment.appendChild(item);
    });

    dom.boundarySteps.appendChild(fragment);
  }

  function handleLevelQuizClick(levelId, event) {
    const button = event.target.closest('.quiz-option');
    if (!button || button.disabled) return;

    const config = getQuizConfig(levelId);
    if (!config || !config.container || !config.container.contains(button)) return;

    const flags = mergeLevelFlags(levelId);

    if (PLAY.mode === 'level' && !flags.passed && !flags.quizCorrect) {
      setQuizFeedback(levelId, 'neutral', '先完成本关目标，再解锁小测。');
      return;
    }

    if ((levelId === 'duplicates' || levelId === 'threshold')
      && getWalkthroughStatus(levelId) !== 'done'
      && !flags.quizCorrect) {
      setQuizFeedback(levelId, 'neutral', '先走完一遍演示，再作答。');
      return;
    }

    const option = config.options[Number(button.dataset.index)];
    if (!option) return;

    if (option.correct) {
      config.container.dataset.solved = 'true';
      config.container.querySelectorAll('.quiz-option').forEach((item) => {
        item.disabled = true;
        item.classList.toggle('is-correct', item === button);
      });
      setQuizFeedback(levelId, 'correct', `✓ 正确。${option.explain || ''}`);
      recordLevelResult(levelId, { quizCorrect: true });
    } else {
      button.classList.add('is-wrong');
      window.setTimeout(() => {
        if (button.isConnected) button.classList.remove('is-wrong');
      }, 800);
      setQuizFeedback(levelId, 'wrong', `✗ 再想想。${option.hint || ''}`);
    }
  }

  function getQuizConfig(levelId) {
    const configs = {
      example: { container: dom.exampleQuizOptions, options: EXAMPLE_QUIZ, feedback: dom.exampleQuizFeedback },
      midpoint: { container: dom.midpointQuizOptions, options: MIDPOINT_QUIZ, feedback: dom.midpointQuizFeedback },
      boundary: { container: dom.boundaryQuizOptions, options: BOUNDARY_QUIZ, feedback: dom.boundaryQuizFeedback },
      duplicates: { container: dom.duplicatesQuizOptions, options: DUPLICATES_QUIZ, feedback: dom.duplicatesQuizFeedback },
      threshold: { container: dom.thresholdQuizOptions, options: THRESHOLD_QUIZ, feedback: dom.thresholdQuizFeedback }
    };
    return configs[levelId] || null;
  }

  function setQuizFeedback(levelId, tone, text) {
    const config = getQuizConfig(levelId);
    const element = config && config.feedback;
    if (!element) return;
    element.dataset.tone = tone;
    element.textContent = text;
  }

  function syncQuizSolvedState() {
    LEVEL_IDS.forEach((levelId) => {
      const config = getQuizConfig(levelId);
      if (!config || !config.container) return;
      const solved = mergeLevelFlags(levelId).quizCorrect;
      if (!solved) return;

      config.container.querySelectorAll('.quiz-option').forEach((button, index) => {
        button.disabled = true;
        if (config.options[index] && config.options[index].correct) button.classList.add('is-correct');
      });

      if (config.container.dataset.solved !== 'true') {
        config.container.dataset.solved = 'true';
        setQuizFeedback(levelId, 'correct', '✓ 小测已通过，记录已保存在本地。');
      }
    });
  }

  function isQuizLocked(levelId) {
    const flags = mergeLevelFlags(levelId);
    if (flags.quizCorrect) return false;
    if (PLAY.mode === 'level' && !flags.passed) return true;
    return (levelId === 'duplicates' || levelId === 'threshold')
      && getWalkthroughStatus(levelId) !== 'done';
  }

  function syncQuizGate(levelId) {
    const config = getQuizConfig(levelId);
    if (!config || !config.container) return;

    const flags = mergeLevelFlags(levelId);
    if (flags.quizCorrect) {
      config.container.classList.remove('is-locked');
      return;
    }

    const locked = isQuizLocked(levelId);
    config.container.classList.toggle('is-locked', locked);
    config.container.querySelectorAll('.quiz-option').forEach((button) => {
      button.disabled = locked;
    });

    const wasLocked = config.container.dataset.locked === 'true';
    config.container.dataset.locked = String(locked);

    if (locked !== wasLocked) {
      if (locked) {
        setQuizFeedback(levelId, 'neutral', '先完成本关目标，再解锁小测。');
      } else if (flags.passed) {
        setQuizFeedback(levelId, 'neutral', '目标完成，可以作答了。');
      }
    }
  }

  function syncQuizGates() {
    LEVEL_IDS.forEach((levelId) => syncQuizGate(levelId));
  }

  function readLevelRecord(levelId) {
    try {
      if (!window.ProgressStore) return null;
      return window.ProgressStore.getLevels('binary')[levelId] || null;
    } catch {
      return null;
    }
  }

  function mergeLevelFlags(levelId) {
    const stored = readLevelRecord(levelId);
    const session = ui.levels.session[levelId];
    return {
      passed: Boolean((stored && stored.passed) || session.passed),
      quizCorrect: Boolean((stored && stored.quizCorrect) || session.quizCorrect)
    };
  }

  function isLevelMastered(levelId, flags) {
    return Boolean(flags.passed && flags.quizCorrect);
  }

  function recordLevelResult(levelId, patch = {}) {
    const session = ui.levels.session[levelId];
    const current = mergeLevelFlags(levelId);
    const next = {
      passed: current.passed || patch.passed === true,
      quizCorrect: current.quizCorrect || patch.quizCorrect === true
    };

    const newlyPassed = next.passed && !current.passed;
    const newlyQuiz = next.quizCorrect && !current.quizCorrect;

    session.passed = next.passed;
    session.quizCorrect = next.quizCorrect;

    if (newlyPassed || newlyQuiz) {
      try {
        if (window.ProgressStore) {
          window.ProgressStore.recordLevel('binary', levelId, next);
        }
      } catch {
        // 本地存储不可用时，本局内仍然保留进度状态。
      }

      const label = LEVEL_META[levelId].name;
      showToast(`${label} · 进度已保存`, 'success');
      announce(`${label}关卡进度已保存。`);
    }

    renderLevels();
  }

  function renderLevels() {
    if (!dom.levelTabs) return;

    const active = ui.levels.active;
    let masteredCount = 0;

    LEVEL_IDS.forEach((levelId) => {
      const flags = mergeLevelFlags(levelId);
      const mastered = isLevelMastered(levelId, flags);
      if (mastered) masteredCount += 1;

      const tab = Array.from(dom.levelTabs.querySelectorAll('[data-level]'))
        .find((item) => item.dataset.level === levelId);
      if (!tab) return;

      tab.classList.toggle('is-active', levelId === active);
      tab.classList.toggle('is-mastered', mastered);
      tab.classList.toggle('is-passed', flags.passed && !mastered);
      tab.setAttribute('aria-selected', levelId === active ? 'true' : 'false');

      const badge = tab.querySelector('.level-badge');
      if (badge) {
        badge.textContent = mastered ? '已掌握' : flags.passed ? '已通过' : flags.quizCorrect ? '小测 ✓' : '未开始';
        badge.dataset.state = mastered ? 'mastered' : flags.passed ? 'passed' : flags.quizCorrect ? 'quiz' : 'idle';
      }
    });

    const levelNumber = String(LEVEL_IDS.indexOf(active) + 1).padStart(2, '0');

    if (PLAY.mode === 'level') {
      if (dom.playModeKicker) dom.playModeKicker.textContent = `LEVEL ${levelNumber} · ${active.toUpperCase()}`;
      if (dom.levelTitle) dom.levelTitle.textContent = `关卡 ${levelNumber} · ${LEVEL_META[active].name}`;
      dom.levelGoal.textContent = LEVEL_META[active].goal;
    } else {
      if (dom.playModeKicker) {
        dom.playModeKicker.textContent = PLAY.oracle ? 'ROLE REVERSAL · YOU SET THE SECRET' : 'CUSTOM · FREE PLAY';
      }
      if (dom.levelTitle) dom.levelTitle.textContent = PLAY.oracle ? '角色反转 · 你当出题人' : '自由探索 · 完整驾驶舱';
      dom.levelGoal.textContent = '随机 secret，自由练习预测、拆弹与历史复盘；随时打开角色反转或源码解析。';
    }

    dom.levelMastery.textContent = `${masteredCount} / ${LEVEL_IDS.length} 掌握`;
    dom.levelMastery.title = `已掌握 ${masteredCount} / ${LEVEL_IDS.length} 个关卡`;

    const activeFlags = mergeLevelFlags(active);
    const activeMastered = isLevelMastered(active, activeFlags);

    dom.levelStatus.textContent = activeMastered ? '已掌握' : activeFlags.passed ? '待小测' : '未通过';
    dom.levelStatus.dataset.tone = activeMastered ? 'mastered' : activeFlags.passed ? 'passed' : 'neutral';

    if (active === 'example') {
      dom.levelQuizStatus.textContent = activeFlags.quizCorrect ? '小测 ✓' : activeFlags.passed ? '小测待完成' : '完成演示即可';
      dom.levelQuizStatus.dataset.tone = activeFlags.quizCorrect ? 'passed' : 'neutral';
    } else {
      dom.levelQuizStatus.textContent = activeFlags.quizCorrect ? '小测 ✓' : '小测待完成';
      dom.levelQuizStatus.dataset.tone = activeFlags.quizCorrect ? 'passed' : 'neutral';
    }

    document.querySelectorAll('.level-panel').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== active;
    });

    renderExamplePanel();
    renderInvariantPanel();
    renderBoundaryPanel();
    renderDuplicatesPanel();
    renderThresholdPanel();
    syncQuizSolvedState();
    syncQuizGates();
    updateLevelActions();
    renderLevelCompletion();
  }

  function renderLevelCompletion() {
    if (!dom.levelCompletion) return;

    if (PLAY.mode !== 'level') {
      dom.levelCompletion.hidden = true;
      return;
    }

    const levelId = PLAY.levelId || ui.levels.active;
    const flags = mergeLevelFlags(levelId);
    const mastered = isLevelMastered(levelId, flags);
    const visible = flags.passed || flags.quizCorrect;

    dom.levelCompletion.hidden = !visible;
    if (!visible) return;

    dom.levelCompletion.dataset.state = mastered ? 'mastered' : flags.passed ? 'passed' : 'quiz';

    if (mastered) {
      const nextId = LEVEL_NEXT[levelId];
      dom.levelCompletionTitle.textContent = '已掌握';
      dom.levelCompletionText.textContent = `《${LEVEL_META[levelId].name}》已完成，进度已保存。`;
      dom.levelQuizJump.hidden = true;
      dom.levelNextLink.hidden = false;
      dom.levelNextLink.href = nextId ? `play.html?level=${nextId}` : 'index.html';
      dom.levelNextLink.textContent = nextId ? '已掌握 · 下一关 →' : '已掌握 · 返回关卡选择 →';
      dom.levelCompletionBack.hidden = false;
    } else if (flags.passed) {
      dom.levelCompletionTitle.textContent = '目标完成';
      dom.levelCompletionText.textContent = levelId === 'invariant'
        ? '目标已保存；再完成 3 次区间校验，点亮掌握徽章。'
        : '去答关卡内小测，点亮掌握徽章。';
      dom.levelQuizJump.hidden = false;
      dom.levelQuizJump.textContent = '目标完成 · 去答小测';
      dom.levelNextLink.hidden = true;
      dom.levelCompletionBack.hidden = false;
    } else {
      dom.levelCompletionTitle.textContent = '小测通过';
      dom.levelCompletionText.textContent = '完成本关目标后即可进入下一关。';
      dom.levelQuizJump.hidden = true;
      dom.levelNextLink.hidden = true;
      dom.levelCompletionBack.hidden = false;
    }
  }

  function jumpToLevelQuiz() {
    const levelId = PLAY.mode === 'level' ? PLAY.levelId : ui.levels.active;
    let target = null;

    if (levelId === 'invariant') {
      target = dom.invariantHint;
    } else {
      const config = getQuizConfig(levelId);
      target = config && config.container;
    }

    setRailTab('level');

    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center'
      });

      const focusTarget = levelId === 'invariant'
        ? dom.invariantStart
        : target.querySelector('.quiz-option:not(:disabled)');
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
    });
  }

  function renderInvariantPanel() {
    const flags = mergeLevelFlags('invariant');
    const playing = Boolean(ui.game) && ui.game.status === 'playing' && !ui.demo.active;

    if (!playing) {
      ui.levels.invariant.promptOpen = false;
      ui.levels.invariant.answered = false;
    }

    const streak = flags.quizCorrect ? 3 : Math.min(3, ui.levels.invariant.streak);
    dom.invariantStreak.textContent = `连续 ${streak} / 3`;
    dom.invariantStreak.classList.toggle('is-complete', flags.quizCorrect);
    dom.invariantPrompt.hidden = !(ui.levels.invariant.promptOpen && ui.levels.active === 'invariant' && playing);

    if (flags.quizCorrect) {
      dom.invariantHint.textContent = '小测已达标。继续练习也可以，本局结束后记录通过。';
    } else if (playing) {
      dom.invariantHint.textContent = '等待一次合法错误猜测；开始新一局会隐藏当前校验。';
    } else {
      dom.invariantHint.textContent = '开始一局，再故意猜错一次，就会出现新区间校验。';
    }
  }

  function renderBoundaryPanel() {
    const hasResult = Boolean(ui.levels.boundary.result);
    dom.boundaryOutput.hidden = !hasResult;
    dom.boundaryRun.textContent = hasResult ? '重新运行' : '运行到卡住';

    const bugLine = document.querySelector('.buggy-line[data-bug-line]');
    if (bugLine) {
      bugLine.classList.toggle('is-revealed', mergeLevelFlags('boundary').quizCorrect);
    }
  }

  // =========================================================
  // 关卡 05 · 重复元素（先找位置，再揭晓 lower_bound / upper_bound）
  // =========================================================

  function handleDuplicatesSetupClick(event) {
    const targetButton = event.target.closest('[data-bound-target]');
    const modeButton = event.target.closest('[data-bound-mode]');
    if (!targetButton && !modeButton) return;
    if (PLAY.mode === 'level' && PLAY.levelId === 'duplicates') return;

    const view = ui.levels.duplicates;
    if (targetButton) view.target = Number(targetButton.dataset.boundTarget);
    if (modeButton) view.mode = modeButton.dataset.boundMode === 'last' ? 'last' : 'first';

    resetDuplicatesWalkthrough();
  }

  function resetDuplicatesWalkthrough() {
    const view = ui.levels.duplicates;
    stopDuplicatesAuto();
    view.state = ENGINE.createBoundState(DUPLICATE_VALUES.slice(), view.target, view.mode);

    if (!mergeLevelFlags('duplicates').quizCorrect) {
      setQuizFeedback('duplicates', 'neutral', '先走完一遍，再作答。');
    }

    renderLevels();
    announce(`已重置为「${duplicatesPlainLabel(view)}」。`);
  }

  function stepDuplicates(auto = false) {
    const view = ui.levels.duplicates;
    const state = view.state;
    if (!state) return;

    if (state.status === 'done') {
      stopDuplicatesAuto();
      renderLevels();
      return;
    }

    if (!auto) stopDuplicatesAuto();

    const result = ENGINE.stepBound(state);
    view.state = result.state;

    if (result.done) {
      stopDuplicatesAuto();
      if (!mergeLevelFlags('duplicates').quizCorrect) {
        setQuizFeedback('duplicates', 'neutral', '走完一遍了，现在可以作答。');
      }
      if (result.state.found) {
        recordLevelResult('duplicates', { passed: true });
      } else {
        renderLevels();
      }
      announce(result.state.found
        ? `完成：${duplicatesPlainLabel(view)}，结果下标是 ${result.state.index}。`
        : `演示完成：没有找到 ${view.target}。`);
      return;
    }

    if (auto && view.auto) scheduleDuplicatesStep();
    renderLevels();
  }

  function toggleDuplicatesAuto() {
    const view = ui.levels.duplicates;
    if (!view.state || view.state.status === 'done') return;

    view.auto = !view.auto;

    if (view.auto) {
      scheduleDuplicatesStep();
      announce('重复元素 · 测试运行中。');
    } else {
      window.clearTimeout(ui.timers.duplicates);
      announce('重复元素 · 测试已暂停。');
    }

    renderLevels();
  }

  function scheduleDuplicatesStep() {
    window.clearTimeout(ui.timers.duplicates);
    ui.timers.duplicates = window.setTimeout(() => {
      if (!ui.levels.duplicates.auto) return;
      stepDuplicates(true);
    }, reduceMotion ? 300 : 900);
  }

  function stopDuplicatesAuto() {
    ui.levels.duplicates.auto = false;
    window.clearTimeout(ui.timers.duplicates);
  }

  function duplicatesPlainLabel(view = ui.levels.duplicates) {
    return `${view.mode === 'first' ? '找第一个' : '找最后一个'} ${view.target}`;
  }

  function renderDuplicatesPanel() {
    if (!dom.duplicatesArray) return;

    const view = ui.levels.duplicates;
    const state = view.state;
    if (!state) return;

    const done = state.status === 'done';
    const compareEvents = state.events.filter((event) => event.type === 'compare');

    dom.duplicatesTitle.textContent = duplicatesPlainLabel(view);
    dom.duplicatesQuizPrompt.textContent = `小测：命中 ${view.target} 后，为什么还要继续收缩区间？`;

    dom.duplicatesTargetGroup.querySelectorAll('[data-bound-target]').forEach((button) => {
      const active = Number(button.dataset.boundTarget) === view.target;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    dom.duplicatesModeGroup.querySelectorAll('[data-bound-mode]').forEach((button) => {
      const active = button.dataset.boundMode === view.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    renderBoundArray(state);

    dom.duplicatesState.textContent = done
      ? `low = ${state.low} · high = ${state.high} · 结果下标 = ${state.index}`
      : `low = ${state.low} · high = ${state.high} · mid = ${state.mid === null ? '—' : state.mid}`;

    dom.duplicatesDecision.textContent = duplicatesDecisionText(state, view);
    renderWalkthroughSteps(dom.duplicatesSteps, compareEvents, renderDuplicatesStepBody, '还没有比较');
    dom.duplicatesProgress.textContent = `${compareEvents.length} 步`;

    dom.duplicatesNext.disabled = done;
    dom.duplicatesNext.textContent = done ? '已完成' : '下一步';
    dom.duplicatesAuto.disabled = done;
    dom.duplicatesAuto.textContent = view.auto ? '暂停' : '运行测试';

    dom.duplicatesResult.hidden = !done;
    dom.duplicatesReveal.hidden = !done;

    if (done) {
      if (state.found) {
        dom.duplicatesResultText.textContent = view.mode === 'last'
          ? `找到最后一个 ${view.target}：下标 ${state.index}。upper_bound − 1 = ${state.index}。`
          : `找到第一个 ${view.target}：下标 ${state.index}。`;
        dom.duplicatesReveal.textContent = view.mode === 'last'
          ? `技术名：upper_bound 是第一个 > ${view.target} 的位置 = ${state.low}；最后一个目标 = upper_bound − 1 = ${state.index}。`
          : `技术名：lower_bound 是第一个 ≥ ${view.target} 的位置，结果下标 = ${state.index}。`;
      } else {
        dom.duplicatesResultText.textContent = `没有找到 ${view.target}。`;
        dom.duplicatesReveal.textContent = `技术名：lower_bound 与 upper_bound 会落在同一个插入位置，区间为空。`;
      }
    } else {
      dom.duplicatesResultText.textContent = '';
      dom.duplicatesReveal.textContent = '';
    }

    syncWalkthroughQuizGate('duplicates', done);
  }

  function duplicatesDecisionText(state, view) {
    if (state.status === 'done') {
      if (!state.found) return `完成：数组里没有 ${view.target}。`;
      return view.mode === 'last'
        ? `完成：最后一个 ${view.target} 在索引 ${state.index}（upper_bound − 1）。`
        : `完成：第一个 ${view.target} 在索引 ${state.index}。`;
    }

    if (state.status === 'ready') {
      const mid = ENGINE.nextMid(state.low, state.high);
      return `目标：${duplicatesPlainLabel(view)}。下一次 mid = ${mid}，点击「下一步」比较 a[${mid}]。`;
    }

    const event = state.events.filter((item) => item.type === 'compare').pop();
    if (!event) return '点击「下一步」，比较一次 mid。';

    const compare = view.mode === 'first'
      ? (event.value < state.target ? `a[${event.mid}] = ${event.value} < ${state.target}` : `a[${event.mid}] = ${event.value} ≥ ${state.target}`)
      : (event.value <= state.target ? `a[${event.mid}] = ${event.value} ≤ ${state.target}` : `a[${event.mid}] = ${event.value} > ${state.target}`);
    const decision = event.decision === 'right'
      ? `low = mid + 1 = ${event.newLow}`
      : `high = mid = ${event.newHigh}`;

    return `${compare} → ${decision} · 新区间 [${event.newLow}, ${event.newHigh}]`;
  }

  function renderBoundArray(state) {
    dom.duplicatesArray.replaceChildren();

    const fragment = document.createDocumentFragment();
    state.values.forEach((value, index) => {
      const cell = document.createElement('div');
      cell.className = 'bound-cell';
      const inRange = index >= state.low && index <= state.high;
      const done = state.status === 'done';

      cell.classList.toggle('is-in-range', inRange && !done);
      cell.classList.toggle('is-out', !inRange || done);
      if (done) {
        if (index === state.index) cell.classList.add('is-answer');
      } else if (index === state.mid) {
        cell.classList.add('is-mid');
      }

      const valueNode = document.createElement('strong');
      valueNode.textContent = String(value);
      const indexNode = document.createElement('small');
      indexNode.textContent = String(index);
      cell.append(valueNode, indexNode);

      const tags = [];
      if (done) {
        if (index === state.index) tags.push({ label: '结果', tone: 'answer' });
      } else {
        if (index === state.low) tags.push({ label: 'low', tone: 'low' });
        if (index === state.high) tags.push({ label: 'high', tone: 'high' });
        if (index === state.mid) tags.push({ label: 'mid', tone: 'mid' });
      }

      if (tags.length) {
        const tagWrap = document.createElement('span');
        tagWrap.className = 'bound-cell-tags';
        tags.forEach((tag) => {
          const tagNode = document.createElement('span');
          tagNode.className = `bound-cell-tag is-${tag.tone}`;
          tagNode.textContent = tag.label;
          tagWrap.appendChild(tagNode);
        });
        cell.appendChild(tagWrap);
      }

      cell.setAttribute('aria-label', `下标 ${index}，值 ${value}${tags.length ? `，${tags.map((tag) => tag.label).join('、')}` : ''}`);
      fragment.appendChild(cell);
    });

    dom.duplicatesArray.appendChild(fragment);
  }

  function renderDuplicatesStepBody(body, event) {
    const mid = document.createElement('b');
    mid.textContent = `mid ${event.mid}`;
    const compare = document.createElement('span');
    compare.textContent = ui.levels.duplicates.mode === 'first'
      ? ` · a[${event.mid}] = ${event.value} ${event.value < ui.levels.duplicates.target ? '<' : '≥'} ${ui.levels.duplicates.target}`
      : ` · a[${event.mid}] = ${event.value} ${event.value <= ui.levels.duplicates.target ? '≤' : '>'} ${ui.levels.duplicates.target}`;
    const decision = document.createElement('span');
    decision.className = 'walkthrough-inline-decision';
    decision.textContent = event.decision === 'right'
      ? ` → low = mid + 1 = ${event.newLow}`
      : ` → high = mid = ${event.newHigh}`;
    const range = document.createElement('span');
    range.className = 'level-step-range';
    range.textContent = ` · [${event.newLow}, ${event.newHigh}]`;

    body.append(mid, compare, decision, range);
  }

  // =========================================================
  // 关卡 06 · 最小电量（先体验单调谓词，再揭晓二分答案）
  // =========================================================

  function resetThresholdWalkthrough() {
    const view = ui.levels.threshold;
    stopThresholdAuto();
    view.state = ENGINE.createPredicateState(THRESHOLD_CONFIG);

    if (!mergeLevelFlags('threshold').quizCorrect) {
      setQuizFeedback('threshold', 'neutral', '先走完一遍，再作答。');
    }

    renderLevels();
    announce('已重置最小电量演示。');
  }

  function stepThreshold(auto = false) {
    const view = ui.levels.threshold;
    const state = view.state;
    if (!state) return;

    if (state.status === 'done') {
      stopThresholdAuto();
      renderLevels();
      return;
    }

    if (!auto) stopThresholdAuto();

    const result = ENGINE.stepPredicate(state);
    view.state = result.state;

    if (result.done) {
      stopThresholdAuto();
      if (!mergeLevelFlags('threshold').quizCorrect) {
        setQuizFeedback('threshold', 'neutral', '走完一遍了，现在可以作答。');
      }
      recordLevelResult('threshold', { passed: true });
      announce(`完成：最小可用容量是 ${result.state.answer}。`);
      return;
    }

    if (auto && view.auto) scheduleThresholdStep();
    renderLevels();
  }

  function toggleThresholdAuto() {
    const view = ui.levels.threshold;
    if (!view.state || view.state.status === 'done') return;

    view.auto = !view.auto;

    if (view.auto) {
      scheduleThresholdStep();
      announce('最小电量 · 测试运行中。');
    } else {
      window.clearTimeout(ui.timers.threshold);
      announce('最小电量 · 测试已暂停。');
    }

    renderLevels();
  }

  function scheduleThresholdStep() {
    window.clearTimeout(ui.timers.threshold);
    ui.timers.threshold = window.setTimeout(() => {
      if (!ui.levels.threshold.auto) return;
      stepThreshold(true);
    }, reduceMotion ? 300 : 900);
  }

  function stopThresholdAuto() {
    ui.levels.threshold.auto = false;
    window.clearTimeout(ui.timers.threshold);
  }

  function renderThresholdPanel() {
    if (!dom.thresholdQuestion) return;

    const view = ui.levels.threshold;
    const state = view.state;
    if (!state) return;

    const done = state.status === 'done';
    const tests = state.events.filter((event) => event.type === 'test');
    const last = tests[tests.length - 1];

    dom.thresholdLow.textContent = String(state.low);
    dom.thresholdHigh.textContent = String(state.high);
    dom.thresholdMid.textContent = done || state.mid === null ? '—' : String(state.mid);

    if (done) {
      dom.thresholdQuestion.textContent = `最小可用容量 = ${state.answer}`;
      dom.thresholdAnswer.textContent = '已找到';
      dom.thresholdAnswer.dataset.tone = 'pass';
      dom.thresholdAsk.dataset.tone = 'pass';
      dom.thresholdDecision.textContent = `区间收敛到 low = high = ${state.answer}，这就是最小可用容量。`;
    } else if (last) {
      dom.thresholdQuestion.textContent = `容量 ${last.mid} 能撑过 8 小时吗？`;
      dom.thresholdAnswer.textContent = last.passes ? '能 ✓' : '不能 ✗';
      dom.thresholdAnswer.dataset.tone = last.passes ? 'pass' : 'fail';
      dom.thresholdAsk.dataset.tone = last.passes ? 'pass' : 'fail';
      dom.thresholdDecision.textContent = last.passes
        ? `能撑过 ✓ → high = mid = ${last.newHigh}，保留更小的可行容量 · 新区间 [${last.newLow}, ${last.newHigh}]`
        : `撑不过 ✗ → low = mid + 1 = ${last.newLow}，排除这个容量及更小的 · 新区间 [${last.newLow}, ${last.newHigh}]`;
    } else {
      dom.thresholdQuestion.textContent = '容量 ? 能撑过 8 小时吗？';
      dom.thresholdAnswer.textContent = '待询问';
      dom.thresholdAnswer.dataset.tone = 'idle';
      dom.thresholdAsk.dataset.tone = 'idle';
      dom.thresholdDecision.textContent = '点击「下一步」，问一次中点容量。';
    }

    renderWalkthroughSteps(dom.thresholdSteps, tests, renderThresholdStepBody, '还没有询问');
    dom.thresholdProgress.textContent = `${tests.length} 次询问`;

    dom.thresholdNext.disabled = done;
    dom.thresholdNext.textContent = done ? '已完成' : '下一步';
    dom.thresholdAuto.disabled = done;
    dom.thresholdAuto.textContent = view.auto ? '暂停' : '运行测试';

    dom.thresholdResult.hidden = !done;
    dom.thresholdReveal.hidden = !done;

    if (done) {
      dom.thresholdResultText.textContent = `最小可用容量 = ${state.answer}`;
      dom.thresholdReveal.textContent = '为什么能二分？因为“容量越大越容易撑过 8 小时”是单调的 → 单调谓词 → 二分答案。';
    } else {
      dom.thresholdResultText.textContent = '';
      dom.thresholdReveal.textContent = '';
    }

    syncWalkthroughQuizGate('threshold', done);
  }

  function renderThresholdStepBody(body, event) {
    const mid = document.createElement('b');
    mid.textContent = `x ${event.mid}`;
    const compare = document.createElement('span');
    compare.textContent = ' · 能撑过 8 小时？';
    const answer = document.createElement('span');
    answer.className = `walkthrough-answer is-${event.passes ? 'pass' : 'fail'}`;
    answer.textContent = event.passes ? '能 ✓' : '不能 ✗';
    const decision = document.createElement('span');
    decision.className = 'walkthrough-inline-decision';
    decision.textContent = event.passes
      ? ` → high = mid = ${event.newHigh}`
      : ` → low = mid + 1 = ${event.newLow}`;
    const range = document.createElement('span');
    range.className = 'level-step-range';
    range.textContent = ` · [${event.newLow}, ${event.newHigh}]`;

    body.append(mid, compare, answer, decision, range);
  }

  // =========================================================
  // 通用步进渲染与小测门控
  // =========================================================

  function renderWalkthroughSteps(list, events, bodyBuilder, emptyText) {
    if (!list) return;

    list.replaceChildren();
    if (!events.length) {
      const empty = document.createElement('li');
      empty.className = 'level-step-empty';
      empty.textContent = emptyText;
      list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    events.forEach((event, index) => {
      const item = document.createElement('li');
      item.className = 'level-step';
      if (event.passes === true) item.classList.add('is-pass');
      if (event.passes === false) item.classList.add('is-fail');

      const number = document.createElement('span');
      number.className = 'level-step-no';
      number.textContent = `#${index + 1}`;

      const body = document.createElement('span');
      body.className = 'level-step-body';
      bodyBuilder(body, event);

      item.append(number, body);
      fragment.appendChild(item);
    });

    list.appendChild(fragment);
    list.scrollTop = list.scrollHeight;
  }

  function getWalkthroughStatus(levelId) {
    const view = levelId === 'duplicates' ? ui.levels.duplicates : ui.levels.threshold;
    return view.state ? view.state.status : 'ready';
  }

  function syncWalkthroughQuizGate(levelId, done) {
    syncQuizGate(levelId);
  }

  function updateLevelActions() {
    const playing = Boolean(ui.game) && ui.game.status === 'playing';
    const demoPlaying = playing && ui.demo.active;

    dom.exampleStart.disabled = demoPlaying;
    dom.exampleStart.textContent = demoPlaying ? '演示中…' : ui.demo.done ? '重新演示' : '开始演示';
    dom.exampleNext.disabled = !demoPlaying || ui.demo.index >= ui.demo.events.length;
    dom.exampleAuto.disabled = !demoPlaying;
    dom.exampleAuto.textContent = ui.demo.auto ? '暂停自动' : '自动演示';

    dom.midpointStart.disabled = playing && !demoPlaying;
    dom.midpointStart.textContent = demoPlaying ? '结束演示并开局' : playing ? '本局进行中' : '开始一局';

    dom.invariantStart.disabled = playing && !demoPlaying;
    dom.invariantStart.textContent = demoPlaying ? '结束演示并开局' : playing ? '本局进行中' : '开始一局';
  }

  function handleLevelGuess(eventData, state) {
    if (ui.demo.active) return;

    if (state.status !== 'playing') {
      ui.levels.invariant.promptOpen = false;
      ui.levels.invariant.answered = false;

      if (state.status === 'defused' && ui.levels.active === 'midpoint') {
        recordLevelResult('midpoint', { passed: true });
        if (!mergeLevelFlags('midpoint').quizCorrect) {
          setQuizFeedback('midpoint', 'correct', '拆弹成功！再答对小测即可点亮掌握徽章。');
        }
      }

      if (ui.levels.active === 'invariant') {
        recordLevelResult('invariant', { passed: true });
      }

      renderLevels();
      return;
    }

    if (ui.levels.active === 'invariant' && eventData && eventData.feedback !== 'hit') {
      showInvariantPrompt();
    }
  }

  // =========================================================
  // 回合流程
  // =========================================================

  function getActiveFixedSecret() {
    if (PLAY.mode !== 'level') return null;
    const secret = LEVEL_FIXED_SECRET[PLAY.levelId];
    return Number.isInteger(secret) ? secret : null;
  }

  function handleStartBombClick() {
    if (PLAY.mode === 'level' && ui.levels.active === 'example') {
      startExampleDemo();
      return;
    }

    startRound();
  }

  function startRound(options) {
    const demoMode = Boolean(options && options.demo === true);
    const requestedSecret = options && Number.isInteger(options.secret) ? options.secret : null;
    const configuredSecret = requestedSecret === null ? getActiveFixedSecret() : requestedSecret;

    if (!demoMode && ui.game && ui.game.status === 'playing' && !ui.navigationPending && !ui.demo.active) return;

    clearTimers();
    hideBombResult();

    if (dom.switchDialog.open) {
      ui.switchConfirmed = true;
      dom.switchDialog.close('restart');
    }

    let nextState = ENGINE.createState(configuredSecret === null ? undefined : configuredSecret);
    if (!demoMode && configuredSecret === null) {
      let retry = 0;
      while (ui.game && nextState.secret === ui.game.secret && retry < 3) {
        nextState = ENGINE.createState();
        retry += 1;
      }
    }

    ui.game = nextState;
    ui.events = [];
    ui.prediction.locked = false;
    ui.resultOpen = false;
    ui.resultPending = false;
    ui.navigationPending = false;
    ui.pendingHref = null;
    ui.switchConfirmed = false;
    ui.lastCut = null;
    ui.demo = {
      active: demoMode,
      auto: false,
      index: 0,
      total: 0,
      events: [],
      done: false
    };
    ui.levels.invariant.promptOpen = false;
    ui.levels.invariant.answered = false;

    dom.guessInput.value = '';
    dom.predictInput.value = '';
    dom.guessForm.classList.remove('is-shaking');
    dom.predictionCard.classList.remove('is-correct', 'is-wrong', 'is-shaking');
    dom.bombCard.classList.remove('is-critical', 'is-detonating');
    dom.screenFlash.classList.remove('is-active');
    dom.invariantPrompt.hidden = true;

    setBombStatus('armed', '拆弹中');
    setFeedback('neutral', demoMode
      ? '示例模式启动：密码固定为 62。'
      : '训练模式启动：没有倒计时。先预测下一次 mid，再提交你的猜测。');
    dom.bombLead.textContent = demoMode
      ? '示例关卡：密码固定为 62。观察 mid 如何把候选区间不断减半。'
      : '每次合法错误猜测剪断一根线。在 7 根线用完前锁定 1–100 中的密码。';
    resetPredictionForRound();
    renderAll();

    announce(demoMode
      ? '示例演示开始，密码固定为 62。'
      : `新一局开始。密码已经锁定，你有 ${MAX_WIRES} 根拆弹线。`);
    showToast(demoMode ? '示例演示 · secret 62' : `训练模式启动 · ${MAX_WIRES} 根线就绪`, 'neutral');

    if (demoMode) return;

    window.requestAnimationFrame(() => {
      const promptRect = dom.predictionCard.getBoundingClientRect();
      const promptOutOfView = promptRect.top < 8 || promptRect.bottom > window.innerHeight - 8;

      if (promptOutOfView) {
        dom.predictionCard.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center'
        });
      }

      dom.predictInput.focus({ preventScroll: true });
    });
  }

  function submitGuess(event) {
    event.preventDefault();

    if (!ui.game || ui.game.status !== 'playing' || ui.navigationPending) return;

    const value = Number(dom.guessInput.value);
    const result = ENGINE.applyGuess(ui.game, value);

    if (!result.ok) {
      showGuessError(result.error || '这次猜测无效。');
      return;
    }

    const previousWires = ui.game.wiresLeft;
    const eventData = result.event;

    ui.game = result.state;
    ui.events.push(eventData);
    ui.lastCut = eventData.feedback !== 'hit' && result.state.wiresLeft < previousWires
      ? MAX_WIRES - result.state.wiresLeft
      : null;

    dom.guessInput.value = '';
    dom.guessForm.classList.remove('is-shaking');
    resetPredictionForRound();

    if (eventData.feedback === 'hit') {
      const wireSuffix = result.state.wiresLeft === 0
        ? '你在最后一根线上命中，拆弹成功！'
        : `还剩 ${result.state.wiresLeft} 根线。`;
      setFeedback('success', `命中！密码就是 ${result.state.secret}。${wireSuffix}`);
      dom.bombLead.textContent = '密码已确认，炸弹停止。';
      announce(`拆弹成功！密码是 ${result.state.secret}，共猜测 ${result.state.guesses.length} 次。`);
    } else if (result.state.status === 'exploded') {
      setFeedback('danger', `${eventData.mid} 仍然不对，最后一根线被剪断，炸弹爆炸！正确密码是 ${result.state.secret}。`);
      dom.bombLead.textContent = '7 根线全部耗尽，密码已经揭晓。';
      announce(`炸弹爆炸！正确密码是 ${result.state.secret}，共猜测 ${result.state.guesses.length} 次。`);
      showToast(`${MAX_WIRES} 根线耗尽 · 炸弹爆炸`, 'danger');
    } else {
      const hint = eventData.feedback === 'low'
        ? `${eventData.mid} 太小了 ↑ 密码更大。新区间 ${eventData.newLow}–${eventData.newHigh}，还剩 ${eventData.remaining} 个候选。`
        : `${eventData.mid} 太大了 ↓ 密码更小。新区间 ${eventData.newLow}–${eventData.newHigh}，还剩 ${eventData.remaining} 个候选。`;
      setFeedback(eventData.feedback, `${hint} 这次剪断一根线，还剩 ${result.state.wiresLeft} 根。`);
      dom.bombLead.textContent = `候选区间收缩到 ${result.state.low}–${result.state.high}。下一次 mid = ${ENGINE.nextMid(result.state.low, result.state.high)}。`;
      announce(`${hint} 剩余 ${result.state.wiresLeft} 根拆弹线。`);
      showToast(`剪断第 ${ui.lastCut} 根线 · 还剩 ${result.state.wiresLeft} 根`, 'neutral');
    }

    renderAll();
    handleLevelGuess(eventData, result.state);

    if (ui.lastCut !== null) {
      window.clearTimeout(ui.timers.cut);
      ui.timers.cut = window.setTimeout(() => {
        ui.lastCut = null;
        renderWires();
      }, 720);
    }

    if (result.state.status === 'playing') {
      window.requestAnimationFrame(() => {
        dom.predictInput.focus({ preventScroll: true });
      });
    } else {
      finishRound();
    }
  }

  function submitPrediction(event) {
    event.preventDefault();

    if (!ui.game || ui.game.status !== 'playing' || ui.navigationPending) return;
    if (ui.prediction.locked) return;

    const value = Number(dom.predictInput.value);

    if (!Number.isInteger(value) || value < LOWER_BOUND || value > UPPER_BOUND) {
      setPredictionFeedback('error', `请输入 ${LOWER_BOUND}–${UPPER_BOUND} 之间的整数。`);
      shakeElement(dom.predictionCard, 'is-shaking');
      dom.predictInput.focus({ preventScroll: true });
      dom.predictInput.select();
      return;
    }

    const low = ui.game.low;
    const high = ui.game.high;
    const expected = ENGINE.nextMid(low, high);
    const ok = value === expected;

    ui.prediction.locked = true;

    let record = null;
    try {
      record = window.ProgressStore
        ? window.ProgressStore.recordPrediction('binary', ok)
        : null;
    } catch {
      record = null;
    }

    refreshProgress();

    const formula = `mid = ${low} + floor((${high} − ${low}) / 2) = ${expected}`;
    const tally = record && record.predictions
      ? ` · 累计正确 ${record.predictions.correct} / ${record.predictions.attempts}`
      : '';

    if (ok) {
      setPredictionFeedback('correct', `✓ 预测正确。${formula}${tally}`);
      announce(`预测正确，下一个中点是 ${expected}。`);
    } else {
      setPredictionFeedback('wrong', `✗ 差一点，正确答案是 ${expected}。${formula}${tally}`);
      announce(`预测不正确，下一个中点是 ${expected}。`);
    }

    dom.predictionCard.classList.remove('is-correct', 'is-wrong');
    void dom.predictionCard.offsetWidth;
    dom.predictionCard.classList.add(ok ? 'is-correct' : 'is-wrong');
    renderPredictionControls();

    window.requestAnimationFrame(() => {
      dom.guessInput.focus({ preventScroll: true });
    });
  }

  function showGuessError(message) {
    setFeedback('error', `${message} 这次不消耗拆弹线。`);
    shakeElement(dom.guessForm, 'is-shaking');

    window.clearTimeout(ui.timers.error);
    ui.timers.error = window.setTimeout(() => {
      dom.guessForm.classList.remove('is-shaking');
    }, 380);

    dom.guessInput.focus({ preventScroll: true });
    dom.guessInput.select();
  }

  function finishRound() {
    if (!ui.game) return;

    if (ui.game.status === 'defused') {
      ui.resultPending = true;
      updateControls();
      scheduleResult(true);
      return;
    }

    if (ui.game.status === 'exploded') {
      ui.resultPending = true;
      triggerExplosionVisual();
      updateControls();
      scheduleResult(false);
    }
  }

  function scheduleResult(success) {
    window.clearTimeout(ui.timers.result);
    ui.timers.result = window.setTimeout(() => {
      ui.resultPending = false;
      if (ui.navigationPending) return;
      showBombResult(success);
    }, reduceMotion ? 0 : success ? 320 : 950);
  }

  // =========================================================
  // 预测与进度
  // =========================================================

  function resetPredictionForRound() {
    ui.prediction.locked = false;
    dom.predictInput.value = '';
    dom.predictionCard.classList.remove('is-correct', 'is-wrong', 'is-shaking');
    setPredictionFeedback('neutral', predictionPrompt());
    renderPredictionControls();
  }

  function predictionPrompt() {
    if (!ui.game) {
      return '开局后，用公式算出下一次 mid，再验证。';
    }

    if (ui.game.status !== 'playing') {
      return '本局已结束。开一局新的，继续练习预测。';
    }

    return `先算一下：low = ${ui.game.low}，high = ${ui.game.high}。下一次 mid 是多少？`;
  }

  function refreshProgress() {
    let record = null;

    try {
      record = window.ProgressStore ? window.ProgressStore.get('binary') : null;
    } catch {
      record = null;
    }

    const predictions = record && record.predictions
      ? record.predictions
      : { attempts: 0, correct: 0 };

    const attempts = Math.max(0, Number(predictions.attempts) || 0);
    const correct = Math.min(attempts, Math.max(0, Number(predictions.correct) || 0));
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : null;

    dom.predictionRecord.textContent = `${correct} / ${attempts} 次`;
    dom.predictionAccuracy.textContent = accuracy === null ? '—' : `${accuracy}%`;
    dom.predictMeterFill.style.width = accuracy === null ? '0%' : `${Math.min(100, accuracy)}%`;
  }

  // =========================================================
  // 渲染
  // =========================================================

  function renderAll() {
    renderState();
    renderWires();
    renderHistory();
    renderBombVisual();
    renderBombStatus();
    renderStats();
    renderPredictionControls();
    updateControls();
    renderLevels();
  }

  function renderState() {
    const game = ui.game;
    const idle = !game;
    const playing = Boolean(game) && game.status === 'playing';
    const low = idle ? LOWER_BOUND : game.low;
    const high = idle ? UPPER_BOUND : game.high;
    const wires = idle ? MAX_WIRES : game.wiresLeft;
    const remaining = idle
      ? UPPER_BOUND - LOWER_BOUND + 1
      : game.status === 'defused'
        ? 1
        : Math.max(0, high - low + 1);
    const mid = idle || playing ? ENGINE.nextMid(low, high) : null;
    const invariantOk = idle || (low <= high && game.secret >= low && game.secret <= high);

    dom.stateLow.textContent = String(low);
    dom.stateHigh.textContent = String(high);
    dom.stateMid.textContent = mid === null ? '—' : String(mid);
    dom.stateRemaining.textContent = String(remaining);
    dom.stateWires.textContent = `${wires} / ${MAX_WIRES}`;
    dom.stateInvariant.textContent = invariantOk ? '✓ 成立' : '✗ 失效';
    dom.stateInvariantRange.textContent = `secret ∈ [${low}, ${high}]`;

    const invariantTile = dom.stateInvariant.closest('.state-tile');
    if (invariantTile) invariantTile.classList.toggle('is-bad', !invariantOk);

    const wiresTile = dom.stateWires.closest('.state-tile');
    if (wiresTile) {
      wiresTile.classList.toggle('is-critical', playing && wires <= 2);
      wiresTile.classList.toggle('is-empty', Boolean(game) && game.status === 'exploded');
    }

    if (idle || playing) {
      dom.midFormulaRule.textContent = 'mid = low + floor((high − low) / 2)';
      dom.midFormulaCalc.textContent = `= ${low} + floor((${high} − ${low}) / 2) = ${mid}`;
    } else {
      dom.midFormulaRule.textContent = '本局已结束';
      dom.midFormulaCalc.textContent = `正确密码 ${game.secret} · 共 ${game.guesses.length} 次猜测`;
    }

    if (idle) {
      dom.guessHelp.textContent = '点击「开始拆弹」后开始。每轮先预测，再猜测。';
    } else if (playing) {
      dom.guessHelp.textContent = `当前候选区间 ${low}–${high}，共 ${remaining} 个数字。下一次 mid = ${mid}。`;
    } else if (game.status === 'defused') {
      dom.guessHelp.textContent = `密码 ${game.secret} 已确认，共 ${game.guesses.length} 次猜测。`;
    } else {
      dom.guessHelp.textContent = `密码是 ${game.secret}，7 根线已经耗尽。`;
    }
  }

  function renderWires() {
    const wiresLeft = ui.game ? ui.game.wiresLeft : MAX_WIRES;
    const cutCount = MAX_WIRES - wiresLeft;

    wireEls.forEach((wire, index) => {
      const isCut = index < cutCount;
      wire.classList.toggle('is-cut', isCut);
      wire.classList.toggle('is-cutting', isCut && ui.lastCut === index + 1);
      wire.setAttribute('aria-label', `线路 ${index + 1}：${isCut ? '已剪断' : '完好'}`);
    });

    dom.wireCount.textContent = `${wiresLeft} / ${MAX_WIRES}`;
    dom.wirePanel.dataset.state = wiresLeft === 0 ? 'empty' : wiresLeft <= 2 ? 'critical' : 'full';

    if (!ui.game) {
      dom.wireNote.textContent = '每局 7 根线，对应 7 次机会。每次合法猜测占用 1 根；猜错即剪断，线耗尽则爆炸。';
    } else if (ui.game.status === 'defused') {
      dom.wireNote.textContent = '拆弹成功：密码已锁定，线路停止消耗。';
    } else if (ui.game.status === 'exploded') {
      dom.wireNote.textContent = '7 根线全部耗尽，炸弹已爆炸。';
    } else if (wiresLeft === 1) {
      dom.wireNote.textContent = '最后一根线：下一次合法猜测若猜错就会引爆；若命中，仍算拆弹成功。';
    } else {
      dom.wireNote.textContent = `已剪断 ${cutCount} 根，剩余 ${wiresLeft} 根。先预测下一次 mid，再决定是否押上下一根线。`;
    }
  }

  function renderHistory() {
    dom.guessTableBody.replaceChildren();

    if (ui.events.length === 0) {
      const row = document.createElement('tr');
      row.className = 'history-empty';
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = '还没有猜测 · 先预测下一次 mid';
      row.appendChild(cell);
      dom.guessTableBody.appendChild(row);
      dom.historyCount.textContent = '0 次';
      return;
    }

    const fragment = document.createDocumentFragment();

    ui.events.forEach((event) => {
      const row = document.createElement('tr');
      row.className = `history-row is-${event.feedback}`;

      const guessCell = document.createElement('td');
      guessCell.className = 'history-guess';
      const guessValue = document.createElement('strong');
      guessValue.textContent = String(event.mid);
      guessCell.appendChild(guessValue);
      if (ENGINE.nextMid(event.low, event.high) === event.mid) {
        const tag = document.createElement('small');
        tag.textContent = 'mid';
        guessCell.appendChild(tag);
      }

      const feedbackCell = document.createElement('td');
      feedbackCell.className = 'history-feedback';
      feedbackCell.textContent = event.feedback === 'low'
        ? '太小 ↑'
        : event.feedback === 'high'
          ? '太大 ↓'
          : '命中 ✓';

      const rangeCell = document.createElement('td');
      rangeCell.textContent = event.feedback === 'hit'
        ? '已锁定'
        : `${event.newLow}–${event.newHigh}`;

      const remainingCell = document.createElement('td');
      remainingCell.className = 'history-number';
      remainingCell.textContent = String(event.remaining);

      const eliminated = Math.max(0, (event.high - event.low + 1) - event.remaining);
      const eliminatedCell = document.createElement('td');
      eliminatedCell.className = 'history-number';
      eliminatedCell.textContent = `${eliminated} 个`;

      row.append(guessCell, feedbackCell, rangeCell, remainingCell, eliminatedCell);
      fragment.appendChild(row);
    });

    dom.guessTableBody.appendChild(fragment);
    dom.historyCount.textContent = `${ui.events.length} 次`;
  }

  function renderBombVisual() {
    const game = ui.game;
    const wires = game ? game.wiresLeft : MAX_WIRES;
    const state = game ? game.status : 'idle';
    const ratio = Math.max(0, Math.min(1, wires / MAX_WIRES));

    dom.bombVisual.dataset.state = state;
    dom.bombVisual.style.setProperty('--wire-angle', `${(ratio * 360).toFixed(1)}deg`);
    dom.bombCard.classList.toggle('is-critical', state === 'playing' && wires <= 2);

    if (!game) {
      dom.bombTime.textContent = String(MAX_WIRES).padStart(2, '0');
      dom.bombTimeLabel.textContent = 'WIRES READY';
    } else if (state === 'playing') {
      dom.bombTime.textContent = String(wires).padStart(2, '0');
      dom.bombTimeLabel.textContent = wires === 1 ? 'LAST WIRE' : 'WIRES LEFT';
    } else if (state === 'defused') {
      dom.bombTime.textContent = 'OK';
      dom.bombTimeLabel.textContent = 'DEFUSED';
    } else {
      dom.bombTime.textContent = '00';
      dom.bombTimeLabel.textContent = 'DETONATED';
    }
  }

  function renderBombStatus() {
    if (!ui.game) {
      setBombStatus('idle', '等待开始');
    } else if (ui.game.status === 'playing') {
      setBombStatus('armed', `拆弹中 · ${ui.game.wiresLeft} 根线`);
    } else if (ui.game.status === 'defused') {
      setBombStatus('defused', '已拆除');
    } else {
      setBombStatus('exploded', '炸弹爆炸');
    }
  }

  function renderStats() {
    const remaining = !ui.game
      ? UPPER_BOUND - LOWER_BOUND + 1
      : ui.game.status === 'defused'
        ? 1
        : Math.max(0, ui.game.high - ui.game.low + 1);

    dom.candidateCount.textContent = String(remaining);
    dom.eliminatedCount.textContent = String(Math.max(0, (UPPER_BOUND - LOWER_BOUND + 1) - remaining));
    dom.attemptCount.textContent = String(ui.game ? ui.game.guesses.length : 0);
  }

  function renderPredictionControls() {
    const playing = Boolean(ui.game) && ui.game.status === 'playing' && !ui.navigationPending;
    const locked = ui.prediction.locked;
    const demoLocked = ui.demo.active;

    dom.predictInput.disabled = !playing || locked || demoLocked;
    dom.predictSubmit.disabled = !playing || locked || demoLocked;
    dom.predictionCard.classList.toggle('is-locked', locked || demoLocked);
    dom.predictionCard.classList.toggle('is-idle', !ui.game);
  }

  function updateControls() {
    const playing = Boolean(ui.game) && ui.game.status === 'playing';
    const blocked = ui.navigationPending;
    const demoPlaying = playing && ui.demo.active;
    const locked = playing || ui.resultOpen || ui.resultPending || ui.navigationPending;
    const canInput = playing && !blocked && !demoPlaying;

    const levelMode = PLAY.mode === 'level';
    const activeLevel = ui.levels.active;
    const demoLevel = levelMode && activeLevel === 'example';
    const bombLevel = !levelMode || LEVEL_BOMB_IDS.indexOf(activeLevel) !== -1;
    const fixedSecret = getActiveFixedSecret();

    dom.startBombBtn.disabled = !bombLevel
      || ui.navigationPending
      || (demoLevel && demoPlaying)
      || (locked && !demoPlaying);
    dom.guessInput.disabled = !canInput;
    dom.guessSubmit.disabled = !canInput;

    let startLabel;

    if (!bombLevel) {
      startLabel = '请使用关卡面板';
    } else if (ui.navigationPending) {
      startLabel = '正在切换…';
    } else if (demoLevel) {
      startLabel = playing
        ? '演示进行中…'
        : ui.demo.done ? '重新演示 · secret 62' : '开始演示 · secret 62';
    } else if (playing) {
      startLabel = demoPlaying ? '结束演示并开局' : '拆弹中…';
    } else if (ui.resultOpen || ui.resultPending) {
      startLabel = '本局结束';
    } else if (!ui.game) {
      startLabel = fixedSecret === null ? '开始拆弹' : `开始拆弹 · secret ${fixedSecret}`;
    } else {
      startLabel = '再拆一颗';
    }

    dom.startBombLabel.textContent = startLabel;

    const showInlineStart = bombLevel
      && !playing
      && !ui.resultOpen
      && !ui.resultPending
      && !ui.navigationPending;
    dom.inlineStartRow.hidden = !showInlineStart;
    dom.startBombBtnInline.disabled = !bombLevel || locked || (demoLevel && demoPlaying);
    dom.startBombLabelInline.textContent = startLabel === '请使用关卡面板'
      ? startLabel
      : !ui.game ? startLabel : '再拆一颗';

    const wires = ui.game ? ui.game.wiresLeft : MAX_WIRES;
    dom.guessWireNote.textContent = `拆弹线 ${wires} / ${MAX_WIRES}`;
    renderPredictionControls();
  }

  function setBombStatus(state, text) {
    dom.bombStatus.dataset.state = state;
    dom.bombStatusText.textContent = text;
  }

  function setFeedback(tone, text) {
    dom.feedbackBox.dataset.tone = tone;
    dom.feedbackText.textContent = text;
  }

  function setPredictionFeedback(tone, text) {
    dom.predictFeedback.dataset.tone = tone;
    dom.predictFeedback.textContent = text;
  }

  // =========================================================
  // 结果与切换
  // =========================================================

  function showBombResult(success) {
    const game = ui.game;
    if (!game) return;

    const wires = `${game.wiresLeft} / ${game.maxWires || MAX_WIRES}`;

    ui.resultOpen = true;
    ui.resultPending = false;
    hideToast();

    dom.bombResultOverlay.classList.toggle('is-failure', !success);
    dom.bombResultIcon.innerHTML = success ? ICONS.success : ICONS.explosion;
    dom.bombResultKicker.textContent = success ? 'BOMB DEFUSED' : 'BOMB DETONATED';
    dom.bombResultTitle.textContent = success ? '拆弹成功！' : '炸弹爆炸！';

    if (success) {
      dom.bombResultMessage.textContent = game.wiresLeft === 0
        ? `正确密码是 ${game.secret}。你在最后一根线上命中，成功拆弹。`
        : `正确密码是 ${game.secret}。第 ${game.guesses.length} 次猜测命中，拆弹成功。`;
    } else {
      dom.bombResultMessage.textContent = `7 根线全部耗尽，炸弹爆炸。正确密码是 ${game.secret}，你一共猜了 ${game.guesses.length} 次。`;
    }

    dom.bombResultTarget.textContent = String(game.secret);
    dom.bombResultGuesses.textContent = String(game.guesses.length);
    dom.bombResultTime.textContent = wires;
    dom.bombResultAction.textContent = success ? '再拆一颗' : '重新训练';

    document.body.classList.add('bomb-modal-open');
    dom.bombResultOverlay.hidden = false;
    updateControls();

    window.requestAnimationFrame(() => {
      dom.bombResultAction.focus({ preventScroll: true });
    });
  }

  function hideBombResult({ focusStart = false } = {}) {
    dom.bombResultOverlay.hidden = true;
    document.body.classList.remove('bomb-modal-open');
    ui.resultOpen = false;
    ui.resultPending = false;
    window.clearTimeout(ui.timers.result);

    updateControls();

    if (focusStart) {
      dom.startBombBtn.focus({ preventScroll: true });
    }
  }

  function triggerExplosionVisual() {
    dom.bombVisual.dataset.state = 'exploded';
    dom.bombTime.textContent = '00';
    dom.bombTimeLabel.textContent = 'DETONATED';
    dom.bombCard.classList.remove('is-critical');
    dom.bombCard.classList.remove('is-detonating');

    void dom.bombCard.offsetWidth;
    dom.bombCard.classList.add('is-detonating');

    window.clearTimeout(ui.timers.shake);
    ui.timers.shake = window.setTimeout(() => {
      dom.bombCard.classList.remove('is-detonating');
    }, 650);

    dom.screenFlash.classList.remove('is-active');
    void dom.screenFlash.offsetWidth;
    dom.screenFlash.classList.add('is-active');

    window.clearTimeout(ui.timers.flash);
    ui.timers.flash = window.setTimeout(() => {
      dom.screenFlash.classList.remove('is-active');
    }, 950);
  }

  function openSwitchDialog(href) {
    if (!ui.game || ui.game.status !== 'playing' || dom.switchDialog.open) return;

    ui.pendingHref = href;
    ui.switchConfirmed = false;

    dom.switchMessage.textContent = `这一局还没有结束，还剩 ${ui.game.wiresLeft} 根线。确认后炸弹会立刻引爆，然后切换到新的算法游戏。`;

    document.body.classList.add('bomb-modal-open');
    dom.switchDialog.showModal();

    window.requestAnimationFrame(() => {
      dom.switchCancel.focus({ preventScroll: true });
    });
  }

  function closeSwitchDialog() {
    if (dom.switchDialog.open) {
      dom.switchDialog.close('cancel');
    }
  }

  function handleSwitchDialogClosed() {
    document.body.classList.remove('bomb-modal-open');

    if (ui.switchConfirmed) return;

    ui.pendingHref = null;
    updateControls();
  }

  function confirmSwitch() {
    const href = ui.pendingHref;
    ui.switchConfirmed = true;
    ui.navigationPending = Boolean(href);

    if (dom.switchDialog.open) {
      dom.switchDialog.close('confirm');
    }

    window.clearTimeout(ui.timers.result);
    ui.resultPending = false;
    hideBombResult();

    triggerExplosionVisual();
    setBombStatus('exploded', '炸弹爆炸');
    setFeedback('danger', '炸弹已引爆。正在前往新的算法游戏…');
    dom.bombLead.textContent = '本次拆弹已结束，即将切换页面。';
    updateControls();
    announce('炸弹已引爆，正在切换算法游戏。');

    if (!href) return;

    window.clearTimeout(ui.timers.navigation);
    ui.timers.navigation = window.setTimeout(() => {
      window.location.assign(href);
    }, reduceMotion ? 350 : 1100);
  }

  // =========================================================
  // 角色反转 · 你当出题人
  // =========================================================

  function initOracle() {
    if (!dom.oracleDialog) return;

    fillQuizOptions(dom.oracleQuizQ1, ORACLE_QUIZ.q1.options);
    fillQuizOptions(dom.oracleQuizQ2, ORACLE_QUIZ.q2.options);
    resetOracleQuizUI();
    syncOracleSecretFields(ui.oracle.secret);
    renderOracle();
    renderOracleMastery();
  }

  function openOracleDialog() {
    if (!dom.oracleDialog || dom.oracleDialog.open) return;

    ui.oracle.open = true;
    document.body.classList.add('bomb-modal-open');
    renderOracle();
    dom.oracleDialog.showModal();

    window.requestAnimationFrame(() => {
      if (ui.oracle.status === 'playing') {
        dom.oracleAnswerHigh.focus({ preventScroll: true });
      } else if (ui.oracle.status === 'done') {
        dom.oracleEndSection.focus({ preventScroll: true });
      } else {
        dom.oracleSecretInput.focus({ preventScroll: true });
        dom.oracleSecretInput.select();
      }
    });
  }

  function closeOracleDialog() {
    if (dom.oracleDialog && dom.oracleDialog.open) {
      dom.oracleDialog.close('dismiss');
    }
  }

  function handleOracleDialogClosed() {
    ui.oracle.open = false;

    if (dom.bombResultOverlay.hidden) {
      document.body.classList.remove('bomb-modal-open');
      dom.oracleOpenBtn.focus({ preventScroll: true });
    }
  }

  function handleOracleSecretInput() {
    if (ui.oracle.status === 'playing') return;

    const value = Number(dom.oracleSecretInput.value);
    if (Number.isInteger(value) && value >= LOWER_BOUND && value <= UPPER_BOUND) {
      dom.oracleSecretRange.value = String(value);
      // 已完成的一局保留原 secret 供决策树复盘；输入框里的值只作为下一局的草稿。
      if (ui.oracle.status === 'ready') ui.oracle.secret = value;
      hideOracleError();
    }
  }

  function handleOracleSecretRange() {
    if (ui.oracle.status === 'playing') return;

    const value = Number(dom.oracleSecretRange.value);
    if (!Number.isInteger(value)) return;
    dom.oracleSecretInput.value = String(value);
    if (ui.oracle.status === 'ready') ui.oracle.secret = value;
    hideOracleError();
  }

  function syncOracleSecretFields(value) {
    if (dom.oracleSecretInput) dom.oracleSecretInput.value = String(value);
    if (dom.oracleSecretRange) dom.oracleSecretRange.value = String(value);
  }

  function showOracleError(message) {
    dom.oracleSecretError.textContent = message;
    dom.oracleSecretError.hidden = false;
  }

  function hideOracleError() {
    dom.oracleSecretError.hidden = true;
    dom.oracleSecretError.textContent = '';
  }

  function resetOracleQuizUI() {
    [dom.oracleQuizQ1, dom.oracleQuizQ2].forEach((container) => {
      if (!container) return;
      container.dataset.solved = 'false';
      container.querySelectorAll('.quiz-option').forEach((button) => {
        button.disabled = false;
        button.classList.remove('is-correct', 'is-wrong');
      });
    });

    setOracleQuizFeedback('q1', 'neutral', '选一个最接近的答案。');
    setOracleQuizFeedback('q2', 'neutral', '选一个最接近的答案。');
    dom.oracleQuizResult.hidden = true;
    dom.oracleQuizResult.textContent = '';
    dom.oracleQuizResult.dataset.tone = 'neutral';
  }

  function startOracleSession() {
    const value = Number(dom.oracleSecretInput.value);

    if (!Number.isInteger(value) || value < LOWER_BOUND || value > UPPER_BOUND) {
      showOracleError(`请输入 ${LOWER_BOUND}–${UPPER_BOUND} 之间的整数。`);
      dom.oracleSecretInput.focus({ preventScroll: true });
      dom.oracleSecretInput.select();
      return;
    }

    hideOracleError();

    const state = ui.oracle;
    state.status = 'playing';
    state.secret = value;
    state.low = LOWER_BOUND;
    state.high = UPPER_BOUND;
    state.guess = ENGINE.nextMid(LOWER_BOUND, UPPER_BOUND);
    state.step = 0;
    state.guesses = [];
    state.inconsistent = false;
    state.endReason = null;
    state.quiz = { q1: false, q2: false, recorded: false };

    syncOracleSecretFields(value);
    resetOracleQuizUI();
    renderOracle();

    announce(`角色反转开始。电脑不读取 secret，只会用中点公式，第一次猜 ${state.guess}。`);
    dom.oracleAnswerHigh.focus({ preventScroll: true });
  }

  function submitOracleAnswer(answer) {
    const state = ui.oracle;
    if (state.status !== 'playing' || state.guess === null) return;

    const mid = state.guess;
    const intervalLow = state.low;
    const intervalHigh = state.high;
    const consistent = oracleAnswerMatches(answer, mid, state.secret);

    let newLow = intervalLow;
    let newHigh = intervalHigh;

    if (answer === 'high') {
      newHigh = mid - 1;
    } else if (answer === 'low') {
      newLow = mid + 1;
    }

    state.step += 1;
    state.guesses.push({
      mid,
      low: intervalLow,
      high: intervalHigh,
      answer,
      newLow,
      newHigh,
      consistent
    });

    if (!consistent) {
      state.inconsistent = true;
      announce('注意：裁判不一致。你的回答与 secret 不符，secret 可能被排除出候选区间，二分可能找不到它。');
    }

    if (answer === 'hit') {
      state.endReason = 'hit';
      finishOracleSession();
      return;
    }

    state.low = newLow;
    state.high = newHigh;

    if (newLow > newHigh) {
      state.endReason = 'empty';
      finishOracleSession();
      return;
    }

    if (state.step >= ORACLE_MAX_STEPS) {
      state.endReason = 'limit';
      finishOracleSession();
      return;
    }

    // 下一次猜测只来自区间，不读取 secret。
    state.guess = ENGINE.nextMid(state.low, state.high);
    renderOracle();

    if (consistent) {
      announce(`第 ${state.step} 次猜 ${mid}，你回答「${oracleAnswerLabel(answer)}」，新区间 [${state.low}, ${state.high}]。电脑下一次猜 ${state.guess}。`);
    } else {
      announce(`裁判不一致后继续。电脑下一次只会按区间猜 ${state.guess}。`);
    }
  }

  function oracleAnswerMatches(answer, mid, secret) {
    if (answer === 'hit') return mid === secret;
    if (answer === 'high') return mid > secret;
    return mid < secret;
  }

  function oracleAnswerLabel(answer) {
    if (answer === 'high') return '太大';
    if (answer === 'low') return '太小';
    return '命中';
  }

  function finishOracleSession() {
    const state = ui.oracle;
    state.status = 'done';
    state.guess = null;
    renderOracle();

    const summary = oracleResultSummary(state);
    announce(summary);

    window.requestAnimationFrame(() => {
      if (dom.oracleEndSection.hidden) return;
      dom.oracleEndSection.focus({ preventScroll: true });
      dom.oracleEndSection.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  }

  function oracleResultSummary(state) {
    if (state.endReason === 'hit' && !state.inconsistent) {
      return `公平命中！电脑用 ${state.guesses.length} 次猜中 ${state.secret}，路径见决策树。`;
    }

    if (state.endReason === 'hit') {
      return `本局结束。你宣布命中，但真实 secret 是 ${state.secret}，裁判不一致。`;
    }

    if (state.endReason === 'empty') {
      return `本局结束。区间已为空，二分找不到 secret ${state.secret}，裁判出现不一致。`;
    }

    return `本局结束。${ORACLE_MAX_STEPS} 次猜测用尽仍未命中，secret 是 ${state.secret}。`;
  }

  function setOracleConsistency(tone, text) {
    if (!dom.oracleConsistency) return;
    dom.oracleConsistency.dataset.tone = tone;
    dom.oracleConsistency.textContent = text;
  }

  function renderOracle() {
    if (!dom.oracleDialog) return;

    const state = ui.oracle;
    const playing = state.status === 'playing';
    const done = state.status === 'done';
    const started = playing || done;

    dom.oracleRoundBadge.textContent = playing
      ? `第 ${state.step + 1} / ${ORACLE_MAX_STEPS} 次`
      : done
        ? '本局结束'
        : '等待开始';

    dom.oracleGuessStage.dataset.state = state.status;
    dom.oracleRangeBadge.textContent = state.low > state.high
      ? '空区间 · low > high'
      : `区间 [${state.low}, ${state.high}]`;
    dom.oracleGuessValue.textContent = state.guess === null ? '—' : String(state.guess);

    if (state.guess === null) {
      dom.oracleGuessFormula.textContent = done
        ? '本局已结束 · 见下方路径决策树'
        : '电脑将在开始后取中点';
    } else {
      dom.oracleGuessFormula.textContent =
        `nextMid(${state.low}, ${state.high}) = ${state.low} + ⌊(${state.high} − ${state.low}) / 2⌋ = ${state.guess}`;
    }

    if (!started) {
      setOracleConsistency('idle', '等待开始');
      dom.oraclePlayHint.textContent = '先设定 secret，再点「开始」。电脑第一次会猜 50。';
    } else if (playing) {
      setOracleConsistency(state.inconsistent ? 'warn' : 'ok', state.inconsistent ? '裁判不一致' : '裁判一致');
      dom.oraclePlayHint.textContent = `电脑只看到区间，不看 secret。${state.guess} 和你的秘密数字相比，是太大、太小，还是命中？`;
    } else {
      setOracleConsistency(state.inconsistent ? 'warn' : 'ok', state.inconsistent ? '裁判不一致' : '裁判一致');
      dom.oraclePlayHint.textContent = state.inconsistent
        ? '本局出现过不一致回答，二分不再有保证。'
        : '本局回答始终与 secret 一致。';
    }

    dom.oracleAnswerHigh.disabled = !playing;
    dom.oracleAnswerHit.disabled = !playing;
    dom.oracleAnswerLow.disabled = !playing;

    dom.oracleSecretInput.disabled = playing;
    dom.oracleSecretRange.disabled = playing;
    dom.oracleStartBtn.textContent = playing ? '重新开始' : done ? '再来一局' : '开始';

    dom.oracleConsistencyNote.hidden = !state.inconsistent;
    if (state.inconsistent) {
      dom.oracleConsistencyNote.textContent = '⚠ 裁判不一致：你的回答与 secret 不符，secret 可能已被排除，二分可能找不到它。';
    }

    renderOracleHistory();

    dom.oracleEndSection.hidden = !done;
    if (done) renderOracleEnd();

    renderOracleMastery();
  }

  function renderOracleHistory() {
    dom.oracleHistory.replaceChildren();

    const guesses = ui.oracle.guesses;
    dom.oracleHistoryCount.textContent = `${guesses.length} 次`;

    if (guesses.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'oracle-history-empty';
      empty.textContent = '还没有回答。';
      dom.oracleHistory.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    guesses.forEach((guess, index) => {
      const item = document.createElement('li');
      item.className = 'oracle-history-row';
      if (!guess.consistent) item.classList.add('is-inconsistent');

      const order = document.createElement('span');
      order.className = 'oracle-history-index';
      order.textContent = String(index + 1).padStart(2, '0');

      const mid = document.createElement('strong');
      mid.className = 'oracle-history-mid';
      mid.textContent = String(guess.mid);

      const tag = document.createElement('span');
      tag.className = `oracle-tag-${guess.answer}`;
      tag.textContent = oracleAnswerLabel(guess.answer);

      const range = document.createElement('span');
      range.className = 'oracle-history-range';
      range.textContent = guess.answer === 'hit'
        ? '结束'
        : guess.newLow > guess.newHigh
          ? '→ 空区间'
          : `→ [${guess.newLow}, ${guess.newHigh}]`;

      item.append(order, mid, tag, range);

      if (!guess.consistent) {
        const flag = document.createElement('span');
        flag.className = 'oracle-history-flag';
        flag.textContent = '裁判不一致';
        item.appendChild(flag);
      }

      fragment.appendChild(item);
    });

    dom.oracleHistory.appendChild(fragment);
    dom.oracleHistory.scrollTop = dom.oracleHistory.scrollHeight;
  }

  function renderOracleEnd() {
    const state = ui.oracle;
    const guesses = state.guesses;
    const last = guesses[guesses.length - 1] || null;
    const fairHit = state.endReason === 'hit' && !state.inconsistent;

    dom.oracleEndGuesses.textContent = String(guesses.length);
    dom.oracleEndLayers.textContent = String(guesses.length);
    dom.oracleEndConsistency.textContent = state.inconsistent ? '不一致' : '一致';
    dom.oracleTreeMeta.textContent = `共 ${guesses.length} 层 · 最坏 7 次`;

    if (fairHit) {
      dom.oracleEndText.innerHTML =
        `电脑第 ${guesses.length} 次猜中 <strong>${last.mid}</strong>；你的每次回答都与 secret 一致，这是一场公平对局。`;
    } else if (state.endReason === 'hit') {
      dom.oracleEndText.innerHTML =
        `你宣布「命中」<strong>${last.mid}</strong>，但真实 secret 是 <strong>${state.secret}</strong>。裁判不一致，二分这次并没有真正找到。`;
    } else if (state.endReason === 'empty') {
      dom.oracleEndText.innerHTML =
        `区间变成空区间（<strong>low &gt; high</strong>），二分无法继续；secret = <strong>${state.secret}</strong> 已被不一致的回答排除。`;
    } else {
      dom.oracleEndText.innerHTML =
        `已用完 <strong>${ORACLE_MAX_STEPS}</strong> 次猜测仍未命中；裁判不一致让二分失去 7 次保证。secret = <strong>${state.secret}</strong>。`;
    }

    renderOracleTree();
  }

  function renderOracleTree() {
    const state = ui.oracle;
    dom.oracleTree.replaceChildren();

    const fragment = document.createDocumentFragment();

    state.guesses.forEach((guess, index) => {
      const row = document.createElement('li');
      row.className = 'oracle-tree-row';
      if (!guess.consistent) row.classList.add('is-inconsistent');

      const rail = document.createElement('div');
      rail.className = 'oracle-tree-rail';
      rail.setAttribute('aria-hidden', 'true');
      const railNumber = document.createElement('span');
      railNumber.textContent = String(index + 1);
      rail.appendChild(railNumber);

      const main = document.createElement('div');
      main.className = 'oracle-tree-main';

      const meta = document.createElement('div');
      meta.className = 'oracle-tree-meta-row';
      const layer = document.createElement('span');
      layer.className = 'oracle-tree-layer';
      layer.textContent = `第 ${index + 1} 层`;
      const range = document.createElement('span');
      range.className = 'oracle-tree-range';
      range.textContent = `区间 [${guess.low}, ${guess.high}]`;

      const tag = document.createElement('span');
      tag.className = `oracle-tree-tag oracle-tag-${guess.answer}`;
      tag.textContent = guess.answer === 'hit'
        ? '命中'
        : `${oracleAnswerLabel(guess.answer)} → ${guess.answer === 'high' ? '左' : '右'}`;

      meta.append(layer, range, tag);

      if (!guess.consistent) {
        const flag = document.createElement('span');
        flag.className = 'oracle-flag';
        flag.textContent = '裁判不一致';
        meta.appendChild(flag);
      }

      const branches = document.createElement('div');
      branches.className = 'oracle-tree-branches';

      const leftBranch = buildOracleBranch(
        '太大',
        oracleRangeLabel(guess.low, guess.mid - 1),
        guess.answer === 'high' ? 'path' : 'ghost'
      );

      const node = document.createElement('div');
      node.className = 'oracle-node';
      if (guess.answer === 'hit') node.classList.add('is-hit');
      if (guess.answer === 'hit' && !guess.consistent) node.classList.add('is-false');

      const nodeMid = document.createElement('strong');
      nodeMid.textContent = String(guess.mid);
      const nodeCap = document.createElement('span');
      nodeCap.textContent = guess.answer === 'hit' ? '命中' : 'mid';
      node.append(nodeMid, nodeCap);

      const rightBranch = buildOracleBranch(
        '太小',
        oracleRangeLabel(guess.mid + 1, guess.high),
        guess.answer === 'low' ? 'path' : 'ghost'
      );

      branches.append(leftBranch, node, rightBranch);
      main.append(meta, branches);
      row.append(rail, main);
      fragment.appendChild(row);
    });

    fragment.appendChild(buildOracleTerminal(state));
    dom.oracleTree.appendChild(fragment);
  }

  function buildOracleBranch(label, rangeText, kind) {
    const branch = document.createElement('div');
    branch.className = `oracle-branch is-${kind}`;

    const title = document.createElement('b');
    title.textContent = label;
    const range = document.createElement('span');
    range.textContent = rangeText;

    branch.append(title, range);
    return branch;
  }

  function oracleRangeLabel(low, high) {
    return low > high ? '空区间' : `[${low}, ${high}]`;
  }

  function buildOracleTerminal(state) {
    const guesses = state.guesses;
    const last = guesses[guesses.length - 1] || null;
    const fairHit = state.endReason === 'hit' && !state.inconsistent;

    const item = document.createElement('li');
    item.className = 'oracle-tree-terminal';
    item.dataset.tone = fairHit ? 'ok' : 'warn';

    const rail = document.createElement('div');
    rail.className = 'oracle-tree-rail';
    rail.setAttribute('aria-hidden', 'true');
    const icon = document.createElement('span');
    icon.textContent = fairHit ? '✓' : '!';
    rail.appendChild(icon);

    const body = document.createElement('div');
    body.className = 'oracle-tree-terminal-body';
    const title = document.createElement('strong');
    const detail = document.createElement('span');

    if (fairHit) {
      title.textContent = `命中 ${last.mid} · 公平对局`;
      detail.textContent = `第 ${guesses.length} 层结束，secret = ${state.secret} 与命中值一致。`;
    } else if (state.endReason === 'hit') {
      title.textContent = '裁判宣称命中 · 不一致';
      detail.textContent = `命中值是 ${last.mid}，但真实 secret = ${state.secret}；二分这次没有找到。`;
    } else if (state.endReason === 'empty') {
      title.textContent = '区间为空 · 无法继续';
      detail.textContent = `最后一次收缩得到 [${state.low}, ${state.high}]（low > high）；secret = ${state.secret} 已被排除。`;
    } else {
      title.textContent = `${ORACLE_MAX_STEPS} 次用尽 · 未命中`;
      detail.textContent = `裁判不一致时没有 7 次保证；真实 secret = ${state.secret}。`;
    }

    body.append(title, detail);
    item.append(rail, body);
    return item;
  }

  function handleOracleQuizClick(event) {
    const button = event.target.closest('.quiz-option');
    if (!button || button.disabled) return;

    const block = button.closest('[data-oracle-quiz]');
    if (!block || !dom.oracleQuiz.contains(block)) return;
    if (ui.oracle.status !== 'done') return;

    const key = block.dataset.oracleQuiz;
    const config = ORACLE_QUIZ[key];
    if (!config || ui.oracle.quiz[key]) return;

    const option = config.options[Number(button.dataset.index)];
    if (!option) return;

    if (option.correct) {
      ui.oracle.quiz[key] = true;
      block.dataset.solved = 'true';
      block.querySelectorAll('.quiz-option').forEach((item) => {
        item.disabled = true;
        item.classList.toggle('is-correct', item === button);
      });
      setOracleQuizFeedback(key, 'correct', `✓ 正确。${option.explain}`);

      if (ui.oracle.quiz.q1 && ui.oracle.quiz.q2) completeOracleQuiz();
    } else {
      button.classList.add('is-wrong');
      window.setTimeout(() => {
        if (button.isConnected) button.classList.remove('is-wrong');
      }, 800);
      setOracleQuizFeedback(key, 'wrong', `✗ 再想想。${option.hint || ''}`);
    }
  }

  function setOracleQuizFeedback(key, tone, text) {
    const element = key === 'q2' ? dom.oracleQuizQ2Feedback : dom.oracleQuizQ1Feedback;
    if (!element) return;
    element.dataset.tone = tone;
    element.textContent = text;
  }

  function completeOracleQuiz() {
    const state = ui.oracle;
    if (state.quiz.recorded) return;
    state.quiz.recorded = true;

    const passed = state.endReason === 'hit' && !state.inconsistent;
    let stored = false;
    let mastered = false;

    try {
      if (window.ProgressStore) {
        window.ProgressStore.recordLevel('binary', 'oracle', { passed, quizCorrect: true });
        stored = true;
        const record = window.ProgressStore.getLevels('binary').oracle;
        mastered = Boolean(record && record.passed && record.quizCorrect);
      }
    } catch {
      stored = false;
    }

    let message;

    if (!stored) {
      message = '✓ 两题正确。本机存储不可用，本次仅在页面内生效。';
    } else if (mastered) {
      message = passed
        ? '✓ 两题正确。ProgressStore 已记录 binary · oracle：公平命中 + 小测通过。'
        : '✓ 两题正确。已记录小测；你此前已公平命中过，oracle 保持掌握。';
    } else {
      message = '✓ 两题正确。已记录小测；本局没有公平命中，passed 还没有点亮。再来一局诚实对局即可掌握。';
    }

    dom.oracleQuizResult.hidden = false;
    dom.oracleQuizResult.dataset.tone = passed || mastered ? 'correct' : 'neutral';
    dom.oracleQuizResult.textContent = message;

    renderOracleMastery();
    announce(passed
      ? '角色反转小测通过，已记录本地进度。'
      : '角色反转小测通过；本局未公平命中，掌握徽章尚未点亮。');
  }

  function renderOracleMastery() {
    if (!dom.oracleMastery) return;

    let record = null;
    try {
      record = window.ProgressStore
        ? window.ProgressStore.getLevels('binary').oracle || null
        : null;
    } catch {
      record = null;
    }

    let text = '本地记录 · 未开始';
    let tone = 'idle';

    if (record && record.passed && record.quizCorrect) {
      text = '本地记录 · 已掌握';
      tone = 'pass';
    } else if (record && record.quizCorrect) {
      text = '小测 ✓ · 待公平命中';
      tone = 'quiz';
    } else if (record && record.passed) {
      text = '已通过 · 小测待完成';
      tone = 'quiz';
    } else if (record) {
      text = '本地记录 · 练习中';
    }

    dom.oracleMastery.textContent = text;
    dom.oracleMastery.dataset.state = tone;
  }

  // =========================================================
  // 其他交互
  // =========================================================

  function handleGlobalKeydown(event) {
    if (!ui.resultOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      hideBombResult({ focusStart: true });
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      dom.bombResultAction.focus({ preventScroll: true });
    }
  }

  function shakeElement(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function showToast(message, tone = 'neutral') {
    window.clearTimeout(ui.timers.toast);
    window.clearTimeout(ui.timers.toastHide);

    dom.bombToast.hidden = false;
    dom.bombToast.dataset.tone = tone;
    dom.bombToast.textContent = message;
    dom.bombToast.classList.remove('is-visible');
    void dom.bombToast.offsetWidth;
    dom.bombToast.classList.add('is-visible');

    ui.timers.toast = window.setTimeout(hideToast, 2400);
  }

  function hideToast() {
    if (!dom.bombToast || dom.bombToast.hidden) return;

    dom.bombToast.classList.remove('is-visible');
    window.clearTimeout(ui.timers.toastHide);
    ui.timers.toastHide = window.setTimeout(() => {
      dom.bombToast.hidden = true;
    }, reduceMotion ? 0 : 240);
  }

  function clearTimers() {
    Object.keys(ui.timers).forEach((key) => {
      window.clearTimeout(ui.timers[key]);
      ui.timers[key] = 0;
    });
    ui.levels.duplicates.auto = false;
    ui.levels.threshold.auto = false;
  }

  function announce(message) {
    dom.liveRegion.textContent = '';
    window.setTimeout(() => {
      dom.liveRegion.textContent = message;
    }, 30);
  }

  function showFatalEngineError() {
    if (dom.startBombBtn) dom.startBombBtn.disabled = true;
    if (dom.startBombBtnInline) dom.startBombBtnInline.disabled = true;
    if (dom.bombStatusText) dom.bombStatusText.textContent = '引擎未就绪';
    if (dom.feedbackBox && dom.feedbackText) {
      dom.feedbackBox.dataset.tone = 'error';
      dom.feedbackText.textContent = '游戏引擎未加载，请刷新页面重试。';
    }
    if (dom.bombLead) {
      dom.bombLead.textContent = '未能加载 binary-engine.js，拆弹功能暂不可用。';
    }
  }
})();
