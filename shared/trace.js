'use strict';

/**
 * Shared trace helpers.
 * Kept as a plain IIFE so the pages still work from file://.
 */
(() => {
  const VERSION = 1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatMs(milliseconds) {
    return (Math.max(0, Number(milliseconds) || 0)).toFixed(2);
  }

  function formatSeconds(milliseconds) {
    return (Math.max(0, Number(milliseconds) || 0) / 1000).toFixed(2);
  }

  window.TraceUtils = {
    VERSION,
    clamp,
    formatMs,
    formatSeconds
  };
})();
