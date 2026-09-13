/*
  Final runtime guard for chess page.
  Не зависит от порядка старых UI-слоёв: повторно подключает клики,
  переключение вкладок и базовые игровые действия, если старый слой не успел.
*/
'use strict';
(function(){
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const tabNames = ['lessons','puzzles','game','teacher','live','builder'];

  function showTab(name){
    const tabs = $('.tabs');
    if(!tabs) return false;
    $$('.tabs button[data-tab]').forEach(btn=>{
      btn.setAttribute('aria-selected', String(btn.dataset.tab===name));
    });
    tabNames.forEach(n=>{
      const sec = $('#tab-'+n);
      if(sec) sec.classList.toggle('hidden', n!==name);
    });
    if(name==='puzzles' && typeof window.loadPuzzle==='function'){
      setTimeout(()=>{
        try{ window.loadPuzzle(typeof window.__skyFinalPuzzleIndex==='number' ? window.__skyFinalPuzzleIndex : 0); }catch(_){ }
      },0);
    }
    if(name==='builder' && typeof window.renderBuilder==='function'){
      try{ window.renderBuilder(); }catch(_){ }
    }
    return true;
  }

  function bindTabs(){
    const tabs = $('.tabs');
    if(!tabs || tabs.__runtimeHotfixBound) return;
    tabs.__runtimeHotfixBound = true;
    tabs.addEventListener('click', e=>{
      const btn = e.target.closest('button[data-tab]');
      if(!btn) return;
      const name = btn.dataset.tab;
      if(!tabNames.includes(name)) return;
      e.preventDefault();
      e.stopPropagation();
      showTab(name);
    }, true);
  }

  function bindLessons(){
    const host = $('#lessonList');
    if(!host || host.__runtimeHotfixBound) return;
    host.__runtimeHotfixBound = true;
    host.addEventListener('click', e=>{
      const button = e.target.closest('.lesson-modern > button, .lesson > button');
      if(!button) return;
      const card = button.closest('.lesson-modern, .lesson');
      if(!card) return;
      const body = card.querySelector('.lesson-modern-body, .body');
      const open = !card.classList.contains('open');
      card.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
      if(body) body.classList.toggle('hidden', !open);
      if(open){
        const play = card.__runtimePlayDemo;
        if(typeof play==='function') play();
      }
    }, true);
  }

  function bindGameActions(){
    const game = $('#tab-game');
    if(!game || game.__runtimeHotfixBound) return;
    game.__runtimeHotfixBound = true;
    game.addEventListener('click', e=>{
      const newBtn = e.target.closest('#gNewProxy');
      if(newBtn){
        e.preventDefault();
        const original = $('#gNew');
        if(original) original.click();
        return;
      }
      const surrender = e.target.closest('#gSurrender');
      if(surrender && typeof window.resign==='function'){
        e.preventDefault();
        try{ window.resign(); }catch(_){ }
      }
    }, true);
  }

  function boot(){
    bindTabs();
    bindLessons();
    bindGameActions();
    const tabs = $('.tabs');
    if(tabs && !tabs.querySelector('button[data-tab="builder"]')){
      const b = document.createElement('button');
      b.type='button'; b.dataset.tab='builder'; b.setAttribute('aria-selected','false');
      b.textContent = (window.Sky && Sky.lang==='en') ? 'Builder' : 'Конструктор';
      tabs.appendChild(b);
    }
  }

  const timer = setInterval(boot, 100);
  setTimeout(()=>clearInterval(timer), 15000);
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
