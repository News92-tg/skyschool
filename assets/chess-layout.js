/* SkyySchool — единый UX-слой страницы chess.html.
   Выбор тренера — только внутри игры/разбора.
   Сложность — только в режиме без тренера.
   Добавлены настройка анализа и конструктор собственных задач. */
'use strict';
(function(){
  const E=window.ChessEngine;
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const MODE_KEY='sky_chess_game_mode';
  const ANALYSIS_KEY='sky_chess_detailed_analysis';
  const SOLO='solo';

  let builderState=null,builderPiece=1,builderEditingId=null,builderCastle='-';
  const PIECES=[[1,'♙'],[2,'♘'],[3,'♗'],[4,'♖'],[5,'♕'],[6,'♔'],[9,'♟'],[10,'♞'],[11,'♝'],[12,'♜'],[13,'♛'],[14,'♚']];

  function addStyles(){
    if($('#chess-layout-unified-styles'))return;
    const s=document.createElement('style');s.id='chess-layout-unified-styles';
    s.textContent=`
      /* Чистая верхняя структура */
      .chess-trainer-source{display:none!important}
      .chess-tabs button[data-tab="trainer"],.tabs button[data-tab="trainer"]{display:none!important}
      #tab-trainer{display:none!important}

      /* Игра: режим */
      #tab-game .game-mode-current,#tab-game .difficulty-now{display:none!important}
      #tab-game .game-mode-panel,#tab-game .difficulty-panel{width:100%;box-sizing:border-box;overflow:visible}
      #tab-game .game-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #tab-game .game-mode-btn{min-width:0;box-sizing:border-box}
      #tab-game .game-mode-icon{font-size:0!important}
      #tab-game .game-mode-btn[data-game-mode="coach"] .game-mode-icon::before{content:'♞';font-size:20px}
      #tab-game .game-mode-btn[data-game-mode="solo"] .game-mode-icon::before{content:'♟';font-size:20px}
      #tab-game .game-action-row{display:grid;grid-template-columns:2fr 1fr;gap:8px}
      #tab-game .game-action-row .btn{width:100%;box-sizing:border-box}
      #tab-game .game-surrender{background:var(--no-soft)!important;color:var(--no)!important;border-color:var(--line)!important}

      /* Сложность */
      #tab-game.game-with-coach .difficulty-panel{display:none!important}
      #tab-game.game-no-coach .difficulty-panel{display:block!important}
      #tab-game .difficulty-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;width:100%;box-sizing:border-box}
      #tab-game .difficulty-card{min-width:0;box-sizing:border-box;overflow:hidden}
      #tab-game .difficulty-desc{overflow-wrap:anywhere}

      /* Переключатель разбора */
      #tab-game .analysis-option{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
      #tab-game .analysis-copy{min-width:0}
      #tab-game .analysis-title{font-size:11.5px;font-weight:900;line-height:1.25}
      #tab-game .analysis-desc{margin-top:3px;color:var(--muted);font-size:9.5px;line-height:1.35}
      #tab-game .analysis-switch{position:relative;flex:0 0 40px;width:40px;height:22px;border:1px solid var(--line);border-radius:999px;background:var(--panel);cursor:pointer}
      #tab-game .analysis-switch::after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:var(--muted);transition:transform .15s ease,background .15s ease}
      #tab-game .analysis-switch.is-on{border-color:var(--m-chess);background:var(--m-chess-soft)}
      #tab-game .analysis-switch.is-on::after{transform:translateX(18px);background:var(--m-chess)}
      #tab-game .analysis-check{position:absolute;opacity:0;pointer-events:none}
      #tab-game .trainer-select-link{display:inline-flex;align-items:center;max-width:100%;margin-top:6px;padding:4px 8px;border:1px solid var(--line);border-radius:999px;background:var(--panel);color:var(--m-chess);font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

      /* Общая геометрия доски */
      #tab-game .board-wrap,#tab-puzzles .board-wrap,#tab-live .board-wrap{display:grid;grid-template-columns:minmax(0,760px) minmax(280px,320px);gap:22px;align-items:start}
      #tab-game .board,#tab-puzzles .board,#tab-live .board{width:100%;max-width:760px;justify-self:start;min-width:0}
      #tab-game .side,#tab-puzzles .side,#tab-live .side{min-width:0}

      /* Конструктор */
      #tab-builder{min-width:0}
      .builder-shell{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:18px;align-items:start}
      .builder-card{min-width:0;padding:14px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      .builder-title{margin:0;font-size:16px;font-weight:900;line-height:1.2}
      .builder-sub{margin:4px 0 0;color:var(--muted);font-size:10.5px;line-height:1.45}
      .builder-toolbar{display:flex;gap:5px;flex-wrap:wrap;margin:12px 0 10px}
      .builder-piece{width:38px;height:38px;padding:0;display:grid;place-items:center;border:1px solid var(--line);border-radius:10px;background:var(--panel-2);font-size:19px;cursor:pointer}
      .builder-piece.active{border-color:var(--m-chess);background:var(--m-chess-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 12%,transparent)}
      .builder-piece.eraser{font-size:14px}
      .builder-board-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:100%;height:100%;overflow:hidden;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow-sm)}
      .builder-board{width:min(100%,620px);aspect-ratio:1;margin:0 auto}
      .builder-cell{display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;font-family:serif;font-size:clamp(18px,4.5vw,42px);line-height:1;cursor:pointer}
      .builder-cell.light{background:var(--board-light)}
      .builder-cell.dark{background:var(--board-dark)}
      .builder-cell.white-piece{color:var(--panel);text-shadow:0 1px 2px var(--ink)}
      .builder-cell.black-piece{color:var(--ink)}
      .builder-cell:hover{box-shadow:inset 0 0 0 2px var(--m-chess)}
      .builder-options{display:grid;gap:10px}
      .builder-field{display:grid;gap:5px}
      .builder-field label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
      .builder-field input,.builder-field select,.builder-field textarea{width:100%;box-sizing:border-box}
      .builder-fen{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px}
      .builder-castle{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
      .builder-check{display:flex;align-items:center;justify-content:center;gap:4px;padding:7px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2);font-size:10px;font-weight:900;cursor:pointer}
      .builder-check input{width:auto!important}
      .builder-actions{display:grid;grid-template-columns:2fr 1fr;gap:8px}
      .builder-message{min-height:18px;font-size:10px;line-height:1.4}
      .builder-cloud{padding:10px 11px;border-radius:11px;background:var(--m-chess-soft);font-size:9.5px;line-height:1.45;color:var(--ink-2)}
      .builder-cloud b{display:block;margin-bottom:3px;color:var(--m-chess)}
      .builder-login{display:flex;align-items:center;justify-content:space-between;gap:9px;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2);font-size:9.5px;line-height:1.4;color:var(--muted)}
      .builder-saved{display:grid;gap:7px}
      .builder-saved-item{display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2)}
      .builder-saved-copy{min-width:0;flex:1}
      .builder-saved-copy b{display:block;font-size:10.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .builder-saved-copy span{display:block;margin-top:2px;color:var(--muted);font-size:8.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .builder-empty{padding:11px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:10px;line-height:1.45}

      @media(max-width:1000px){
        #tab-game .difficulty-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
        #tab-game .board-wrap,#tab-puzzles .board-wrap,#tab-live .board-wrap{grid-template-columns:minmax(0,1fr)}
        .builder-shell{grid-template-columns:1fr}
      }
      @media(max-width:700px){
        #tab-game .difficulty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        #tab-game .game-mode-grid{grid-template-columns:1fr}
        #tab-game .game-action-row{grid-template-columns:1fr}
        .builder-actions{grid-template-columns:1fr}
      }
      @media(max-width:480px){
        #tab-game .difficulty-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
        .builder-toolbar{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
        .builder-piece{width:100%}
        .builder-castle{grid-template-columns:repeat(2,1fr)}
      }
    `;
    document.head.appendChild(s);
  }

  function removeLegacyCoachUI(){
    $$('.tabs button[data-tab="trainer"]').forEach(btn=>btn.remove());
    $('#tab-trainer')?.remove();
    const host=$('#chessTeacherPicker');
    host?.closest('.section')?.classList.add('chess-trainer-source');
  }

  function syncGame(){
    const game=$('#tab-game');if(!game)return;
    const solo=localStorage.getItem(MODE_KEY)===SOLO;
    game.classList.toggle('game-no-coach',solo);
    game.classList.toggle('game-with-coach',!solo);
    const diff=game.querySelector('.difficulty-panel');if(diff)diff.hidden=!solo;
    addAnalysisOption($('#gameModePanel'));
  }

  function addAnalysisOption(panel){
    if(!panel||localStorage.getItem(MODE_KEY)!==SOLO)return;
    let option=panel.querySelector('.analysis-option');
    if(!option){
      option=document.createElement('div');option.className='analysis-option';
      option.innerHTML=`<div class="analysis-copy"><div class="analysis-title">${tx('Разбор ходов и подробная оценка','Move review and detailed game analysis')}</div><div class="analysis-desc">${tx('Показывать качество ходов и итоговый разбор партии.','Show move quality and a detailed game review.')}</div></div><button type="button" class="analysis-switch"><input class="analysis-check" type="checkbox"></button>`;
      panel.insertBefore(option,panel.querySelector('.game-action-row')||null);
      option.querySelector('.analysis-switch').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();localStorage.setItem(ANALYSIS_KEY,localStorage.getItem(ANALYSIS_KEY)==='0'?'1':'0');syncAnalysisOption(option);if($('#gReview'))$('#gReview').classList.toggle('hidden',localStorage.getItem(ANALYSIS_KEY)==='0')});
    }
    syncAnalysisOption(option);
  }

  function syncAnalysisOption(option){
    const sw=option?.querySelector('.analysis-switch');if(!sw)return;
    const on=localStorage.getItem(ANALYSIS_KEY)!=='0';sw.classList.toggle('is-on',on);sw.setAttribute('aria-pressed',String(on));const c=sw.querySelector('.analysis-check');if(c)c.checked=on;
  }

  function interceptNewGame(){
    const panel=$('#gameModePanel');if(!panel||panel.__layoutNewBound)return;
    panel.__layoutNewBound=true;
    panel.addEventListener('click',e=>{const b=e.target.closest('#gNewProxy');if(!b)return;e.preventDefault();e.stopImmediatePropagation();try{if(typeof window.newGame==='function')window.newGame();else $('#gNew')?.click()}catch(err){console.error(err)}},true);
  }

  /* ---------- конструктор ---------- */
  function userKey(){return window.Sky?.db?.me?.()?.id||'guest'}
  function storeKey(){return 'sky_chess_custom_tasks:'+userKey()}
  function readTasks(){try{return JSON.parse(localStorage.getItem(storeKey())||'[]')}catch(_){return []}}
  function writeTasks(list){localStorage.setItem(storeKey(),JSON.stringify(list.slice(0,200)))}

  function blankState(){
    const st=E.create(E.START_FEN);for(let r=0;r<8;r++)for(let f=0;f<8;f++)st.board[E.sq(f,r)]=0;st.turn=E.WHITE;builderCastle='-';return st;
  }
  function validatePosition(fen){
    try{const st=E.create(fen);if(st.kings[E.WHITE]<0||st.kings[E.BLACK]<0)return {ok:false,msg:tx('На доске должны быть оба короля.','Both kings must be on the board.')};if(E.generate(st).some(m=>m.captured&&(m.captured&7)===E.KING))return {ok:false,msg:tx('Позиция невозможна: король стороны, которая не ходит, под боем.','Invalid position: the non-moving king is in check.')};return {ok:true,state:st}}catch(_){return {ok:false,msg:tx('FEN не удалось прочитать.','The FEN could not be read.')}}
  }
  function stateFromFen(fen){const v=validatePosition(fen);if(!v.ok)return null;builderCastle=String(fen).trim().split(/\s+/)[2]||'-';return v.state}
  function fen(){
    const rows=[];for(let r=7;r>=0;r--){let row='',empty=0;for(let f=0;f<8;f++){const p=builderState.board[E.sq(f,r)]||0;if(!p){empty++;continue}if(empty){row+=empty;empty=0}const ch=['','p','n','b','r','q','k'][p&7];row+=(p&8)?ch:ch.toUpperCase()}if(empty)row+=empty;rows.push(row)}return `${rows.join('/')} ${builderState.turn===E.WHITE?'w':'b'} ${builderCastle||'-'} - 0 1`;
  }
  function updateFen(){const i=$('#builderFen');if(i)i.value=fen()}
  function syncPieces(){const sec=$('#tab-builder');if(!sec)return;$$('.builder-piece',sec).forEach(b=>b.classList.toggle('active',+b.dataset.piece===builderPiece));}
  function renderBoard(){
    const host=$('#builderBoard');if(!host||!builderState)return;
    host.innerHTML='<div class="builder-board-grid">'+Array.from({length:64},(_,i)=>{const r=7-Math.floor(i/8),f=i%8,sq=E.sq(f,r),p=builderState.board[sq]||0;const pc=p?(p&8?' black-piece':' white-piece'):'';return `<button type="button" class="builder-cell ${(f+r)%2?'dark':'light'}${pc}" data-sq="${sq}">${p?['','♟','♞','♝','♜','♛','♚'][p&7]:''}</button>`}).join('')+'</div>';
    $$('.builder-cell',host).forEach(c=>c.addEventListener('click',()=>{builderState.board[+c.dataset.sq]=builderPiece;renderBoard();updateFen()}));
  }
  function renderSaved(){
    const host=$('#builderSaved');if(!host)return;const list=readTasks();if(!list.length){host.innerHTML=`<div class="builder-empty">${tx('Пока нет сохранённых задач.','No saved puzzles yet.')}</div>`;return}
    host.innerHTML='';list.forEach(task=>{const item=document.createElement('div');item.className='builder-saved-item';item.innerHTML=`<div class="builder-saved-copy"><b>${esc(task.title)}</b><span>${esc(task.category)} · ${esc(task.difficulty)} · ${esc((task.solutions||[]).join(', '))}</span></div><button type="button" class="btn ghost small" data-open="${esc(task.id)}">${tx('Открыть','Open')}</button><button type="button" class="btn ghost small" data-del="${esc(task.id)}">×</button>`;item.querySelector('[data-open]').addEventListener('click',()=>loadTask(task));item.querySelector('[data-del]').addEventListener('click',async()=>{writeTasks(readTasks().filter(x=>x.id!==task.id));renderSaved();if(window.Sky?.db?.isCloud?.())await window.Sky.db.remove('chess_custom_tasks',task.id)});host.appendChild(item)})
  }
  function renderBuilder(){
    const sec=$('#tab-builder');if(!sec||!builderState)return;
    const keep={title:$('#builderTitle')?.value,cat:$('#builderCategory')?.value,dif:$('#builderDifficulty')?.value,sol:$('#builderSolution')?.value,idea:$('#builderIdea')?.value,turn:$('#builderTurn')?.value};
    sec.innerHTML=`<div class="builder-shell"><section class="builder-card"><h2 class="builder-title">${tx('Конструктор позиции','Position builder')}</h2><p class="builder-sub">${tx('Расставьте фигуры, выберите сторону хода, укажите решение и сохраните свою задачу.','Place pieces, choose the side to move, set the solution and save your own puzzle.')}</p><div class="builder-toolbar">${PIECES.map(([id,icon])=>`<button type="button" class="builder-piece" data-piece="${id}">${icon}</button>`).join('')}<button type="button" class="builder-piece eraser" data-piece="0">⌫</button></div><div id="builderBoard" class="builder-board"></div></section><aside class="builder-card"><div class="builder-options"><div class="builder-field"><label>${tx('Сторона хода','Side to move')}</label><select id="builderTurn"><option value="w">${tx('Белые','White')}</option><option value="b">${tx('Чёрные','Black')}</option></select></div><div class="builder-field"><label>${tx('Рокировка','Castling')}</label><div class="builder-castle"><label class="builder-check"><input type="checkbox" value="K">K</label><label class="builder-check"><input type="checkbox" value="Q">Q</label><label class="builder-check"><input type="checkbox" value="k">k</label><label class="builder-check"><input type="checkbox" value="q">q</label></div></div><div class="builder-field"><label>${tx('Название','Title')}</label><input id="builderTitle" maxlength="80" placeholder="${tx('Например: Мат в один ход','For example: Mate in one')}"></div><div class="builder-field"><label>${tx('Категория','Category')}</label><select id="builderCategory"><option value="mate1">mate1</option><option value="mate2">mate2</option><option value="fork">fork</option><option value="pin">pin</option><option value="skewer">skewer</option><option value="discovered">discovered</option><option value="defence">defence</option><option value="endgame">endgame</option><option value="opening">opening</option><option value="general" selected>general</option></select></div><div class="builder-field"><label>${tx('Сложность','Difficulty')}</label><select id="builderDifficulty"><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select></div><div class="builder-field"><label>${tx('Решение (SAN)','Solution (SAN)')}</label><input id="builderSolution" placeholder="Ra8# или Ra8#, Qh7#"></div><div class="builder-field"><label>${tx('Идея / пояснение','Idea / note')}</label><textarea id="builderIdea" rows="4"></textarea></div><div class="builder-field"><label>FEN</label><input id="builderFen" class="builder-fen" readonly></div><div class="builder-actions"><button type="button" class="btn chess" id="builderSave">${tx('Сохранить задачу','Save puzzle')}</button><button type="button" class="btn ghost" id="builderReset">${tx('Новая позиция','New position')}</button></div><div id="builderMessage" class="builder-message"></div><div class="builder-cloud"><b>${tx('Сохранение','Storage')}</b>${tx('Без входа — локально. После входа через Google + Supabase задачи привязываются к профилю и могут синхронизироваться между устройствами.','Without an account, puzzles stay local. With Google + Supabase, puzzles are tied to your profile and can sync across devices.')}</div>${window.Sky?.db?.me?.()?'':'<div class="builder-login"><span>'+tx('Войдите, чтобы синхронизировать задачи.','Sign in to sync puzzles.')+'</span><button type="button" class="btn ghost small" id="builderLogin">'+tx('Войти','Sign in')+'</button></div>'}<div class="builder-field"><label>${tx('Мои задачи','My puzzles')}</label><div id="builderSaved" class="builder-saved"></div></div></div></aside></div>`;
    renderBoard();
    $('#builderTurn').value=keep.turn||(builderState.turn===E.BLACK?'b':'w');
    $('#builderTurn').addEventListener('change',e=>{builderState.turn=e.target.value==='b'?E.BLACK:E.WHITE;updateFen()});
    syncPieces();syncCastle();$$('.builder-castle input').forEach(c=>c.addEventListener('change',()=>{let v='';$$('.builder-castle input').forEach(x=>{if(x.checked)v+=x.value});builderCastle=v||'-';updateFen()}));
    if(keep.title!=null)$('#builderTitle').value=keep.title;if(keep.cat)$('#builderCategory').value=keep.cat;if(keep.dif)$('#builderDifficulty').value=keep.dif;if(keep.sol!=null)$('#builderSolution').value=keep.sol;if(keep.idea!=null)$('#builderIdea').value=keep.idea;
    $$('.builder-piece',sec).forEach(b=>b.addEventListener('click',()=>{builderPiece=+b.dataset.piece;syncPieces()}));
    $('#builderReset').addEventListener('click',()=>{builderState=blankState();builderEditingId=null;builderPiece=1;renderBuilder()});
    $('#builderSave').addEventListener('click',saveTask);$('#builderLogin')?.addEventListener('click',()=>Sky.auth.openAuth());
    updateFen();renderSaved();
  }
  function syncCastle(){ $$('.builder-castle input').forEach(c=>c.checked=builderCastle.includes(c.value)); }
  function saveTask(){
    const check=validatePosition(fen());const msg=$('#builderMessage');if(!check.ok){showMessage(check.msg,false);return}
    const raw=$('#builderSolution').value.trim();const sols=raw.split(',').map(x=>x.trim()).filter(Boolean);if(!sols.length){showMessage(tx('Укажите решение.','Enter a solution.'),false);return}
    for(const san of sols){if(!E.findMove(check.state,san)){showMessage(tx('Нелегальный ход: ','Illegal move: ')+san,false);return}}
    const me=window.Sky?.db?.me?.();const task={id:builderEditingId||`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,owner_id:me?.id||null,title:$('#builderTitle').value.trim()||tx('Моя шахматная задача','My chess puzzle'),category:$('#builderCategory').value,difficulty:$('#builderDifficulty').value,fen:fen(),solutions:sols,idea:$('#builderIdea').value.trim(),created_at:new Date().toISOString()};
    const list=readTasks();const i=list.findIndex(x=>x.id===task.id);if(i>=0)list[i]=task;else list.unshift(task);writeTasks(list);builderEditingId=task.id;renderSaved();showMessage(me&&Sky.db.isCloud?.()?tx('Сохранено локально и синхронизируется с облаком.','Saved locally and syncing to the cloud.'):tx('Задача сохранена на этом устройстве.','Puzzle saved on this device.'),true);syncCloudTask(task).catch(()=>{});
  }
  function showMessage(text,ok){const m=$('#builderMessage');if(!m)return;m.className='builder-message verdict '+(ok?'ok':'no');m.textContent=text}
  async function syncCloudTask(task){const db=Sky.db,me=db?.me?.();if(!db?.isCloud?.()||!me)return;const row={id:task.id,user_id:me.id,title:task.title,category:task.category,difficulty:task.difficulty,fen:task.fen,solutions:task.solutions,idea:task.idea,created_at:task.created_at,updated_at:new Date().toISOString()};const old=await db.list('chess_custom_tasks',{id:task.id});if(old.length)await db.update('chess_custom_tasks',task.id,row);else await db.insert('chess_custom_tasks',row)}
  async function hydrateCloud(){const db=Sky.db,me=db?.me?.();if(!db?.isCloud?.()||!me)return;try{const guestKey=TASKS_KEY+':guest';let guest=[];try{guest=JSON.parse(localStorage.getItem(guestKey)||'[]')}catch(_){}for(const t of guest)await syncCloudTask({...t,owner_id:me.id});if(guest.length)localStorage.removeItem(guestKey);const cloud=await db.list('chess_custom_tasks',{user_id:me.id});const map=new Map(readTasks().map(x=>[x.id,x]));cloud.forEach(x=>map.set(x.id,{id:x.id,owner_id:x.user_id,title:x.title,category:x.category,difficulty:x.difficulty,fen:x.fen,solutions:x.solutions||[],idea:x.idea||'',created_at:x.created_at}));writeTasks(Array.from(map.values()).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));renderSaved()}catch(_){} }
  function loadTask(task){const st=stateFromFen(task.fen);if(!st)return;builderState=st;builderEditingId=task.id;builderPiece=1;builderCastle=String(task.fen).split(/\s+/)[2]||'-';renderBuilder();setTimeout(()=>{if($('#builderTitle'))$('#builderTitle').value=task.title||'';if($('#builderCategory'))$('#builderCategory').value=task.category||'general';if($('#builderDifficulty'))$('#builderDifficulty').value=task.difficulty||'easy';if($('#builderSolution'))$('#builderSolution').value=(task.solutions||[]).join(', ');if($('#builderIdea'))$('#builderIdea').value=task.idea||'';syncCastle();updateFen()},0)}

  function ensureBuilder(){
    const tabs=$('.tabs');if(!tabs)return;
    let b=tabs.querySelector('[data-tab="builder"]');if(!b){b=document.createElement('button');b.type='button';b.dataset.tab='builder';b.className='chess-workbench-tab';b.setAttribute('aria-selected','false');b.textContent=tx('Конструктор','Builder');tabs.appendChild(b)}
    if(!$('#tab-builder')){const sec=document.createElement('section');sec.id='tab-builder';sec.className='hidden';$('#tab-live')?.after(sec)}
    if(!builderState)builderState=blankState();if(!$('#tab-builder .builder-shell'))renderBuilder();
  }
  function bindBuilderTab(){
    const tabs=$('.tabs');if(!tabs||tabs.__builderLayoutBound)return;tabs.__builderLayoutBound=true;
    tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-tab="builder"]');if(!b)return;e.preventDefault();e.stopPropagation();tabs.querySelectorAll('button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));['lessons','puzzles','game','teacher','live','builder'].forEach(n=>$('#tab-'+n)?.classList.toggle('hidden',n!==b.dataset.tab));renderBuilder()},true);
  }

  function moveTabs(){const main=$('.wrap'),tabs=$('.tabs');if(!main||!tabs)return;tabs.classList.add('chess-tabs');removeLegacyCoachUI();if(tabs.parentElement===main&&main.firstElementChild!==tabs)main.insertBefore(tabs,main.firstElementChild)}

  function init(){
    addStyles();moveTabs();ensureBuilder();bindBuilderTab();syncGame();interceptNewGame();hydrateCloud();
    const game=$('#tab-game');if(game&&!game.__layoutObserver){const mo=new MutationObserver(()=>{removeLegacyCoachUI();syncGame();interceptNewGame()});mo.observe(game,{childList:true,subtree:true});game.__layoutObserver=true}
    window.addEventListener('authchange',()=>setTimeout(()=>{ensureBuilder();hydrateCloud();},0));
    document.addEventListener('langchange',()=>setTimeout(()=>{moveTabs();ensureBuilder();syncGame()},0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
