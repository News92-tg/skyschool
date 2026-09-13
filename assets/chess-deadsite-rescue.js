/* Emergency interaction layer: window-capture, independent from legacy chess UI handlers. */
(function(){
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const N=['lessons','puzzles','game','teacher','live','builder'];
  let installed=false;

  function invoke(name){
    const fn=window[name];
    if(typeof fn!=='function') return false;
    try{ fn.apply(window,Array.prototype.slice.call(arguments,1)); return true; }catch(e){ console.error('[Chess rescue]',name,e); return false; }
  }

  function tab(name,button){
    N.forEach(n=>{const s=$('#tab-'+n);if(s){s.classList.toggle('hidden',n!==name);s.classList.toggle('active',n===name);}});
    $$('.tabs button[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));
    if(name==='puzzles' && typeof window.loadPuzzle==='function') invoke('loadPuzzle',Number.isInteger(window.__skyFinalPuzzleIndex)?window.__skyFinalPuzzleIndex:0);
    if(name==='game' && typeof window.renderGame==='function') invoke('renderGame');
    if(name==='teacher' && typeof window.loadTeacherTasks==='function') invoke('loadTeacherTasks');
    if(name==='live' && typeof window.renderLiveNote==='function') invoke('renderLiveNote');
    if(name==='builder' && typeof window.renderBuilder==='function') invoke('renderBuilder');
  }

  function bind(){
    if(installed) return; installed=true;
    window.addEventListener('click',function(e){
      const t=e.target.closest && e.target.closest('.tabs button[data-tab]');
      if(t){e.preventDefault();e.stopImmediatePropagation();tab(t.dataset.tab,t);return;}
      const l=e.target.closest && e.target.closest('#lessonList .lesson-modern>button,#lessonList .lesson>button');
      if(l){e.preventDefault();e.stopImmediatePropagation();const c=l.closest('.lesson-modern,.lesson');const b=c&&c.querySelector('.lesson-modern-body,.body');if(c){const open=!c.classList.contains('open');c.classList.toggle('open',open);l.setAttribute('aria-expanded',String(open));if(b)b.classList.toggle('hidden',!open);if(open&&typeof c.__runtimePlayDemo==='function')c.__runtimePlayDemo();}return;}
      if(e.target.closest && e.target.closest('#gNewProxy')){e.preventDefault();e.stopImmediatePropagation();invoke('newGame');return;}
      if(e.target.closest && e.target.closest('#gSurrender')){e.preventDefault();e.stopImmediatePropagation();invoke('resign');return;}
      if(e.target.closest && e.target.closest('#gUndo')){e.preventDefault();e.stopImmediatePropagation();invoke('undoGame');if(!window.undoGame){const b=$('#gUndo');if(b){const old=b.getAttribute('data-rescue-clicked');if(old!=='1'){b.setAttribute('data-rescue-clicked','1');setTimeout(()=>b.click(),0);}}}return;}
      if(e.target.closest && e.target.closest('#gFlip')){e.preventDefault();e.stopImmediatePropagation();invoke('flipGame');return;}
      if(e.target.closest && e.target.closest('#pNext')){e.preventDefault();e.stopImmediatePropagation();const list=window.CHESS_PUZZLES;if(Array.isArray(list)&&list.length&&typeof window.loadPuzzle==='function'){let i=Number.isInteger(window.__skyFinalPuzzleIndex)?window.__skyFinalPuzzleIndex:0;i=(i+1)%list.length;window.__skyFinalPuzzleIndex=i;invoke('loadPuzzle',i);}return;}
      if(e.target.closest && e.target.closest('#pRetry')){e.preventDefault();e.stopImmediatePropagation();invoke('loadPuzzle',Number.isInteger(window.__skyFinalPuzzleIndex)?window.__skyFinalPuzzleIndex:0);return;}
      if(e.target.closest && e.target.closest('#pHint')){e.preventDefault();e.stopImmediatePropagation();const x=$('#pIdea');if(x)x.classList.remove('hidden');return;}
    },true);
  }

  function boot(){
    bind();
    const tabs=$('.tabs');
    if(tabs && !tabs.querySelector('button[data-tab="builder"]')){const b=document.createElement('button');b.type='button';b.dataset.tab='builder';b.setAttribute('aria-selected','false');b.textContent='Конструктор';tabs.appendChild(b);}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  let n=0;const id=setInterval(()=>{boot();if(++n>150)clearInterval(id)},100);
})();
