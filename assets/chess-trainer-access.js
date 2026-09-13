/* Шахматный тренер выбирается только там, где он нужен:
   в игре с ботом и прямо из разбора задачи. Отдельной вкладки нет. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;

  function cleanStandalone(){
    $$('.tabs button[data-tab="trainer"]').forEach(b=>b.remove());
    $('#tab-trainer')?.remove();
    const root=$('#chessTeacherPicker')?.closest('.section');
    if(root){
      root.classList.add('chess-trainer-source');
      root.setAttribute('aria-hidden','true');
    }
  }

  function decoratePicker(host){
    if(!host)return;
    if(window.ChessTeacherUI&&!host.querySelector('.tui-card')){
      try{window.ChessTeacherUI.renderPicker(host);}catch(e){try{window.ChessTeacherUI.renderPicker('#chessTeacherPicker')}catch(_) {}}
    }
    const grid=host.querySelector('.tui-picker');
    if(grid)grid.classList.add('trainer-grid');
    $$('.tui-card',host).forEach(card=>card.classList.add('trainer-card'));
  }

  function openChooser(){
    cleanStandalone();
    const source=$('#chessTeacherPicker');
    if(!source||!window.Sky?.modal)return;
    decoratePicker(source);

    const current=window.ChessTeacherUI?.getTeacher?.();
    const name=current?.name?.ru||tx('Тренер','Coach');

    Sky.modal(`
      <div class="trainer-chooser">
        <div class="trainer-chooser-head">
          <div>
            <h2>${tx('Выбрать тренера','Choose a coach')}</h2>
            <p>${tx('Выбери характер разбора — этот тренер будет объяснять твои ходы.','Choose how your moves should be explained.')}</p>
          </div>
          <span class="trainer-chooser-current">${tx('Сейчас: ','Current: ')}${name}</span>
        </div>
        <div id="trainerChooserHost"></div>
      </div>`,
      (box,close)=>{
        const host=box.querySelector('#trainerChooserHost');
        const cards=source.querySelector('.tui-picker')?.cloneNode(true);
        if(!cards){close();return;}
        host.appendChild(cards);
        cards.addEventListener('click',e=>{
          const card=e.target.closest('.tui-card');
          if(!card)return;
          try{window.ChessTeacherUI?.setSelected?.(card.dataset.id);}catch(_){}
          close();
          setTimeout(syncShortcuts,0);
        });
      }
    );
  }

  function currentTeacherName(){
    try{
      const t=window.ChessTeacherUI?.getTeacher?.();
      return t?.name?.ru || tx('Выбрать тренера','Choose coach');
    }catch(e){return tx('Выбрать тренера','Choose coach');}
  }

  function syncGameShortcut(){
    const game=$('#tab-game');
    if(!game)return;
    const card=game.querySelector('.game-mode-btn[data-game-mode="coach"]');
    if(!card)return;
    let link=card.querySelector('.trainer-select-link');
    if(!link){
      link=document.createElement('button');
      link.type='button';
      link.className='trainer-select-link';
      link.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openChooser();});
      const desc=card.querySelector('.game-mode-desc');
      (desc?.parentElement||card).appendChild(link);
    }
    link.textContent=currentTeacherName();
  }

  function addPuzzleShortcut(){
    const side=$('#tab-puzzles .side');
    if(!side)return;
    const panel=side.querySelector('#pCoachReview');
    if(!panel)return;
    let button=panel.querySelector('.pcr-change-coach');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='btn ghost small pcr-change-coach';
      button.addEventListener('click',openChooser);
      const head=panel.querySelector('.pcr-head');
      if(head)head.appendChild(button);
    }
    button.textContent=tx('Сменить тренера','Change coach');
  }

  function syncShortcuts(){
    cleanStandalone();
    syncGameShortcut();
    addPuzzleShortcut();
  }

  function init(){
    syncShortcuts();
    const panel=document.querySelector('#tab-puzzles');
    if(panel&&!panel.__coachAccessObserver){
      const observer=new MutationObserver(syncShortcuts);
      observer.observe(panel,{childList:true,subtree:true});
      panel.__coachAccessObserver=true;
    }
    const game=document.querySelector('#tab-game');
    if(game&&!game.__coachAccessObserver){
      const observer=new MutationObserver(syncGameShortcut);
      observer.observe(game,{childList:true,subtree:true});
      game.__coachAccessObserver=true;
    }
    window.addEventListener('chessTeacherChanged',syncShortcuts);
    document.addEventListener('langchange',()=>setTimeout(syncShortcuts,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
