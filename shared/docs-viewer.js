'use strict';

/**
 * 可复用的四语言源码与解析弹层。
 * 每个算法页面传入自己的语言数据与解析模板即可。
 */
(() => {
  const CODE_KEYWORDS = {
    cpp: new Set([
      'include', 'using', 'namespace', 'const', 'int', 'bool', 'double',
      'struct', 'class', 'operator', 'return', 'vector', 'pair', 'queue',
      'priority_queue', 'if', 'else', 'while', 'for', 'continue', 'break',
      'reverse', 'true', 'false', 'public', 'private', 'static', 'void'
    ]),
    java: new Set([
      'import', 'package', 'public', 'private', 'class', 'static', 'final',
      'int', 'long', 'boolean', 'void', 'new', 'return', 'if', 'else',
      'while', 'for', 'continue', 'break', 'true', 'false', 'null', 'this',
      'extends', 'implements', 'throws'
    ]),
    python: new Set([
      'from', 'import', 'def', 'return', 'if', 'else', 'elif', 'not', 'in',
      'and', 'or', 'while', 'for', 'continue', 'break', 'True', 'False',
      'None', 'set', 'abs', 'len', 'range'
    ]),
    go: new Set([
      'package', 'import', 'const', 'type', 'struct', 'func', 'var', 'make',
      'int', 'bool', 'for', 'if', 'else', 'range', 'return', 'continue',
      'break', 'nil', 'interface', 'len', 'append', 'true', 'false', 'new',
      'defer', 'go', 'map', 'switch', 'case'
    ])
  };

  function create(config) {
    const trigger = config.trigger;
    const languages = config.languages;

    if (!trigger || !languages || Object.keys(languages).length === 0) {
      if (trigger) {
        trigger.disabled = true;
        trigger.title = '源码数据未加载';
      }
      return null;
    }

    const languageKeys = Object.keys(languages);
    let activeLanguage = languageKeys[0];
    let isOpen = false;
    let lastFocused = null;
    let copyResetTimer = 0;

    const overlay = document.createElement('div');
    overlay.className = 'docs-overlay';
    overlay.id = 'algorithmDocsOverlay';
    overlay.hidden = true;

    overlay.innerHTML = `
      <section class="docs-panel" id="algorithmDocsPanel" role="dialog" aria-modal="true" aria-labelledby="algorithmDocsTitle" aria-describedby="algorithmDocsIntro">
        <header class="docs-header">
          <div class="docs-heading">
            <span class="docs-mark ${escapeHtml(String(config.mark || 'A*')).length > 2 ? 'is-wide' : ''}" aria-hidden="true">${escapeHtml(String(config.mark || 'A*'))}</span>
            <div>
              <p class="eyebrow">ALGORITHM NOTES</p>
              <h2 id="algorithmDocsTitle">${escapeHtml(config.title || '算法源码与解析')}</h2>
              <p class="docs-subtitle" id="algorithmDocsIntro">${escapeHtml(config.subtitle || '四种语言实现与逐步解析。')}</p>
            </div>
          </div>
          <button class="docs-close" id="algorithmDocsClose" type="button" aria-label="关闭源码解析">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </header>

        <div class="docs-body">
          <div class="docs-code-pane">
            <div class="docs-toolbar">
              <div class="language-tabs" id="algorithmDocsTabs" role="tablist" aria-label="选择源码语言"></div>
              <button class="copy-code-btn" id="algorithmDocsCopy" type="button">
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="7" y="7" width="8.8" height="9" rx="1.8" stroke="currentColor" stroke-width="1.5"/>
                  <path d="M12.6 5.5V4.8c0-1-.8-1.8-1.8-1.8H5.2c-1 0-1.8.8-1.8 1.8v7.1c0 1 .8 1.8 1.8 1.8h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
                <span id="algorithmDocsCopyLabel" aria-live="polite">复制代码</span>
              </button>
            </div>

            <div class="code-shell">
              <div class="code-shell-head">
                <span class="code-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                <span class="code-filename" id="algorithmDocsFilename"></span>
                <span class="code-language-chip" id="algorithmDocsChip"></span>
              </div>
              <div class="code-viewport" id="algorithmDocsViewport" role="tabpanel" tabindex="0">
                <pre class="code-block"><code id="algorithmDocsCode"></code></pre>
              </div>
            </div>

            <div class="lang-insight">
              <span class="lang-insight-tag" id="algorithmDocsInsightTag"></span>
              <p id="algorithmDocsNote"></p>
            </div>
          </div>

          <aside class="docs-analysis" id="algorithmDocsAnalysis" aria-label="算法详细解析"></aside>
        </div>
      </section>`;

    document.body.appendChild(overlay);

    const dom = {
      panel: document.getElementById('algorithmDocsPanel'),
      close: document.getElementById('algorithmDocsClose'),
      tabs: document.getElementById('algorithmDocsTabs'),
      copy: document.getElementById('algorithmDocsCopy'),
      copyLabel: document.getElementById('algorithmDocsCopyLabel'),
      filename: document.getElementById('algorithmDocsFilename'),
      chip: document.getElementById('algorithmDocsChip'),
      viewport: document.getElementById('algorithmDocsViewport'),
      code: document.getElementById('algorithmDocsCode'),
      insightTag: document.getElementById('algorithmDocsInsightTag'),
      note: document.getElementById('algorithmDocsNote'),
      analysis: document.getElementById('algorithmDocsAnalysis')
    };

    const template = config.analysisTemplateId
      ? document.getElementById(config.analysisTemplateId)
      : null;

    if (template) {
      dom.analysis.append(template.content.cloneNode(true));
    } else {
      dom.analysis.innerHTML = '<p class="analysis-copy">暂未提供解析内容。</p>';
    }

    bindEvents();
    renderLanguage(activeLanguage);

    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'algorithmDocsOverlay');

    function renderLanguage(languageKey) {
      const doc = languages[languageKey];
      if (!doc) return;

      activeLanguage = languageKey;

      Array.from(dom.tabs.querySelectorAll('.lang-tab')).forEach((tab) => {
        const active = tab.dataset.lang === languageKey;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
      });

      const activeTab = dom.tabs.querySelector(`[data-lang="${languageKey}"]`);

      dom.filename.textContent = doc.filename || '';
      dom.chip.textContent = doc.chip || '';
      dom.insightTag.textContent = `${doc.label || languageKey} 实现要点`;
      dom.note.textContent = doc.note || '';
      dom.code.innerHTML = formatCodeWithLineNumbers(doc.code || '', languageKey);

      if (activeTab) {
        dom.viewport.setAttribute('aria-labelledby', activeTab.id);
      }

      dom.viewport.scrollTop = 0;
      dom.viewport.scrollLeft = 0;

      window.clearTimeout(copyResetTimer);
      dom.copy.classList.remove('is-copied');
      dom.copyLabel.textContent = '复制代码';
    }

    function bindEvents() {
      dom.tabs.innerHTML = languageKeys
        .map((key) => {
          const doc = languages[key];
          return `<button class="lang-tab" id="algorithmDocsTab-${key}" type="button" role="tab" aria-selected="false" aria-controls="algorithmDocsViewport" data-lang="${key}" tabindex="-1">${escapeHtml(doc.label || key)}</button>`;
        })
        .join('');

      Array.from(dom.tabs.querySelectorAll('.lang-tab')).forEach((tab) => {
        tab.addEventListener('click', () => renderLanguage(tab.dataset.lang));
      });

      trigger.addEventListener('click', open);
      dom.close.addEventListener('click', close);

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) close();
      });

      dom.copy.addEventListener('click', copyCode);
      overlay.addEventListener('keydown', handleOverlayKeyDown);
    }

    function open() {
      if (isOpen) return;

      lastFocused = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : trigger;

      overlay.hidden = false;
      isOpen = true;
      document.body.classList.add('modal-open');

      if (typeof config.onOpen === 'function') {
        config.onOpen();
      }

      requestAnimationFrame(() => {
        dom.close.focus({ preventScroll: true });
      });
    }

    function close() {
      if (!isOpen) return;

      overlay.hidden = true;
      isOpen = false;
      document.body.classList.remove('modal-open');

      window.clearTimeout(copyResetTimer);
      dom.copy.classList.remove('is-copied');
      dom.copyLabel.textContent = '复制代码';

      const focusTarget = lastFocused && lastFocused.isConnected
        ? lastFocused
        : trigger;

      requestAnimationFrame(() => {
        if (!isOpen) {
          focusTarget.focus({ preventScroll: true });
        }
        if (typeof config.onClose === 'function') {
          config.onClose();
        }
      });
    }

    function handleOverlayKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }

      if (event.key === 'Tab') {
        trapFocus(event);
        event.stopPropagation();
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.classList.contains('lang-tab') &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)
      ) {
        const tabs = Array.from(dom.tabs.querySelectorAll('.lang-tab'));
        const currentIndex = tabs.indexOf(target);
        let nextIndex = currentIndex;

        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = tabs.length - 1;
        }

        const nextTab = tabs[nextIndex];
        if (nextTab) {
          event.preventDefault();
          event.stopPropagation();
          renderLanguage(nextTab.dataset.lang);
          nextTab.focus({ preventScroll: true });
        }
        return;
      }

      // 弹层打开时阻断游戏页面的全局快捷键，但保留浏览器默认行为。
      event.stopPropagation();
    }

    function trapFocus(event) {
      const focusable = Array.from(
        dom.panel.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')
      ).filter(
        (element) =>
          !element.hasAttribute('disabled') &&
          element.tabIndex >= 0 &&
          element.offsetParent !== null
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dom.panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      } else if (!dom.panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    async function copyCode() {
      const doc = languages[activeLanguage];
      if (!doc || !doc.code) return;

      let copied = false;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(doc.code);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied) copied = legacyCopyText(doc.code);

      dom.copy.classList.toggle('is-copied', copied);
      dom.copyLabel.textContent = copied ? '已复制' : '复制失败';
      dom.copy.focus({ preventScroll: true });

      window.clearTimeout(copyResetTimer);
      copyResetTimer = window.setTimeout(() => {
        dom.copy.classList.remove('is-copied');
        dom.copyLabel.textContent = '复制代码';
      }, 1600);
    }

    function legacyCopyText(value) {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);
      textarea.select();

      let copied = false;
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }

      textarea.remove();
      return copied;
    }

    return {
      open,
      close,
      isOpen: () => isOpen
    };
  }

  function formatCodeWithLineNumbers(code, lang) {
    return highlightCode(code, lang)
      .split('\n')
      .map((line) => `<span class="code-line">${line || ' '}</span>`)
      .join('');
  }

  function highlightCode(code, lang) {
    const keywords = CODE_KEYWORDS[lang] || new Set();
    const commentMarker = lang === 'python' ? '#' : '//';
    let output = '';
    let index = 0;

    while (index < code.length) {
      if (code.startsWith(commentMarker, index)) {
        const lineEnd = code.indexOf('\n', index);
        const end = lineEnd === -1 ? code.length : lineEnd;
        output += `<span class="token-comment">${escapeHtml(code.slice(index, end))}</span>`;
        index = end;
        continue;
      }

      const char = code[index];

      if (char === '"' || char === "'") {
        let end = index + 1;

        while (end < code.length) {
          if (code[end] === '\\') {
            end += 2;
            continue;
          }
          if (code[end] === char) {
            end += 1;
            break;
          }
          if (code[end] === '\n') break;
          end += 1;
        }

        output += `<span class="token-string">${escapeHtml(code.slice(index, end))}</span>`;
        index = end;
        continue;
      }

      if (isIdentifierStart(char)) {
        let end = index + 1;
        while (end < code.length && isIdentifierPart(code[end])) {
          end += 1;
        }

        const word = code.slice(index, end);
        output += keywords.has(word)
          ? `<span class="token-keyword">${escapeHtml(word)}</span>`
          : escapeHtml(word);
        index = end;
        continue;
      }

      if (isDigit(char)) {
        let end = index + 1;
        while (end < code.length && /[0-9._]/.test(code[end])) {
          end += 1;
        }
        output += `<span class="token-number">${escapeHtml(code.slice(index, end))}</span>`;
        index = end;
        continue;
      }

      output += escapeHtml(char);
      index += 1;
    }

    return output;
  }

  function isIdentifierStart(char) {
    return Boolean(char) && /[A-Za-z_]/.test(char);
  }

  function isIdentifierPart(char) {
    return Boolean(char) && /[A-Za-z0-9_]/.test(char);
  }

  function isDigit(char) {
    return Boolean(char) && /[0-9]/.test(char);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.AlgorithmDocsViewer = { create };
})();
