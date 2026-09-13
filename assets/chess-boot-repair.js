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

  function restorePuzzleArray() {
    const backup=window.__CHESS_PUZZLES_RAW_BACKUP__;
    if(!Array.isArray(backup)||!backup.length)return false;
    if(Array.isArray(window.CHESS_PUZZLES)){
      if(!window.CHESS_PUZZLES.length){window.CHESS_PUZZLES.push(...backup);return true;}
      return false;
    }
    window.CHESS_PUZZLES=backup.slice();
    return true;
  }

  async function ensureData(){
    if(!Array.isArray(window.CHESS_LESSONS))await loadOnce('data/chess-lessons.js?v=repair5');
    restorePuzzleArray();
    if(!Array.isArray(window.CHESS_PUZZLES)||!window.CHESS_PUZZLES.length){
      await loadOnce('data/chess-puzzles.js?v=repair5');
      restorePuzzleArray();
    }
  }

  function renderFallbacks(){
    try{
      const list=document.querySelector('#lessonList');
      if(Array.isArray(window.CHESS_LESSONS)&&list&&!list.children.length&&typeof window.renderLessons==='function')window.renderLessons();
    }catch(_){}
    try{
      const board=document.querySelector('#pBoard');
      if(Array.isArray(window.CHESS_PUZZLES)&&window.CHESS_PUZZLES.length&&board&&typeof window.loadPuzzle==='function'&&board.querySelectorAll('.sqr').length!==64)window.loadPuzzle(0);
    }catch(_){}
    try{
      const board=document.querySelector('#gBoard');
      if(typeof window.newGame==='function'&&board&&!board.children.length)window.newGame();
    }catch(_){}
  }

  async function repair(){
    await ensureData();
    renderFallbacks();
    window.dispatchEvent(new CustomEvent('chessDataReady'));
  }

  function start(){
    let attempts=0;
    const run=()=>{attempts++;repair().catch(()=>{});if(attempts<8)setTimeout(run,220);};
    run();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
