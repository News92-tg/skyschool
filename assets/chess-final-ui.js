/*
  SkyySchool — final chess UI stabilization.
  Один слой для согласованной навигации, задач, тренера, режима игры
  и конструктора. Не меняет ChessEngine / ChessReview.
*/
'use strict';
(function(){
  const E=window.ChessEngine;
  const $=s=>document.querySelector(s);
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;

  const MODE_KEY='sky_chess_game_mode';
  const REVIEW_KEY='sky_chess_show_review';
  const BUILDER_KEY='sky_chess_custom_tasks';

  function addStyles(){
    if($('#chess-final-ui-styles')) return;
    const st=document.createElement('style');
    st.id='chess-final-ui-styles';
    st.textContent=`
      /* Верх страницы */
      .chess-trainer-source{display:none!important}
      .chess-tabs{margin-top:0!important}

      /* Режим партии */
      #gameModePanel{margin-bottom:14px}
      #gameModePanel .final-coach-picker-btn{margin-top:7px;padding:6px 9px;border:1px solid var(--line);border-radius:9px;background:var(--panel-2);font-size:10px;font-weight:900;color:var(--m-chess)}
      #gameModePanel .final-review-toggle{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--muted)}
      #gameModePanel .final-review-toggle input{accent-color:var(--m-chess)}
      #tab-game.game-no-coach .review,#tab-game.game-no-coach .tui-current{display:none!important}

      /* Модалка выбора тренера */
      .final-coach-dialog{width:min(760px,calc(100vw - 32px))}
      .final-coach-dialog .tui-picker{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .final-coach-dialog .tui-card{text-align:left}
      @media(max-width:600px){.final-coach-dialog .tui-picker{grid-template-columns:1fr}}

      /* Конструктор */
      #tab-builder{display:none}
      #tab-builder.active{display:block}
      .final-builder{display:grid;grid-template-columns:minmax(280px,560px) minmax(280px,1fr);gap:16px;align-items:start}
      .final-builder-board{padding:10px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      .final-builder-board .board{width:100%;max-width:none!important}
      .final-builder-panel{display:grid;gap:10px}
      .final-builder-card{padding:13px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      .final-builder-title{font-size:13px;font-weight:900}
      .final-builder-help{margin-top:3px;font-size:10.5px;line-height:1.4;color:var(--muted)}
      .final-piece-palette{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:10px}
      .final-piece-btn{display:grid;place-items:center;min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2);font-size:23px}
      .final-piece-btn.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      .final-builder-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
      .final-builder-fields{display:grid;gap:8px}
      .final-builder-list{display:grid;gap:7px;margin-top:10px}
      .final-builder-task{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2)}
      .final-builder-task-main{min-width:0;flex:1}
      .final-builder-task-title{font-size:11px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .final-builder-task-meta{margin-top:2px;font-size:9.5px;color:var(--muted)}
      @media(max-width:900px){.final-builder{grid-template-columns:1fr}}

      /* Перестраиваем старый пустой puzzle board-wrap */
      #tab-puzzles .board-wrap{min-width:0}
      #tab-puzzles .board{min-width:0}
    `;
    document.head.appendChild(st);
  }

  function restorePuzzles(){
    const list=window.CHESS_PUZZLES;
    const raw=window.__CHESS_PUZZLES_RAW_BACKUP__;
    if(Array.isArray(list)&&list.length) return list;
    if(Array.isArray(raw)&&raw.length){
      if(Array.isArray(list)){ list.push(...raw); return list; }
      window.CHESS_PUZZLES=raw.slice(); return window.CHESS_PUZZLES;
    }
    return null;
  }

  function removeLegacyTrainerArea(){
    const host=$('#chessTeacherPicker');
    if(host){
      const candidates=[host.closest('.section'),host.parentElement];
      for(const node of candidates){
        if(!node) continue;
        const head=node.querySelector('.section-head h2,h2');
        if(head && /Выберите тренера|Choose your coach/i.test(head.textContent||'')){
          node.classList.add('chess-trainer-source');
          node.setAttribute('aria-hidden','true');
          break;
        }
      }
    }
    $$('.tabs button[data-tab="trainer"]').forEach(x=>x.remove());
    function $$(s,r=document){return Array.from(r.querySelectorAll(s));}
  }

  function ensureTabs(){
    const tabs=$('.tabs');
    if(!tabs) return;
    tabs.classList.add('chess-tabs');
    removeLegacyTrainerArea();

    let builderBtn=tabs.querySelector('button[data-tab="builder"]');
    if(!builderBtn){
      builderBtn=document.createElement('button');
      builderBtn.type='button'; builderBtn.dataset.tab='builder'; builderBtn.setAttribute('aria-selected','false');
      builderBtn.textContent=tx('Конструктор','Builder');
      tabs.appendChild(builderBtn);
    }

    let builder=$('#tab-builder');
    if(!builder){
      builder=document.createElement('section');
      builder.id='tab-builder';
      builder.className='hidden';
      tabs.parentElement.appendChild(builder);
    }

    tabs.addEventListener('click',e=>{
      const b=e.target.closest('button[data-tab]');
      if(!b||b.dataset.tab==='trainer') return;
      e.preventDefault(); e.stopImmediatePropagation();
      const name=b.dataset.tab;
      tabs.querySelectorAll('button[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
      ['lessons','puzzles','game','teacher','live','builder'].forEach(n=>{
        const sec=$('#tab-'+n);
        if(sec) sec.classList.toggle('hidden',n!==name);
      });
      if(name==='builder') renderBuilder();
      if(name==='puzzles') setTimeout(()=>{restorePuzzles(); if(typeof window.loadPuzzle==='function') window.loadPuzzle(window.__skyFinalPuzzleIndex||0);},0);
    },true);
  }

  function openCoachPicker(){
    if(!window.ChessTeacherUI||!Sky||!Sky.modal) return;
    const host=document.createElement('div');
    host.className='final-coach-dialog';
    host.innerHTML='<h2 style="margin-bottom:6px">'+tx('Выберите тренера','Choose your coach')+'</h2><p class="lead" style="font-size:12px;margin-bottom:12px">'+tx('Выбранный тренер будет комментировать игру и разбор задач в своём стиле.','Your chosen coach will comment on games and puzzle reviews in their own style.')+'</p><div id="finalCoachPicker"></div>';
    Sky.modal(host.outerHTML,(box,close)=>{
      const picker=box.querySelector('#finalCoachPicker');
      ChessTeacherUI.renderPicker(picker);
      picker.addEventListener('click',e=>{
        if(e.target.closest('.tui-card')) setTimeout(close,80);
      });
    });
  }

  function injectCoachButton(){
    const modePanel=$('#gameModePanel');
    if(!modePanel||modePanel.querySelector('.final-coach-picker-btn')) return;
    const b=document.createElement('button');
    b.type='button'; b.className='final-coach-picker-btn'; b.textContent=tx('Выбрать тренера','Choose coach');
    b.addEventListener('click',openCoachPicker);
    const first=modePanel.querySelector('[data-game-mode="coach"]');
    if(first) first.parentElement.appendChild(b);
  }

  function injectReviewToggle(){
    const panel=$('#gameModePanel');
    if(!panel||panel.querySelector('.final-review-toggle')) return;
    const label=document.createElement('label'); label.className='final-review-toggle';
    const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=localStorage.getItem(REVIEW_KEY)!=='0';
    const span=document.createElement('span'); span.textContent=tx('Показывать разбор ходов и подробную оценку партии','Show move analysis and detailed game review');
    label.append(cb,span);
    cb.addEventListener('change',()=>{
      localStorage.setItem(REVIEW_KEY,cb.checked?'1':'0');
      const r=$('#gReview'); if(r&&!cb.checked) r.classList.add('hidden');
    });
    panel.appendChild(label);
  }

  function fixNewGame(){
    const b=$('#gNewProxy');
    if(!b||b.__finalBound) return;
    b.__finalBound=true;
    b.addEventListener('click',()=>{
      const original=$('#gNew');
      if(original){ original.hidden=false; original.style.removeProperty('display'); original.click(); }
      const review=$('#gReview'); if(review) review.classList.add('hidden');
    },true);
  }

  function forceInitialPuzzle(){
    const list=restorePuzzles();
    if(!list||!list.length||typeof window.loadPuzzle!=='function') return;
    if(typeof window.__skyFinalPuzzleIndex!=='number') window.__skyFinalPuzzleIndex=0;
    setTimeout(()=>{
      try{ window.loadPuzzle(window.__skyFinalPuzzleIndex); }catch(_){ }
      const total=$('#pTotal');
      if(total && list.length) total.textContent=list.length;
    },120);
  }

  /* ---------- конструктор ---------- */
  const PIECES=[
    ['wK','♔'],['wQ','♕'],['wR','♖'],['wB','♗'],['wN','♘'],['wP','♙'],
    ['bK','♚'],['bQ','♛'],['bR','♜'],['bB','♝'],['bN','♞'],['bP','♟']
  ];
  let builderApi=null;
  let builderState=null;
  let builderPiece='wP';

  function builderFen(){
    if(!builderState) return '';
    try{return E.fen(builderState);}catch(_){return ''}
  }

  function createEmptyBuilder(){
    const st=E.create();
    for(let i=0;i<128;i++) if(!(i&8)) st.board[i]=0;
    st.turn=E.WHITE; st.castling=0; st.ep=-1; st.halfmove=0; st.fullmove=1;
    st.kings[E.WHITE]=-1; st.kings[E.BLACK]=-1;
    return st;
  }

  function placeBuilderPiece(sq,piece){
    if(!builderState) return;
    builderState.board[sq]=piece;
    if((piece&7)===E.KING) builderState.kings[(piece&8)?E.BLACK:E.WHITE]=sq;
    if(!piece){
      if(builderState.kings[E.WHITE]===sq) builderState.kings[E.WHITE]=-1;
      if(builderState.kings[E.BLACK]===sq) builderState.kings[E.BLACK]=-1;
    }
    builderApi.state=builderState; builderApi.render();
    $('#builderFen').value=builderFen();
  }

  function builderCellHandler(){
    const host=$('#builderBoard');
    if(!host||host.__finalBound) return;
    host.__finalBound=true;
    host.addEventListener('click',e=>{
      const cell=e.target.closest('.sqr'); if(!cell) return;
      const sq=+cell.dataset.sq;
      if(builderPiece==='erase'){placeBuilderPiece(sq,0);return;}
      const pmap={wK:6,wQ:5,wR:4,wB:3,wN:2,wP:1,bK:14,bQ:13,bR:12,bB:11,bN:10,bP:9};
      placeBuilderPiece(sq,pmap[builderPiece]);
    });
  }

  function ensureBuilderState(){
    if(!builderState) builderState=createEmptyBuilder();
    if(!builderApi){ builderApi=makeBoard($('#builderBoard'),{onMove(){}}); builderApi.interactive=false; builderApi.canMove=()=>false; }
    builderApi.state=builderState; builderApi.selected=-1; builderApi.lastMove=null; builderApi.flipped=false; builderApi.render();
    builderCellHandler();
    $('#builderFen').value=builderFen();
  }

  function validateBuilder(){
    try{
      const fen=$('#builderFen').value.trim();
      const st=E.create(fen);
      if(st.kings[E.WHITE]<0||st.kings[E.BLACK]<0) throw new Error(tx('Нужны оба короля.','Both kings are required.'));
      const sol=$('#builderSolution').value.trim();
      if(sol&&!E.findMove(st,sol)) throw new Error(tx('Такого хода нет в позиции.','That move does not exist in the position.'));
      return {ok:true,st};
    }catch(e){return {ok:false,error:e.message||String(e)}}
  }

  function builderTasks(){
    try{return JSON.parse(localStorage.getItem(BUILDER_KEY)||'[]')}catch(_){return []}
  }
  function saveBuilderTask(){
    const check=validateBuilder();
    const msg=$('#builderMsg');
    if(!check.ok){msg.textContent=check.error;msg.className='gameinfo verdict no';return;}
    const tasks=builderTasks();
    const task={
      id:'custom-'+Date.now(),
      title:$('#builderTitle').value.trim()||tx('Моя задача','My puzzle'),
      category:$('#builderCategory').value,
      difficulty:$('#builderDifficulty').value,
      fen:$('#builderFen').value.trim(),
      solutions:$('#builderSolution').value.split(',').map(x=>x.trim()).filter(Boolean),
      idea:$('#builderIdea').value.trim(),
      createdAt:new Date().toISOString()
    };
    tasks.unshift(task); localStorage.setItem(BUILDER_KEY,JSON.stringify(tasks));
    msg.textContent=tx('Задача сохранена.','Puzzle saved.');msg.className='gameinfo verdict ok';
    renderBuilderSaved();
  }

  function renderBuilderSaved(){
    const list=$('#builderSaved'); if(!list)return;
    const tasks=builderTasks();
    list.innerHTML=tasks.length?tasks.map(t=>`<div class="final-builder-task"><div class="final-builder-task-main"><div class="final-builder-task-title">${escapeHtml(t.title)}</div><div class="final-builder-task-meta">${escapeHtml(t.category)} · ${escapeHtml(t.difficulty)}</div></div><button type="button" class="btn ghost small" data-load-custom="${escapeHtml(t.id)}">${tx('Открыть','Open')}</button><button type="button" class="btn ghost small" data-delete-custom="${escapeHtml(t.id)}">×</button></div>`).join(''):'<div class="lead" style="font-size:11px">'+tx('Сохранённых задач пока нет.','No saved tasks yet.')+'</div>';
    list.querySelectorAll('[data-load-custom]').forEach(b=>b.addEventListener('click',()=>{
      const t=tasks.find(x=>x.id===b.dataset.loadCustom); if(!t)return;
      try{builderState=E.create(t.fen);ensureBuilderState();$('#builderTitle').value=t.title;$('#builderCategory').value=t.category;$('#builderDifficulty').value=t.difficulty;$('#builderSolution').value=(t.solutions||[]).join(', ');$('#builderIdea').value=t.idea||'';}catch(_){ }
    }));
    list.querySelectorAll('[data-delete-custom]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem(BUILDER_KEY,JSON.stringify(tasks.filter(x=>x.id!==b.dataset.deleteCustom)));renderBuilderSaved();}));
  }

  function escapeHtml(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

  function renderBuilder(){
    const sec=$('#tab-builder'); if(!sec)return;
    sec.classList.add('active');
    sec.innerHTML=`
      <div class="final-builder">
        <div class="final-builder-board"><div class="eyebrow">${tx('Позиция','Position')}</div><div id="builderBoard" class="board" style="margin-top:8px"></div></div>
        <div class="final-builder-panel">
          <div class="final-builder-card">
            <div class="final-builder-title">${tx('Расставьте позицию','Build the position')}</div>
            <div class="final-builder-help">${tx('Выберите фигуру и нажимайте на клетки. Выбранная фигура заменяет содержимое клетки.','Choose a piece and click squares. The selected piece replaces the square.')}</div>
            <div class="final-piece-palette">${PIECES.map(([id,g])=>`<button type="button" class="final-piece-btn${builderPiece===id?' active':''}" data-piece="${id}">${g}</button>`).join('')}<button type="button" class="final-piece-btn${builderPiece==='erase'?' active':''}" data-piece="erase">×</button></div>
            <div class="final-builder-actions"><button type="button" class="btn ghost small" id="builderClear">${tx('Очистить','Clear')}</button><button type="button" class="btn ghost small" id="builderSide">${tx('Ход белых','White to move')}</button></div>
          </div>
          <div class="final-builder-card"><div class="final-builder-fields"><div class="field"><label>${tx('Название','Title')}</label><input id="builderTitle" placeholder="${tx('Мат в два хода','Mate in two')}"></div><div class="row"><div class="field"><label>${tx('Категория','Category')}</label><select id="builderCategory"><option>mate1</option><option>mate2</option><option>fork</option><option>pin</option><option>skewer</option><option>discovered</option><option>defence</option><option>endgame</option><option>opening</option><option>general</option></select></div><div class="field"><label>${tx('Сложность','Difficulty')}</label><select id="builderDifficulty"><option>easy</option><option>medium</option><option>hard</option></select></div></div><div class="field"><label>FEN</label><input id="builderFen" style="font-family:'JetBrains Mono',monospace;font-size:11px"></div><div class="field"><label>${tx('Решение SAN','Solution SAN')}</label><input id="builderSolution" placeholder="Re8#"></div><div class="field"><label>${tx('Идея / объяснение','Idea / explanation')}</label><textarea id="builderIdea" rows="3"></textarea></div></div><div id="builderMsg" class="gameinfo" style="margin-top:9px"></div><button type="button" class="btn chess full" id="builderSave">${tx('Сохранить задачу','Save puzzle')}</button></div>
          <div class="final-builder-card"><div class="final-builder-title">${tx('Мои задачи','My puzzles')}</div><div id="builderSaved" class="final-builder-list"></div></div>
        </div>
      </div>`;
    ensureBuilderState();
    sec.querySelectorAll('[data-piece]').forEach(b=>b.addEventListener('click',()=>{builderPiece=b.dataset.piece;renderBuilder();}));
    $('#builderClear').addEventListener('click',()=>{builderState=createEmptyBuilder();renderBuilder();});
    $('#builderSide').addEventListener('click',()=>{builderState.turn=builderState.turn===E.WHITE?E.BLACK:E.WHITE;ensureBuilderState();$('#builderSide').textContent=builderState.turn===E.WHITE?tx('Ход белых','White to move'):tx('Ход чёрных','Black to move');});
    $('#builderSave').addEventListener('click',saveBuilderTask);
    renderBuilderSaved();
    $('#builderSide').textContent=builderState.turn===E.WHITE?tx('Ход белых','White to move'):tx('Ход чёрных','Black to move');
  }

  function init(){
    addStyles();
    ensureTabs();
    forceInitialPuzzle();
    setTimeout(()=>{
      injectCoachButton(); injectReviewToggle(); fixNewGame();
      const game=$('#tab-game'); if(game&&game.classList.contains('hidden')===false) game.classList.remove('game-no-coach');
    },100);
    document.addEventListener('langchange',()=>setTimeout(()=>{ensureTabs();injectCoachButton();injectReviewToggle();},0));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
