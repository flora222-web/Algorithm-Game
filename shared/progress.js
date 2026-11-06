'use strict';

/**
 * Tiny localStorage-backed progress store.
 * P1 adds per-level mastery on top of prediction accuracy.
 */
(() => {
  const STORAGE_KEY = 'algorithm-playground.progress.v1';
  let memory = {};
  let storageAvailable = true;

  try {
    const probe = '__algorithm_playground_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  } catch {
    storageAvailable = false;
  }

  function readAll() {
    if (!storageAvailable) return memory;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return memory;
    }
  }

  function writeAll(data) {
    memory = data;
    if (!storageAvailable) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      storageAvailable = false;
    }
  }

  function normalizeLevels(levels) {
    const result = {};
    if (!levels || typeof levels !== 'object') return result;

    Object.keys(levels).forEach((levelId) => {
      const level = levels[levelId] || {};
      result[levelId] = {
        attempts: Math.max(0, Number(level.attempts) || 0),
        passed: Boolean(level.passed),
        quizCorrect: Boolean(level.quizCorrect),
        lastResult: typeof level.lastResult === 'string' ? level.lastResult : 'none',
        updatedAt: Number(level.updatedAt) || 0
      };
    });

    return result;
  }

  function normalize(record) {
    const predictions = record && record.predictions ? record.predictions : {};
    const attempts = Math.max(0, Number(predictions.attempts) || 0);
    const correct = Math.min(attempts, Math.max(0, Number(predictions.correct) || 0));

    return {
      predictions: {
        attempts,
        correct,
        accuracy: attempts > 0 ? Number((correct / attempts).toFixed(3)) : 0
      },
      levels: normalizeLevels(record && record.levels),
      updatedAt: Number(record && record.updatedAt) || 0
    };
  }

  function get(module) {
    const data = readAll();
    return normalize(data[module]);
  }

  function recordPrediction(module, ok) {
    if (!module) return normalize(null);

    const data = readAll();
    const current = normalize(data[module]);
    const next = {
      ...current,
      predictions: {
        attempts: current.predictions.attempts + 1,
        correct: current.predictions.correct + (ok ? 1 : 0),
        accuracy: 0
      },
      updatedAt: Date.now()
    };

    next.predictions.accuracy = next.predictions.attempts > 0
      ? Number((next.predictions.correct / next.predictions.attempts).toFixed(3))
      : 0;

    data[module] = next;
    writeAll(data);
    return next;
  }

  function recordLevel(module, levelId, result = {}) {
    if (!module || !levelId) return get(module);

    const data = readAll();
    const current = normalize(data[module]);
    const previous = current.levels[levelId] || {
      attempts: 0,
      passed: false,
      quizCorrect: false,
      lastResult: 'none',
      updatedAt: 0
    };

    const passed = Boolean(result.passed);
    const quizCorrect = Boolean(result.quizCorrect);
    const lastResult = passed && quizCorrect
      ? 'pass'
      : passed
        ? 'partial'
        : 'fail';

    data[module] = {
      ...current,
      levels: {
        ...current.levels,
        [levelId]: {
          attempts: previous.attempts + 1,
          passed: previous.passed || passed,
          quizCorrect: previous.quizCorrect || quizCorrect,
          lastResult,
          updatedAt: Date.now()
        }
      },
      updatedAt: Date.now()
    };

    writeAll(data);
    return get(module);
  }

  function getLevels(module) {
    return get(module).levels;
  }

  function hasLevel(module, levelId) {
    const level = getLevels(module)[levelId];
    return Boolean(level && level.passed && level.quizCorrect);
  }

  function reset() {
    memory = {};
    if (!storageAvailable) return;

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      storageAvailable = false;
    }
  }

  window.ProgressStore = {
    get,
    recordPrediction,
    recordLevel,
    getLevels,
    hasLevel,
    reset
  };
})();
