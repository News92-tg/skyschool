/* SkyySchool — isolated FEN mini-board for lesson cards.
   Lessons use a static board and never reuse the interactive game board. */
'use strict';
(function(){
  const PIECES = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' };

  function renderMiniBoard(fen, size = 260){
    const board = document.createElement('div');
    board.className = 'mini-board';
    const px = Math.max(240, Math.min(280, Number(size) || 260));
    board.style.setProperty('--mini-board-size', px + 'px');

    const placement = String(fen || '').trim().split(/\s+/)[0] || '';
    const ranks = placement.split('/');
    const cells = [];

    for(let rank=0; rank<8; rank++){
      const row = ranks[rank] || '';
      let file=0;
      for(const ch of row){
        if(/[1-8]/.test(ch)){ file += Number(ch); continue; }
        if(file >= 8) break;
        const cell = document.createElement('div');
        const boardRank = 7-rank;
        cell.className = 'mini-sqr ' + (((file + boardRank) % 2) ? 'light' : 'dark');
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
      while(file<8){
        const cell=document.createElement('div');
        const boardRank=7-rank;
        cell.className='mini-sqr '+(((file+boardRank)%2)?'light':'dark');
        board.appendChild(cell);
        cells.push(cell);
        file++;
      }
    }

    while(cells.length<64){
      const i=cells.length, file=i%8, rank=7-Math.floor(i/8);
      const cell=document.createElement('div');
      cell.className='mini-sqr '+(((file+rank)%2)?'light':'dark');
      board.appendChild(cell);
      cells.push(cell);
    }
    return board;
  }

  window.renderMiniBoard = renderMiniBoard;

  function installStyles(){
    if(document.getElementById('mini-board-styles-v3')) return;
    const style=document.createElement('style');
    style.id='mini-board-styles-v3';
    style.textContent=`
      /* Lesson body: text first, mini-board second, never side-by-side. */
      #tab-lessons .lesson-modern-body{
        display:flex !important;
        flex-direction:column !important;
        align-items:stretch !important;
        gap:14px !important;
        width:100% !important;
        min-width:0 !important;
        padding:0 16px 16px !important;
      }
      #tab-lessons .lesson-modern .lesson-text{
        order:1 !important;
        width:100% !important;
        min-width:0 !important;
      }
      #tab-lessons .lesson-modern .lesson-demo{
        order:2 !important;
        width:100% !important;
        min-width:0 !important;
        display:flex !important;
        flex-direction:column !important;
        align-items:center !important;
        padding:10px !important;
        box-sizing:border-box !important;
      }
      #tab-lessons .lesson-modern .lesson-demo-title{
        width:100% !important;
        margin-bottom:8px !important;
        text-align:left !important;
      }
      #tab-lessons .lesson-modern .lesson-demo-board{
        width:100% !important;
        max-width:none !important;
        height:auto !important;
        min-height:0 !important;
        aspect-ratio:auto !important;
        display:flex !important;
        justify-content:center !important;
        align-items:center !important;
        margin:0 !important;
        overflow:visible !important;
      }

      /* Static board: exactly 64 cells, 8 columns × 8 rows. */
      #tab-lessons .mini-board{
        --mini-board-size:260px;
        display:grid !important;
        grid-template-columns:repeat(8,minmax(0,1fr)) !important;
        grid-template-rows:repeat(8,minmax(0,1fr)) !important;
        width:min(var(--mini-board-size),100%) !important;
        height:auto !important;
        aspect-ratio:1/1 !important;
        flex:0 0 auto !important;
        min-width:0 !important;
        min-height:0 !important;
        max-width:280px !important;
        margin:0 auto !important;
        padding:0 !important;
        border:1px solid var(--line-2) !important;
        border-radius:12px !important;
        overflow:hidden !important;
        box-shadow:var(--shadow-sm) !important;
        position:relative !important;
      }
      #tab-lessons .mini-board .mini-sqr{
        position:relative !important;
        min-width:0 !important;
        min-height:0 !important;
        width:auto !important;
        height:auto !important;
        aspect-ratio:auto !important;
        display:grid !important;
        place-items:center !important;
        margin:0 !important;
        padding:0 !important;
        border:0 !important;
      }
      #tab-lessons .mini-board .mini-sqr.light{background:var(--board-light) !important}
      #tab-lessons .mini-board .mini-sqr.dark{background:var(--board-dark) !important}
      #tab-lessons .mini-board .mini-piece{
        display:block !important;
        position:static !important;
        width:auto !important;
        height:auto !important;
        line-height:1 !important;
        font-family:"DejaVu Sans","Segoe UI Symbol",serif !important;
        font-size:min(28px,calc(var(--mini-board-size) / 8 * .78)) !important;
        font-weight:400 !important;
        transform:none !important;
        transition:none !important;
        animation:none !important;
        user-select:none !important;
      }
      #tab-lessons .mini-board .mini-piece.w{
        color:#fff !important;
        text-shadow:0 0 1px #10233c,0 0 2px rgba(0,0,0,.8),0 1px 1px rgba(0,0,0,.4) !important;
      }
      #tab-lessons .mini-board .mini-piece.b{
        color:#141820 !important;
        text-shadow:0 0 1px rgba(255,255,255,.35) !important;
      }
      @media(max-width:600px){
        #tab-lessons .lesson-modern-body{padding:0 12px 12px !important}
        #tab-lessons .lesson-modern .lesson-demo{padding:8px !important}
        #tab-lessons .mini-board{--mini-board-size:min(250px,100%);max-width:250px !important}
      }
    `;
    document.head.appendChild(style);
  }

  function patchLessons(){
    installStyles();
    const host=document.getElementById('lessonList');
    const lessons=window.CHESS_LESSONS;
    if(!host || !Array.isArray(lessons)) return;

    const cards=host.querySelectorAll(':scope > .lesson-modern');
    cards.forEach((card,index)=>{
      const lesson=lessons[index];
      if(!lesson || !lesson.fen) return;
      const demoHost=card.querySelector('.lesson-demo-board');
      if(!demoHost) return;
      demoHost.replaceChildren(renderMiniBoard(lesson.fen,260));
      card.dataset.miniBoardReady='1';
    });
  }

  const schedulePatch=()=>setTimeout(patchLessons,0);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedulePatch,{once:true});
  else schedulePatch();
  document.addEventListener('langchange',schedulePatch);
})();