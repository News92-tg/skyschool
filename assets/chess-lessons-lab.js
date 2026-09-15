/* SkyySchool — Interactive Lesson Lab
   Every chess lesson gets its own small teaching simulator.
   The lab is data-driven, deterministic and isolated from game/puzzle boards. */
'use strict';
(function(){
  const E=window.ChessEngine;
  const FILES='abcdefgh';
  const PIECES={p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
  const GLYPHS={pawn:'♙',knight:'♘',bishop:'♗',rook:'♖',queen:'♕',king:'♔'};
  const NAMES={pawn:'Пешка',knight:'Конь',bishop:'Слон',rook:'Ладья',queen:'Ферзь',king:'Король'};

  const esc=s=>String(s??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[m]));
  const tr=(v,lang)=>typeof v==='object'?(v[lang]||v.ru||v.en||''):String(v??'');
  const currentLang=()=>document.documentElement.lang==='en'?'en':'ru';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  function sq(file,rank){return FILES[file]+String(rank);}
  function xy(s){return {f:FILES.indexOf(s[0]),r:Number(s[1])};}
  function center(cell,board){const a=board.getBoundingClientRect(),b=cell.getBoundingClientRect();return{x:b.left-a.left+b.width/2,y:b.top-a.top+b.height/2};}

  function makeBoard(){
    const b=document.createElement('div'); b.className='lesson-lab-board';
    for(let rank=8;rank>=1;rank--) for(let file=0;file<8;file++){
      const c=document.createElement('button'); c.type='button'; c.className='lesson-lab-cell '+(((file+rank)&1)?'light':'dark');
      c.dataset.square=sq(file,rank); c.setAttribute('aria-label',sq(file,rank));
      b.appendChild(c);
    }
    return b;
  }

  function putGlyph(board,glyph,square,className='lesson-lab-piece'){
    let p=board.querySelector('.lesson-lab-piece');
    if(!p){p=document.createElement('span');p.className=className;board.appendChild(p);}
    p.textContent=glyph;
    const cell=board.querySelector('[data-square="'+square+'"]'); if(!cell)return p;
    const pos=center(cell,board); p.style.left=pos.x+'px';p.style.top=pos.y+'px';p.dataset.square=square;
    p.style.transform='translate(-50%,-50%)';p.style.transition='none';
    return p;
  }

  function clearPieces(board){$$('.lesson-lab-piece',board).forEach(n=>n.remove());}
  function mark(board,squares,kind='target'){
    squares.forEach(s=>board.querySelector('[data-square="'+s+'"]')?.classList.add(kind));
  }
  function clearMarks(board){$$('.lesson-lab-cell',board).forEach(c=>c.classList.remove('from','to','target','focus','danger','center','key','pin-line','check'))}

  function animatePiece(board,p,glyph,from,to,ms=420){
    const a=board.querySelector('[data-square="'+from+'"]'),b=board.querySelector('[data-square="'+to+'"]');
    if(!a||!b){return Promise.resolve();}
    const pa=center(a,board),pb=center(b,board);
    p.textContent=glyph;p.style.left=pa.x+'px';p.style.top=pa.y+'px';p.style.transform='translate(-50%,-50%)';p.style.transition='none';
    return new Promise(resolve=>{
      requestAnimationFrame(()=>{
        p.animate([{left:pa.x+'px',top:pa.y+'px'},{left:pb.x+'px',top:pb.y+'px'}],{duration:ms,easing:'cubic-bezier(.18,.78,.2,1)',fill:'forwards'}).finished.then(()=>{
          p.style.left=pb.x+'px';p.style.top=pb.y+'px';p.getAnimations().forEach(a=>a.cancel());resolve();
        });
      });
    });
  }

  function replayMoves(fen,moves){
    if(!E||!fen||!Array.isArray(moves))return [];
    const st=E.create(fen), out=[];
    for(const notation of moves){
      const m=E.findMove(st,notation);
      if(!m) break;
      out.push({move:m,from:E.toAlg(m.from),to:E.toAlg(m.to),san:E.toSAN(st,m),before:E.fen(st)});
      E.make(st,m);
      out[out.length-1].after=E.fen(st); out[out.length-1].status=E.status(st);
    }
    return out;
  }

  function initialPosition(fen){
    if(!E)return null;
    const st=E.create(fen||E.START_FEN), pieces=[];
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){
      const s=E.sq(f,r),p=st.board[s]; if(!p)continue;
      const t=p&7, code=['','p','n','b','r','q','k'][t]; pieces.push({square:E.toAlg(s),glyph:p&8?PIECES[code].toLowerCase?.()||PIECES[code]:PIECES[code],white:!(p&8),type:t});
    }
    return {st,pieces};
  }

  function renderStaticPosition(board,fen,focus=[]){
    clearPieces(board);clearMarks(board);
    if(!E)return;
    const st=E.create(fen||E.START_FEN);
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){
      const s=E.sq(f,r),p=st.board[s];if(!p)continue;
      const cell=board.querySelector('[data-square="'+E.toAlg(s)+'"]'); if(!cell)continue;
      const piece=document.createElement('span');piece.className='lesson-lab-static-piece '+((p&8)?'black':'white');
      const type=PIECES[(['','p','n','b','r','q','k'][p&7])];piece.textContent=type;cell.appendChild(piece);
    }
    mark(board,focus,'focus');
  }

  function fallbackMoves(lesson){
    const title=tr(lesson.title,'ru').toLowerCase();
    if(/дебют|центр|принцип/.test(title))return ['e4','e5','Nf3','Nc6','Bb5'];
    if(/король|проходн|эндшпил/.test(title))return ['Kc4'];
    if(/ладь/.test(title))return ['Ra4'];
    if(/пешк|превращ/.test(title))return ['e4','e5'];
    if(/мат|шах|пат/.test(title))return ['Re8+'];
    return ['e4','e5','Nf3'];
  }

  function movementSpec(){
    return {
      pawn:{start:'d4',path:['d5','d6','d7'],note:'Одна клетка вперёд; со стартовой позиции — две. Бьёт по диагонали.'},
      knight:{start:'d4',path:['f5','e7','c6','b4','a6'],note:'Две клетки в одном направлении и одна в перпендикулярном — буква «Г». Конь перепрыгивает через фигуры.'},
      bishop:{start:'d4',path:['e5','f6','g7','h8'],note:'Только диагонали. Слон всегда остаётся на цвете своей исходной клетки.'},
      rook:{start:'d4',path:['d8','h8'],note:'Только горизонтали и вертикали. Без поворота внутри одного хода.'},
      queen:{start:'d4',path:['h8','h4','d4'],note:'Диагонали, горизонтали и вертикали — сочетание слона и ладьи.'},
      king:{start:'d4',path:['e5','e4','d3','c3','c4','c5','d5'],note:'Ровно одна клетка в любом направлении. Нельзя становиться под шах.'}
    };
  }

  function labShell(lesson){
    const host=document.createElement('div');host.className='lesson-lab';host.dataset.lessonId=lesson.id;
    const head=document.createElement('div');head.className='lesson-lab-head';
    const eyebrow=document.createElement('div');eyebrow.className='lesson-lab-eyebrow';eyebrow.textContent='ИНТЕРАКТИВНАЯ ПРАКТИКА';
    const title=document.createElement('div');title.className='lesson-lab-title';
    const lang=currentLang();title.textContent=lang==='en'?'Do it step by step':'Разберём на доске — по шагам';
    const counter=document.createElement('span');counter.className='lesson-lab-counter';head.append(eyebrow,title,counter);
    host.appendChild(head);
    const body=document.createElement('div');body.className='lesson-lab-body';
    const board=makeBoard();
    const side=document.createElement('div');side.className='lesson-lab-side';
    body.append(board,side);host.appendChild(body);
    return {host,head,body,board,side,counter,lesson};
  }

  function addFooter(side,ctx){
    const actions=document.createElement('div');actions.className='lesson-lab-actions';
    const prev=document.createElement('button');prev.type='button';prev.className='btn ghost small';prev.textContent='← Назад';
    const next=document.createElement('button');next.type='button';next.className='btn chess small';next.textContent='Следующий шаг →';
    const reset=document.createElement('button');reset.type='button';reset.className='btn ghost small';reset.textContent='↺ Сначала';
    actions.append(prev,next,reset);side.appendChild(actions);
    ctx.actions={prev,next,reset};
  }

  function playbackLab(ctx,steps,opt={}){
    const {lesson,board,side,counter}=ctx;
    const moves=replayMoves(lesson.fen,movesOr(lesson,opt));
    const seq=moves.length?moves:[];
    const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent=tr(lesson.goal,currentLang())||tr(lesson.title,currentLang());
    const desc=document.createElement('div');desc.className='lesson-lab-desc';desc.textContent=tr(lesson.body,currentLang());
    const info=document.createElement('div');info.className='lesson-lab-info';
    const chips=document.createElement('div');chips.className='lesson-lab-chips';
    const note=document.createElement('div');note.className='lesson-lab-note';
    side.append(title,desc,chips,info,note); addFooter(side,ctx);
    let index=0,busy=false;
    const update=()=>{
      counter.textContent=(index+1)+' / '+Math.max(1,seq.length+1);
      clearMarks(board);
      if(!lesson.fen){renderStaticPosition(board,E?E.START_FEN:null);return;}
      const before=index===0?lesson.fen:seq[index-1]?.after||lesson.fen;
      renderStaticPosition(board,before);
      const move=seq[index];
      if(move){
        mark(board,[move.from],'from');mark(board,[move.to],'to');chips.replaceChildren(chip(move.san),chip(move.from+' → '+move.to));
        info.textContent=moveExplainer(lesson,move,index);
      }else{chips.replaceChildren(chip('Готово'));info.textContent='Посмотрите, к чему приводит последний ход.';}
      note.textContent=tr(lesson.tip,currentLang());
    };
    const go=async(dir)=>{if(busy)return;const target=Math.max(0,Math.min(seq.length,index+dir));if(target===index)return;busy=true;
      const move=dir>0?seq[index]:seq[target];
      if(move){const glyph=glyphForMove(lesson.fen,index,seq,move);const p=putGlyph(board,glyph,dir>0?move.from:move.to);
        clearMarks(board);mark(board,[dir>0?move.from:move.to],dir>0?'from':'to');
        await animatePiece(board,p,glyph,dir>0?move.from:move.to,dir>0?move.to:move.from,dir>0?430:300);
      }
      index=target;busy=false;update();
    };
    ctx.actions.next.addEventListener('click',()=>go(1));ctx.actions.prev.addEventListener('click',()=>go(-1));ctx.actions.reset.addEventListener('click',()=>{index=0;update();});
    update();
  }

  function movesOr(lesson,opt){return opt.moves||lesson.moves||[];}
  function glyphForMove(fen,index,seq,move){
    if(!E||!fen)return '♙';
    const st=E.create(fen);for(let i=0;i<index;i++)E.make(st,seq[i].move);
    const p=st.board[move.move.from],type=['','p','n','b','r','q','k'][p&7];return PIECES[type]||'♙';
  }
  function moveExplainer(lesson,m,i){
    const title=tr(lesson.title,'ru').toLowerCase();
    if(/взят|защит/.test(title)&&m.move.captured)return 'Взятие: фигура уходит на поле соперника. Теперь сразу ищем ответное взятие.';
    if(/рокиров/.test(title))return 'Рокировка: король и ладья перемещаются одним ходом, но только при выполнении всех условий.';
    if(/превращ/.test(title))return 'Пешка дошла до последней горизонтали и должна выбрать новую фигуру.';
    if(/вилк/.test(title))return 'После хода ищем две цели, которые одна фигура атакует одновременно.';
    if(/связк/.test(title))return 'Сейчас важно заметить линию атаки за фигурой — ей нельзя безопасно уйти.';
    if(/вскрыт/.test(title))return 'Фигура ушла и открыла линию второй атакующей фигуре.';
    if(/мат в один/.test(title))return 'Проверяем все поля вокруг короля: уход, взятие атакующей фигуры и блокировку.';
    if(/центр/.test(title))return 'Центральные поля дают фигурам больше пространства и вариантов.';
    if(/эндшпил|проходн/.test(title))return 'В эндшпиле считаем темпы и ключевые поля, а не только материал.';
    return 'Следим за конкретным ходом и формулируем его смысл одним предложением.';
  }
  function chip(text){const c=document.createElement('span');c.className='lesson-lab-chip';c.textContent=text;return c;}

  function coordLab(ctx){
    const {lesson,board,side,counter}=ctx;const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent='Тренажёр координат';
    const task=document.createElement('div');task.className='lesson-lab-question';
    const info=document.createElement('div');info.className='lesson-lab-info';
    const score=document.createElement('div');score.className='lesson-lab-score';let points=0,round=0,target='';
    const targets=['e4','c7','h1','a8','d5','g2'];
    const render=()=>{target=targets[round%targets.length];round++;counter.textContent=points+' / '+Math.max(0,round-1);task.textContent='Нажмите на поле '+target;clearMarks(board);mark(board,[target],'target');info.textContent='Цель: найти поле без подсказки.';};
    board.addEventListener('click',e=>{const s=e.target.closest('[data-square]')?.dataset.square;if(!s)return;if(s===target){points++;info.textContent='Верно. Следующее поле — сложнее.';e.target.classList.remove('target');e.target.classList.add('check');setTimeout(render,450);}else{info.textContent='Не то поле. Координата читается: буква + цифра.';e.target.classList.add('danger');setTimeout(()=>e.target.classList.remove('danger'),350);}});
    side.append(title,task,score,info);addFooter(side,ctx);ctx.actions.next.textContent='Новое поле →';ctx.actions.next.addEventListener('click',render);ctx.actions.prev.textContent='Подсказка';ctx.actions.prev.addEventListener('click',()=>{info.textContent='Подсказка: буква задаёт вертикаль, цифра — горизонталь.';mark(board,[target],'focus');});ctx.actions.reset.addEventListener('click',()=>{points=0;round=0;render();});render();
  }

  function pieceLab(ctx){
    const {board,side,counter}=ctx;const specs=movementSpec();const controls=document.createElement('div');controls.className='lesson-lab-piece-controls';
    const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent='Покажи правильный рисунок хода';
    const info=document.createElement('div');info.className='lesson-lab-info';const note=document.createElement('div');note.className='lesson-lab-note';
    side.append(title,controls,info,note);addFooter(side,ctx);
    let current='pawn',index=0,running=false;
    Object.entries(specs).forEach(([key,spec])=>{const b=document.createElement('button');b.type='button';b.className='lesson-piece-choice';b.innerHTML='<span>'+GLYPHS[key]+'</span><em>'+NAMES[key]+'</em>';b.addEventListener('click',()=>{current=key;index=0;controls.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');reset();});controls.appendChild(b);});
    function reset(){clearMarks(board);renderStaticPosition(board,E.START_FEN);clearPieces(board);putGlyph(board,GLYPHS[current],specs[current].start);index=0;counter.textContent='1 / '+specs[current].path.length;info.textContent=specs[current].note;note.textContent='Старт: '+specs[current].start;}
    async function play(){if(running)return;running=true;const path=[specs[current].start,...specs[current].path];for(let i=index;i<path.length-1;i++){const from=path[i],to=path[i+1];clearMarks(board);mark(board,[from],'from');mark(board,[to],'to');counter.textContent=(i+2)+' / '+(path.length);info.textContent=from+' → '+to;const p=putGlyph(board,GLYPHS[current],from);if(current==='knight'){
        const a=xy(from),b=xy(to),mx=Math.abs(a.f-b.f)===2?sq((a.f+b.f)/2,a.r):sq(a.f,(a.r+b.r)/2);mark(board,[mx],'target');
        await animatePiece(board,p,GLYPHS[current],from,mx,190);await animatePiece(board,p,GLYPHS[current],mx,to,190);
      }else await animatePiece(board,p,GLYPHS[current],from,to,330);
      await sleep(100);
    }index=0;running=false;setTimeout(reset,650);}
    ctx.actions.next.addEventListener('click',play);ctx.actions.prev.addEventListener('click',()=>{index=0;play();});ctx.actions.reset.addEventListener('click',reset);controls.querySelector('button')?.classList.add('active');reset();
  }

  function tacticalLab(ctx){
    const {lesson,board,side,counter}=ctx;const seq=replayMoves(lesson.fen,lesson.moves||[]);const titleRu=tr(lesson.title,'ru').toLowerCase();
    const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent=tr(lesson.goal,currentLang())||'Тактическая идея';
    const q=document.createElement('div');q.className='lesson-lab-question';
    const info=document.createElement('div');info.className='lesson-lab-info';const note=document.createElement('div');note.className='lesson-lab-note';side.append(title,q,info,note);addFooter(side,ctx);
    let idx=0,busy=false;
    const targets=titleRu.includes('вилк')?['e7','d8']:titleRu.includes('связк')?['e6','e8']:titleRu.includes('вскрыт')?['a1','a8']:[];
    function update(){clearMarks(board);const before=idx?seq[idx-1].after:lesson.fen;if(lesson.fen)renderStaticPosition(board,before);counter.textContent=(idx+1)+' / '+(seq.length+1);const mv=seq[idx];if(mv){mark(board,[mv.from],'from');mark(board,[mv.to],'to');q.textContent='Ход: '+mv.san;info.textContent=moveExplainer(lesson,mv,idx);}else{q.textContent='Идея найдена';info.textContent='Теперь назови две цели или линию, которую ты открыл.';mark(board,targets,'target');}note.textContent=tr(lesson.tip,currentLang());}
    async function next(){if(busy)return;if(idx>=seq.length){idx=0;update();return;}busy=true;const m=seq[idx],p=putGlyph(board,glyphForMove(lesson.fen,idx,seq,m),m.from);clearMarks(board);mark(board,[m.from],'from');mark(board,[m.to],'to');await animatePiece(board,p,p.textContent,m.from,m.to,430);idx++;busy=false;update();}
    ctx.actions.next.addEventListener('click',next);ctx.actions.prev.addEventListener('click',()=>{idx=Math.max(0,idx-1);update();});ctx.actions.reset.addEventListener('click',()=>{idx=0;update();});update();
  }

  function openingLab(ctx){
    const {lesson,board,side,counter}=ctx;const seq=replayMoves(lesson.fen||E.START_FEN,lesson.moves&&lesson.moves.length?lesson.moves:['e4','e5','Nf3','Nc6','Bb5']);
    const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent='Оцениваем позицию после каждого хода';
    const info=document.createElement('div');info.className='lesson-lab-info';const tip=document.createElement('div');tip.className='lesson-lab-note';side.append(title,info,tip);addFooter(side,ctx);
    let i=0,busy=false;
    function draw(){clearMarks(board);const before=i?seq[i-1].after:lesson.fen||E.START_FEN;renderStaticPosition(board,before);counter.textContent=(i+1)+' / '+(seq.length+1);const mv=seq[i];if(mv){mark(board,['d4','e4','d5','e5'],'center');mark(board,[mv.to],'to');info.textContent=mv.san+' — '+openingReason(mv,i);}else{mark(board,['d4','e4','d5','e5'],'center');info.textContent='Стоп: оцени центр, развитие и безопасность короля.'}tip.textContent=tr(lesson.tip,currentLang());}
    async function next(){if(busy)return;if(i>=seq.length){i=0;draw();return;}busy=true;const m=seq[i],p=putGlyph(board,glyphForMove(lesson.fen||E.START_FEN,i,seq,m),m.from);await animatePiece(board,p,p.textContent,m.from,m.to,390);i++;busy=false;draw();}
    ctx.actions.next.addEventListener('click',next);ctx.actions.prev.addEventListener('click',()=>{i=Math.max(0,i-1);draw();});ctx.actions.reset.addEventListener('click',()=>{i=0;draw();});draw();
  }
  function openingReason(m,i){if(i===0)return'борьба за центр';if(i===2||i===3)return'развитие фигур';return'связь центра, развития и безопасности';}

  function endgameLab(ctx){
    const {lesson,board,side,counter}=ctx;const seq=replayMoves(lesson.fen||E.START_FEN,lesson.moves||[]);
    const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent='Эндшпиль: считай темпы и ключевые поля';
    const info=document.createElement('div');info.className='lesson-lab-info';const key=document.createElement('div');key.className='lesson-lab-key';key.textContent='';side.append(title,info,key);addFooter(side,ctx);
    let i=0,busy=false;
    function draw(){clearMarks(board);const before=i?seq[i-1].after:lesson.fen||E.START_FEN;renderStaticPosition(board,before);const highlights=lesson.id==='l14'?['c4','d4','e4','c5','e5']:['a4','d4'];mark(board,highlights,'key');counter.textContent=(i+1)+' / '+(seq.length+1);const m=seq[i];info.textContent=m?m.san+' — активность короля/ладьи важнее пассивной защиты.':'Ключевые поля отмечены.';key.textContent=tr(lesson.tip,currentLang());}
    async function next(){if(busy)return;if(i>=seq.length){i=0;draw();return;}busy=true;const m=seq[i],p=putGlyph(board,glyphForMove(lesson.fen||E.START_FEN,i,seq,m),m.from);await animatePiece(board,p,p.textContent,m.from,m.to,440);i++;busy=false;draw();}
    ctx.actions.next.addEventListener('click',next);ctx.actions.prev.addEventListener('click',()=>{i=Math.max(0,i-1);draw();});ctx.actions.reset.addEventListener('click',()=>{i=0;draw();});draw();
  }

  function practiceLab(ctx){
    const {lesson,board,side,counter}=ctx;const seq=replayMoves(lesson.fen||E.START_FEN,lesson.moves&&lesson.moves.length?lesson.moves:fallbackMoves(lesson));
    const title=document.createElement('div');title.className='lesson-lab-card-title';title.textContent='Микро-практика';
    const info=document.createElement('div');info.className='lesson-lab-info';const checklist=document.createElement('div');checklist.className='lesson-lab-checklist';
    ['Проверь шахи','Проверь взятия','Проверь угрозы','Назови лучший ответ соперника'].forEach(t=>{const l=document.createElement('button');l.type='button';l.className='lesson-check';l.textContent='○ '+t;l.addEventListener('click',()=>{l.classList.toggle('done');l.textContent=l.classList.contains('done')?'✓ '+t:'○ '+t;});checklist.appendChild(l);});
    side.append(title,info,checklist);addFooter(side,ctx);let i=0,busy=false;
    function draw(){clearMarks(board);const before=i?seq[i-1].after:lesson.fen||E.START_FEN;renderStaticPosition(board,before);const m=seq[i];counter.textContent=(i+1)+' / '+(seq.length+1);info.textContent=m?m.san+' — прежде чем нажать «Следующий», сформулируй идею хода.':'Попробуй объяснить весь урок одной фразой.';}
    async function next(){if(busy)return;if(i>=seq.length){i=0;draw();return;}busy=true;const m=seq[i],p=putGlyph(board,glyphForMove(lesson.fen||E.START_FEN,i,seq,m),m.from);mark(board,[m.from],'from');mark(board,[m.to],'to');await animatePiece(board,p,p.textContent,m.from,m.to,390);i++;busy=false;draw();}
    ctx.actions.next.addEventListener('click',next);ctx.actions.prev.addEventListener('click',()=>{i=Math.max(0,i-1);draw();});ctx.actions.reset.addEventListener('click',()=>{i=0;draw();});draw();
  }

  function chooseMode(lesson){
    const t=tr(lesson.title,'ru').toLowerCase();
    if(/доска|координат/.test(t))return'coord';
    if(/ходят фигуры/.test(t))return'pieces';
    if(/взят|защит/.test(t))return'tactical';
    if(/шах, мат|шах|мат и пат|мат в один/.test(t))return'tactical';
    if(/рокиров/.test(t)||/превращ/.test(t))return'tactical';
    if(/вилка|связка|вскрыт/.test(t))return'tactical';
    if(/дебют|центр|принцип/.test(t))return'opening';
    if(/эндшпил|проходн|ладья позади/.test(t))return'endgame';
    return'practice';
  }

  function mountLesson(card,lesson){
    if(card.dataset.labMounted===lesson.id)return;
    card.dataset.labMounted=lesson.id;
    const old=card.querySelector('.lesson-demo');
    if(old)old.replaceChildren();
    const host=old||document.createElement('div');
    host.className='lesson-demo lesson-lab-host';
    const ctx=labShell(lesson);host.replaceChildren(ctx.host);
    if(old)old.replaceWith(host);else card.appendChild(host);
    const mode=chooseMode(lesson);
    if(mode==='coord')coordLab(ctx);
    else if(mode==='pieces')pieceLab(ctx);
    else if(mode==='opening')openingLab(ctx);
    else if(mode==='endgame')endgameLab(ctx);
    else if(mode==='tactical')tacticalLab(ctx);
    else practiceLab(ctx);
  }

  function installStyles(){
    if($('#lesson-lab-style-v1'))return;
    const s=document.createElement('style');s.id='lesson-lab-style-v1';s.textContent=`
      #tab-lessons .lesson-lab-host{padding:0!important;overflow:visible!important;background:transparent!important;border:0!important;box-shadow:none!important}
      #tab-lessons .lesson-lab{width:100%;border:1px solid var(--line);border-radius:16px;background:linear-gradient(180deg,var(--panel-2),var(--panel));padding:13px;box-sizing:border-box;overflow:hidden}
      #tab-lessons .lesson-lab-head{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin-bottom:10px}
      #tab-lessons .lesson-lab-eyebrow{font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--m-chess)}
      #tab-lessons .lesson-lab-title{font-size:13px;font-weight:900;color:var(--ink)}
      #tab-lessons .lesson-lab-counter{margin-left:auto;padding:4px 8px;border-radius:999px;background:var(--m-chess-soft);color:var(--m-chess);font:800 10px 'JetBrains Mono',monospace}
      #tab-lessons .lesson-lab-body{display:grid;grid-template-columns:minmax(240px,360px) minmax(230px,1fr);gap:15px;align-items:start}
      #tab-lessons .lesson-lab-board{width:100%;aspect-ratio:1/1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);position:relative;overflow:hidden;border:1px solid var(--line-2);border-radius:13px;box-shadow:var(--shadow-sm);background:var(--board-light)}
      #tab-lessons .lesson-lab-cell{appearance:none;border:0;padding:0;margin:0;display:grid;place-items:center;position:relative;min-width:0;min-height:0;cursor:pointer}
      #tab-lessons .lesson-lab-cell.light{background:var(--board-light)}#tab-lessons .lesson-lab-cell.dark{background:var(--board-dark)}
      #tab-lessons .lesson-lab-cell.from{box-shadow:inset 0 0 0 3px rgba(126,91,255,.38)}#tab-lessons .lesson-lab-cell.to{box-shadow:inset 0 0 0 4px rgba(126,91,255,.82)}
      #tab-lessons .lesson-lab-cell.target{box-shadow:inset 0 0 0 4px rgba(126,91,255,.9);background:color-mix(in srgb,var(--m-chess-soft) 70%,transparent)}
      #tab-lessons .lesson-lab-cell.focus{box-shadow:inset 0 0 0 3px rgba(126,91,255,.55)}#tab-lessons .lesson-lab-cell.danger{animation:lab-shake .22s linear 0s 2}
      #tab-lessons .lesson-lab-cell.check{box-shadow:inset 0 0 0 4px rgba(45,185,110,.8)}#tab-lessons .lesson-lab-cell.center{outline:2px solid rgba(126,91,255,.24);outline-offset:-2px}
      #tab-lessons .lesson-lab-cell.key{box-shadow:inset 0 0 0 3px rgba(126,91,255,.5)}
      #tab-lessons .lesson-lab-static-piece{font:clamp(22px,5.3vw,39px)/1 'DejaVu Sans','Segoe UI Symbol',serif;pointer-events:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
      #tab-lessons .lesson-lab-static-piece.white{color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.62)}#tab-lessons .lesson-lab-static-piece.black{color:#151922;text-shadow:0 1px 1px rgba(255,255,255,.35)}
      #tab-lessons .lesson-lab-piece{position:absolute;z-index:20;font:clamp(22px,5.2vw,40px)/1 'DejaVu Sans','Segoe UI Symbol',serif;pointer-events:none;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);will-change:left,top}
      #tab-lessons .lesson-lab-side{min-width:0;display:flex;flex-direction:column;gap:8px}
      #tab-lessons .lesson-lab-card-title{font-size:13px;font-weight:900;color:var(--ink)}#tab-lessons .lesson-lab-desc{font-size:11.5px;line-height:1.55;color:var(--ink-2);max-height:140px;overflow:auto}
      #tab-lessons .lesson-lab-question{font-size:15px;line-height:1.4;font-weight:900;color:var(--ink)}#tab-lessons .lesson-lab-info{font-size:11px;line-height:1.5;font-weight:800;color:var(--muted);min-height:18px}
      #tab-lessons .lesson-lab-note{padding:8px 10px;border-radius:10px;background:var(--m-chess-soft);font-size:10.5px;line-height:1.45;color:var(--ink-2)}
      #tab-lessons .lesson-lab-key{padding:9px;border:1px dashed var(--line);border-radius:10px;font-size:10.5px;font-weight:800;color:var(--ink-2)}
      #tab-lessons .lesson-lab-chips{display:flex;gap:6px;flex-wrap:wrap}.lesson-lab-chip{display:inline-flex;padding:4px 7px;border:1px solid var(--line);border-radius:999px;background:var(--panel);font-size:9px;font-weight:900;color:var(--ink-2)}
      #tab-lessons .lesson-lab-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto;padding-top:3px}
      #tab-lessons .lesson-piece-choice{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--line);border-radius:10px;background:var(--panel);font:700 10px Nunito,sans-serif;color:var(--ink-2);cursor:pointer}
      #tab-lessons .lesson-piece-choice span{font:22px/1 'DejaVu Sans','Segoe UI Symbol',serif}.lesson-piece-choice em{font-style:normal}.lesson-piece-choice.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      #tab-lessons .lesson-lab-piece-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      #tab-lessons .lesson-lab-checklist{display:grid;gap:6px}.lesson-check{padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:var(--panel);text-align:left;font:800 10px Nunito,sans-serif;color:var(--ink-2);cursor:pointer}.lesson-check.done{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
      @keyframes lab-shake{25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
      @media(max-width:820px){#tab-lessons .lesson-lab-body{grid-template-columns:1fr}#tab-lessons .lesson-lab-board{max-width:420px;justify-self:center}#tab-lessons .lesson-lab-side{padding-bottom:2px}}
      @media(max-width:560px){#tab-lessons .lesson-lab{padding:10px}#tab-lessons .lesson-lab-body{gap:11px}#tab-lessons .lesson-lab-piece-controls{grid-template-columns:repeat(3,minmax(0,1fr))}#tab-lessons .lesson-piece-choice{justify-content:center;padding:7px 5px}#tab-lessons .lesson-piece-choice em{font-size:9px}#tab-lessons .lesson-lab-board{width:min(100%,360px)}}
    `;document.head.appendChild(s);
  }

  function init(){
    const lessons=window.CHESS_LESSONS,host=document.getElementById('lessonList');if(!Array.isArray(lessons)||!host)return;
    installStyles();
    const mount=()=>{
      const cards=$$(':scope > .lesson-modern',host);
      cards.forEach(card=>{
        const title=card.querySelector('.lesson-modern-title')?.textContent||'';
        const lesson=lessons.find(x=>tr(x.title,'ru')===title)||lessons.find(x=>card.dataset.lessonId===x.id);
        if(lesson)mountLesson(card,lesson);
      });
    };
    mount();
    if(!host.__lessonLabObserver){const o=new MutationObserver(()=>{clearTimeout(host.__lessonLabTimer);host.__lessonLabTimer=setTimeout(mount,25)});o.observe(host,{childList:true,subtree:true});host.__lessonLabObserver=o;}
    document.addEventListener('langchange',()=>setTimeout(mount,0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();