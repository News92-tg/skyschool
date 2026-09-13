/* Иллюстрация трёх исходов для урока «Цель игры и три исхода». */
'use strict';
(function(){
  const E=window.ChessEngine;
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;
  const DATA={
    mate:{
      label:['Мат','Checkmate'],
      fen:'6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1',
      move:'Re8#',
      note:['Король под шахом — и ни одного безопасного выхода.','The king is in check and has no legal escape.']
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
      if(p){ cell.textContent=glyph[p&7]; cell.classList.add((p&8)?'black-piece':'white-piece'); }
      board.appendChild(cell);
    }
    host.appendChild(board);
  }

  function render(card){
    if(!card||card.dataset.outcomesReady==='1')return;
    if(!card.querySelector('.lesson-modern-title')?.textContent.includes('Цель игры'))return;
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
        <div class="lesson-demo-title">${tx('На доске','On the board')}</div>
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
      const st=E.create(d.fen);
      const result=E.status(st);
      let actual=key==='mate'?'checkmate':key==='stale'?'stalemate':result;
      status.className='outcome-status '+(key==='mate'?'is-mate':key==='check'?'is-check':'is-stale');
      status.innerHTML=`<b>${tx(d.label[0],d.label[1])}</b><span>${tx(
        key==='mate'?'Шах есть, ответа нет':key==='check'?'Шах есть, но выход есть':'Шаха нет и ходить нечем',
        key==='mate'?'Check, but no reply':key==='check'?'Check, but there is an escape':'No check and no legal move'
      )}</span>`;
      note.textContent=tx(d.note[0],d.note[1]);
      card.querySelector('.lesson-tip')?.remove();
    }

    demo.querySelectorAll('.outcome-tab').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.outcome)));
    activate('mate');
  }

  function scan(){
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
  document.addEventListener('langchange',()=>setTimeout(init,0));
})();
