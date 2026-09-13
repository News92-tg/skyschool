/* SkyySchool — stable coach review for chess puzzles. */
'use strict';
(function () {
  const STYLE_ID = 'chess-puzzle-coach-v6';
  const PANEL_ID = 'pCoachReview';
  const $ = id => document.getElementById(id);
  const tx = (ru, en) => window.Sky && Sky.lang === 'en' ? en : ru;
  const esc = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  let puzzleKey = '';
  let attemptSan = '';
  let fromSquare = -1;
  let reviewOpen = false;
  let observer = null;

  function addStyles() {
    if ($(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #tab-puzzles .puzzle-coach-actions{display:grid;gap:8px;margin-top:12px}
      #tab-puzzles .puzzle-coach-main{width:100%;min-height:40px}
      #tab-puzzles .puzzle-coach-main[disabled]{opacity:.42;cursor:not-allowed}
      #tab-puzzles .puzzle-coach-secondary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      #tab-puzzles .puzzle-coach-secondary .btn{width:100%}
      #tab-puzzles .puzzle-coach-review{margin-top:12px;padding:13px;border:1px solid color-mix(in srgb,var(--m-chess) 25%,var(--line));border-radius:14px;background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-puzzles .puzzle-coach-review.hidden{display:none!important}
      #tab-puzzles .pcr-head{display:flex;align-items:center;gap:10px}
      #tab-puzzles .pcr-face{width:42px;height:42px;flex:0 0 42px;border-radius:50%;overflow:hidden;background:var(--m-chess-soft)}
      #tab-puzzles .pcr-face svg{display:block;width:100%;height:100%}
      #tab-puzzles .pcr-head-copy{min-width:0;flex:1}
      #tab-puzzles .pcr-name{font-size:12px;font-weight:900;line-height:1.2}
      #tab-puzzles .pcr-role{margin-top:2px;font-size:9px;line-height:1.3;color:var(--muted)}
      #tab-puzzles .pcr-title{margin-top:9px;font-size:11.5px;font-weight:900;line-height:1.3}
      #tab-puzzles .pcr-card{margin-top:8px;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2)}
      #tab-puzzles .pcr-card.good{border-color:color-mix(in srgb,var(--ok) 28%,var(--line));background:color-mix(in srgb,var(--ok) 7%,var(--panel))}
      #tab-puzzles .pcr-card.bad{border-color:color-mix(in srgb,var(--no) 28%,var(--line));background:color-mix(in srgb,var(--no) 6%,var(--panel))}
      #tab-puzzles .pcr-text{font-size:10.5px;line-height:1.5;color:var(--ink-2)}
      #tab-puzzles .pcr-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px}
      #tab-puzzles .pcr-fact{min-width:0;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2)}
      #tab-puzzles .pcr-fact b{display:block;font-size:10px;line-height:1.25;overflow-wrap:anywhere}
      #tab-puzzles .pcr-fact span{display:block;margin-top:3px;font-size:8px;line-height:1.25;color:var(--muted)}
      #tab-puzzles .pcr-quote{margin-top:8px;padding:9px 10px;border-left:3px solid var(--m-chess);border-radius:0 9px 9px 0;background:var(--m-chess-soft);font-size:10px;line-height:1.45;font-weight:800;color:var(--ink-2)}
      @media(max-width:520px){#tab-puzzles .pcr-facts{grid-template-columns:1fr 1fr}#tab-puzzles .pcr-fact:last-child{grid-column:1/-1}}
    `;
    document.head.appendChild(s);
  }

  function currentPuzzle() {
    const list = window.CHESS_PUZZLES;
    if (!Array.isArray(list) || !list.length) return null;
    const raw = String($('pCount')?.textContent || '');
    const m = raw.match(/(\d+)\s*(?:из|of)\s*(\d+)/i);
    const index = m ? Math.max(0, Math.min(list.length - 1, Number(m[1]) - 1)) : 0;
    return list[index] || null;
  }

  function teacher() {
    try { return window.ChessTeacherUI?.getTeacher?.() || null; } catch (_) { return null; }
  }

  function teacherFace() {
    try {
      const id = window.ChessTeacherUI?.getSelected?.();
      return window.ChessTeacherUI?.FACES?.[id] || '';
    } catch (_) { return ''; }
  }

  function strictText(t) {
    return ['Очень мягкий','Мягкий','Средний','Строгий','Очень строгий'][Math.max(1, Math.min(5, +(t?.strictness || 3))) - 1];
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

  function ensureActions() {
    const side = document.querySelector('#tab-puzzles .side');
    if (!side) return;

    let root = side.querySelector('.puzzle-coach-actions');
    const old = side.querySelector('.actions');

    if (!root) {
      root = document.createElement('div');
      root.className = 'puzzle-coach-actions';
      if (old) {
        const secondary = document.createElement('div');
        secondary.className = 'puzzle-coach-secondary';
        while (old.firstChild) secondary.appendChild(old.firstChild);
        root.appendChild(secondary);
        old.replaceWith(root);
      } else {
        root.innerHTML = '<div class="puzzle-coach-secondary"></div>';
        side.appendChild(root);
      }
    }

    let button = root.querySelector('#pCoachBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'pCoachBtn';
      button.className = 'btn chess puzzle-coach-main';
      button.addEventListener('click', toggleReview);
      root.insertBefore(button, root.firstChild);
    }

    button.textContent = reviewOpen
      ? tx('Скрыть разбор', 'Hide review')
      : tx('Разобрать с тренером', 'Review with coach');
    button.disabled = !attemptSan;
  }

  function resetForPuzzle() {
    const p = currentPuzzle();
    const key = p ? String(p.id || p.fen || '') : '';
    if (key === puzzleKey) return;
    puzzleKey = key;
    attemptSan = '';
    fromSquare = -1;
    reviewOpen = false;
    const panel = ensurePanel();
    if (panel) panel.classList.add('hidden');
  }

  function qualityTitle(q) {
    const map = {
      brilliant:['Блестящий ход','Brilliant move'],
      good:['Хороший ход','Good move'],
      inaccuracy:['Неточность','Inaccuracy'],
      mistake:['Ошибка','Mistake'],
      blunder:['Грубая ошибка','Blunder']
    };
    const pair = map[q] || ['Ход','Move'];
    return tx(pair[0], pair[1]);
  }

  function captureFromMessage() {
    const msg = $('pMsg');
    if (!msg) return;
    const raw = String(msg.textContent || '').trim();
    if (!raw) return;

    let san = '';
    const wrong = raw.match(/\(([^()]+)\)\s*$/);
    if (wrong) san = wrong[1].trim();
    if (!san) {
      const right = raw.match(/(?:Верно|Correct)[^A-Za-zА-Яа-я0-9]*([A-Za-zА-Яа-я0-9+#=\-]+)\s*$/i);
      if (right) san = right[1].trim();
    }
    if (san) setAttempt(san);
  }

  function setAttempt(san) {
    if (!san) return;
    if (san === attemptSan) return;
    attemptSan = san;
    reviewOpen = false;
    const panel = ensurePanel();
    if (panel) panel.classList.add('hidden');
    ensureActions();
  }

  function captureBoardClick(e) {
    const cell = e.target.closest('#pBoard .sqr');
    if (!cell) return;
    const p = currentPuzzle();
    const E = window.ChessEngine;
    if (!p || !E) return;

    const sq = Number(cell.dataset.sq);
    if (!Number.isInteger(sq)) return;

    if (fromSquare < 0) {
      const st = E.create(p.fen);
      const piece = st.board[sq];
      if (piece && (piece & 8) === st.turn) fromSquare = sq;
      return;
    }

    const st = E.create(p.fen);
    const candidates = E.generate(st, { square: fromSquare }).filter(m => m.to === sq);
    fromSquare = -1;
    if (!candidates.length) return;

    try {
      setAttempt(E.toSAN(st, candidates[0]));
    } catch (_) {}
  }

  function renderReview() {
    const panel = ensurePanel();
    const p = currentPuzzle();
    if (!panel || !p || !attemptSan || !window.ChessReview) return false;

    let result = null;
    try { result = ChessReview.review(p.fen, attemptSan); } catch (_) { result = null; }
    if (!result) {
      panel.classList.remove('hidden');
      panel.innerHTML = `<div class="pcr-card bad"><div class="pcr-text">${tx('Не удалось разобрать этот ход в текущей позиции.','This move could not be reviewed in the current position.')}</div></div>`;
      return true;
    }

    const t = teacher() || {
      name:{ru:'Тренер'}, role:{ru:''}, strictness:3,
      phrases:{good:'Посмотри ещё раз на позицию.'}
    };
    const phrase = t.phrases?.[result.quality] || t.phrases?.good || '';
    const note = typeof ChessReview.shortNote === 'function'
      ? ChessReview.shortNote(result, (window.Sky && Sky.lang) || 'ru')
      : tx('Движок проверил ход.', 'The engine checked the move.');
    const best = result.betterMove
      ? result.betterMove
      : tx('Ваш ход совпал с лучшим найденным.', 'Your move matched the best found move.');
    const loss = result.loss == null ? '—' : (result.loss / 100).toFixed(1);
    const material = result.material == null ? '—' : (result.material / 100).toFixed(1);
    const good = result.quality === 'good' || result.quality === 'brilliant';

    panel.innerHTML = `
      <div class="pcr-head">
        <div class="pcr-face">${teacherFace()}</div>
        <div class="pcr-head-copy">
          <div class="pcr-name">${esc(t.name?.ru || 'Тренер')}</div>
          <div class="pcr-role">${esc(t.role?.ru || '')} · ${esc(strictText(t))}</div>
        </div>
      </div>
      <div class="pcr-title">${esc(attemptSan)} · ${esc(qualityTitle(result.quality))}</div>
      <div class="pcr-card ${good ? 'good' : 'bad'}"><div class="pcr-text">${esc(note)}</div></div>
      <div class="pcr-facts">
        <div class="pcr-fact"><b>${esc(best)}</b><span>${tx('лучшее продолжение','best continuation')}</span></div>
        <div class="pcr-fact"><b>${esc(loss)} п.</b><span>${tx('потеря оценки','evaluation loss')}</span></div>
        <div class="pcr-fact"><b>${esc(material)} п.</b><span>${tx('материал','material')}</span></div>
      </div>
      <div class="pcr-quote">${esc(phrase)}</div>`;

    panel.classList.remove('hidden');
    return true;
  }

  function toggleReview() {
    if (!attemptSan) return;
    const panel = ensurePanel();
    if (!panel) return;
    if (reviewOpen) {
      reviewOpen = false;
      panel.classList.add('hidden');
    } else {
      reviewOpen = renderReview();
    }
    ensureActions();
  }

  function refresh() {
    addStyles();
    resetForPuzzle();
    captureFromMessage();
    ensureActions();
  }

  function init() {
    addStyles();
    document.addEventListener('click', captureBoardClick, true);
    ['pCount','pMsg'].map($).filter(Boolean).forEach(node => {
      const mo = new MutationObserver(refresh);
      mo.observe(node, {childList:true,subtree:true,characterData:true});
    });
    document.addEventListener('langchange', () => setTimeout(refresh, 0));
    window.addEventListener('chessTeacherChanged', () => {
      if (reviewOpen) renderReview();
    });
    window.addEventListener('chessPuzzleLoaded', refresh);
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once:true });
  } else {
    setTimeout(init, 0);
  }
})();
