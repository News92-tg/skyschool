/* SkyySchool — подробный образовательный разбор хода.
   Только отображение. ChessReview.review/shortNote/explainWords не меняются. */
'use strict';

(function () {
  const E = window.ChessEngine;
  const $ = s => document.querySelector(s);

  const tx = (ru, en) =>
    window.Sky && Sky.lang === 'en' ? en : ru;

  const esc = value => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const GLYPH = {
    1: '♟', 2: '♞', 3: '♝',
    4: '♜', 5: '♛', 6: '♚'
  };

  function addStyles() {
    if (document.getElementById('chess-review-ui-styles')) return;

    const style = document.createElement('style');
    style.id = 'chess-review-ui-styles';
    style.textContent = `
      /* Основной контейнер */
      #gReview.review{
        margin-top:12px;
      }
      #gReview .rv-card{
        display:flex;
        flex-direction:column;
        gap:10px;
      }
      #gReview .rv-section{
        padding:11px 12px;
        border:1px solid var(--line);
        border-radius:var(--r);
        background:var(--panel);
      }
      #gReview .rv-section-title{
        margin-bottom:7px;
        font-size:10px;
        font-weight:900;
        line-height:1.2;
        letter-spacing:.08em;
        text-transform:uppercase;
        color:var(--muted);
      }

      /* Фраза тренера */
      #gReview .tui-inline{
        margin:0;
        padding:11px 12px;
        border-radius:var(--r);
      }
      #gReview .tui-line{
        margin-top:6px;
        font-size:12px;
        line-height:1.58;
      }

      /* Вердикт */
      #gReview .rv-verdict-head{
        display:flex;
        gap:10px;
        align-items:flex-start;
      }
      #gReview .rv-verdict-main{
        min-width:0;
        flex:1;
      }
      #gReview .rv-verdict-title{
        font-size:16px;
        font-weight:900;
        line-height:1.25;
      }
      #gReview .rv-icon{
        width:30px;
        height:30px;
        flex:0 0 30px;
        display:grid;
        place-items:center;
        border-radius:10px;
        font-size:16px;
        font-weight:900;
      }
      #gReview.q-brilliant .rv-icon{
        color:var(--m-chess);
        background:var(--m-chess-soft);
      }
      #gReview.q-good .rv-icon{
        color:var(--ok);
        background:var(--ok-soft);
      }
      #gReview.q-inaccuracy .rv-icon,
      #gReview.q-mistake .rv-icon{
        color:var(--warn);
        background:var(--warn-soft);
      }
      #gReview.q-blunder .rv-icon{
        color:var(--no);
        background:var(--no-soft);
      }
      #gReview .rv-note{
        margin-top:4px;
        color:var(--muted);
        font-size:11px;
        line-height:1.45;
      }

      /* Терминальный результат */
      #gReview .rv-terminal{
        display:flex;
        align-items:center;
        gap:8px;
        padding:10px 11px;
        border-radius:11px;
        background:var(--ok-soft);
        color:var(--ok);
        font-size:11.5px;
        font-weight:900;
      }

      /* Факты */
      #gReview .rv-facts-list{
        display:grid;
        margin:0;
      }
      #gReview .rv-fact{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        gap:10px;
        align-items:center;
        padding:7px 0;
        border-top:1px solid var(--line);
      }
      #gReview .rv-fact:first-child{
        border-top:0;
      }
      #gReview .rv-fact dt{
        color:var(--muted);
        font-size:10.5px;
      }
      #gReview .rv-fact dd{
        margin:0;
        text-align:right;
        font-size:10.5px;
        font-weight:900;
      }
      #gReview .rv-mono{
        font-family:'JetBrains Mono',ui-monospace,monospace;
        font-variant-numeric:tabular-nums;
      }

      /* Сравнение вариантов */
      #gReview .rv-compare{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(0,1fr);
        gap:8px;
      }
      #gReview .rv-compare-card{
        min-width:0;
        padding:8px;
        border:1px solid var(--line);
        border-radius:11px;
        background:var(--panel-2);
      }
      #gReview .rv-compare-label{
        margin-bottom:6px;
        font-size:10px;
        font-weight:900;
        line-height:1.25;
      }
      #gReview .rv-compare-move{
        margin-top:5px;
        font-family:'JetBrains Mono',ui-monospace,monospace;
        font-size:10px;
        font-weight:600;
        color:var(--muted);
      }
      #gReview .rv-mini-board{
        display:block;
        width:96px;
        height:96px;
        margin:0 auto;
        border:1px solid var(--line);
        border-radius:8px;
        overflow:hidden;
      }
      #gReview .rv-mini-board .light{fill:var(--board-light)}
      #gReview .rv-mini-board .dark{fill:var(--board-dark)}
      #gReview .rv-mini-board text{
        font-family:serif;
        font-size:10px;
        dominant-baseline:middle;
        paint-order:stroke;
        stroke-width:.45px;
      }
      #gReview .rv-mini-board .white{
        fill:var(--panel);
        stroke:var(--ink);
      }
      #gReview .rv-mini-board .black{
        fill:var(--ink);
        stroke:var(--panel);
      }
      #gReview .rv-mini-board .arrow{
        stroke:var(--m-chess);
        color:var(--m-chess);
      }
      #gReview .rv-compare-arrow{
        display:flex;
        align-items:center;
        justify-content:center;
        padding-top:26px;
        color:var(--m-chess);
        font-size:14px;
        font-weight:900;
      }

      /* Что делать дальше */
      #gReview .rv-next{
        background:var(--panel-2);
      }
      #gReview .rv-next-text{
        font-size:11px;
        line-height:1.55;
        color:var(--ink-2);
      }
      #gReview .rv-topic-btn{
        width:100%;
        margin-top:8px;
      }

      /* Тренер против движка */
      #gReview .rv-tabs{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:5px;
        margin-bottom:7px;
      }
      #gReview .rv-tab{
        padding:7px 8px;
        border:1px solid var(--line);
        border-radius:9px;
        background:var(--panel-2);
        color:var(--muted);
        font-size:10px;
        font-weight:900;
      }
      #gReview .rv-tab.active{
        border-color:var(--m-chess);
        background:var(--m-chess-soft);
        color:var(--m-chess);
      }
      #gReview .rv-pane{
        display:none;
        padding:9px 10px;
        border-left:3px solid var(--m-chess);
        border-radius:0 9px 9px 0;
        background:var(--panel-2);
        color:var(--ink-2);
        font-size:11px;
        line-height:1.55;
      }
      #gReview .rv-pane.active{display:block}

      /* Подпись движка */
      #gReview .rv-by{
        color:var(--faint);
        font-size:9px;
        line-height:1.3;
        font-weight:700;
      }

      @media(max-width:600px){
        #gReview .rv-section{padding:10px 11px}
        #gReview .rv-compare{grid-template-columns:1fr}
        #gReview .rv-compare-arrow{padding:0;transform:rotate(90deg);height:10px}
      }
    `;
    document.head.appendChild(style);
  }

  function renderMiniBoard(fen, arrow) {
    const st = E.create();
    E.loadFen(st, fen);

    let cells = '';
    for (let rank = 7; rank >= 0; rank--) {
      for (let file = 0; file < 8; file++) {
        const sq = E.sq(file, rank);
        const x = file * 12;
        const y = (7 - rank) * 12;
        const light = ((file + rank) % 2 === 0);

        cells += '<rect class="' + (light ? 'light' : 'dark') +
          '" x="' + x + '" y="' + y +
          '" width="12" height="12"/>';

        const p = st.board[sq];
        if (p) {
          cells += '<text class="' + ((p & 8) ? 'black' : 'white') +
            '" x="' + (x + 6) + '" y="' + (y + 6.3) +
            '" text-anchor="middle">' + GLYPH[p & 7] + '</text>';
        }
      }
    }

    let arrowSvg = '';
    if (arrow && Number.isInteger(arrow.from) && Number.isInteger(arrow.to)) {
      const fromFile = E.fileOf(arrow.from);
      const fromRank = E.rankOf(arrow.from);
      const toFile = E.fileOf(arrow.to);
      const toRank = E.rankOf(arrow.to);

      const x1 = fromFile * 12 + 6;
      const y1 = (7 - fromRank) * 12 + 6;
      const x2 = toFile * 12 + 6;
      const y2 = (7 - toRank) * 12 + 6;

      arrowSvg = `
        <defs>
          <marker id="rv-arrow-marker" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--m-chess)"></path>
          </marker>
        </defs>
        <line class="arrow" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
              stroke-width="1.6" stroke-linecap="round" marker-end="url(#rv-arrow-marker)"/>
      `;
    }

    return `<svg class="rv-mini-board" viewBox="0 0 96 96" aria-label="${tx('Мини-доска','Mini board')}">${cells}${arrowSvg}</svg>`;
  }

  function makePositionAfter(fen, notation) {
    try {
      const st = E.create();
      E.loadFen(st, fen);
      const move = E.findMove(st, notation);
      if (!move) return null;
      E.make(st, move);
      return { fen: E.fen(st), move };
    } catch (_) {
      return null;
    }
  }

  function qualityTitle(quality) {
    const map = {
      brilliant: ['Блестящий ход', 'Brilliant move'],
      good: ['Хороший ход', 'Good move'],
      inaccuracy: ['Неточность', 'Inaccuracy'],
      mistake: ['Ошибка', 'Mistake'],
      blunder: ['Грубая ошибка', 'Blunder']
    };
    const pair = map[quality] || ['Ход', 'Move'];
    return tx(pair[0], pair[1]);
  }

  function materialText(value) {
    const n = Number(value) || 0;
    if (Math.abs(n) < 0.005) return tx('равный', 'equal');
    const amount = Math.abs(n / 100).toFixed(1);
    if (n > 0) return '+' + amount + ' ' + tx('п.', 'p.');
    return '−' + amount + ' ' + tx('п.', 'p.');
  }

  function buildNextText(quality) {
    if (quality === 'blunder' || quality === 'mistake') {
      return tx(
        'Разбери этот ход дома. Найди момент, где решение пошло не туда, и проверь похожие позиции.',
        'Review this move later. Find the moment where the decision went wrong and practise similar positions.'
      );
    }
    if (quality === 'inaccuracy') {
      return tx(
        'Проверь все форсированные ходы соперника до конца: шахи, взятия и прямые угрозы.',
        'Check every forcing reply to the end: checks, captures and direct threats.'
      );
    }
    if (quality === 'good') {
      return tx(
        'Хорошо. Но перед окончательным решением всегда проверь: есть ли ещё сильнее?',
        'Good. Before committing, always check: is there an even stronger move?'
      );
    }
    return tx(
      'Отличная идея. Запомни этот ход — такие решения часто становятся ключом к победе.',
      'Excellent idea. Remember this move — ideas like this often decide the game.'
    );
  }

  function renderReview(r, words) {
    const box = $('#gReview');
    if (!box || !r) return;

    const mark = (ChessReview.MARKS && ChessReview.MARKS[r.quality]) || { icon:'•', cls:'q-good' };
    const note = ChessReview.shortNote(r, (window.Sky && Sky.lang) || 'ru');
    const title = qualityTitle(r.quality);

    const teacherHtml = window.ChessTeacherUI
      ? ChessTeacherUI.renderFor(r.quality)
      : '';

    const bestText = r.wasBest || !r.betterMove
      ? tx('тот же самый', 'same move')
      : r.betterMove;

    const lossPawns = (Number(r.loss) || 0) / 100;
    const lossText = Math.abs(lossPawns) < 0.05
      ? tx('позиция не изменилась', 'position unchanged')
      : `${lossPawns.toFixed(1)} ${tx('п.', 'p.')}`;

    const playedAfter = makePositionAfter(r.fen, r.move);
    const betterAfter = (!r.wasBest && r.betterMove)
      ? makePositionAfter(r.fen, r.betterMove)
      : null;

    let comparison = '';
    if (!r.wasBest && r.betterMove && playedAfter && betterAfter) {
      comparison = `
        <section class="rv-section">
          <div class="rv-section-title">${tx('Что было бы лучше', 'What would be better')}</div>
          <div class="rv-compare">
            <div class="rv-compare-card">
              <div class="rv-compare-label">${tx('Так сыграл ты', 'You played')}</div>
              ${renderMiniBoard(playedAfter.fen, {from: playedAfter.move.from, to: playedAfter.move.to})}
              <div class="rv-compare-move">${esc(r.move)}</div>
            </div>
            <div class="rv-compare-card">
              <div class="rv-compare-label">${tx('Так было бы лучше', 'Better move')}</div>
              ${renderMiniBoard(betterAfter.fen, {from: betterAfter.move.from, to: betterAfter.move.to})}
              <div class="rv-compare-move">${esc(r.betterMove)}</div>
            </div>
          </div>
        </section>
      `;
    }

    let terminal = '';
    if (r.terminal === 'checkmate') {
      terminal = `<div class="rv-terminal"><span>✓</span><span>${tx('Мат. Партия закончена.', 'Checkmate. The game is over.')}</span></div>`;
    }

    const nextText = buildNextText(r.quality);

    /* В игре с ботом категория задачи не известна — кнопку «5 задач на тему»
       не показываем, чтобы не отправлять ученика на случайную тему. */
    const topicButton = '';

    const teacherWords = words || tx(
      'Тренер формулирует разбор…',
      'The coach is preparing the explanation…'
    );

    const friendly = window.ChessTeacherUI &&
      ChessTeacherUI.getSelected &&
      ChessTeacherUI.getSelected() === 'coach-friend';

    const talk = friendly ? '' : `
      <section class="rv-section">
        <div class="rv-section-title">${tx('Тренер и движок', 'Coach and engine')}</div>
        <div class="rv-tabs">
          <button type="button" class="rv-tab active" data-rv-tab="teacher">${tx('Тренер говорит', 'Coach says')}</button>
          <button type="button" class="rv-tab" data-rv-tab="engine">${tx('Движок говорит', 'Engine says')}</button>
        </div>
        <div class="rv-pane active" data-rv-pane="teacher">${esc(teacherWords)}</div>
        <div class="rv-pane" data-rv-pane="engine">${esc(note)}</div>
      </section>
    `;

    box.className = 'review ' + (mark.cls || 'q-good');
    box.innerHTML = `
      <div class="rv-card">
        ${teacherHtml}

        <section class="rv-section">
          <div class="rv-verdict-head">
            <span class="rv-icon">${esc(mark.icon)}</span>
            <div class="rv-verdict-main">
              <div class="rv-verdict-title">${esc(r.move)} — ${esc(title)}</div>
              <div class="rv-note">${esc(note)}</div>
            </div>
          </div>
        </section>

        ${terminal}

        <section class="rv-section">
          <div class="rv-section-title">${tx('Что произошло', 'What happened')}</div>
          <dl class="rv-facts-list">
            <div class="rv-fact">
              <dt>${tx('Ход сыгран', 'Played move')}</dt>
              <dd class="rv-mono">${esc(r.move)}</dd>
            </div>
            <div class="rv-fact">
              <dt>${tx('Лучший ход', 'Best move')}</dt>
              <dd class="rv-mono">${esc(bestText)}</dd>
            </div>
            <div class="rv-fact">
              <dt>${tx('Разница в оценке', 'Evaluation difference')}</dt>
              <dd>${esc(lossText)}</dd>
            </div>
            <div class="rv-fact">
              <dt>${tx('Материал', 'Material')}</dt>
              <dd>${esc(materialText(r.material))}</dd>
            </div>
          </dl>
        </section>

        ${comparison}

        <section class="rv-section rv-next">
          <div class="rv-section-title">${tx('Что делать дальше', 'What to do next')}</div>
          <div class="rv-next-text">${esc(nextText)}</div>
          ${topicButton}
        </section>

        ${talk}
        <div class="rv-by">${esc(Sky.t('revEngine'))}</div>
      </div>
    `;

    box.querySelectorAll('[data-rv-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        const id = tab.dataset.rvTab;
        box.querySelectorAll('[data-rv-tab]').forEach(t => t.classList.toggle('active', t === tab));
        box.querySelectorAll('[data-rv-pane]').forEach(p => p.classList.toggle('active', p.dataset.rvPane === id));
      });
    });

    box.classList.remove('hidden');
  }

  function install() {
    addStyles();
    window.renderMiniBoard = renderMiniBoard;
    window.renderReview = renderReview;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
