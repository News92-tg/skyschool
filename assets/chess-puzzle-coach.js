/* SkyySchool — разбор шахматных задач в учебном формате. */
'use strict';
(function () {
  const STYLE_ID='chess-puzzle-coach-v7';
  const PANEL_ID='pCoachReview';
  const $=id=>document.getElementById(id);
  const tx=(ru,en)=>window.Sky&&Sky.lang==='en'?en:ru;
  const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  let puzzleKey='',attemptSan='',fromSquare=-1,reviewOpen=false;

  function addStyles(){
    if($(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;
    s.textContent=`
      #tab-puzzles .puzzle-coach-actions{display:grid;gap:8px;margin-top:12px}
      #tab-puzzles .puzzle-coach-main{width:100%;min-height:40px}
      #tab-puzzles .puzzle-coach-main[disabled]{opacity:.42;cursor:not-allowed}
      #tab-puzzles .puzzle-coach-secondary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      #tab-puzzles .puzzle-coach-secondary .btn{width:100%}
      #tab-puzzles .puzzle-coach-review{margin-top:12px;padding:13px;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-puzzles .puzzle-coach-review.hidden{display:none!important}
      #tab-puzzles .pcr-head{display:flex;align-items:center;gap:10px}
      #tab-puzzles .pcr-face{width:44px;height:44px;flex:0 0 44px;border-radius:50%;overflow:hidden;background:var(--m-chess-soft)}
      #tab-puzzles .pcr-face svg{display:block;width:100%;height:100%}
      #tab-puzzles .pcr-head-copy{min-width:0;flex:1}
      #tab-puzzles .pcr-name{font-size:12px;font-weight:900;line-height:1.2}
      #tab-puzzles .pcr-role{margin-top:2px;font-size:9px;line-height:1.3;color:var(--muted)}
      #tab-puzzles .pcr-title{margin-top:10px;font-size:15px;font-weight:900;line-height:1.25}
      #tab-puzzles .pcr-kicker{margin-top:3px;font-size:10px;line-height:1.4;color:var(--muted)}
      #tab-puzzles .pcr-card{margin-top:9px;padding:10px 11px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2)}
      #tab-puzzles .pcr-card.good{border-color:var(--ok);background:var(--ok-soft)}
      #tab-puzzles .pcr-card.bad{border-color:var(--no);background:var(--no-soft)}
      #tab-puzzles .pcr-label{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-bottom:4px}
      #tab-puzzles .pcr-text{font-size:11px;line-height:1.55;color:var(--ink-2)}
      #tab-puzzles .pcr-lesson{margin-top:8px;padding:10px 11px;border-left:3px solid var(--m-chess);border-radius:0 10px 10px 0;background:var(--m-chess-soft);font-size:11px;line-height:1.55}
      #tab-puzzles .pcr-lesson b{display:block;margin-bottom:3px;color:var(--m-chess);font-size:10px}
      #tab-puzzles .pcr-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-top:8px}
      #tab-puzzles .pcr-fact{min-width:0;padding:8px 9px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2)}
      #tab-puzzles .pcr-fact b{display:block;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:10px;line-height:1.25;overflow-wrap:anywhere}
      #tab-puzzles .pcr-fact span{display:block;margin-top:3px;font-size:8px;line-height:1.25;color:var(--muted)}
      #tab-puzzles .pcr-continue{margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:10px;line-height:1.45;color:var(--muted)}
      #tab-puzzles .pcr-change-coach{margin-left:auto;flex:0 0 auto;padding:5px 8px!important;font-size:9px!important}
      @media(max-width:520px){#tab-puzzles .pcr-facts{grid-template-columns:1fr 1fr}.pcr-change-coach{font-size:8px!important}}
    `;
    document.head.appendChild(s);
  }

  function currentPuzzle(){
    const list=window.CHESS_PUZZLES;
    if(!Array.isArray(list)||!list.length)return null;
    const raw=String($('pCount')?.textContent||'');
    const m=raw.match(/(\d+)\s*(?:из|of)\s*(\d+)/i);
    const index=m?Math.max(0,Math.min(list.length-1,Number(m[1])-1)):0;
    return list[index]||null;
  }
  function teacher(){try{return window.ChessTeacherUI?.getTeacher?.()||null}catch(_){return null}}
  function teacherFace(){try{const id=window.ChessTeacherUI?.getSelected?.();return window.ChessTeacherUI?.FACES?.[id]||''}catch(_){return ''}}
  function strictText(t){return ['Очень мягкий','Мягкий','Средний','Строгий','Очень строгий'][Math.max(1,Math.min(5,+(t?.strictness||3)))-1]}
  function qualityTitle(q){const m={brilliant:['Блестящий ход','Brilliant move'],good:['Хороший ход','Good move'],inaccuracy:['Неточность','Inaccuracy'],mistake:['Ошибка','Mistake'],blunder:['Грубая ошибка','Blunder']};const p=m[q]||['Ход','Move'];return tx(p[0],p[1])}

  function ensurePanel(){
    const side=document.querySelector('#tab-puzzles .side');if(!side)return null;
    let panel=$(PANEL_ID);
    if(!panel){panel=document.createElement('section');panel.id=PANEL_ID;panel.className='puzzle-coach-review hidden';side.appendChild(panel)}
    return panel;
  }

  function ensureActions(){
    const side=document.querySelector('#tab-puzzles .side');if(!side)return;
    let root=side.querySelector('.puzzle-coach-actions');const old=side.querySelector('.actions');
    if(!root){
      root=document.createElement('div');root.className='puzzle-coach-actions';
      const secondary=document.createElement('div');secondary.className='puzzle-coach-secondary';
      if(old){while(old.firstChild)secondary.appendChild(old.firstChild);old.replaceWith(root)}else side.appendChild(root);
      root.appendChild(secondary);
    }
    let button=root.querySelector('#pCoachBtn');
    if(!button){button=document.createElement('button');button.type='button';button.id='pCoachBtn';button.className='btn chess puzzle-coach-main';button.addEventListener('click',toggleReview);root.insertBefore(button,root.firstChild)}
    button.textContent=reviewOpen?tx('Скрыть разбор','Hide review'):tx('Разобрать решение','Review solution');
    button.disabled=!attemptSan;
  }

  function resetForPuzzle(){
    const p=currentPuzzle();const key=p?String(p.id||p.fen||''):'';if(key===puzzleKey)return;
    puzzleKey=key;attemptSan='';fromSquare=-1;reviewOpen=false;ensurePanel()?.classList.add('hidden');
  }

  function captureFromMessage(){
    const msg=$('pMsg');if(!msg)return;const raw=String(msg.textContent||'').trim();if(!raw)return;
    let san='';const wrong=raw.match(/\(([^()]+)\)\s*$/);if(wrong)san=wrong[1].trim();
    if(!san){const right=raw.match(/(?:Верно|Correct)[^A-Za-zА-Яа-я0-9]*([A-Za-zА-Яа-я0-9+#=\-]+)\s*$/i);if(right)san=right[1].trim()}
    if(san)setAttempt(san);
  }

  function setAttempt(san){if(!san||san===attemptSan)return;attemptSan=san;reviewOpen=false;ensurePanel()?.classList.add('hidden');ensureActions()}

  function captureBoardClick(e){
    const cell=e.target.closest('#pBoard .sqr');if(!cell)return;const p=currentPuzzle(),E=window.ChessEngine;if(!p||!E)return;
    const sq=Number(cell.dataset.sq);if(!Number.isInteger(sq))return;
    if(fromSquare<0){const st=E.create(p.fen),piece=st.board[sq];if(piece&&(piece&8)===st.turn)fromSquare=sq;return}
    const st=E.create(p.fen),candidates=E.generate(st,{square:fromSquare}).filter(m=>m.to===sq);fromSquare=-1;if(!candidates.length)return;
    try{setAttempt(E.toSAN(st,candidates[0]))}catch(_){ }
  }

  function renderReview(){
    const panel=ensurePanel(),p=currentPuzzle();if(!panel||!p||!attemptSan||!window.ChessReview)return false;
    let result=null;try{result=ChessReview.review(p.fen,attemptSan)}catch(_){result=null}
    if(!result){panel.classList.remove('hidden');panel.innerHTML=`<div class="pcr-card bad"><div class="pcr-text">${tx('Не удалось разобрать этот ход в текущей позиции.','This move could not be reviewed in this position.')}</div></div>`;return true}

    const t=teacher()||{name:{ru:'Тренер'},role:{ru:''},strictness:3,phrases:{good:'Посмотри ещё раз на позицию.'}};
    const phrase=t.phrases?.[result.quality]||t.phrases?.good||'';
    const note=ChessReview.shortNote(result,(window.Sky&&Sky.lang)||'ru');
    const category=p.category||p.type||'general';
    const best=result.betterMove||tx('совпадает с твоим ходом','same as your move');
    const success=result.quality==='good'||result.quality==='brilliant';
    const idea=window.Sky?Sky.L(p.idea):'';
    const isMate=p.category==='mate1'||p.category==='mate2';
    const fallbackIdea=isMate
      ? tx('Сначала посчитай поля вокруг короля. Затем проверь: может ли соперник съесть атакующую фигуру или закрыться.','First count the king’s escape squares. Then check whether the attacking piece can be captured or the line blocked.')
      : tx('Назови идею хода: что ты атаковал, что защитил и какой ответ соперника должен был проверить.','Name the idea: what you attacked, what you protected, and which reply you needed to check.');

    panel.innerHTML=`
      <div class="pcr-head">
        <div class="pcr-face">${teacherFace()}</div>
        <div class="pcr-head-copy"><div class="pcr-name">${esc(t.name?.ru||'Тренер')}</div><div class="pcr-role">${esc(t.role?.ru||'')} · ${esc(strictText(t))}</div></div>
        <button type="button" class="btn ghost small pcr-change-coach">${tx('Сменить','Change')}</button>
      </div>
      <div class="pcr-title">${esc(attemptSan)} · ${esc(qualityTitle(result.quality))}</div>
      <div class="pcr-kicker">${tx('Учебный разбор задачи','Puzzle learning review')} · ${esc(category)}</div>
      <div class="pcr-card ${success?'good':'bad'}"><div class="pcr-label">${success?tx('Что сработало','What worked'):tx('Что проверить','What to check')}</div><div class="pcr-text">${esc(note)}</div></div>
      <div class="pcr-lesson"><b>${tx('Главная идея','Key idea')}</b>${esc(idea||fallbackIdea)}</div>
      <div class="pcr-facts">
        <div class="pcr-fact"><b>${esc(best)}</b><span>${tx('лучшее продолжение','best continuation')}</span></div>
        <div class="pcr-fact"><b>${esc(result.wasBest?'0.0':((Number(result.loss)||0)/100).toFixed(1))} п.</b><span>${tx('потеря оценки','evaluation loss')}</span></div>
      </div>
      <div class="pcr-continue">${tx('Следующий шаг: реши эту же позицию ещё раз без подсказки и сформулируй идею хода одним предложением.','Next: solve this position again without a hint and state the idea in one sentence.')}</div>
      <div class="pcr-quote">${esc(phrase)}</div>`;

    panel.querySelector('.pcr-change-coach')?.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('openChessTrainerChooser')));
    panel.classList.remove('hidden');return true;
  }

  function toggleReview(){
    if(!attemptSan)return;const panel=ensurePanel();if(!panel)return;
    if(reviewOpen){reviewOpen=false;panel.classList.add('hidden')}else reviewOpen=renderReview();ensureActions();
  }

  function refresh(){addStyles();resetForPuzzle();captureFromMessage();ensureActions()}
  function init(){
    addStyles();document.addEventListener('click',captureBoardClick,true);
    ['pCount','pMsg'].map($).filter(Boolean).forEach(node=>{const mo=new MutationObserver(refresh);mo.observe(node,{childList:true,subtree:true,characterData:true})});
    document.addEventListener('langchange',()=>setTimeout(refresh,0));
    window.addEventListener('chessTeacherChanged',()=>{if(reviewOpen)renderReview()});
    window.addEventListener('chessPuzzleLoaded',refresh);window.addEventListener('openChessTrainerChooser',refresh);
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});else setTimeout(init,0);
})();
