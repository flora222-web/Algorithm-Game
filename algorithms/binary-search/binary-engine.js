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

  /**
   * Lower-bound / upper-bound walkthrough on a sorted array with duplicates.
   * mode='first': first index with value >= target (lower_bound).
   * mode='last': last index with value <= target; UI shows upper_bound - 1.
   */
  function createBoundState(values, target, mode = 'first') {
    const list = Array.isArray(values) ? values.slice() : [];

    return {
      values: list,
      target: Number(target),
      mode: mode === 'last' ? 'last' : 'first',
      low: 0,
      high: list.length - 1,
      mid: null,
      status: 'ready',
      index: null,
      found: false,
      events: []
    };
  }

  function cloneBoundState(state) {
    return {
      values: state.values.slice(),
      target: state.target,
      mode: state.mode,
      low: state.low,
      high: state.high,
      mid: state.mid,
      status: state.status,
      index: state.index,
      found: state.found,
      events: state.events.map((event) => ({ ...event }))
    };
  }

  function finishBoundState(next) {
    const index = next.mode === 'last' ? next.low - 1 : next.low;
    const found = index >= 0 && index < next.values.length && next.values[index] === next.target;

    next.status = 'done';
    next.mid = null;
    next.index = index;
    next.found = found;

    const event = {
      i: next.events.length,
      type: 'done',
      mode: next.mode,
      index,
      found
    };

    next.events.push(event);
    return { done: true, state: next, event };
  }

  function stepBound(state) {
    if (!state) return { done: true, state: null, event: null };
    if (state.status === 'done') return { done: true, state, event: null };

    const next = cloneBoundState(state);

    if (next.values.length === 0) {
      next.low = 0;
      next.high = -1;
      return finishBoundState(next);
    }

    if (next.low >= next.high) return finishBoundState(next);

    const mid = next.low + Math.floor((next.high - next.low) / 2);
    const value = next.values[mid];
    const decision = next.mode === 'first'
      ? (value < next.target ? 'right' : 'left')
      : (value <= next.target ? 'right' : 'left');
    const oldLow = next.low;
    const oldHigh = next.high;

    if (decision === 'right') {
      next.low = mid + 1;
    } else {
      next.high = mid;
    }

    next.mid = mid;
    next.status = 'stepping';

    const event = {
      i: next.events.length,
      type: 'compare',
      mode: next.mode,
      low: oldLow,
      high: oldHigh,
      mid,
      value,
      decision,
      newLow: next.low,
      newHigh: next.high
    };

    next.events.push(event);
    return { done: false, state: next, event };
  }

  function simulateBound(values, target, mode = 'first') {
    let state = createBoundState(values, target, mode);

    while (state.status !== 'done') {
      state = stepBound(state).state;
    }

    return {
      values: state.values,
      target: state.target,
      mode: state.mode,
      events: state.events,
      index: state.index,
      found: state.found,
      state
    };
  }

  /**
   * Monotone predicate walkthrough: find the smallest capacity that passes.
   * The predicate is hidden from the UI until the walkthrough ends.
   */
  function createPredicateState(options = {}) {
    const low = Number.isInteger(options.low) ? options.low : 1;
    const high = Number.isInteger(options.high) ? options.high : 100;
    const threshold = Number.isInteger(options.threshold) ? options.threshold : 60;

    return {
      low,
      high,
      threshold,
      mid: null,
      status: 'ready',
      answer: null,
      events: []
    };
  }

  function clonePredicateState(state) {
    return {
      low: state.low,
      high: state.high,
      threshold: state.threshold,
      mid: state.mid,
      status: state.status,
      answer: state.answer,
      events: state.events.map((event) => ({ ...event }))
    };
  }

  function finishPredicateState(next) {
    next.status = 'done';
    next.mid = null;
    next.answer = next.low;

    const event = {
      i: next.events.length,
      type: 'done',
      answer: next.answer
    };

    next.events.push(event);
    return { done: true, state: next, event };
  }

  function stepPredicate(state) {
    if (!state) return { done: true, state: null, event: null };
    if (state.status === 'done') return { done: true, state, event: null };

    const next = clonePredicateState(state);

    if (next.low >= next.high) return finishPredicateState(next);

    const mid = next.low + Math.floor((next.high - next.low) / 2);
    const passes = mid >= next.threshold;
    const oldLow = next.low;
    const oldHigh = next.high;

    if (passes) {
      next.high = mid;
    } else {
      next.low = mid + 1;
    }

    next.mid = mid;
    next.status = 'stepping';

    const event = {
      i: next.events.length,
      type: 'test',
      low: oldLow,
      high: oldHigh,
      mid,
      passes,
      newLow: next.low,
      newHigh: next.high
    };

    next.events.push(event);
    return { done: false, state: next, event };
  }

  function simulatePredicate(options = {}) {
    let state = createPredicateState(options);

    while (state.status !== 'done') {
      state = stepPredicate(state).state;
    }

    return {
      events: state.events,
      answer: state.answer,
      threshold: state.threshold,
      state
    };
  }

  /**
   * Run a deliberately buggy binary search to demonstrate an infinite loop.
   * bug='low-mid' keeps low = mid (instead of mid + 1); bug='high-mid' keeps high = mid.
   */
  function runBuggySearch(secret, options = {}) {
    const bug = options.bug === 'high-mid' ? 'high-mid' : 'low-mid';
    const maxSteps = Math.max(1, Number(options.maxSteps) || 16);
    let low = LOWER_BOUND;
    let high = UPPER_BOUND;
    const steps = [];
    const seen = new Set();
    let loopDetected = false;
    let repeatedState = null;

    for (let index = 0; index < maxSteps; index += 1) {
      if (low > high) break;

      const key = `${low}:${high}`;
      if (seen.has(key)) {
        loopDetected = true;
        repeatedState = { low, high };
        break;
      }
      seen.add(key);

      const mid = nextMid(low, high);
      const feedback = mid === secret ? 'hit' : mid < secret ? 'low' : 'high';
      const step = {
        i: index,
        low,
        high,
        mid,
        feedback,
        newLow: low,
        newHigh: high
      };

      if (feedback === 'hit') {
        steps.push(step);
        return {
          solved: true,
          loopDetected: false,
          repeatedState: null,
          steps,
          finalState: { low, high },
          bug,
          maxSteps
        };
      }

      if (feedback === 'low') {
        low = bug === 'low-mid' ? mid : mid + 1;
      } else if (bug === 'high-mid') {
        high = mid;
      } else {
        high = mid - 1;
      }

      step.newLow = low;
      step.newHigh = high;
      steps.push(step);
    }

    return {
      solved: false,
      loopDetected,
      repeatedState,
      steps,
      finalState: { low, high },
      bug,
      maxSteps
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
    simulateOptimal,
    runBuggySearch,
    createBoundState,
    stepBound,
    simulateBound,
    createPredicateState,
    stepPredicate,
    simulatePredicate
  };
})();
