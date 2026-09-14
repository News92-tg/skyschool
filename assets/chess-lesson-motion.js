/* SkyySchool — interactive lesson board for piece movement.
   Dedicated to lesson l01. It does not touch the game engine or puzzle board. */
'use strict';
(function(){
  const PIECES={
    pawn:{glyph:'♙',name:'Пешка',square:'d4',path:['d4','d5','d6']},
    knight:{glyph:'♘',name:'Конь',square:'d4',path:['d4','f5','e7','c6','b5','b3','c2','e3','f4']},
    bishop:{glyph:'♗',name:'Слон',square:'d4',path:['d4','e5','f6','g7','h8']},
    rook:{glyph:'♖',name:'Ладья',square:'d4',path:['d4','d8']},
    queen:{glyph:'♕',name:'Ферзь',square:'d4',path:['d4','h8']},
    king:{glyph:'♔',name:'Король',square:'d4',path:['d4','e5','e4','c3','d3','e3','c4','c5','d5']}
  };
  const files='abcdefgh';
  const $=(s,r=document)=>r.querySelector(s);

  function squareIndex(sq){
    const f=files.indexOf(sq[0]), r=Number(sq[1]);
    return (8-r)*8+f;
  }

  function makeBoard(){
    const board=document.createElement('div');
    board.className='lesson-motion-board';
    for(let r=8;r>=1;r--){
      for(let f=0;f<8;f++){
        const c=document.createElement('div');
        c.className='lesson-motion-cell '+(((f+r)&1)?'light':'dark');
        c.dataset.square=files[f]+r;
        board.appendChild(c);
      }
    }
    return board;
  }

  function putPiece(board,key,sq){
    board.querySelectorAll('.lesson-motion-piece').forEach(x=>x.remove());
    const cell=board.querySelector('[data-square="'+sq+'"]');
    if(!cell)return;
    const p=document.createElement('div');
    p.className='lesson-motion-piece';
    p.textContent=PIECES[key].glyph;
    p.dataset.square=sq;
    cell.appendChild(p);
  }

  function movePiece(board,key,from,to,duration=340){
    const piece=board.querySelector('.lesson-motion-piece');
    const fromCell=board.querySelector('[data-square="'+from+'"]');
    const toCell=board.querySelector('[data-square="'+to+'"]');
    if(!piece||!fromCell||!toCell)return;
    const a=fromCell.getBoundingClientRect(), b=toCell.getBoundingClientRect(), root=board.getBoundingClientRect();
    piece.style.position='absolute';
    piece.style.left=(a.left-root.left+a.width/2)+'px';
    piece.style.top=(a.top-root.top+a.height/2)+'px';
    piece.style.transition='transform '+duration+'ms cubic-bezier(.2,.8,.2,1)';
    const dx=(b.left-a.left), dy=(b.top-a.top);
    requestAnimationFrame(()=>{piece.style.transform='translate('+dx+'px,'+dy+'px)';});
    setTimeout(()=>{piece.style.transition='none'; piece.style.transform='none'; putPiece(board,key,to);},duration+25);
  }

  function pathFor(key){
    return PIECES[key].path;
  }

  function mount(host,lesson){
    if(!host || host.dataset.motionReady==='1')return;
    host.dataset.motionReady='1';
    host.replaceChildren();

    const wrap=document.createElement('div');
    wrap.className='lesson-motion-wrap';

    const controls=document.createElement('div');
    controls.className='lesson-motion-controls';

    const board=makeBoard();
    wrap.appendChild(controls);
    wrap.appendChild(board);

    const info=document.createElement('div');
    info.className='lesson-motion-info';
    wrap.appendChild(info);

    let current='pawn', timer=null, running=false;

    function renderInfo(){
      info.textContent=PIECES[current].name+' · нажмите «Показать движение»';
    }
    function reset(){
      clearTimeout(timer); running=false;
      board.classList.remove('is-moving');
      putPiece(board,current,PIECES[current].square);
      board.querySelectorAll('.lesson-motion-cell.active,.lesson-motion-cell.from,.lesson-motion-cell.to').forEach(c=>c.classList.remove('active','from','to'));
      renderInfo();
    }
    function demo(){
      clearTimeout(timer); running=true;
      const path=pathFor(current);
      let i=0;
      board.querySelectorAll('.lesson-motion-cell').forEach(c=>c.classList.remove('active','from','to'));
      const step=()=>{
        if(i>=path.length-1){
          running=false;
          timer=setTimeout(reset,900);
          return;
        }
        const from=path[i], to=path[i+1];
        board.querySelectorAll('.lesson-motion-cell').forEach(c=>c.classList.remove('active','from','to'));
        board.querySelector('[data-square="'+from+'"]')?.classList.add('from');
        board.querySelector('[data-square="'+to+'"]')?.classList.add('to');
        movePiece(board,current,from,to,360);
        i++;
        timer=setTimeout(step,410);
      };
      putPiece(board,current,path[0]);
      info.textContent=PIECES[current].name+' · смотрите траекторию';
      step();
    }

    Object.entries(PIECES).forEach(([key,val])=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='lesson-motion-piece-btn';
      b.innerHTML='<span>'+val.glyph+'</span><em>'+val.name+'</em>';
      b.addEventListener('click',()=>{
        current=key;
        controls.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        reset();
      });
      controls.appendChild(b);
    });

    const actions=document.createElement('div');
    actions.className='lesson-motion-actions';
    const play=document.createElement('button');
    play.type='button'; play.className='btn chess small'; play.textContent='▶ Показать движение';
    play.addEventListener('click',demo);
    const again=document.createElement('button');
    again.type='button'; again.className='btn ghost small'; again.textContent='↺ Сначала';
    again.addEventListener('click',reset);
    actions.append(play,again);
    wrap.appendChild(actions);

    host.appendChild(wrap);
    controls.querySelector('button')?.classList.add('active');
    reset();
  }

  function installStyles(){
    if($('#lesson-motion-styles'))return;
    const s=document.createElement('style');
    s.id='lesson-motion-styles';
    s.textContent=`
      #tab-lessons .lesson-motion-wrap{display:grid;gap:12px}
      #tab-lessons .lesson-motion-controls{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}
      #tab-lessons .lesson-motion-piece-btn{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;padding:7px 5px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font:700 10px Nunito,sans-serif;color:var(--ink-2);cursor:pointer}
      #tab-lessons .lesson-motion-piece-btn span{font:22px "DejaVu Sans","Segoe UI Symbol",serif;line-height:1}
      #tab-lessons .lesson-motion-piece-btn em{font-style:normal}
      #tab-lessons .lesson-motion-piece-btn:hover{transform:translateY(-1px)}
      #tab-lessons .lesson-motion-piece-btn.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess);box-shadow:0 4px 12px rgba(112,82,220,.12)}
      #tab-lessons .lesson-motion-board{width:min(340px,100%);aspect-ratio:1/1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);position:relative;border-radius:13px;overflow:hidden;border:1px solid var(--line-2);box-shadow:var(--shadow-sm);margin:0 auto}
      #tab-lessons .lesson-motion-cell{position:relative;display:grid;place-items:center}
      #tab-lessons .lesson-motion-cell.light{background:var(--board-light)}
      #tab-lessons .lesson-motion-cell.dark{background:var(--board-dark)}
      #tab-lessons .lesson-motion-cell.from{box-shadow:inset 0 0 0 3px rgba(126,91,255,.45)}
      #tab-lessons .lesson-motion-cell.to{box-shadow:inset 0 0 0 4px rgba(126,91,255,.8)}
      #tab-lessons .lesson-motion-piece{position:absolute;z-index:3;transform:translate(-50%,-50%);font:44px/1 "DejaVu Sans","Segoe UI Symbol",serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.65),0 0 2px rgba(0,0,0,.55);pointer-events:none;will-change:transform}
      #tab-lessons .lesson-motion-info{text-align:center;font-size:11px;font-weight:800;color:var(--muted)}
      #tab-lessons .lesson-motion-actions{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}
      @media(max-width:560px){
        #tab-lessons .lesson-motion-controls{grid-template-columns:repeat(3,minmax(0,1fr))}
        #tab-lessons .lesson-motion-piece-btn em{font-size:9px}
        #tab-lessons .lesson-motion-piece{font-size:36px}
      }
    `;
    document.head.appendChild(s);
  }

  function patch(){
    installStyles();
    const host=document.getElementById('lessonList');
    if(!host)return;
    const cards=[...host.querySelectorAll('.lesson-modern,.lesson')];
    cards.forEach((card,index)=>{
      if(index!==0 && card.dataset.lessonId!=='l01')return;
      const demo=card.querySelector('.lesson-demo-board,.board');
      if(demo && !demo.closest('.lesson-motion-wrap')) mount(demo,window.CHESS_LESSONS?.find(x=>x.id==='l01')||{});
    });
  }

  function init(){
    patch();
    const host=document.getElementById('lessonList');
    if(host && !host.__lessonMotionObserver){
      const obs=new MutationObserver(()=>setTimeout(patch,0));
      obs.observe(host,{childList:true,subtree:true});
      host.__lessonMotionObserver=obs;
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
})();
