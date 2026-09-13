/* Шахматный тренер выбирается только там, где он нужен:
   в игре с ботом и прямо из разбора задачи. Отдельной вкладки нет. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;

  function addStyles(){
    if($('#trainer-access-styles'))return;
    const style=document.createElement('style');
    style.id='trainer-access-styles';
    style.textContent=`
      .chess-trainer-source{display:none!important}
      .trainer-select-link{display:inline-flex;align-items:center;margin-top:5px;padding:3px 7px;border:1px solid var(--line);border-radius:999px;background:var(--panel-2);color:var(--m-chess);font-size:9px;font-weight:900;cursor:pointer}
      .trainer-select-link:hover{border-color:var(--m-chess);background:var(--m-chess-soft)}
      .trainer-chooser{min-width:min(720px,calc(100vw - 40px))}
      .trainer-chooser-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      .trainer-chooser-head h2{margin:0;font-size:18px;line-height:1.2}
      .trainer-chooser-head p{margin:5px 0 0;max-width:520px;color:var(--muted);font-size:11px;line-height:1.45}
      .trainer-chooser-current{flex:0 0 auto;padding:6px 9px;border-radius:999px;background:var(--m-chess-soft);color:var(--m-chess);font-size:9px;font-weight:900;white-space:nowrap}
      .trainer-chooser .tui-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .trainer-chooser .tui-card{min-width:0}
      .trainer-chooser .tui-card.active{box-shadow:0 0 0 2px var(--m-chess-soft)}
      .pcr-change-coach{margin-left:auto;flex:0 0 auto;padding:5px 8px!important;font-size:9px!important}
      @media(max-width:600px){
        .trainer-chooser{min-width:0}
        .trainer-chooser-head{display:block}
        .trainer-chooser-current{display:inline-block;margin-top:8px}
        .trainer-chooser .tui-picker{grid-template-columns:1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function cleanStandalone(){
    $$('.tabs button[data-tab="trainer"]').forEach(b=>b.remove());
    $('#tab-trainer')?.remove();
    const root=$('#chessTeacherPicker')?.closest('.section');
    if(root){root.classList.add('chess-trainer-source');root.setAttribute('aria-hidden','true');}
  }

  function decoratePicker(host){
    if(!host)return;
    if(window.ChessTeacherUI&&!host.querySelector('.tui-card')){
      try{window.ChessTeacherUI.renderPicker(host)}catch(e){try{window.ChessTeacherUI.renderPicker('#chessTeacherPicker')}catch(_) {}}
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
            <p>${tx('Выбери характер разбора. Тренер будет объяснять ходы в этом стиле.','Choose the personality for move explanations.')}</p>
          </div>
          <span class="trainer-chooser-current">${tx('Сейчас: ','Current: ')}${name}</span>
        </div>
        <div id="trainerChooserHost"></div>
      </div>`,
      (box,close)=>{
        const host=box.querySelector('#trainerChooserHost');
        const picker=source.querySelector('.tui-picker');
        const cards=picker?.cloneNode(true);
        if(!cards){close();return;}
        host.appendChild(cards);
        cards.addEventListener('click',e=>{
          const card=e.target.closest('.tui-card');
          if(!card)return;
          try{window.ChessTeacherUI?.setSelected?.(card.dataset.id)}catch(_){}
          close();
          setTimeout(syncShortcuts,0);
        });
      }
    );
  }

  function currentTeacherName(){
    try{
      const t=window.ChessTeacherUI?.getTeacher?.();
      return t?.name?.ru||tx('Выбрать тренера','Choose coach');
    }catch(e){return tx('Выбрать тренера','Choose coach');}
  }

  function syncGameShortcut(){
    const game=$('#tab-game');if(!game)return;
    const card=game.querySelector('.game-mode-btn[data-game-mode="coach"]');if(!card)return;
    let link=card.querySelector('.trainer-select-link');
    if(!link){
      link=document.createElement('button');
      link.type='button';link.className='trainer-select-link';
      link.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openChooser()});
      const desc=card.querySelector('.game-mode-desc');(desc?.parentElement||card).appendChild(link);
    }
    link.textContent=currentTeacherName();
  }

  function addPuzzleShortcut(){
    const side=$('#tab-puzzles .side');if(!side)return;
    const panel=side.querySelector('#pCoachReview');if(!panel)return;
    let button=panel.querySelector('.pcr-change-coach');
    if(!button){
      button=document.createElement('button');button.type='button';button.className='btn ghost small pcr-change-coach';
      button.addEventListener('click',openChooser);
      const head=panel.querySelector('.pcr-head');if(head)head.appendChild(button);
    }
    button.textContent=tx('Сменить','Change');
  }

  function syncShortcuts(){cleanStandalone();syncGameShortcut();addPuzzleShortcut()}

  function init(){
    addStyles();syncShortcuts();
    const panel=document.querySelector('#tab-puzzles');
    if(panel&&!panel.__coachAccessObserver){const observer=new MutationObserver(syncShortcuts);observer.observe(panel,{childList:true,subtree:true});panel.__coachAccessObserver=true}
    const game=document.querySelector('#tab-game');
    if(game&&!game.__coachAccessObserver){const observer=new MutationObserver(syncGameShortcut);observer.observe(game,{childList:true,subtree:true});game.__coachAccessObserver=true}
    window.addEventListener('chessTeacherChanged',syncShortcuts);
    window.addEventListener('openChessTrainerChooser',openChooser);
    document.addEventListener('langchange',()=>setTimeout(syncShortcuts,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
