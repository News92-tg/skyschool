/* Надёжный доступ к выбору шахматного тренера. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;

  function addStyles(){
    if($('#trainer-access-styles')) return;
    const style=document.createElement('style');
    style.id='trainer-access-styles';
    style.textContent=`
      .trainer-select-link{display:block;margin-top:6px;color:var(--m-chess);font-size:10px;font-weight:900;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
      .trainer-select-link:hover{color:var(--ink)}
      #tab-trainer .trainer-picker-section{margin-top:0}
      #tab-trainer .tui-picker{width:100%}
    `;
    document.head.appendChild(style);
  }

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
      section.classList.add('chess-trainer-selection');
      const title=$('.trainer-title',section), sub=$('.trainer-subtitle',section);
      if(title) title.textContent=tx('Выберите своего тренера','Choose your coach');
      if(sub) sub.textContent=tx('Тренер будет комментировать ваши ходы после каждой партии — своим тоном и со своим характером.','Your coach will comment on your moves after every game — with a distinct tone and personality.');
    }
    return section;
  }

  function showSection(name){
    ['lessons','puzzles','game','teacher','live','trainer'].forEach(n=>{
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
      try{window.ChessTeacherUI.renderPicker('#chessTeacherPicker');}catch(e){}
    }
    const grid=$('.tui-picker',host);
    if(grid)grid.classList.add('trainer-grid');
    $$('.tui-card',host).forEach(card=>{
      card.classList.add('trainer-card');
    });
  }

  function addCoachShortcut(){
    const game=$('#tab-game');
    if(!game)return;
    const coach=$('.game-mode-btn[data-game-mode="coach"]',game);
    if(coach && !coach.querySelector('.trainer-select-link')){
      const wrap=coach.querySelector('.game-mode-desc')?.parentElement || coach;
      const link=document.createElement('span');
      link.className='trainer-select-link';
      link.setAttribute('role','button');
      link.setAttribute('tabindex','0');
      link.textContent=tx('Выбрать тренера','Choose coach');
      const open=()=>{ensureTrainerTab();decoratePicker();showSection('trainer');};
      link.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();});
      link.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();open();}});
      wrap.appendChild(link);
    }
  }

  function refreshModeLabel(){
    const game=$('#tab-game');
    if(!game||!window.ChessTeacherUI)return;
    const card=$('.game-mode-btn[data-game-mode="coach"]',game);
    if(!card)return;
    const link=$('.trainer-select-link',card);
    if(!link)return;
    try{
      const t=ChessTeacherUI.getTeacher();
      link.textContent=t ? tx('Тренер: '+t.name.ru,'Coach: '+t.name.en) : tx('Выбрать тренера','Choose coach');
    }catch(e){link.textContent=tx('Выбрать тренера','Choose coach');}
  }

  function init(){
    addStyles();
    const section=ensureTrainerTab();
    if(!section)return;
    bindTabs();
    decoratePicker();
    addCoachShortcut();
    refreshModeLabel();
    window.addEventListener('chessTeacherChanged',()=>{decoratePicker();refreshModeLabel();});
    document.addEventListener('langchange',()=>setTimeout(()=>{ensureTrainerTab();decoratePicker();addCoachShortcut();refreshModeLabel();},0));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
