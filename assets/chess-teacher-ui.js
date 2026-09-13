/* ============================================================
   SkyySchool — шахматные тренеры + адаптивная сложность
   ------------------------------------------------------------
   Тренер реально влияет на стиль разбора.
   Сложность бота можно выбрать вручную или включить «Умный» режим.
   ============================================================ */
'use strict';

window.ChessTeacherUI = (function () {
  const STORE = 'sky_chess_teacher';
  const DIFFICULTY_STORE = 'sky_chess_difficulty_mode';
  const ADAPTIVE_STATS_STORE = 'sky_chess_adaptive_stats';
  const DEFAULT = 'coach-fire';
  const ADAPTIVE = 'adaptive';
  const ADAPTIVE_ENGINE_LEVEL = '99';

  const FACES = {};
  function face(accent, hair, accessory) {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="31" fill="' + accent + '"/>' +
      '<circle cx="32" cy="27" r="12" fill="#f1c9a5"/>' +
      '<path d="M19 23 Q21 11 32 11 Q43 11 45 23 Q41 17 32 17 Q23 17 19 23Z" fill="' + hair + '"/>' +
      '<path d="M14 62 Q14 43 32 43 Q50 43 50 62Z" fill="' + hair + '" opacity=".95"/>' +
      '<circle cx="27" cy="28" r="1.8" fill="#1b2230"/>' +
      '<circle cx="37" cy="28" r="1.8" fill="#1b2230"/>' +
      '<path d="M27 36 Q32 39 37 36" fill="none" stroke="#1b2230" stroke-width="1.6" stroke-linecap="round"/>' +
      (accessory || '') +
      '</svg>';
  }

  FACES['coach-fire'] = face('#d44935','#571d18','<path d="M10 10 L14 18 L18 10" fill="none" stroke="#ffb020" stroke-width="2.4"/>');
  FACES['coach-calm'] = face('#3a84ad','#173c59','');
  FACES['coach-prof'] = face('#7654b5','#29204b','<circle cx="27" cy="28" r="6" fill="none" stroke="#20202a" stroke-width="1.4"/><circle cx="37" cy="28" r="6" fill="none" stroke="#20202a" stroke-width="1.4"/>');
  FACES['coach-friend'] = face('#38a76f','#18563c','<circle cx="27" cy="28" r="1.5" fill="#111"/><circle cx="37" cy="28" r="1.5" fill="#111"/>');
  FACES['coach-strict'] = face('#343b47','#17191d','<path d="M24 37 L40 37" stroke="#111" stroke-width="2.2" stroke-linecap="round"/>');
  FACES['coach-romantic'] = face('#a64bb0','#4b1c54','<path d="M20 37 Q32 42 44 37" fill="none" stroke="#23152a" stroke-width="1.3"/>');

  const TEACHERS = {
    'coach-fire': {
      name:{ru:'Атакующий Огонь',en:'Coach Fire'},
      role:{ru:'Атака и инициатива',en:'Attack & initiative'},
      style:{ru:'Давит на темп, угрозы и активную игру.',en:'Pushes tempo, threats and active play.'},
      strictness:3,
      phrases:{
        brilliant:'Вот это по-нашему! Ты забрал инициативу и не дал сопернику передышки.',
        good:'Ход рабочий. Но ты отдал темп — ищи угрозу сразу.',
        inaccuracy:'Слишком тихо. У тебя была инициатива — зачем ты её отпустил?',
        mistake:'Потерял темп. Создай новую угрозу и верни инициативу.',
        blunder:'Катастрофа. Инициатива ушла сопернику. Теперь сначала спасаем позицию.'
      }
    },
    'coach-calm': {
      name:{ru:'Спокойный Стратег',en:'Calm Strategist'},
      role:{ru:'Позиция и структура',en:'Position & structure'},
      style:{ru:'Разбирает структуру, слабости и план без суеты.',en:'Reads structure, weaknesses and plans without rush.'},
      strictness:3,
      phrases:{
        brilliant:'Прекрасный позиционный ход. Фигуры улучшились, структура осталась здоровой.',
        good:'Хорошо. Без суеты: твоя позиция стала устойчивее.',
        inaccuracy:'Не спеши. Сначала проверь слабые поля и пешечную структуру.',
        mistake:'Ты создал долговременную слабость. Она останется после разменов.',
        blunder:'Слишком много слабостей сразу. Остановись и заново оцени план.'
      }
    },
    'coach-prof': {
      name:{ru:'Профессор Расчёт',en:'Professor Calculation'},
      role:{ru:'Точный счёт вариантов',en:'Exact calculation'},
      style:{ru:'Требует считать конкретные варианты до конца.',en:'Demands concrete calculation to the end.'},
      strictness:5,
      phrases:{
        brilliant:'Идеальный расчёт. Ты проверил ответ соперника и следующий ресурс.',
        good:'Верно, но недостаточно. Проверь все форсированные ответы.',
        inaccuracy:'Не все линии просчитаны. Возьми кандидатов и проверь до конца.',
        mistake:'Ты пропустил конкретный ответ соперника. В расчёте таких дыр быть не должно.',
        blunder:'Ошибка в расчёте. Найди первый момент, где вариант перестал работать.'
      }
    },
    'coach-friend': {
      name:{ru:'Добрый Тренер',en:'Friendly Coach'},
      role:{ru:'Поддержка и разбор',en:'Support & review'},
      style:{ru:'Поддерживает и показывает одну понятную точку роста.',en:'Encourages and gives one clear improvement point.'},
      strictness:2,
      phrases:{
        brilliant:'Молодец! Очень сильное решение. Запомни, почему оно сработало.',
        good:'Отличный ход. Идея правильная — продолжай в том же духе.',
        inaccuracy:'Ничего страшного. Идея рядом — давай найдём точнее.',
        mistake:'Не переживай. Ошибка полезна: теперь знаем, что проверять в следующий раз.',
        blunder:'Здесь мы поторопились. Спокойно разберём момент и попробуем ещё раз.'
      }
    },
    'coach-strict': {
      name:{ru:'Строгий Гроссмейстер',en:'Strict Grandmaster'},
      role:{ru:'Точность и дисциплина',en:'Precision & discipline'},
      style:{ru:'Без скидок оценивает точность, дисциплину и результат.',en:'No excuses: precision, discipline and result.'},
      strictness:5,
      phrases:{
        brilliant:'Достойно. Точный ход и именно тот уровень, которого я ожидаю.',
        good:'Допустимо. Но на серьёзной партии этого недостаточно — ищи лучшее.',
        inaccuracy:'Неточность. Такие ходы отнимают очки. Проверяй продолжение заранее.',
        mistake:'Ошибка. Ты обязан был проверить ответ соперника до хода.',
        blunder:'Провал. Назови конкретную причину ошибки и исправь её.'
      }
    },
    'coach-romantic': {
      name:{ru:'Романтик Атаки',en:'Romantic Attacker'},
      role:{ru:'Жертвы и комбинации',en:'Sacrifices & combinations'},
      style:{ru:'Ищет тактику, жертвы, шахи и красивые атаки.',en:'Looks for tactics, sacrifices, checks and attacks.'},
      strictness:3,
      phrases:{
        brilliant:'Блестяще! Комбинация работает — вот ради таких моментов и играют.',
        good:'Хорошо. Но позиция просила более активного продолжения.',
        inaccuracy:'Слишком солидно. Проверь шахи, взятия и тактические жертвы.',
        mistake:'Ты пропустил тактическое окно. Красивый план ничего не стоит без расчёта.',
        blunder:'Комбинация не сложилась. Сначала счёт, потом жертва.'
      }
    }
  };

  const DIFFICULTIES = [
    {id:'1', icon:'👤', name:{ru:'Новичок',en:'Beginner'}, desc:{ru:'Спокойно ошибается и даёт время подумать.',en:'Forgiving and gives you time to think.'}},
    {id:'2', icon:'👤', name:{ru:'Любитель',en:'Casual'}, desc:{ru:'Нормальный темп для регулярной игры.',en:'A balanced level for regular play.'}},
    {id:'3', icon:'👤', name:{ru:'Клубный',en:'Club'}, desc:{ru:'Уже наказывает за зевки и неточности.',en:'Punishes blunders and loose moves.'}},
    {id:'4', icon:'👤', name:{ru:'Сильный',en:'Strong'}, desc:{ru:'Играет максимально точно в рамках этого движка.',en:'Plays as accurately as this engine allows.'}}
  ];

  function lang(){ return (window.Sky && Sky.lang) || 'ru'; }
  function text(obj){ return obj[lang()] || obj.ru || ''; }
  function escapeHTML(value){ return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function getSelected(){ const id=localStorage.getItem(STORE); return TEACHERS[id] ? id : DEFAULT; }
  function getDifficultyMode(){ return localStorage.getItem(DIFFICULTY_STORE) || ADAPTIVE; }
  function setDifficultyMode(mode){ localStorage.setItem(DIFFICULTY_STORE, mode); }

  function readAdaptiveStats(){
    try { return JSON.parse(localStorage.getItem(ADAPTIVE_STATS_STORE) || '{"moves":[]}'); }
    catch(e){ return {moves:[]}; }
  }
  function writeAdaptiveResult(quality){
    const score={brilliant:2,good:1,inaccuracy:0,mistake:-1,blunder:-2}[quality];
    if(score == null) return;
    const st=readAdaptiveStats();
    st.moves=(st.moves||[]).slice(-7);
    st.moves.push(score);
    localStorage.setItem(ADAPTIVE_STATS_STORE, JSON.stringify(st));
  }

  function adaptiveLevel(){
    const moves=readAdaptiveStats().moves || [];
    if(moves.length < 3) return 2;
    const avg=moves.reduce((a,b)=>a+b,0)/moves.length;
    const last3=moves.slice(-3);
    const hardMistakes=last3.filter(x=>x<=-1).length;
    if(hardMistakes>=2 || avg < -0.45) return 1;
    if(avg < 0.25) return 2;
    if(avg < 1.05) return 3;
    return 4;
  }

  function adaptiveLabel(){
    const d=DIFFICULTIES.find(x=>x.id===String(adaptiveLevel())) || DIFFICULTIES[1];
    return text(d.name);
  }

  /* ---------- Стабильный интерфейс ---------- */
  function ensureStyles(){
    if(document.getElementById('chess-teacher-ui-extra-v2')) return;
    const style=document.createElement('style');
    style.id='chess-teacher-ui-extra-v2';
    style.textContent=`
      html{scrollbar-gutter:stable;}
      #tab-game .board-wrap,#tab-puzzles .board-wrap,#tab-live .board-wrap{grid-template-columns:minmax(0,1fr) 310px;}
      #tab-game .board,#tab-puzzles .board,#tab-live .board{width:min(100%,760px);justify-self:start;min-width:0;}
      .sqr{aspect-ratio:1;min-width:0;}
      .difficulty-panel{margin-top:8px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm);}
      .difficulty-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px;}
      .difficulty-title{font-size:13px;font-weight:900;line-height:1.2;}
      .difficulty-sub{font-size:11px;color:var(--muted);margin-top:3px;line-height:1.35;}
      .difficulty-now{padding:5px 8px;border-radius:9px;background:var(--m-chess-soft);color:var(--m-chess);font-size:10px;font-weight:900;white-space:nowrap;}
      .difficulty-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;}
      .difficulty-card{position:relative;min-width:0;text-align:left;padding:10px 9px;border:1px solid var(--line);border-radius:13px;background:var(--panel-2);color:var(--ink);cursor:pointer;transition:border-color .15s,background .15s,transform .15s;}
      .difficulty-card:hover{border-color:var(--line-2);transform:translateY(-1px);}
      .difficulty-card.is-active{border-color:var(--m-chess);background:var(--m-chess-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 13%,transparent);}
      .difficulty-card.is-active::after{content:'✓';position:absolute;right:7px;top:7px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--m-chess);color:#fff;font-size:10px;font-weight:900;}
      .difficulty-card.smart{grid-column:span 1;}
      .difficulty-icon{font-size:18px;line-height:1;margin-bottom:7px;filter:grayscale(.1);}
      .difficulty-name{font-size:11px;font-weight:900;line-height:1.2;}
      .difficulty-desc{font-size:9.5px;color:var(--muted);line-height:1.35;margin-top:4px;min-height:39px;}
      .difficulty-human{display:flex;gap:2px;margin-top:7px;}
      .difficulty-human i{font-style:normal;font-size:10px;opacity:.2;}
      .difficulty-human i.on{opacity:1;}
      .difficulty-live-note{margin-top:9px;font-size:10px;color:var(--muted);line-height:1.4;}
      .tui-current{display:flex;align-items:center;gap:11px;padding:10px 11px;margin-bottom:12px;border:1px solid color-mix(in srgb,var(--m-chess) 26%,var(--line));background:var(--m-chess-soft);border-radius:15px;box-shadow:var(--shadow-sm);}
      .tui-current .tui-face{width:45px;height:45px;flex:0 0 45px;}
      .tui-current-copy{min-width:0;flex:1;}
      .tui-current-head{display:flex;gap:7px;align-items:baseline;flex-wrap:wrap;}
      .tui-current-name{font-size:12.5px;font-weight:900;line-height:1.2;}
      .tui-current-role{font-size:10px;color:var(--muted);}
      .tui-current-style{margin-top:3px;font-size:10px;line-height:1.35;color:var(--ink-2);}
      .tui-current-strict{margin-top:4px;font-size:9.5px;font-weight:900;color:var(--m-chess);}
      .tui-current-badge{padding:4px 7px;border-radius:999px;background:var(--panel);border:1px solid var(--line);color:var(--m-chess);font-size:8.5px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;}
      .tui-inline .tui-face{width:44px;height:44px;flex:0 0 44px;}
      .tui-inline .tui-style-note{margin-top:5px;font-size:10px;line-height:1.35;color:var(--muted);}
      .tui-card{position:relative;}
      .tui-card[aria-pressed="true"]{border-color:var(--m-chess);background:var(--m-chess-soft);box-shadow:0 0 0 2px color-mix(in srgb,var(--m-chess) 11%,transparent);}
      .tui-card[aria-pressed="true"]::after{content:'✓';position:absolute;right:8px;top:8px;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;background:var(--m-chess);color:#fff;font-size:10px;font-weight:900;}
      @media(max-width:900px){.difficulty-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.difficulty-card.smart{grid-column:1/-1;}.difficulty-desc{min-height:0;}.tui-current-badge{display:none;}}
      @media(max-width:600px){#tab-game .board-wrap,#tab-puzzles .board-wrap,#tab-live .board-wrap{grid-template-columns:1fr;}#tab-game .board,#tab-puzzles .board,#tab-live .board{width:100%;}.difficulty-grid{grid-template-columns:1fr 1fr;}}
    `;
    document.head.appendChild(style);
  }

  function strictnessText(t){
    const labels=lang()==='en' ? ['Very relaxed','Relaxed','Balanced','Strict','Very strict'] : ['Очень мягкий','Мягкий','Средний','Строгий','Очень строгий'];
    return (labels[Math.max(1,Math.min(5,t.strictness))-1] || labels[2]);
  }

  function renderCurrent(){
    const id=getSelected(), t=TEACHERS[id];
    if(!t) return '';
    return '<div class="tui-current" data-teacher="'+escapeHTML(id)+'">' +
      '<div class="tui-face">'+(FACES[id]||FACES[DEFAULT])+'</div>' +
      '<div class="tui-current-copy">' +
        '<div class="tui-current-head"><span class="tui-current-name">'+escapeHTML(text(t.name))+'</span><span class="tui-current-role">'+escapeHTML(text(t.role))+'</span></div>' +
        '<div class="tui-current-style">'+escapeHTML(text(t.style))+'</div>' +
        '<div class="tui-current-strict">'+(lang()==='en'?'Demandingness: ':'Требовательность: ')+escapeHTML(strictnessText(t))+'</div>' +
      '</div><span class="tui-current-badge">'+(lang()==='en'?'Coach':'Тренер')+'</span>' +
    '</div>';
  }

  function refreshCurrentTeachers(){
    ensureStyles();
    document.querySelectorAll('.tui-current').forEach(n=>n.outerHTML=renderCurrent());
    ['#tab-game .side','#tab-puzzles .side'].forEach(sel=>{
      const side=document.querySelector(sel); if(!side) return;
      if(!side.querySelector('.tui-current')){
        const tmp=document.createElement('div'); tmp.innerHTML=renderCurrent();
        if(tmp.firstElementChild) side.insertBefore(tmp.firstElementChild,side.firstElementChild);
      }
    });
  }

  function renderFor(quality){
    const id=getSelected(), t=TEACHERS[id]; if(!t) return '';
    const colors={brilliant:'#8b5cf6',good:'var(--ok)',inaccuracy:'var(--warn)',mistake:'#e07a3f',blunder:'var(--no)'};
    return '<div class="tui-inline" data-quality="'+escapeHTML(quality)+'" data-teacher="'+escapeHTML(id)+'">' +
      '<div class="tui-face">'+(FACES[id]||FACES[DEFAULT])+'</div>' +
      '<div class="tui-text"><div class="tui-name">'+escapeHTML(text(t.name))+'<span class="tui-role" style="color:'+(colors[quality]||'var(--muted)')+'">'+escapeHTML(text(t.role))+'</span></div>' +
      '<div class="tui-line">'+escapeHTML(t.phrases[quality]||t.phrases.good)+'</div>' +
      '<div class="tui-style-note">'+escapeHTML(lang()==='en'?'Style: ':'Манера: ')+escapeHTML(text(t.style))+'</div></div></div>';
  }

  function refreshInlineReviews(){
    document.querySelectorAll('.tui-inline[data-quality]').forEach(n=>n.outerHTML=renderFor(n.getAttribute('data-quality')));
  }

  function setSelected(id){
    if(!TEACHERS[id]) return false;
    const previous=getSelected();
    localStorage.setItem(STORE,id);
    document.documentElement.dataset.chessTeacher=id;
    window.dispatchEvent(new CustomEvent('chessTeacherChanged',{detail:{id,teacher:TEACHERS[id],previousId:previous}}));
    refreshCurrentTeachers();
    refreshInlineReviews();
    return true;
  }

  function updatePickerState(host){
    const selected=getSelected();
    host.querySelectorAll('.tui-card').forEach(card=>{
      const active=card.dataset.id===selected;
      card.classList.toggle('active',active);
      card.setAttribute('aria-pressed',String(active));
    });
  }

  function renderPicker(hostSel){
    ensureStyles();
    const host=typeof hostSel==='string'?document.querySelector(hostSel):hostSel; if(!host) return;
    host.innerHTML='<div class="tui-picker" role="group" aria-label="Выбор шахматного тренера">'+Object.keys(TEACHERS).map(id=>{
      const t=TEACHERS[id], active=id===getSelected();
      return '<button type="button" class="tui-card'+(active?' active':'')+'" data-id="'+escapeHTML(id)+'" aria-pressed="'+String(active)+'" title="'+escapeHTML(text(t.style))+'">' +
        '<div class="tui-face">'+FACES[id]+'</div><div class="tui-card-info"><b>'+escapeHTML(text(t.name))+'</b><span>'+escapeHTML(text(t.role))+'</span><small>'+escapeHTML(strictnessText(t))+'</small></div></button>';
    }).join('')+'</div>';
    const picker=host.querySelector('.tui-picker');
    picker.addEventListener('click',e=>{const card=e.target.closest('.tui-card');if(card&&picker.contains(card)){setSelected(card.dataset.id);updatePickerState(host);}});
    picker.addEventListener('keydown',e=>{
      const cards=Array.from(picker.querySelectorAll('.tui-card')), idx=cards.indexOf(document.activeElement); if(idx<0) return;
      let next=idx; if(e.key==='ArrowRight')next=Math.min(cards.length-1,idx+1);else if(e.key==='ArrowLeft')next=Math.max(0,idx-1);else if(e.key==='ArrowDown')next=Math.min(cards.length-1,idx+3);else if(e.key==='ArrowUp')next=Math.max(0,idx-3);else return;
      e.preventDefault();cards[next].focus();
    });
    document.documentElement.dataset.chessTeacher=getSelected();
    refreshCurrentTeachers();
  }

  /* ---------- Умный выбор сложности ---------- */
  function difficultyCard(id, icon, title, description, smart){
    const active=(getDifficultyMode()===id || (smart && getDifficultyMode()===ADAPTIVE));
    const humanCount=smart ? adaptiveLevel() : Number(id);
    const people=Array.from({length:4},(_,i)=>'<i class="'+(i<humanCount?'on':'')+'">●</i>').join('');
    return '<button type="button" class="difficulty-card'+(active?' is-active':'')+(smart?' smart':'')+'" data-difficulty="'+id+'" aria-pressed="'+String(active)+'">' +
      '<div class="difficulty-icon">'+icon+'</div><div class="difficulty-name">'+escapeHTML(title)+'</div><div class="difficulty-desc">'+escapeHTML(description)+'</div><div class="difficulty-human">'+people+'</div></button>';
  }

  function renderDifficultyUI(){
    ensureStyles();
    const select=document.querySelector('#gLevel'); if(!select) return;
    if(!select.querySelector('option[value="99"]')){
      const o=document.createElement('option'); o.value=ADAPTIVE_ENGINE_LEVEL; o.textContent='Умный'; select.appendChild(o);
    }
    const parent=select.parentElement; if(!parent) return;
    let panel=parent.querySelector('.difficulty-panel');
    if(!panel){
      select.style.display='none';
      const oldLabel=parent.querySelector('label');
      if(oldLabel) oldLabel.style.display='none';
      panel=document.createElement('div');
      panel.className='difficulty-panel';
      parent.appendChild(panel);
    }
    const l=lang();
    panel.innerHTML='<div class="difficulty-head"><div><div class="difficulty-title">'+(l==='en'?'How strong should the bot be?':'Насколько сильным должен быть бот?')+'</div><div class="difficulty-sub">'+(l==='en'?'Choose Smart or lock one exact level.':'Выберите «Умный» режим или зафиксируйте конкретную сложность.')+'</div></div><div class="difficulty-now">'+(l==='en'?'Now: ':'Сейчас: ')+escapeHTML(getDifficultyMode()===ADAPTIVE?adaptiveLabel():text((DIFFICULTIES.find(d=>d.id===getDifficultyMode())||DIFFICULTIES[1]).name))+'</div></div>' +
      '<div class="difficulty-grid">' +
      difficultyCard(ADAPTIVE,'🧑',l==='en'?'Smart':'Умный',l==='en'?'Adjusts to your recent play.':'Подстраивается под вашу игру по последним ходам.',true) +
      DIFFICULTIES.map(d=>difficultyCard(d.id,d.icon,text(d.name),text(d.desc),false)).join('') +
      '</div>' +
      '<div class="difficulty-live-note">'+(l==='en'?'Smart starts near Casual and moves up or down from the quality of your recent moves.':'«Умный» стартует около уровня «Любитель» и повышает или понижает силу по качеству последних ходов.')+'</div>';

    panel.querySelectorAll('.difficulty-card').forEach(card=>card.addEventListener('click',()=>{
      const mode=card.dataset.difficulty;
      setDifficultyMode(mode===ADAPTIVE?ADAPTIVE:mode);
      select.value=mode===ADAPTIVE?ADAPTIVE_ENGINE_LEVEL:mode;
      renderDifficultyUI();
    }));
    select.value=getDifficultyMode()===ADAPTIVE?ADAPTIVE_ENGINE_LEVEL:getDifficultyMode();
  }

  function installAdaptiveHooks(){
    const AI=window.ChessAI;
    if(AI && !AI.__skyAdaptiveWrapped){
      const originalBestMove=AI.bestMove;
      AI.bestMove=function(st,level){
        const resolved=(String(level)===ADAPTIVE_ENGINE_LEVEL && getDifficultyMode()===ADAPTIVE) ? adaptiveLevel() : level;
        const result=originalBestMove.call(this,st,resolved);
        if(result) result.adaptiveLevel=resolved;
        return result;
      };
      AI.__skyAdaptiveWrapped=true;
    }
    const review=window.ChessReview;
    if(review && !review.__skyAdaptiveWrapped){
      const originalReview=review.review;
      review.review=function(){
        const result=originalReview.apply(this,arguments);
        const game=document.querySelector('#tab-game');
        if(result && game && !game.classList.contains('hidden')){
          writeAdaptiveResult(result.quality);
          setTimeout(renderDifficultyUI,0);
        }
        return result;
      };
      review.__skyAdaptiveWrapped=true;
    }
  }

  function initEnhancements(){
    ensureStyles();
    document.documentElement.dataset.chessTeacher=getSelected();
    renderDifficultyUI();
    installAdaptiveHooks();
    refreshCurrentTeachers();
  }

  window.addEventListener('chessTeacherChanged',()=>{
    document.documentElement.dataset.chessTeacher=getSelected();
    renderDifficultyUI();
  });

  setTimeout(initEnhancements,0);

  return {renderFor,renderCurrent,renderPicker,refreshCurrentTeachers,refreshInlineReviews,getSelected,setSelected,getTeacher:()=>TEACHERS[getSelected()],TEACHERS,FACES,renderDifficultyUI,adaptiveLevel};
})();
