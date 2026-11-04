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

    numberMatrix: document.getElementById('numberMatrix'),
    candidateBadge: document.getElementById('candidateBadge'),
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
    timers: {
      toast: 0,
      toastHide: 0,
      result: 0,
      navigation: 0,
      flash: 0,
      shake: 0,
      error: 0,
      cut: 0
    }
  };

  const matrixCells = [];
  const wireEls = [];

  if (!ENGINE) {
    showFatalEngineError();
    return;
  }

  const LOWER_BOUND = ENGINE.LOWER_BOUND;
  const UPPER_BOUND = ENGINE.UPPER_BOUND;
  const MAX_WIRES = ENGINE.MAX_WIRES || 7;

  init();

  // =========================================================
  // 初始化
  // =========================================================

  function init() {
    buildMatrix();
    buildWires();
    bindEvents();
    initDocs();
    initNavigationGuard();
    syncShellCopy();
    resetPredictionForRound();
    renderAll();
    refreshProgress();
  }

  function bindEvents() {
    dom.startBombBtn.addEventListener('click', startRound);
    dom.startBombBtnInline.addEventListener('click', startRound);
    dom.guessForm.addEventListener('submit', submitGuess);
    dom.predictForm.addEventListener('submit', submitPrediction);
    dom.numberMatrix.addEventListener('click', handleMatrixClick);

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

    document.addEventListener('keydown', handleGlobalKeydown);
  }

  function buildMatrix() {
    const fragment = document.createDocumentFragment();

    for (let value = LOWER_BOUND; value <= UPPER_BOUND; value += 1) {
      const cell = document.createElement('span');
      cell.className = 'matrix-cell is-candidate';
      cell.dataset.value = String(value);
      cell.setAttribute('aria-hidden', 'true');
      cell.textContent = String(value);
      fragment.appendChild(cell);
      matrixCells.push(cell);
    }

    dom.numberMatrix.appendChild(fragment);
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
  // 回合流程
  // =========================================================

  function startRound() {
    if (ui.game && ui.game.status === 'playing' && !ui.navigationPending) return;

    clearTimers();
    hideBombResult();

    if (dom.switchDialog.open) {
      ui.switchConfirmed = true;
      dom.switchDialog.close('restart');
    }

    let nextState = ENGINE.createState();
    let retry = 0;
    while (ui.game && nextState.secret === ui.game.secret && retry < 3) {
      nextState = ENGINE.createState();
      retry += 1;
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

    dom.guessInput.value = '';
    dom.predictInput.value = '';
    dom.guessForm.classList.remove('is-shaking');
    dom.predictionCard.classList.remove('is-correct', 'is-wrong', 'is-shaking');
    dom.bombCard.classList.remove('is-critical', 'is-detonating');
    dom.screenFlash.classList.remove('is-active');

    setBombStatus('armed', '拆弹中');
    setFeedback('neutral', '训练模式启动：没有倒计时。先预测下一次 mid，再提交你的猜测。');
    dom.bombLead.textContent = '每次合法错误猜测剪断一根线。在 7 根线用完前锁定 1–100 中的密码。';
    resetPredictionForRound();
    renderAll();

    announce(`新一局开始。密码已经锁定，你有 ${MAX_WIRES} 根拆弹线。`);
    showToast(`训练模式启动 · ${MAX_WIRES} 根线就绪`, 'neutral');

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
    renderMatrix();
    renderState();
    renderWires();
    renderHistory();
    renderBombVisual();
    renderBombStatus();
    renderStats();
    renderPredictionControls();
    updateControls();
  }

  function renderMatrix() {
    const game = ui.game;
    const idle = !game;
    const playing = Boolean(game) && game.status === 'playing';
    const revealed = Boolean(game) && game.status !== 'playing';
    const low = idle ? LOWER_BOUND : game.low;
    const high = idle ? UPPER_BOUND : game.high;
    const guesses = idle ? new Map() : new Map(game.guesses.map((guess) => [guess.value, guess.comparison]));
    const lastGuess = idle ? null : game.lastGuess;
    const target = revealed ? game.secret : null;

    matrixCells.forEach((cell) => {
      const value = Number(cell.dataset.value);
      const inRange = value >= low && value <= high;
      const guessed = guesses.has(value);
      const isTarget = target !== null && value === target;
      const isCandidate = idle || (playing && inRange && !guessed);
      const isEliminated = !isTarget && !guessed && (idle ? false : (!playing || !inRange));

      cell.classList.toggle('is-candidate', isCandidate);
      cell.classList.toggle('is-eliminated', isEliminated);
      cell.classList.toggle('is-guess', guessed && !isTarget);
      cell.classList.toggle('is-last-guess', !isTarget && value === lastGuess);
      cell.classList.toggle('is-target', isTarget);
    });

    dom.numberMatrix.dataset.outcome = idle ? 'idle' : game.status;

    const remaining = idle
      ? UPPER_BOUND - LOWER_BOUND + 1
      : game.status === 'defused'
        ? 1
        : Math.max(0, high - low + 1);

    let summary = `1 到 100 的排爆矩阵。当前候选区间 ${low} 到 ${high}，共 ${remaining} 个候选数字`;

    if (game) {
      summary += `。已经猜过 ${game.guesses.length} 个数字`;
      if (game.status === 'defused') summary += `。拆弹成功，正确密码是 ${game.secret}`;
      else if (game.status === 'exploded') summary += `。炸弹爆炸，正确密码是 ${game.secret}`;
    } else {
      summary += '。全部数字仍在候选中';
    }

    dom.numberMatrix.setAttribute('aria-label', summary);
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

    dom.candidateBadge.classList.toggle('is-safe', Boolean(game) && game.status === 'defused');
    dom.candidateBadge.classList.toggle('is-boom', Boolean(game) && game.status === 'exploded');

    if (idle) {
      dom.candidateBadge.textContent = `候选 ${LOWER_BOUND}–${UPPER_BOUND}`;
      dom.guessHelp.textContent = '点击「开始拆弹」后开始。每轮先预测，再猜测。';
    } else if (playing) {
      dom.candidateBadge.textContent = `候选 ${low}–${high}`;
      dom.guessHelp.textContent = `当前候选区间 ${low}–${high}，共 ${remaining} 个数字。下一次 mid = ${mid}。`;
    } else if (game.status === 'defused') {
      dom.candidateBadge.textContent = `已锁定 ${game.secret}`;
      dom.guessHelp.textContent = `密码 ${game.secret} 已确认，共 ${game.guesses.length} 次猜测。`;
    } else {
      dom.candidateBadge.textContent = `密码 ${game.secret}`;
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

    dom.predictInput.disabled = !playing || locked;
    dom.predictSubmit.disabled = !playing || locked;
    dom.predictionCard.classList.toggle('is-locked', locked);
    dom.predictionCard.classList.toggle('is-idle', !ui.game);
  }

  function updateControls() {
    const playing = Boolean(ui.game) && ui.game.status === 'playing';
    const blocked = ui.navigationPending;
    const locked = playing || ui.resultOpen || ui.resultPending || ui.navigationPending;
    const canInput = playing && !blocked;

    dom.startBombBtn.disabled = locked;
    dom.guessInput.disabled = !canInput;
    dom.guessSubmit.disabled = !canInput;

    if (ui.navigationPending) {
      dom.startBombLabel.textContent = '正在切换…';
    } else if (playing) {
      dom.startBombLabel.textContent = '拆弹中…';
    } else if (ui.resultOpen || ui.resultPending) {
      dom.startBombLabel.textContent = '本局结束';
    } else if (!ui.game) {
      dom.startBombLabel.textContent = '开始拆弹';
    } else {
      dom.startBombLabel.textContent = '再拆一颗';
    }

    const showInlineStart = !playing && !ui.resultOpen && !ui.resultPending && !ui.navigationPending;
    dom.inlineStartRow.hidden = !showInlineStart;
    dom.startBombBtnInline.disabled = locked;
    dom.startBombLabelInline.textContent = !ui.game ? '开始拆弹' : '再拆一颗';

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
  // 其他交互
  // =========================================================

  function handleMatrixClick(event) {
    if (!(event.target instanceof Element)) return;

    const cell = event.target.closest('.matrix-cell');
    if (!cell || !ui.game || ui.game.status !== 'playing' || ui.navigationPending) return;

    const value = Number(cell.dataset.value);
    const eligible = value >= ui.game.low
      && value <= ui.game.high
      && !ui.game.guesses.some((guess) => guess.value === value);

    if (!eligible) return;

    dom.guessInput.value = String(value);
    dom.guessInput.focus({ preventScroll: true });
  }

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
