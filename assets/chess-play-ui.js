/* ============================================================
   Партия против бота: подсказки по клеткам и нижняя панель.

   1. Подсказка по фигуре/клетке — в блоке #gHint под доской.
        компьютер (мышь): наведение показывает, уход с доски прячет;
        телефон/планшет (касание): тап показывает, второй тап по той же
        клетке прячет (и снимает выделение фигуры).
      Что пишем: какая фигура, куда она может пойти, под ударом ли она
      и защищена ли; про фигуру соперника — чем её можно взять; про
      пустое поле — кто может туда пойти.

   2. Кнопка «Подсказка» в нижней панели — лучший ход от бота. Считает
      тот же фоновый поток (ChessAIAsync), поля хода подсвечиваются на
      доске. Повторное нажатие прячет подсказку; после любого хода она
      исчезает сама.

   3. Нижняя панель #gDock: «Новая партия», «Отменить ход»,
      «Подсказка» в одну строку, прилипает к низу экрана. Видна только
      вместе с доской.

   Сама партия живёт во встроенном скрипте chess.html и отдаётся
   сюда через window.SkyChessGame.
   ============================================================ */
'use strict';
(function () {
  const E = window.ChessEngine;
  const G = window.SkyChessGame;
  if (!E || !G) return;

  const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const HINT_LEVEL = 3;   /* без случайных ходов, как у разбора */
  const $ = (id) => document.getElementById(id);
  const tx = (ru, en) => (window.Sky && Sky.lang === 'en' ? en : ru);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const GLYPH = { 1:'♟', 2:'♞', 3:'♝', 4:'♜', 5:'♛', 6:'♚' };
  const NAMES = {
    1: ['Пешка', 'Pawn'], 2: ['Конь', 'Knight'], 3: ['Слон', 'Bishop'],
    4: ['Ладья', 'Rook'], 5: ['Ферзь', 'Queen'], 6: ['Король', 'King']
  };
  const pieceName = (p) => { const n = NAMES[p & 7]; return n ? tx(n[0], n[1]) : ''; };

  const board = G.board;
  const boardEl = $('gBoard');
  const hintEl = $('gHint');
  const dock = $('gDock');
  const hintBtn = $('gDockHint');
  if (!board || !boardEl || !hintEl) return;

  /* что сейчас показано: подсказка по клетке или лучший ход */
  let peekSq = -1;
  let best = null;          /* { fen, move, san } */
  let bestWaiting = null;   /* fen, для которого считается */
  let movedThisClick = false;

  /* ---------- текст подсказки по клетке ---------- */

  function listSan(st, moves) {
    const seen = new Set(), out = [];
    for (const m of moves) {
      let san;
      try { san = E.toSAN(st, m); } catch (e) { san = E.toAlg(m.from) + E.toAlg(m.to); }
      if (!seen.has(san)) { seen.add(san); out.push(san); }
    }
    return out;
  }

  function describe(sq) {
    const st = G.state;
    if (!st) return '';
    const human = G.human, bot = human ^ 8;
    const myTurn = st.turn === human && !G.busy && !G.over;
    const p = st.board[sq];
    const where = E.toAlg(sq);
    const lines = [];

    if (p && (p & 8) === human) {
      lines.push('<b>' + GLYPH[p & 7] + ' ' + esc(pieceName(p)) + ' · ' + where + '</b>');
      if (myTurn) {
        const moves = E.generate(st, { square: sq });
        lines.push(moves.length
          ? tx('Может пойти: ', 'Can go to: ') + esc(listSan(st, moves).join(', '))
          : tx('Ходов нет: фигура заперта или связана.', 'No moves: the piece is blocked or pinned.'));
      }
      if ((p & 7) !== E.KING && E.attacked(st, sq, bot)) {
        lines.push(E.attacked(st, sq, human)
          ? '⚠ ' + tx('Под ударом, но защищена.', 'Attacked, but defended.')
          : '⚠ ' + tx('Под ударом и не защищена!', 'Attacked and undefended!'));
      }
      if ((p & 7) === E.KING && E.inCheck(st, human)) lines.push('⚠ ' + tx('Шах! Спасайте короля.', 'Check! Save the king.'));
    } else if (p) {
      lines.push('<b>' + GLYPH[p & 7] + ' ' + esc(pieceName(p)) + ' ' + tx('соперника', '(opponent)') + ' · ' + where + '</b>');
      if (myTurn) {
        const takes = E.generate(st).filter(m => m.to === sq);
        lines.push(takes.length
          ? tx('Можно взять: ', 'You can take it: ') + esc(listSan(st, takes).join(', '))
          : tx('Сейчас её не взять.', 'You cannot take it right now.'));
      }
      if ((p & 7) !== E.KING && E.attacked(st, sq, human) && !E.attacked(st, sq, bot)) {
        lines.push('💡 ' + tx('Не защищена.', 'Undefended.'));
      }
    } else {
      lines.push('<b>' + tx('Поле ', 'Square ') + where + '</b>');
      if (myTurn) {
        const here = E.generate(st).filter(m => m.to === sq);
        lines.push(here.length
          ? tx('Сюда можно пойти: ', 'You can move here: ') + esc(listSan(st, here).join(', '))
          : tx('Сюда сейчас не пойти.', 'Nothing can move here right now.'));
      }
      const mine = E.attacked(st, sq, human), theirs = E.attacked(st, sq, bot);
      if (theirs) lines.push(mine ? tx('Поле бьют обе стороны.', 'Both sides attack this square.') : '⚠ ' + tx('Поле бьёт соперник.', 'The opponent attacks this square.'));
    }
    if (!myTurn && !G.over && st.turn !== human) lines.push(tx('Сейчас ходит бот.', 'The bot is moving now.'));
    return lines.join('<br>');
  }

  /* ---------- блок под доской ---------- */

  function placeholder() {
    return TOUCH
      ? tx('Коснитесь фигуры или клетки — покажу подсказку. Второе касание спрячет её.', 'Tap a piece or square for a hint. Tap again to hide it.')
      : tx('Наведите курсор на фигуру или клетку — покажу подсказку.', 'Hover over a piece or square for a hint.');
  }

  function paint() {
    let html = '', on = false;
    if (peekSq >= 0) {
      html = describe(peekSq);
      on = true;
    } else if (best) {
      html = '<b>💡 ' + tx('Идея: ', 'Idea: ') + esc(best.san) + '</b> ' + E.toAlg(best.move.from) + ' → ' + E.toAlg(best.move.to);
      on = true;
    } else if (bestWaiting) {
      html = '<span class="spin"></span> ' + tx('Ищу хороший ход…', 'Looking for a good move…');
      on = true;
    }
    hintEl.classList.toggle('on', on);
    hintEl.innerHTML = on ? html : '<span class="g-hint-empty">' + esc(placeholder()) + '</span>';
    if (hintBtn) hintBtn.setAttribute('aria-pressed', String(!!(best || bestWaiting)));
    mark();
  }

  /* Подсветка на доске. Доска перерисовывается целиком при каждом
     выборе фигуры, поэтому классы ставим после каждой отрисовки. */
  function mark() {
    boardEl.querySelectorAll('.g-peek,.g-hint-from,.g-hint-to').forEach(n => n.classList.remove('g-peek', 'g-hint-from', 'g-hint-to'));
    if (peekSq >= 0 && TOUCH) {
      const c = boardEl.querySelector('[data-sq="' + peekSq + '"]');
      if (c) c.classList.add('g-peek');
    }
    if (best) {
      const a = boardEl.querySelector('[data-sq="' + best.move.from + '"]');
      const b = boardEl.querySelector('[data-sq="' + best.move.to + '"]');
      if (a) a.classList.add('g-hint-from');
      if (b) b.classList.add('g-hint-to');
    }
  }

  function currentFen() { return G.state ? E.fen(G.state) : ''; }

  /* Позиция поменялась (ход, отмена, новая партия) — старая подсказка
     больше не про эту доску. */
  function syncWithPosition() {
    const fen = currentFen();
    let changed = false;
    if (best && best.fen !== fen) { best = null; changed = true; }
    if (bestWaiting && bestWaiting !== fen) { bestWaiting = null; changed = true; }
    return changed;
  }

  const baseRender = board.render;
  board.render = function () {
    const r = baseRender.apply(this, arguments);
    syncWithPosition();
    paint();
    return r;
  };

  /* ход ученика: и подсказка по клетке, и «Идея» больше не про эту доску */
  const baseOnMove = board.onMove;
  board.onMove = function () {
    movedThisClick = true;
    peekSq = -1; best = null; bestWaiting = null;
    paint();
    return baseOnMove.apply(this, arguments);
  };

  function showPeek(sq) { peekSq = sq; paint(); }
  function hidePeek() { if (peekSq < 0) return; peekSq = -1; paint(); }

  if (TOUCH) {
    /* обработчик доски (выбор фигуры, ход) уже отработал — он
       подключён раньше, во встроенном скрипте страницы */
    boardEl.addEventListener('click', (e) => {
      if (movedThisClick) { movedThisClick = false; hidePeek(); return; }
      const cell = e.target.closest('.sqr');
      if (!cell) return;
      const sq = +cell.dataset.sq;
      if (sq === peekSq) {
        peekSq = -1;
        if (board.selected === sq) board.selected = -1;
        board.render();
        return;
      }
      showPeek(sq);
    });
  } else {
    boardEl.addEventListener('mouseover', (e) => {
      const cell = e.target.closest('.sqr');
      if (!cell) return;
      const sq = +cell.dataset.sq;
      if (sq !== peekSq) showPeek(sq);
    });
    boardEl.addEventListener('mouseleave', hidePeek);
    boardEl.addEventListener('click', () => { movedThisClick = false; });
  }

  /* ---------- лучший ход ---------- */

  function toggleBest() {
    if (best || bestWaiting) { best = null; bestWaiting = null; paint(); return; }
    const st = G.state;
    if (!st || G.over) return;
    if (st.turn !== G.human || G.busy) {
      peekSq = -1;
      hintEl.classList.add('on');
      hintEl.innerHTML = '<b>' + esc(tx('Подождите ход бота.', 'Wait for the bot to move.')) + '</b>';
      return;
    }
    peekSq = -1;
    const fen = E.fen(st);
    bestWaiting = fen;
    paint();
    const job = window.ChessAIAsync
      ? ChessAIAsync.bestMove(st, HINT_LEVEL)
      : Promise.resolve(window.ChessAI ? ChessAI.bestMove(E.create(fen), HINT_LEVEL) : null);
    job.then((res) => {
      if (bestWaiting !== fen || currentFen() !== fen) return;
      bestWaiting = null;
      if (res && res.move) {
        let san;
        try { san = E.toSAN(G.state, res.move); } catch (e) { san = E.toAlg(res.move.from) + E.toAlg(res.move.to); }
        best = { fen, move: res.move, san };
      }
      paint();
    });
  }

  /* ---------- нижняя панель ---------- */

  function newGame() {
    const start = () => {
      best = null; bestWaiting = null; peekSq = -1;
      boardEl.classList.remove('game-board-locked');
      if (typeof window.newGame === 'function') window.newGame();
      else { const b = $('gNew'); if (b) b.click(); }
    };
    /* партия идёт — случайное касание не должно её стереть */
    if (G.moves > 0 && !G.over && window.Sky && Sky.modal) {
      Sky.modal(
        '<h2>' + esc(tx('Начать новую партию?', 'Start a new game?')) + '</h2>' +
        '<p class="lead" style="font-size:13.5px;margin-top:6px">' + esc(tx('Текущая партия закончится без результата.', 'The current game will end without a result.')) + '</p>' +
        '<button class="btn chess full big" id="gDockNewYes" style="margin-top:16px">' + esc(tx('Новая партия', 'New game')) + '</button>' +
        '<button class="btn ghost full" id="gDockNewNo" style="margin-top:9px">' + esc(tx('Продолжить эту', 'Keep playing')) + '</button>',
        (box, close) => {
          box.querySelector('#gDockNewYes').addEventListener('click', () => { close(); start(); });
          box.querySelector('#gDockNewNo').addEventListener('click', close);
        });
      return;
    }
    start();
  }

  if (dock) {
    $('gDockNew').addEventListener('click', newGame);
    $('gDockUndo').addEventListener('click', () => { const b = $('gUndo'); if (b) b.click(); });
    if (hintBtn) hintBtn.addEventListener('click', toggleBest);

    /* Панель видна, только когда видна доска: пошаговый запуск партии
       (chess-game-flow.js) прячет доску до «Начать партию». */
    const wrap = boardEl.closest('.board-wrap');
    const syncDock = () => { dock.hidden = !wrap || getComputedStyle(wrap).display === 'none'; };
    if (wrap) new MutationObserver(syncDock).observe(wrap, { attributes: true, attributeFilter: ['style', 'class'] });
    const tab = $('tab-game');
    if (tab) new MutationObserver(syncDock).observe(tab, { attributes: true, attributeFilter: ['class'] });
    syncDock();
  }

  document.addEventListener('langchange', () => setTimeout(paint, 0));
  paint();

  window.SkyChessPlayUI = { describe, toggleBest, isTouch: TOUCH };
})();
