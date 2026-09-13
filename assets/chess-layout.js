/* Компоновка шахматной страницы без изменения шахматного движка. */
'use strict';
(function(){
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => Array.from(r.querySelectorAll(s));
  const TX = (ru,en) => window.Sky && Sky.lang === 'en' ? en : ru;

  function setupTabs(){
    const main=$('.wrap'), tabs=$('.tabs');
    if(!main||!tabs||tabs.dataset.layoutReady)return;
    tabs.dataset.layoutReady='1';
    tabs.classList.add('chess-tabs');

    const trainerTab=document.createElement('button');
    trainerTab.type='button';
    trainerTab.dataset.tab='trainer';
    trainerTab.setAttribute('aria-selected','false');
    trainerTab.textContent=TX('Тренер','Coach');
    tabs.appendChild(trainerTab);

    tabs.addEventListener('click',e=>{
      const b=e.target.closest('button[data-tab]');
      if(!b)return;
      const isTrainer=b.dataset.tab==='trainer';
      $$('button[data-tab]',tabs).forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      const section=$('#tab-trainer');
      if(section)section.classList.toggle('hidden',!isTrainer);
    },true);

    main.insertBefore(tabs,main.firstChild);
  }

  function setupTrainerTab(){
    const host=$('#chessTeacherPicker');
    const root=host && host.closest('.section');
    const main=$('.wrap');
    if(!host||!root||!main||$('#tab-trainer'))return;

    const section=document.createElement('section');
    section.id='tab-trainer';
    section.className='trainer-section hidden';
    section.innerHTML=`
      <div class="section-head">
        <h2 class="trainer-title">${TX('Выберите своего тренера','Choose your coach')}</h2>
        <p class="trainer-subtitle">${TX('Тренер будет комментировать ваши ходы после каждой партии — своим тоном и со своим характером','Your coach will comment on your moves after each game — with a distinct tone and personality.')}</p>
      </div>`;
    section.appendChild(root);
    root.removeAttribute('style');
    root.classList.add('trainer-picker-section');
    main.appendChild(section);

    decorateTrainerPicker(host);
  }

  function decorateTrainerPicker(host){
    const decorate=()=>{
      const grid=$('.tui-picker',host);
      if(grid)grid.classList.add('trainer-grid');
      $$('.tui-card',host).forEach(card=>card.classList.add('trainer-card'));
    };
    decorate();
    const observer=new MutationObserver(decorate);
    observer.observe(host,{childList:true,subtree:true});
  }

  function syncTrainerText(){
    const section=$('#tab-trainer');
    if(!section)return;
    const title=$('.trainer-title',section), sub=$('.trainer-subtitle',section), tab=$('.tabs button[data-tab="trainer"]');
    if(title)title.textContent=TX('Выберите своего тренера','Choose your coach');
    if(sub)sub.textContent=TX('Тренер будет комментировать ваши ходы после каждой партии — своим тоном и со своим характером','Your coach will comment on your moves after each game — with a distinct tone and personality.');
    if(tab)tab.textContent=TX('Тренер','Coach');
  }

  function syncResignVisibility(){
    const game=$('#tab-game'), status=$('#gStatus');
    if(!game||!status)return;
    const text=String(status.textContent||'').trim();
    const running=!!text && !/бот думает|bot is thinking|вы выиграли|вы проиграли|ничья|сдались|you win|you lose|draw|resigned/i.test(text);
    game.classList.toggle('game-running',running);
  }

  function init(){
    setupTabs();
    setupTrainerTab();
    syncTrainerText();
    syncResignVisibility();
    const status=$('#gStatus');
    if(status&&!status.__layoutObserver){
      const observer=new MutationObserver(syncResignVisibility);
      observer.observe(status,{childList:true,subtree:true,characterData:true});
      status.__layoutObserver=true;
    }
    document.addEventListener('langchange',()=>{setupTabs();syncTrainerText();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
