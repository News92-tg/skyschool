/* ============================================================
   SkyySchool — тренер для шахматных задач
   ------------------------------------------------------------
   После попытки ученик получает одну ясную кнопку:
   «Разобрать с тренером».

   Нажатие открывает реальный разбор текущего хода через ChessReview.
   ============================================================ */
'use strict';

(function () {
  const STYLE_ID = 'chess-puzzle-coach-styles-v3';
  const PANEL_ID = 'pCoachReview';

  let lastPuzzleKey = '';
  let lastAttemptSan = '';
  let reviewVisible = false;
  let observer = null;

  const $ = id => document.getElementById(id);
  const tx = (ru, en) => window.Sky && Sky.lang === 'en' ? en : ru;
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\"/g,'&quot;')
    .replace(/'/g,'&#39;');

  function addStyles() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Не оставляем пустую строку под заголовком задачи. */
      #tab-puzzles #pMsg.puzzle-attempt-msg.empty { display:none !important; }

      /* Один понятный главный CTA. */
      #tab-puzzles .puzzle-coach-actions {
        display:grid;
        grid-template-columns:1fr;
        gap:8px;
        margin-top:12px;
      }
      #tab-puzzles .puzzle-coach-primary {
        width:100%;
        min-height:40px;
      }
      #tab-puzzles .puzzle-coach-primary[disabled] {
        opacity:.42;
        cursor:not-allowed;
      }

      /* Старые действия — вторичные, отдельной строкой. */
      #tab-puzzles .puzzle-coach-secondary {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
      }
      #tab-puzzles .puzzle-coach-secondary .btn { width:100%; }

      /* Разбор появляется ниже действий и не спорит с ответом задачи. */
      #tab-puzzles .puzzle-coach-review {
        margin-top:12px;
        padding:14px;
        border:1px solid color-mix(in srgb,var(--m-chess) 24%,var(--line));
        border-radius:15px;
        background:var(--panel);
        box-shadow:var(--shadow-sm);
      }
      #tab-puzzles .puzzle-coach-review.hidden { display:none; }

      #tab-puzzles .pcr-head {
        display:flex;
        align-items:center;
        gap:10px;
      }
      #tab-puzzles .pcr-face {
        width:44px;
        height:44px;
        flex:0 0 44px;
        border-radius:50%;
        overflow:hidden;
        background:var(--m-chess-soft);
      }
      #tab-puzzles .pcr-face svg { display:block;width:100%;height:100%; }
      #tab-puzzles .pcr-head-copy { min-width:0;flex:1; }
      #tab-puzzles .pcr-name { font-size:12px;font-weight:900;line-height:1.2; }
      #tab-puzzles .pcr-role { margin-top:3px;color:var(--muted);font-size:9.5px;line-height:1.3; }

      #tab-puzzles .pcr-verdict {
        margin-top:12px;
        padding:10px 12px;
        border-radius:12px;
        border:1px solid var(--line);
        background:var(--panel-2);
      }
      #tab-puzzles .pcr-verdict.good {
        border-color:color-mix(in srgb,var(--ok) 28%,var(--line));
        background:color-mix(in srgb,var(--ok) 7%,var(--panel));
      }
      #tab-puzzles .pcr-verdict.bad {
        border-color:color-mix(in srgb,var(--no) 28%,var(--line));
        background:color-mix(in srgb,var(--no) 6%,var(--panel));
      }
      #tab-puzzles .pcr-verdict-title { font-size:11px;font-weight:900;line-height:1.3; }
      #tab-puzzles .pcr-verdict-text { margin-top:4px;font-size:10.5px;line-height:1.5;color:var(--ink-2); }

      #tab-puzzles .pcr-facts {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:7px;
        margin-top:9px;
      }
      #tab-puzzles .pcr-fact {
        min-width:0;
        padding:8px;
        border:1px solid var(--line);
        border-radius:10px;
        background:var(--panel-2);
      }
      #tab-puzzles .pcr-fact b {
        display:block;
        font-size:10.5px;
        line-height:1.3;
        overflow-wrap:anywhere;
      }
      #tab-puzzles .pcr-fact span {
        display:block;
        margin-top:3px;
        color:var(--muted);
        font-size:8.5px;
        line-height:1.3;
      }
      #tab-puzzles .pcr-quote {
        margin-top:9px;
        padding:9px 10px;
        border-left:3px solid var(--m-chess);
        background:var(--m-chess-soft);
        border-radius:0 10px 10px 0;
        font-size:10.5px;
        line-height:1.45;
        font-weight:800;
        color:var(--ink-2);
      }

      @media(max-width:520px){
        #tab-puzzles .pcr-facts { grid-template-columns:1fr 1fr; }
        #tab-puzzles .pcr-fact:last-child { grid-column:1/-1; }
        #tab-puzzles .puzzle-coach-secondary { grid-template-columns:1fr 1fr 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentPuzzle() {
    const list = window.CHESS_PUZZLES;
    if (!Array.isArray(list) || !list.length) return null;
    const count = $('pCount');
    const raw = count ? String(count.textContent || '') : '';
    const m = raw.match(/(\d+)\s*(?:из|of)\s*(\d+)/i);
    const index = m ? Math.max(0, Math.min(list.length - 1, Number(m[1]) - 1)) : 0;
    return list[index] || null;
  }

  function getPuzzleKey() {
    const p = getCurrentPuzzle();
    return p ? String(p.id || p.fen || '') : '';
  }

  function getTeacher() {
    if (!window.ChessTeacherUI) return null;
    try { return ChessTeacherUI.getTeacher ? ChessTeacherUI.getTeacher() : null; }
    catch (e) { return null; }
  }

  function getTeacherFace() {
    if (!window.ChessTeacherUI) return '';
    try {
      const id = ChessTeacherUI.getSelected();
      return ChessTeacherUI.FACES[id] || '';
    } catch (e) { return ''; }
  }

  function strictText(t) {
    const labels = ['Очень мягкий','Мягкий','Средний','Строгий','Очень строгий'];
    return labels[Math.max(1, Math.min(5, Number(t && t.strictness || 3))) - 1];
  }

  function qualityTitle(q) {
    const map = {
      brilliant:['Блестящий ход','Brilliant move'],
      good:['Хороший ход','Good move'],
      inaccuracy:['Неточность','Inaccuracy'],
      mistake:['Ошибка','Mistake'],
      blunder:['Грубая ошибка','Blunder']
    };
    const pair = map[q] || map.good;
    return tx(pair[0], pair[1]);
  }

  function qualityClass(q) {
    return (q === 'brilliant' || q === 'good') ? 'good' : 'bad';
  }

  function ensurePanel() {
    const side = document.querySelector('#tab-puzzles .side');
    if (!side) return null;
    let panel = $(PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = PANEL_ID;
      panel.className = 'puzzle-coach-review hidden';
      side.appendChild(panel);
    }
    return panel;
  }

  function normalizeButtons() {
    const side = document.querySelector('#tab-puzzles .side');
    if (!side) return;

    let actions = side.querySelector('.puzzle-coach-actions');
    const original = side.querySelector('.actions');

    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'puzzle-coach-actions';
      if (original) {
        const secondary = document.createElement('div');
        secondary.className = 'puzzle-coach-secondary';
        while (original.firstChild) secondary.appendChild(original.firstChild);
        actions.appendChild(secondary);
        original.replaceWith(actions);
      } else {
        side.appendChild(actions);
        actions.appendChild(document.createElement('div'));
        actions.lastElementChild.className = 'puzzle-coach-secondary';
      }
    } else if (!actions.querySelector('.puzzle-coach-secondary')) {
      const secondary = document.createElement('div');
      secondary.className = 'puzzle-coach-secondary';
      Array.from(actions.children).forEach(child => {
        if (child.id !== 'pCoachBtn' && child !== secondary) secondary.appendChild(child);
      });
      actions.appendChild(secondary);
    }

    let button = actions.querySelector('#pCoachBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'pCoachBtn';
      button.className = 'btn chess small puzzle-coach-primary';
      button.addEventListener('click', toggleReview);
      const secondary = actions.querySelector('.puzzle-coach-secondary');
      actions.insertBefore(button, secondary);
    }

    button.textContent = reviewVisible
      ? tx('Скрыть разбор', 'Hide review')
      : tx('Разобрать с тренером', 'Review with coach');
    button.disabled = !lastAttemptSan;
  }

  function updateAttemptMessage() {
    const msg = $('pMsg');
    if (!msg) return;
    msg.classList.add('puzzle-attempt-msg');
    msg.classList.toggle('empty', !String(msg.textContent || '').trim());
  }

  function resetReviewForPuzzle() {
    const key = getPuzzleKey();
    if (!key || key === lastPuzzleKey) return;
    lastPuzzleKey = key;
    lastAttemptSan = '';
    reviewVisible = false;
    const panel = ensurePanel();
    if (panel) panel.classList.add('hidden');
  }

  function captureAttempt() {
    const msg = $('pMsg');
    if (!msg) return;
    updateAttemptMessage();

    const raw = String(msg.textContent || '').trim();
    let san = '';

    const wrong = raw.match(/\(([^()]+)\)\s*$/);
    if (wrong && wrong[1]) san = wrong[1].trim();

    if (!san && /^✓/.test(raw)) {
      const correct = raw.match(/^✓.*?\s([A-Za-zА-Яа-я][A-Za-zА-Яа-я0-9+#=\-]*)$/i);
      if (correct && correct[1]) san = correct[1].trim();
    }

    if (san !== lastAttemptSan) {
      lastAttemptSan = san;
      reviewVisible = false;
      const panel = ensurePanel();
      if (panel) panel.classList.add('hidden');
    }

    normalizeButtons();
  }

  function reviewResult() {
    const puzzle = getCurrentPuzzle();
    if (!puzzle || !lastAttemptSan || !window.ChessReview) return null;
    try { return ChessReview.review(puzzle.fen, lastAttemptSan); }
    catch (e) { return null; }
  }

  function renderReview() {
    const panel = ensurePanel();
    const result = reviewResult();
    const teacher = getTeacher();
    if (!panel || !result) return false;

    const t = teacher || {
      name:{ru:'Тренер'},
      role:{ru:''},
      strictness:3,
      phrases:{good:'Хорошо. Посмотри ещё раз на позицию.'}
    };

    const phrase = t.phrases[result.quality] || t.phrases.good || '';
    const note = typeof ChessReview.shortNote === 'function'
      ? ChessReview.shortNote(result, (Sky && Sky.lang) || 'ru')
      : '';
    const best = result.betterMove
      ? esc(result.betterMove)
      : tx('Ваш ход совпал с лучшим найденным.', 'Your move matched the best line.');
    const loss = result.loss == null ? '—' : (result.loss / 100).toFixed(1);
    const material = result.material == null ? '—' : (result.material / 100).toFixed(1);

    panel.innerHTML = `
      <div class="pcr-head">
        <div class="pcr-face">${getTeacherFace()}</div>
        <div class="pcr-head-copy">
          <div class="pcr-name">${esc(t.name.ru || '')}</div>
          <div class="pcr-role">${esc(t.role.ru || '')} · ${esc(strictText(t))}</div>
        </div>
      </div>
      <div class="pcr-verdict ${qualityClass(result.quality)}">
        <div class="pcr-verdict-title">${esc(lastAttemptSan)} — ${esc(qualityTitle(result.quality))}</div>
        <div class="pcr-verdict-text">${esc(note || tx('Движок проверил ход.','The engine checked the move.'))}</div>
      </div>
      <div class="pcr-facts">
        <div class="pcr-fact"><b>${best}</b><span>${tx('лучшее продолжение','best continuation')}</span></div>
        <div class="pcr-fact"><b>${esc(loss)} п.</b><span>${tx('потеря оценки','evaluation loss')}</span></div>
        <div class="pcr-fact"><b>${esc(material)} п.</b><span>${tx('изменение материала','material change')}</span></div>
      </div>
      <div class="pcr-quote">${esc(phrase)}</div>`;

    panel.classList.remove('hidden');
    return true;
  }

  function toggleReview() {
    if (!lastAttemptSan) return;
    if (reviewVisible) {
      reviewVisible = false;
      const panel = ensurePanel();
      if (panel) panel.classList.add('hidden');
      normalizeButtons();
      return;
    }
    if (renderReview()) reviewVisible = true;
    normalizeButtons();
  }

  function refresh() {
    addStyles();
    resetReviewForPuzzle();
    captureAttempt();
    normalizeButtons();
  }

  function init() {
    if (observer) observer.disconnect();
    refresh();
    const nodes = ['pTitle','pCount','pMsg','pIdea'].map($).filter(Boolean);
    observer = new MutationObserver(refresh);
    nodes.forEach(node => observer.observe(node, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true
    }));
    document.addEventListener('langchange', () => setTimeout(refresh, 0));
    window.setInterval(refresh, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), {once:true});
  } else {
    setTimeout(init, 0);
  }
})();
