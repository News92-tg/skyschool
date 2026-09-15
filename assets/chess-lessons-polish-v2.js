/* SkyySchool — final visual polish for the unified lesson labs.
   Coordinates are explicit, pieces are larger, and all lesson boards keep
   the same geometry without touching the live game/puzzle boards. */
'use strict';
(function(){
  const FILES='abcdefgh';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  function decorateBoard(board){
    if(!board || board.dataset.coordsReady==='1') return;
    const cells=$$('.lesson-lab-cell',board);
    if(cells.length!==64) return;
    board.dataset.coordsReady='1';
    cells.forEach(cell=>{
      const sq=cell.dataset.square||'';
      if(sq.length!==2) return;
      const file=sq[0], rank=sq[1];
      if(rank==='1'){
        const label=document.createElement('span');
        label.className='lesson-coord-file';
        label.textContent=file;
        label.setAttribute('aria-hidden','true');
        cell.appendChild(label);
      }
      if(file==='a'){
        const label=document.createElement('span');
        label.className='lesson-coord-rank';
        label.textContent=rank;
        label.setAttribute('aria-hidden','true');
        cell.appendChild(label);
      }
    });
  }

  function decorateMotion(board){
    if(!board || board.dataset.coordsReady==='1') return;
    const cells=$$('.lesson-motion-cell',board);
    if(cells.length!==64) return;
    board.dataset.coordsReady='1';
    cells.forEach(cell=>{
      const sq=cell.dataset.square||'';
      if(sq.length!==2) return;
      if(sq[1]==='1'){
        const label=document.createElement('span');
        label.className='lesson-coord-file';
        label.textContent=sq[0];
        label.setAttribute('aria-hidden','true');
        cell.appendChild(label);
      }
      if(sq[0]==='a'){
        const label=document.createElement('span');
        label.className='lesson-coord-rank';
        label.textContent=sq[1];
        label.setAttribute('aria-hidden','true');
        cell.appendChild(label);
      }
    });
  }

  function installStyle(){
    if($('#lesson-polish-v2')) return;
    const s=document.createElement('style');
    s.id='lesson-polish-v2';
    s.textContent=`
      /* Unified lesson boards */
      #tab-lessons .lesson-lab-board{
        width:min(360px,100%)!important;
        max-width:360px!important;
        aspect-ratio:1/1!important;
        display:grid!important;
        grid-template-columns:repeat(8,minmax(0,1fr))!important;
        grid-template-rows:repeat(8,minmax(0,1fr))!important;
        overflow:hidden!important;
        position:relative!important;
        border-radius:14px!important;
      }
      #tab-lessons .lesson-lab-cell{
        position:relative!important;
        min-width:0!important;
        min-height:0!important;
        box-sizing:border-box!important;
      }
      #tab-lessons .lesson-lab-static-piece{
        font-size:clamp(34px,6.4vw,50px)!important;
        line-height:1!important;
        display:block!important;
        transform:translateY(1px)!important;
        user-select:none!important;
        pointer-events:none!important;
      }
      #tab-lessons .lesson-lab-piece{
        font-size:clamp(38px,7vw,52px)!important;
        line-height:1!important;
        width:auto!important;
        height:auto!important;
        margin:0!important;
        padding:0!important;
      }
      #tab-lessons .lesson-lab-cell .lesson-coord-file,
      #tab-lessons .lesson-lab-cell .lesson-coord-rank,
      #tab-lessons .lesson-motion-cell .lesson-coord-file,
      #tab-lessons .lesson-motion-cell .lesson-coord-rank{
        position:absolute!important;
        z-index:2!important;
        font:800 9px/1 Nunito,sans-serif!important;
        letter-spacing:.02em!important;
        pointer-events:none!important;
        user-select:none!important;
        opacity:.78!important;
        text-shadow:0 1px 1px rgba(255,255,255,.18)!important;
      }
      #tab-lessons .lesson-coord-file{right:4px!important;bottom:3px!important}
      #tab-lessons .lesson-coord-rank{left:4px!important;top:3px!important}
      #tab-lessons .lesson-lab-cell.light .lesson-coord-file,
      #tab-lessons .lesson-lab-cell.light .lesson-coord-rank,
      #tab-lessons .lesson-motion-cell.light .lesson-coord-file,
      #tab-lessons .lesson-motion-cell.light .lesson-coord-rank{color:rgba(30,52,76,.72)!important;text-shadow:none!important}
      #tab-lessons .lesson-lab-cell.dark .lesson-coord-file,
      #tab-lessons .lesson-lab-cell.dark .lesson-coord-rank,
      #tab-lessons .lesson-motion-cell.dark .lesson-coord-file,
      #tab-lessons .lesson-motion-cell.dark .lesson-coord-rank{color:rgba(255,255,255,.72)!important}

      /* The specialised motion board also gets the same readable geometry. */
      #tab-lessons .lesson-motion-board{
        width:min(360px,100%)!important;
        max-width:360px!important;
        aspect-ratio:1/1!important;
      }
      #tab-lessons .lesson-motion-piece{font-size:clamp(38px,7vw,52px)!important;line-height:1!important}

      /* Give the board more room inside the lesson lab. */
      #tab-lessons .lesson-lab-body{
        grid-template-columns:minmax(320px,380px) minmax(0,1fr)!important;
        align-items:start!important;
        gap:24px!important;
      }
      #tab-lessons .lesson-lab-board{justify-self:center!important}
      #tab-lessons .lesson-lab-side{min-width:0!important}

      @media(max-width:820px){
        #tab-lessons .lesson-lab-body{grid-template-columns:1fr!important}
        #tab-lessons .lesson-lab-board{justify-self:start!important}
      }
      @media(max-width:560px){
        #tab-lessons .lesson-lab-board,
        #tab-lessons .lesson-motion-board{width:min(330px,100%)!important;max-width:330px!important}
        #tab-lessons .lesson-lab-static-piece,
        #tab-lessons .lesson-lab-piece,
        #tab-lessons .lesson-motion-piece{font-size:clamp(31px,10vw,43px)!important}
      }
    `;
    document.head.appendChild(s);
  }

  function run(){
    installStyle();
    $$('.lesson-lab-board').forEach(decorateBoard);
    $$('.lesson-motion-board').forEach(decorateMotion);
  }

  function init(){
    run();
    const host=$('#lessonList');
    if(host && !host.__lessonPolishV2){
      const obs=new MutationObserver(()=>{
        clearTimeout(host.__lessonPolishV2Timer);
        host.__lessonPolishV2Timer=setTimeout(run,25);
      });
      obs.observe(host,{childList:true,subtree:true});
      host.__lessonPolishV2=obs;
    }
    window.addEventListener('resize',run,{passive:true});
    document.addEventListener('langchange',run);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
