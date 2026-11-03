'use strict';

/**
 * 全站共享的外壳：左上角品牌、算法切换菜单与导航守卫。
 * 页面通过 body[data-page] 和 body[data-root] 提供上下文。
 */
(() => {
  const PAGE_CONFIG = {
    home: {
      title: '算法游戏大厅',
      subtitle: '把抽象算法变成可以亲手操作的游戏。',
      meta: ['互动式算法学习', '2 个游戏'],
      switchLabel: '选择游戏'
    },
    astar: {
      title: '寻路实验室',
      subtitle: '在 20 × 20 网格里绘制障碍，观察 A* 如何找到最短路径。',
      meta: ['A* · 曼哈顿启发', '20 × 20 网格'],
      switchLabel: '切换游戏'
    },
    binary: {
      title: '二分拆弹',
      subtitle: '在 60 秒内，从 1–100 中找出唯一正确的密码。',
      meta: ['1–100 · 60 秒', '二分查找'],
      switchLabel: '切换游戏'
    }
  };

  const ICONS = {
    logo: `
      <svg viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M6.5 21.5v-3.2c0-2 1.6-3.6 3.6-3.6h8.4c2.2 0 4-1.8 4-4V7" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
        <circle cx="6.5" cy="22" r="2.6" fill="currentColor"/>
        <circle cx="22.5" cy="6" r="2.6" fill="currentColor"/>
        <path d="M13 14l2.8 2.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".7"/>
      </svg>`,
    switcher: `
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4.2 6.3h2.1c1.2 0 2 .6 2.7 1.5l2.1 3.4c.7.9 1.5 1.5 2.7 1.5h2M13.4 4.6l2.3 1.7-2.3 1.7M13.4 9.9l2.3 1.7-2.3 1.7M4.2 12.7h2.1c.9 0 1.6-.3 2.2-.9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    astar: `
      <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M4.5 17.2v-2.4c0-1.6 1.3-2.9 2.9-2.9h6.9c1.8 0 3.2-1.4 3.2-3.2V5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        <circle cx="4.5" cy="17.4" r="1.9" fill="currentColor"/>
        <circle cx="17.5" cy="5.2" r="1.9" fill="currentColor"/>
      </svg>`,
    binary: `
      <svg viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <circle cx="10" cy="12.2" r="6.1" stroke="currentColor" stroke-width="1.7"/>
        <path d="M13.8 6.3c.7-1.2 1.8-2 3-2.2M15.2 8.3l3.2-2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <circle cx="18.4" cy="6.1" r="1.5" fill="currentColor"/>
        <path d="M7.7 3.7h4.2M10 3.7v2.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    home: `
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m3.7 9.4 6.3-5.1 6.3 5.1v6.1c0 .7-.6 1.3-1.3 1.3H5c-.7 0-1.3-.6-1.3-1.3V9.4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M8 16.8v-4.3h4v4.3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
      </svg>`,
    arrow: `
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 10h11M10.5 5.5 15 10l-4.5 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    check: `
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m3.2 8.2 3 3 6.6-6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`
  };

  const pageKey = document.body.dataset.page || 'home';
  const root = document.body.dataset.root || '.';
  const config = PAGE_CONFIG[pageKey] || PAGE_CONFIG.home;
  const header = document.getElementById('siteHeader');

  const games = [
    {
      key: 'astar',
      label: 'A* 寻路',
      kicker: 'PATHFINDING',
      description: '绘制迷宫，观察最短路径如何被找到',
      href: `${root}/algorithms/astar/index.html`,
      icon: ICONS.astar
    },
    {
      key: 'binary',
      label: '二分拆弹',
      kicker: 'BINARY SEARCH',
      description: '60 秒内拆掉藏在 1–100 里的密码',
      href: `${root}/algorithms/binary-search/index.html`,
      icon: ICONS.binary
    }
  ];

  let navigationGuard = null;
  let menuOpen = false;
  let lastTrigger = null;
  let menu = null;
  let trigger = null;

  if (!header) return;

  renderHeader();
  bindEvents();

  function renderHeader() {
    header.classList.add('topbar');
    header.setAttribute('aria-label', '站点导航');

    const gameItems = games
      .map((game) => {
        const current = pageKey === game.key;
        if (current) {
          return `
            <span class="switcher-item is-current" aria-current="page">
              <span class="switcher-item-icon switcher-item-icon--${game.key}">${game.icon}</span>
              <span class="switcher-item-copy">
                <span class="switcher-item-label">${game.label}</span>
                <span class="switcher-item-description">${game.description}</span>
              </span>
              <span class="switcher-item-check">${ICONS.check}</span>
            </span>`;
        }

        return `
          <a class="switcher-item" href="${game.href}" data-nav-link>
            <span class="switcher-item-icon switcher-item-icon--${game.key}">${game.icon}</span>
            <span class="switcher-item-copy">
              <span class="switcher-item-label">${game.label}</span>
              <span class="switcher-item-description">${game.description}</span>
            </span>
            <span class="switcher-item-arrow">${ICONS.arrow}</span>
          </a>`;
      })
      .join('');

    const homeLink = pageKey === 'home'
      ? ''
      : `
        <a class="switcher-home" href="${root}/index.html" data-nav-link>
          <span class="switcher-home-icon">${ICONS.home}</span>
          <span>返回游戏大厅</span>
          <span class="switcher-home-arrow">${ICONS.arrow}</span>
        </a>`;

    const meta = config.meta
      .map((text, index) => {
        if (index === 0) {
          return `<span class="meta-pill"><span class="meta-dot" aria-hidden="true"></span>${text}</span>`;
        }
        return `<span class="meta-pill meta-pill--plain">${text}</span>`;
      })
      .join('');

    header.innerHTML = `
      <div class="brand-area">
        <a class="brand site-brand" href="${root}/index.html" data-nav-link aria-label="返回算法游戏大厅">
          <span class="logo" aria-hidden="true">${ICONS.logo}</span>
          <div class="brand-copy">
            <div class="eyebrow">ALGORITHM PLAYGROUND</div>
            <div class="brand-title-row"><h1>${config.title}</h1></div>
            <div class="brand-subtitle">${config.subtitle}</div>
          </div>
        </a>

        <div class="game-switcher">
          <button class="switcher-trigger" id="gameSwitcherTrigger" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="gameSwitcherMenu">
            <span class="switcher-trigger-icon" aria-hidden="true">${ICONS.switcher}</span>
            <span class="switcher-trigger-label">${config.switchLabel}</span>
            <svg class="switcher-caret" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="m2.5 4.5 3.5 3 3.5-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <div class="switcher-menu" id="gameSwitcherMenu" hidden>
            <div class="switcher-menu-head">
              <span>选择算法游戏</span>
              <span>2 GAMES</span>
            </div>
            ${gameItems}
            ${homeLink}
          </div>
        </div>
      </div>

      <div class="top-meta">${meta}</div>
    `;

    trigger = document.getElementById('gameSwitcherTrigger');
    menu = document.getElementById('gameSwitcherMenu');
  }

  function bindEvents() {
    if (!trigger || !menu) return;

    trigger.addEventListener('click', () => {
      if (menuOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu();
        const links = getMenuLinks();
        if (links.length > 0) {
          links[event.key === 'ArrowUp' ? links.length - 1 : 0].focus();
        }
      }
    });

    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu({ returnFocus: true });
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      const links = getMenuLinks();
      if (links.length === 0) return;

      event.preventDefault();
      const currentIndex = links.indexOf(document.activeElement);
      const nextIndex = event.key === 'ArrowDown'
        ? (currentIndex + 1) % links.length
        : (currentIndex - 1 + links.length) % links.length;
      links[nextIndex].focus();
    });

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (menuOpen && !target.closest('.game-switcher')) {
        closeMenu();
      }

      const navLink = target.closest('a[data-nav-link]');
      if (!navLink) return;

      if (menuOpen && menu.contains(navLink)) {
        closeMenu();
      }

      if (typeof navigationGuard === 'function' && navigationGuard(navLink.href, navLink) === false) {
        event.preventDefault();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuOpen) {
        event.preventDefault();
        closeMenu({ returnFocus: true });
      }
    });

    document.addEventListener('focusin', (event) => {
      if (!menuOpen) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!trigger.contains(target) && !menu.contains(target)) {
        closeMenu();
      }
    });
  }

  function getMenuLinks() {
    return Array.from(menu.querySelectorAll('a[href]'));
  }

  function openMenu() {
    menu.hidden = false;
    menuOpen = true;
    trigger.setAttribute('aria-expanded', 'true');
    lastTrigger = trigger;
  }

  function closeMenu({ returnFocus = false } = {}) {
    if (!menuOpen) return;

    menu.hidden = true;
    menuOpen = false;
    trigger.setAttribute('aria-expanded', 'false');

    if (returnFocus && lastTrigger) {
      lastTrigger.focus({ preventScroll: true });
    }
  }

  /**
   * 页面可注册一个切换守卫。返回 false 表示页面自行接管导航
   * （例如倒计时中的拆弹游戏需要先弹确认框）。
   */
  function setNavigationGuard(guard) {
    navigationGuard = typeof guard === 'function' ? guard : null;
  }

  window.SiteShell = {
    setNavigationGuard,
    closeMenu,
    openMenu
  };
})();
