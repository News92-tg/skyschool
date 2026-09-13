/* SkyySchool — безопасный bootstrap-repair для chess.html. */
'use strict';
(function () {
  function loadOnce(src) {
    return new Promise(resolve => {
      const existing = document.querySelector('script[data-chess-repair="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', resolve, { once:true });
        return;
      }
      const s=document.createElement('script');
      s.src=src;
      s.async=false;
      s.dataset.chessRepair=src;
      s.addEventListener('load',()=>{s.dataset.loaded='1';resolve();},{once:true});
      s.addEventListener('error',resolve,{once:true});
      document.head.appendChild(s);
    });
  }

  function ensureData(){
    const jobs=[];
    if(!Array.isArray(window.CHESS_LESSONS)) jobs.push(loadOnce('data/chess-lessons.js?v=repair4'));
    if(!Array.isArray(window.CHESS_PUZZLES)||!window.CHESS_PUZZLES.length) jobs.push(loadOnce('data/chess-puzzles.js?v=repair4'));
    return Promise.all(jobs);
  }

  function renderFallbacks(){
    try{
      const lessonList=document.querySelector('#lessonList');
      if(Array.isArray(window.CHESS_LESSONS)&&lessonList&&!lessonList.children.length&&typeof window.renderLessons==='function') window.renderLessons();
    }catch(_){}

    try{
      const board=document.querySelector('#pBoard');
      if(Array.isArray(window.CHESS_PUZZLES)&&window.CHESS_PUZZLES.length&&board&&typeof window.loadPuzzle==='function'&&board.querySelectorAll('.sqr').length!==64) window.loadPuzzle(0);
    }catch(_){}

    try{
      const board=document.querySelector('#gBoard');
      if(typeof window.newGame==='function'&&board&&!board.children.length) window.newGame();
    }catch(_){}
  }

  async function repair(){ await ensureData(); renderFallbacks(); }

  function start(){
    let attempts=0;
    const run=()=>{ attempts++; repair().catch(()=>{}); if(attempts<8)setTimeout(run,200); };
    run();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
