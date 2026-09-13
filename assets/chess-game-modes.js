/* ============================================================
   SkyySchool chess experience layer
   - clean game layout
   - coach / no-coach presentation
   - readable difficulty selector
   - validated puzzle filtering
   - visual lesson demos with light piece animation
   ============================================================ */
'use strict';

(function () {
  const MODE_KEY = 'sky_chess_game_mode';
  const TRAINER = 'coach';
  const SOLO = 'solo';

  const tx = (ru, en) => (window.Sky && Sky.lang === 'en' ? en : ru);
  const $ = (id) => document.getElementById(id);

  let mode = localStorage.getItem(MODE_KEY) === SOLO ? SOLO : TRAINER;
  let resigned = false;
  let puzzleIndex = 0;

  function addStyles() {
    if ($('chess-experience-styles')) return;
    const style = document.createElement('style');
    style.id = 'chess-experience-styles';
    style.textContent = `
      #tab-game,#tab-puzzles,#tab-lessons{min-width:0}
      #tab-game .board-wrap,#tab-puzzles .board-wrap{display:grid;grid-template-columns:minmax(0,760px) minmax(280px,320px);gap:22px;align-items:start}
      #tab-game .board,#tab-puzzles .board{width:100%;max-width:760px;aspect-ratio:1;justify-self:start}
      #tab-game .side,#tab-puzzles .side{min-width:0}
      #tab-game > .row.game-controls-clean{margin:0 0 16px;display:grid;grid-template-columns:minmax(0,220px) minmax(0,220px) auto;gap:10px;align-items:end}
      #tab-game > .row.game-controls-clean .field{min-width:0}
      #tab-game > .row.game-controls-clean .legacy-new-game-control,#tab-game .legacy-hidden-new{display:none!important}
      #tab-game .difficulty-panel{width:100%;margin:0 0 14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-game .difficulty-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px}
      #tab-game .difficulty-title{font-size:14px;font-weight:900;line-height:1.25}
      #tab-game .difficulty-sub{margin-top:4px;max-width:650px;font-size:11px;line-height:1.35;color:var(--muted)}
      #tab-game .difficulty-now{flex:0 0 auto;padding:6px 9px;border:1px solid color-mix(in srgb,var(--m-chess) 20%,var(--line));border-radius:999px;background:var(--m-chess-soft);color:var(--m-chess);font-size:10px;font-weight:900}
      #tab-game .difficulty-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      #tab-game .difficulty-card{position:relative;min-height:116px;padding:11px 10px;border:1px solid var(--line);border-radius:13px;background:var(--panel-2);color:var(--ink);text-align:left;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}
      #tab-game .difficulty-card:hover{transform:translateY(-1px);border-color:var(--line-2);box-shadow:var(--shadow-sm)}
      #tab-game .difficulty-card.is-active{border-color:var(--m-chess);background:var(--m-chess-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 12%,transparent)}
      #tab-game .difficulty-card.is-active::after{content:'✓';position:absolute;top:7px;right:7px;width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:var(--m-chess);color:#fff;font-size:10px;font-weight:900}
      #tab-game .difficulty-icon{font-size:18px;line-height:1;margin-bottom:8px}
      #tab-game .difficulty-name{font-size:11.5px;font-weight:900;line-height:1.2}
      #tab-game .difficulty-desc{min-height:42px;margin-top:4px;font-size:9.5px;line-height:1.35;color:var(--muted)}
      #tab-game .difficulty-human{display:flex;gap:3px;margin-top:7px}
      #tab-game .difficulty-human i{font-style:normal;font-size:11px;opacity:.2}
      #tab-game .difficulty-human i.on{opacity:1}
      #tab-game .difficulty-live-note{margin-top:9px;font-size:10px;line-height:1.4;color:var(--muted)}
      #tab-game .game-mode-panel{margin:0 0 14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-game .game-mode-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:10px}
      #tab-game .game-mode-title{font-size:14px;font-weight:900}
      #tab-game .game-mode-sub{margin-top:4px;font-size:11px;line-height:1.35;color:var(--muted)}
      #tab-game .game-mode-current{flex:0 0 auto;padding:6px 9px;border-radius:999px;background:var(--m-chess-soft);color:var(--m-chess);font-size:9.5px;font-weight:900}
      #tab-game .game-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #tab-game .game-mode-btn{position:relative;display:flex;align-items:center;gap:10px;min-height:58px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2);text-align:left;cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease,box-shadow .15s ease}
      #tab-game .game-mode-btn:hover{transform:translateY(-1px);border-color:var(--line-2)}
      #tab-game .game-mode-btn.is-active{border-color:var(--m-chess);background:var(--m-chess-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 11%,transparent)}
      #tab-game .game-mode-btn.is-active::after{content:'✓';position:absolute;top:7px;right:7px;width:17px;height:17px;display:grid;place-items:center;border-radius:50%;background:var(--m-chess);color:#fff;font-size:10px;font-weight:900}
      #tab-game .game-mode-icon{flex:0 0 auto;width:26px;text-align:center;font-size:20px;line-height:1}
      #tab-game .game-mode-name{display:block;font-size:11.5px;font-weight:900;line-height:1.2}
      #tab-game .game-mode-desc{display:block;margin-top:3px;font-size:9.5px;line-height:1.3;color:var(--muted)}
      #tab-game .game-action-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
      #tab-game .game-action-row .btn{width:100%}
      #tab-game .game-surrender{color:var(--no)!important;border-color:color-mix(in srgb,var(--no) 25%,var(--line))!important;background:var(--no-soft)!important}
      #tab-game .game-surrender:hover{border-color:var(--no)!important}
      #tab-game .game-surrender:disabled{opacity:.45;cursor:not-allowed}
      #tab-game.game-no-coach .review,#tab-game.game-no-coach .tui-current{display:none!important}
      #tab-game .game-board-locked{pointer-events:none}
      #tab-lessons .lesson-list-modern{display:grid;gap:10px}
      #tab-lessons .lesson-modern{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm);transition:border-color .15s ease,box-shadow .15s ease}
      #tab-lessons .lesson-modern.open{border-color:color-mix(in srgb,var(--m-chess) 28%,var(--line));box-shadow:var(--shadow)}
      #tab-lessons .lesson-modern>button{display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;text-align:left}
      #tab-lessons .lesson-number{flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:var(--m-chess-soft);color:var(--m-chess);font-size:11px;font-weight:900}
      #tab-lessons .lesson-title-wrap{min-width:0;flex:1}
      #tab-lessons .lesson-modern-title{font-size:13px;font-weight:900;line-height:1.25}
      #tab-lessons .lesson-modern-sub{display:block;margin-top:3px;font-size:10px;color:var(--muted)}
      #tab-lessons .lesson-chevron{flex:0 0 auto;color:var(--muted);font-size:18px;transition:transform .2s ease,color .2s ease}
      #tab-lessons .lesson-modern.open .lesson-chevron{transform:rotate(90deg);color:var(--m-chess)}
      #tab-lessons .lesson-modern-body{display:grid;grid-template-columns:minmax(230px,280px) minmax(0,1fr);gap:18px;padding:0 16px 16px}
      #tab-lessons .lesson-demo{min-width:0;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2)}
      #tab-lessons .lesson-demo-title{margin-bottom:8px;font-size:10px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
      #tab-lessons .lesson-demo-board{width:100%!important;max-width:100%!important;aspect-ratio:1!important;margin:0!important}
      #tab-lessons .lesson-text{min-width:0}
      #tab-lessons .lesson-text-content{white-space:pre-wrap;font-size:13px;line-height:1.72;color:var(--ink-2)}
      #tab-lessons .lesson-tip{margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--m-chess-soft);color:var(--m-chess);font-size:10.5px;line-height:1.45;font-weight:800}
      #tab-puzzles .puzzle-side-card{padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-puzzles .puzzle-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
      #tab-puzzles #pMsg{min-height:28px}
      @media(max-width:1000px){#tab-game .difficulty-grid{grid-template-columns:repeat(3,minmax(0,1fr))}#tab-game .game-mode-grid{grid-template-columns:1fr}#tab-game .board-wrap,#tab-puzzles .board-wrap{grid-template-columns:minmax(0,1fr)}}
      @media(max-width:700px){#tab-game> .row.game-controls-clean{grid-template-columns:1fr 1fr}#tab-game .difficulty-grid{grid-template-columns:1fr 1fr}#tab-game .difficulty-card.smart{grid-column:1/-1}#tab-game .difficulty-now{display:none}#tab-lessons .lesson-modern-body{grid-template-columns:1fr}}
      @media(max-width:480px){#tab-game> .row.game-controls-clean{grid-template-columns:1fr}#tab-game .difficulty-grid{grid-template-columns:1fr 1fr}#tab-game .game-action-row{grid-template-columns:1fr}#tab-lessons .lesson-modern>button{padding:12px}#tab-lessons .lesson-modern-body{padding:0 12px 12px}}
    `;
    document.head.appendChild(style);
  }

  function moveDifficultyPanel() {
    const game = $('tab-game');
    if (!game) return;
    const panel = game.querySelector('.difficulty-panel');
    if (!panel) return;
    const row = panel.closest('.row');
    if (row && !row.classList.contains('game-controls-clean')) {
      row.classList.add('game-controls-clean');
      game.insertBefore(panel, row);
    }
    const select = $('gLevel');
    if (select) select.style.display = 'none';
  }

  function currentModeText() {
    return mode === TRAINER ? tx('С тренером', 'With coach') : tx('Без тренера', 'No coach');
  }

  function renderGameMode() {
    const game = $('tab-game');
    if (!game) return;

    let panel = $('gameModePanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'gameModePanel';
      panel.className = 'game-mode-panel';
      game.insertBefore(panel, game.firstElementChild);
    }

    panel.innerHTML = `
      <div class="game-mode-head">
        <div>
          <div class="game-mode-title">${tx('Режим игры', 'Game mode')}</div>
          <div class="game-mode-sub">${tx('Выберите, нужен ли вам разбор ходов тренером. Сложность бота настраивается отдельно.', 'Choose whether you want coach feedback. Bot strength is configured separately.')}</div>
        </div>
        <div class="game-mode-current">${currentModeText()}</div>
      </div>
      <div class="game-mode-grid">
        <button type="button" class="game-mode-btn${mode === TRAINER ? ' is-active' : ''}" data-game-mode="${TRAINER}" aria-pressed="${mode === TRAINER}">
          <span class="game-mode-icon">🧑‍🏫</span>
          <span><span class="game-mode-name">${tx('С тренером', 'With coach')}</span><span class="game-mode-desc">${tx('Тренер объясняет ваши ходы и ошибки.', 'The coach explains your moves and mistakes.')}</span></span>
        </button>
        <button type="button" class="game-mode-btn${mode === SOLO ? ' is-active' : ''}" data-game-mode="${SOLO}" aria-pressed="${mode === SOLO}">
          <span class="game-mode-icon">♟</span>
          <span><span class="game-mode-name">${tx('Без тренера', 'No coach')}</span><span class="game-mode-desc">${tx('Только партия и выбранная сложность.', 'Only the game and selected difficulty.')}</span></span>
        </button>
      </div>
      <div class="game-action-row">
        <button type="button" class="btn chess small" id="gNewProxy">${tx('Новая партия', 'New game')}</button>
        <button type="button" class="btn ghost small game-surrender" id="gSurrender">${tx('Сдаться', 'Resign')}</button>
      </div>
    `;

    panel.querySelectorAll('[data-game-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.gameMode === SOLO ? SOLO : TRAINER;
        localStorage.setItem(MODE_KEY, mode);
        if (mode === SOLO) {
          const review = $('gReview');
          if (review) review.classList.add('hidden');
        }
        syncGameMode();
        renderGameMode();
      });
    });

    panel.querySelector('#gNewProxy').addEventListener('click', () => {
      resigned = false;
      const board = $('gBoard');
      if (board) board.classList.remove('game-board-locked');
      const original = $('gNew');
      if (original) original.click();
      setTimeout(afterGameStarted, 40);
    });

    panel.querySelector('#gSurrender').addEventListener('click', resign);
    syncGameMode();
    updateSurrenderButton();
  }

  function syncGameMode() {
    const game = $('tab-game');
    if (!game) return;
    game.classList.toggle('game-no-coach', mode === SOLO);
    game.classList.toggle('game-with-coach', mode === TRAINER);
    const board = $('gBoard');
    if (board) board.classList.toggle('game-board-locked', resigned);
  }

  function patchStatusWatcher() {
    const status = $('gStatus');
    if (!status || status.__skyExperienceObserver) return;
    const observer = new MutationObserver(updateSurrenderButton);
    observer.observe(status, { childList:true, subtree:true, characterData:true });
    status.__skyExperienceObserver = true;
  }

  function updateSurrenderButton() {
    const button = $('gSurrender');
    if (!button) return;
    const status = $('gStatus');
    const text = status ? String(status.textContent || '').trim() : '';
    const waiting = /бот думает|bot is thinking/i.test(text);
    const ended = /вы выиграли|вы проиграли|ничья|сдались|you win|you lose|draw|resigned/i.test(text);
    button.disabled = resigned || !text || waiting || ended;
  }

  function installResignationHook() {
    if (!window.ChessAI || window.ChessAI.__skyExperienceWrapped) return;
    const original = window.ChessAI.bestMove;
    window.ChessAI.bestMove = function (state, level) {
      if (resigned) return null;
      return original.call(this, state, level);
    };
    window.ChessAI.__skyExperienceWrapped = true;
  }

  function resign() {
    if (resigned) return;
    const status = $('gStatus');
    const text = status ? String(status.textContent || '').trim() : '';
    if (!text || /бот думает|bot is thinking/i.test(text)) return;
    if (/вы выиграли|вы проиграли|ничья|you win|you lose|draw/i.test(text)) return;

    resigned = true;
    syncGameMode();
    if (status) {
      status.className = 'gameinfo verdict no';
      status.textContent = tx('Вы сдались.', 'You resigned.');
    }
    updateSurrenderButton();

    if (window.Sky && Sky.modal) {
      Sky.modal(
        `<div class="gameover"><div class="mark lose">✕</div><h2>${tx('Вы сдались', 'You resigned')}</h2><p class="why">${tx('Партия завершена. Вы можете начать новую партию и продолжить с чистой доски.', 'The game is over. Start a new game when you are ready.')}</p></div>
         <button class="btn chess full big" id="experienceNewGame" style="margin-top:18px">${tx('Новая партия', 'New game')}</button>
         <button class="btn ghost full" id="experienceClose" style="margin-top:9px">${tx('Оставить позицию', 'Keep position')}</button>`,
        (box, close) => {
          box.querySelector('#experienceNewGame').addEventListener('click', () => {
            close();
            resigned = false;
            const board = $('gBoard');
            if (board) board.classList.remove('game-board-locked');
            const original = $('gNew');
            if (original) original.click();
            setTimeout(afterGameStarted, 40);
          });
          box.querySelector('#experienceClose').addEventListener('click', close);
        }
      );
    }
  }

  function validatePuzzle(puzzle) {
    if (!puzzle || !puzzle.fen || !Array.isArray(puzzle.solutions) || !puzzle.solutions.length) return false;
    const E = window.ChessEngine;
    let state;
    try { state = E.create(puzzle.fen); } catch (e) { return false; }
    if (!state || !state.board) return false;
    if (state.kings[E.WHITE] < 0 || state.kings[E.BLACK] < 0) return false;
    if (E.inCheck(state, state.turn ^ 8)) return false;

    const find = (st, san) => {
      try { return E.findMove(st, san); } catch (e) { return null; }
    };
    const first = find(state, puzzle.solutions[0]);
    if (!first) return false;

    if (puzzle.category === 'mate1') {
      E.make(state, first);
      return E.status(state) === 'checkmate';
    }

    if (puzzle.category === 'mate2') {
      E.make(state, first);
      if (!puzzle.solutions[1]) return E.status(state) !== 'play';
      const second = find(state, puzzle.solutions[1]);
      if (!second) return false;
      E.make(state, second);
      return E.status(state) === 'checkmate';
    }

    return true;
  }

  function cleanPuzzleSet() {
    const list = window.CHESS_PUZZLES;
    if (!Array.isArray(list) || !list.length || !window.ChessEngine) return;
    const valid = list.filter(validatePuzzle);
    list.length = 0;
    list.push.apply(list, valid);
  }

  const DEMO_MOVES = { l01:['e4','Nf3'], l04:['Nxc7+'], l05:['Nf6'], l06:['Qh4+'], l07:['c4'], l08:['Re8#'], l09:['e4','Nf3'], l10:['d5'], l11:['Qxf7#'], l16:['d6'] };

  function pickDemoMove(state, candidates) {
    const E = window.ChessEngine;
    for (const candidate of (candidates || [])) {
      const move = E.findMove(state, candidate);
      if (move) return move;
    }
    const moves = E.generate(state);
    if (!moves.length) return null;
    let best = moves[0], score = -Infinity;
    for (const m of moves) {
      let value = 0;
      if (m.captured) value += 30 + ((m.captured & 7) * 4);
      const san = E.toSAN(state, m);
      if (/#$/.test(san)) value += 100;
      else if (/\+$/.test(san)) value += 50;
      if ((m.piece & 7) === E.PAWN || (m.piece & 7) === E.KNIGHT) value += 5;
      if (value > score) { score = value; best = m; }
    }
    return best;
  }

  function makeLessonCard(lesson, index) {
    const card = document.createElement('article');
    card.className = 'lesson-modern';
    const title = window.Sky ? Sky.L(lesson.title) : (lesson.title.ru || '');
    const textBody = window.Sky ? Sky.L(lesson.body) : (lesson.body.ru || '');

    card.innerHTML = `
      <button type="button" aria-expanded="false">
        <span class="lesson-number">${String(index + 1).padStart(2,'0')}</span>
        <span class="lesson-title-wrap"><span class="lesson-modern-title"></span><span class="lesson-modern-sub">${tx('Открыть визуальный разбор','Open visual explanation')}</span></span>
        <span class="lesson-chevron">›</span>
      </button>
      <div class="lesson-modern-body hidden">
        <div class="lesson-demo"><div class="lesson-demo-title">${tx('На доске','On the board')}</div><div class="lesson-demo-board"></div><div class="lesson-tip">${tx('Фигуры двигаются автоматически — можно сразу увидеть идею.','The pieces animate automatically so you can see the idea immediately.')}</div></div>
        <div class="lesson-text"><div class="lesson-text-content"></div></div>
      </div>`;

    card.querySelector('.lesson-modern-title').textContent = title;
    card.querySelector('.lesson-text-content').textContent = textBody;

    const body = card.querySelector('.lesson-modern-body');
    const button = card.querySelector('button');
    const demoHost = card.querySelector('.lesson-demo-board');
    let demoApi = null, timer = null;

    function stopTimers() { if (timer) { clearTimeout(timer); timer = null; } }

    function playDemo() {
      stopTimers();
      if (!lesson.fen || !window.ChessEngine || typeof window.makeBoard !== 'function') return;
      let state;
      try { state = window.ChessEngine.create(lesson.fen); } catch (e) { return; }
      if (!demoApi) { demoApi = window.makeBoard(demoHost,{onMove(){}}); demoApi.interactive=false; demoApi.canMove=()=>false; }
      demoApi.state = state; demoApi.selected=-1; demoApi.lastMove=null; demoApi.flipped=state.turn===window.ChessEngine.BLACK; demoApi.render();
      const move = pickDemoMove(state, DEMO_MOVES[lesson.id] || []);
      if (!move) return;
      timer = setTimeout(() => {
        demoApi.animateMove(move, () => {
          window.ChessEngine.make(state, move);
          demoApi.state = state; demoApi.lastMove = move; demoApi.render();
          timer = setTimeout(() => { if (card.classList.contains('open')) playDemo(); }, 1800);
        });
      }, 650);
    }

    button.addEventListener('click', () => {
      const open = !card.classList.contains('open');
      card.classList.toggle('open',open); button.setAttribute('aria-expanded',String(open)); body.classList.toggle('hidden',!open);
      if (open) playDemo(); else stopTimers();
    });
    return card;
  }

  function renderLessonsModern() {
    const host = $('lessonList');
    if (!host || !Array.isArray(window.CHESS_LESSONS)) return;
    host.className = 'lesson-list-modern';
    host.innerHTML = '';
    window.CHESS_LESSONS.forEach((lesson,index) => host.appendChild(makeLessonCard(lesson,index)));
  }

  function refreshPuzzleUI() {
    const list = window.CHESS_PUZZLES;
    if (!Array.isArray(list) || !list.length) return;
    const index = Math.max(0,Math.min(puzzleIndex,list.length-1));
    const current = list[index];
    const type = current.category || current.type || 'general';
    const labels = {
      mate1:tx('МАТ В 1 ХОД','MATE IN 1'),mate2:tx('МАТ В 2 ХОДА','MATE IN 2'),fork:tx('ВИЛКА','FORK'),pin:tx('СВЯЗКА','PIN'),skewer:tx('СКВОЗНОЙ УДАР','SKEWER'),discovered:tx('ВСКРЫТОЕ НАПАДЕНИЕ','DISCOVERED ATTACK'),defence:tx('ЗАЩИТА','DEFENCE'),endgame:tx('ЭНДШПИЛЬ','ENDGAME'),opening:tx('ДЕБЮТ','OPENING'),general:tx('ТАКТИКА','TACTIC')
    };
    if ($('pType')) $('pType').textContent = labels[type] || labels.general;
    if ($('pCount')) $('pCount').textContent = tx(`${index+1} из ${list.length}`,`${index+1} of ${list.length}`);
  }

  function patchPuzzleControls() {
    const next = $('pNext'), retry = $('pRetry');
    if (next && !next.__skyExperience) {
      const clone = next.cloneNode(true); next.replaceWith(clone); clone.__skyExperience=true;
      clone.addEventListener('click',()=>{ const list=window.CHESS_PUZZLES; if(!Array.isArray(list)||!list.length||typeof window.loadPuzzle!=='function')return; puzzleIndex=(puzzleIndex+1)%list.length; window.loadPuzzle(puzzleIndex); setTimeout(refreshPuzzleUI,0); });
    }
    if (retry && !retry.__skyExperience) {
      const clone = retry.cloneNode(true); retry.replaceWith(clone); clone.__skyExperience=true;
      clone.addEventListener('click',()=>{ if(typeof window.loadPuzzle!=='function')return; window.loadPuzzle(puzzleIndex); setTimeout(refreshPuzzleUI,0); });
    }
  }

  function restylePuzzlePanel() {
    const side = $('tab-puzzles')?.querySelector('.side');
    if (!side || side.querySelector('.puzzle-side-card')) return;
    const wrap = document.createElement('div'); wrap.className='puzzle-side-card';
    while(side.firstChild) wrap.appendChild(side.firstChild);
    side.appendChild(wrap);
    const actions = wrap.querySelector('.actions'); if(actions) actions.classList.add('puzzle-actions');
  }

  function repairCoachSide() {
    if (!window.ChessTeacherUI) return;
    try { window.ChessTeacherUI.refreshCurrentTeachers(); } catch(e) {}
  }

  function afterGameStarted() {
    resigned=false;
    const board=$('gBoard'); if(board) board.classList.remove('game-board-locked');
    syncGameMode(); updateSurrenderButton(); repairCoachSide();
  }

  function wrapOriginalNewGame() {
    const button = $('gNew');
    if (!button || button.__skyExperienceWrapped) return;
    button.style.display='none';
    button.__skyExperienceWrapped=true;
  }

  function init() {
    addStyles();
    installResignationHook();
    moveDifficultyPanel();
    renderGameMode();
    wrapOriginalNewGame();
    renderLessonsModern();
    cleanPuzzleSet();
    if (typeof window.loadPuzzle === 'function' && Array.isArray(window.CHESS_PUZZLES) && window.CHESS_PUZZLES.length) {
      puzzleIndex=Math.min(puzzleIndex,window.CHESS_PUZZLES.length-1);
      window.loadPuzzle(puzzleIndex);
    }
    restylePuzzlePanel();
    patchPuzzleControls();
    repairCoachSide();
    syncGameMode();
    patchStatusWatcher();
    updateSurrenderButton();
    refreshPuzzleUI();
  }

  window.addEventListener('chessTeacherChanged',()=>setTimeout(repairCoachSide,0));
  document.addEventListener('langchange',()=>setTimeout(()=>{ renderGameMode(); renderLessonsModern(); moveDifficultyPanel(); refreshPuzzleUI(); repairCoachSide(); },0));

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
