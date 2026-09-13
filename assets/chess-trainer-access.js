/* Надёжный доступ к выбору шахматного тренера. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;

  function ensureTrainerTab(){
    const main=$('.wrap'), tabs=$('.tabs'), host=$('#chessTeacherPicker');
    if(!main||!tabs||!host) return null;

    let tab=tabs.querySelector('button[data-tab="trainer"]');
    if(!tab){
      tab=document.createElement('button');
      tab.type='button';
      tab.dataset.tab='trainer';
      tab.setAttribute('aria-selected','false');
      tab.textContent=tx('Тренер','Coach');
      tabs.appendChild(tab);
    }

    let section=$('#tab-trainer');
    const root=host.closest('.section');
    if(!section && root){
      section=document.createElement('section');
      section.id='tab-trainer';
      section.className='trainer-section hidden';
      section.innerHTML=`<div class="section-head"><h2 class="trainer-title">${tx('Выберите своего тренера','Choose your coach')}</h2><p class="trainer-subtitle">${tx('Тренер будет комментировать ваши ходы после каждой партии — своим тоном и со своим характером.','Your coach comments on your moves after every game — with a distinct tone and personality.')}</p></div>`;
      section.appendChild(root);
      main.appendChild(section);
    }
    if(section){
      const title=$('.trainer-title',section), sub=$('.trainer-subtitle',section);
      if(title) title.textContent=tx('Выберите своего тренера','Choose your coach');
      if(sub) sub.textContent=tx('Тренер будет комментировать ваши ходы после каждой партии — своим тоном и со своим характером.','Your coach will comment on your moves after every game — with a distinct tone and personality.');
    }
    return section;
  }

  function showSection(name){
    const names=['lessons','puzzles','game','teacher','live','trainer'];
    names.forEach(n=>{
      const sec=$('#tab-'+n);
      if(sec) sec.classList.toggle('hidden',n!==name);
    });
    const tabs=$('.tabs');
    if(tabs) $$('.tabs button[data-tab]',tabs).forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
  }

  function bindTabs(){
    const tabs=$('.tabs');
    if(!tabs||tabs.__trainerAccessBound)return;
    tabs.__trainerAccessBound=true;
    tabs.addEventListener('click',e=>{
      const b=e.target.closest('button[data-tab]');
      if(!b)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      showSection(b.dataset.tab);
    },true);
  }

  function decoratePicker(){
    const host=$('#chessTeacherPicker');
    if(!host)return;
    if(window.ChessTeacherUI && !host.querySelector('.tui-card')){
      try{ ChessTeacherUI.renderPicker('#chessTeacherPicker'); }catch(e){}
    }
    const grid=$('.tui-picker',host);
    if(grid)grid.classList.add('trainer-grid');
    $$('.tui-card',host).forEach(card=>{
      card.classList.add('trainer-card');
      if(!card.hasAttribute('title')){
        const id=card.dataset.id;
        const t=window.ChessTeacherUI&&ChessTeacherUI.TEACHERS&&ChessTeacherUI.TEACHERS[id];
        if(t) card.title=(Sky&&Sky.lang==='en'?t.style.en:t.style.ru)||'';
      }
    });
  }

  function addCoachShortcut(){
    const game=$('#tab-game');
    if(!game)return;
    const coach=$('.game-mode-btn[data-game-mode="coach"]',game);
    if(coach && !coach.querySelector('.trainer-select-link')){
      const wrap=coach.querySelector('span:last-child') || coach;
      const link=document.createElement('button');
      link.type='button';
      link.className='trainer-select-link';
      link.textContent=tx('Выбрать тренера','Choose coach');
      link.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();ensureTrainerTab();decoratePicker();showSection('trainer');});
      wrap.appendChild(link);
    }
  }

  function refreshModeLabel(){
    const game=$('#tab-game');
    if(!game||!window.ChessTeacherUI)return;
    const card=$('.game-mode-btn[data-game-mode="coach"]',game);
    if(!card)return;
    let name=tx('Выбрать тренера','Choose coach');
    try{ const t=ChessTeacherUI.getTeacher(); if(t) name=tx('Тренер: '+t.name.ru,'Coach: '+t.name.en); }catch(e){}
    const link=$('.trainer-select-link',card);
    if(link) link.textContent=name;
  }

  function init(){
    const section=ensureTrainerTab();
    if(!section)return;
    bindTabs();
    decoratePicker();
    addCoachShortcut();
    refreshModeLabel();
    window.addEventListener('chessTeacherChanged',()=>{decoratePicker();refreshModeLabel();});
    document.addEventListener('langchange',()=>setTimeout(()=>{ensureTrainerTab();decoratePicker();refreshModeLabel();},0));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
