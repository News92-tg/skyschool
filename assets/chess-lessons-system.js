/* SkyySchool — Unified Interactive Chess Lessons
   One consistent teaching surface for every lesson. Specialised behaviour is
   selected from the lesson topic; all boards stay isolated from live games. */
'use strict';
(function(){
  const E=window.ChessEngine;
  const FILES='abcdefgh';
  const ICON={p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
  const WHITE={p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'};
  const LABEL={p:'пешка',n:'конь',b:'слон',r:'ладья',q:'ферзь',k:'король'};
  const PIECE_DEMOS={
    pawn:{name:'Пешка',glyph:'♙',start:'d4',path:['d5','d6','d7'],note:'Идёт вперёд по вертикали; берёт по диагонали.'},
    knight:{name:'Конь',glyph:'♘',start:'d4',path:['f5','e7','c6','b4','a6'],note:'Ходит буквой «Г»: 2 + 1 клетки и перепрыгивает через фигуры.'},
    bishop:{name:'Слон',glyph:'♗',start:'d4',path:['e5','f6','g7','h8'],note:'Ходит только по диагонали и остаётся на цвете исходной клетки.'},
    rook:{name:'Ладья',glyph:'♖',start:'d4',path:['d8','h8'],note:'Ходит только по горизонтали или вертикали.'},
    queen:{name:'Ферзь',glyph:'♕',start:'d4',path:['h8','h4','d4'],note:'Объединяет движения слона и ладьи.'},
    king:{name:'Король',glyph:'♔',start:'d4',path:['e5','e4','d3','c3','c4','c5','d5'],note:'Ровно одна клетка в любом направлении.'}
  };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const lang=()=>document.documentElement.lang==='en'?'en':'ru';
  const text=(v)=>typeof v==='object'?(v[lang()]||v.ru||v.en||''):String(v??'');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function makeBoard(){
    const board=document.createElement('div');board.className='lesson-system-board';
    for(let r=8;r>=1;r--)for(let f=0;f<8;f++){
      const c=document.createElement('button');c.type='button';c.className='lesson-system-cell '+(((f+r)&1)?'light':'dark');
      c.dataset.square=FILES[f]+r;c.setAttribute('aria-label',FILES[f]+r);board.appendChild(c);
    }
    return board;
  }
  function center(board,sq){
    const c=board.querySelector('[data-square="'+sq+'"]');if(!c)return null;
    const br=board.getBoundingClientRect(),cr=c.getBoundingClientRect();
    return{x:cr.left-br.left+cr.width/2,y:cr.top-br.top+cr.height/2};
  }
  function clear(board){
    $$('.lesson-system-cell',board).forEach(c=>c.classList.remove('from','to','target','focus','danger','center','key','check','fork','pin','route'));
    $$('.lesson-system-float',board).forEach(p=>p.remove());
  }
  function put(board,glyph,sq,cls='lesson-system-float'){
    let p=board.querySelector('.lesson-system-float.moving');
    if(!p){p=document.createElement('span');p.className=cls+' moving';board.appendChild(p);}
    p.textContent=glyph;const pos=center(board,sq);if(pos){p.style.left=pos.x+'px';p.style.top=pos.y+'px';p.style.transform='translate(-50%,-50%)';}return p;
  }
  function showPosition(board,fen){
    clear(board);if(!E)return E?.START_FEN;
    const st=E.create(fen||E.START_FEN);
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){
      const s=E.sq(f,r),p=st.board[s];if(!p)continue;const cell=board.querySelector('[data-square="'+E.toAlg(s)+'"]');if(!cell)continue;
      const type=['','p','n','b','r','q','k'][p&7];const span=document.createElement('span');span.className='lesson-system-static '+((p&8)?'black':'white');span.textContent=ICON[type];cell.appendChild(span);
    }
    return st;
  }
  function mark(board,sqs,cls){sqs.filter(Boolean).forEach(s=>board.querySelector('[data-square="'+s+'"]')?.classList.add(cls));}

  function replay(fen,moves){
    if(!E||!fen||!Array.isArray(moves))return[];
    const st=E.create(fen),out=[];
    for(const n of moves){const m=E.findMove(st,n);if(!m)break;const item={m,from:E.toAlg(m.from),to:E.toAlg(m.to),san:E.toSAN(st,m),before:E.fen(st)};E.make(st,m);item.after=E.fen(st);item.status=E.status(st);out.push(item);}
    return out;
  }
  function glyphAt(fen,seq,index,move){
    if(!E||!fen)return'♙';const st=E.create(fen);for(let i=0;i<index;i++)E.make(st,seq[i].m);const p=st.board[move.m.from];return WHITE[['','p','n','b','r','q','k'][p&7]]||'♙';
  }
  async function animate(board,p,from,to,ms=380){
    const a=board.querySelector('[data-square="'+from+'"]'),b=board.querySelector('[data-square="'+to+'"]');if(!a||!b)return;
    const pa=center(board,from),pb=center(board,to);p.style.left=pa.x+'px';p.style.top=pa.y+'px';
    const anim=p.animate([{left:pa.x+'px',top:pa.y+'px'},{left:pb.x+'px',top:pb.y+'px'}],{duration:ms,easing:'cubic-bezier(.2,.72,.2,1)',fill:'forwards'});
    try{await anim.finished}catch(_){return}p.style.left=pb.x+'px';p.style.top=pb.y+'px';anim.cancel();
  }
  function knightTargets(from,to){
    const a={f:FILES.indexOf(from[0]),r:+from[1]},b={f:FILES.indexOf(to[0]),r:+to[1]};
    if(Math.abs(b.f-a.f)===2&&Math.abs(b.r-a.r)===1)return[FILES[a.f+(b.f>a.f?2:-2)]+a.r,to];
    if(Math.abs(b.f-a.f)===1&&Math.abs(b.r-a.r)===2)return[FILES[a.f]+(a.r+(b.r>a.r?2:-2)),to];
    return[to];
  }
  function describe(kind,item,index){
    const ru={
      capture:'Сейчас главное — увидеть взятие и сразу спросить: «Чем соперник ответит?»',
      states:'После хода проверяем состояние короля и наличие легальных спасений.',
      castling:'Рокировка — один ход, в котором одновременно перемещаются король и ладья.',
      promotion:'Пешка дошла до последней горизонтали и должна превратиться в новую фигуру.',
      fork:'Ищем две цели, которые после этого хода атакуются одновременно.',
      pin:'Смотрим, что стоит за фигурой по линии атаки: король, ферзь или ладья.',
      discovered:'Фигура ушла и открыла линию для второй атакующей фигуры.',
      opening:'Ход оцениваем через центр, развитие и безопасность короля.',
      center:'Центральные поля дают фигурам пространство и больше вариантов.',
      forcing:'Сначала проверяем шахи, затем сильные взятия, затем прямые угрозы.',
      endgame:'В эндшпиле особенно важны темпы, активность короля и ключевые поля.',
      mistakes:'Перед ходом включаем короткий фильтр: шахи, взятия, угрозы, ответ соперника.',
      generic:'Посмотри на ход, назови его идею и только потом переходи к следующему шагу.'
    };
    const en={
      capture:'Focus on the capture, then immediately ask what the opponent can take back.',states:'After the move, check the king and every legal escape.',castling:'Castling moves the king and rook as one move, but only under strict conditions.',promotion:'A pawn reaching the last rank must promote to a new piece.',fork:'Look for two targets attacked at the same time after the move.',pin:'Look behind the pinned piece along the line: king, queen or rook.',discovered:'The moving piece opens a line for a second attacking piece.',opening:'Judge the move by centre, development and king safety.',center:'Central squares give pieces space and more options.',forcing:'Start with checks, then strong captures, then direct threats.',endgame:'In the endgame, tempi, king activity and key squares matter most.',mistakes:'Use a quick filter before every move: checks, captures, threats and replies.',generic:'Name the move’s idea before moving to the next step.'
    };return(lang()==='en'?en:ru)[kind]||((lang()==='en'?'Step ':'Шаг ')+(index+1));
  }
  function classify(l){
    const t=text(l.title).toLowerCase();
    if(/доск|координат/.test(t))return'coords';
    if(/как ходят фигуры|движени.*фигур/.test(t))return'pieces';
    if(/взят|защит/.test(t))return'capture';
    if(/шах, мат|мат в один|шах.*мат|мат и пат/.test(t))return'states';
    if(/рокиров/.test(t))return'castling';
    if(/превращ/.test(t))return'promotion';
    if(/вилка/.test(t))return'fork';
    if(/связк/.test(t))return'pin';
    if(/вскрыт/.test(t))return'discovered';
    if(/дебют|принцип/.test(t))return'opening';
    if(/центр/.test(t))return'center';
    if(/форсирован/.test(t))return'forcing';
    if(/эндшпил|проходн|ладья позади/.test(t))return'endgame';
    if(/ошиб/.test(t))return'mistakes';
    return'generic';
  }
  function titleFor(kind){
    return({coords:'Тренажёр координат',pieces:'Лаборатория движений',capture:'Разбор взятия и защиты',states:'Проверка состояния позиции',castling:'Рокировка по шагам',promotion:'Превращение пешки по шагам',fork:'Лаборатория двойной атаки',pin:'Линия связки',discovered:'Лаборатория вскрытого нападения',opening:'Дебют по шагам',center:'Карта центра',forcing:'Шахи → взятия → угрозы',endgame:'Эндшпиль: темпы и ключевые поля',mistakes:'Антиошибочный фильтр',generic:'Практика по теме урока'})[kind];
  }
  function shell(lesson){
    const host=document.createElement('div');host.className='lesson-system';
    const top=document.createElement('div');top.className='lesson-system-top';
    const eyebrow=document.createElement('span');eyebrow.className='lesson-system-eyebrow';eyebrow.textContent='ИНТЕРАКТИВНАЯ ЛАБОРАТОРИЯ';
    const ttl=document.createElement('b');ttl.className='lesson-system-title';ttl.textContent=titleFor(classify(lesson));
    const count=document.createElement('span');count.className='lesson-system-count';top.append(eyebrow,ttl,count);host.appendChild(top);
    const body=document.createElement('div');body.className='lesson-system-body';const board=makeBoard();const side=document.createElement('div');side.className='lesson-system-side';body.append(board,side);host.appendChild(body);
    return{lesson,host,board,side,count,actions:null,run:0,busy:false};
  }
  function actions(ctx){
    const row=document.createElement('div');row.className='lesson-system-actions';
    const back=document.createElement('button');back.className='btn ghost small';back.type='button';back.textContent='← Назад';
    const play=document.createElement('button');play.className='btn chess small';play.type='button';play.textContent='▶ Показать';
    const next=document.createElement('button');next.className='btn chess small';next.type='button';next.textContent='Следующий →';
    const reset=document.createElement('button');reset.className='btn ghost small';reset.type='button';reset.textContent='↺ Сначала';
    row.append(back,play,next,reset);ctx.side.appendChild(row);ctx.actions={back,play,next,reset};
  }
  function commonText(ctx,question){
    const goal=document.createElement('div');goal.className='lesson-system-card-title';goal.textContent=text(ctx.lesson.goal)||text(ctx.lesson.title);
    const q=document.createElement('div');q.className='lesson-system-question';q.textContent=question||text(ctx.lesson.body);
    const info=document.createElement('div');info.className='lesson-system-info';
    const tip=document.createElement('div');tip.className='lesson-system-tip';tip.textContent=text(ctx.lesson.tip);
    ctx.side.append(goal,q,info,tip);ctx.info=info;
  }

  function coords(ctx){
    commonText(ctx,'Нажмите на указанное поле. Сначала найдите букву, затем цифру.');
    const score=document.createElement('div');score.className='lesson-system-score';ctx.side.insertBefore(score,ctx.info);
    const fields=['e4','c7','h1','a8','d5','g2','f6','b2'];let i=0,ok=0,target='';
    const render=()=>{target=fields[i%fields.length];i++;score.textContent='Верно: '+ok;ctx.count.textContent=ok+' найдено';clear(ctx.board);mark(ctx.board,[target],'target');ctx.info.textContent='Найдите '+target;};
    ctx.board.addEventListener('click',e=>{const s=e.target.closest('[data-square]')?.dataset.square;if(!s)return;if(s===target){ok++;e.target.classList.remove('target');e.target.classList.add('check');ctx.info.textContent='Верно. Следующее поле.';setTimeout(render,380)}else{e.target.classList.add('danger');ctx.info.textContent='Не это поле. Подсказка: буква + цифра.';setTimeout(()=>e.target.classList.remove('danger'),250)}});
    actions(ctx);ctx.actions.play.textContent='Подсказка';ctx.actions.play.addEventListener('click',()=>{ctx.info.textContent='Буквы a–h идут по вертикали, цифры 1–8 — по горизонтали.';mark(ctx.board,[target],'focus')});ctx.actions.next.addEventListener('click',render);ctx.actions.back.addEventListener('click',()=>{i=Math.max(0,i-2);render()});ctx.actions.reset.addEventListener('click',()=>{i=0;ok=0;render()});render();
  }

  function pieces(ctx){
    commonText(ctx,'Выберите фигуру и посмотрите её движение по клеткам.');
    const grid=document.createElement('div');grid.className='lesson-system-piece-grid';ctx.side.insertBefore(grid,ctx.info);
    let current='pawn',stop=false;
    Object.entries(PIECE_DEMOS).forEach(([key,d])=>{const b=document.createElement('button');b.type='button';b.className='lesson-system-piece-choice';b.innerHTML='<span>'+d.glyph+'</span><em>'+d.name+'</em>';b.addEventListener('click',()=>{current=key;grid.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');play()});grid.appendChild(b)});
    async function play(){if(ctx.busy)return;ctx.busy=true;ctx.run++;const token=ctx.run;stop=false;const d=PIECE_DEMOS[current],path=[d.start,...d.path];for(let i=0;i<path.length-1;i++){if(token!==ctx.run||stop)break;clear(ctx.board);mark(ctx.board,[path[i]],'from');mark(ctx.board,[path[i+1]],'to');ctx.count.textContent=(i+2)+' / '+path.length;ctx.info.textContent=d.name+' · '+path[i]+' → '+path[i+1];const p=put(ctx.board,d.glyph,path[i]);if(current==='knight'){for(const s of knightTargets(path[i],path[i+1]))await animate(ctx.board,p,d.glyph,p.dataset.square||path[i],s,190); }else await animate(ctx.board,p,d.glyph,path[i],path[i+1],320);await sleep(80)}ctx.busy=false;ctx.info.textContent=d.note;setTimeout(()=>{if(token===ctx.run)renderPiece()},550)}
    function renderPiece(){clear(ctx.board);const d=PIECE_DEMOS[current];put(ctx.board,d.glyph,d.start);mark(ctx.board,[d.start],'from');ctx.count.textContent='1 / '+d.path.length;ctx.info.textContent=d.note}
    actions(ctx);ctx.actions.play.addEventListener('click',play);ctx.actions.next.addEventListener('click',play);ctx.actions.back.addEventListener('click',()=>{ctx.run++;stop=true;renderPiece()});ctx.actions.reset.addEventListener('click',()=>{ctx.run++;stop=true;renderPiece()});grid.querySelector('button')?.classList.add('active');renderPiece();setTimeout(play,500);
  }

  function standard(ctx,kind){
    const moves=replay(ctx.lesson.fen,ctx.lesson.moves||[]);
    commonText(ctx,describe(kind,null,0));
    const meta=document.createElement('div');meta.className='lesson-system-meta';ctx.side.insertBefore(meta,ctx.info);
    actions(ctx);let index=0;
    function draw(){clear(ctx.board);const before=index===0?(ctx.lesson.fen||E.START_FEN):(moves[index-1]?.after||ctx.lesson.fen||E.START_FEN);const st=showPosition(ctx.board,before);ctx.count.textContent=(index+1)+' / '+Math.max(1,moves.length+1);const m=moves[index];if(!m){ctx.info.textContent=finishText(kind);postMark(ctx,kind,index,st,moves);meta.textContent='Готово';return}mark(ctx.board,[m.from],'from');mark(ctx.board,[m.to],'to');ctx.info.textContent=describe(kind,m,index);meta.textContent=m.san+' · '+m.from+' → '+m.to;postMark(ctx,kind,index,st,moves)}
    async function step(dir){if(ctx.busy||!moves.length)return;const target=Math.max(0,Math.min(moves.length,index+dir));if(target===index)return;ctx.busy=true;ctx.run++;const token=ctx.run;const m=dir>0?moves[index]:moves[target];const start=dir>0?m.from:m.to;const end=dir>0?m.to:m.from;const glyph=glyphAt(ctx.lesson.fen||E.START_FEN,moves,dir>0?index:target,m);clear(ctx.board);mark(ctx.board,[start],dir>0?'from':'to');mark(ctx.board,[end],dir>0?'to':'from');const p=put(ctx.board,glyph,start);if(kind==='castling'&&m.m.flags.includes('k')||kind==='castling'&&m.m.flags.includes('q')){await animate(ctx.board,p,glyph,start,end,330);const rook=castleRook(start,end);if(rook){const rp=put(ctx.board,'♖',rook.from);await animate(ctx.board,rp,'♖',rook.from,rook.to,300)}}else if(kind==='promotion'&&m.m.promotion){await animate(ctx.board,p,glyph,start,end,430);p.textContent=WHITE[['','p','n','b','r','q','k'][m.m.promotion]]||'♕'}else await animate(ctx.board,p,glyph,start,end,dir>0?430:300);if(token!==ctx.run){ctx.busy=false;return}index=target;ctx.busy=false;draw()}
    ctx.actions.play.addEventListener('click',async()=>{if(ctx.busy)return;index=0;draw();for(let i=0;i<moves.length;i++){await step(1);await sleep(110)}});ctx.actions.next.addEventListener('click',()=>step(1));ctx.actions.back.addEventListener('click',()=>step(-1));ctx.actions.reset.addEventListener('click',()=>{ctx.run++;index=0;draw()});draw();
  }
  function castleRook(from,to){if(from==='e1'&&to==='g1')return{from:'h1',to:'f1'};if(from==='e1'&&to==='c1')return{from:'a1',to:'d1'};if(from==='e8'&&to==='g8')return{from:'h8',to:'f8'};if(from==='e8'&&to==='c8')return{from:'a8',to:'d8'};return null}
  function finishText(kind){return({capture:'Хорошо. Теперь сформулируй, что атакует и что защищает.',states:'Позиция проверена: теперь назови, почему король имеет или не имеет спасение.',castling:'Рокировка завершена. Главное — помнить все условия, а не только красивое перемещение.',promotion:'Превращение завершено. Сравни ферзя и коня в конкретной позиции.',fork:'Теперь назови обе цели двойной атаки.',pin:'Связка найдена. Следующий вопрос: может ли связанная фигура безопасно уйти?',discovered:'Линия открыта. Найди фигуру, которая теперь получила темп.',opening:'Остановись здесь и оцени центр, развитие и безопасность короля.',center:'Центр выделен. Посмотри, сколько линий и полей получают активные фигуры.',forcing:'Кандидат найден. Теперь ищи самый сильный ответ соперника.',endgame:'Позиция разобрана. В эндшпиле считай темпы до ключевых полей.',mistakes:'Фильтр пройден. Только после него выбирай конкретный ход.',generic:'Идея разобрана. Объясни её своими словами.'})[kind]||'Готово.'}
  function postMark(ctx,kind,index,st,moves){
    if(!E)return;if(kind==='center'||kind==='opening')mark(ctx.board,['d4','e4','d5','e5'],'center');
    if(kind==='endgame'){mark(ctx.board,['c4','d4','e4','c5','e5'],'key');}
    if(index<moves.length)return;const last=moves[moves.length-1];if(!last)return;
    const after=E.create(last.after);
    if(kind==='states'){const k=E.toAlg(after.kings[after.turn]);mark(ctx.board,[k],'check');}
    if(kind==='fork'){const mover=after.turn^8;const saved=after.turn;after.turn=mover;const opts=E.generate(after,{legal:false,square:last.to});after.turn=saved;mark(ctx.board,opts.slice(0,4).map(m=>E.toAlg(m.to)),'fork');}
    if(kind==='pin')mark(ctx.board,[last.to],'pin');
    if(kind==='discovered')mark(ctx.board,[last.from,last.to],'route');
  }

  function mistakes(ctx){
    commonText(ctx,'Нажимай пункты перед тем, как принять решение.');
    const list=document.createElement('div');list.className='lesson-system-checklist';ctx.side.insertBefore(list,ctx.info);
    ['Проверил шахи','Проверил взятия','Проверил угрозы','Проверил ответ соперника'].forEach(t=>{const b=document.createElement('button');b.type='button';b.className='lesson-check-item';b.textContent='○ '+t;b.onclick=()=>{b.classList.toggle('done');b.textContent=(b.classList.contains('done')?'✓ ':'○ ')+t;ctx.info.textContent=b.classList.contains('done')?'Пункт отмечен.':'Пункт снят.'};list.appendChild(b)});
    actions(ctx);ctx.actions.play.textContent='Показать идею';ctx.actions.next.textContent='Проверить позицию';ctx.actions.play.addEventListener('click',()=>{showPosition(ctx.board,ctx.lesson.fen||E.START_FEN);mark(ctx.board,['e4','d4','e5','d5'],'center');ctx.info.textContent='Сначала смотри на форсированные ходы и короля.'});ctx.actions.next.addEventListener('click',()=>{ctx.info.textContent='Теперь сформулируй лучший ответ соперника.';mark(ctx.board,['e8'],'focus')});ctx.actions.reset.addEventListener('click',()=>{list.querySelectorAll('.done').forEach(b=>{b.classList.remove('done');b.textContent=b.textContent.replace(/^✓ /,'○ ')});showPosition(ctx.board,ctx.lesson.fen||E.START_FEN);ctx.info.textContent='Готово к проверке.'});showPosition(ctx.board,ctx.lesson.fen||E.START_FEN);mark(ctx.board,['e4','d4','e5','d5'],'center');ctx.count.textContent='0 / 4';
  }
  function finishKind(ctx,kind){
    if(kind==='coords')coords(ctx);else if(kind==='pieces')pieces(ctx);else if(kind==='mistakes')mistakes(ctx);else standard(ctx,kind);
  }

  function style(){
    if($('#lesson-system-style-v1'))return;const s=document.createElement('style');s.id='lesson-system-style-v1';s.textContent=`
      #tab-lessons .lesson-system{width:100%;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--panel-2),var(--panel));padding:13px;box-sizing:border-box;overflow:hidden}
      #tab-lessons .lesson-system-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:11px}.lesson-system-eyebrow{font-size:9px;font-weight:900;color:var(--m-chess);letter-spacing:.08em}.lesson-system-title{font-size:13px;color:var(--ink)}.lesson-system-count{margin-left:auto;padding:4px 8px;border-radius:999px;background:var(--m-chess-soft);color:var(--m-chess);font:800 10px 'JetBrains Mono',monospace}
      #tab-lessons .lesson-system-body{display:grid;grid-template-columns:minmax(250px,380px) minmax(220px,1fr);gap:16px;align-items:start}.lesson-system-board{width:100%;aspect-ratio:1/1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);position:relative;overflow:hidden;border:1px solid var(--line-2);border-radius:13px;box-shadow:var(--shadow-sm)}
      #tab-lessons .lesson-system-cell{position:relative;appearance:none;border:0;margin:0;padding:0;min-width:0;min-height:0;display:grid;place-items:center;cursor:pointer}.lesson-system-cell.light{background:var(--board-light)}.lesson-system-cell.dark{background:var(--board-dark)}
      #tab-lessons .lesson-system-cell.from{box-shadow:inset 0 0 0 3px rgba(126,91,255,.4)}.lesson-system-cell.to{box-shadow:inset 0 0 0 4px rgba(126,91,255,.85)}.lesson-system-cell.target,.lesson-system-cell.focus{box-shadow:inset 0 0 0 4px rgba(126,91,255,.75)}.lesson-system-cell.center{box-shadow:inset 0 0 0 2px rgba(126,91,255,.28)}.lesson-system-cell.key{box-shadow:inset 0 0 0 3px rgba(126,91,255,.48)}.lesson-system-cell.check{box-shadow:inset 0 0 0 4px rgba(52,190,120,.9)}.lesson-system-cell.fork{box-shadow:inset 0 0 0 3px rgba(220,130,40,.85)}.lesson-system-cell.pin{box-shadow:inset 0 0 0 3px rgba(210,80,120,.8)}.lesson-system-cell.route{box-shadow:inset 0 0 0 3px rgba(80,140,220,.8)}.lesson-system-cell.danger{animation:lesson-shake .22s linear 2}
      #tab-lessons .lesson-system-static{font:clamp(22px,5.2vw,40px)/1 'DejaVu Sans','Segoe UI Symbol',serif;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.32))}.lesson-system-static.white{color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.65)}.lesson-system-static.black{color:#141820;text-shadow:0 1px 1px rgba(255,255,255,.35)}
      #tab-lessons .lesson-system-float{position:absolute;z-index:30;font:clamp(22px,5.2vw,40px)/1 'DejaVu Sans','Segoe UI Symbol',serif;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.75);pointer-events:none;will-change:left,top}
      #tab-lessons .lesson-system-side{display:flex;flex-direction:column;gap:8px;min-width:0}.lesson-system-card-title{font-size:13px;font-weight:900;color:var(--ink)}.lesson-system-question{font-size:13px;line-height:1.5;font-weight:900;color:var(--ink)}.lesson-system-info{font-size:11px;line-height:1.5;font-weight:800;color:var(--muted);min-height:18px}.lesson-system-tip{font-size:10.5px;line-height:1.45;padding:8px 10px;border-radius:10px;background:var(--m-chess-soft);color:var(--ink-2)}.lesson-system-meta{padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--panel);font:800 10px 'JetBrains Mono',monospace;color:var(--muted)}.lesson-system-score{font-size:11px;font-weight:900;color:var(--m-chess)}
      #tab-lessons .lesson-system-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:3px}.lesson-system-actions .btn{flex:0 0 auto}
      #tab-lessons .lesson-system-piece-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.lesson-system-piece-choice{display:flex;align-items:center;gap:6px;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:var(--panel);font:800 10px Nunito,sans-serif;color:var(--ink-2);cursor:pointer}.lesson-system-piece-choice span{font:22px/1 'DejaVu Sans','Segoe UI Symbol',serif}.lesson-system-piece-choice em{font-style:normal}.lesson-system-piece-choice.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      #tab-lessons .lesson-system-checklist{display:grid;gap:6px}.lesson-check-item{padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:var(--panel);text-align:left;font:800 10px Nunito,sans-serif;color:var(--ink-2);cursor:pointer}.lesson-check-item.done{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      @keyframes lesson-shake{25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
      @media(max-width:820px){#tab-lessons .lesson-system-body{grid-template-columns:1fr}#tab-lessons .lesson-system-board{max-width:420px;justify-self:center}}
      @media(max-width:560px){#tab-lessons .lesson-system{padding:10px}#tab-lessons .lesson-system-piece-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.lesson-system-piece-choice{justify-content:center;padding:7px 4px}.lesson-system-piece-choice em{font-size:9px}.lesson-system-actions .btn{font-size:10px;padding:7px 9px}}
    `;document.head.appendChild(s);
  }

  function mount(){
    const lessons=window.CHESS_LESSONS,host=document.getElementById('lessonList');if(!Array.isArray(lessons)||!host)return;style();
    const cards=$$(':scope > .lesson-modern',host);
    cards.forEach((card,index)=>{
      if(card.dataset.systemMounted==='1')return;
      const title=card.querySelector('.lesson-modern-title')?.textContent?.trim()||'';
      const lesson=lessons.find(l=>text(l.title).trim()===title)||lessons[index];if(!lesson)return;
      const old=card.querySelector('.lesson-demo');if(!old)return;
      const ctx=shell(lesson);ctx.host.dataset.kind=classify(lesson);finishKind(ctx,classify(lesson));old.replaceWith(ctx.host);card.dataset.systemMounted='1';
    });
  }
  function init(){mount();const host=document.getElementById('lessonList');if(host&&!host.__lessonSystemObserver){const o=new MutationObserver(()=>{clearTimeout(host.__lessonSystemTimer);host.__lessonSystemTimer=setTimeout(mount,35)});o.observe(host,{childList:true,subtree:true});host.__lessonSystemObserver=o}document.addEventListener('langchange',()=>setTimeout(mount,0))}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();