/* SkyySchool — isolated lesson boards and stable movement demo. */
'use strict';
(function(){
  const PIECES={p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
  const FILES='abcdefgh';
  const DEMOS={
    pawn:{glyph:'♙',name:'Пешка',start:'d4',path:['d4','d5','d6']},
    knight:{glyph:'♘',name:'Конь',start:'d4',path:['d4','f5','e7','c6','b5','b3','c2','e3','f4']},
    bishop:{glyph:'♗',name:'Слон',start:'d4',path:['d4','e5','f6','g7','h8']},
    rook:{glyph:'♖',name:'Ладья',start:'d4',path:['d4','d8']},
    queen:{glyph:'♕',name:'Ферзь',start:'d4',path:['d4','h8']},
    king:{glyph:'♔',name:'Король',start:'d4',path:['d4','e5','e4','c3','d3','e3','c4','c5','d5']}
  };
  const $=(s,r=document)=>r.querySelector(s);

  function makeMiniBoard(fen,size=260){
    const board=document.createElement('div');
    board.className='mini-board';
    const px=Math.max(240,Math.min(280,Number(size)||260));
    board.style.setProperty('--mini-size',px+'px');
    const placement=String(fen||'').trim().split(/\s+/)[0]||'';
    const ranks=placement.split('/');
    for(let row=0;row<8;row++){
      let file=0;
      for(const ch of (ranks[row]||'')){
        if(/[1-8]/.test(ch)){file+=Number(ch);continue;}
        if(file>=8)break;
        const cell=document.createElement('div');
        const rank=7-row;
        cell.className='mini-cell '+(((file+rank)&1)?'light':'dark');
        const glyph=PIECES[ch.toLowerCase()];
        if(glyph){
          const piece=document.createElement('span');
          piece.className='mini-piece '+(ch===ch.toUpperCase()?'white':'black');
          piece.textContent=glyph;
          cell.appendChild(piece);
        }
        board.appendChild(cell); file++;
      }
      while(file<8){
        const cell=document.createElement('div');
        const rank=7-row;
        cell.className='mini-cell '+(((file+rank)&1)?'light':'dark');
        board.appendChild(cell); file++;
      }
    }
    while(board.children.length<64){
      const i=board.children.length, file=i%8, rank=7-Math.floor(i/8);
      const cell=document.createElement('div');
      cell.className='mini-cell '+(((file+rank)&1)?'light':'dark');
      board.appendChild(cell);
    }
    return board;
  }
  window.renderMiniBoard=makeMiniBoard;

  function squareCenter(board,sq){
    const cell=board.querySelector('[data-square="'+sq+'"]');
    if(!cell)return null;
    const br=board.getBoundingClientRect(), cr=cell.getBoundingClientRect();
    return {x:cr.left-br.left+cr.width/2,y:cr.top-br.top+cr.height/2};
  }
  function buildMotionBoard(){
    const board=document.createElement('div');
    board.className='lesson-motion-board';
    for(let rank=8;rank>=1;rank--){
      for(let file=0;file<8;file++){
        const cell=document.createElement('div');
        cell.className='lesson-motion-cell '+(((file+rank)&1)?'light':'dark');
        cell.dataset.square=FILES[file]+rank;
        board.appendChild(cell);
      }
    }
    return board;
  }
  function placePiece(board,key,sq){
    let p=board.querySelector('.lesson-motion-piece');
    if(!p){
      p=document.createElement('span');
      p.className='lesson-motion-piece';
      board.appendChild(p);
    }
    p.textContent=DEMOS[key].glyph;
    const pos=squareCenter(board,sq); if(!pos)return;
    p.style.transition='none';
    p.style.left=pos.x+'px';
    p.style.top=pos.y+'px';
    p.style.transform='translate(-50%,-50%)';
    p.dataset.square=sq;
  }
  function animatePiece(board,from,to,duration,onDone){
    const p=board.querySelector('.lesson-motion-piece');
    const a=squareCenter(board,from), b=squareCenter(board,to);
    if(!p||!a||!b){onDone?.();return ()=>{};}
    let start=null, stopped=false, raf=0;
    const cancel=()=>{stopped=true;cancelAnimationFrame(raf);};
    p.style.transition='none';
    p.style.left=a.x+'px'; p.style.top=a.y+'px';
    const ease=t=>1-Math.pow(1-t,3);
    const tick=now=>{
      if(stopped)return;
      if(start===null)start=now;
      const raw=Math.min(1,(now-start)/duration), t=ease(raw);
      p.style.left=(a.x+(b.x-a.x)*t)+'px';
      p.style.top=(a.y+(b.y-a.y)*t)+'px';
      if(raw<1) raf=requestAnimationFrame(tick);
      else {p.dataset.square=to;onDone?.();}
    };
    raf=requestAnimationFrame(tick);
    return cancel;
  }

  function mountMotionDemo(host){
    if(!host||host.dataset.motionReady==='1')return;
    host.dataset.motionReady='1'; host.replaceChildren();
    const wrap=document.createElement('div'); wrap.className='lesson-motion-wrap';
    const title=document.createElement('div'); title.className='lesson-motion-label'; title.textContent='Попробуйте сами: как ходят фигуры';
    const controls=document.createElement('div'); controls.className='lesson-motion-controls';
    const board=buildMotionBoard();
    const info=document.createElement('div'); info.className='lesson-motion-info';
    const actions=document.createElement('div'); actions.className='lesson-motion-actions';
    const play=document.createElement('button'); play.type='button'; play.className='btn chess small'; play.textContent='▶ Показать движение';
    const again=document.createElement('button'); again.type='button'; again.className='btn ghost small'; again.textContent='↺ Сначала';
    actions.append(play,again);
    let current='pawn', timer=0, cancelAnim=null, busy=false;
    const stop=()=>{
      clearTimeout(timer); timer=0;
      if(cancelAnim)cancelAnim(); cancelAnim=null;
      busy=false;
    };
    const reset=()=>{
      stop();
      board.querySelectorAll('.lesson-motion-cell.from,.lesson-motion-cell.to').forEach(c=>c.classList.remove('from','to'));
      placePiece(board,current,DEMOS[current].start);
      info.textContent=DEMOS[current].name+' · нажмите «Показать движение»';
    };
    const demo=()=>{
      stop(); busy=true;
      const path=DEMOS[current].path;
      let i=0;
      placePiece(board,current,path[0]);
      const step=()=>{
        if(i>=path.length-1){
          busy=false; info.textContent=DEMOS[current].name+' · готово';
          timer=setTimeout(reset,1000);
          return;
        }
        const from=path[i],to=path[i+1];
        board.querySelectorAll('.lesson-motion-cell.from,.lesson-motion-cell.to').forEach(c=>c.classList.remove('from','to'));
        squareCenter(board,from); board.querySelector('[data-square="'+from+'"]')?.classList.add('from');
        board.querySelector('[data-square="'+to+'"]')?.classList.add('to');
        info.textContent=DEMOS[current].name+' · '+from+' → '+to;
        cancelAnim=animatePiece(board,from,to,400,()=>{cancelAnim=null;i++;timer=setTimeout(step,70);});
      };
      step();
    };
    Object.entries(DEMOS).forEach(([key,d])=>{
      const btn=document.createElement('button'); btn.type='button'; btn.className='lesson-motion-piece-btn';
      btn.innerHTML='<span>'+d.glyph+'</span><em>'+d.name+'</em>';
      btn.addEventListener('click',()=>{
        current=key;
        controls.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        reset(); timer=setTimeout(demo,350);
      });
      controls.appendChild(btn);
    });
    play.addEventListener('click',demo); again.addEventListener('click',reset);
    wrap.append(title,controls,board,info,actions); host.appendChild(wrap);
    controls.querySelector('button')?.classList.add('active');
    reset(); timer=setTimeout(demo,500);
  }

  function installStyles(){
    if($('#lesson-motion-v9'))return;
    const s=document.createElement('style'); s.id='lesson-motion-v9';
    s.textContent=`
      #tab-lessons .lesson-modern-body{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(310px,380px)!important;gap:22px!important;align-items:start!important;width:100%!important;max-width:1080px!important;margin:0 auto!important;padding:0 16px 16px!important;box-sizing:border-box!important}
      #tab-lessons .lesson-modern .lesson-text{order:1!important;width:auto!important;min-width:0!important;padding:5px 2px!important}
      #tab-lessons .lesson-modern .lesson-demo{order:2!important;width:auto!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;padding:13px!important;box-sizing:border-box!important;border:1px solid var(--line)!important;border-radius:14px!important;background:linear-gradient(180deg,var(--panel-2),var(--panel))!important;position:sticky!important;top:84px!important}
      #tab-lessons .lesson-modern .lesson-demo-title{width:100%!important;margin:0 0 10px!important;text-align:left!important;font-size:10px!important;letter-spacing:.07em!important}
      #tab-lessons .lesson-modern .lesson-demo-board{width:100%!important;display:flex!important;justify-content:center!important;align-items:center!important;margin:0!important;padding:0!important;min-height:0!important;overflow:visible!important}
      #tab-lessons .mini-board{width:min(280px,100%)!important;height:auto!important;aspect-ratio:1/1!important;display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:repeat(8,minmax(0,1fr))!important;flex:0 0 auto!important;margin:0 auto!important;padding:0!important;box-sizing:border-box!important;border:1px solid var(--line-2)!important;border-radius:12px!important;overflow:hidden!important;position:relative!important;box-shadow:var(--shadow-sm)!important}
      #tab-lessons .mini-cell{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;box-sizing:border-box!important}
      #tab-lessons .mini-cell.light{background:var(--board-light)!important} #tab-lessons .mini-cell.dark{background:var(--board-dark)!important}
      #tab-lessons .mini-piece{display:block!important;position:static!important;font:28px/1 "DejaVu Sans","Segoe UI Symbol",serif!important;margin:0!important;padding:0!important;transform:none!important;transition:none!important;user-select:none!important;pointer-events:none!important}
      #tab-lessons .mini-piece.white{color:#fff!important;text-shadow:0 1px 1px rgba(0,0,0,.55)!important} #tab-lessons .mini-piece.black{color:#141820!important;text-shadow:0 1px 1px rgba(255,255,255,.35)!important}
      #tab-lessons .lesson-motion-wrap{width:min(360px,100%)!important;display:grid!important;gap:10px!important;justify-items:center!important}
      #tab-lessons .lesson-motion-label{width:100%!important;font-size:10px!important;font-weight:900!important;color:var(--muted)!important;text-align:left!important;text-transform:uppercase!important;letter-spacing:.05em!important}
      #tab-lessons .lesson-motion-controls{width:100%!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important}
      #tab-lessons .lesson-motion-piece-btn{display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;min-width:0!important;padding:7px 5px!important;border:1px solid var(--line)!important;border-radius:10px!important;background:var(--panel)!important;font:700 10px Nunito,sans-serif!important;color:var(--ink-2)!important;cursor:pointer!important}
      #tab-lessons .lesson-motion-piece-btn span{font:22px/1 "DejaVu Sans","Segoe UI Symbol",serif!important}.lesson-motion-piece-btn em{font-style:normal!important}
      #tab-lessons .lesson-motion-piece-btn.active{border-color:var(--m-chess)!important;background:var(--m-chess-soft)!important;color:var(--m-chess)!important}
      #tab-lessons .lesson-motion-board{width:min(360px,100%)!important;aspect-ratio:1/1!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;position:relative!important;border-radius:13px!important;overflow:hidden!important;border:1px solid var(--line-2)!important;box-shadow:var(--shadow-sm)!important;margin:0 auto!important}
      #tab-lessons .lesson-motion-cell{position:relative!important;display:block!important}.lesson-motion-cell.light{background:var(--board-light)!important}.lesson-motion-cell.dark{background:var(--board-dark)!important}
      #tab-lessons .lesson-motion-cell.from{box-shadow:inset 0 0 0 3px rgba(126,91,255,.45)!important}.lesson-motion-cell.to{box-shadow:inset 0 0 0 4px rgba(126,91,255,.82)!important}
      #tab-lessons .lesson-motion-piece{position:absolute!important;left:0;top:0;z-index:3!important;font:42px/1 "DejaVu Sans","Segoe UI Symbol",serif!important;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.45)!important;pointer-events:none!important;will-change:left,top!important}
      #tab-lessons .lesson-motion-info{text-align:center!important;font-size:10.5px!important;font-weight:800!important;color:var(--muted)!important;min-height:16px!important}
      #tab-lessons .lesson-motion-actions{display:flex!important;justify-content:center!important;gap:7px!important;flex-wrap:wrap!important}
      @media(max-width:820px){#tab-lessons .lesson-modern-body{grid-template-columns:1fr!important;gap:14px!important}#tab-lessons .lesson-modern .lesson-demo{position:static!important}}
      @media(max-width:560px){#tab-lessons .lesson-modern-body{padding:0 12px 12px!important}#tab-lessons .lesson-motion-controls{grid-template-columns:repeat(3,minmax(0,1fr))!important}#tab-lessons .lesson-motion-piece{font-size:36px!important}}
    `;
    document.head.appendChild(s);
  }
  function patchLessons(){
    installStyles();
    const host=document.getElementById('lessonList'), lessons=window.CHESS_LESSONS;
    if(!host||!Array.isArray(lessons))return;
    host.querySelectorAll(':scope > .lesson-modern').forEach((card,index)=>{
      const lesson=lessons[index], demo=card.querySelector('.lesson-demo-board');
      if(!lesson||!demo)return;
      if(lesson.id==='l01'){
        if(!demo.dataset.motionReady)mountMotionDemo(demo);
      }else if(lesson.fen&&!demo.querySelector('.mini-board')) demo.replaceChildren(makeMiniBoard(lesson.fen,260));
    });
  }
  function observe(){
    const host=document.getElementById('lessonList'); if(!host||host.__lessonMotionObserver)return;
    const obs=new MutationObserver(()=>{clearTimeout(host.__lessonMotionTimer);host.__lessonMotionTimer=setTimeout(patchLessons,30);});
    obs.observe(host,{childList:true,subtree:true}); host.__lessonMotionObserver=obs;
  }
  function init(){installStyles();patchLessons();observe();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true}); else setTimeout(init,0);
  document.addEventListener('langchange',()=>setTimeout(patchLessons,0));
})();