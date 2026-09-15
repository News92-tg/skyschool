/* SkyySchool Chess — interactive rebuild.
   Replaces the previous passive lesson replay and fragile game wrappers.
   Lessons and bot game share the same ChessEngine API. */
'use strict';
(function(root){
  var E=root.ChessEngine, AI=root.ChessAI;
  if(!E) return;
  var GLYPH={1:'♟',2:'♞',3:'♝',4:'♜',5:'♛',6:'♚'};
  var STORE='skyschool.chess.v2';
  function ready(fn){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true}); else setTimeout(fn,0); }
  function ru(s,e){return root.Sky&&root.Sky.lang==='en'?e:s;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
  function state(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch(e){return {};}}
  function save(s){try{localStorage.setItem(STORE,JSON.stringify(s));}catch(e){}}
  function pieceName(p){var k=p&7;return ['','♟','♞','♝','♜','♛','♚'][k]||'';}
  function sideName(c){return c===E.WHITE?ru('белых','White'):ru('чёрных','Black');}
  function sanFor(st,m){try{return E.toSAN(st,m);}catch(e){return E.toAlg(m.from)+E.toAlg(m.to);}}
  function moveBy(st,from,to){var ms=E.generate(st,{legal:true});for(var i=0;i<ms.length;i++)if(ms[i].from===from&&ms[i].to===to)return ms[i];return null;}
  function ensureCss(){
    if(document.getElementById('sky-rebuild-css'))return;
    var s=document.createElement('style');s.id='sky-rebuild-css';s.textContent=`
      .sr-lesson{border:1px solid var(--line);border-radius:18px;background:var(--panel);overflow:hidden;box-shadow:var(--shadow-sm)}
      .sr-lesson + .sr-lesson{margin-top:10px}.sr-head{width:100%;padding:15px 17px;display:flex;gap:11px;align-items:center;text-align:left}.sr-num{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:var(--m-chess-soft);color:var(--m-chess);font-weight:900}.sr-title{font-weight:900;line-height:1.2}.sr-sub{font-size:10.5px;color:var(--muted);font-weight:700;margin-top:3px}.sr-caret{margin-left:auto;font-size:20px;color:var(--muted)}
      .sr-body{padding:0 17px 17px}.sr-card{padding:11px 12px;border:1px solid var(--line);border-radius:13px;background:var(--panel-2);font-size:13px;line-height:1.6}.sr-goal{margin-top:7px}.sr-goal b{color:var(--m-chess)}
      .sr-board{width:min(430px,100%);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);border:1px solid var(--line);border-radius:14px;overflow:hidden;margin:13px auto 0;touch-action:manipulation}.sr-cell{position:relative;display:grid;place-items:center;user-select:none}.sr-cell.light{background:#f0d9b5}.sr-cell.dark{background:#b58863}.sr-cell.sel{box-shadow:inset 0 0 0 4px rgba(126,91,255,.9)}.sr-cell.target:after{content:'';width:25%;height:25%;border-radius:50%;background:rgba(40,40,40,.28)}.sr-cell.capture:after{content:'';position:absolute;width:72%;height:72%;border:3px solid rgba(126,91,255,.72);border-radius:50%}.sr-piece{font:clamp(24px,8vw,42px)/1 "DejaVu Sans","Segoe UI Symbol",serif}.sr-piece.w{color:#fff;text-shadow:0 1px 2px #142238}.sr-piece.b{color:#16191f;text-shadow:0 0 1px rgba(255,255,255,.7)}
      .sr-foot{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.sr-foot .btn{flex:1;min-width:120px}.sr-msg{margin-top:9px;min-height:20px;font-weight:800;font-size:12px}.sr-ok{color:#17834a}.sr-bad{color:#c53b4b}.sr-hint{color:var(--m-chess)}.sr-step{font-family:'JetBrains Mono',monospace;font-weight:800}
      .sr-progress{display:flex;gap:5px;margin:10px 0}.sr-dot{height:6px;flex:1;border-radius:9px;background:var(--line)}.sr-dot.done{background:var(--m-chess)}
      .sr-hud{margin-bottom:13px;padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm)}.sr-hud-top{display:flex;justify-content:space-between;gap:8px;font-weight:900}.sr-hud small{display:block;margin-top:3px;color:var(--muted)}
      .sr-status{padding:10px 12px;border-radius:12px;background:var(--m-chess-soft);font-weight:900}.sr-end{margin-top:12px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel-2)}.sr-end h3{margin:0}.sr-end p{margin:4px 0 0;color:var(--muted);font-size:12px}.sr-end-actions{display:flex;gap:7px;margin-top:10px}.sr-end-actions .btn{flex:1}
      .sr-moves{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;max-height:190px;overflow:auto}.sr-move{padding:5px 7px;border-radius:8px;background:var(--panel-2);font:11px 'JetBrains Mono',monospace}.sr-caps{min-height:22px;letter-spacing:.08em;font-size:18px}.sr-select{font-weight:900}
    `;document.head.appendChild(s);
  }
  function renderLessons(){
    var host=document.getElementById('lessonList');if(!host||!Array.isArray(root.CHESS_LESSONS))return;
    host.innerHTML='';
    var data=state(),done=Array.isArray(data.done)?data.done:[];
    var hud=document.createElement('div');hud.className='sr-hud';hud.innerHTML='<div class="sr-hud-top"><span>'+ru('Интерактивный курс','Interactive course')+'</span><span>'+done.length+'/'+root.CHESS_LESSONS.length+'</span></div><small>'+ru('Урок считается пройденным только после правильного выполнения линии.','A lesson is completed only after you perform the line correctly.')+'</small>';host.appendChild(hud);
    root.CHESS_LESSONS.forEach(function(l,idx){
      var art=document.createElement('article');art.className='sr-lesson';
      var body=document.createElement('div');body.className='sr-body';body.hidden=true;
      var head=document.createElement('button');head.type='button';head.className='sr-head';
      head.innerHTML='<span class="sr-num">'+(idx+1)+'</span><span><span class="sr-title">'+esc(root.Sky&&Sky.L?Sky.L(l.title):l.title.ru)+'</span><span class="sr-sub">'+esc(root.Sky&&Sky.L?Sky.L(l.level):l.level.ru)+'</span></span><span class="sr-caret">›</span>';
      var text=root.Sky&&Sky.L?Sky.L(l.body):l.body.ru,goal=root.Sky&&Sky.L?Sky.L(l.goal):l.goal.ru,tip=root.Sky&&Sky.L?Sky.L(l.tip):l.tip.ru;
      body.innerHTML='<div class="sr-card">'+esc(text)+'</div><div class="sr-card sr-goal"><b>'+ru('Цель:','Goal:')+'</b> '+esc(goal)+'</div><div class="sr-board"></div><div class="sr-progress"></div><div class="sr-msg"></div><div class="sr-foot"><button type="button" class="btn chess small" data-a="reset">↺ '+ru('Начать заново','Restart')+'</button><button type="button" class="btn ghost small" data-a="hint">💡 '+ru('Подсказка','Hint')+'</button></div><div class="sr-msg sr-hintbox"></div><div class="sr-foot"><button type="button" class="btn ghost small" data-a="next">'+ru('Следующий урок','Next lesson')+' →</button></div>';
      art.appendChild(head);art.appendChild(body);host.appendChild(art);
      var board=body.querySelector('.sr-board'),progress=body.querySelector('.sr-progress'),msg=body.querySelector('.sr-msg'),hint=body.querySelector('.sr-hintbox');
      var start=E.create(l.fen||E.START_FEN), line=[],build=E.create(l.fen||E.START_FEN);
      (l.moves||[]).forEach(function(raw){var m=E.findMove(build,raw);if(m){line.push({from:m.from,to:m.to,promo:m.promotion||0,san:sanFor(build,m)});E.make(build,m);}});
      var st=start,ply=0,selected=-1,last=null;
      function draw(){
        board.innerHTML='';for(var r=7;r>=0;r--)for(var f=0;f<8;f++){var sq=E.sq(f,r),cell=document.createElement('button');cell.type='button';cell.className='sr-cell '+(((r+f)&1)?'dark':'light');cell.dataset.sq=String(sq);if(sq===selected)cell.classList.add('sel');if(last&&(sq===last.from||sq===last.to))cell.classList.add('sel');var p=st.board[sq];if(p){var sp=document.createElement('span');sp.className='sr-piece '+((p&8)?'b':'w');sp.textContent=GLYPH[p&7];cell.appendChild(sp);}if(selected>=0&&st.board[selected]){var ms=E.generate(st,{square:selected,legal:true});for(var i=0;i<ms.length;i++)if(ms[i].to===sq)cell.classList.add(ms[i].captured?'capture':'target');}cell.onclick=click;board.appendChild(cell);}
        progress.innerHTML='';for(var q=0;q<line.length;q++){var d=document.createElement('span');d.className='sr-dot '+(q<ply?'done':'');progress.appendChild(d);}var next=line[ply];if(!next)msg.innerHTML='<span class="sr-ok">✓ '+ru('Урок завершён. Отлично.','Lesson complete. Great job.')+'</span>';else msg.innerHTML=ru('Ваш ход: ','Your move: ')+'<span class="sr-step">'+esc(next.san)+'</span>';
      }
      function reset(){st=E.create(l.fen||E.START_FEN);ply=0;selected=-1;last=null;msg.textContent=ru('Выберите фигуру и найдите правильный ход.','Select a piece and find the correct move.');hint.textContent='';draw();}
      function click(ev){if(ply>=line.length)return;var sq=Number(ev.currentTarget.dataset.sq),p=st.board[sq];if(selected<0){if(p&&(p&8)===st.turn)selected=sq;draw();return;}var m=moveBy(st,selected,sq);if(!m){selected=(p&&(p&8)===st.turn)?sq:-1;draw();return;}var expected=line[ply];if(m.from!==expected.from||m.to!==expected.to||(expected.promo&&m.promotion!==expected.promo)){msg.innerHTML='<span class="sr-bad">✕ '+ru('Ход легальный, но не тот, который решает шаг урока.','Legal move, but not the move required by this lesson step.')+'</span>';hint.textContent=ru('Подсказка: ','Hint: ')+expected.san;selected=-1;draw();return;}E.make(st,m);last=m;selected=-1;ply++;msg.innerHTML='<span class="sr-ok">✓ '+ru('Верно: ','Correct: ')+expected.san+'</span>';draw();if(ply>=line.length){var d=state();d.done=Array.isArray(d.done)?d.done:[];if(d.done.indexOf(l.id)<0)d.done.push(l.id);save(d);}else if(st.turn!==((ply%2===0)?E.WHITE:E.BLACK)){autoReply();}}
      function autoReply(){if(ply>=line.length)return;var expected=line[ply];var m=moveBy(st,expected.from,expected.to);if(!m){msg.innerHTML='<span class="sr-bad">'+ru('В учебной линии есть ошибка: следующий ответ не является легальным.','The lesson line contains an illegal reply.')+'</span>';return;}setTimeout(function(){if(ply>=line.length)return;E.make(st,m);last=m;ply++;msg.innerHTML='<span class="sr-ok">✓ '+ru('Ответ соперника: ','Opponent: ')+expected.san+'</span>';draw();},420);}
      body.querySelector('[data-a=reset]').onclick=reset;body.querySelector('[data-a=hint]').onclick=function(){var n=line[ply];hint.textContent=n?ru('Нужно найти: ','Find: ')+n.san+' — '+esc(tip):ru('Подсказка уже не нужна: урок закончен.','No hint needed: lesson complete.');};body.querySelector('[data-a=next]').onclick=function(){var next=host.children[idx+2];if(next){var h=next.querySelector('.sr-head');if(h)h.click();}};
      head.onclick=function(){body.hidden=!body.hidden;head.querySelector('.sr-caret').textContent=body.hidden?'›':'⌄';if(!body.hidden)reset();};
      reset();
    });
  }
  function renderGame(){
    var rootBox=document.getElementById('gBoard'),status=document.getElementById('gStatus');if(!rootBox||rootBox.__srBound)return;rootBox.__srBound=true;
    var stateGame=null,human=E.WHITE,level=2,selected=-1,flip=false,history=[],busy=false,gameDone=false,captures={w:[],b:[]};
    rootBox.style.touchAction='manipulation';
    function setText(el,s){if(el)el.textContent=s;}
    function boardDraw(){
      rootBox.innerHTML='';var files=[0,1,2,3,4,5,6,7],ranks=[7,6,5,4,3,2,1,0];if(flip){files.reverse();ranks.reverse();}
      for(var ri=0;ri<8;ri++)for(var fi=0;fi<8;fi++){var f=files[fi],r=ranks[ri],sq=E.sq(f,r),cell=document.createElement('button');cell.type='button';cell.className='sr-cell '+(((f+r)&1)?'dark':'light');cell.dataset.sq=String(sq);if(selected===sq)cell.classList.add('sel');if(selected>=0&&!busy){var ms=E.generate(stateGame,{square:selected,legal:true});for(var i=0;i<ms.length;i++)if(ms[i].to===sq)cell.classList.add(ms[i].captured?'capture':'target');}var p=stateGame.board[sq];if(p){var sp=document.createElement('span');sp.className='sr-piece '+((p&8)?'b':'w');sp.textContent=GLYPH[p&7];cell.appendChild(sp);}cell.onclick=gameClick;rootBox.appendChild(cell);}
      var capTop=document.getElementById('gCapTop'),capBot=document.getElementById('gCapBottom');if(capTop)capTop.textContent=captures.b.map(pieceName).join('');if(capBot)capBot.textContent=captures.w.map(pieceName).join('');
      var moves=document.getElementById('gMoves');if(moves){moves.innerHTML='';for(var j=0;j<history.length;j++){var spn=document.createElement('span');spn.className='sr-move';spn.textContent=(Math.floor(j/2)+1)+(j%2?'. … ':' . ')+history[j].san;moves.appendChild(spn);}}
    }
    function statusText(){var s=E.status(stateGame);if(s==='checkmate')return ru('Мат — партия окончена.','Checkmate — game over.');if(s==='stalemate')return ru('Пат — ничья.','Stalemate — draw.');if(s==='fifty')return ru('Ничья по правилу 50 ходов.','Draw by the 50-move rule.');if(s==='repetition')return ru('Ничья: троекратное повторение.','Draw by threefold repetition.');if(s==='material')return ru('Ничья: недостаточно материала.','Draw: insufficient material.');return stateGame.turn===human?ru('Ваш ход','Your move')+ (E.inCheck(stateGame)?' — '+ru('шах!','check!'):''):ru('Бот думает…','Bot thinking…');}
    function renderStatus(){setText(status,statusText());if(status)status.className='gameinfo '+(E.inCheck(stateGame)?'sr-status':'');}
    function endIfNeeded(){var s=E.status(stateGame);if(['checkmate','stalemate','fifty','repetition','material'].indexOf(s)<0)return false;gameDone=true;busy=false;renderStatus();var panel=document.getElementById('sky-rebuild-end');if(!panel){panel=document.createElement('div');panel.id='sky-rebuild-end';panel.className='sr-end';var side=document.getElementById('gBoard').parentNode;side.appendChild(panel);}var title=s==='checkmate'?(stateGame.turn===human?ru('Вы проиграли','You lose'):ru('Вы выиграли','You win')):ru('Ничья','Draw');panel.innerHTML='<h3>'+title+'</h3><p>'+esc(statusText())+'</p><div class="sr-end-actions"><button class="btn chess small" id="srAgain">'+ru('Новая партия','New game')+'</button><button class="btn ghost small" id="srCloseEnd">'+ru('Скрыть','Hide')+'</button></div>';document.getElementById('srAgain').onclick=start;document.getElementById('srCloseEnd').onclick=function(){panel.remove();};return true;}
    function makeMove(m){var san=sanFor(stateGame,m),cap=m.captured||0;E.make(stateGame,m);history.push({san:san,captured:cap,fen:E.fen(stateGame)});if(cap)captures[(cap&8)?'b':'w'].push(cap);selected=-1;boardDraw();renderStatus();return endIfNeeded();}
    function bot(){if(gameDone||stateGame.turn===human)return;busy=true;renderStatus();setTimeout(function(){if(gameDone)return;var res=AI&&AI.bestMove?AI.bestMove(stateGame,level):null;busy=false;if(!res||!res.move){endIfNeeded();return;}makeMove(res.move);},80);}
    function gameClick(ev){if(busy||gameDone||stateGame.turn!==human)return;var sq=Number(ev.currentTarget.dataset.sq),p=stateGame.board[sq];if(selected<0){if(p&&(p&8)===human)selected=sq;boardDraw();return;}var m=moveBy(stateGame,selected,sq);if(!m){selected=(p&&(p&8)===human)?sq:-1;boardDraw();return;}if(m.promotion){makeMove(m);return;}makeMove(m);if(!gameDone)bot();}
    function start(){level=Number((document.getElementById('gLevel')||{}).value)||2;human=((document.getElementById('gSide')||{}).value||'w')==='b'?E.BLACK:E.WHITE;stateGame=E.create(E.START_FEN);selected=-1;history=[];captures={w:[],b:[]};busy=false;gameDone=false;var end=document.getElementById('sky-rebuild-end');if(end)end.remove();boardDraw();renderStatus();if(human===E.BLACK)bot();}
    function undo(){if(busy||!history.length)return;while(history.length){history.pop();if(history.length===0||((stateGame.turn===human)&&history.length)){break;}}var replay=E.create(E.START_FEN),caps={w:[],b:[]},hs=[];for(var i=0;i<history.length;i++){var m=E.findMove(replay,history[i].san);if(!m)break;if(m.captured)caps[(m.captured&8)?'b':'w'].push(m.captured);E.make(replay,m);hs.push(history[i]);}stateGame=replay;history=hs;captures=caps;gameDone=false;var end=document.getElementById('sky-rebuild-end');if(end)end.remove();selected=-1;boardDraw();renderStatus();}
    function flipBoard(){flip=!flip;boardDraw();}
    var btn=document.getElementById('gNew');if(btn)btn.onclick=start;var ub=document.getElementById('gUndo');if(ub)ub.onclick=undo;var fb=document.getElementById('gFlip');if(fb)fb.onclick=flipBoard;
    var p=document.getElementById('gPromo');if(p)p.innerHTML='';
    root.SkyChessRebuild={newGame:start};start();
  }
  ready(function(){
    ensureCss();
    try{renderLessons();}catch(e){console.error('Chess lessons rebuild failed',e);}
    try{renderGame();}catch(e){console.error('Chess game rebuild failed',e);}
  });
})(window);
