/* Финальная UX-настройка шахмат.
   Тренер выбирается только из игры и из разбора задачи.
   Панель сложности показывается только в режиме без тренера.
   Здесь нет шахматной логики — только UI и проклейка существующих id. */
'use strict';
(function(){
  const MODE_KEY='sky_chess_game_mode';
  const ANALYSIS_KEY='sky_chess_detailed_analysis';
  const SOLO='solo';
  const TRAINER='coach';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;

  function style(){
    if($('#chess-final-polish-styles'))return;
    const s=document.createElement('style');s.id='chess-final-polish-styles';
    s.textContent=`
      /* Не показываем технический старый выбор тренера */
      .chess-trainer-source{display:none!important}
      .chess-tabs button[data-tab="trainer"]{display:none!important}

      /* Никаких горизонтальных вылетов */
      #tab-game,#tab-puzzles,#tab-lessons{min-width:0;max-width:100%}
      #tab-game .game-mode-panel,#tab-game .difficulty-panel{box-sizing:border-box;width:100%;max-width:100%;overflow:hidden}

      /* Режим игры */
      #tab-game .game-mode-panel{padding:16px;margin-bottom:14px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-game .game-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #tab-game .game-mode-btn{min-width:0;min-height:64px;box-sizing:border-box;padding:12px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel-2)}
      #tab-game .game-mode-btn.is-active{border:2px solid var(--m-chess);background:var(--m-chess-soft)}
      #tab-game .game-mode-name{font-size:13px;font-weight:900}
      #tab-game .game-mode-desc{font-size:10.5px;line-height:1.35;color:var(--muted)}
      #tab-game .game-mode-current{display:none!important}

      /* Выбор тренера */
      #tab-game .trainer-select-link{margin-top:7px;text-decoration:none;text-decoration-thickness:0;padding:4px 8px;border:1px solid var(--line);border-radius:999px;background:var(--panel);font-size:9px}
      #tab-game .trainer-select-link:hover{border-color:var(--m-chess);background:var(--m-chess-soft)}

      /* Настройка разбора */
      #tab-game .analysis-option{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
      #tab-game .analysis-copy{min-width:0}
      #tab-game .analysis-title{font-size:11.5px;font-weight:900;line-height:1.25}
      #tab-game .analysis-desc{margin-top:3px;font-size:9.5px;line-height:1.35;color:var(--muted)}
      #tab-game .analysis-switch{position:relative;flex:0 0 40px;width:40px;height:22px;border:1px solid var(--line);border-radius:999px;background:var(--panel);cursor:pointer}
      #tab-game .analysis-switch::after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--muted);transition:transform .15s ease,background .15s ease}
      #tab-game .analysis-switch.is-on{border-color:var(--m-chess);background:var(--m-chess-soft)}
      #tab-game .analysis-switch.is-on::after{transform:translateX(18px);background:var(--m-chess)}
      #tab-game .analysis-check{position:absolute;opacity:0;pointer-events:none}

      /* Сложность — только без тренера */
      #tab-game.game-with-coach .difficulty-panel{display:none!important}
      #tab-game.game-no-coach .difficulty-panel{display:block!important;margin-bottom:14px}
      #tab-game .difficulty-now{display:none!important}
      #tab-game .difficulty-grid{width:100%;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      #tab-game .difficulty-card{min-width:0;box-sizing:border-box;min-height:104px;padding:11px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel-2)}
      #tab-game .difficulty-card.is-active{border:2px solid var(--m-chess);background:var(--m-chess-soft)}

      /* Действия */
      #tab-game .game-action-row{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:10px}
      #tab-game .game-action-row .btn{width:100%;box-sizing:border-box}
      #tab-game .game-surrender{background:var(--no-soft)!important;color:var(--no)!important}

      /* Разбор в игре компактнее, чем учебный разбор задач */
      #tab-game #gReview{margin-top:12px}
      #tab-game #gReview .rv-card{gap:8px}
      #tab-game #gReview .rv-section{padding:10px 11px}
      #tab-game #gReview .rv-verdict-title{font-size:15px}
      #tab-game #gReview .rv-facts-list{display:grid}

      @media(max-width:900px){
        #tab-game .difficulty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        #tab-game .game-mode-grid{grid-template-columns:1fr}
      }
      @media(max-width:600px){
        #tab-game .game-action-row{grid-template-columns:1fr}
        #tab-game .analysis-option{align-items:flex-start}
      }
    `;
    document.head.appendChild(s);
  }

  function isSolo(){return localStorage.getItem(MODE_KEY)===SOLO}
  function analysisEnabled(){return localStorage.getItem(ANALYSIS_KEY)!=='0'}

  function syncGameState(){
    const game=$('#tab-game');if(!game)return;
    const solo=isSolo();
    game.classList.toggle('game-no-coach',solo);
    game.classList.toggle('game-with-coach',!solo);

    const diff=game.querySelector('.difficulty-panel');
    if(diff)diff.hidden=!solo;

    const review=$('#gReview');
    if(review && solo && !analysisEnabled())review.classList.add('hidden');
  }

  function addAnalysisOption(panel){
    if(!panel||!isSolo())return;
    let option=panel.querySelector('.analysis-option');
    if(!option){
      option=document.createElement('div');
      option.className='analysis-option';
      option.innerHTML=`
        <div class="analysis-copy">
          <div class="analysis-title">${tx('Разбор ходов и оценка партии','Move review and game analysis')}</div>
          <div class="analysis-desc">${tx('После ходов показывать объяснение, качество решения и подробный разбор.','Show move quality, explanations and detailed review after your moves.')}</div>
        </div>
        <button type="button" class="analysis-switch" aria-label="${tx('Разбор ходов','Move review')}">
          <input class="analysis-check" type="checkbox">
        </button>`;

      const action=panel.querySelector('.game-action-row');
      panel.insertBefore(option,action||null);
      option.querySelector('.analysis-switch').addEventListener('click',e=>{
        e.preventDefault();
        const enabled=!analysisEnabled();
        localStorage.setItem(ANALYSIS_KEY,enabled?'1':'0');
        syncAnalysisOption(panel);
        const review=$('#gReview');
        if(review)review.classList.toggle('hidden',!enabled);
      });
    }
    syncAnalysisOption(panel);
  }

  function syncAnalysisOption(panel){
    const sw=panel?.querySelector('.analysis-switch');
    if(!sw)return;
    const enabled=analysisEnabled();
    sw.classList.toggle('is-on',enabled);
    sw.setAttribute('aria-pressed',String(enabled));
    const check=sw.querySelector('.analysis-check');
    if(check)check.checked=enabled;
  }

  function fixNewGame(panel){
    if(!panel||panel.__newGameFixed)return;
    panel.__newGameFixed=true;
    panel.addEventListener('click',e=>{
      const b=e.target.closest('#gNewProxy');
      if(!b)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      try{
        if(typeof window.newGame==='function')window.newGame();
        else document.getElementById('gNew')?.click();
      }finally{
        setTimeout(syncGameState,0);
      }
    },true);
  }

  function simplifyGamePanel(){
    const game=$('#tab-game');if(!game)return;
    const panel=$('#gameModePanel');if(!panel)return;
    addAnalysisOption(panel);
    fixNewGame(panel);
    syncGameState();
  }

  function hideLegacyCoach(){
    $$('.tabs button[data-tab="trainer"]').forEach(b=>b.remove());
    $('#tab-trainer')?.remove();
    const root=$('#chessTeacherPicker')?.closest('.section');
    if(root)root.classList.add('chess-trainer-source');
  }

  function init(){
    style();
    hideLegacyCoach();
    simplifyGamePanel();

    const game=$('#tab-game');
    if(game&&!game.__finalPolishObserver){
      const mo=new MutationObserver(()=>{
        hideLegacyCoach();
        simplifyGamePanel();
      });
      mo.observe(game,{childList:true,subtree:true});
      game.__finalPolishObserver=true;
    }

    window.addEventListener('chessModeChanged',()=>setTimeout(syncGameState,0));
    window.addEventListener('chessTeacherChanged',()=>setTimeout(hideLegacyCoach,0));
    document.addEventListener('langchange',()=>setTimeout(init,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
