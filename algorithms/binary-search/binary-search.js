'use strict';

/**
 * 二分拆弹
 * ------------------------------------------------------------
 * 60 秒倒计时 + 1–100 的二分查找小游戏。
 * 每次错误猜测都会排除一侧区间，并同步更新 1–100 的可视化进度条。
 */
(() => {
  const ROUND_MS = 60_000;
  const LOWER_BOUND = 1;
  const UPPER_BOUND = 100;
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
    bombStatus: document.getElementById('bombStatus'),
    bombStatusText: document.getElementById('bombStatusText'),
    bombLead: document.getElementById('bombLead'),

    guessForm: document.getElementById('guessForm'),
    guessInput: document.getElementById('guessInput'),
    guessSubmit: document.getElementById('guessSubmit'),
    guessHelp: document.getElementById('guessHelp'),
    feedbackBox: document.getElementById('feedbackBox'),
    feedbackText: document.getElementById('feedbackText'),

    numberTrack: document.getElementById('numberTrack'),
    candidateBadge: document.getElementById('candidateBadge'),
    candidateCount: document.getElementById('candidateCount'),
    eliminatedCount: document.getElementById('eliminatedCount'),
    attemptCount: document.getElementById('attemptCount'),
    guessChips: document.getElementById('guessChips'),

    startBombBtn: document.getElementById('startBombBtn'),
    startBombLabel: document.getElementById('startBombLabel'),

    bombResultOverlay: document.getElementById('bombResultOverlay'),
    bombResultCard: document.querySelector('.bomb-result-card'),
    bombResultIcon: document.getElementById('bombResultIcon'),
    bombResultKicker: document.getElementById('bombResultKicker'),
    bombResultTitle: document.getElementById('bombResultTitle'),
    bombResultMessage: document.getElementById('bombResultMessage'),
    bombResultTarget: document.getElementById('bombResultTarget'),
    bombResultGuesses: document.getElementById('bombResultGuesses'),
    bombResultTime: document.getElementById('bombResultTime'),
    bombResultAction: document.getElementById('bombResultAction'),

    switchDialog: document.getElementById('switchDialog'),
    switchCancel: document.getElementById('switchCancel'),
    switchConfirm: document.getElementById('switchConfirm'),

    screenFlash: document.getElementById('screenFlash'),
    openDocsBtn: document.getElementById('openDocsBtn'),
    liveRegion: document.getElementById('liveRegion')
  };

  const state = {
    phase: 'idle', // idle | playing | defused | exploded
    target: null,
    low: LOWER_BOUND,
    high: UPPER_BOUND,
    guesses: [],
    lastGuess: null,
    remainingMs: ROUND_MS,
    deadline: 0,
    tickId: 0,
    pauseReasons: new Set(),

    resultOpen: false,
    resultPending: false,
    resultTimer: 0,
    navigationPending: false,
    pendingHref: null,
    switchConfirmed: false,
    navigationTimer: 0,
    flashTimer: 0,
    shakeTimer: 0,
    errorTimer: 0,
    docsViewer: null
  };

  const trackCells = [];

  init();

  function init() {
    createNumberTrack();
    bindEvents();
    initDocs();
    initNavigationGuard();
    resetToIdle();
  }

  function bindEvents() {
    dom.startBombBtn.addEventListener('click', startRound);
    dom.guessForm.addEventListener('submit', submitGuess);

    dom.bombResultAction.addEventListener('click', () => {
      hideBombResult();
      startRound();
    });

    dom.bombResultOverlay.addEventListener('click', (event) => {
      if (event.target === dom.bombResultOverlay) {
        hideBombResult({ focusStart: true });
      }
    });

    dom.bombResultOverlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
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
  }

  function initDocs() {
    if (!window.AlgorithmDocsViewer || !window.BINARY_SEARCH_DOCS) {
      dom.openDocsBtn.disabled = true;
      dom.openDocsBtn.title = '源码数据未加载';
      return;
    }

    state.docsViewer = window.AlgorithmDocsViewer.create({
      trigger: dom.openDocsBtn,
      title: '二分查找源码与解析',
      subtitle: '用一个 60 秒拆弹游戏理解二分查找：每次比较都丢掉一半候选。',
      mark: '1–100',
      languages: window.BINARY_SEARCH_DOCS,
      analysisTemplateId: 'binaryDocsAnalysis',
      onOpen: () => pauseTimer('docs'),
      onClose: () => resumeTimer('docs')
    });
  }

  function initNavigationGuard() {
    if (!window.SiteShell || typeof window.SiteShell.setNavigationGuard !== 'function') return;

    window.SiteShell.setNavigationGuard((href) => {
      if (state.phase !== 'playing' || state.navigationPending) return true;
      openSwitchDialog(href);
      return false;
    });
  }

  // =========================================================
  // 初始状态与回合流程
  // =========================================================

  function resetToIdle() {
    stopTick();
    window.clearTimeout(state.resultTimer);
    window.clearTimeout(state.navigationTimer);

    state.phase = 'idle';
    state.target = null;
    state.low = LOWER_BOUND;
    state.high = UPPER_BOUND;
    state.guesses = [];
    state.lastGuess = null;
    state.remainingMs = ROUND_MS;
    state.deadline = 0;
    state.pauseReasons.clear();
    state.resultPending = false;
    state.navigationPending = false;
    state.pendingHref = null;
    state.switchConfirmed = false;

    hideBombResult();
    dom.bombVisual.dataset.state = 'idle';
    dom.bombCard.classList.remove('is-critical', 'is-detonating');
    dom.guessInput.value = '';
    dom.guessInput.disabled = true;
    dom.guessSubmit.disabled = true;

    setBombStatus('idle', '等待开始');
    setFeedback('neutral', '准备好后点击「开始拆弹」。你有整整 60 秒。');
    dom.bombLead.textContent = '正确数字藏在 1–100 之间。每猜一次，会排除掉一半左右的候选区间。';
    dom.guessHelp.textContent = '点击「开始拆弹」后开始倒计时。';

    renderAll();
    updateControls();
    renderTimer();
  }

  function startRound() {
    if (state.phase === 'playing') return;

    stopTick();
    window.clearTimeout(state.resultTimer);
    window.clearTimeout(state.navigationTimer);
    window.clearTimeout(state.flashTimer);
    window.clearTimeout(state.shakeTimer);

    hideBombResult();

    if (dom.switchDialog.open) {
      state.switchConfirmed = true;
      dom.switchDialog.close('restart');
    }

    const previousTarget = state.target;
    let nextTarget = randomTarget();

    while (previousTarget !== null && nextTarget === previousTarget) {
      nextTarget = randomTarget();
    }

    state.phase = 'playing';
    state.target = nextTarget;
    state.low = LOWER_BOUND;
    state.high = UPPER_BOUND;
    state.guesses = [];
    state.lastGuess = null;
    state.remainingMs = ROUND_MS;
    state.deadline = 0;
    state.pauseReasons.clear();
    state.resultPending = false;
    state.navigationPending = false;
    state.pendingHref = null;
    state.switchConfirmed = false;

    dom.bombVisual.dataset.state = 'playing';
    dom.bombCard.classList.remove('is-critical', 'is-detonating');
    dom.screenFlash.classList.remove('is-active');

    dom.guessInput.value = '';
    dom.guessInput.disabled = false;
    dom.guessSubmit.disabled = false;

    setBombStatus('armed', '倒计时中');
    setFeedback('neutral', '密码已经随机锁定。试着从区间中点开始，比如 50。');
    dom.bombLead.textContent = '每猜一次，系统都会告诉你密码更大还是更小。';
    dom.guessHelp.textContent = '当前候选区间：1–100，共 100 个数字。';

    renderAll();
    updateControls();
    startCountdown();

    announce('拆弹开始，倒计时 60 秒。');

    requestAnimationFrame(() => {
      dom.guessInput.focus({ preventScroll: true });
    });
  }

  function submitGuess(event) {
    event.preventDefault();

    if (state.phase !== 'playing' || state.pauseReasons.size > 0) return;

    // 如果计时已归零但 interval 还没来得及触发，不允许在最后一刻“抢答”。
    if (currentRemaining() <= 0) {
      detonate('timeout');
      return;
    }

    const rawValue = dom.guessInput.value.trim();

    if (!/^\d+$/.test(rawValue)) {
      showGuessError('请输入 1–100 之间的整数。');
      return;
    }

    const value = Number(rawValue);

    if (!Number.isInteger(value) || value < LOWER_BOUND || value > UPPER_BOUND) {
      showGuessError('请输入 1–100 之间的整数。');
      return;
    }

    if (state.guesses.some((guess) => guess.value === value)) {
      showGuessError('这个数字已经猜过了，换一个吧。');
      return;
    }

    if (value < state.low || value > state.high) {
      showGuessError(`这个数字已经被排除了，当前候选区间是 ${state.low}–${state.high}。`);
      return;
    }

    const secret = state.target;

    if (value === secret) {
      state.guesses.push({ value, comparison: 'hit' });
      state.lastGuess = value;
      defuseRound();
      return;
    }

    if (value < secret) {
      state.guesses.push({ value, comparison: 'low' });
      state.low = value + 1;
    } else {
      state.guesses.push({ value, comparison: 'high' });
      state.high = value - 1;
    }

    state.lastGuess = value;

    const remaining = state.high - state.low + 1;
    const hint = value < secret
      ? `${value} 太小了 ↑ 密码更大。新的候选区间：${state.low}–${state.high}，还剩 ${remaining} 个数字。`
      : `${value} 太大了 ↓ 密码更小。新的候选区间：${state.low}–${state.high}，还剩 ${remaining} 个数字。`;

    setFeedback(value < secret ? 'low' : 'high', hint);
    dom.bombLead.textContent = `候选区间缩小到 ${state.low}–${state.high}。继续拆弹。`;

    dom.guessInput.value = '';
    renderAll();
    dom.guessInput.focus({ preventScroll: true });
  }

  function showGuessError(message) {
    setFeedback('error', message);
    dom.guessForm.classList.remove('is-shaking');
    void dom.guessForm.offsetWidth;
    dom.guessForm.classList.add('is-shaking');

    window.clearTimeout(state.errorTimer);
    state.errorTimer = window.setTimeout(() => {
      dom.guessForm.classList.remove('is-shaking');
    }, 360);

    dom.guessInput.focus({ preventScroll: true });
    dom.guessInput.select();
  }

  function defuseRound() {
    if (state.phase !== 'playing') return;

    const remaining = currentRemaining();
    stopTick();

    state.phase = 'defused';
    state.remainingMs = Math.max(0, remaining);
    state.pauseReasons.clear();
    state.resultPending = true;

    dom.bombVisual.dataset.state = 'defused';
    dom.bombCard.classList.remove('is-critical', 'is-detonating');

    setBombStatus('defused', '已拆除');
    setFeedback('success', `密码正确！就是 ${state.target}。炸弹已停止。`);
    dom.bombLead.textContent = '拆弹成功，倒计时已经停止。';
    dom.guessInput.value = '';

    renderAll();
    updateControls();
    renderTimer();

    announce(`拆弹成功！密码是 ${state.target}，共猜测 ${state.guesses.length} 次。`);

    scheduleResult(true);
  }

  function detonate(reason) {
    if (state.phase !== 'playing') return;

    stopTick();

    state.phase = 'exploded';
    state.remainingMs = 0;
    state.pauseReasons.clear();

    dom.bombVisual.dataset.state = 'exploded';
    dom.bombCard.classList.remove('is-critical');
    dom.bombCard.classList.remove('is-detonating');

    void dom.bombCard.offsetWidth;
    dom.bombCard.classList.add('is-detonating');
    dom.screenFlash.classList.remove('is-active');
    void dom.screenFlash.offsetWidth;
    dom.screenFlash.classList.add('is-active');

    window.clearTimeout(state.shakeTimer);
    state.shakeTimer = window.setTimeout(() => {
      dom.bombCard.classList.remove('is-detonating');
    }, 600);

    window.clearTimeout(state.flashTimer);
    state.flashTimer = window.setTimeout(() => {
      dom.screenFlash.classList.remove('is-active');
    }, 900);

    setBombStatus('exploded', '炸弹爆炸');
    renderAll();
    renderTimer();

    if (reason === 'switch') {
      state.navigationPending = true;
      setFeedback('danger', '炸弹已引爆。正在前往新的算法游戏…');
      dom.bombLead.textContent = '本次拆弹已结束，即将切换页面。';
      updateControls();
      announce('炸弹已引爆，正在切换算法游戏。');
      return;
    }

    state.resultPending = true;
    setFeedback('danger', `时间耗尽，炸弹爆炸！正确密码是 ${state.target}。`);
    dom.bombLead.textContent = '倒计时归零，密码已经揭晓。';

    updateControls();
    announce(`炸弹爆炸！正确密码是 ${state.target}，共猜测 ${state.guesses.length} 次。`);

    scheduleResult(false);
  }

  function scheduleResult(success) {
    window.clearTimeout(state.resultTimer);
    state.resultTimer = window.setTimeout(() => {
      state.resultPending = false;
      showBombResult(success);
      updateControls();
    }, reduceMotion ? 0 : success ? 280 : 440);
  }

  // =========================================================
  // 计时器
  // =========================================================

  function startCountdown() {
    stopTick();
    if (state.phase !== 'playing' || state.pauseReasons.size > 0) return;

    state.deadline = performance.now() + state.remainingMs;
    state.tickId = window.setInterval(tick, 100);
    renderTimer();
  }

  function stopTick() {
    if (!state.tickId) return;
    window.clearInterval(state.tickId);
    state.tickId = 0;
  }

  function tick() {
    if (state.phase !== 'playing' || state.pauseReasons.size > 0) return;

    state.remainingMs = Math.max(0, state.deadline - performance.now());
    renderTimer();

    if (state.remainingMs <= 0) {
      detonate('timeout');
    }
  }

  function currentRemaining() {
    if (state.phase !== 'playing') return state.remainingMs;
    if (state.pauseReasons.size > 0) return state.remainingMs;
    return Math.max(0, state.deadline - performance.now());
  }

  function pauseTimer(reason) {
    if (state.phase !== 'playing') return;
    if (state.pauseReasons.has(reason)) return;

    if (state.pauseReasons.size === 0) {
      state.remainingMs = Math.max(0, state.deadline - performance.now());
      stopTick();
    }

    state.pauseReasons.add(reason);
    dom.bombVisual.dataset.state = 'paused';
    setBombStatus('paused', '已暂停');
    renderTimer();
  }

  function resumeTimer(reason) {
    if (!state.pauseReasons.has(reason)) return;

    state.pauseReasons.delete(reason);
    if (state.phase !== 'playing' || state.pauseReasons.size > 0) return;

    if (state.remainingMs <= 0) {
      detonate('timeout');
      return;
    }

    dom.bombVisual.dataset.state = 'playing';
    setBombStatus('armed', '倒计时中');
    startCountdown();
  }

  function renderTimer() {
    const remaining = Math.max(0, state.remainingMs);
    dom.bombTime.textContent = formatClock(remaining);
    dom.bombTime.setAttribute('aria-label', `剩余时间 ${formatClock(remaining)}`);

    const ratio = clamp(remaining / ROUND_MS, 0, 1);
    dom.bombVisual.style.setProperty('--time-angle', `${(ratio * 360).toFixed(1)}deg`);

    const isCritical = state.phase === 'playing' && remaining > 0 && remaining <= 10_000;
    dom.bombCard.classList.toggle('is-critical', isCritical);
  }

  function formatClock(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // =========================================================
  // 渲染 1–100 与统计
  // =========================================================

  function createNumberTrack() {
    const fragment = document.createDocumentFragment();

    for (let value = LOWER_BOUND; value <= UPPER_BOUND; value += 1) {
      const cell = document.createElement('span');
      cell.className = 'range-cell';
      cell.setAttribute('aria-hidden', 'true');
      cell.dataset.value = String(value);
      cell.style.setProperty('--cell-hue', String(44 - (value - 1) * 0.36));
      fragment.appendChild(cell);
      trackCells.push(cell);
    }

    dom.numberTrack.appendChild(fragment);
  }

  function renderAll() {
    renderTrack();
    renderStats();
    renderGuessChips();
    updateCandidateCopy();
  }

  function renderTrack() {
    const guessedValues = new Set(state.guesses.map((guess) => guess.value));
    const revealed = state.phase === 'defused' || state.phase === 'exploded';

    trackCells.forEach((cell) => {
      const value = Number(cell.dataset.value);
      const eliminated = value < state.low || value > state.high;

      cell.classList.toggle('is-eliminated', eliminated);
      cell.classList.toggle('is-guess', guessedValues.has(value));
      cell.classList.toggle('is-last-guess', value === state.lastGuess);
      cell.classList.toggle('is-target', revealed && value === state.target);
    });

    dom.numberTrack.dataset.outcome = state.phase === 'exploded' ? 'exploded' : state.phase === 'defused' ? 'defused' : '';

    const remaining = state.high - state.low + 1;
    dom.numberTrack.setAttribute(
      'aria-label',
      `1 到 100 的候选数字范围，当前保留 ${state.low} 到 ${state.high}，共 ${remaining} 个候选数字`
    );

    dom.candidateBadge.classList.toggle('is-safe', state.phase === 'defused');
    dom.candidateBadge.classList.toggle('is-boom', state.phase === 'exploded');

    if (state.phase === 'defused') {
      dom.candidateBadge.textContent = `已锁定 ${state.target}`;
    } else if (state.phase === 'exploded') {
      dom.candidateBadge.textContent = `密码 ${state.target}`;
    } else if (state.phase === 'idle') {
      dom.candidateBadge.textContent = '候选 1–100';
    } else {
      dom.candidateBadge.textContent = `候选 ${state.low}–${state.high}`;
    }
  }

  function renderStats() {
    const candidates = Math.max(0, state.high - state.low + 1);
    dom.candidateCount.textContent = String(candidates);
    dom.eliminatedCount.textContent = String(UPPER_BOUND - LOWER_BOUND + 1 - candidates);
    dom.attemptCount.textContent = String(state.guesses.length);
  }

  function renderGuessChips() {
    if (state.guesses.length === 0) {
      dom.guessChips.innerHTML = '<span class="guess-empty">还没有猜测</span>';
      return;
    }

    dom.guessChips.innerHTML = state.guesses
      .map((guess) => {
        if (guess.comparison === 'hit') {
          return `<span class="guess-chip guess-chip--hit">${guess.value} ✓</span>`;
        }
        if (guess.comparison === 'low') {
          return `<span class="guess-chip guess-chip--low">${guess.value} ↑</span>`;
        }
        return `<span class="guess-chip guess-chip--high">${guess.value} ↓</span>`;
      })
      .join('');
  }

  function updateCandidateCopy() {
    const remaining = Math.max(0, state.high - state.low + 1);

    if (state.phase === 'idle') {
      dom.guessHelp.textContent = '点击「开始拆弹」后开始倒计时。';
    } else if (state.phase === 'playing') {
      dom.guessHelp.textContent = `当前候选区间：${state.low}–${state.high}，共 ${remaining} 个数字。`;
    } else if (state.phase === 'defused') {
      dom.guessHelp.textContent = `密码 ${state.target} 已确认，炸弹已拆除。`;
    } else {
      dom.guessHelp.textContent = `密码是 ${state.target}，时间耗尽。`;
    }
  }

  // =========================================================
  // 结果与切换
  // =========================================================

  function showBombResult(success) {
    const guessCount = state.guesses.length;
    const remaining = state.remainingMs;

    state.resultOpen = true;
    state.resultPending = false;

    dom.bombResultOverlay.classList.toggle('is-failure', !success);
    dom.bombResultIcon.innerHTML = success ? ICONS.success : ICONS.explosion;
    dom.bombResultKicker.textContent = success ? 'BOMB DEFUSED' : 'BOMB DETONATED';
    dom.bombResultTitle.textContent = success ? '拆弹成功！' : '炸弹爆炸！';
    dom.bombResultMessage.textContent = success
      ? `正确密码是 ${state.target}。你还剩余 ${formatClock(remaining)} 秒。`
      : `时间到，密码原来是 ${state.target}。这一轮你一共猜测了 ${guessCount} 次。`;
    dom.bombResultTarget.textContent = String(state.target);
    dom.bombResultGuesses.textContent = String(guessCount);
    dom.bombResultTime.textContent = formatClock(remaining);
    dom.bombResultAction.textContent = success ? '再拆一颗' : '重新拆弹';

    dom.bombResultOverlay.hidden = false;
    updateControls();

    requestAnimationFrame(() => {
      dom.bombResultAction.focus({ preventScroll: true });
    });
  }

  function hideBombResult({ focusStart = false } = {}) {
    dom.bombResultOverlay.hidden = true;
    state.resultOpen = false;
    state.resultPending = false;
    window.clearTimeout(state.resultTimer);

    updateControls();

    if (focusStart) {
      dom.startBombBtn.focus({ preventScroll: true });
    }
  }

  function updateControls() {
    const playing = state.phase === 'playing';
    const locked = playing || state.resultOpen || state.resultPending || state.navigationPending;

    dom.startBombBtn.disabled = locked;
    dom.guessInput.disabled = !playing;
    dom.guessSubmit.disabled = !playing;

    if (state.navigationPending) {
      dom.startBombLabel.textContent = '正在切换…';
    } else if (playing) {
      dom.startBombLabel.textContent = '倒计时中…';
    } else if (state.resultOpen || state.resultPending) {
      dom.startBombLabel.textContent = '拆弹结束';
    } else if (state.phase === 'idle') {
      dom.startBombLabel.textContent = '开始拆弹';
    } else {
      dom.startBombLabel.textContent = '再拆一颗';
    }
  }

  function openSwitchDialog(href) {
    if (state.phase !== 'playing' || dom.switchDialog.open) return;

    state.pendingHref = href;
    state.switchConfirmed = false;
    pauseTimer('switch-dialog');
    document.body.classList.add('bomb-modal-open');
    dom.switchDialog.showModal();

    requestAnimationFrame(() => {
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

    if (state.switchConfirmed) return;

    state.pendingHref = null;
    resumeTimer('switch-dialog');
  }

  function confirmSwitch() {
    const href = state.pendingHref;
    state.switchConfirmed = true;
    state.navigationPending = Boolean(href);

    if (dom.switchDialog.open) {
      dom.switchDialog.close('confirm');
    }

    detonate('switch');
    updateControls();

    if (!href) return;

    window.clearTimeout(state.navigationTimer);
    state.navigationTimer = window.setTimeout(() => {
      window.location.assign(href);
    }, reduceMotion ? 350 : 1100);
  }

  // =========================================================
  // 工具
  // =========================================================

  function setBombStatus(status, text) {
    dom.bombStatus.dataset.state = status;
    dom.bombStatusText.textContent = text;
  }

  function setFeedback(tone, text) {
    dom.feedbackBox.dataset.tone = tone;
    dom.feedbackText.textContent = text;
  }

  function randomTarget() {
    return LOWER_BOUND + Math.floor(Math.random() * (UPPER_BOUND - LOWER_BOUND + 1));
  }

  function announce(message) {
    dom.liveRegion.textContent = '';
    window.setTimeout(() => {
      dom.liveRegion.textContent = message;
    }, 30);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
})();
