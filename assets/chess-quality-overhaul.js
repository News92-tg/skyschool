/* SkyySchool — chess quality layer.
   One source of truth: ChessEngine. Lessons and game-over UI are built from it.
*/
'use strict';
(function () {
  const ready = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else setTimeout(fn, 0);
  };

  function patchEngine() {
    const E = window.ChessEngine;
    if (!E || E.__qualityPatched) return;
    const originalGenerate = E.generate;

    E.generate = function generatePatched(st, opts) {
      const moves = originalGenerate(st, opts);
      const b = st && st.board;
      if (!b) return moves;
      return moves.filter((m) => {
        /* В легальном шахматном ходе король не захватывается. */
        if (m.captured && (m.captured & 7) === E.KING) return false;

        /* Права FEN на рокировку не заменяют физическую ладью. */
        if (m.flags && (m.flags.includes('k') || m.flags.includes('q'))) {
          const us = st.turn;
          const homeRank = us === E.WHITE ? 0 : 7;
          const rookFile = m.flags.includes('k') ? 7 : 0;
          const rookSquare = E.sq(rookFile, homeRank);
          if (b[rookSquare] !== (E.ROOK | us)) return false;
        }
        return true;
      });
    };
    E.__qualityPatched = true;
  }

  const glyph = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const files = 'abcdefgh';
  const pieceName = {
    ru: { 1:'Пешка',2:'Конь',3:'Слон',4:'Ладья',5:'Ферзь',6:'Король' },
    en: { 1:'Pawn',2:'Knight',3:'Bishop',4:'Rook',5:'Queen',6:'King' }
  };

  function text(ru, en) { return window.Sky && Sky.lang === 'en' ? en : ru; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  }

  function styles() {
    if (document.getElementById('chess-quality-styles')) return;
    const s = document.createElement('style');
    s.id = 'chess-quality-styles';
    s.textContent = `
      #tab-lessons.chess-quality-lessons .lesson{overflow:hidden;margin-bottom:12px}
      #tab-lessons.chess-quality-lessons .lesson-q-head{display:flex;align-items:center;gap:10px;width:100%;padding:15px 16px;background:transparent;border:0;text-align:left;cursor:pointer}
      #tab-lessons.chess-quality-lessons .lesson-q-num{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:var(--m-chess-soft);color:var(--m-chess);font-weight:900;flex:0 0 auto}
      #tab-lessons.chess-quality-lessons .lesson-q-title{font-weight:900;font-size:14px;line-height:1.25}
      #tab-lessons.chess-quality-lessons .lesson-q-sub{display:block;color:var(--muted);font-size:10.5px;font-weight:700;margin-top:2px}
      #tab-lessons.chess-quality-lessons .lesson-q-arrow{margin-left:auto;color:var(--muted);transition:transform .18s;font-size:20px}
      #tab-lessons.chess-quality-lessons .lesson.open .lesson-q-arrow{transform:rotate(90deg);color:var(--m-chess)}
      #tab-lessons.chess-quality-lessons .lesson-q-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,360px);gap:18px;padding:0 16px 16px}
      #tab-lessons.chess-quality-lessons .lesson-q-copy{min-width:0;padding:4px 2px}
      #tab-lessons.chess-quality-lessons .lesson-q-goal{font-size:12px;font-weight:900;margin-bottom:10px}
      #tab-lessons.chess-quality-lessons .lesson-q-text{font-size:12.5px;line-height:1.7;color:var(--ink-2);white-space:pre-line}
      #tab-lessons.chess-quality-lessons .lesson-q-tip{margin-top:12px;padding:11px 12px;border-radius:12px;background:var(--m-chess-soft);font-size:11px;line-height:1.5}
      #tab-lessons.chess-quality-lessons .lesson-q-demo{border:1px solid var(--line);border-radius:15px;padding:11px;background:var(--panel-2);align-self:start}
      #tab-lessons.chess-quality-lessons .lesson-q-demo-title{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px}
      #tab-lessons.chess-quality-lessons .q-board{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid var(--line-2);box-shadow:var(--shadow-sm)}
      #tab-lessons.chess-quality-lessons .q-cell{position:relative;display:grid;place-items:center;min-width:0;min-height:0}
      #tab-lessons.chess-quality-lessons .q-cell.light{background:var(--board-light)}
      #tab-lessons.chess-quality-lessons .q-cell.dark{background:var(--board-dark)}
      #tab-lessons.chess-quality-lessons .q-cell.mark-from{box-shadow:inset 0 0 0 3px rgba(126,91,255,.45)}
      #tab-lessons.chess-quality-lessons .q-cell.mark-to{box-shadow:inset 0 0 0 3px rgba(126,91,255,.9)}
      #tab-lessons.chess-quality-lessons .q-piece{font:clamp(22px,5vw,34px)/1 "DejaVu Sans","Segoe UI Symbol",serif;user-select:none;pointer-events:none}
      #tab-lessons.chess-quality-lessons .q-piece.white{color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.72)}
      #tab-lessons.chess-quality-lessons .q-piece.black{color:#141820;text-shadow:0 1px 1px rgba(255,255,255,.35)}
      #tab-lessons.chess-quality-lessons .q-coord{position:absolute;font:700 7px/1 JetBrains Mono,monospace;color:rgba(0,0,0,.35);bottom:3px;right:3px;pointer-events:none}
      #tab-lessons.chess-quality-lessons .q-controls{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
      #tab-lessons.chess-quality-lessons .q-controls .btn{flex:1;min-width:106px}
      #tab-lessons.chess-quality-lessons .q-status{font-size:10.5px;font-weight:800;color:var(--muted);min-height:18px;margin-top:8px}
      #tab-lessons.chess-quality-lessons .q-seq{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
      #tab-lessons.chess-quality-lessons .q-move-chip{font:700 9px/1.1 JetBrains Mono,monospace;padding:5px 7px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
      #tab-game .chess-game-over{display:none;position:relative;margin-top:14px;padding:18px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(180deg,var(--panel-2),var(--panel));box-shadow:var(--shadow-sm)}
      #tab-game .chess-game-over.visible{display:block}
      #tab-game .game-over-grid{display:grid;grid-template-columns:58px minmax(0,1fr);gap:13px;align-items:center}
      #tab-game .game-over-mark{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:27px;font-weight:900;background:var(--m-chess-soft);color:var(--m-chess)}
      #tab-game .game-over-mark.win{color:#17834a}.game-over-mark.lose{color:#c53b4b}.game-over-mark.draw{color:var(--m-chess)}
      #tab-game .game-over-title{margin:0;font-size:20px;font-weight:900}
      #tab-game .game-over-sub{margin-top:4px;color:var(--muted);font-size:11.5px;line-height:1.5}
      #tab-game .game-over-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
      #tab-game .game-over-fact{padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--panel);text-align:center}
      #tab-game .game-over-fact b{display:block;font-size:17px}.game-over-fact span{display:block;font-size:9.5px;color:var(--muted);margin-top:2px}
      #tab-game .game-over-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      @media(max-width:820px){#tab-lessons.chess-quality-lessons .lesson-q-body{grid-template-columns:1fr}#tab-lessons.chess-quality-lessons .lesson-q-demo{max-width:440px}#tab-game .game-over-grid{grid-template-columns:1fr}#tab-game .game-over-mark{width:46px;height:46px}#tab-game .game-over-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(s);
  }

  function renderPosition(board, st, move) {
    board.innerHTML = '';
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const sq = window.ChessEngine.sq(file, rank);
        const cell = document.createElement('div');
        cell.className = 'q-cell ' + (((file + rank) & 1) ? 'light' : 'dark');
        if (move && sq === move.from) cell.classList.add('mark-from');
        if (move && sq === move.to) cell.classList.add('mark-to');
        const p = st.board[sq];
        if (p) {
          const span = document.createElement('span');
          span.className = 'q-piece ' + ((p & 8) ? 'black' : 'white');
          span.textContent = glyph[p & 7];
          cell.appendChild(span);
        }
        if (rank === 0) {
          const c = document.createElement('span');
          c.className = 'q-coord';
          c.textContent = files[file];
          cell.appendChild(c);
        }
        board.appendChild(cell);
      }
    }
  }

  function lessonPlayer(lesson, root) {
    const E = window.ChessEngine;
    const board = root.querySelector('.q-board');
    const status = root.querySelector('.q-status');
    const seq = root.querySelector('.q-seq');
    const playBtn = root.querySelector('[data-q-action="play"]');
    const stepBtn = root.querySelector('[data-q-action="step"]');
    const resetBtn = root.querySelector('[data-q-action="reset"]');

    let verifyState = E.create(lesson.fen || E.START_FEN);
    const moves = [];
    for (const notation of (lesson.moves || [])) {
      const m = E.findMove(verifyState, notation);
      if (!m) {
        moves.length = 0;
        break;
      }
      moves.push({
        from: m.from,
        to: m.to,
        promotion: m.promotion || 0,
        notation: E.toSAN(verifyState, m)
      });
      E.make(verifyState, m);
    }

    seq.innerHTML = moves.map((m, i) => `<span class="q-move-chip" data-move-index="${i}">${esc(m.notation)}</span>`).join('');

    let state = E.create(lesson.fen || E.START_FEN);
    let at = 0;
    let timer = null;
    let token = 0;

    function positionMoves() {
      return moves.map(m => {
        const uci = E.toAlg(m.from) + E.toAlg(m.to) + (m.promotion ? ({2:'n',3:'b',4:'r',5:'q'}[m.promotion] || 'q') : '');
        return uci;
      });
    }
    const validatedUci = positionMoves();

    function refresh(last) {
      renderPosition(board, state, last);
      seq.querySelectorAll('.q-move-chip').forEach(x => x.style.borderColor = 'var(--line)');
      const target = seq.querySelector(`[data-move-index="${Math.max(0, at - 1)}"]`);
      if (target) target.style.borderColor = 'var(--m-chess)';
      status.textContent = !moves.length
        ? text('Схема урока показана без автопоследовательности: движок не подтвердил заданные ходы.','Diagram only: the engine could not validate the supplied sequence.')
        : at >= moves.length
          ? text('Последовательность завершена.','Sequence complete.')
          : text(`Следующий ход: ${moves[at].notation}`, `Next move: ${moves[at].notation}`);
    }

    function reset() {
      token++;
      clearTimeout(timer);
      at = 0;
      state = E.create(lesson.fen || E.START_FEN);
      refresh(null);
    }

    function step() {
      if (!moves.length || at >= moves.length) return;
      const move = E.findMove(state, validatedUci[at]);
      if (!move) {
        status.textContent = text('Ход не прошёл повторную проверку движком.','The engine rejected the next lesson move.');
        return;
      }
      E.make(state, move);
      at++;
      refresh(move);
    }

    function play() {
      token++;
      const myToken = token;
      clearTimeout(timer);
      at = 0;
      state = E.create(lesson.fen || E.START_FEN);
      refresh(null);
      const loop = () => {
        if (myToken !== token || at >= moves.length) return;
        step();
        timer = setTimeout(loop, 550);
      };
      timer = setTimeout(loop, 220);
    }

    playBtn.addEventListener('click', play);
    stepBtn.addEventListener('click', step);
    resetBtn.addEventListener('click', reset);
    refresh(null);
  }

  function renderLessons() {
    const host = document.getElementById('lessonList');
    const lessons = window.CHESS_LESSONS;
    if (!host || !Array.isArray(lessons)) return;
    const tab = document.getElementById('tab-lessons');
    tab.classList.add('chess-quality-lessons');
    host.innerHTML = '';

    lessons.forEach((lesson, index) => {
      const card = document.createElement('article');
      card.className = 'lesson';
      const level = lesson.level || text('База','Basics');
      card.innerHTML = `
        <button type="button" class="lesson-q-head" aria-expanded="false">
          <span class="lesson-q-num">${index + 1}</span>
          <span><span class="lesson-q-title">${esc(window.Sky ? Sky.L(lesson.title) : lesson.title.ru)}</span><span class="lesson-q-sub">${esc(level)} · ${esc(window.Sky ? Sky.L(lesson.goal) : lesson.goal.ru)}</span></span>
          <span class="lesson-q-arrow">›</span>
        </button>
        <div class="lesson-q-body hidden">
          <div class="lesson-q-copy">
            <div class="lesson-q-goal">${esc(window.Sky ? Sky.L(lesson.goal) : lesson.goal.ru)}</div>
            <div class="lesson-q-text">${esc(window.Sky ? Sky.L(lesson.body) : lesson.body.ru)}</div>
            <div class="lesson-q-tip"><b>${text('Проверь себя','Check yourself')}:</b> ${esc(window.Sky ? Sky.L(lesson.tip) : lesson.tip.ru)}</div>
          </div>
          <div class="lesson-q-demo">
            <div class="lesson-q-demo-title">${text('Автодоска · ходы проверяет движок','Autoboard · moves verified by the engine')}</div>
            <div class="q-board"></div>
            <div class="q-status"></div>
            <div class="q-seq"></div>
            <div class="q-controls">
              <button type="button" class="btn chess small" data-q-action="play">▶ ${text('Сыграть урок','Play lesson')}</button>
              <button type="button" class="btn ghost small" data-q-action="step">→ ${text('Следующий ход','Next move')}</button>
              <button type="button" class="btn ghost small" data-q-action="reset">↺ ${text('Сбросить','Reset')}</button>
            </div>
          </div>
        </div>`;

      const body = card.querySelector('.lesson-q-body');
      card.querySelector('.lesson-q-head').addEventListener('click', () => {
        const open = card.classList.toggle('open');
        card.querySelector('.lesson-q-head').setAttribute('aria-expanded', String(open));
        body.classList.toggle('hidden', !open);
      });
      lessonPlayer(lesson, card);
      host.appendChild(card);
    });
  }

  function installGameOver() {
    const game = document.getElementById('tab-game');
    if (!game || game.__gameOverInstalled) return;
    const wrap = game.querySelector(':scope > .board-wrap');
    if (!wrap) return;

    game.__gameOverInstalled = true;
    const box = document.createElement('section');
    box.className = 'chess-game-over';
    box.id = 'chessGameOver';
    wrap.appendChild(box);

    function hide() {
      box.classList.remove('visible');
      box.innerHTML = '';
    }

    function show(status) {
      const gStateRef = typeof gState !== 'undefined' ? gState : null;
      const gHumanRef = typeof gHuman !== 'undefined' ? gHuman : window.ChessEngine.WHITE;
      const gSansRef = typeof gSans !== 'undefined' ? gSans : [];
      const gCapRef = typeof gCap !== 'undefined' ? gCap : { w:[], b:[] };
      if (!gStateRef) return;

      const win = status === 'checkmate' && gStateRef.turn !== gHumanRef;
      const lose = status === 'checkmate' && gStateRef.turn === gHumanRef;
      const kind = win ? 'win' : lose ? 'lose' : 'draw';
      const title = win ? text('Победа','You win') : lose ? text('Поражение','You lose') : text('Ничья','Draw');
      const why = status === 'checkmate'
        ? (win ? text('Мат сопернику. Последний ход завершил партию.','Checkmate. Your final move ended the game.') : text('Мат вашему королю. Посмотрите на последние ходы и попробуйте ещё раз.','Your king was checkmated. Review the final moves and try again.'))
        : status === 'stalemate' ? text('Пат: ходов нет, но король не под шахом.','Stalemate: no legal moves, but the king is not in check.')
        : status === 'material' ? text('Ничья: материала недостаточно для мата.','Draw: there is not enough material to checkmate.')
        : text('Ничья по правилу 50 ходов.','Draw by the fifty-move rule.');

      const moves = Math.ceil(gSansRef.length / 2);
      const taken = gCapRef[gHumanRef === window.ChessEngine.WHITE ? 'b' : 'w'].length;
      const lost = gCapRef[gHumanRef === window.ChessEngine.WHITE ? 'w' : 'b'].length;

      box.innerHTML = `
        <div class="game-over-grid">
          <div class="game-over-mark ${kind}">${win ? '✓' : lose ? '✕' : '='}</div>
          <div><h3 class="game-over-title">${esc(title)}</h3><div class="game-over-sub">${esc(why)}</div></div>
        </div>
        <div class="game-over-facts">
          <div class="game-over-fact"><b>${moves}</b><span>${text('ходов','moves')}</span></div>
          <div class="game-over-fact"><b>${taken}</b><span>${text('забрали','captured')}</span></div>
          <div class="game-over-fact"><b>${lost}</b><span>${text('потеряли','lost')}</span></div>
        </div>
        <div class="game-over-actions">
          <button type="button" class="btn chess big" data-game-over="new">${text('Новая партия','New game')}</button>
          <button type="button" class="btn ghost" data-game-over="review">${text('Оставить позицию','Keep position')}</button>
        </div>`;

      box.classList.add('visible');
      box.querySelector('[data-game-over="new"]').addEventListener('click', () => {
        hide();
        if (typeof window.newGame === 'function') window.newGame();
      });
      box.querySelector('[data-game-over="review"]').addEventListener('click', hide);
      box.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }

    window.ChessQualityGameOver = { show, hide };

    const originalNewGame = window.newGame;
    if (typeof originalNewGame === 'function') {
      window.newGame = function () {
        hide();
        return originalNewGame.apply(this, arguments);
      };
    }

    const originalFinish = window.finishGame;
    window.finishGame = function (status) {
      hide();
      if (window.ChessQualityGameOver) window.ChessQualityGameOver.show(status);
      /* Старое модальное окно намеренно больше не вызываем. */
      void originalFinish;
    };
  }

  function updateEngineBackedGameStatus() {
    const current = typeof gState !== 'undefined' ? gState : null;
    if (!current || !window.ChessEngine) return;
    const st = window.ChessEngine.status(current);
    const over = ['checkmate','stalemate','material','fifty'].includes(st);
    const panel = document.getElementById('chessGameOver');
    if (over && panel && !panel.classList.contains('visible') && typeof window.ChessQualityGameOver?.show === 'function') {
      window.ChessQualityGameOver.show(st);
    }
  }

  ready(() => {
    patchEngine();
    styles();
    renderLessons();
    installGameOver();
    if (!document.__skyChessQualityLangHook) {
      document.__skyChessQualityLangHook = true;
      document.addEventListener('langchange', () => {
        renderLessons();
        installGameOver();
      });
    }
    window.__skyChessQuality = { patchEngine, renderLessons, installGameOver, updateEngineBackedGameStatus };
  });
})();
