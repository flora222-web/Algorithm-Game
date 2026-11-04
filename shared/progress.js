'use strict';

/**
 * Tiny localStorage-backed progress store.
 * Only prediction accuracy is needed for P0, but the shape can grow.
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
    reset
  };
})();
