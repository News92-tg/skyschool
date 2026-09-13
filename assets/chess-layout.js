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
      const allowed=['lessons','puzzles','game','teacher','live','builder'];
      if(!allowed.includes(b.dataset.tab))return;
      e.preventDefault();
      e.stopImmediatePropagation();
      tabs.querySelectorAll('button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      ['lessons','puzzles','game','teacher','live','builder'].forEach(n=>{
        const sec=$('#tab-'+n);
        if(sec)sec.classList.toggle('hidden',n!==b.dataset.tab);
      });
    },true);
  }

  function loadLessonUI(){
    if(document.querySelector('script[data-chess-lesson-ui="1"]')||window.__skyChessLessonUI)return;
    const s=document.createElement('script');
    s.src='assets/chess-lesson-ui.js?v=2';
    s.async=false;
    s.dataset.chessLessonUi='1';
    s.onload=()=>{window.__skyChessLessonUI=true};
    document.head.appendChild(s);
  }

  function setup(){
    const main=$('.wrap'),tabs=$('.tabs');
    if(!main||!tabs)return;
    tabs.classList.add('chess-tabs');
    removeStandaloneCoachUI();
    moveTabsTop();
    bind();
    loadLessonUI();
  }

  setup();
  document.addEventListener('DOMContentLoaded',setup,{once:true});
  document.addEventListener('langchange',setup);
  setTimeout(setup,120);
})();
