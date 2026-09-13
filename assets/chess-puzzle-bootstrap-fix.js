/* Надёжная первичная загрузка задач после асинхронного набора. */
'use strict';
(function(){
  let done = false;
  function boot(){
    if(done) return true;
    const list = window.CHESS_PUZZLES;
    const loader = window.loadPuzzle;
    if(!Array.isArray(list) || !list.length || typeof loader !== 'function') return false;
    done = true;
    try {
      loader(0);
    } catch(e) {
      done = false;
      return false;
    }
    const update = window.refreshChessPuzzleUI || window.refreshPuzzleUI;
    if(typeof update === 'function') setTimeout(update, 0);
    return true;
  }

  function start(){
    if(boot()) return;
    let tries = 0;
    const timer = setInterval(()=>{
      if(boot() || ++tries > 50) clearInterval(timer);
    }, 100);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
