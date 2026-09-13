/* SkyySchool — единый UX-слой шахмат.
   Убирает лишнюю плашку сложности, чинит «Новую партию»,
   добавляет выбор подробного разбора и конструктор своих позиций. */
'use strict';
(function(){
  const MODE_KEY='sky_chess_game_mode';
  const ANALYSIS_KEY='sky_chess_detailed_analysis';
  const TASKS_KEY='sky_chess_custom_tasks';
  const TRAINER='coach';
  const SOLO='solo';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function style(){
    if($('#chess-workbench-styles')) return;
    const s=document.createElement('style');s.id='chess-workbench-styles';
    s.textContent=`
      /* Состояние игры */
      #tab-game .game-mode-current,#tab-game .difficulty-now{display:none!important}
      #tab-game .difficulty-panel{box-sizing:border-box;width:100%;max-width:100%;overflow:visible}
      #tab-game .difficulty-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;width:100%;}
      #tab-game .difficulty-card{min-width:0;box-sizing:border-box;overflow:hidden}
      #tab-game .difficulty-desc{min-height:0;overflow-wrap:anywhere}
      #tab-game .game-mode-panel{box-sizing:border-box;width:100%;max-width:100%;overflow:visible}
      #tab-game .game-action-row{display:grid;grid-template-columns:2fr 1fr;gap:8px}
      #tab-game .analysis-option{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
      #tab-game .analysis-copy{min-width:0}
      #tab-game .analysis-title{font-size:11.5px;font-weight:900;line-height:1.25}
      #tab-game .analysis-desc{margin-top:3px;font-size:9.5px;line-height:1.35;color:var(--muted)}
      #tab-game .analysis-switch{position:relative;flex:0 0 40px;width:40px;height:22px;border:1px solid var(--line);border-radius:999px;background:var(--panel);cursor:pointer}
      #tab-game .analysis-switch::after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--muted);transition:transform .15s ease,background .15s ease}
      #tab-game .analysis-switch.is-on{border-color:var(--m-chess);background:var(--m-chess-soft)}
      #tab-game .analysis-switch.is-on::after{transform:translateX(18px);background:var(--m-chess)}
      #tab-game .analysis-check{position:absolute;opacity:0;pointer-events:none}
      #tab-game.game-with-coach .difficulty-panel{display:none!important}
      #tab-game.game-no-coach .difficulty-panel{display:block!important}
      #tab-game .game-surrender{background:var(--no-soft)!important;color:var(--no)!important;border-color:var(--line)!important}

      /* Конструктор */
      #tab-builder{min-width:0}
      .builder-shell{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:18px;align-items:start}
      .builder-board-card,.builder-side-card{min-width:0;padding:14px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      .builder-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}
      .builder-title{margin:0;font-size:16px;font-weight:900;line-height:1.2}
      .builder-sub{margin:4px 0 0;font-size:10.5px;line-height:1.4;color:var(--muted)}
      .builder-board{width:min(100%,620px);aspect-ratio:1;margin:0 auto}
      .builder-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
      .builder-piece{min-width:38px;height:38px;padding:0 8px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2);font-size:19px;cursor:pointer}
      .builder-piece.active{border-color:var(--m-chess);background:var(--m-chess-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 12%,transparent)}
      .builder-piece.eraser{font-size:14px}
      .builder-options{display:grid;gap:10px}
      .builder-field{display:grid;gap:5px}
      .builder-field label{font-size:10px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
      .builder-field select,.builder-field input{width:100%;box-sizing:border-box}
      .builder-fen{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10.5px}
      .builder-actions{display:grid;grid-template-columns:2fr 1fr;gap:8px;margin-top:12px}
      .builder-saved{display:grid;gap:8px;margin-top:14px}
      .builder-saved-item{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2)}
      .builder-saved-copy{min-width:0;flex:1}
      .builder-saved-copy b{display:block;font-size:11px;font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .builder-saved-copy span{display:block;margin-top:2px;font-size:9px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .builder-empty{padding:12px;border:1px dashed var(--line);border-radius:11px;color:var(--muted);font-size:10px;line-height:1.4}
      .builder-login{padding:11px;border-radius:11px;background:var(--m-chess-soft);font-size:10.5px;line-height:1.45}
      .builder-login b{display:block;color:var(--m-chess);margin-bottom:3px}
      .builder-mini{width:72px;height:72px;flex:0 0 72px;border-radius:9px;overflow:hidden;border:1px solid var(--line)}

      /* Новая вкладка */
      .chess-workbench-tab{white-space:nowrap}
      .chess-workbench-tab[aria-selected="true"]{color:var(--m-chess)!important;border-bottom-color:var(--m-chess)!important}

      @media(max-width:1000px){
        #tab-game .difficulty-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        .builder-shell{grid-template-columns:1fr}
      }
      @media(max-width:700px){
        #tab-game .difficulty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        #tab-game .game-action-row{grid-template-columns:1fr}
        .builder-actions{grid-template-columns:1fr}
      }
      @media(max-width:480px){
        #tab-game .difficulty-grid{grid-template-columns:1fr 1fr}
        .builder-toolbar{display:grid;grid-template-columns:repeat(4,1fr)}
        .builder-piece{width:100%;padding:0}
      }
    `;
    document.head.appendChild(s);
  }

  function mode(){ return localStorage.getItem(MODE_KEY)===SOLO?SOLO:TRAINER; }
  function analysisEnabled(){ return localStorage.getItem(ANALYSIS_KEY)!=='0'; }

  function addAnalysisOption(panel){
    if(!panel || mode()!==SOLO) return;
    let option=panel.querySelector('.analysis-option');
    if(!option){
      option=document.createElement('div');
      option.className='analysis-option';
      option.innerHTML=`
        <div class="analysis-copy">
          <div class="analysis-title">${tx('Разбор ходов и подробная оценка','Move review and detailed game analysis')}</div>
          <div class="analysis-desc">${tx('Показывать качество ваших ходов и итоговый разбор партии после игры.','Show move quality and a detailed game review after the game.')}</div>
        </div>
        <button type="button" class="analysis-switch" aria-label="${tx('Разбор ходов','Move review')}"><input class="analysis-check" type="checkbox"></button>`;
      const actions=panel.querySelector('.game-action-row');
      panel.insertBefore(option,actions||null);
      option.querySelector('.analysis-switch').addEventListener('click',e=>{
        e.preventDefault();e.stopPropagation();
        localStorage.setItem(ANALYSIS_KEY,analysisEnabled()?'0':'1');
        syncAnalysisOption(option);
        const review=$('#gReview');
        if(review) review.classList.toggle('hidden',!analysisEnabled());
      });
    }
    syncAnalysisOption(option);
  }

  function syncAnalysisOption(scope){
    const sw=scope?.querySelector?.('.analysis-switch'); if(!sw)return;
    const on=analysisEnabled();
    sw.classList.toggle('is-on',on);sw.setAttribute('aria-pressed',String(on));
    const check=sw.querySelector('.analysis-check');if(check)check.checked=on;
  }

  function syncGame(){
    const game=$('#tab-game'); if(!game)return;
    const solo=mode()===SOLO;
    game.classList.toggle('game-no-coach',solo);
    game.classList.toggle('game-with-coach',!solo);
    const diff=game.querySelector('.difficulty-panel');if(diff)diff.hidden=!solo;
    const panel=$('#gameModePanel');if(panel)addAnalysisOption(panel);
  }

  function patchNewGame(){
    const panel=$('#gameModePanel');if(!panel||panel.__newGameFixed)return;
    panel.__newGameFixed=true;
    panel.addEventListener('click',e=>{
      const b=e.target.closest('#gNewProxy');if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      try{ if(typeof window.newGame==='function') window.newGame(); }
      catch(err){ console.error(err); }
      setTimeout(syncGame,0);
    },true);
  }

  function removeLegacyCoach(){
    $$('.tabs button[data-tab="trainer"]').forEach(b=>b.remove());
    $('#tab-trainer')?.remove();
    const source=$('#chessTeacherPicker')?.closest('.section');
    if(source) source.classList.add('chess-trainer-source');
  }

  function builderUserKey(){
    const me=window.Sky?.db?.me?.();
    return me?.id ? `user:${me.id}` : 'guest';
  }
  function builderKey(){ return `${TASKS_KEY}:${builderUserKey()}`; }
  function readSaved(){
    try{return JSON.parse(localStorage.getItem(builderKey())||'[]')}catch(_){return []}
  }
  function writeSaved(list){ localStorage.setItem(builderKey(),JSON.stringify(list)); }

  let builderState=null;
  let selectedPiece=1;

  const PIECES=[
    [1,'♙','white pawn'],[2,'♘','white knight'],[3,'♗','white bishop'],[4,'♖','white rook'],[5,'♕','white queen'],[6,'♔','white king'],
    [9,'♟','black pawn'],[10,'♞','black knight'],[11,'♝','black bishop'],[12,'♜','black rook'],[13,'♛','black queen'],[14,'♚','black king']
  ];

  function newBuilderState(){
    const st=E.create(E.START_FEN);
    for(let r=0;r<8;r++)for(let f=0;f<8;f++)st.board[E.sq(f,r)]=0;
    st.turn=E.WHITE;st.castle=0;st.ep=-1;st.halfmove=0;st.fullmove=1;
    return st;
  }

  function fenFromBuilder(){
    if(!builderState)return '';
    const rows=[];
    for(let r=7;r>=0;r--){
      let row='',empty=0;
      for(let f=0;f<8;f++){
        const p=builderState.board[E.sq(f,r)]||0;
        if(!p){empty++;continue;}
        if(empty){row+=empty;empty=0;}
        const glyph=['','p','n','b','r','q','k'][p&7]||'';
        row+=(p&8)?glyph:glyph.toUpperCase();
      }
      if(empty)row+=empty;rows.push(row);
    }
    const cast='-';
    return `${rows.join('/')} ${builderState.turn===E.WHITE?'w':'b'} ${cast} - ${builderState.halfmove||0} ${builderState.fullmove||1}`;
  }

  function validateFen(fen){
    try{
      const st=E.create(fen);
      if(!st?.board || st.kings[E.WHITE]<0 || st.kings[E.BLACK]<0) return {ok:false,msg:tx('Нужны оба короля.','Both kings are required.')};
      if(E.generate(st).some(m=>m.captured&&(m.captured&7)===E.KING)) return {ok:false,msg:tx('Позиция невозможна: король стороны, которая не ходит, под боем.','Invalid position: the non-moving king is in check.')};
      return {ok:true,state:st};
    }catch(_){return {ok:false,msg:tx('FEN не удалось прочитать.','FEN could not be parsed.')};}
  }

  function builderBoardHtml(){
    if(!builderState)return '';
    const cells=[];
    for(let r=7;r>=0;r--)for(let f=0;f<8;f++){
      const sq=E.sq(f,r),p=builderState.board[sq]||0;
      const light=(f+r)%2===0;
      cells.push(`<button type="button" class="builder-cell ${light?'light':'dark'}" data-sq="${sq}" aria-label="${'abcdefgh'[f]}${r+1}">${p?esc(['','♙','♘','♗','♖','♕','♔'][p&7]):''}</button>`);
    }
    return cells.join('');
  }

  function renderBuilderBoard(host){
    if(!host)return;
    host.innerHTML=`<div class="builder-board-grid">${builderBoardHtml()}</div>`;
    host.querySelectorAll('.builder-cell').forEach(c=>c.addEventListener('click',()=>{
      const sq=+c.dataset.sq;
      if(selectedPiece===0)builderState.board[sq]=0;else builderState.board[sq]=selectedPiece;
      renderBuilder();
    }));
  }

  function renderBuilder(){
    const sec=$('#tab-builder');if(!sec||!builderState)return;
    sec.innerHTML=`
      <div class="builder-shell">
        <section class="builder-board-card">
          <div class="builder-head">
            <div><h2 class="builder-title">${tx('Конструктор позиции','Position builder')}</h2><p class="builder-sub">${tx('Соберите свою позицию, задайте правильный ход и сохраните её.','Build your own position, set the solution and save it.')}</p></div>
          </div>
          <div class="builder-toolbar">
            ${PIECES.map(([id,icon])=>`<button type="button" class="builder-piece ${selectedPiece===id?'active':''}" data-piece="${id}" title="${esc(icon)}">${icon}</button>`).join('')}
            <button type="button" class="builder-piece eraser ${selectedPiece===0?'active':''}" data-piece="0">⌫</button>
          </div>
          <div class="builder-board" id="builderBoard"></div>
        </section>
        <aside class="builder-side-card">
          <div class="builder-options">
            <div class="builder-field"><label>${tx('Сторона хода','Side to move')}</label><select id="builderTurn"><option value="w" ${builderState.turn===E.WHITE?'selected':''}>${tx('Белые','White')}</option><option value="b" ${builderState.turn===E.BLACK?'selected':''}>${tx('Чёрные','Black')}</option></select></div>
            <div class="builder-field"><label>${tx('Название','Title')}</label><input id="builderTitle" type="text" maxlength="80" placeholder="${tx('Например: Мат в один ход','For example: Mate in one')}" /></div>
            <div class="builder-field"><label>${tx('Категория','Category')}</label><select id="builderCategory"><option value="mate1">mate1</option><option value="mate2">mate2</option><option value="fork">fork</option><option value="pin">pin</option><option value="skewer">skewer</option><option value="discovered">discovered</option><option value="defence">defence</option><option value="endgame">endgame</option><option value="opening">opening</option><option value="general" selected>general</option></select></div>
            <div class="builder-field"><label>${tx('Сложность','Difficulty')}</label><select id="builderDifficulty"><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select></div>
            <div class="builder-field"><label>${tx('Решение','Solution')}</label><input id="builderSolution" type="text" placeholder="Ra8#" /></div>
            <div class="builder-field"><label>${tx('Подсказка / идея','Hint / idea')}</label><textarea id="builderIdea" rows="4"></textarea></div>
            <div class="builder-field"><label>FEN</label><input id="builderFen" class="builder-fen" readonly /></div>
            <div class="builder-actions"><button type="button" class="btn chess" id="builderSave">${tx('Сохранить задачу','Save puzzle')}</button><button type="button" class="btn ghost" id="builderReset">${tx('Очистить','Clear')}</button></div>
            <div id="builderMessage" class="gameinfo"></div>
            <div class="builder-saved" id="builderSaved"></div>
          </div>
        </aside>
      </div>`;

    const board=document.createElement('div');board.className='builder-board-squares';
    $('#builderBoard').replaceChildren(board);renderBuilderBoard(board);
    $$('.builder-piece',sec).forEach(b=>b.addEventListener('click',()=>{selectedPiece=+b.dataset.piece;renderBuilder();}));
    $('#builderTurn').addEventListener('change',e=>{builderState.turn=e.target.value==='b'?E.BLACK:E.WHITE;renderBuilder()});
    $('#builderReset').addEventListener('click',()=>{builderState=newBuilderState();selectedPiece=1;renderBuilder()});
    $('#builderSave').addEventListener('click',saveBuilderPuzzle);
    $('#builderFen').value=fenFromBuilder();
    renderSaved();
  }

  function saveBuilderPuzzle(){
    const fen=fenFromBuilder();
    const check=validateFen(fen);const msg=$('#builderMessage');
    if(!check.ok){msg.className='gameinfo verdict no';msg.textContent=check.msg;return;}
    const sol=$('#builderSolution').value.trim();
    if(!sol){msg.className='gameinfo verdict no';msg.textContent=tx('Укажите ход решения.','Enter a solution move.');return;}
    if(!E.findMove(check.state,sol)){msg.className='gameinfo verdict no';msg.textContent=tx('Такого хода нет в этой позиции.','That move is not legal in this position.');return;}
    const me=window.Sky?.db?.me?.();
    const task={id:`custom-${Date.now().toString(36)}`,owner_id:me?.id||null,title:$('#builderTitle').value.trim()||tx('Моя шахматная задача','My chess puzzle'),category:$('#builderCategory').value,difficulty:$('#builderDifficulty').value,fen,solutions:[sol],idea:$('#builderIdea').value.trim(),created_at:new Date().toISOString()};
    const list=readSaved();list.unshift(task);writeSaved(list.slice(0,100));
    if(msg){msg.className='gameinfo verdict ok';msg.textContent=tx('Задача сохранена на этом устройстве.','Puzzle saved on this device.');}
    renderSaved();
  }

  function renderSaved(){
    const host=$('#builderSaved');if(!host)return;
    const list=readSaved();
    host.innerHTML=`<div class="builder-field"><label>${tx('Мои задачи','My puzzles')}</label></div>`;
    if(!list.length){host.insertAdjacentHTML('beforeend',`<div class="builder-empty">${tx('Пока нет сохранённых позиций.','No saved positions yet.')}</div>`);return;}
    list.forEach(task=>{
      const item=document.createElement('div');item.className='builder-saved-item';
      item.innerHTML=`<div class="builder-saved-copy"><b>${esc(task.title)}</b><span>${esc(task.category)} · ${esc(task.difficulty)} · ${esc(task.solutions?.[0]||'')}</span></div><button type="button" class="btn ghost small" data-id="${esc(task.id)}">${tx('Открыть','Open')}</button><button type="button" class="btn ghost small" data-del="${esc(task.id)}">×</button>`;
      item.querySelector('[data-id]').addEventListener('click',()=>loadSavedTask(task));
      item.querySelector('[data-del]').addEventListener('click',()=>{writeSaved(readSaved().filter(x=>x.id!==task.id));renderSaved();});
      host.appendChild(item);
    });
  }

  function loadSavedTask(task){
    const check=validateFen(task.fen);if(!check.ok)return;
    builderState=check.state;selectedPiece=1;renderBuilder();
    setTimeout(()=>{const title=$('#builderTitle');const cat=$('#builderCategory');const dif=$('#builderDifficulty');const sol=$('#builderSolution');const idea=$('#builderIdea');if(title)title.value=task.title||'';if(cat)cat.value=task.category||'general';if(dif)dif.value=task.difficulty||'easy';if(sol)sol.value=task.solutions?.[0]||'';if(idea)idea.value=task.idea||'';},0);
  }

  function ensureBuilderTab(){
    const tabs=$('.tabs');if(!tabs)return;
    if(!tabs.querySelector('[data-tab="builder"]')){
      const b=document.createElement('button');b.type='button';b.dataset.tab='builder';b.className='chess-workbench-tab';b.setAttribute('aria-selected','false');b.textContent=tx('Конструктор','Builder');tabs.appendChild(b);
    }
    if(!$('#tab-builder')){
      const sec=document.createElement('section');sec.id='tab-builder';sec.className='hidden';
      $('#tab-live')?.after(sec);
    }
    if(!builderState)builderState=newBuilderState();
    if(!$('#tab-builder .builder-shell'))renderBuilder();
  }

  function bindBuilderTab(){
    const tabs=$('.tabs');if(!tabs||tabs.__builderBound)return;
    tabs.__builderBound=true;
    tabs.addEventListener('click',e=>{
      const b=e.target.closest('button[data-tab="builder"]');if(!b)return;
      e.preventDefault();e.stopPropagation();
      tabs.querySelectorAll('button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      ['lessons','puzzles','game','teacher','live','builder'].forEach(n=>$('#tab-'+n)?.classList.toggle('hidden',n!==b.dataset.tab));
      renderBuilder();
    },true);
  }

  function onAuth(){
    ensureBuilderTab();
    renderSaved();
  }

  function init(){
    style();removeLegacyCoach();ensureBuilderTab();bindBuilderTab();syncGame();patchNewGame();
    const game=$('#tab-game');
    if(game&&!game.__workbenchObserver){
      const mo=new MutationObserver(()=>{removeLegacyCoach();syncGame();patchNewGame();});
      mo.observe(game,{childList:true,subtree:true});game.__workbenchObserver=true;
    }
    window.addEventListener('chessModeChanged',()=>setTimeout(syncGame,0));
    window.addEventListener('authchange',()=>setTimeout(onAuth,0));
    document.addEventListener('langchange',()=>setTimeout(()=>{removeLegacyCoach();ensureBuilderTab();renderBuilder();syncGame();},0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
