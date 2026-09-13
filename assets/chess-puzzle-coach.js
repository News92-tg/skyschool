/* ============================================================
   SkyySchool — тренер для шахматных задач
   Добавляет полноценный разбор решения прямо во вкладке «Задачи».
   Не вмешивается в ядро движка и не подменяет ChessReview.
   ============================================================ */
'use strict';

(function () {
  const STYLE_ID = 'chess-puzzle-coach-styles';
  const PANEL_ID = 'pCoachReview';
  let lastPuzzleKey = '';
  let lastAttemptSan = '';
  let renderedForKey = '';

  const $ = id => document.getElementById(id);
  const tx = (ru, en) => window.Sky && Sky.lang === 'en' ? en : ru;
  const esc = value => String(value == null ? '' : value)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function addStyles() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tab-puzzles .puzzle-coach-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
      #tab-puzzles .puzzle-coach-btn{flex:1 1 180px}
      #tab-puzzles .puzzle-coach-btn[disabled]{opacity:.45;cursor:not-allowed}
      #tab-puzzles .puzzle-coach-review{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:15px;background:var(--panel);box-shadow:var(--shadow-sm);}
      #tab-puzzles .puzzle-coach-review.hidden{display:none}
      #tab-puzzles .pcr-head{display:flex;align-items:center;gap:10px}
      #tab-puzzles .pcr-face{width:42px;height:42px;flex:0 0 42px;border-radius:50%;overflow:hidden}
      #tab-puzzles .pcr-face svg{display:block;width:100%;height:100%}
      #tab-puzzles .pcr-head-copy{min-width:0;flex:1}
      #tab-puzzles .pcr-name{font-size:12px;font-weight:900;line-height:1.2}
      #tab-puzzles .pcr-role{margin-top:2px;color:var(--muted);font-size:9.5px}
      #tab-puzzles .pcr-verdict{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:var(--panel-2);}
      #tab-puzzles .pcr-verdict.good{border-color:color-mix(in srgb,var(--ok) 25%,var(--line));background:color-mix(in srgb,var(--ok) 7%,var(--panel))}
      #tab-puzzles .pcr-verdict.bad{border-color:color-mix(in srgb,var(--no) 25%,var(--line));background:color-mix(in srgb,var(--no) 6%,var(--panel))}
      #tab-puzzles .pcr-verdict-title{font-size:11px;font-weight:900}
      #tab-puzzles .pcr-verdict-text{margin-top:4px;font-size:10.5px;line-height:1.5;color:var(--ink-2)}
      #tab-puzzles .pcr-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px}
      #tab-puzzles .pcr-fact{padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2)}
      #tab-puzzles .pcr-fact b{display:block;font-size:10.5px;line-height:1.2}
      #tab-puzzles .pcr-fact span{display:block;margin-top:3px;color:var(--muted);font-size:8.5px;line-height:1.25}
      #tab-puzzles .pcr-quote{margin-top:9px;padding:9px 10px;border-left:3px solid var(--m-chess);background:var(--m-chess-soft);border-radius:0 10px 10px 0;font-size:10.5px;line-height:1.45;font-weight:800;color:var(--ink-2)}
      #tab-puzzles .pcr-raw{margin-top:8px;color:var(--muted);font-size:8.5px;line-height:1.4}
      @media(max-width:520px){
        #tab-puzzles .pcr-facts{grid-template-columns:1fr 1fr}
        #tab-puzzles .pcr-fact:last-child{grid-column:1/-1}
      }
    `;
    document.head.appendChild(style);
  }

  function getCurrentPuzzle() {
    const list = window.CHESS_PUZZLES;
    if (!Array.isArray(list) || !list.length) return null;
    const count = $('pCount');
    const text = count ? String(count.textContent || '') : '';
    const m = text.match(/(\d+)\s*(?:из|of)\s*(\d+)/i);
    const index = m ? Math.max(0, Math.min(list.length - 1, Number(m[1]) - 1)) : 0;
    return list[index] || null;
  }

  function getPuzzleKey() {
    const p = getCurrentPuzzle();
    return p ? String(p.id || p.fen || '') : '';
  }

  function getTeacher() {
    if (!window.ChessTeacherUI) return null;
    try { return ChessTeacherUI.getTeacher ? ChessTeacherUI.getTeacher() : null; } catch (e) { return null; }
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
    return labels[Math.max(1, Math.min(5, Number(t.strictness || 3))) - 1];
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
    let actions = side.querySelector('.puzzle-coach-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'puzzle-coach-actions';
      const existing = side.querySelector('.actions');
      if (existing) existing.before(actions);
      else side.appendChild(actions);
    }
    let button = actions.querySelector('#pCoachBtn');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'pCoachBtn';
      button.className = 'btn chess small puzzle-coach-btn';
      actions.appendChild(button);
      button.addEventListener('click', analyzeCurrent);
    }
    button.textContent = tx('Разобрать с тренером', 'Review with coach');
    button.disabled = !lastAttemptSan;
  }

  function renderEmpty() {
    const panel = ensurePanel();
    if (!panel) return;
    const t = getTeacher();
    const name = t && t.name ? (t.name.ru || '') : tx('Тренер', 'Coach');
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="pcr-head">
        <div class="pcr-face">${getTeacherFace()}</div>
        <div class="pcr-head-copy">
          <div class="pcr-name">${esc(name)}</div>
          <div class="pcr-role">${tx('Готов разобрать ваш ход', 'Ready to review your move')} · ${esc(t ? strictText(t) : '')}</div>
        </div>
      </div>
      <div class="pcr-verdict">
        <div class="pcr-verdict-title">${tx('Сделайте ход', 'Make a move')}</div>
        <div class="pcr-verdict-text">${tx('После попытки я покажу оценку движка, лучший вариант и объяснение выбранного тренера.', 'After your attempt you will see the engine verdict, the best line and your coach’s explanation.')}</div>
      </div>`;
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
    return ['brilliant','good'].includes(q) ? 'good' : 'bad';
  }

  function analyzeCurrent() {
    const p = getCurrentPuzzle();
    if (!p || !lastAttemptSan || !window.ChessReview || !window.ChessEngine) return;
    const panel = ensurePanel();
    const t = getTeacher();
    if (!panel) return;

    let result = null;
    try { result = ChessReview.review(p.fen, lastAttemptSan); } catch (e) { result = null; }
    if (!result) {
      panel.classList.remove('hidden');
      panel.innerHTML = `<div class="pcr-verdict bad"><div class="pcr-verdict-title">${tx('Не удалось разобрать ход','Could not review the move')}</div><div class="pcr-verdict-text">${tx('Ход не удалось сопоставить с текущей позицией.', 'The move could not be matched to the current position.')}</div></div>`;
      return;
    }

    const teacher = t || { name:{ru:'Тренер'}, role:{ru:''}, phrases:{good:'Хорошо.'}, strictness:3 };
    const phrase = teacher.phrases[result.quality] || teacher.phrases.good || '';
    const note = typeof ChessReview.shortNote === 'function' ? ChessReview.shortNote(result, (Sky && Sky.lang) || 'ru') : '';
    const better = result.betterMove ? esc(result.betterMove) : tx('Лучший найденный ход совпал с вашим.', 'Your move matched the best found move.');
    const material = result.material == null ? '—' : (result.material / 100).toFixed(1);
    const loss = result.loss == null ? '—' : (result.loss / 100).toFixed(1);

    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="pcr-head">
        <div class="pcr-face">${getTeacherFace()}</div>
        <div class="pcr-head-copy">
          <div class="pcr-name">${esc(teacher.name.ru || '')}</div>
          <div class="pcr-role">${esc(teacher.role.ru || '')} · ${esc(strictText(teacher))}</div>
        </div>
      </div>
      <div class="pcr-verdict ${qualityClass(result.quality)}">
        <div class="pcr-verdict-title">${esc(lastAttemptSan)} — ${esc(qualityTitle(result.quality))}</div>
        <div class="pcr-verdict-text">${esc(note)}</div>
      </div>
      <div class="pcr-facts">
        <div class="pcr-fact"><b>${better}</b><span>${tx('что искать дальше','what to look for next')}</span></div>
        <div class="pcr-fact"><b>${esc(loss)} п.</b><span>${tx('потеря оценки','evaluation loss')}</span></div>
        <div class="pcr-fact"><b>${esc(material)} п.</b><span>${tx('изменение материала','material change')}</span></div>
      </div>
      <div class="pcr-quote">${esc(phrase)}</div>
      <div class="pcr-raw">${tx('Оценка сделана шахматным движком. Тренер отвечает за объяснение и манеру подачи.', 'The chess engine supplies the verdict. The coach controls the explanation and tone.')}</div>`;
  }

  function captureAttempt() {
    const msg = $('pMsg');
    if (!msg) return;
    const text = String(msg.textContent || '').trim();
    const match = text.match(/\(([^)]+)\)/);
    if (match && match[1]) lastAttemptSan = match[1].trim();
    else {
      const ok = text.match(/✓[^A-Za-zА-Яа-я0-9]*[^ ]+\s+([A-Za-zА-Яа-я0-9+#=\-]+)/i);
      if (ok && ok[1]) lastAttemptSan = ok[1].trim();
    }
    ensureActions();
  }

  function refresh() {
    addStyles();
    const key = getPuzzleKey();
    if (key && key !== lastPuzzleKey) {
      lastPuzzleKey = key;
      lastAttemptSan = '';
      renderedForKey = '';
      const panel = ensurePanel();
      if (panel) panel.classList.add('hidden');
    }
    ensureActions();
    captureAttempt();
  }

  function init() {
    refresh();
    const nodes = ['pTitle','pCount','pMsg','pIdea'].map($).filter(Boolean);
    const observer = new MutationObserver(refresh);
    nodes.forEach(node => observer.observe(node, {childList:true,subtree:true,characterData:true}));
    document.addEventListener('langchange', () => setTimeout(refresh, 0));
    window.setInterval(refresh, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), {once:true});
  else setTimeout(init, 0);
})();
