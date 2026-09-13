/* Компоновка шахматной страницы: вкладки сразу под шапкой.
   Отдельной вкладки «Тренер» больше нет — шахматный тренер выбирается
   прямо из игры или из разбора задачи. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function removeCoachTabs(){
    $$('.tabs button[data-tab="trainer"]').forEach(btn=>btn.remove());
    $('#tab-trainer')?.remove();
  }

  function hideLegacyCoachPicker(){
    const host=$('#chessTeacherPicker');
    const root=host?.closest('.section');
    if(root){
      root.classList.add('chess-trainer-source');
      root.setAttribute('aria-hidden','true');
    }
  }

  function setup(){
    const main=$('.wrap'),tabs=$('.tabs');
    if(!main||!tabs)return;
    tabs.classList.add('chess-tabs');
    removeCoachTabs();
    hideLegacyCoachPicker();
    if(tabs.parentElement===main && main.firstElementChild!==tabs){
      main.insertBefore(tabs,main.firstElementChild);
    }
  }

  setup();
  document.addEventListener('DOMContentLoaded',setup,{once:true});
  document.addEventListener('langchange',setup);
  setTimeout(setup,120);
})();
