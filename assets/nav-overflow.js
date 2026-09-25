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

      /* Плавное ПОЯВЛЕНИЕ пункта. Исчезновение намеренно мгновенное:
         затухание на 150 мс держало бы место в строке эти 150 мс, и
         рывок, ради которого всё затевалось, стал бы только заметнее. */
      #mainMenu .appnav > a,
      #mainMenu .nav-group{
        transition:opacity .15s ease;
      }
      #mainMenu .appnav > a.nav-enter,
      #mainMenu .nav-group.nav-enter{
        opacity:0;
      }
      @media (prefers-reduced-motion:reduce){
        #mainMenu .appnav > a,
        #mainMenu .nav-group{transition:none}
      }

      /* Текущая страница уехала под «Ещё» — подсвечиваем кнопку. */
      #mainMenu .nav-overflow-trigger.active{
        color:var(--ink);
        background:var(--panel-2);
      }
      #mainMenu .nav-overflow.has-current .nav-overflow-trigger.active::after{
        content:'';
        position:absolute;
        left:13px;right:13px;bottom:4px;
        height:2px;border-radius:2px;
        background:currentColor;
      }
      #mainMenu .nav-overflow-trigger{position:relative}

      /* На узких экранах подпись «Ещё» не влезает: инструменты справа
         занимают 250 из 390 пикселей, меню остаётся 54, а кнопка с
         подписью требует 63 — и ряд торчал за край. Ниже 560px
         показываем значок вместо подписи: получается тот самый
         гамбургер, которого на этом сайте не было. */
      #mainMenu .nav-burger{display:none;font-size:15px;line-height:1}
      @media (max-width:560px){
        #mainMenu .nav-overflow-trigger{padding:8px 9px}
        #mainMenu .nav-more-label{display:none}
        #mainMenu .nav-burger{display:inline-block}
        #mainMenu .nav-overflow-trigger .nav-caret{display:none}
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
      '<button type="button" class="nav-overflow-trigger" aria-haspopup="menu" aria-expanded="false" ' +
        'aria-label="' + (isEnglish ? 'Menu' : 'Меню') + '">' +
        /* Значок нужен только на узких экранах, где подпись прячется
           (см. media-запрос в стилях). Здесь он всегда в разметке,
           показывает его CSS. */
        '<span class="nav-burger" aria-hidden="true">☰</span>' +
        '<span class="nav-more-label">' + (isEnglish ? 'More' : 'Ещё') + '</span>' +
        '<span class="nav-caret" aria-hidden="true">⌄</span>' +
      '</button>' +
      '<div class="nav-overflow-menu" role="menu"></div>';
    root.appendChild(more);
    return more;
  }

  /* ============================================================
     РАСЧЁТ: ЧТО ИМЕННО ВЫЗЫВАЛО СКАЧОК

     Прежний recalc на каждый чих делал так:

         items.forEach(item => { item.hidden = false; });   // показать ВСЁ
         ... померить ...
         hidden.forEach(item => { item.hidden = true; });   // спрятать заново

     То есть при любом изменении ширины меню на один кадр раскрывалось
     во всю длину и тут же схлопывалось. Это и видно как рывок.

     Хуже: ResizeObserver висел на том самом элементе, содержимое
     которого этот код меняет. Раскрыли пункты — ширина строки
     изменилась — наблюдатель сработал снова — раскрыли опять. На
     границе, где пункт то влезает, то нет, это зацикливалось и мигало.

     И третья причина, самая тихая. Место под кнопку «Ещё» вычиталось
     ВСЕГДА, даже когда прятать нечего и кнопки на экране нет. Поэтому
     последний пункт уезжал в «Ещё» при живых семидесяти свободных
     пикселях, а в момент перехода строка скачком меняла состав.

     Что делаем вместо этого:

     1. Ширины пунктов меряем ОДИН раз и запоминаем. Дальше считаем
        арифметикой, ничего не показывая и не пряча ради замера.
        Пересчёт замеров — только когда он правда нужен: сменился язык,
        догрузились шрифты, шапка перерисовалась.

     2. Два прохода. Сначала проверяем, влезают ли все пункты БЕЗ
        кнопки. Влезают — показываем всё, кнопки нет. Не влезают — и
        только тогда резервируем место под «Ещё». Разрыв исчезает.

     3. Гистерезис. Чтобы вернуть пункт в строку, места должно стать
        больше на HYSTERESIS пикселей, чем нужно впритык. Без этого на
        границе пункт дрожит между строкой и «Ещё» при движении мыши
        на один пиксель.

     4. DOM трогаем, только если состав видимых пунктов ДЕЙСТВИТЕЛЬНО
        изменился. Это и убирает обратную связь с наблюдателем, и
        снимает мигание.

     5. Наблюдаем не за строкой .appnav, содержимое которой меняем, а
        за контейнером #mainMenu: его ширину задаёт шапка, а не наши
        правки, поэтому сам себя пересчёт больше не запускает.
     ============================================================ */

  const HYSTERESIS = 10;   /* пикселей запаса на возврат пункта в строку */
  let measured = false;    /* ширины посчитаны и годны */
  let lastHiddenCount = -1;

  /* Ширины снимаем, когда все пункты на месте. Делается это редко:
     первый показ, смена языка, загрузка шрифтов. */
  function measure(root, items, more) {
    const prevHidden = items.filter(i => i.hidden);
    prevHidden.forEach(i => { i.hidden = false; });

    /* Замер не должен мелькать: на время замера гасим строку целиком,
       а не по одному пункту. */
    root.style.visibility = 'hidden';
    items.forEach(item => {
      item.__navW = Math.ceil(item.getBoundingClientRect().width);
    });
    const wasHidden = more.hidden;
    more.hidden = false;
    more.__navW = Math.ceil(more.getBoundingClientRect().width) || 76;
    more.hidden = wasHidden;
    root.style.visibility = '';

    prevHidden.forEach(i => { i.hidden = true; });
    measured = true;
  }

  function invalidate() { measured = false; }

  /* Сколько пунктов помещается. limit — доступная ширина. */
  function fitCount(items, available, gap, reserve) {
    let used = reserve ? reserve + gap : 0;
    let n = 0;
    for (const item of items) {
      const w = item.__navW || 0;
      const add = n ? gap + w : w;
      if (used + add > available) break;
      used += add;
      n++;
    }
    return n;
  }

  function applyActiveMark(more, hiddenItems) {
    const trigger = more.querySelector(':scope > .nav-overflow-trigger');
    if (!trigger) return;
    /* Если страница, на которой мы сейчас, уехала под «Ещё», человек
       теряет понимание, где находится. Подсвечиваем саму кнопку. */
    const hasCurrent = hiddenItems.some(item =>
      item.matches('[aria-current="page"]') || item.querySelector('[aria-current="page"]'));
    trigger.classList.toggle('active', hasCurrent);
    more.classList.toggle('has-current', hasCurrent);
  }

  function recalc() {
    const root = getRoot();
    if (!root) return;

    ensureStyles();

    const host = root.closest('#mainMenu') || root.parentElement || root;

    if (boundRoot !== root) {
      boundRoot = root;
      invalidate();

      if (resizeObserver) resizeObserver.disconnect();
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => {
          cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(recalc);
        });
        /* Наблюдаем за контейнером, а не за строкой, которую сами же
           и переписываем — иначе пересчёт вызывает пересчёт. */
        resizeObserver.observe(host);
      }
    }

    const more = ensureMore(root);
    const items = Array.from(root.children).filter(el => el !== more);
    if (!items.length) return;

    if (!measured || items.some(i => !i.__navW)) measure(root, items, more);

    const available = root.clientWidth;      /* именно clientWidth: без полосы прокрутки */
    if (!available) return;

    const cs = getComputedStyle(root);
    const gap = parseFloat(cs.columnGap || cs.gap || '2') || 2;

    /* Проход 1: влезают ли все БЕЗ кнопки «Ещё». */
    let total = 0;
    items.forEach((item, i) => { total += (i ? gap : 0) + (item.__navW || 0); });

    let visible;
    if (total <= available) {
      visible = items.length;
    } else {
      /* Проход 2: прятать придётся — теперь место под кнопку честно
         занято, и считаем с ним. */
      visible = fitCount(items, available, gap, more.__navW || 76);
      /* Ноль видимых пунктов — законное состояние, а не сбой.
         На узком экране даже один пункт рядом с кнопкой не влезает, и
         страховка «покажем хотя бы один» приводила к тому, что ряд
         торчал за край на сотню пикселей. Проверено на 390px: ровно
         так и было. Здесь «Ещё» просто становится единственной
         кнопкой меню — тем самым гамбургером. */
    }

    /* Гистерезис: возвращать пункт в строку можно только с запасом. */
    const prevVisible = items.length - Math.max(0, lastHiddenCount);
    if (lastHiddenCount >= 0 && visible > prevVisible) {
      const tighter = (visible === items.length)
        ? (total <= available - HYSTERESIS ? items.length
           : fitCount(items, available - HYSTERESIS, gap, more.__navW || 76))
        : fitCount(items, available - HYSTERESIS, gap, more.__navW || 76);
      visible = Math.max(prevVisible, Math.min(visible, Math.max(0, tighter)));
    }

    const hidden = items.slice(visible);

    /* Ничего не изменилось — DOM не трогаем вообще. Это и убирает
       мигание, и разрывает обратную связь с наблюдателем. */
    if (hidden.length === lastHiddenCount) return;
    lastHiddenCount = hidden.length;

    items.slice(0, visible).forEach(item => {
      if (!item.hidden) return;
      item.hidden = false;
      item.removeAttribute('aria-hidden');
      /* Появление — с плавностью: стартуем с прозрачного и включаем
         переход на следующем кадре, иначе браузер применит оба
         значения сразу и перехода не будет. */
      item.classList.add('nav-enter');
      requestAnimationFrame(() => requestAnimationFrame(() => item.classList.remove('nav-enter')));
    });

    hidden.forEach(item => {
      if (item.hidden) return;
      item.hidden = true;
      item.setAttribute('aria-hidden', 'true');
      item.classList.remove('is-open', 'nav-enter');
      const trigger = item.querySelector(':scope > .nav-group-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });

    if (!hidden.length) {
      more.hidden = true;
      applyActiveMark(more, []);
      closeMenus(root);
      return;
    }

    buildMoreMenu(more, hidden);
    applyActiveMark(more, hidden);
    more.hidden = false;
  }

  /* Замеры устаревают, когда меняется текст пунктов или шрифт. */
  document.addEventListener('langchange', () => { invalidate(); lastHiddenCount = -1; setTimeout(recalc, 0); });
  document.addEventListener('headerready', () => { invalidate(); lastHiddenCount = -1; setTimeout(recalc, 0); });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { invalidate(); lastHiddenCount = -1; recalc(); }).catch(() => {});
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
