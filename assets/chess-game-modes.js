/* ============================================================
   SkyySchool — режим игры против бота.
   UI-слой: не меняет шахматный движок и не ломает существующий
   режим с тренером. Добавляет:
   - «С тренером» / «Без тренера»;
   - рабочую прокси-кнопку «Новая партия»;
   - «Сдаться» с нормальным завершением текущей сессии;
   - защиту от случайного хода бота после сдачи.
   ============================================================ */
'use strict';

(function () {
  const MODE_KEY = 'sky_chess_game_mode';
  const SURRENDER_LOCK_KEY = '__skyChessSurrenderLock';
  const TRAINER = 'coach';
  const SOLO = 'solo';

  const text = (ru, en) => (window.Sky && Sky.lang === 'en' ? en : ru);

  let mode = localStorage.getItem(MODE_KEY) === SOLO ? SOLO : TRAINER;
  let surrenderLock = false;

  function get(id) { return document.getElementById(id); }

  function ensureStyles() {
    if (get('chess-game-modes-styles')) return;
    const style = document.createElement('style');
    style.id = 'chess-game-modes-styles';
    style.textContent = `
      #tab-game.game-no-coach .tui-current,
      #tab-game.game-no-coach .review { display:none !important; }

      .game-mode-panel {
        margin:0 0 16px;
        padding:14px;
        border:1px solid var(--line);
        border-radius:16px;
        background:var(--panel);
        box-shadow:var(--shadow-sm);
      }
      .game-mode-head {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin-bottom:10px;
      }
      .game-mode-title {
        font-size:12px;
        font-weight:900;
        line-height:1.2;
      }
      .game-mode-sub {
        margin-top:3px;
        color:var(--muted);
        font-size:10.5px;
        line-height:1.35;
      }
      .game-mode-current {
        flex:0 0 auto;
        padding:5px 8px;
        border-radius:999px;
        background:var(--m-chess-soft);
        color:var(--m-chess);
        border:1px solid color-mix(in srgb,var(--m-chess) 20%,transparent);
        font-size:9.5px;
        font-weight:900;
      }
      .game-mode-grid {
        display:grid;
        grid-template-columns:repeat(2,minmax(0,1fr));
        gap:8px;
      }
      .game-mode-btn {
        position:relative;
        display:flex;
        align-items:center;
        gap:9px;
        width:100%;
        min-height:54px;
        padding:10px 11px;
        border:1px solid var(--line);
        border-radius:12px;
        background:var(--panel-2);
        text-align:left;
        transition:.16s;
      }
      .game-mode-btn:hover { border-color:var(--line-2); transform:translateY(-1px); }
      .game-mode-btn.is-active {
        border-color:var(--m-chess);
        background:var(--m-chess-soft);
        box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 11%,transparent);
      }
      .game-mode-btn.is-active::after {
        content:'✓';
        position:absolute;
        top:7px;
        right:7px;
        width:17px;
        height:17px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:var(--m-chess);
        color:#fff;
        font-size:10px;
        font-weight:900;
      }
      .game-mode-icon { font-size:18px; line-height:1; flex:0 0 auto; }
      .game-mode-name { font-size:11.5px; font-weight:900; line-height:1.2; }
      .game-mode-desc { margin-top:3px; color:var(--muted); font-size:9.5px; line-height:1.3; }

      .game-action-row {
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:8px;
        margin-top:10px;
      }
      .game-action-row .btn { width:100%; }
      .game-surrender {
        color:var(--no) !important;
        border-color:color-mix(in srgb,var(--no) 25%,var(--line)) !important;
        background:var(--no-soft) !important;
      }
      .game-surrender:hover {
        border-color:var(--no) !important;
        box-shadow:var(--shadow-sm);
      }
      .game-surrender:disabled {
        opacity:.45;
        cursor:not-allowed;
      }
      .game-over-note {
        padding:12px 14px;
        border-radius:13px;
        border:1px solid color-mix(in srgb,var(--no) 22%,var(--line));
        background:var(--no-soft);
        color:var(--no);
        font-size:13px;
        font-weight:900;
      }
      #gBoard.game-board-locked { pointer-events:none; opacity:.72; }
      @media(max-width:600px){
        .game-mode-head { align-items:flex-start; }
        .game-mode-current { display:none; }
        .game-mode-grid { grid-template-columns:1fr; }
        .game-action-row { grid-template-columns:1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function updateRootClass() {
    const game = get('tab-game');
    if (!game) return;
    game.classList.toggle('game-no-coach', mode === SOLO);
    game.classList.toggle('game-with-coach', mode === TRAINER);
  }

  function currentModeLabel() {
    return mode === TRAINER
      ? text('С тренером', 'With coach')
      : text('Без тренера', 'No coach');
  }

  function renderModePanel() {
    const game = get('tab-game');
    if (!game) return;

    let panel = get('gameModePanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'gameModePanel';
      panel.className = 'game-mode-panel';
      const first = game.firstElementChild;
      game.insertBefore(panel, first);
    }

    panel.innerHTML = `
      <div class="game-mode-head">
        <div>
          <div class="game-mode-title">${text('Режим игры', 'Game mode')}</div>
          <div class="game-mode-sub">${text('Выберите: учитель разбирает ваши ходы или вы играете без объяснений.', 'Choose whether the coach reviews your moves or you play without explanations.')}</div>
        </div>
        <div class="game-mode-current">${currentModeLabel()}</div>
      </div>
      <div class="game-mode-grid">
        <button type="button" class="game-mode-btn${mode === TRAINER ? ' is-active' : ''}" data-game-mode="${TRAINER}" aria-pressed="${mode === TRAINER}">
          <span class="game-mode-icon">🧑‍🏫</span>
          <span>
            <span class="game-mode-name">${text('С тренером', 'With coach')}</span>
            <span class="game-mode-desc">${text('Ваш выбранный тренер объясняет ходы и ошибки.', 'Your selected coach explains moves and mistakes.')}</span>
          </span>
        </button>
        <button type="button" class="game-mode-btn${mode === SOLO ? ' is-active' : ''}" data-game-mode="${SOLO}" aria-pressed="${mode === SOLO}">
          <span class="game-mode-icon">♟</span>
          <span>
            <span class="game-mode-name">${text('Без тренера', 'No coach')}</span>
            <span class="game-mode-desc">${text('Только доска, бот и выбранная сложность.', 'Only the board, bot and selected difficulty.')}</span>
          </span>
        </button>
      </div>
      <div class="game-action-row">
        <button type="button" class="btn chess small" id="gNewProxy">${text('Новая партия', 'New game')}</button>
        <button type="button" class="btn ghost small game-surrender" id="gSurrender">${text('Сдаться', 'Resign')}</button>
      </div>
    `;

    panel.querySelectorAll('[data-game-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = btn.dataset.gameMode === SOLO ? SOLO : TRAINER;
        localStorage.setItem(MODE_KEY, mode);
        updateRootClass();
        renderModePanel();
        updateCoachVisibility();
      });
    });

    const proxy = get('gNewProxy');
    proxy.addEventListener('click', () => {
      surrenderLock = false;
      get('gBoard')?.classList.remove('game-board-locked');
      const original = get('gNew');
      if (original) original.click();
      window.setTimeout(updateSurrenderButton, 30);
    });

    const surrender = get('gSurrender');
    surrender.addEventListener('click', resign);
    updateSurrenderButton();
  }

  function updateCoachVisibility() {
    updateRootClass();
    const review = get('gReview');
    if (review && mode === SOLO) review.classList.add('hidden');
    if (review && mode === TRAINER) {
      // показываем последний разбор только если он реально существует
      if (review.innerHTML.trim()) review.classList.remove('hidden');
    }
  }

  function aiWrap() {
    if (!window.ChessAI || window.ChessAI.__skyGameModeWrapped) return;
    const ai = window.ChessAI;
    const original = ai.bestMove;
    ai.bestMove = function (state, level) {
      if (surrenderLock) return null;
      return original.call(this, state, level);
    };
    ai.__skyGameModeWrapped = true;
  }

  function showSurrenderResult() {
    const modal = window.Sky && Sky.modal;
    const ru = Sky && Sky.lang !== 'en';
    const title = ru ? 'Вы сдались' : 'You resigned';
    const body = ru
      ? 'Партия завершена. Новый соперник будет готов, когда вы начнёте новую партию.'
      : 'The game is over. Start a new game when you are ready.';
    const newLabel = ru ? 'Новая партия' : 'New game';
    const closeLabel = ru ? 'Оставить доску' : 'Keep the board';

    if (!modal) {
      alert(title);
      return;
    }

    modal(
      `<div class="gameover">
         <div class="mark lose">✕</div>
         <h2>${title}</h2>
         <p class="why">${body}</p>
       </div>
       <button class="btn chess full big" id="gmResignNew" style="margin-top:18px">${newLabel}</button>
       <button class="btn ghost full" id="gmResignClose" style="margin-top:9px">${closeLabel}</button>`,
      (box, close) => {
        box.querySelector('#gmResignNew').addEventListener('click', () => {
          close();
          surrenderLock = false;
          get('gBoard')?.classList.remove('game-board-locked');
          const original = get('gNew');
          if (original) original.click();
          window.setTimeout(updateSurrenderButton, 30);
        });
        box.querySelector('#gmResignClose').addEventListener('click', close);
      }
    );
  }

  function resign() {
    if (surrenderLock) return;
    const status = get('gStatus');
    if (!status) return;
    const statusText = String(status.textContent || '').trim();
    if (!statusText) {
      // Игра ещё не начата — кнопка ничего не делает.
      return;
    }
    if (/бот думает|bot is thinking/i.test(statusText)) {
      return;
    }

    surrenderLock = true;
    get('gBoard')?.classList.add('game-board-locked');
    const info = get('gStatus');
    if (info) {
      info.className = 'gameinfo verdict no';
      info.textContent = text('Вы сдались.', 'You resigned.');
    }
    showSurrenderResult();
    updateSurrenderButton();
  }

  function updateSurrenderButton() {
    const b = get('gSurrender');
    if (!b) return;
    const status = get('gStatus');
    const txt = status ? String(status.textContent || '') : '';
    const thinking = /бот думает|bot is thinking/i.test(txt);
    b.disabled = surrenderLock || !txt || thinking;
  }

  function repairOriginalNewGameField() {
    const originalField = get('gNew')?.closest('.field');
    if (originalField) originalField.classList.add('legacy-new-game-control');
    if (!document.getElementById('chess-game-legacy-style')) {
      const style = document.createElement('style');
      style.id = 'chess-game-legacy-style';
      style.textContent = '.legacy-new-game-control{display:none!important;}';
      document.head.appendChild(style);
    }
  }

  function watchStatus() {
    const status = get('gStatus');
    if (!status || status.__skyObserved) return;
    const observer = new MutationObserver(updateSurrenderButton);
    observer.observe(status, { childList:true, subtree:true, characterData:true, attributes:true });
    status.__skyObserved = true;
  }

  function init() {
    ensureStyles();
    aiWrap();
    repairOriginalNewGameField();
    renderModePanel();
    updateCoachVisibility();
    watchStatus();
    updateSurrenderButton();
  }

  const start = () => window.setTimeout(init, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();

  window.addEventListener('chessTeacherChanged', () => {
    if (mode === TRAINER) updateCoachVisibility();
  });
})();
