/* SkyySchool Chess — lightweight progress, autosave and health panel. */
'use strict';
(function(root){
  const KEY='skyschool.chess.progress.v1';
  const SAVE='skyschool.chess.saved.v1';

  function read(){
    try{return JSON.parse(localStorage.getItem(KEY)||'')||{};}catch(e){return {};}
  }
  function write(v){
    try{localStorage.setItem(KEY,JSON.stringify(v));}catch(e){}
  }
  function saveSnapshot(v){
    try{localStorage.setItem(SAVE,JSON.stringify(v));}catch(e){}
  }
  function getSnapshot(){
    try{return JSON.parse(localStorage.getItem(SAVE)||'')||null;}catch(e){return null;}
  }
  function clearSnapshot(){try{localStorage.removeItem(SAVE);}catch(e){}}
  function day(){
    const d=new Date(),m=String(d.getMonth()+1).padStart(2,'0'),x=String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+m+'-'+x;
  }
  function base(){
    const p=read();
    p.lessons=Array.isArray(p.lessons)?p.lessons:[];
    p.puzzles=Array.isArray(p.puzzles)?p.puzzles:[];
    p.games=p.games&&typeof p.games==='object'?p.games:{played:0,wins:0,losses:0,draws:0};
    p.daily=p.daily&&typeof p.daily==='object'?p.daily:{};
    p.daily.day=typeof p.daily.day==='string'?p.daily.day:day();
    if(p.daily.day!==day())p.daily={day:day(),lessons:0,puzzles:0,games:0};
    if(typeof p.daily.lessons!=='number')p.daily.lessons=0;
    if(typeof p.daily.puzzles!=='number')p.daily.puzzles=0;
    if(typeof p.daily.games!=='number')p.daily.games=0;
    if(p.initialized===undefined)p.initialized=false;
    return p;
  }
  function mergeLegacy(p){
    let addedLesson=0;
    try{
      const old=JSON.parse(localStorage.getItem('skyschool.chess.v2')||'')||{};
      const ids=Array.isArray(old.done)?old.done:[];
      for(const id of ids)if(p.lessons.indexOf(id)<0){p.lessons.push(id);if(p.initialized)addedLesson++;}
    }catch(e){}
    try{
      const getter=root.Sky&&Sky.get;
      const ids=typeof getter==='function'?getter('puzzlesSolved',[]):[];
      if(Array.isArray(ids))for(const id of ids)if(p.puzzles.indexOf(id)<0)p.puzzles.push(id);
    }catch(e){}
    if(p.initialized&&addedLesson)p.daily.lessons+=addedLesson;
    if(!p.initialized){p.initialized=true;}
    return p;
  }
  function t(ru,en){return root.Sky&&Sky.lang==='en'?en:ru;}
  function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));}

  function record(type,id){
    const p=mergeLegacy(base());
    if(type==='lesson'&&id!=null){
      if(!p.lessons.includes(id)){p.lessons.push(id);p.daily.lessons++;}
    }else if(type==='puzzle'&&id!=null){
      if(!p.puzzles.includes(id)){p.puzzles.push(id);p.daily.puzzles++;}
    }
    write(p);render();
  }
  function game(result){
    const p=mergeLegacy(base());
    p.games.played++;
    if(result==='win')p.games.wins++;
    else if(result==='lose')p.games.losses++;
    else p.games.draws++;
    p.daily.games++;
    write(p);render();
  }

  function css(){
    if(document.getElementById('sky-progress-css'))return;
    const s=document.createElement('style');
    s.id='sky-progress-css';
    s.textContent=
      '.sky-progress{margin:0 0 18px;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:var(--shadow-sm)}'+
      '.sky-progress-grid{display:grid;grid-template-columns:1.3fr repeat(4,.75fr);gap:8px}'+
      '.sky-pstat{padding:9px 10px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2);min-width:0}'+
      '.sky-pstat b{display:block;font-size:18px;line-height:1.1}.sky-pstat span{display:block;margin-top:3px;font-size:9.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '.sky-pbar{height:6px;margin-top:7px;background:var(--line);border-radius:8px;overflow:hidden}.sky-pbar i{display:block;height:100%;background:var(--m-chess)}'+
      '.sky-daily2{margin-top:9px;padding:9px 10px;border-radius:12px;background:var(--m-chess-soft);font-size:11px;line-height:1.55}'+
      '.sky-daily2 .checks{display:flex;gap:9px;flex-wrap:wrap;margin-top:4px}.sky-daily2 .checks span{white-space:nowrap}'+
      '.sky-continue{margin-top:9px;display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 10px;border:1px dashed var(--m-chess);border-radius:12px}'+
      '.sky-health{margin:0 0 18px;padding:11px 12px;border:1px solid #d46a6a;border-radius:12px;background:var(--panel);color:#a52d38;font-size:11px}'+
      '@media(max-width:820px){.sky-progress-grid{grid-template-columns:1fr 1fr}.sky-pstat:first-child{grid-column:1/-1}}';
    document.head.appendChild(s);
  }

  function health(){
    const fail=[];
    try{
      if(!root.ChessEngine)fail.push(t('движок не загрузился','engine did not load'));
      else if(root.ChessEngine.generate(root.ChessEngine.create()).length!==20)fail.push(t('стартовая позиция повреждена','starting position is invalid'));
    }catch(e){fail.push(t('ошибка шахматного движка','chess engine error'));}
    if(!root.ChessAI||typeof root.ChessAI.bestMove!=='function')fail.push(t('бот не загрузился','bot did not load'));
    if(!Array.isArray(root.CHESS_LESSONS))fail.push(t('уроки не загрузились','lessons did not load'));
    if(!Array.isArray(root.CHESS_PUZZLES))fail.push(t('задачи не загрузились','puzzles did not load'));
    const old=document.getElementById('skyChessHealth');
    if(old)old.remove();
    if(fail.length){
      const box=document.createElement('div');box.id='skyChessHealth';box.className='sky-health';
      box.innerHTML='<b>'+t('Шахматы загрузились не полностью','Chess did not load completely')+'</b><br>'+esc(fail.join(' · '));
      const anchor=document.querySelector('.tabs-wrap')||document.querySelector('main');
      if(anchor)anchor.parentNode.insertBefore(box,anchor);
    }
  }

  function render(){
    const p=mergeLegacy(base());write(p);
    const anchor=document.querySelector('.tabs-wrap');
    if(!anchor)return;
    css();
    let box=document.getElementById('skyChessProgress');
    if(!box){box=document.createElement('section');box.id='skyChessProgress';box.className='sky-progress';anchor.parentNode.insertBefore(box,anchor);}
    const lessonsTotal=Array.isArray(root.CHESS_LESSONS)?root.CHESS_LESSONS.length:0;
    const lessonsDone=Math.min(p.lessons.length,lessonsTotal||p.lessons.length);
    const lessonPct=lessonsTotal?Math.min(100,Math.round(lessonsDone/lessonsTotal*100)):0;
    const snap=getSnapshot();
    const totalGames=p.games.played;
    const checkL=p.daily.lessons>=1?'✓':'□';
    const checkP=p.daily.puzzles>=3?'✓':'□';
    const checkG=p.daily.games>=1?'✓':'□';
    box.innerHTML=
      '<div class="sky-progress-grid">'+
      '<div class="sky-pstat"><b>'+lessonsDone+(lessonsTotal?'/'+lessonsTotal:'')+'</b><span>'+t('уроков пройдено','lessons completed')+'</span><div class="sky-pbar"><i style="width:'+lessonPct+'%"></i></div></div>'+
      '<div class="sky-pstat"><b>'+p.puzzles.length+'</b><span>'+t('задач решено','puzzles solved')+'</span></div>'+
      '<div class="sky-pstat"><b>'+totalGames+'</b><span>'+t('партий завершено','games finished')+'</span></div>'+
      '<div class="sky-pstat"><b>'+p.games.wins+'</b><span>'+t('побед','wins')+'</span></div>'+
      '<div class="sky-pstat"><b>'+p.games.losses+'</b><span>'+t('поражений','losses')+'</span></div>'+
      '</div>'+
      '<div class="sky-daily2"><b>'+t('Тренировка сегодня','Today’s training')+'</b><div class="checks">'+
      '<span>'+checkL+' '+t('1 урок','1 lesson')+'</span><span>'+checkP+' '+t('3 задачи','3 puzzles')+'</span><span>'+checkG+' '+t('1 партия','1 game')+'</span>'+
      '</div></div>'+
      (snap&&Array.isArray(snap.moves)?'<div class="sky-continue"><span><b>'+t('Незаконченная партия сохранена','Unfinished game saved')+'</b><br><small>'+snap.moves.length+' '+t('ходов · можно продолжить','moves · ready to resume')+'</small></span><button type="button" class="btn chess small" id="skyResume">'+t('Продолжить','Resume')+'</button></div>':'');
    const resume=document.getElementById('skyResume');
    if(resume)resume.onclick=function(){
      root.dispatchEvent(new CustomEvent('skychess-resume'));
      setTimeout(render,0);
    };
  }

  function boot(){
    render();
    health();
    const list=document.getElementById('lessonList');
    if(list)new MutationObserver(()=>render()).observe(list,{childList:true,subtree:true,characterData:true,attributes:true});
    document.addEventListener('langchange',()=>{render();health();});
    window.addEventListener('storage',e=>{if(e.key===KEY||e.key===SAVE)render();});
  }

  root.SkyChessProgress={
    recordLesson:id=>record('lesson',id),
    recordPuzzle:id=>record('puzzle',id),
    recordGame:game,
    saveSnapshot,
    clearSnapshot(){clearSnapshot();render();},
    getSnapshot,
    render,
    health
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})(window);
