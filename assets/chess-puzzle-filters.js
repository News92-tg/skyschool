/* ============================================================
   SkyySchool — фильтры каталога шахматных задач.

   ЧТО БЫЛО СЛОМАНО
   ----------------
   В задании сказано «фильтры накапливаются, старые значения не
   сбрасываются». Это не так: cat и diff — обычные переменные, новое
   значение затирает старое. Настоящая причина другая и хуже.

   Прежний код брал исходный список так:

       const raw = () => Array.isArray(window.__CHESS_PUZZLES_RAW_BACKUP__)
                       ? window.__CHESS_PUZZLES_RAW_BACKUP__
                       : window.CHESS_PUZZLES;      // ← запасной путь
       ...
       target.splice(0, target.length, ...filtered); // ← и сюда же пишет

   Если резервной копии нет, источник и приёмник — ОДИН И ТОТ ЖЕ
   массив. Первое же нажатие на фильтр не просто показывает
   подмножество, а НАВСЕГДА выбрасывает из window.CHESS_PUZZLES всё
   остальное. Второй фильтр применяется к остаткам, третий — к
   остаткам остатков. Отсюда и «нажал мат в 1, потом лёгкие, потом
   вилку — ноль задач», и «помогает только перезагрузка»: заново
   загруженный файл данных восстанавливает список.

   А резервной копии не было, хотя строка для неё написана.
   В data/chess-puzzles.js это выглядит так:

       document.write('<script src="data/chess-puzzles-base.js"><\/script>');
       document.write('<script src="...batch01.js"><\/script>');
       document.write('<script src="...batch02.js"><\/script>');
       if (Array.isArray(window.CHESS_PUZZLES)) {           // ← ещё пусто
         window.__CHESS_PUZZLES_RAW_BACKUP__ = window.CHESS_PUZZLES.slice();
       }

   Скрипты, вставленные через document.write, выполняются ПОСЛЕ того,
   как текущий скрипт доработает до конца. То есть проверка на строке
   выше видит window.CHESS_PUZZLES ещё несуществующим, копия не
   создаётся, и фильтр уходит на разрушительный запасной путь.
   Проверено в браузере: на живой странице backup === undefined.

   КАК ИСПРАВЛЕНО
   --------------
   Снимок полного каталога делается ЗДЕСЬ, один раз, при первом
   применении фильтра — когда все три файла с задачами уже точно
   загружены. Дальше источник всегда снимок, и сколько бы фильтров ни
   нажимали, исходный список не страдает. Правка data/chess-puzzles.js
   при этом не требуется: файл продолжит работать как есть.
   ============================================================ */
(function () {
  'use strict';

  const $ = s => document.querySelector(s);

  /* ПОЧЕМУ СПИСОК ТИПОВ СТРОИТСЯ ПО ДАННЫМ, А НЕ ЗАДАН РУКАМИ

     Прежний список был записан в коде — и разошёлся с каталогом.
     Кнопка «мат в 2» там была, а задач такого типа после проверки
     движком не остаётся ни одной: нажатие всегда давало пустой экран.
     Зато типы opening (3 задачи) и general (14) в списке отсутствовали,
     и до этих 17 задач нельзя было добраться ни одним фильтром.

     Поэтому кнопки теперь строятся из того, что реально лежит в
     каталоге: подпись берётся из словаря, если тип знакомый, иначе
     показываем сам идентификатор. Каталог вырастет — кнопки появятся
     сами, и рассинхрон больше не повторится. */
  const CAT_LABELS = {
    mate1:      { ru:'Мат в 1',        en:'Mate in 1' },
    mate2:      { ru:'Мат в 2',        en:'Mate in 2' },
    mate3:      { ru:'Мат в 3',        en:'Mate in 3' },
    fork:       { ru:'Вилка',          en:'Fork' },
    pin:        { ru:'Связка',         en:'Pin' },
    skewer:     { ru:'Сквозной удар',  en:'Skewer' },
    discovered: { ru:'Вскрытая атака', en:'Discovered attack' },
    defence:    { ru:'Защита',         en:'Defence' },
    endgame:    { ru:'Эндшпиль',       en:'Endgame' },
    opening:    { ru:'Дебют',          en:'Opening' },
    general:    { ru:'Разное',         en:'General' },
    other:      { ru:'Прочее',         en:'Other' }
  };
  const DIFF_LABELS = {
    easy:   { ru:'Легко',  en:'Easy' },
    medium: { ru:'Средне', en:'Medium' },
    hard:   { ru:'Сложно', en:'Hard' }
  };
  const ALL_CAT  = { ru:'Все',   en:'All' };
  const ALL_DIFF = { ru:'Любая', en:'Any' };
  /* Порядок кнопок: знакомые типы — в осмысленном порядке, остальные
     следом. Сортировать по количеству нельзя: кнопки перескакивали бы
     с места на место при каждом пополнении каталога. */
  const CAT_ORDER = ['mate1','mate2','mate3','fork','pin','skewer','discovered','defence','endgame','opening','general','other'];
  const DIFF_ORDER = ['easy','medium','hard'];

  function buildOptions(all) {
    const cats = {}, diffs = {};
    all.forEach(p => {
      cats[p.category || p.type || 'other'] = true;
      if (p.difficulty) diffs[p.difficulty] = true;
    });
    const rank = (list, id) => { const i = list.indexOf(id); return i < 0 ? list.length : i; };
    const sortBy = list => (a, b) => (rank(list, a) - rank(list, b)) || a.localeCompare(b);
    return {
      cats:  [{ id:'all', label:ALL_CAT }].concat(
        Object.keys(cats).sort(sortBy(CAT_ORDER))
          .map(id => ({ id, label: CAT_LABELS[id] || { ru:id, en:id } }))),
      diffs: [{ id:'all', label:ALL_DIFF }].concat(
        Object.keys(diffs).sort(sortBy(DIFF_ORDER))
          .map(id => ({ id, label: DIFF_LABELS[id] || { ru:id, en:id } })))
    };
  }

  const isEn = () => !!(window.Sky && Sky.lang === 'en');
  const L = o => isEn() ? (o.en || o.ru) : o.ru;
  let OPTS = null;   /* кнопки, построенные по каталогу */
  const catOf = p => p.category || p.type || 'other';

  /* ---------- снимок каталога ----------

     ПОЧЕМУ СНИМОК БЕРЁТСЯ НЕ СРАЗУ

     В chess-game-modes.js есть cleanPuzzleSet(): он прогоняет каждую
     задачу через настоящий движок и выбрасывает те, где заявленное
     решение на самом деле не ставит мат. Это не мелочь — из 420
     сгенерированных задач проверку не проходят 78. Файл
     data/chess-puzzles-batch02.js делает задачи, поворачивая и отражая
     опорные позиции, и часть поворотов даёт позиции, где решение
     ломается.

     Проверка запускается позже нас, примерно через полсекунды после
     загрузки. Если снять снимок раньше, в нём окажутся все 420 — и
     «сбросить фильтры» вернул бы в каталог 78 задач, которые движок
     уже забраковал: человек получил бы задачу без решения.

     Поэтому ждём, пока список перестанет меняться, и только потом
     замораживаем. Пока ждём — кнопки неактивны; это меньше секунды,
     и за это время всё равно нечего нажимать. */

  const SETTLE_POLLS = 2;     /* столько раз подряд длина должна совпасть */
  const SETTLE_MIN_MS = 1100; /* и не раньше этого момента от старта */

  let SNAPSHOT = null;
  let seenLen = -1, sameCount = 0;

  function liveList() {
    const l = window.CHESS_PUZZLES;
    return (Array.isArray(l) && l.length) ? l : null;
  }

  function trySnapshot() {
    if (SNAPSHOT) return SNAPSHOT;
    const live = liveList();
    if (!live) return null;
    if (live.length === seenLen) sameCount++;
    else { seenLen = live.length; sameCount = 0; }
    if (sameCount < SETTLE_POLLS) return null;
    if (performance.now() < SETTLE_MIN_MS) return null;
    SNAPSHOT = live.slice();
    /* Общую копию так и не создали (см. шапку файла), а ею пользуются
       chess-boot-repair.js и chess-final-ui.js — чиним заодно. */
    window.__CHESS_PUZZLES_RAW_BACKUP__ = SNAPSHOT.slice();
    return SNAPSHOT;
  }

  /* Если каталог позже поменяют не мы — подхватываем.

     Тут легко ошибиться, и я на этом уже споткнулся. Мало проверить
     «фильтры сняты и длина не совпала»: при нажатии «Сбросить» мы
     сначала ставим cat='all', diff='all', и только потом применяем
     фильтр. В этот момент в window.CHESS_PUZZLES ещё лежит прошлая,
     отфильтрованная выборка — и проверка принимает её за новый
     каталог. На тесте снимок так схлопнулся с 342 задач до одной.

     Поэтому помним, что записали туда сами. Если длина совпадает с
     нашей последней записью — это наша выборка, а не чужая правка. */
  let lastWrittenLen = -1;

  function resyncIfIdle() {
    if (!SNAPSHOT || cat !== 'all' || diff !== 'all') return;
    const live = liveList();
    if (!live) return;
    if (live.length === lastWrittenLen) return;   /* это мы сами и писали */
    if (live.length !== SNAPSHOT.length) {
      SNAPSHOT = live.slice();
      window.__CHESS_PUZZLES_RAW_BACKUP__ = SNAPSHOT.slice();
      OPTS = buildOptions(SNAPSHOT);
      renderButtons();
    }
  }

  let cat = 'all', diff = 'all';

  /* Сколько задач даст фильтр — считаем по снимку, а не по тому, что
     сейчас в window.CHESS_PUZZLES. */
  function match(p, c, d) {
    return (c === 'all' || catOf(p) === c) && (d === 'all' || p.difficulty === d);
  }

  function plural(n) {
    if (isEn()) return n + (n === 1 ? ' puzzle' : ' puzzles');
    if (window.Sky && Sky.plural) return Sky.plural(n, 'задача', 'задачи', 'задач');
    return n + ' задач';
  }

  /* ---------- отрисовка ---------- */
  function ensure() {
    const tab = $('#tab-puzzles');
    if (!tab) return false;
    if ($('#puzzleFilters')) return true;

    const host = document.createElement('div');
    host.id = 'puzzleFilters';
    host.innerHTML =
      `<div class="pf-head">
         <b>${isEn() ? 'Puzzle type' : 'Тип задачи'}</b>
         <span class="pf-count" id="pfCount"></span>
         <button type="button" class="pf-reset" id="pfReset" hidden>${isEn() ? 'Reset filters' : 'Сбросить фильтры'}</button>
       </div>
       <div class="pf-row" id="pfCats"></div>
       <div class="pf-row pf-diff" id="pfDiff"></div>
       <div class="pf-empty" id="pfEmpty" hidden></div>`;
    tab.insertBefore(host, tab.firstElementChild);

    /* Каждая кнопка несёт своё число: видно заранее, что выбор
       «вилка» даст ноль, и не надо тыкать наугад. */
    renderButtons(host);

    host.addEventListener('click', e => {
      const c = e.target.closest('[data-cat]');
      const d = e.target.closest('[data-diff]');
      const r = e.target.closest('#pfReset');
      if (r) { cat = 'all'; diff = 'all'; apply(); return; }
      /* Внутри группы выбор ведёт себя как переключатель: новое
         значение заменяет прежнее, а не добавляется к нему. */
      if (c) { cat = c.dataset.cat; apply(); }
      if (d) { diff = d.dataset.diff; apply(); }
    });
    return true;
  }

  /* Кнопки перерисовываем отдельно: их состав зависит от каталога,
     который на момент создания панели может быть ещё не готов. */
  function renderButtons(host) {
    host = host || $('#puzzleFilters');
    if (!host) return;
    const opts = OPTS || { cats: [{ id:'all', label:ALL_CAT }], diffs: [{ id:'all', label:ALL_DIFF }] };
    host.querySelector('#pfCats').innerHTML = opts.cats
      .map(c => `<button type="button" class="pf-btn" data-cat="${c.id}">${L(c.label)}<i></i></button>`).join('');
    host.querySelector('#pfDiff').innerHTML = opts.diffs
      .map(d => `<button type="button" class="pf-btn pf-diff-btn" data-diff="${d.id}">${L(d.label)}<i></i></button>`).join('');
  }

  function apply() {
    resyncIfIdle();
    const all = SNAPSHOT;
    if (!all) return;

    const filtered = all.filter(p => match(p, cat, diff));

    /* Отдаём результат остальному коду страницы: он читает
       window.CHESS_PUZZLES. Пишем в тот же массив, чтобы не рвать
       чужие ссылки, но ИСТОЧНИК при этом остаётся нетронутым. */
    const target = window.CHESS_PUZZLES;
    if (Array.isArray(target)) target.splice(0, target.length, ...filtered);
    else window.CHESS_PUZZLES = filtered.slice();
    lastWrittenLen = filtered.length;

    /* подсветка выбранного */
    document.querySelectorAll('#pfCats .pf-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.cat === cat);
      const i = b.querySelector('i');
      if (i) {
        const n = all.filter(p => match(p, b.dataset.cat, diff)).length;
        i.textContent = n;
        b.classList.toggle('empty', n === 0);
      }
    });
    document.querySelectorAll('#pfDiff .pf-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.diff === diff);
      const i = b.querySelector('i');
      if (i) {
        const n = all.filter(p => match(p, cat, b.dataset.diff)).length;
        i.textContent = n;
        b.classList.toggle('empty', n === 0);
      }
    });

    const count = $('#pfCount');
    if (count) count.textContent = (isEn() ? 'Found: ' : 'Найдено: ') + plural(filtered.length);

    const reset = $('#pfReset');
    if (reset) reset.hidden = (cat === 'all' && diff === 'all');

    /* Пусто — объясняем, что делать, а не оставляем белый экран. */
    const empty = $('#pfEmpty');
    if (empty) {
      if (filtered.length) empty.hidden = true;
      else {
        empty.hidden = false;
        const byCat = all.filter(p => match(p, cat, 'all')).length;
        const byDiff = all.filter(p => match(p, 'all', diff)).length;
        const hint = isEn()
          ? `No puzzles match both filters. On its own, this type has ${byCat}, this difficulty has ${byDiff}. Try releasing one of them.`
          : `По этим фильтрам задач нет. По отдельности: этот тип — ${plural(byCat)}, эта сложность — ${plural(byDiff)}. Попробуйте снять один из них.`;
        empty.textContent = hint;
      }
    }

    if (filtered.length && typeof window.loadPuzzle === 'function') {
      window.loadPuzzle(0);
    }
  }

  /* ---------- подпись типа под доской ---------- */
  let originalLoadPuzzle = null;
  function patchTypeLabel() {
    if (originalLoadPuzzle || typeof window.loadPuzzle !== 'function') return;
    originalLoadPuzzle = window.loadPuzzle;
    window.loadPuzzle = function (i) {
      originalLoadPuzzle(i);
      setTimeout(() => {
        const arr = window.CHESS_PUZZLES || [];
        if (!arr.length) return;
        const idx = ((i % arr.length) + arr.length) % arr.length;
        const p = arr[idx];
        const type = $('#pType');
        if (type) {
          const lab = CAT_LABELS[catOf(p)];
          type.textContent = lab ? L(lab) : (isEn() ? 'Tactics' : 'Тактика');
        }
      }, 0);
    };
  }

  function styles() {
    if ($('#puzzle-filter-styles')) return;
    const st = document.createElement('style');
    st.id = 'puzzle-filter-styles';
    st.textContent = `
      #puzzleFilters{margin:0 0 14px;padding:13px 14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm)}
      #puzzleFilters .pf-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:9px}
      #puzzleFilters .pf-head>b{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      #puzzleFilters .pf-count{font-weight:900;font-size:12.5px;color:var(--m-chess)}
      #puzzleFilters .pf-reset{margin-left:auto;padding:5px 11px;border:1px solid var(--line);border-radius:99px;background:var(--panel-2);font-family:inherit;font-size:11.5px;font-weight:800;color:var(--muted);cursor:pointer;transition:.15s}
      #puzzleFilters .pf-reset:hover{border-color:var(--no);color:var(--no)}
      #puzzleFilters .pf-row{display:flex;gap:6px;flex-wrap:wrap}
      #puzzleFilters .pf-diff{margin-top:7px;padding-top:8px;border-top:1px solid var(--line)}
      #puzzleFilters .pf-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2);font-family:inherit;font-size:11.5px;font-weight:900;color:var(--muted);cursor:pointer;transition:.15s}
      #puzzleFilters .pf-btn:hover{border-color:var(--line-2);transform:translateY(-1px)}
      #puzzleFilters .pf-btn.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      #puzzleFilters .pf-btn i{font-style:normal;font-size:10px;font-weight:800;opacity:.65;padding:1px 5px;border-radius:99px;background:var(--panel)}
      #puzzleFilters .pf-btn.active i{background:var(--panel);opacity:.9}
      #puzzleFilters .pf-btn.empty{opacity:.4}
      #puzzleFilters .pf-btn:disabled{opacity:.35;cursor:default;transform:none}
      #puzzleFilters.pf-busy .pf-count{color:var(--muted);font-weight:700}
      #puzzleFilters .pf-empty{margin-top:10px;padding:11px 13px;border-radius:12px;background:var(--warn-soft);color:var(--warn);font-size:12.5px;font-weight:700;line-height:1.5}
      #puzzleFilters .pf-empty[hidden]{display:none}
      #puzzleFilters .pf-reset[hidden]{display:none}
    `;
    document.head.appendChild(st);
  }

  function setBusy(on) {
    const host = $('#puzzleFilters');
    if (!host) return;
    host.classList.toggle('pf-busy', on);
    host.querySelectorAll('.pf-btn').forEach(b => { b.disabled = on; });
    const c = $('#pfCount');
    if (c && on) c.textContent = isEn() ? 'Loading catalogue…' : 'Загружаю каталог…';
  }

  function init() {
    styles();
    if (!ensure()) { setTimeout(init, 50); return; }
    setBusy(true);
    patchTypeLabel();
    /* Опрашиваем, пока каталог не устаканится (см. комментарий выше). */
    (function wait() {
      if (!trySnapshot()) { setTimeout(wait, 300); return; }
      OPTS = buildOptions(SNAPSHOT);
      renderButtons();
      setBusy(false);
      apply();
      /* Поздние правки каталога тоже подхватим. */
      [1500, 3000].forEach(ms => setTimeout(() => { resyncIfIdle(); if (cat === 'all' && diff === 'all') apply(); }, ms));
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('langchange', () => {
    const host = $('#puzzleFilters');
    if (host) { host.remove(); ensure(); renderButtons(); apply(); }
  });

  window.SkyPuzzleFilters = {
    reset() { cat = 'all'; diff = 'all'; apply(); },
    state() { return { cat, diff, total: (SNAPSHOT || []).length, ready: !!SNAPSHOT }; }
  };
})();