/* SkyySchool — universal interactive chess lessons.
   Every lesson gets a real board, a replayable move sequence, step controls,
   coordinates, goal/tip cards and deterministic animation driven by the chess engine. */
'use strict';
(function(){
  const FILES='abcdefgh';
  const GLYPH={1:'♟',2:'♞',3:'♝',4:'♜',5:'♛',6:'♚'};
  const PIECE_NAME={1:'Пешка',2:'Конь',3:'Слон',4:'Ладья',5:'Ферзь',6:'Король'};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];

  const PHASES={
    l01:{ru:'Основа',en:'Basics',tone:'board'},
    l02:{ru:'Основа',en:'Basics',tone:'movement'},
    l03:{ru:'Основа',en:'Basics',tone:'capture'},
    l04:{ru:'Основа',en:'Basics',tone:'mate'},
    l05:{ru:'Основа',en:'Basics',tone:'castle'},
    l06:{ru:'Основа',en:'Basics',tone:'promotion'},
    l07:{ru:'Тактика',en:'Tactics',tone:'fork'},
    l08:{ru:'Тактика',en:'Tactics',tone:'pin'},
    l09:{ru:'Тактика',en:'Tactics',tone:'discovered'},
    l10:{ru:'Тактика',en:'Tactics',tone:'mate'},
    l11:{ru:'Дебют',en:'Opening',tone:'opening'},
    l12:{ru:'Дебют',en:'Opening',tone:'centre'},
    l13:{ru:'Расчёт',en:'Calculation',tone:'calculation'},
    l14:{ru:'Эндшпиль',en:'Endgame',tone:'endgame'},
    l15:{ru:'Эндшпиль',en:'Endgame',tone:'rook'},
    l16:{ru:'Практика',en:'Practice',tone:'mistakes'}
  };

  function escapeHtml(v){
    return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  }
  function localized(v){
    if(typeof window.Sky?.L==='function') return window.Sky.L(v);
    return typeof v==='string'?v:(v?.ru||v?.en||'');
  }
  function textWithBreaks(v){return escapeHtml(localized(v)).replace(/\n/g,'<br>');}

  function boardSquares(){
    const out=[];
    for(let rank=8;rank>=1;rank--) for(let file=0;file<8;file++) out.push(FILES[file]+rank);
    return out;
  }

  function snapshot(st){return E.clone(st);}

  function parseLesson(lesson){
    const start=E.create(lesson.fen||E.START_FEN);
    const states=[snapshot(start)];
    const moves=[];
    let cursor=start;
    for(const notation of (lesson.moves||[])){
      const move=E.findMove(cursor,notation);
      if(!move) break;
      const san=E.toSAN(cursor,move);
      const before=snapshot(cursor);
      E.make(cursor,move);
      const after=snapshot(cursor);
      moves.push({notation,san,move:Object.assign({},move),before,after});
      states.push(after);
    }
    return {states,moves};
  }

  function squareColor(file,rank){return ((file+rank)&1)?'light':'dark';}
  function createBoard(){
    const board=document.createElement('div');
    board.className='sli-board';
    for(let rank=8;rank>=1;rank--){
      for(let file=0;file<8;file++){
        const cell=document.createElement('div');
        cell.className='sli-cell '+squareColor(file,rank);
        cell.dataset.square=FILES[file]+rank;
        const fEdge=file===0, rEdge=rank===1;
        if(fEdge){const x=document.createElement('span');x.className='sli-rank';x.textContent=rank;x.setAttribute('aria-hidden','true');cell.appendChild(x);}
        if(rEdge){const x=document.createElement('span');x.className='sli-file';x.textContent=FILES[file];x.setAttribute('aria-hidden','true');cell.appendChild(x);}
        board.appendChild(cell);
      }
    }
    return board;
  }

  function boardPiece(st,sq){
    const s=E.fromAlg(sq); return s>=0?st.board[s]:0;
  }

  function renderStatic(board,st,move,step){
    $$('.sli-piece,.sli-last,.sli-target,.sli-check,.sli-arrow',board).forEach(x=>x.remove());
    const from=move?.from>=0?E.toAlg(move.from):null;
    const to=move?.to>=0?E.toAlg(move.to):null;
    if(from) board.querySelector(`[data-square="${from}"]`)?.classList.add('sli-last');
    if(to) board.querySelector(`[data-square="${to}"]`)?.classList.add('sli-target');
    if(E.inCheck(st)) board.querySelector(`[data-square="${E.toAlg(st.kings[st.turn])}"]`)?.classList.add('sli-check');
    for(let rank=8;rank>=1;rank--) for(let file=0;file<8;file++){
      const sq=FILES[file]+rank, cell=board.querySelector(`[data-square="${sq}"]`),p=boardPiece(st,sq);
      if(!cell||!p) continue;
      const piece=document.createElement('span');
      piece.className='sli-piece '+((p&8)?'black':'white');
      piece.textContent=GLYPH[p&7];
      piece.dataset.square=sq;
      cell.appendChild(piece);
    }
    if(move){
      const target=board.querySelector(`[data-square="${to}"]`);
      if(target){const dot=document.createElement('span');dot.className='sli-target-dot';target.appendChild(dot);}
    }
  }

  function cellCenter(board,sq){
    const cell=board.querySelector(`[data-square="${sq}"]`); if(!cell) return null;
    const br=board.getBoundingClientRect(), cr=cell.getBoundingClientRect();
    return {x:cr.left-br.left+cr.width/2,y:cr.top-br.top+cr.height/2,w:cr.width,h:cr.height};
  }

  function animateLinear(board,piece,from,to,duration=300,done){
    const a=cellCenter(board,from),b=cellCenter(board,to);
    if(!a||!b||!piece){done?.();return ()=>{};}
    let raf=0,start=null,stopped=false;
    const cancel=()=>{stopped=true;cancelAnimationFrame(raf);};
    piece.style.transition='none';
    piece.style.left=a.x+'px'; piece.style.top=a.y+'px'; piece.style.transform='translate(-50%,-50%)';
    const ease=t=>1-Math.pow(1-t,3);
    const tick=now=>{
      if(stopped)return;
      if(start===null) start=now;
      const t=Math.min(1,(now-start)/duration),e=ease(t);
      piece.style.left=(a.x+(b.x-a.x)*e)+'px'; piece.style.top=(a.y+(b.y-a.y)*e)+'px';
      if(t<1) raf=requestAnimationFrame(tick); else {piece.style.left=b.x+'px';piece.style.top=b.y+'px';done?.();}
    };
    raf=requestAnimationFrame(tick);
    return cancel;
  }

  function knightWay(from,to){
    const a={file:E.fileOf(from),rank:E.rankOf(from)},b={file:E.fileOf(to),rank:E.rankOf(to)};
    const dx=b.file-a.file,dy=b.rank-a.rank;
    if(Math.abs(dx)===2&&Math.abs(dy)===1) return [FILES[a.file+(dx>0?2:-2)]+(a.rank+1), E.toAlg(to)];
    if(Math.abs(dx)===1&&Math.abs(dy)===2) return [FILES[a.file]+(a.rank+(dy>0?3:-1)), E.toAlg(to)];
    return [E.toAlg(to)];
  }

  function animationSegments(st,move){
    const from=E.toAlg(move.from),to=E.toAlg(move.to),type=move.piece&7;
    if(type===E.KNIGHT) return knightWay(move.from,move.to);
    return [to];
  }

  function animateMove(board,info){
    const {move,before,after}=info;
    const from=E.toAlg(move.from),to=E.toAlg(move.to),type=move.piece&7;
    const fromCell=board.querySelector(`[data-square="${from}"]`);
    const piece=fromCell?.querySelector('.sli-piece');
    if(!fromCell||!piece){renderStatic(board,after,move);return Promise.resolve();}

    $$('.sli-arrow,.sli-flying',board).forEach(x=>x.remove());
    const fromRect=fromCell.getBoundingClientRect();
    const victimSq=String(move.flags||'').includes('e')?(move.piece&8?to+'?':''):to;
    const victim=move.captured?board.querySelector(`[data-square="${victimSq}"] .sli-piece`):null;
    if(victim && victim!==piece) victim.classList.add('sli-taken');

    piece.classList.add('sli-flying');
    const originalParent=piece.parentElement;
    board.appendChild(piece);
    piece.style.position='absolute';
    const cr=fromCell.getBoundingClientRect(), br=board.getBoundingClientRect();
    piece.style.left=(cr.left-br.left+cr.width/2)+'px';piece.style.top=(cr.top-br.top+cr.height/2)+'px';
    piece.style.transform='translate(-50%,-50%)';

    const segments=animationSegments(before,move);
    let current=from, index=0, cancel=null;
    return new Promise(resolve=>{
      const next=()=>{
        if(index>=segments.length){
          if(type===E.KING&&(Math.abs(move.to-move.from)===2)){
            const rookFrom=move.to>move.from?'h1':'a1';
            const rookTo=move.to>move.from?'f1':'d1';
            if(move.piece&8){
              // black castling coordinates are handled from rank 8 below
              const rf=move.to>move.from?'h8':'a8',rt=move.to>move.from?'f8':'d8';
              const rook=board.querySelector(`[data-square="${rf}"] .sli-piece`);
              if(rook){animateLinear(board,rook,rf,rt,220,()=>{renderStatic(board,after,move);resolve();});return;}
            } else {
              const rook=board.querySelector(`[data-square="${rookFrom}"] .sli-piece`);
              if(rook){animateLinear(board,rook,rookFrom,rookTo,220,()=>{renderStatic(board,after,move);resolve();});return;}
            }
          }
          renderStatic(board,after,move); resolve(); return;
        }
        const segTo=segments[index++];
        const dur=type===E.KNIGHT?220:330;
        cancel=animateLinear(board,piece,current,segTo,dur,()=>{current=segTo;next();});
      };
      next();
    });
  }

  function statusText(lesson,data,index){
    if(!data.moves.length) return localized(lesson.title);
    if(index===0) return 'Стартовая позиция';
    const step=data.moves[index-1];
    return step.san||step.notation;
  }

  function buildCard(lesson,idx,total){
    const data=parseLesson(lesson);
    const phase=PHASES[lesson.id]||{ru:'Практика',en:'Practice',tone:'practice'};
    const card=document.createElement('article');
    card.className='lesson lesson-system';
    card.dataset.lessonId=lesson.id;
    card.innerHTML=`
      <button type="button" class="lesson-system-head" aria-expanded="false">
        <span class="lesson-system-index">${String(idx+1).padStart(2,'0')}</span>
        <span class="lesson-system-title"><strong></strong><small>${escapeHtml(phase.ru)} · ${escapeHtml(phase.en)}</small></span>
        <span class="lesson-system-status">${data.moves.length?data.moves.length+' '+(data.moves.length===1?'ход':'хода'):''}</span>
        <span class="arrow">›</span>
      </button>
      <div class="lesson-system-body hidden">
        <div class="lesson-system-main">
          <div class="lesson-copy">
            <div class="lesson-kicker"></div>
            <h3></h3>
            <p class="lesson-goal"></p>
            <div class="lesson-description"></div>
            <div class="lesson-tip"><span>💡</span><div><b>Совет</b><p></p></div></div>
          </div>
          <div class="lesson-interactive">
            <div class="lesson-interactive-top"><div><span class="lesson-demo-badge">ИНТЕРАКТИВНЫЙ РАЗБОР</span><strong class="lesson-demo-title"></strong></div><span class="lesson-step"></span></div>
            <div class="lesson-board-host"></div>
            <div class="lesson-move-caption"><span class="lesson-move-label"></span><span class="lesson-move-san"></span></div>
            <div class="lesson-controls"><button type="button" data-act="prev">← Назад</button><button type="button" data-act="play" class="primary">▶ Показать ход</button><button type="button" data-act="next">Дальше →</button><button type="button" data-act="reset" class="ghost">↺ Сначала</button><label class="auto"><input type="checkbox" data-act="auto"> Автоповтор</label></div>
            <div class="lesson-move-list"></div>
          </div>
        </div>
      </div>`;

    $('.lesson-system-title strong',card).textContent=localized(lesson.title);
    $('.lesson-kicker',card).textContent=localized(lesson.level)||localized(phase);
    $('.lesson-demo-title',card).textContent=localized(lesson.title);
    $('.lesson-goal',card).textContent=localized(lesson.goal);
    $('.lesson-description',card).innerHTML=textWithBreaks(lesson.body);
    $('.lesson-tip p',card).textContent=localized(lesson.tip);

    const board=createBoard(); $('.lesson-board-host',card).appendChild(board);
    let index=0,playing=false,timer=0,animationToken=0;

    function render(){
      const st=data.states[index]||data.states[0];
      const move=index>0?data.moves[index-1]?.move:null;
      renderStatic(board,st,move,index);
      $('.lesson-step',card).textContent=`Шаг ${index}/${data.moves.length}`;
      const current=data.moves[index-1];
      $('.lesson-move-label',card).textContent=index===0?'Подготовка позиции':'Ход '+index;
      $('.lesson-move-san',card).textContent=index===0?'Готовьтесь':(current?.san||'');
      $('.lesson-system-status',card).textContent=data.moves.length?`${index}/${data.moves.length}`:'';
      $$('.lesson-move-item',card).forEach(x=>x.classList.remove('active'));
      $('.lesson-move-item[data-index="'+index+'"]',card)?.classList.add('active');
      $('.lesson-system-head',card).setAttribute('aria-expanded',String(!$('.lesson-system-body',card).classList.contains('hidden')));
    }
    function stop(){playing=false;clearTimeout(timer);animationToken++;}
    async function goTo(target,animate=true){
      stop();target=Math.max(0,Math.min(data.moves.length,target));
      if(!animate){index=target;render();return;}
      if(target===index){return;}
      const token=++animationToken;
      while(index<target){
        const step=data.moves[index];
        if(!step){index=target;break;}
        if(token!==animationToken)return;
        await animateMove(board,step);
        if(token!==animationToken)return;
        index++;
        render();
      }
    }
    function playNext(){
      if(playing)return;
      if(index>=data.moves.length) index=0;
      playing=true;
      const token=++animationToken;
      const run=()=>{
        if(token!==animationToken){playing=false;return;}
        if(index>=data.moves.length){playing=false;return;}
        const step=data.moves[index];
        animateMove(board,step).then(()=>{
          if(token!==animationToken){playing=false;return;}
          index++;render();timer=setTimeout(run,420);
        });
      };
      run();
    }
    function buildMoveList(){
      const host=$('.lesson-move-list',card);host.innerHTML='';
      const start=document.createElement('button');start.type='button';start.className='lesson-move-item';start.dataset.index='0';start.textContent='Старт';host.appendChild(start);
      data.moves.forEach((m,i)=>{const b=document.createElement('button');b.type='button';b.className='lesson-move-item';b.dataset.index=String(i+1);b.innerHTML=`<span>${i+1}</span><b>${escapeHtml(m.san)}</b>`;b.addEventListener('click',()=>goTo(i+1,false));host.appendChild(b);});
    }
    buildMoveList(); render();

    $('.lesson-system-head',card).addEventListener('click',()=>{
      const body=$('.lesson-system-body',card); body.classList.toggle('hidden');
      const open=!body.classList.contains('hidden'); $('.lesson-system-head',card).setAttribute('aria-expanded',String(open));
      if(open) requestAnimationFrame(()=>render());
    });
    $('[data-act="prev"]',card).addEventListener('click',()=>goTo(index-1,true));
    $('[data-act="next"]',card).addEventListener('click',()=>goTo(index+1,true));
    $('[data-act="play"]',card).addEventListener('click',playNext);
    $('[data-act="reset"]',card).addEventListener('click',()=>{stop();index=0;render();});
    $('[data-act="auto"]',card).addEventListener('change',e=>{if(e.target.checked) playNext(); else stop();});

    if(!data.moves.length){
      $$('.lesson-controls button',card).forEach(b=>b.disabled=true);
    }
    return card;
  }

  function installStyles(){
    if($('#sli-v1-style'))return;
    const s=document.createElement('style');s.id='sli-v1-style';s.textContent=`
      #tab-lessons #lessonList{display:grid!important;gap:12px!important}
      #tab-lessons .lesson-system{border:1px solid var(--line)!important;border-radius:18px!important;background:var(--panel)!important;overflow:hidden!important;box-shadow:none!important}
      #tab-lessons .lesson-system-head{width:100%!important;display:grid!important;grid-template-columns:38px minmax(0,1fr) auto 22px!important;align-items:center!important;gap:11px!important;min-height:68px!important;padding:11px 14px!important;border:0!important;background:transparent!important;color:var(--ink)!important;text-align:left!important;cursor:pointer!important}
      #tab-lessons .lesson-system-head:hover{background:var(--panel-2)!important}
      #tab-lessons .lesson-system-index{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:var(--m-chess-soft);color:var(--m-chess);font:900 11px/1 Nunito,sans-serif}
      #tab-lessons .lesson-system-title{min-width:0;display:grid;gap:2px}
      #tab-lessons .lesson-system-title strong{font:900 14px/1.25 Nunito,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tab-lessons .lesson-system-title small{font:800 10px/1.2 Nunito,sans-serif;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
      #tab-lessons .lesson-system-status{font:800 10px Nunito,sans-serif;color:var(--muted);white-space:nowrap}
      #tab-lessons .lesson-system-head .arrow{font-size:18px;color:var(--muted);transition:transform .18s}
      #tab-lessons .lesson-system-head[aria-expanded="true"] .arrow{transform:rotate(90deg)}
      #tab-lessons .lesson-system-body{padding:0 14px 14px!important}
      #tab-lessons .lesson-system-main{display:grid;grid-template-columns:minmax(260px,1fr) minmax(390px,440px);gap:18px;align-items:start}
      #tab-lessons .lesson-copy{padding:10px 4px 0;min-width:0}
      #tab-lessons .lesson-kicker{font:900 10px Nunito,sans-serif;color:var(--m-chess);text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
      #tab-lessons .lesson-copy h3{display:none}
      #tab-lessons .lesson-goal{margin:0 0 13px;font:900 17px/1.35 Nunito,sans-serif;color:var(--ink)}
      #tab-lessons .lesson-description{font:500 13px/1.7 Nunito,sans-serif;color:var(--ink-2)}
      #tab-lessons .lesson-tip{display:flex;gap:9px;margin-top:14px;padding:11px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
      #tab-lessons .lesson-tip>span{font-size:17px;line-height:1}
      #tab-lessons .lesson-tip b{font:900 10px Nunito,sans-serif;text-transform:uppercase;color:var(--muted);letter-spacing:.06em}
      #tab-lessons .lesson-tip p{margin:3px 0 0;font:700 11px/1.5 Nunito,sans-serif;color:var(--ink-2)}
      #tab-lessons .lesson-interactive{min-width:0;padding:12px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--panel-2),var(--panel));box-shadow:var(--shadow-sm)}
      #tab-lessons .lesson-interactive-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px}
      #tab-lessons .lesson-interactive-top>div{display:grid;gap:3px;min-width:0}
      #tab-lessons .lesson-demo-badge{font:900 9px Nunito,sans-serif;color:var(--m-chess);text-transform:uppercase;letter-spacing:.08em}
      #tab-lessons .lesson-demo-title{font:900 13px/1.25 Nunito,sans-serif;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px}
      #tab-lessons .lesson-step{font:900 10px Nunito,sans-serif;color:var(--muted);white-space:nowrap;padding-top:2px}
      #tab-lessons .lesson-board-host{width:min(400px,100%);aspect-ratio:1/1;margin:0 auto}
      #tab-lessons .sli-board{position:relative;width:100%;height:100%;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);overflow:hidden;border:1px solid var(--line-2);border-radius:14px;box-shadow:var(--shadow-sm);isolation:isolate}
      #tab-lessons .sli-cell{position:relative;display:grid;place-items:center;min-width:0;min-height:0}
      #tab-lessons .sli-cell.light{background:var(--board-light)}#tab-lessons .sli-cell.dark{background:var(--board-dark)}
      #tab-lessons .sli-piece{position:relative;z-index:3;font:clamp(25px,5.2vw,42px)/1 "DejaVu Sans","Segoe UI Symbol",serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.45);pointer-events:none;user-select:none}
      #tab-lessons .sli-piece.black{color:#161a20;text-shadow:0 1px 2px rgba(255,255,255,.38)}
      #tab-lessons .sli-piece.sli-flying{position:absolute;z-index:20;will-change:left,top}
      #tab-lessons .sli-piece.sli-taken{opacity:.15;transform:scale(.85)}
      #tab-lessons .sli-cell.sli-last{box-shadow:inset 0 0 0 2px rgba(126,91,255,.35)}
      #tab-lessons .sli-cell.sli-target{box-shadow:inset 0 0 0 3px rgba(126,91,255,.72)}
      #tab-lessons .sli-cell.sli-check{box-shadow:inset 0 0 0 3px rgba(236,72,153,.7)}
      #tab-lessons .sli-rank,#tab-lessons .sli-file{position:absolute;z-index:2;font:900 8px Nunito,sans-serif;opacity:.72}
      #tab-lessons .sli-rank{left:3px;top:2px}.sli-file{right:3px;bottom:2px}
      #tab-lessons .sli-target-dot{width:7px;height:7px;border-radius:50%;background:rgba(126,91,255,.75);position:absolute;z-index:4}
      #tab-lessons .lesson-move-caption{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 2px 7px;font:800 10px Nunito,sans-serif;color:var(--muted)}
      #tab-lessons .lesson-move-san{font:900 15px Nunito,sans-serif;color:var(--ink)}
      #tab-lessons .lesson-controls{display:flex;flex-wrap:wrap;gap:7px}
      #tab-lessons .lesson-controls button{border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink-2);padding:7px 9px;font:800 10px Nunito,sans-serif;cursor:pointer}
      #tab-lessons .lesson-controls button:hover:not(:disabled){border-color:var(--m-chess);transform:translateY(-1px)}
      #tab-lessons .lesson-controls button.primary{background:var(--m-chess);border-color:var(--m-chess);color:#fff}
      #tab-lessons .lesson-controls button.ghost{background:transparent}
      #tab-lessons .lesson-controls button:disabled{opacity:.45;cursor:default}
      #tab-lessons .lesson-controls .auto{display:flex;align-items:center;gap:5px;margin-left:auto;font:800 10px Nunito,sans-serif;color:var(--muted)}
      #tab-lessons .lesson-move-list{display:flex;gap:5px;overflow:auto;padding:8px 1px 1px;scrollbar-width:thin}
      #tab-lessons .lesson-move-item{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink-2);padding:5px 7px;font:800 9px Nunito,sans-serif;cursor:pointer}
      #tab-lessons .lesson-move-item.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      #tab-lessons .lesson-move-item b{font-size:10px}
      @media(max-width:900px){#tab-lessons .lesson-system-main{grid-template-columns:1fr}#tab-lessons .lesson-board-host{width:min(420px,100%)} }
      @media(max-width:560px){#tab-lessons .lesson-system-head{grid-template-columns:32px minmax(0,1fr) 20px;gap:8px;padding:10px 11px}#tab-lessons .lesson-system-status{display:none}#tab-lessons .lesson-system-body{padding:0 10px 10px!important}#tab-lessons .lesson-goal{font-size:15px}#tab-lessons .lesson-description{font-size:12.5px;line-height:1.6}#tab-lessons .lesson-interactive{padding:9px;border-radius:13px}#tab-lessons .lesson-controls .auto{width:100%;margin-left:0}#tab-lessons .lesson-move-list{max-width:100%}}
    `;document.head.appendChild(s);
  }

  function renderAll(){
    const host=$('#lessonList'),lessons=window.CHESS_LESSONS;
    if(!host||!Array.isArray(lessons)||!window.E)return;
    const current=host.querySelector('.lesson-system');
    if(current && current.dataset.lessonSystem==='v1')return;
    const cards=lessons.map((l,i)=>buildCard(l,i,lessons.length));
    host.replaceChildren(...cards);host.dataset.lessonSystem='v1';
    cards[0]?.classList.add('open');
    const body=cards[0]?.querySelector('.lesson-system-body');if(body)body.classList.remove('hidden');
  }

  function init(){installStyles();renderAll();}
  function boot(){
    if(window.E && window.CHESS_LESSONS && $('#lessonList')) init();
    else setTimeout(boot,30);
  }
  boot();
  window.addEventListener('langchange',()=>setTimeout(()=>{const host=$('#lessonList');if(host){host.removeAttribute('data-lesson-system');host.dataset.lessonSystem='';}renderAll();},0));
})();