/* SkyySchool — isolated FEN mini-board for lesson cards.
   This renderer is deliberately independent from the interactive game board.
   It always produces exactly 64 cells and repairs itself after lesson rerenders. */
'use strict';
(function(){
  const PIECES = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' };
  const $ = (s, root=document) => root.querySelector(s);

  function renderMiniBoard(fen, size = 260){
    const board = document.createElement('div');
    board.className = 'mini-board';
    const px = Math.max(240, Math.min(280, Number(size) || 260));
    board.style.setProperty('--mini-size', px + 'px');

    const placement = String(fen || '').trim().split(/\s+/)[0] || '';
    const ranks = placement.split('/');

    for(let row=0; row<8; row++){
      const rank = ranks[row] || '';
      let file=0;
      for(const ch of rank){
        if(/[1-8]/.test(ch)){
          file += Number(ch);
          continue;
        }
        if(file>=8) break;

        const cell = document.createElement('div');
        const boardRank = 7-row;
        cell.className = 'mini-cell ' + (((file + boardRank) & 1) ? 'light' : 'dark');

        const glyph = PIECES[ch.toLowerCase()];
        if(glyph){
          const piece=document.createElement('span');
          piece.className='mini-piece ' + (ch===ch.toUpperCase() ? 'white' : 'black');
          piece.textContent=glyph;
          cell.appendChild(piece);
        }
        board.appendChild(cell);
        file++;
      }
      while(file<8){
        const cell=document.createElement('div');
        const boardRank=7-row;
        cell.className='mini-cell ' + (((file + boardRank) & 1) ? 'light' : 'dark');
        board.appendChild(cell);
        file++;
      }
    }

    while(board.children.length<64){
      const i=board.children.length;
      const file=i%8;
      const rank=7-Math.floor(i/8);
      const cell=document.createElement('div');
      cell.className='mini-cell ' + (((file + rank) & 1) ? 'light' : 'dark');
      board.appendChild(cell);
    }
    return board;
  }

  window.renderMiniBoard=renderMiniBoard;

  function installStyles(){
    if($('mini-board-styles-v4')) return;
    const style=document.createElement('style');
    style.id='mini-board-styles-v4';
    style.textContent=`
      /* Lesson = one vertical flow: text first, board second. */
      #tab-lessons .lesson-modern-body{
        display:flex !important;
        flex-direction:column !important;
        align-items:stretch !important;
        gap:16px !important;
        width:100% !important;
        min-width:0 !important;
        padding:0 16px 16px !important;
        box-sizing:border-box !important;
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
        box-sizing:border-box !important;
        padding:10px !important;
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
        padding:0 !important;
        overflow:visible !important;
      }

      /* Isolated 8×8 board. No .board/.sqr rules can stretch these cells. */
      #tab-lessons .mini-board{
        --mini-size:260px;
        display:grid !important;
        grid-template-columns:repeat(8,minmax(0,1fr)) !important;
        grid-template-rows:repeat(8,minmax(0,1fr)) !important;
        width:min(var(--mini-size),100%) !important;
        height:min(var(--mini-size),100%) !important;
        aspect-ratio:1/1 !important;
        flex:0 0 auto !important;
        min-width:0 !important;
        min-height:0 !important;
        max-width:280px !important;
        max-height:280px !important;
        margin:0 auto !important;
        padding:0 !important;
        box-sizing:border-box !important;
        border:1px solid var(--line-2) !important;
        border-radius:12px !important;
        overflow:hidden !important;
        position:relative !important;
        box-shadow:var(--shadow-sm) !important;
      }
      #tab-lessons .mini-board .mini-cell{
        display:grid !important;
        place-items:center !important;
        width:100% !important;
        height:100% !important;
        min-width:0 !important;
        min-height:0 !important;
        margin:0 !important;
        padding:0 !important;
        border:0 !important;
        box-sizing:border-box !important;
      }
      #tab-lessons .mini-board .mini-cell.light{background:var(--board-light) !important}
      #tab-lessons .mini-board .mini-cell.dark{background:var(--board-dark) !important}
      #tab-lessons .mini-board .mini-piece{
        display:block !important;
        position:static !important;
        width:auto !important;
        height:auto !important;
        margin:0 !important;
        padding:0 !important;
        line-height:1 !important;
        font-family:"DejaVu Sans","Segoe UI Symbol",serif !important;
        font-size:28px !important;
        font-weight:400 !important;
        transform:none !important;
        transition:none !important;
        animation:none !important;
        user-select:none !important;
        pointer-events:none !important;
      }
      #tab-lessons .mini-board .mini-piece.white{
        color:#fff !important;
        text-shadow:0 1px 1px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.45) !important;
      }
      #tab-lessons .mini-board .mini-piece.black{
        color:#141820 !important;
        text-shadow:0 1px 1px rgba(255,255,255,.35) !important;
      }
      @media(max-width:600px){
        #tab-lessons .lesson-modern-body{padding:0 12px 12px !important}
        #tab-lessons .lesson-modern .lesson-demo{padding:8px !important}
        #tab-lessons .mini-board{
          --mini-size:min(250px,100%);
          max-width:250px !important;
          max-height:250px !important;
        }
        #tab-lessons .mini-board .mini-piece{font-size:25px !important}
      }
    `;
    document.head.appendChild(style);
  }

  function patchLessons(){
    installStyles();
    const host=document.getElementById('lessonList');
    const lessons=window.CHESS_LESSONS;
    if(!host || !Array.isArray(lessons)) return;

    host.querySelectorAll(':scope > .lesson-modern').forEach((card,index)=>{
      const lesson=lessons[index];
      const demoHost=card.querySelector('.lesson-demo-board');
      if(!lesson || !lesson.fen || !demoHost) return;
      demoHost.replaceChildren(renderMiniBoard(lesson.fen,260));
      card.dataset.miniBoardReady='1';
    });
  }

  function installObserver(){
    const host=document.getElementById('lessonList');
    if(!host || host.__miniBoardObserver) return;
    const observer=new MutationObserver(()=>{
      clearTimeout(host.__miniBoardTimer);
      host.__miniBoardTimer=setTimeout(patchLessons,0);
    });
    observer.observe(host,{childList:true,subtree:true});
    host.__miniBoardObserver=observer;
  }

  function init(){
    installStyles();
    patchLessons();
    installObserver();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
  document.addEventListener('langchange',()=>setTimeout(patchLessons,0));
})();