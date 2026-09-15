/* SkyySchool — universal interactive chess lessons, v3.
   All lessons use one deterministic replay system: legal engine moves,
   piece-aware animation, reliable cancellation, step navigation and responsive teaching UI. */
'use strict';
(function(){
  const FILES='abcdefgh';
  const GLYPH={1:'♟',2:'♞',3:'♝',4:'♜',5:'♛',6:'♚'};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const PHASES={
    l01:{ru:'Основа',en:'Basics'},l02:{ru:'Основа',en:'Basics'},l03:{ru:'Основа',en:'Basics'},l04:{ru:'Основа',en:'Basics'},
    l05:{ru:'Основа',en:'Basics'},l06:{ru:'Основа',en:'Basics'},l07:{ru:'Тактика',en:'Tactics'},l08:{ru:'Тактика',en:'Tactics'},
    l09:{ru:'Тактика',en:'Tactics'},l10:{ru:'Тактика',en:'Tactics'},l11:{ru:'Дебют',en:'Opening'},l12:{ru:'Дебют',en:'Opening'},
    l13:{ru:'Расчёт',en:'Calculation'},l14:{ru:'Эндшпиль',en:'Endgame'},l15:{ru:'Эндшпиль',en:'Endgame'},l16:{ru:'Практика',en:'Practice'}
  };
  function L(v){return typeof window.Sky?.L==='function'?window.Sky.L(v):(typeof v==='string'?v:(v?.ru||v?.en||''));}
  function esc(v){return String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
  function br(v){return esc(L(v)).replace(/\n/g,'<br>');}
  function snap(st){return E.clone(st);}
  function parseLesson(l){
    const start=E.create(l.fen||E.START_FEN),states=[snap(start)],moves=[];let st=start;
    for(const notation of Array.isArray(l.moves)?l.moves:[]){const m=E.findMove(st,notation);if(!m)break;const before=snap(st),san=E.toSAN(st,m);E.make(st,m);moves.push({move:Object.assign({},m),before,san,after:snap(st),notation});states.push(snap(st));}
    return {states,moves,error:moves.length<(l.moves||[]).length};
  }
  function makeBoard(){
    const b=document.createElement('div');b.className='sli-board';
    for(let r=8;r>=1;r--)for(let f=0;f<8;f++){
      const c=document.createElement('div');c.className='sli-cell '+(((f+r)&1)?'light':'dark');c.dataset.square=FILES[f]+r;
      if(f===0){const x=document.createElement('span');x.className='sli-rank';x.textContent=r;c.appendChild(x);} if(r===1){const x=document.createElement('span');x.className='sli-file';x.textContent=FILES[f];c.appendChild(x);} b.appendChild(c);
    } return b;
  }
  function pieceAt(st,sq){const s=E.fromAlg(sq);return s>=0?st.board[s]:0;}
  function center(b,sq){const c=b.querySelector(`[data-square="${sq}"]`);if(!c)return null;const br=b.getBoundingClientRect(),cr=c.getBoundingClientRect();return{x:cr.left-br.left+cr.width/2,y:cr.top-br.top+cr.height/2};}
  function clearVisual(b){$$('.sli-piece,.sli-dot,.sli-last,.sli-target,.sli-check,.sli-flying',b).forEach(x=>{if(x.classList?.contains('sli-last')||x.classList?.contains('sli-target')||x.classList?.contains('sli-check'))x.classList.remove('sli-last','sli-target','sli-check');else x.remove();});}
  function renderBoard(b,st,last){
    clearVisual(b);
    if(last){b.querySelector(`[data-square="${E.toAlg(last.from)}"]`)?.classList.add('sli-last');b.querySelector(`[data-square="${E.toAlg(last.to)}"]`)?.classList.add('sli-target');}
    if(E.inCheck(st))b.querySelector(`[data-square="${E.toAlg(st.kings[st.turn])}"]`)?.classList.add('sli-check');
    for(let r=8;r>=1;r--)for(let f=0;f<8;f++){const sq=FILES[f]+r,p=pieceAt(st,sq),c=b.querySelector(`[data-square="${sq}"]`);if(!p||!c)continue;const el=document.createElement('span');el.className='sli-piece '+((p&8)?'black':'white');el.textContent=GLYPH[p&7];el.dataset.square=sq;c.appendChild(el);}
  }
  function animateSegment(b,p,from,to,duration,signal){
    const a=center(b,from),z=center(b,to);if(!a||!z||signal.cancelled)return Promise.resolve();
    return new Promise(resolve=>{
      let start=null,raf=0,done=false;
      const finish=()=>{if(done)return;done=true;cancelAnimationFrame(raf);resolve();};
      signal.cancel=finish;
      p.style.position='absolute';p.style.left=a.x+'px';p.style.top=a.y+'px';p.style.transform='translate(-50%,-50%)';
      const ease=t=>1-Math.pow(1-t,3);
      const tick=now=>{if(signal.cancelled)return finish();if(start===null)start=now;const t=Math.min(1,(now-start)/duration),e=ease(t);p.style.left=(a.x+(z.x-a.x)*e)+'px';p.style.top=(a.y+(z.y-a.y)*e)+'px';if(t<1)raf=requestAnimationFrame(tick);else finish();};
      raf=requestAnimationFrame(tick);
    });
  }
  function knightWay(from,to){
    const fa=E.fileOf(from),ra=E.rankOf(from),fb=E.fileOf(to),rb=E.rankOf(to),dx=fb-fa,dy=rb-ra;
    if(Math.abs(dx)===2&&Math.abs(dy)===1)return [FILES[fa+(dx>0?2:-2)]+(ra+1),E.toAlg(to)];
    if(Math.abs(dx)===1&&Math.abs(dy)===2)return [FILES[fa]+(ra+(dy>0?3:-1)),E.toAlg(to)];
    return [E.toAlg(to)];
  }
  async function animateOne(b,info,signal){
    if(signal.cancelled)return;
    const m=info.move,from=E.toAlg(m.from),to=E.toAlg(m.to),type=m.piece&7;
    const source=b.querySelector(`[data-square="${from}"]`),piece=source?.querySelector('.sli-piece');
    if(!source||!piece){renderBoard(b,info.after,m);return;}
    const victim=b.querySelector(`[data-square="${to}"] .sli-piece`);if(m.captured&&victim)victim.classList.add('sli-taken');
    b.appendChild(piece);piece.classList.add('sli-flying');
    const path=type===E.KNIGHT?knightWay(m.from,m.to):[to];let cur=from;
    for(const next of path){if(signal.cancelled)break;await animateSegment(b,piece,cur,next,type===E.KNIGHT?210:320,signal);cur=next;}
    if(!signal.cancelled)renderBoard(b,info.after,m);
  }
  function buildCard(l,i,total){
    const data=parseLesson(l),phase=PHASES[l.id]||{ru:'Практика',en:'Practice'};
    const card=document.createElement('article');card.className='lesson lesson-system';card.dataset.lessonId=l.id;
    card.innerHTML=`<button type="button" class="lesson-system-head" aria-expanded="false"><span class="lesson-index">${String(i+1).padStart(2,'0')}</span><span class="lesson-title-wrap"><strong></strong><small></small></span><span class="lesson-count"></span><span class="arrow">›</span></button><div class="lesson-system-body hidden"><div class="lesson-copy"><div class="lesson-phase"></div><div class="lesson-goal"></div><div class="lesson-text"></div><div class="lesson-tip"><b>Подсказка</b><span></span></div></div><div class="lesson-interactive"><div class="lesson-interactive-head"><div><small>ИНТЕРАКТИВНЫЙ УРОК</small><strong></strong></div><span class="lesson-step"></span></div><div class="lesson-board-host"></div><div class="lesson-caption"><span></span><b></b></div><div class="lesson-controls"><button type="button" data-act="prev">← Назад</button><button type="button" data-act="play" class="primary">▶ Показать ход</button><button type="button" data-act="next">Дальше →</button><button type="button" data-act="reset">↺ Сначала</button><label><input type="checkbox" data-act="auto"> Автоповтор</label></div><div class="lesson-moves"></div><div class="lesson-progress"><i></i></div><div class="lesson-error"></div></div></div>`;
    $('.lesson-title-wrap strong',card).textContent=L(l.title);$('.lesson-title-wrap small',card).textContent=L(phase)+' · '+L(l.level);$('.lesson-count',card).textContent=data.moves.length?`${data.moves.length} ход.`:'';
    $('.lesson-phase',card).textContent=L(l.level);$('.lesson-goal',card).textContent=L(l.goal);$('.lesson-text',card).innerHTML=br(l.body);$('.lesson-tip span',card).textContent=L(l.tip);$('.lesson-interactive-head strong',card).textContent=L(l.title);
    const board=makeBoard();$('.lesson-board-host',card).appendChild(board);
    let idx=0,playing=false,timer=0,runToken=0,currentSignal={cancelled:false,cancel:null};
    function paint(){const st=data.states[idx]||data.states[0],last=idx?data.moves[idx-1].move:null;renderBoard(board,st,last);$('.lesson-step',card).textContent=`${idx}/${data.moves.length}`;$('.lesson-caption span',card).textContent=idx?'Ход '+idx:'Стартовая позиция';$('.lesson-caption b',card).textContent=idx?(data.moves[idx-1]?.san||''):'Готовьтесь';$('.lesson-progress i',card).style.width=(data.moves.length?idx/data.moves.length*100:0)+'%';$$('.lesson-move',card).forEach(x=>x.classList.remove('active'));$('.lesson-move[data-index="'+idx+'"]',card)?.classList.add('active');}
    function stop(){playing=false;clearTimeout(timer);runToken++;currentSignal.cancelled=true;currentSignal.cancel?.();currentSignal={cancelled:false,cancel:null};}
    async function go(target,animate=true){stop();target=Math.max(0,Math.min(data.moves.length,target));if(target===idx){paint();return;}const my=runToken;const signal=currentSignal;if(!animate||target<idx){idx=target;paint();return;}while(idx<target&&my===runToken&&!signal.cancelled){const step=data.moves[idx];if(!step)break;await animateOne(board,step,signal);if(my!==runToken||signal.cancelled)return;idx++;paint();}}
    async function autoplay(){if(playing||!data.moves.length)return;stop();if(idx>=data.moves.length)idx=0;playing=true;const my=runToken,signal=currentSignal;while(playing&&my===runToken&&!signal.cancelled){if(idx>=data.moves.length)break;await animateOne(board,data.moves[idx],signal);if(my!==runToken||signal.cancelled)break;idx++;paint();await new Promise(r=>setTimeout(r,380));}if(my===runToken){playing=false;}}
    const movesHost=$('.lesson-moves',card);const start=document.createElement('button');start.type='button';start.className='lesson-move';start.dataset.index='0';start.textContent='Старт';start.onclick=()=>go(0,false);movesHost.appendChild(start);data.moves.forEach((m,n)=>{const b=document.createElement('button');b.type='button';b.className='lesson-move';b.dataset.index=String(n+1);b.innerHTML=`<span>${n+1}</span><b>${esc(m.san)}</b>`;b.onclick=()=>go(n+1,false);movesHost.appendChild(b);});
    $('.lesson-system-head',card).onclick=()=>{const body=$('.lesson-system-body',card);if(body.classList.contains('hidden')){body.classList.remove('hidden');$('.lesson-system-head',card).setAttribute('aria-expanded','true');requestAnimationFrame(paint);}else{stop();body.classList.add('hidden');$('.lesson-system-head',card).setAttribute('aria-expanded','false');}};
    $('[data-act="prev"]',card).onclick=()=>go(idx-1,true);$('[data-act="next"]',card).onclick=()=>go(idx+1,true);$('[data-act="play"]',card).onclick=autoplay;$('[data-act="reset"]',card).onclick=()=>{stop();idx=0;paint();};$('[data-act="auto"]',card).onchange=e=>e.target.checked?autoplay():stop();
    if(data.error) $('.lesson-error',card).textContent='В исходных данных есть ход, который движок не смог разобрать.';
    paint();return card;
  }
  function style(){
    if($('#sli-v3-style'))return;const s=document.createElement('style');s.id='sli-v3-style';s.textContent=`
      #tab-lessons #lessonList{display:grid!important;gap:12px!important}#tab-lessons .lesson-system{border:1px solid var(--line)!important;border-radius:18px!important;background:var(--panel)!important;overflow:hidden!important}
      #tab-lessons .lesson-system-head{width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr) auto 18px!important;align-items:center!important;gap:10px!important;padding:11px 14px!important;min-height:64px!important;border:0!important;background:transparent!important;color:var(--ink)!important;text-align:left!important;cursor:pointer!important}.lesson-system-head:hover{background:var(--panel-2)!important}.lesson-index{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:var(--m-chess-soft);color:var(--m-chess);font:900 10px Nunito}.lesson-title-wrap{min-width:0;display:grid;gap:2px}.lesson-title-wrap strong{font:900 13px/1.3 Nunito;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lesson-title-wrap small{font:800 9px Nunito;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}.lesson-count{font:800 9px Nunito;color:var(--muted)}.lesson-system-head .arrow{font-size:18px;color:var(--muted);transition:transform .18s}.lesson-system-head[aria-expanded=true] .arrow{transform:rotate(90deg)}
      #tab-lessons .lesson-system-body{display:grid!important;grid-template-columns:minmax(260px,1fr) minmax(390px,440px)!important;gap:18px!important;padding:0 14px 14px!important}.lesson-copy{padding:10px 3px}.lesson-phase{font:900 9px Nunito;color:var(--m-chess);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}.lesson-goal{font:900 17px/1.35 Nunito;color:var(--ink);margin-bottom:12px}.lesson-text{font:500 12.5px/1.7 Nunito;color:var(--ink-2)}.lesson-tip{display:grid;gap:3px;margin-top:13px;padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2)}.lesson-tip b{font:900 9px Nunito;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}.lesson-tip span{font:700 11px/1.5 Nunito;color:var(--ink-2)}
      #tab-lessons .lesson-interactive{padding:11px;border:1px solid var(--line);border-radius:15px;background:linear-gradient(180deg,var(--panel-2),var(--panel));box-shadow:var(--shadow-sm);min-width:0}.lesson-interactive-head{display:flex;justify-content:space-between;gap:9px;align-items:flex-start;margin-bottom:8px}.lesson-interactive-head div{display:grid;gap:2px}.lesson-interactive-head small{font:900 8px Nunito;color:var(--m-chess);letter-spacing:.08em}.lesson-interactive-head strong{font:900 12px Nunito;color:var(--ink);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lesson-step{font:900 9px Nunito;color:var(--muted)}#tab-lessons .lesson-board-host{width:min(400px,100%);aspect-ratio:1;margin:0 auto}.sli-board{position:relative;width:100%;height:100%;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);overflow:hidden;border:1px solid var(--line-2);border-radius:13px;isolation:isolate}.sli-cell{position:relative;display:grid;place-items:center;min-width:0;min-height:0}.sli-cell.light{background:var(--board-light)}.sli-cell.dark{background:var(--board-dark)}.sli-piece{position:relative;z-index:3;font:clamp(24px,5vw,42px)/1 "DejaVu Sans","Segoe UI Symbol",serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);user-select:none;pointer-events:none}.sli-piece.black{color:#171b21;text-shadow:0 1px 2px rgba(255,255,255,.35)}.sli-flying{position:absolute!important;z-index:20!important;will-change:left,top}.sli-taken{opacity:.18!important;transform:scale(.85)!important}.sli-cell.sli-last{box-shadow:inset 0 0 0 2px rgba(126,91,255,.32)}.sli-cell.sli-target{box-shadow:inset 0 0 0 3px rgba(126,91,255,.72)}.sli-cell.sli-check{box-shadow:inset 0 0 0 3px rgba(236,72,153,.72)}.sli-rank,.sli-file{position:absolute;font:900 7px Nunito;opacity:.7;z-index:2}.sli-rank{left:3px;top:2px}.sli-file{right:3px;bottom:2px}
      #tab-lessons .lesson-caption{display:flex;justify-content:space-between;gap:8px;padding:8px 2px 7px;font:800 9px Nunito;color:var(--muted)}.lesson-caption b{font-size:14px;color:var(--ink)}.lesson-controls{display:flex;flex-wrap:wrap;gap:6px}.lesson-controls button{border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink-2);padding:6px 8px;font:800 9px Nunito;cursor:pointer}.lesson-controls button:hover{border-color:var(--m-chess);transform:translateY(-1px)}.lesson-controls button.primary{background:var(--m-chess);border-color:var(--m-chess);color:#fff}.lesson-controls label{display:flex;align-items:center;gap:4px;margin-left:auto;font:800 9px Nunito;color:var(--muted)}.lesson-moves{display:flex;gap:4px;overflow:auto;padding:7px 1px 1px}.lesson-move{display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink-2);padding:5px 7px;font:800 9px Nunito;cursor:pointer}.lesson-move.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}.lesson-progress{height:3px;border-radius:3px;background:var(--line);overflow:hidden;margin-top:5px}.lesson-progress i{display:block;height:100%;width:0;background:var(--m-chess);transition:width .2s}.lesson-error{min-height:0;margin-top:5px;font:700 8px/1.4 Nunito;color:#b45309}
      @media(max-width:900px){#tab-lessons .lesson-system-body{grid-template-columns:1fr!important}#tab-lessons .lesson-board-host{width:min(420px,100%)}}@media(max-width:560px){#tab-lessons .lesson-system-head{grid-template-columns:30px minmax(0,1fr) 18px;padding:9px 10px}.lesson-count{display:none}#tab-lessons .lesson-system-body{padding:0 10px 10px!important}.lesson-goal{font-size:15px}.lesson-text{font-size:12px}.lesson-interactive{padding:8px!important}.lesson-controls label{width:100%;margin-left:0}.lesson-move{padding:5px 6px}}
    `;document.head.appendChild(s);
  }
  function renderAll(){const host=$('#lessonList'),lessons=window.CHESS_LESSONS;if(!host||!Array.isArray(lessons)||!window.E)return;const cards=lessons.map((l,i)=>buildCard(l,i,lessons.length));host.replaceChildren(...cards);host.dataset.lessonSystem='v3';cards[0]?.classList.add('open');$('.lesson-system-body',cards[0])?.classList.remove('hidden');$('.lesson-system-head',cards[0])?.setAttribute('aria-expanded','true');}
  function watch(){const host=$('#lessonList');if(!host||host.__sliObserver)return;const obs=new MutationObserver(()=>{clearTimeout(host.__sliTimer);host.__sliTimer=setTimeout(()=>{if(host.dataset.lessonSystem!=='v3')renderAll();},20);});obs.observe(host,{childList:true,subtree:true});host.__sliObserver=obs;}
  function init(){style();watch();renderAll();watch();}
  function boot(){if(window.E&&window.CHESS_LESSONS&&$('#lessonList'))init();else setTimeout(boot,40);}
  boot();document.addEventListener('langchange',()=>setTimeout(()=>{const host=$('#lessonList');if(host)host.dataset.lessonSystem='';renderAll();},0));
})();