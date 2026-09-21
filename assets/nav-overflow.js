/* SkyySchool — адаптивное меню шапки.
   Собирает ссылки из #mainMenu .appnav и переносит непоместившиеся
   верхнеуровневые группы/ссылки в «Ещё». */
(function () {
  'use strict';

  if (window.NavOverflow) return;

  const STYLE_ID = 'sky-nav-overflow-style';
  let boundRoot = null;
  let resizeObserver = null;
  let rafId = 0;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #mainMenu{
        flex:1 1 auto;
        min-width:0;
        margin-left:14px;
        position:relative;
      }
      #mainMenu > .appnav{
        display:flex;
        align-items:center;
        gap:2px;
        margin-left:0;
        min-width:0;
        width:100%;
        overflow:visible;
      }
      #mainMenu .appnav > a,
      #mainMenu .nav-group,
      #mainMenu .nav-overflow{
        flex:0 0 auto;
      }
      #mainMenu .nav-group{
        position:relative;
      }
      #mainMenu .nav-group-trigger,
      #mainMenu .nav-overflow-trigger{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        padding:8px 13px;
        border:0;
        border-radius:11px;
        background:transparent;
        color:var(--muted);
        font:inherit;
        font-size:13.5px;
        font-weight:800;
        white-space:nowrap;
        cursor:pointer;
        transition:.16s;
      }
      #mainMenu .nav-group-trigger:hover,
      #mainMenu .nav-group.is-open .nav-group-trigger,
      #mainMenu .nav-overflow.is-open .nav-overflow-trigger{
        color:var(--ink);
        background:var(--panel-2);
      }
      #mainMenu .nav-group.is-active > .nav-group-trigger{
        color:var(--accent);
        background:var(--m-learn-soft);
      }
      #mainMenu .nav-caret{
        display:inline-block;
        font-size:11px;
        line-height:1;
        transform:translateY(-1px);
        transition:transform .16s;
      }
      #mainMenu .nav-group.is-open .nav-caret,
      #mainMenu .nav-overflow.is-open .nav-caret{
        transform:rotate(180deg) translateY(1px);
      }
      #mainMenu .nav-group-menu,
      #mainMenu .nav-overflow-menu{
        position:absolute;
        top:calc(100% + 7px);
        left:0;
        z-index:75;
        min-width:190px;
        max-width:min(320px,calc(100vw - 24px));
        max-height:70vh;
        overflow:auto;
        padding:7px;
        background:var(--panel);
        border:1px solid var(--line);
        border-radius:15px;
        box-shadow:var(--shadow-lg);
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        transform:translateY(-4px);
        transition:opacity .14s,transform .14s,visibility .14s;
      }
      #mainMenu .nav-group.is-open > .nav-group-menu,
      #mainMenu .nav-overflow.is-open > .nav-overflow-menu{
        opacity:1;
        visibility:visible;
        pointer-events:auto;
        transform:translateY(0);
      }
      #mainMenu .nav-group-menu a,
      #mainMenu .nav-overflow-menu a{
        display:flex;
        align-items:center;
        min-width:0;
        padding:9px 11px;
        border-radius:10px;
        color:var(--ink-2);
        font-size:13px;
        font-weight:800;
        white-space:nowrap;
        text-decoration:none;
      }
      #mainMenu .nav-group-menu a:hover,
      #mainMenu .nav-overflow-menu a:hover{
        color:var(--ink);
        background:var(--panel-2);
      }
      #mainMenu .nav-group-menu a[aria-current="page"],
      #mainMenu .nav-overflow-menu a[aria-current="page"]{
        color:var(--accent);
        background:var(--m-learn-soft);
      }
      #mainMenu .nav-overflow{
        position:relative;
      }
      #mainMenu .nav-overflow-menu{
        left:auto;
        right:0;
        min-width:220px;
      }
      #mainMenu .nav-overflow-section{
        padding:7px 8px 4px;
      }
      #mainMenu .nav-overflow-title{
        padding:5px 7px;
        color:var(--faint);
        font-size:10.5px;
        font-weight:900;
        letter-spacing:.08em;
        text-transform:uppercase;
      }
      #mainMenu .nav-overflow-divider{
        height:1px;
        margin:6px 4px;
        background:var(--line);
      }
      @media (max-width:760px){
        #mainMenu{margin-left:4px}
        #mainMenu .nav-group-trigger,
        #mainMenu .nav-overflow-trigger,
        #mainMenu > .appnav > a{
          padding-left:9px;
          padding-right:9px;
          font-size:12.5px;
        }
      }
      @media (max-width:560px){
        #mainMenu .nav-overflow-menu{
          position:fixed;
          top:calc(var(--header-h) - 2px);
          right:8px;
          left:auto;
          max-width:calc(100vw - 16px);
          min-width:min(250px,calc(100vw - 16px));
        }
        #mainMenu .nav-group-menu{
          max-width:calc(100vw - 20px);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getRoot() {
    return document.querySelector('#mainMenu .appnav') ||
           document.querySelector('#mainMenu.appnav') ||
           document.querySelector('.appnav');
  }

  function closeMenus(root) {
    if (!root) return;
    root.querySelectorAll('.nav-group.is-open, .nav-overflow.is-open').forEach(item => {
      item.classList.remove('is-open');
      const trigger = item.querySelector(':scope > .nav-group-trigger, :scope > .nav-overflow-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function toggleMenu(root, item) {
    const wasOpen = item.classList.contains('is-open');
    root.querySelectorAll('.nav-group.is-open, .nav-overflow.is-open').forEach(openItem => {
      if (openItem !== item) {
        openItem.classList.remove('is-open');
        const trigger = openItem.querySelector(':scope > .nav-group-trigger, :scope > .nav-overflow-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });

    item.classList.toggle('is-open', !wasOpen);
    const trigger = item.querySelector(':scope > .nav-group-trigger, :scope > .nav-overflow-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', String(!wasOpen));
  }

  function buildMoreMenu(more, hiddenItems) {
    const menu = more.querySelector('.nav-overflow-menu');
    if (!menu) return;

    menu.innerHTML = '';
    hiddenItems.forEach(item => {
      if (item.matches('a')) {
        menu.appendChild(item.cloneNode(true));
        return;
      }

      if (!item.classList.contains('nav-group')) return;

      const section = document.createElement('div');
      section.className = 'nav-overflow-section';

      const title = document.createElement('div');
      title.className = 'nav-overflow-title';
      const trigger = item.querySelector(':scope > .nav-group-trigger');
      title.textContent = trigger ? trigger.textContent.replace(/\s*⌄\s*$/, '').trim() : '';
      section.appendChild(title);

      item.querySelectorAll(':scope > .nav-group-menu a').forEach(link => {
        section.appendChild(link.cloneNode(true));
      });

      if (menu.children.length) {
        const divider = document.createElement('div');
        divider.className = 'nav-overflow-divider';
        menu.appendChild(divider);
      }
      menu.appendChild(section);
    });
  }

  function ensureMore(root) {
    let more = root.querySelector(':scope > .nav-overflow');
    if (more) return more;

    more = document.createElement('div');
    more.className = 'nav-overflow';
    more.hidden = true;
    const isEnglish = (((window.Sky && Sky.lang) || document.documentElement.lang || 'ru') + '').toLowerCase().startsWith('en');
    more.innerHTML =
      '<button type="button" class="nav-overflow-trigger" aria-haspopup="menu" aria-expanded="false">' +
        '<span>' + (isEnglish ? 'More' : 'Ещё') + '</span>' +
        '<span class="nav-caret" aria-hidden="true">⌄</span>' +
      '</button>' +
      '<div class="nav-overflow-menu" role="menu"></div>';
    root.appendChild(more);
    return more;
  }

  function recalc() {
    const root = getRoot();
    if (!root) return;

    ensureStyles();

    if (boundRoot !== root) {
      boundRoot = root;

      if (resizeObserver) resizeObserver.disconnect();
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(recalc);
        });
        resizeObserver.observe(root);
      }
    }

    const more = ensureMore(root);
    const items = Array.from(root.children).filter(el => el !== more);

    items.forEach(item => {
      item.hidden = false;
      item.removeAttribute('aria-hidden');
    });

    more.hidden = false;
    more.style.visibility = 'hidden';
    const moreWidth = Math.ceil(more.getBoundingClientRect().width || 76);
    more.style.visibility = '';

    const available = root.clientWidth;
    const gap = parseFloat(getComputedStyle(root).columnGap || getComputedStyle(root).gap || '2') || 2;
    if (!available) {
      more.hidden = true;
      return;
    }

    let used = 0;
    const hidden = [];

    for (const item of items) {
      if (hidden.length) {
        hidden.push(item);
        continue;
      }

      const width = Math.ceil(item.getBoundingClientRect().width);
      const itemGap = used ? gap : 0;
      const reserveMore = moreWidth + gap;

      if (used + itemGap + width + reserveMore <= available) {
        used += itemGap + width;
      } else {
        hidden.push(item);
      }
    }

    if (!hidden.length) {
      more.hidden = true;
      closeMenus(root);
      return;
    }

    hidden.forEach(item => {
      item.hidden = true;
      item.setAttribute('aria-hidden', 'true');
      item.classList.remove('is-open');
      const trigger = item.querySelector(':scope > .nav-group-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });

    buildMoreMenu(more, hidden);
    more.hidden = false;
  }

  function bindRoot(root) {
    if (root.__skyNavOverflowBound) return;
    root.__skyNavOverflowBound = true;

    root.addEventListener('click', function (event) {
      const trigger = event.target.closest('.nav-group-trigger, .nav-overflow-trigger');
      if (!trigger || !root.contains(trigger)) return;
      event.preventDefault();
      toggleMenu(root, trigger.parentElement);
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenus(root);
    });

    if (!document.__skyNavOverflowOutsideBound) {
      document.__skyNavOverflowOutsideBound = true;
      document.addEventListener('click', function (event) {
        const activeRoot = getRoot();
        if (!activeRoot || activeRoot.contains(event.target)) return;
        closeMenus(activeRoot);
      });
    }
  }

  function init() {
    ensureStyles();
    const root = getRoot();
    if (!root) return;
    bindRoot(root);
    recalc();
  }

  window.NavOverflow = { init, recalc, close: closeMenus };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('resize', function () {
    clearTimeout(window.__skyNavOverflowResize);
    window.__skyNavOverflowResize = setTimeout(recalc, 40);
  });
})();
