/* SkyySchool — puzzle catalog filters. Uses the existing puzzle array in-place. */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const labels={
    all:'Все',mate1:'Мат в 1',fork:'Вилка',pin:'Связка',skewer:'Сквозной удар',discovered:'Вскрытая атака',defence:'Защита',endgame:'Эндшпиль'
  };
  const dLabels={all:'Любая',easy:'Легко',medium:'Средне',hard:'Сложно'};
  const raw=()=>Array.isArray(window.__CHESS_PUZZLES_RAW_BACKUP__)?window.__CHESS_PUZZLES_RAW_BACKUP__:window.CHESS_PUZZLES;
  let cat='all', diff='all';

  function ensure(){
    const tab=$('#tab-puzzles'); if(!tab || $('#puzzleFilters')) return !!tab;
    const host=document.createElement('div'); host.id='puzzleFilters';
    host.innerHTML=`<div class="pf-head"><div><b>Категория</b><span class="pf-count" id="pfCount"></span></div></div>
      <div class="pf-row" id="pfCats"></div>
      <div class="pf-row pf-diff" id="pfDiff"></div>`;
    tab.insertBefore(host,tab.firstElementChild);
    const cats=['all','mate1','fork','pin','skewer','discovered','defence','endgame'];
    host.querySelector('#pfCats').innerHTML=cats.map(k=>`<button type="button" class="pf-btn" data-cat="${k}">${labels[k]}</button>`).join('');
    host.querySelector('#pfDiff').innerHTML=['all','easy','medium','hard'].map(k=>`<button type="button" class="pf-btn pf-diff-btn" data-diff="${k}">${dLabels[k]}</button>`).join('');
    host.addEventListener('click',e=>{
      const c=e.target.closest('[data-cat]'),d=e.target.closest('[data-diff]');
      if(c){cat=c.dataset.cat; apply();}
      if(d){diff=d.dataset.diff; apply();}
    });
    return true;
  }

  function apply(){
    const source=raw(); if(!Array.isArray(source)) return;
    const filtered=source.filter(p=>(cat==='all'||(p.category||p.type)==cat)&&(diff==='all'||p.difficulty===diff));
    const target=window.CHESS_PUZZLES;
    if(!Array.isArray(target)) return;
    target.splice(0,target.length,...filtered);
    document.querySelectorAll('#pfCats .pf-btn').forEach(b=>b.classList.toggle('active',b.dataset.cat===cat));
    document.querySelectorAll('#pfDiff .pf-btn').forEach(b=>b.classList.toggle('active',b.dataset.diff===diff));
    const count=$('#pfCount'); if(count) count.textContent=`${filtered.length} задач`;
    if(typeof window.loadPuzzle==='function' && filtered.length) window.loadPuzzle(0);
    else {
      const title=$('#pTitle'); if(title) title.textContent='Нет задач для выбранного фильтра';
      const msg=$('#pMsg'); if(msg) msg.textContent='';
    }
  }

  function styles(){
    if($('#puzzle-filter-styles')) return;
    const st=document.createElement('style'); st.id='puzzle-filter-styles'; st.textContent=`
      #puzzleFilters{margin:0 0 14px;padding:13px 14px;border:1px solid var(--line);border-radius:16px;background:var(--panel);box-shadow:var(--shadow-sm)}
      #puzzleFilters .pf-head{font-size:11px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:900}
      #puzzleFilters .pf-head>div{display:flex;gap:8px;align-items:center}
      #puzzleFilters .pf-count{font-weight:800;color:var(--m-chess);text-transform:none;letter-spacing:0}
      #puzzleFilters .pf-row{display:flex;gap:6px;flex-wrap:wrap}
      #puzzleFilters .pf-diff{margin-top:7px;padding-top:8px;border-top:1px solid var(--line)}
      #puzzleFilters .pf-btn{padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel-2);font-size:11.5px;font-weight:900;color:var(--muted);transition:.15s}
      #puzzleFilters .pf-btn:hover{border-color:var(--line-2);transform:translateY(-1px)}
      #puzzleFilters .pf-btn.active{border-color:var(--m-chess);background:var(--m-chess-soft);color:var(--m-chess)}
    `; document.head.appendChild(st);
  }

  function init(){
    styles();
    if(!ensure()){setTimeout(init,50);return;}
    apply();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
