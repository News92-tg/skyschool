/* Компоновка шахматной страницы: вкладки сразу под шапкой.
   Выбор тренера не является отдельной вкладкой: он открывается
   из игры или из разбора задачи. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function removeStandaloneCoachUI(){
    $$('.tabs button[data-tab="trainer"]').forEach(btn=>btn.remove());
    $('#tab-trainer')?.remove();
    const host=$('#chessTeacherPicker');
    const root=host?.closest('.section');
    if(root){
      root.classList.add('chess-trainer-source');
      root.setAttribute('aria-hidden','true');
    }
  }

  function moveTabsTop(){
    const main=$('.wrap'),tabs=$('.tabs');
    if(!main||!tabs)return;
    tabs.classList.add('chess-tabs');
    removeStandaloneCoachUI();
    if(tabs.parentElement===main && main.firstElementChild!==tabs){
      main.insertBefore(tabs,main.firstElementChild);
    }
  }

  function bind(){
    const tabs=$('.tabs');
    if(!tabs||tabs.__cleanTabsBound)return;
    tabs.__cleanTabsBound=true;
    tabs.addEventListener('click',e=>{
      const b=e.target.closest('button[data-tab]');
      if(!b)return;
      const allowed=['lessons','puzzles','game','teacher','live'];
      if(!allowed.includes(b.dataset.tab))return;
      e.preventDefault();
      e.stopImmediatePropagation();
      $$('.tabs button[data-tab]',tabs).forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      allowed.forEach(name=>{
        const sec=$('#tab-'+name);
        if(sec)sec.classList.toggle('hidden',name!==b.dataset.tab);
      });
      if(b.dataset.tab==='puzzles')window.puzzleBoard?.render?.();
      if(b.dataset.tab==='game')window.gameBoard?.render?.();
      if(b.dataset.tab==='teacher')window.loadTeacherTasks?.();
      if(b.dataset.tab==='live'&&window.liveGame)window.liveBoard?.render?.();
    },true);
  }

  function init(){
    moveTabsTop();
    bind();
    removeStandaloneCoachUI();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
