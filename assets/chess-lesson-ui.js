/* SkyySchool — компактный UI уроков. Только представление, без изменения шахматной логики. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  function addStyles(){
    if($('#chess-lesson-compact-styles')) return;
    const s=document.createElement('style');
    s.id='chess-lesson-compact-styles';
    s.textContent=`
      #tab-lessons .lesson-list-modern{display:grid;gap:8px}
      #tab-lessons .lesson-modern{border:1px solid var(--line);border-radius:var(--r);background:var(--panel);box-shadow:var(--shadow-sm);overflow:hidden}
      #tab-lessons .lesson-modern>button{display:grid;grid-template-columns:30px minmax(0,1fr) 18px;gap:10px;align-items:center;width:100%;padding:11px 13px;text-align:left}
      #tab-lessons .lesson-number{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:var(--m-chess-soft);color:var(--m-chess);font-size:10px;font-weight:900}
      #tab-lessons .lesson-title-wrap{min-width:0}
      #tab-lessons .lesson-modern-title{display:block;font-size:12.5px;font-weight:900;line-height:1.25}
      #tab-lessons .lesson-modern-sub{display:block;margin-top:2px;font-size:9.5px;color:var(--muted)}
      #tab-lessons .lesson-chevron{font-size:17px;line-height:1;color:var(--muted);transition:transform .18s,color .18s}
      #tab-lessons .lesson-modern.open{border-color:var(--m-chess);box-shadow:var(--shadow)}
      #tab-lessons .lesson-modern.open .lesson-chevron{transform:rotate(90deg);color:var(--m-chess)}
      #tab-lessons .lesson-modern-body{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;padding:0 13px 13px}
      #tab-lessons .lesson-demo{min-width:0;padding:9px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
      #tab-lessons .lesson-demo-title{margin-bottom:7px;font-size:9px;font-weight:900;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
      #tab-lessons .lesson-demo-board{width:100%!important;height:auto!important;aspect-ratio:1/1!important;display:grid!important;grid-template-columns:repeat(8,minmax(0,1fr))!important;grid-auto-rows:1fr!important;overflow:hidden!important;border-radius:9px!important}
      #tab-lessons .lesson-demo-board .sqr{min-width:0!important;width:auto!important;height:auto!important;aspect-ratio:auto!important}
      #tab-lessons .lesson-demo-board .piece{font-size:clamp(18px,3vw,28px)!important}
      #tab-lessons .lesson-tip{margin-top:8px;padding:8px 9px;border-radius:9px;background:var(--m-chess-soft);color:var(--m-chess);font-size:9px;line-height:1.4;font-weight:800}
      #tab-lessons .lesson-text{min-width:0;padding:3px 2px}
      #tab-lessons .lesson-text-content{white-space:pre-wrap;font-size:11.5px;line-height:1.55;color:var(--ink-2)}
      #tab-lessons .lesson-text-content::first-line{font-weight:600}
      @media(max-width:720px){
        #tab-lessons .lesson-modern-body{grid-template-columns:180px minmax(0,1fr);gap:10px}
        #tab-lessons .lesson-modern-title{font-size:12px}
        #tab-lessons .lesson-text-content{font-size:11px}
      }
      @media(max-width:560px){
        #tab-lessons .lesson-modern-body{grid-template-columns:1fr}
        #tab-lessons .lesson-demo-board{max-width:220px;margin:0 auto!important}
        #tab-lessons .lesson-tip{font-size:9.5px}
      }
    `;
    document.head.appendChild(s);
  }
  function compactOpenLesson(){
    const host=$('#lessonList');
    if(!host||host.__compactLessonBound)return;
    host.__compactLessonBound=true;
    host.addEventListener('click',e=>{
      const card=e.target.closest('.lesson-modern');
      if(!card)return;
      requestAnimationFrame(()=>{
        if(card.classList.contains('open')) card.scrollIntoView({block:'nearest',behavior:'smooth'});
      });
    });
  }
  function init(){addStyles();compactOpenLesson();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
