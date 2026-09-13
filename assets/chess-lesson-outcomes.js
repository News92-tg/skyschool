/* Иллюстрация трёх исходов для урока «Цель игры и три исхода». */
'use strict';
(function(){
  const E=window.ChessEngine;
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;
  const DATA={
    mate:{
      label:['Мат','Checkmate'],
      fen:'4R1k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1',
      note:['Король под шахом, и ни одного безопасного выхода — партия окончена.','The king is in check with no safe escape — the game is over.']
    },
    check:{
      label:['Шах','Check'],
      fen:'4k3/8/8/8/8/8/4R3/6K1 b - - 0 1',
      note:['Король под боем, но может уйти на свободное поле.','The king is attacked but has a legal escape.']
    },
    stale:{
      label:['Пат','Stalemate'],
      fen:'7k/5K2/6Q1/8/8/8/8/8 b - - 0 1',
      note:['Ходов нет, но король не под шахом — это ничья.','There is no legal move, but the king is not in check — a draw.']
    }
  };

  function addStyles(){
    if(document.getElementById('chess-outcome-styles'))return;
    const s=document.createElement('style');
    s.id='chess-outcome-styles';
    s.textContent=`
      #lessonList .outcome-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px}
      #lessonList .outcome-tab{min-width:0;padding:7px 6px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--muted);font-size:10px;font-weight:900;cursor:pointer}
      #lessonList .outcome-tab:hover{border-color:var(--line-2)}
      #lessonList .outcome-tab.is-active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      #lessonList .outcome-view{padding-top:1px}
      #lessonList .outcome-board{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));width:min(100%,220px);aspect-ratio:1;margin:0 auto;overflow:hidden;border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow-sm)}
      #lessonList .outcome-board .sqr{aspect-ratio:1;min-width:0}
      #lessonList .outcome-board .piece{font-size:clamp(20px,4vw,30px)}
      #lessonList .outcome-status{display:flex;align-items:center;gap:6px;margin-top:8px;padding:7px 8px;border-radius:9px;font-size:9.5px;line-height:1.35}
      #lessonList .outcome-status b{font-weight:900;white-space:nowrap}
      #lessonList .outcome-status.is-mate{background:var(--no-soft);color:var(--no)}
      #lessonList .outcome-status.is-check{background:var(--warn-soft);color:var(--warn)}
      #lessonList .outcome-status.is-stale{background:var(--panel-2);color:var(--muted)}
      #lessonList .outcome-note{margin-top:7px;color:var(--muted);font-size:9.5px;line-height:1.45}
      .outcome-board-fallback{display:grid;grid-template-columns:repeat(8,1fr);aspect-ratio:1}
      .outcome-board-fallback>div{display:grid;place-items:center;font-family:serif;font-size:24px}
      .outcome-board-fallback .light{background:var(--board-light)}
      .outcome-board-fallback .dark{background:var(--board-dark)}
      .outcome-board-fallback .white-piece{color:var(--panel);text-shadow:0 1px 2px var(--ink)}
      .outcome-board-fallback .black-piece{color:var(--ink)}
      @media(max-width:560px){
        #lessonList .outcome-board{width:min(100%,260px)}
        #lessonList .outcome-tabs{gap:5px}
      }
    `;
    document.head.appendChild(s);
  }

  function makeBoard(host,fen){
    if(!host||!E)return;
    host.innerHTML='';
    const api=typeof window.makeBoard==='function'
      ? window.makeBoard(host,{onMove(){}})
      : null;
    if(api){
      api.interactive=false;
      api.canMove=()=>false;
      api.state=E.create(fen);
      api.selected=-1;
      api.lastMove=null;
      api.flipped=api.state.turn===E.BLACK;
      api.render();
      return;
    }
    const st=E.create(fen),glyph={1:'♟',2:'♞',3:'♝',4:'♜',5:'♛',6:'♚'};
    const board=document.createElement('div');
    board.className='outcome-board-fallback';
    for(let rank=7;rank>=0;rank--) for(let file=0;file<8;file++){
      const cell=document.createElement('div');
      cell.className=((file+rank)%2?'light':'dark');
      const p=st.board[E.sq(file,rank)];
      if(p){cell.textContent=glyph[p&7];cell.classList.add((p&8)?'black-piece':'white-piece');}
      board.appendChild(cell);
    }
    host.appendChild(board);
  }

  function render(card){
    if(!card||card.dataset.outcomesReady==='1')return;
    const title=card.querySelector('.lesson-modern-title')?.textContent||'';
    if(!title.includes('Цель игры')&&!title.includes('goal')&&!title.includes('Goal'))return;
    const demo=card.querySelector('.lesson-demo');
    if(!demo)return;
    card.dataset.outcomesReady='1';
    demo.innerHTML=`
      <div class="outcome-tabs" role="tablist" aria-label="${tx('Три исхода','Three outcomes')}">
        <button type="button" class="outcome-tab is-active" data-outcome="mate" role="tab" aria-selected="true">${tx(DATA.mate.label[0],DATA.mate.label[1])}</button>
        <button type="button" class="outcome-tab" data-outcome="check" role="tab" aria-selected="false">${tx(DATA.check.label[0],DATA.check.label[1])}</button>
        <button type="button" class="outcome-tab" data-outcome="stale" role="tab" aria-selected="false">${tx(DATA.stale.label[0],DATA.stale.label[1])}</button>
      </div>
      <div class="outcome-view">
        <div class="lesson-demo-title">${tx('Позиция','Position')}</div>
        <div class="outcome-board"></div>
        <div class="outcome-status"></div>
        <div class="outcome-note"></div>
      </div>`;

    const boardHost=demo.querySelector('.outcome-board');
    const status=demo.querySelector('.outcome-status');
    const note=demo.querySelector('.outcome-note');

    function activate(key){
      const d=DATA[key];
      demo.querySelectorAll('.outcome-tab').forEach(b=>{
        const active=b.dataset.outcome===key;
        b.classList.toggle('is-active',active);
        b.setAttribute('aria-selected',String(active));
      });
      makeBoard(boardHost,d.fen);
      status.className='outcome-status '+(key==='mate'?'is-mate':key==='check'?'is-check':'is-stale');
      const line=key==='mate'
        ? ['Шах есть, ответа нет','Check, but no reply']
        : key==='check'
          ? ['Шах есть, но выход есть','Check, but there is an escape']
          : ['Шаха нет и ходить нечем','No check and no legal move'];
      status.innerHTML=`<b>${tx(d.label[0],d.label[1])}</b><span>${tx(line[0],line[1])}</span>`;
      note.textContent=tx(d.note[0],d.note[1]);
    }

    demo.querySelectorAll('.outcome-tab').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.outcome)));
    activate('mate');
  }

  function scan(){
    addStyles();
    document.querySelectorAll('#lessonList .lesson-modern').forEach(render);
  }

  function init(){
    scan();
    const host=document.querySelector('#lessonList');
    if(host&&!host.__outcomeObserver){
      new MutationObserver(scan).observe(host,{childList:true,subtree:true});
      host.__outcomeObserver=true;
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100),{once:true});
  else setTimeout(init,100);
  document.addEventListener('langchange',()=>setTimeout(scan,0));
})();
