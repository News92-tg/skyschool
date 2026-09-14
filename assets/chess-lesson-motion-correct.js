/* SkyySchool — definitive chess movement demo for lesson 1.
   Rules are explicit: knight moves in an L, king moves one square.
   Animation follows the actual teaching path, not a fake diagonal shortcut. */
'use strict';
(function(){
  const FILES='abcdefgh';
  const DEMOS={
    pawn:{glyph:'♙',name:'Пешка',start:'d4',moves:['d5','d6']},
    knight:{glyph:'♘',name:'Конь',start:'d4',moves:['f5','e7','c6','b5','b3','c2','e3','f4']},
    bishop:{glyph:'♗',name:'Слон',start:'d4',moves:['e5','f6','g7','h8']},
    rook:{glyph:'♖',name:'Ладья',start:'d4',moves:['d8']},
    queen:{glyph:'♕',name:'Ферзь',start:'d4',moves:['h8']},
    king:{glyph:'♔',name:'Король',start:'d4',moves:['e5','e4','d3','c3','c4','c5','d5','e5']}
  };
  const $=(s,r=document)=>r.querySelector(s);
  const xy=sq=>({file:FILES.indexOf(sq[0]),rank:Number(sq[1])});

  function center(board,sq){
    const cell=board.querySelector('[data-square="'+sq+'"]');
    if(!cell)return null;
    const br=board.getBoundingClientRect(),cr=cell.getBoundingClientRect();
    return {x:cr.left-br.left+cr.width/2,y:cr.top-br.top+cr.height/2};
  }
  function buildBoard(){
    const board=document.createElement('div');board.className='lesson-motion-board';
    for(let rank=8;rank>=1;rank--)for(let file=0;file<8;file++){
      const c=document.createElement('div');
      c.className='lesson-motion-cell '+(((file+rank)&1)?'light':'dark');
      c.dataset.square=FILES[file]+rank;
      board.appendChild(c);
    }
    return board;
  }
  function setPiece(board,p,sq){
    const pos=center(board,sq);if(!pos)return;
    p.style.transition='none';p.style.left=pos.x+'px';p.style.top=pos.y+'px';p.style.transform='translate(-50%,-50%)';p.dataset.square=sq;
  }
  function knightPath(from,to){
    const a=xy(from),b=xy(to),dx=b.file-a.file,dy=b.rank-a.rank;
    if(Math.abs(dx)!==1&&Math.abs(dx)!==2)return [to];
    if(Math.abs(dx)===2&&Math.abs(dy)===1)return [FILES[a.file+(dx>0?2:-2)]+a.rank,to];
    if(Math.abs(dx)===1&&Math.abs(dy)===2)return [FILES[a.file]+(a.rank+(dy>0?2:-2)),to];
    return [to];
  }
  function animateTo(board,p,from,to,duration,done){
    const a=center(board,from),b=center(board,to);if(!a||!b){done?.();return()=>{};}
    let raf=0,start=null,cancelled=false;
    const cancel=()=>{cancelled=true;cancelAnimationFrame(raf);};
    p.style.transition='none';p.style.left=a.x+'px';p.style.top=a.y+'px';p.style.transform='translate(-50%,-50%)';
    const ease=t=>1-Math.pow(1-t,3);
    const tick=now=>{
      if(cancelled)return;
      if(start===null)start=now;
      const t=Math.min(1,(now-start)/duration),e=ease(t);
      p.style.left=(a.x+(b.x-a.x)*e)+'px';
      p.style.top=(a.y+(b.y-a.y)*e)+'px';
      if(t<1)raf=requestAnimationFrame(tick);else{setPiece(board,p,to);done?.();}
    };
    raf=requestAnimationFrame(tick);return cancel;
  }
  function mount(host){
    if(!host||host.dataset.motionCorrect==='1')return;
    host.dataset.motionCorrect='1';host.dataset.motionReady='1';host.replaceChildren();
    const wrap=document.createElement('div');wrap.className='lesson-motion-wrap';
    const title=document.createElement('div');title.className='lesson-motion-label';title.textContent='Попробуйте сами: как ходят фигуры';
    const controls=document.createElement('div');controls.className='lesson-motion-controls';
    const board=buildBoard();const info=document.createElement('div');info.className='lesson-motion-info';
    const actions=document.createElement('div');actions.className='lesson-motion-actions';
    const play=document.createElement('button');play.type='button';play.className='btn chess small';play.textContent='▶ Показать движение';
    const again=document.createElement('button');again.type='button';again.className='btn ghost small';again.textContent='↺ Сначала';actions.append(play,again);
    const piece=document.createElement('span');piece.className='lesson-motion-piece';board.appendChild(piece);
    let current='pawn',timer=0,cancel=null,run=0;
    const clearMarks=()=>board.querySelectorAll('.from,.to,.knight-turn').forEach(c=>c.classList.remove('from','to','knight-turn'));
    const stop=()=>{clearTimeout(timer);timer=0;if(cancel){cancel();cancel=null;}run++;};
    const reset=()=>{stop();piece.textContent=DEMOS[current].glyph;clearMarks();setPiece(board,piece,DEMOS[current].start);info.textContent=DEMOS[current].name+' · нажмите «Показать движение»';};
    const demo=()=>{
      stop();const token=run,d=DEMOS[current];let from=d.start,index=0;piece.textContent=d.glyph;setPiece(board,piece,from);
      const next=()=>{
        if(token!==run)return;
        if(index>=d.moves.length){info.textContent=d.name+' · готово';timer=setTimeout(()=>{if(token===run){reset();timer=setTimeout(demo,450);}},900);return;}
        const to=d.moves[index++];clearMarks();
        board.querySelector('[data-square="'+from+'"]')?.classList.add('from');
        board.querySelector('[data-square="'+to+'"]')?.classList.add('to');
        let points=d===DEMOS.knight?knightPath(from,to):[to];
        if(points.length>1)board.querySelector('[data-square="'+points[0]+'"]')?.classList.add('knight-turn');
        let seg=0,segFrom=from;
        const step=()=>{
          if(token!==run)return;
          if(seg>=points.length){from=to;timer=setTimeout(next,90);return;}
          const segTo=points[seg++];
          info.textContent=d.name+' · '+(segTo===to?from+' → '+to:from+' · сгиб → '+to);
          cancel=animateTo(board,piece,segFrom,segTo,d===DEMOS.knight?230:360,()=>{cancel=null;segFrom=segTo;step();});
        };
        step();
      };
      next();
    };
    Object.entries(DEMOS).forEach(([key,d])=>{
      const b=document.createElement('button');b.type='button';b.className='lesson-motion-piece-btn';b.innerHTML='<span>'+d.glyph+'</span><em>'+d.name+'</em>';
      b.addEventListener('click',()=>{current=key;controls.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');reset();timer=setTimeout(demo,300);});controls.appendChild(b);
    });
    play.addEventListener('click',demo);again.addEventListener('click',reset);
    wrap.append(title,controls,board,info,actions);host.appendChild(wrap);
    controls.querySelector('button')?.classList.add('active');reset();timer=setTimeout(demo,550);
  }
  function style(){
    if($('#lesson-motion-correct-style'))return;
    const s=document.createElement('style');s.id='lesson-motion-correct-style';s.textContent=`
      #tab-lessons .lesson-motion-wrap{width:min(360px,100%)!important;display:grid!important;gap:10px!important;justify-items:center!important}
      #tab-lessons .lesson-motion-board{width:min(360px,100%)!important;aspect-ratio:1/1!important;display:grid!important;grid-template-columns:repeat(8,1fr)!important;grid-template-rows:repeat(8,1fr)!important;position:relative!important;overflow:hidden!important;border:1px solid var(--line-2)!important;border-radius:13px!important;box-shadow:var(--shadow-sm)!important;isolation:isolate!important}
      #tab-lessons .lesson-motion-cell{display:block!important;position:relative!important}
      #tab-lessons .lesson-motion-cell.light{background:var(--board-light)!important}#tab-lessons .lesson-motion-cell.dark{background:var(--board-dark)!important}
      #tab-lessons .lesson-motion-piece{position:absolute!important;left:0;top:0;z-index:6!important;font:42px/1 "DejaVu Sans","Segoe UI Symbol",serif!important;color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.7),0 0 2px rgba(0,0,0,.5)!important;pointer-events:none!important;will-change:left,top!important}
      #tab-lessons .lesson-motion-cell.from{box-shadow:inset 0 0 0 3px rgba(126,91,255,.42)!important}#tab-lessons .lesson-motion-cell.to{box-shadow:inset 0 0 0 4px rgba(126,91,255,.82)!important}
      #tab-lessons .lesson-motion-cell.knight-turn{box-shadow:inset 0 0 0 2px rgba(126,91,255,.28)!important}
      #tab-lessons .lesson-motion-controls{width:100%!important;display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:7px!important}
      #tab-lessons .lesson-motion-piece-btn{min-width:0!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;padding:7px 5px!important;border:1px solid var(--line)!important;border-radius:10px!important;background:var(--panel)!important;color:var(--ink-2)!important;font:700 10px Nunito,sans-serif!important;cursor:pointer!important}
      #tab-lessons .lesson-motion-piece-btn span{font:22px/1 "DejaVu Sans","Segoe UI Symbol",serif!important}#tab-lessons .lesson-motion-piece-btn em{font-style:normal!important}
      #tab-lessons .lesson-motion-piece-btn.active{border-color:var(--m-chess)!important;background:var(--m-chess-soft)!important;color:var(--m-chess)!important}
      @media(max-width:560px){#tab-lessons .lesson-motion-controls{grid-template-columns:repeat(3,minmax(0,1fr))!important}#tab-lessons .lesson-motion-piece{font-size:36px!important}}
    `;document.head.appendChild(s);
  }
  function patch(){
    style();const host=document.getElementById('lessonList');if(!host)return;
    const cards=[...host.querySelectorAll(':scope > .lesson-modern')];
    const card=cards.find((c,i)=>c.dataset.lessonId==='l01'||i===0);if(!card)return;
    const demo=card.querySelector('.lesson-demo-board');if(!demo)return;
    if(demo.dataset.motionCorrect==='1')return;
    mount(demo);
  }
  function init(){patch();const host=document.getElementById('lessonList');if(host&&!host.__motionCorrectObserver){const o=new MutationObserver(()=>setTimeout(patch,0));o.observe(host,{childList:true,subtree:true});host.__motionCorrectObserver=o;}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
