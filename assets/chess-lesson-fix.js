/* SkyySchool — isolated lesson boards.
   Lesson 1 gets a real movement demo; other lesson diagrams stay static.
   Deliberately independent from the game/puzzle board. */
'use strict';
(function(){
  const PIECES = { p:'♟', n:'♞', b:'♝', r:'♜', q:'♛', k:'♚' };
  const files='abcdefgh';
  const $ = (s, root=document) => root.querySelector(s);

  function renderMiniBoard(fen, size=260){
    const board=document.createElement('div');
    board.className='mini-board';
    const px=Math.max(240,Math.min(280,Number(size)||260));
    board.style.setProperty('--mini-size',px+'px');
    const placement=String(fen||'').trim().split(/\s+/)[0]||'';
    const ranks=placement.split('/');
    for(let row=0;row<8;row++){
      const rank=ranks[row]||'';
      let file=0;
      for(const ch of rank){
        if(/[1-8]/.test(ch)){file+=Number(ch);continue;}
        if(file>=8)break;
        const cell=document.createElement('div');
        const boardRank=7-row;
        cell.className='mini-cell '+(((file+boardRank)&1)?'light':'dark');
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
        const boardRank=7-row;
        cell.className='mini-cell '+(((file+boardRank)&1)?'light':'dark');
        board.appendChild(cell); file++;
      }
    }
    while(board.children.length<64){
      const i=board.children.length,file=i%8,rank=7-Math.floor(i/8);
      const cell=document.createElement('div');
      cell.className='mini-cell '+(((file+rank)&1)?'light':'dark');
      board.appendChild(cell);
    }
    return board;
  }

  const DEMOS={
    pawn:{glyph:'♙',name:'Пешка',start:'d4',path:['d4','d5','d6']},
    knight:{glyph:'♘',name:'Конь',start:'d4',path:['d4','f5','e7','c6','b5','b3','c2','e3','f4']},
    bishop:{glyph:'♗',name:'Слон',start:'d4',path:['d4','e5','f6','g7','h8']},
    rook:{glyph:'♖',name:'Ладья',start:'d4',path:['d4','d8']},
    queen:{glyph:'♕',name:'Ферзь',start:'d4',path:['d4','h8']},
    king:{glyph:'♔',name:'Король',start:'d4',path:['d4','e5','e4','c3','d3','e3','c4','c5','d5']}
  };

  function motionCell(board,sq){return board.querySelector('[data-square="'+sq+'"]');}

  function buildMotionBoard(){
    const board=document.createElement('div');
    board.className='lesson-motion-board';
    for(let r=8;r>=1;r--)for(let f=0;f<8;f++){
      const c=document.createElement('div');
      c.className='lesson-motion-cell '+(((f+r)&1)?'light':'dark');
      c.dataset.square=files[f]+r;
      board.appendChild(c);
    }
    return board;
  }

  function placePiece(board,key,sq){
    board.querySelectorAll('.lesson-motion-piece').forEach(n=>n.remove());
    const cell=motionCell(board,sq); if(!cell)return;
    const p=document.createElement('span');
    p.className='lesson-motion-piece';
    p.textContent=DEMOS[key].glyph;
    p.dataset.square=sq;
    const boardRect=board.getBoundingClientRect();
    const cellRect=cell.getBoundingClientRect();
    p.style.left=(cellRect.left-boardRect.left+cellRect.width/2)+'px';
    p.style.top=(cellRect.top-boardRect.top+cellRect.height/2)+'px';
    p.style.transform='translate(-50%,-50%)';
    board.appendChild(p);
  }

  function movePiece(board,from,to,duration,onDone){
    const p=board.querySelector('.lesson-motion-piece');
    const a=motionCell(board,from), b=motionCell(board,to);
    if(!p||!a||!b){onDone?.();return null;}

    const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
    const dx=(br.left+br.width/2)-(ar.left+ar.width/2);
    const dy=(br.top+br.height/2)-(ar.top+ar.height/2);

    if(p.__motionAnim) p.__motionAnim.cancel();
    const anim=p.animate(
      [
        {transform:'translate(-50%,-50%)'},
        {transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px))'}
      ],
      {duration:duration||380,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}
    );
    p.__motionAnim=anim;
    anim.finished.then(()=>{
      if(p.__motionAnim!==anim)return;
      const boardRect=board.getBoundingClientRect(), cellRect=b.getBoundingClientRect();
      p.style.transform='translate(-50%,-50%)';
      p.style.left=(cellRect.left-boardRect.left+cellRect.width/2)+'px';
      p.style.top=(cellRect.top-boardRect.top+cellRect.height/2)+'px';
      p.dataset.square=to;
      p.__motionAnim=null;
      onDone?.();
    }).catch(()=>{});
    return anim;
  }

  function mountMotionDemo(host){
    if(host.dataset.motionReady==='1')return;
    host.dataset.motionReady='1';
    host.replaceChildren();

    const wrap=document.createElement('div'); wrap.className='lesson-motion-wrap';
    const title=document.createElement('div'); title.className='lesson-motion-label'; title.textContent='Попробуйте сами: как ходят фигуры';
    const controls=document.createElement('div'); controls.className='lesson-motion-controls';
    const board=buildMotionBoard();
    const info=document.createElement('div'); info.className='lesson-motion-info';
    let current='pawn', timer=0, runId=0;

    function stop(){
      runId++;
      clearTimeout(timer);
      const p=board.querySelector('.lesson-motion-piece');
      if(p?.__motionAnim)p.__motionAnim.cancel();
      if(p)p.__motionAnim=null;
    }

    function reset(){
      stop();
      board.querySelectorAll('.lesson-motion-cell.from,.lesson-motion-cell.to').forEach(x=>x.classList.remove('from','to'));
      placePiece(board,current,DEMOS[current].start);
      info.textContent=DEMOS[current].name+' · нажмите «Показать движение»';
    }

    function demo(){
      stop();
      const myRun=runId;
      const path=DEMOS[current].path;
      let i=0;
      placePiece(board,current,path[0]);
      const step=()=>{
        if(myRun!==runId)return;
        if(i>=path.length-1){
          info.textContent=DEMOS[current].name+' · готово';
          timer=setTimeout(()=>{
            if(myRun!==runId)return;
            reset();
            timer=setTimeout(()=>{if(myRun===runId)demo();},550);
          },900);
          return;
        }
        const from=path[i],to=path[i+1];
        board.querySelectorAll('.lesson-motion-cell.from,.lesson-motion-cell.to').forEach(x=>x.classList.remove('from','to'));
        motionCell(board,from)?.classList.add('from');
        motionCell(board,to)?.classList.add('to');
        info.textContent=DEMOS[current].name+' · '+from+' → '+to;
        movePiece(board,from,to,380,()=>{
          if(myRun!==runId)return;
          i++;
          timer=setTimeout(step,70);
        });
      };
      step();
    }

    Object.entries(DEMOS).forEach(([key,d])=>{
      const b=document.createElement('button');
      b.type='button'; b.className='lesson-motion-piece-btn';
      b.innerHTML='<span>'+d.glyph+'</span><em>'+d.name+'</em>';
      b.addEventListener('click',()=>{
        current=key;
        controls.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        reset();
        timer=setTimeout(()=>demo(),350);
      });
      controls.appendChild(b);
    });

    const actions=document.createElement('div'); actions.className='lesson-motion-actions';
    const play=document.createElement('button'); play.type='button'; play.className='btn chess small'; play.textContent='▶ Показать движение'; play.addEventListener('click',demo);
    const again=document.createElement('button'); again.type='button'; again.className='btn ghost small'; again.textContent='↺ Сначала'; again.addEventListener('click',reset);
    actions.append(play,again);

    wrap.append(title,controls,board,info,actions);
    host.appendChild(wrap);
    controls.querySelector('button')?.classList.add('active');
    reset();
    timer=setTimeout(demo,550);
  }

  function installStyles(){
    if($('#mini-board-styles-v8'))return;
    const style=document.createElement('style'); style.id='mini-board-styles-v8';
    style.textContent=`
      #tab-lessons .lesson-modern-body{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:16px!important;width:100%!important;min-width:0!important;padding:0 16px 16px!important;box-sizing:border-box!important}
      #tab-lessons .lesson-modern .lesson-text{order:1!important;width:100%!important;min-width:0!important}
      #tab-lessons .lesson-modern .lesson-demo{order:2!important;width:100%!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;box-sizing:border-box!important;padding:10px!important}
      #tab-lessons .lesson-modern .lesson-demo-title{width:100%!important;margin-bottom:8px!important;text-align:left!important}
      #tab-lessons .lesson-modern .lesson-demo-board{width:100%!important;max-width:none!important;height:auto!important;min-height:0!important;aspect-ratio:auto!important;display:flex!important;justify-content:center!important;align-items:center!important;margin:0!important;padding:0!important;overflow:visible!important}
      #tab-lessons .mini-board{--mini-size:260px;display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-template-rows:repeat(8,minmax(0,1fr))!important;width:min(var(--mini-size),100%)!important;height:min(var(--mini-size),100%)!important;aspect-ratio:1/1!important;flex:0 0 auto!important;min-width:0!important;min-height:0!important;max-width:280px!important;max-height:280px!important;margin:0 auto!important;padding:0!important;box-sizing:border-box!important;border:1px solid var(--line-2)!important;border-radius:12px!important;overflow:hidden!important;position:relative!important;box-shadow:var(--shadow-sm)!important}
      #tab-lessons .mini-board .mini-cell{display:grid!important;place-items:center!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;box-sizing:border-box!important}
      #tab-lessons .mini-board .mini-cell.light{background:var(--board-light)!important}
      #tab-lessons .mini-board .mini-cell.dark{background:var(--board-dark)!important}
      #tab-lessons .mini-board .mini-piece{display:block!important;position:static!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;line-height:1!important;font-family:"DejaVu Sans","Segoe UI Symbol",serif!important;font-size:28px!important;font-weight:400!important;transform:none!important;transition:none!important;animation:none!important;user-select:none!important;pointer-events:none!important}
      #tab-lessons .mini-piece.white{color:#fff!important;text-shadow:0 1px 1px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.45)!important}
      #tab-lessons .mini-piece.black{color:#141820!important;text-shadow:0 1px 1px rgba(255,255,255,.35)!important}
      #tab-lessons .lesson-modern{transition:box-shadow .18s,border-color .18s,transform .18s}
      #tab-lessons .lesson-modern:hover{transform:translateY(-1px)}
      #tab-lessons .lesson-modern.open{box-shadow:0 10px 28px rgba(55,72,110,.10)}
      #tab-lessons .lesson-modern-body{max-width:1000px;margin:0 auto}
      #tab-lessons .lesson-modern .lesson-text-content{max-width:880px}
      #tab-lessons .lesson-modern .lesson-demo{background:linear-gradient(180deg,var(--panel-2),var(--panel));}
      #tab-lessons .lesson-motion-wrap{width:min(680px,100%);display:grid;gap:10px;justify-items:center}
      #tab-lessons .lesson-motion-label{width:100%;font-size:11px;font-weight:900;color:var(--muted);text-align:left;text-transform:uppercase;letter-spacing:.05em}
      #tab-lessons .lesson-motion-controls{width:100%;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}
      #tab-lessons .lesson-motion-piece-btn{display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 5px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font:700 10px Nunito,sans-serif;color:var(--ink-2);cursor:pointer;transition:transform .16s,box-shadow .16s,border-color .16s,background .16s;overflow:hidden}
      #tab-lessons .lesson-motion-piece-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(55,72,110,.08)}
      #tab-lessons .lesson-motion-piece-btn span{font:21px/1 "DejaVu Sans","Segoe UI Symbol",serif;display:inline-block;flex:0 0 auto}
      #tab-lessons .lesson-motion-piece-btn em{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #tab-lessons .lesson-motion-piece-btn.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      #tab-lessons .lesson-motion-board{width:min(360px,100%);aspect-ratio:1/1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);position:relative;border-radius:13px;overflow:hidden;border:1px solid var(--line-2);box-shadow:var(--shadow-sm);margin:0 auto}
      #tab-lessons .lesson-motion-cell{position:relative;display:grid;place-items:center;min-width:0;min-height:0}
      #tab-lessons .lesson-motion-cell.light{background:var(--board-light)}
      #tab-lessons .lesson-motion-cell.dark{background:var(--board-dark)}
      #tab-lessons .lesson-motion-cell.from{box-shadow:inset 0 0 0 2px rgba(126,91,255,.38)}
      #tab-lessons .lesson-motion-cell.to{box-shadow:inset 0 0 0 3px rgba(126,91,255,.78)}
      #tab-lessons .lesson-motion-piece{display:block;width:40px;height:40px;line-height:40px;text-align:center;font:40px/40px "DejaVu Sans","Segoe UI Symbol",serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.55);position:absolute;left:0;top:0;z-index:3;pointer-events:none;will-change:transform;overflow:visible}
      #tab-lessons .lesson-motion-info{text-align:center;font-size:11px;font-weight:800;color:var(--muted);min-height:16px}
      #tab-lessons .lesson-motion-actions{display:flex;justify-content:center;gap:7px;flex-wrap:wrap}
      @media(max-width:560px){
        #tab-lessons .lesson-motion-controls{grid-template-columns:repeat(3,minmax(0,1fr))}
        #tab-lessons .lesson-motion-piece-btn span{font-size:19px}
        #tab-lessons .lesson-motion-piece{width:34px;height:34px;font-size:34px;line-height:34px}
      }
    `;
    document.head.appendChild(style);
  }

  function patchLessons(){
    installStyles();
    const host=document.getElementById('lessonList');
    const lessons=window.CHESS_LESSONS;
    if(!host || !Array.isArray(lessons))return;
    host.querySelectorAll(':scope > .lesson-modern').forEach((card,index)=>{
      const lesson=lessons[index];
      const demoHost=card.querySelector('.lesson-demo-board');
      if(!lesson || !demoHost)return;
      if(lesson.id==='l01'){
        if(!demoHost.dataset.motionReady)mountMotionDemo(demoHost);
      }else if(!demoHost.querySelector('.mini-board')){
        if(lesson.fen)demoHost.replaceChildren(renderMiniBoard(lesson.fen,260));
      }
    });
  }

  function installObserver(){
    const host=document.getElementById('lessonList');
    if(!host || host.__miniBoardObserver)return;
    const observer=new MutationObserver(()=>{
      clearTimeout(host.__miniBoardTimer);
      host.__miniBoardTimer=setTimeout(patchLessons,0);
    });
    observer.observe(host,{childList:true,subtree:true});
    host.__miniBoardObserver=observer;
  }

  function init(){installStyles();patchLessons();installObserver();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else setTimeout(init,0);
  document.addEventListener('langchange',()=>setTimeout(patchLessons,0));
})();
