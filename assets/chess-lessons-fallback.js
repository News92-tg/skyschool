/* SkyySchool — resilient visual fallback for lesson types that lack a usable FEN line. */
'use strict';
(function(){
  const E=window.ChessEngine,FILES='abcdefgh',PIECE={p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'};
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const text=v=>typeof v==='object'?(v.ru||v.en||''):String(v??'');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const center=(board,sq)=>{const c=board.querySelector('[data-square="'+sq+'"]');if(!c)return null;const a=board.getBoundingClientRect(),b=c.getBoundingClientRect();return{x:b.left-a.left+b.width/2,y:b.top-a.top+b.height/2}};
  function put(board,glyph,sq){let p=board.querySelector('.lesson-fallback-float');if(!p){p=document.createElement('span');p.className='lesson-fallback-float';board.appendChild(p)}p.textContent=glyph;const pos=center(board,sq);if(pos){p.style.left=pos.x+'px';p.style.top=pos.y+'px'}return p}
  function clear(board){$$('.lesson-system-cell',board).forEach(c=>c.classList.remove('from','to','focus','center','key','target'));board.querySelector('.lesson-fallback-float')?.remove()}
  function pathFor(title){
    const t=title.toLowerCase();
    if(/дебют|центр|принцип/.test(t))return{glyph:'♙',start:'e2',path:['e4'],note:'Демо: пешка занимает центр.'};
    if(/эндшпил|проходн/.test(t))return{glyph:'♔',start:'d5',path:['c4','c5'],note:'Демо: король приближается к ключевым полям.'};
    if(/ладья/.test(t))return{glyph:'♖',start:'a1',path:['a4','d4'],note:'Демо: ладья становится активной.'};
    if(/пешк|превращ/.test(t))return{glyph:'♙',start:'a7',path:['a8'],note:'Демо: пешка подходит к превращению.'};
    if(/мат|шах|пат/.test(t))return{glyph:'♕',start:'e2',path:['e8'],note:'Демо: проверяем линию шаха и ответы короля.'};
    return{glyph:'♘',start:'d4',path:['f5','e7'],note:'Демо: выберите ход и объясните его идею.'};
  }
  async function install(card,lesson,lab){
    const moves=(lesson.fen&&Array.isArray(lesson.moves)&&lesson.moves.length&&E)?lesson.moves:[];
    if(moves.length)return;
    const board=lab.querySelector('.lesson-system-board'),side=lab.querySelector('.lesson-system-side');if(!board||!side)return;
    const play=$('.lesson-system-actions .btn:nth-child(2)',side),next=$('.lesson-system-actions .btn:nth-child(3)',side),back=$('.lesson-system-actions .btn:nth-child(1)',side),reset=$('.lesson-system-actions .btn:nth-child(4)',side);if(!play||!next||!reset)return;
    const info=$('.lesson-system-info',side),count=$('.lesson-system-count',lab);const spec=pathFor(text(lesson.title));let i=0,busy=false,run=0;
    function draw(){clear(board);put(board,spec.glyph,spec.path[Math.max(0,i-1)]||spec.start);const at=spec.path[Math.max(0,i-1)]||spec.start;board.querySelector('[data-square="'+at+'"]')?.classList.add('focus');if(spec.path[i])board.querySelector('[data-square="'+spec.path[i]+'"]')?.classList.add('to');count.textContent=(i+1)+' / '+(spec.path.length+1);info.textContent=i<spec.path.length?spec.note+' · '+at+' → '+spec.path[i]:spec.note}
    async function step(dir){if(busy)return;const target=Math.max(0,Math.min(spec.path.length,i+dir));if(target===i)return;busy=true;run++;const token=run;const from=dir>0?(i?spec.path[i-1]:spec.start):spec.path[target];const to=dir>0?spec.path[i]:spec.path[target-1];const p=put(board,spec.glyph,from);const a=center(board,from),b=center(board,to);if(a&&b){const anim=p.animate([{left:a.x+'px',top:a.y+'px'},{left:b.x+'px',top:b.y+'px'}],{duration:360,easing:'cubic-bezier(.2,.72,.2,1)',fill:'forwards'});try{await anim.finished}catch(_){}anim.cancel();p.style.left=b.x+'px';p.style.top=b.y+'px'}if(token!==run){busy=false;return}i=target;busy=false;draw()}
    play.textContent='▶ Показать';next.textContent='Следующий →';back.textContent='← Назад';reset.textContent='↺ Сначала';play.onclick=()=>{if(busy)return;run++;i=0;draw();(async()=>{for(let n=0;n<spec.path.length;n++){await step(1);await sleep(100)}})()};next.onclick=()=>step(1);back.onclick=()=>step(-1);reset.onclick=()=>{run++;i=0;draw()};draw();
  }
  function init(){const lessons=window.CHESS_LESSONS,host=$('#lessonList');if(!Array.isArray(lessons)||!host)return;const cards=$$(':scope > .lesson-modern',host);cards.forEach((card,index)=>{const t=$('.lesson-modern-title',card)?.textContent?.trim()||'';const lesson=lessons.find(l=>text(l.title).trim()===t)||lessons[index];const lab=$('.lesson-system',card);if(lesson&&lab&&!lab.dataset.fallbackReady){lab.dataset.fallbackReady='1';install(card,lesson,lab)}})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80),{once:true});else setTimeout(init,80);
})();