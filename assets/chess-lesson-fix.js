/* SkyySchool — isolated mini-board renderer for lesson cards.
   Lessons are static illustrations: no clicks, no drag, no animation.
   Kept outside the main game board styles so lesson boards cannot inherit
   interactive-board geometry. */
'use strict';
(function(){
  const PIECES = {
    p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚'
  };

  function renderMiniBoard(fen, size = 280){
    const board = document.createElement('div');
    board.className = 'mini-board';

    const px = Math.max(1, Math.min(280, Number(size) || 280));
    board.style.setProperty('--mini-board-size', px + 'px');

    const placement = String(fen || '').trim().split(/\s+/)[0] || '';
    const ranks = placement.split('/');
    const cells = [];

    for(let rank = 0; rank < 8; rank++){
      const row = ranks[rank] || '';
      let file = 0;

      for(const ch of row){
        if(/[1-8]/.test(ch)){
          file += Number(ch);
          continue;
        }

        if(file >= 8) break;

        const cell = document.createElement('div');
        const light = (file + (7 - rank)) % 2 === 1;
        cell.className = 'mini-sqr ' + (light ? 'light' : 'dark');

        const glyph = PIECES[ch.toLowerCase()];
        if(glyph){
          const piece = document.createElement('span');
          piece.className = 'mini-piece ' + (ch === ch.toUpperCase() ? 'w' : 'b');
          piece.textContent = glyph;
          cell.appendChild(piece);
        }

        board.appendChild(cell);
        cells.push(cell);
        file++;
      }

      while(file < 8){
        const cell = document.createElement('div');
        const light = (file + (7 - rank)) % 2 === 1;
        cell.className = 'mini-sqr ' + (light ? 'light' : 'dark');
        board.appendChild(cell);
        cells.push(cell);
        file++;
      }
    }

    /* Malformed placement strings still produce a predictable 8×8 grid. */
    while(cells.length < 64){
      const i = cells.length;
      const file = i % 8;
      const rank = 7 - Math.floor(i / 8);
      const cell = document.createElement('div');
      cell.className = 'mini-sqr ' + (((file + rank) % 2) ? 'light' : 'dark');
      board.appendChild(cell);
      cells.push(cell);
    }

    return board;
  }

  window.renderMiniBoard = renderMiniBoard;

  function installStyles(){
    if(document.getElementById('mini-board-styles')) return;

    const style = document.createElement('style');
    style.id = 'mini-board-styles';
    style.textContent = `
      /* Static lesson board — deliberately independent from .board. */
      #lessonList .mini-board{
        --mini-board-size:280px;
        display:grid !important;
        grid-template-columns:repeat(8,minmax(0,1fr)) !important;
        grid-template-rows:repeat(8,minmax(0,1fr)) !important;
        width:min(var(--mini-board-size),100%) !important;
        height:auto !important;
        aspect-ratio:1 / 1 !important;
        flex:0 0 auto !important;
        min-width:0 !important;
        min-height:0 !important;
        margin:16px auto 0 !important;
        padding:0 !important;
        border:1px solid var(--line-2) !important;
        border-radius:var(--r) !important;
        overflow:hidden !important;
        box-shadow:none !important;
        pointer-events:none !important;
        position:relative !important;
      }

      #lessonList .mini-sqr{
        position:relative !important;
        min-width:0 !important;
        min-height:0 !important;
        width:auto !important;
        height:auto !important;
        aspect-ratio:auto !important;
        display:grid !important;
        place-items:center !important;
        padding:0 !important;
        margin:0 !important;
        border:0 !important;
      }
      #lessonList .mini-sqr.light{background:var(--board-light) !important}
      #lessonList .mini-sqr.dark{background:var(--board-dark) !important}

      #lessonList .mini-piece{
        display:block !important;
        position:static !important;
        width:auto !important;
        height:auto !important;
        line-height:1 !important;
        font-family:"DejaVu Sans","Segoe UI Symbol",serif !important;
        font-size:calc(var(--mini-board-size) / 8 * .72) !important;
        font-weight:400 !important;
        transform:none !important;
        transition:none !important;
        animation:none !important;
        user-select:none !important;
      }
      #lessonList .mini-piece.w{
        color:#fff !important;
        text-shadow:0 0 1px #10233c,0 0 2px rgba(0,0,0,.8),0 1px 1px rgba(0,0,0,.4) !important;
      }
      #lessonList .mini-piece.b{
        color:#141820 !important;
        text-shadow:0 0 1px rgba(255,255,255,.35) !important;
      }

      #lessonList .lesson > .body.lesson-body-static{
        display:flex !important;
        flex-direction:column !important;
        align-items:stretch !important;
        width:100% !important;
        min-width:0 !important;
        padding:0 19px 19px !important;
      }
      #lessonList .lesson > .body.lesson-body-static .lesson-copy{
        width:100% !important;
        min-width:0 !important;
        white-space:pre-wrap !important;
      }

      @media(max-width:600px){
        #lessonList .mini-board{
          --mini-board-size:min(280px,100%) !important;
        }
        #lessonList .lesson > .body.lesson-body-static{
          padding:0 15px 15px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function patchLessons(){
    installStyles();
    const host = document.getElementById('lessonList');
    const lessons = window.CHESS_LESSONS;
    if(!host || !Array.isArray(lessons) || !window.renderMiniBoard) return;

    const cards = host.querySelectorAll(':scope > .lesson');
    cards.forEach((card, index) => {
      const lesson = lessons[index];
      if(!lesson || !lesson.fen || card.dataset.miniBoardReady === '1') return;

      const body = card.querySelector(':scope > .body');
      if(!body) return;

      const oldBoard = body.querySelector(':scope > .board');
      const copy = document.createElement('div');
      copy.className = 'lesson-copy';

      for(const node of Array.from(body.childNodes)){
        if(node === oldBoard) continue;
        copy.appendChild(node.cloneNode(true));
      }

      const mini = renderMiniBoard(lesson.fen, 280);
      body.replaceChildren(copy, mini);
      body.classList.add('lesson-body-static');
      card.dataset.miniBoardReady = '1';
    });
  }

  function schedulePatch(){ setTimeout(patchLessons, 0); }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', schedulePatch, { once:true });
  }else{
    schedulePatch();
  }

  document.addEventListener('langchange', schedulePatch);
})();
