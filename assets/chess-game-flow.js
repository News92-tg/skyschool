/* SkyySchool — staged chess game setup.
   First choose a mode. Only then show the controls that belong to that mode.
   No duplicate setup panels; starting a game reveals and scrolls to the board.
*/
'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const tx=(ru,en)=>(window.Sky&&Sky.lang==='en'?en:ru);
  const MODE='sky_chess_game_mode';
  let stage='choose';
 
  function styles(){
    if($('chess-game-flow-styles')) return;
    const s=document.createElement('style');
    s.id='chess-game-flow-styles';
    s.textContent=`
      #tab-game>.game-mode-panel,
      #tab-game>.difficulty-panel,
      #tab-game>.row.game-controls-clean,
      #tab-game>.row:not(.game-flow-hidden){display:none!important}
      #gameFlowRoot{margin:0 0 18px}
      .game-flow-panel{padding:18px;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:var(--shadow-sm)}
      .game-flow-title{font-size:18px;font-weight:900;line-height:1.2}
      .game-flow-sub{margin-top:5px;font-size:11.5px;line-height:1.45;color:var(--muted)}
      .game-flow-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
      .game-flow-option{position:relative;display:flex;align-items:flex-start;gap:12px;min-height:92px;padding:14px;border:1px solid var(--line);border-radius:15px;background:var(--panel-2);text-align:left;cursor:pointer;transition:.15s ease}
      .game-flow-option:hover{transform:translateY(-1px);border-color:var(--line-2);box-shadow:var(--shadow-sm)}
      .game-flow-option .icon{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:var(--m-chess-soft);color:var(--m-chess);font-size:17px;font-weight:900;flex:0 0 auto}
      .game-flow-option b{display:block;font-size:13px;font-weight:900}
      .game-flow-option span{display:block;margin-top:3px;font-size:10.5px;line-height:1.4;color:var(--muted)}
      .game-flow-config{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
      .game-flow-back{margin-bottom:10px}
      .game-flow-config .difficulty-panel{display:block!important;margin:0!important}
      .game-flow-config .difficulty-panel .difficulty-head{margin-bottom:10px}
      .game-flow-config .difficulty-panel .difficulty-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
      .game-flow-teachers{margin-top:8px}
      .game-flow-teachers .tui-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .game-flow-teachers .tui-card{text-align:left}
      .game-flow-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      .game-flow-actions .btn{width:100%}
      .game-flow-start{grid-column:1/-1}
      .game-flow-label{font-size:11px;color:var(--muted);font-weight:900;text-transform:uppercase;letter-spacing:.08em}
      .game-flow-side{margin-top:12px;max-width:260px}
      #tab-game.game-flow-started #gameFlowRoot{display:none!important}
      #tab-game.game-flow-started>.board-wrap{display:grid!important}
      @media(max-width:850px){.game-flow-options{grid-template-columns:1fr}.game-flow-config .difficulty-panel .difficulty-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.game-flow-teachers .tui-picker{grid-template-columns:1fr}}
      @media(max-width:600px){.game-flow-config .difficulty-panel .difficulty-grid{grid-template-columns:1fr 1fr}.game-flow-actions{grid-template-columns:1fr}.game-flow-start{grid-column:auto}.game-flow-side{max-width:none}}
    `;
    document.head.appendChild(s);
  }
 
  function hideGlobalTrainerSource(){
    const picker=$('chessTeacherPicker');
    if(picker){
      const section=picker.closest('.section');
      if(section) section.remove();
      else picker.remove();
    }
    document.querySelectorAll('[data-tab="trainer"],#tab-teacher').forEach(el=>el.remove());
  }
 
  function hideLegacy(){
    const game=$('tab-game'); if(!game) return;
    ['.game-mode-panel','.difficulty-panel','.row.game-controls-clean'].forEach(sel=>game.querySelectorAll(sel).forEach(el=>el.classList.add('game-flow-hidden')));
    const sideRow=game.querySelector(':scope>.row:not(.game-controls-clean)');
    if(sideRow) sideRow.classList.add('game-flow-hidden');
    const boardWrap=game.querySelector(':scope>.board-wrap');
    if(boardWrap) boardWrap.style.display='none';
  }
 
  function buildRoot(){
    const game=$('tab-game'); if(!game) return null;
    let root=$('gameFlowRoot');
    if(!root){root=document.createElement('div');root.id='gameFlowRoot';game.insertBefore(root,game.firstElementChild);}
    return root;
  }
 
  function startGame(){
    const original=$('gNew');
    if(!original) return;
    stage='started';
    const game=$('tab-game');
    localStorage.setItem(MODE,game.dataset.flowMode==='solo'?'solo':'coach');
    original.click();
    setTimeout(()=>{
      game.classList.add('game-flow-started');
      const boardWrap=game.querySelector(':scope>.board-wrap');
      if(boardWrap) boardWrap.style.display='grid';
      const board=$('gBoard');
      if(board){
        const header=document.getElementById('appHeader');
        const headerH=header?header.getBoundingClientRect().height:0;
        const y=board.getBoundingClientRect().top+window.pageYOffset-headerH-12;
        window.scrollTo({top:Math.max(0,y),behavior:'smooth'});
      }
    },80);
  }
 
  function modeChooser(root){
    root.innerHTML=`
      <div class="game-flow-panel">
        <div class="game-flow-title">${tx('Как будем играть?','How do you want to play?')}</div>
        <div class="game-flow-sub">${tx('Выберите режим — лишних настроек здесь не будет.','Choose a mode — only the settings for that mode will appear.')}</div>
        <div class="game-flow-options">
          <button type="button" class="game-flow-option" data-flow-mode="coach">
            <span class="icon">♔</span><span><b>${tx('С тренером','With coach')}</b><span>${tx('Выберите тренера, получите разбор ходов и играйте против бота.','Choose a coach, get move feedback and play the bot.')}</span></span>
          </button>
          <button type="button" class="game-flow-option" data-flow-mode="solo">
            <span class="icon">♟</span><span><b>${tx('Без тренера','Without coach')}</b><span>${tx('Только партия и настройка силы бота.','Only the game and bot strength.')}</span></span>
          </button>
        </div>
      </div>`;
    root.querySelectorAll('[data-flow-mode]').forEach(b=>b.addEventListener('click',()=>showConfig(b.dataset.flowMode)));
  }
 
  function wrapDifficulty(){
    const holder=document.createElement('div');
    holder.className='game-flow-config';
    const game=$('tab-game');
    const old=game?.querySelector(':scope>.row.game-controls-clean .difficulty-panel') || game?.querySelector(':scope>.difficulty-panel');
    if(old){holder.appendChild(old);old.classList.remove('game-flow-hidden');}
    return holder;
  }
 
  function showConfig(kind){
    stage=kind;
    const game=$('tab-game'); if(!game) return;
    game.dataset.flowMode=kind;
    const root=buildRoot(); if(!root) return;
    root.innerHTML=`<div class="game-flow-panel"><button type="button" class="btn ghost small game-flow-back" id="gameFlowBack">← ${tx('Назад','Back')}</button><div class="game-flow-title">${kind==='coach'?tx('Игра с тренером','Game with coach'):tx('Игра без тренера','Game without coach')}</div><div class="game-flow-sub">${kind==='coach'?tx('Сначала выберите тренера. Потом настройте цвет и начните партию.','Choose a coach first. Then choose your side and start the game.'):tx('Выберите силу бота, цвет и начните партию.','Choose the bot strength, your side and start the game.')}</div></div>`;
    root.querySelector('#gameFlowBack').addEventListener('click',()=>{game.dataset.flowMode='';stage='choose';modeChooser(root);});
    const panel=root.firstElementChild;
 
    if(kind==='coach'){
      const block=document.createElement('div');block.className='game-flow-config';
      const label=document.createElement('div');label.className='game-flow-label';label.textContent=tx('Тренер','Coach');
      block.appendChild(label);
      const teachers=document.createElement('div');teachers.id='gameFlowTeachers';teachers.className='game-flow-teachers';block.appendChild(teachers);
      panel.appendChild(block);
      setTimeout(()=>{if(window.ChessTeacherUI) ChessTeacherUI.renderPicker(teachers);},0);
    }else{
      panel.appendChild(wrapDifficulty());
    }
 
    const sideBlock=document.createElement('div');sideBlock.className='game-flow-side';
    sideBlock.innerHTML=`<div class="game-flow-label">${tx('Я играю','I play')}</div><div class="field" style="margin-top:6px"><select id="gameFlowSide"><option value="w">${tx('Белыми','White')}</option><option value="b">${tx('Чёрными','Black')}</option></select></div>`;
    panel.appendChild(sideBlock);
 
    const actions=document.createElement('div');actions.className='game-flow-actions';
    const start=document.createElement('button');start.type='button';start.className='btn chess big game-flow-start';start.textContent=tx('Начать партию','Start game');
    start.addEventListener('click',()=>{
      const side=$('gameFlowSide');
      if(side&&$('gSide')) $('gSide').value=side.value;
      localStorage.setItem(MODE,kind==='solo'?'solo':'coach');
      startGame();
    });
    actions.appendChild(start);panel.appendChild(actions);
  }
 
  function resetStarted(){
    const game=$('tab-game');if(!game)return;
    game.classList.remove('game-flow-started');
    const boardWrap=game.querySelector(':scope>.board-wrap');
    if(boardWrap) boardWrap.style.display='none';
    stage='choose';game.dataset.flowMode='';
    const root=buildRoot();if(root)modeChooser(root);
  }
 
  function init(){
    styles();
    hideGlobalTrainerSource();
    const game=$('tab-game');if(!game){setTimeout(init,60);return;}
    hideLegacy();
    const root=buildRoot();
    modeChooser(root);
    game.__skyFlowReset=resetStarted;
  }
 
  document.addEventListener('click',e=>{
    const tab=e.target.closest('[data-tab="game"]');
    if(tab) setTimeout(init,0);
  });
  document.addEventListener('langchange',()=>setTimeout(()=>{if(stage!=='started')init();},0));
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else setTimeout(init,0);
})();
