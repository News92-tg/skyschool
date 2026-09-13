/* SkyySchool — компактный рендер открытых уроков.
   Не меняет содержимое уроков и шахматную логику: только перестраивает DOM и размеры. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);

  function styles(){
    if($('#chess-lesson-fix-styles')) return;
    const s=document.createElement('style');
    s.id='chess-lesson-fix-styles';
    s.textContent=`
      /* Уроки: короткая строка по умолчанию */
      #tab-lessons #lessonList{display:grid;gap:8px}
      #tab-lessons #lessonList > .lesson{overflow:hidden;border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm)}
      #tab-lessons #lessonList > .lesson.open{border-color:var(--m-chess)}
      #tab-lessons #lessonList > .lesson > button{display:grid;grid-template-columns:30px minmax(0,1fr) 18px;align-items:center;gap:9px;width:100%;min-height:48px;padding:9px 12px;text-align:left}
      #tab-lessons #lessonList > .lesson > button > span:first-child{min-width:0;font-size:12px;font-weight:900;line-height:1.25}
      #tab-lessons #lessonList > .lesson > button > span:first-child:before{content:'Урок';display:block;margin-bottom:1px;color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.07em;text-transform:uppercase}
      #tab-lessons #lessonList > .lesson > button .arrow{justify-self:end;color:var(--muted);font-size:18px;line-height:1;transition:transform .18s,color .18s}
      #tab-lessons #lessonList > .lesson.open > button .arrow{transform:rotate(90deg);color:var(--m-chess)}

      /* Открытый урок: компактно и без вертикального растягивания */
      #tab-lessons #lessonList > .lesson > .body{display:grid!important;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start;padding:0 12px 12px}
      #tab-lessons #lessonList > .lesson > .body.is-reflowed{grid-template-columns:220px minmax(0,1fr)}
      #tab-lessons #lessonList > .lesson > .body > .lesson-copy{min-width:0;font-size:11px;line-height:1.55;color:var(--ink-2);white-space:pre-wrap}
      #tab-lessons #lessonList > .lesson > .body > .board{grid-column:1;width:220px!important;height:220px!important;max-width:220px!important;min-height:0!important;align-self:start!important;margin:0!important}
      #tab-lessons #lessonList > .lesson > .body > .board .sqr{min-width:0!important;min-height:0!important}

      @media(max-width:700px){
        #tab-lessons #lessonList > .lesson > .body{grid-template-columns:180px minmax(0,1fr);gap:10px}
        #tab-lessons #lessonList > .lesson > .body > .board{width:180px!important;height:180px!important;max-width:180px!important}
        #tab-lessons #lessonList > .lesson > .body > .lesson-copy{font-size:10.5px;line-height:1.5}
      }
      @media(max-width:520px){
        #tab-lessons #lessonList > .lesson > .body{grid-template-columns:1fr}
        #tab-lessons #lessonList > .lesson > .body > .board{grid-column:1;width:min(220px,100%)!important;height:auto!important;aspect-ratio:1!important;margin:0 auto!important}
      }
    `;
    document.head.appendChild(s);
  }

  function compactCard(card){
    const body=card.querySelector(':scope > .body');
    if(!body || body.__lessonFix) return;
    const board=body.querySelector(':scope > .board');
    if(!board) return;

    const copy=document.createElement('div');
    copy.className='lesson-copy';

    const text=[];
    for(const node of Array.from(body.childNodes)){
      if(node===board) continue;
      if(node.nodeType===Node.TEXT_NODE && node.textContent.trim()) text.push(node.textContent);
      else if(node.nodeType===Node.ELEMENT_NODE) text.push(node.outerHTML);
    }
    copy.innerHTML=text.join('').replace(/\n{3,}/g,'\n\n');

    body.innerHTML='';
    body.appendChild(board);
    body.appendChild(copy);
    body.classList.add('is-reflowed');
    body.__lessonFix=true;
  }

  function run(){
    styles();
    const host=$('#lessonList');
    if(!host) return;
    host.querySelectorAll(':scope > .lesson').forEach(compactCard);
  }

  function init(){
    run();
    const host=$('#lessonList');
    if(host && !host.__lessonFixObserver){
      const mo=new MutationObserver(()=>run());
      mo.observe(host,{childList:true,subtree:true});
      host.__lessonFixObserver=true;
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
  document.addEventListener('langchange',()=>setTimeout(run,0));
})();
