'use strict';

/**
 * Pure binary-search bomb state machine.
 * The UI consumes applyGuess() results; it should not duplicate the rules.
 */
(() => {
  const LOWER_BOUND = 1;
  const UPPER_BOUND = 100;
  const MAX_WIRES = 7;

  function maxGuesses(n = UPPER_BOUND - LOWER_BOUND + 1) {
    return Math.ceil(Math.log2(Math.max(1, n)));
  }

  function nextMid(low, high) {
    return low + Math.floor((high - low) / 2);
  }

  function randomSecret() {
    return LOWER_BOUND + Math.floor(Math.random() * (UPPER_BOUND - LOWER_BOUND + 1));
  }

  function createState(secret) {
    const nextSecret = Number.isInteger(secret) ? secret : randomSecret();

    return {
      secret: nextSecret,
      low: LOWER_BOUND,
      high: UPPER_BOUND,
      guesses: [],
      lastGuess: null,
      status: 'playing',
      wiresLeft: MAX_WIRES,
      maxWires: MAX_WIRES
    };
  }

  function cloneState(state) {
    return {
      secret: state.secret,
      low: state.low,
      high: state.high,
      guesses: state.guesses.map((guess) => ({ ...guess })),
      lastGuess: state.lastGuess,
      status: state.status,
      wiresLeft: state.wiresLeft,
      maxWires: state.maxWires
    };
  }

  function applyGuess(state, value) {
    if (!state || state.status !== 'playing') {
      return {
        ok: false,
        errorCode: 'game-over',
        error: '本局已经结束，请开始新的一局。'
      };
    }

    if (!Number.isInteger(value) || value < LOWER_BOUND || value > UPPER_BOUND) {
      return {
        ok: false,
        errorCode: 'invalid',
        error: '请输入 1–100 之间的整数。'
      };
    }

    if (state.guesses.some((guess) => guess.value === value)) {
      return {
        ok: false,
        errorCode: 'duplicate',
        error: '这个数字已经猜过了，换一个吧。'
      };
    }

    if (value < state.low || value > state.high) {
      return {
        ok: false,
        errorCode: 'out-of-range',
        error: `这个数字已经被排除了，当前候选区间是 ${state.low}–${state.high}。`
      };
    }

    const next = cloneState(state);
    const oldLow = next.low;
    const oldHigh = next.high;
    const comparison = value === next.secret
      ? 'hit'
      : value < next.secret ? 'low' : 'high';

    next.guesses.push({ value, comparison });
    next.lastGuess = value;
    next.wiresLeft = Math.max(0, next.wiresLeft - 1);

    if (comparison === 'low') {
      next.low = value + 1;
    } else if (comparison === 'high') {
      next.high = value - 1;
    }

    if (comparison === 'hit') {
      next.status = 'defused';
    } else if (next.wiresLeft <= 0) {
      next.status = 'exploded';
    }

    const remaining = comparison === 'hit'
      ? 1
      : Math.max(0, next.high - next.low + 1);

    const event = {
      i: state.guesses.length,
      type: 'compare',
      low: oldLow,
      high: oldHigh,
      mid: value,
      feedback: comparison,
      newLow: next.low,
      newHigh: next.high,
      remaining,
      guesses: next.guesses.length,
      wiresLeft: next.wiresLeft
    };

    return {
      ok: true,
      comparison,
      event,
      state: next
    };
  }

  function simulateOptimal(secret) {
    let state = createState(secret);
    const events = [];

    while (state.status === 'playing') {
      const mid = nextMid(state.low, state.high);
      const result = applyGuess(state, mid);
      if (!result.ok) break;

      events.push(result.event);
      state = result.state;
    }

    return {
      solved: state.status === 'defused',
      guesses: state.guesses.length,
      events,
      state
    };
  }

  window.BinaryEngine = {
    LOWER_BOUND,
    UPPER_BOUND,
    MAX_WIRES,
    maxGuesses,
    nextMid,
    createState,
    applyGuess,
    simulateOptimal
  };
})();
