/* SkyySchool — final lesson presentation polish.
   Keeps the motion board isolated and only improves lesson layout/typography. */
'use strict';
(function(){
  const $=(s,r=document)=>r.querySelector(s);
  function style(){
    if($('#lesson-polish-v1')) return;
    const s=document.createElement('style');
    s.id='lesson-polish-v1';
    s.textContent=`
      #tab-lessons .lesson-modern-body{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) minmax(310px,380px)!important;
        align-items:start!important;
        gap:22px!important;
        width:100%!important;
        max-width:1080px!important;
        margin:0 auto!important;
        padding:0 16px 16px!important;
        box-sizing:border-box!important;
      }
      #tab-lessons .lesson-modern .lesson-text{
        order:1!important;
        width:auto!important;
        min-width:0!important;
        padding:5px 2px!important;
      }
      #tab-lessons .lesson-modern .lesson-demo{
        order:2!important;
        width:auto!important;
        min-width:0!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:center!important;
        box-sizing:border-box!important;
        padding:13px!important;
        border:1px solid var(--line)!important;
        border-radius:14px!important;
        background:linear-gradient(180deg,var(--panel-2),var(--panel))!important;
        position:sticky!important;
        top:84px!important;
      }
      #tab-lessons .lesson-modern .lesson-demo-title{
        width:100%!important;
        margin:0 0 10px!important;
        text-align:left!important;
        font-size:10px!important;
        letter-spacing:.07em!important;
      }
      #tab-lessons .lesson-modern .lesson-text-content{
        font-size:12.5px!important;
        line-height:1.65!important;
        max-width:760px!important;
      }
      #tab-lessons .lesson-modern .lesson-text-content p,
      #tab-lessons .lesson-modern .lesson-text-content br+br{
        margin-bottom:8px!important;
      }
      #tab-lessons .lesson-modern .lesson-demo-board{
        width:100%!important;
        max-width:none!important;
        height:auto!important;
        min-height:0!important;
        aspect-ratio:auto!important;
        display:flex!important;
        justify-content:center!important;
        align-items:center!important;
        margin:0!important;
        padding:0!important;
        overflow:visible!important;
      }
      #tab-lessons .mini-board{
        width:min(280px,100%)!important;
        height:auto!important;
        aspect-ratio:1/1!important;
      }
      #tab-lessons .lesson-modern{
        overflow:visible!important;
        transition:transform .18s,box-shadow .18s,border-color .18s!important;
      }
      #tab-lessons .lesson-modern:hover{transform:translateY(-1px)!important}
      #tab-lessons .lesson-modern.open{box-shadow:0 12px 30px rgba(55,72,110,.10)!important}
      #tab-lessons .lesson-motion-wrap{width:min(360px,100%)!important}
      #tab-lessons .lesson-motion-piece{margin-top:3px!important}
      #tab-lessons .lesson-motion-piece-btn span{line-height:.9!important}
      #tab-lessons .lesson-motion-info{font-size:10.5px!important}
      #tab-lessons .lesson-motion-actions{margin-top:2px!important}
      @media(max-width:820px){
        #tab-lessons .lesson-modern-body{grid-template-columns:1fr!important;gap:14px!important}
        #tab-lessons .lesson-modern .lesson-demo{position:static!important}
        #tab-lessons .lesson-modern .lesson-text-content{max-width:none!important}
      }
      @media(max-width:560px){
        #tab-lessons .lesson-modern-body{padding:0 12px 12px!important}
        #tab-lessons .lesson-modern .lesson-demo{padding:10px!important}
        #tab-lessons .lesson-modern .lesson-text-content{font-size:12px!important;line-height:1.58!important}
        #tab-lessons .lesson-motion-wrap{width:100%!important}
      }
    `;
    document.head.appendChild(s);
  }
  function enrich(){
    const host=$('#lessonList');
    if(!host) return;
    const cards=host.querySelectorAll(':scope > .lesson-modern');
    const phases=['База','Правила','Тактика','Тактика','Тактика','Тактика','Тактика','Мат','Дебют','Стратегия','Ловушки','Тактика','Тактика','Стратегия','Эндшпиль'];
    cards.forEach((card,i)=>{
      card.dataset.step=String(i+1);
      card.dataset.phase=phases[i]||'Практика';
      const sub=card.querySelector('.lesson-modern-sub');
      if(sub && !sub.dataset.polished){
        const text=sub.textContent.trim();
        sub.textContent=(text?text+' · ':'')+(phases[i]||'Практика');
        sub.dataset.polished='1';
      }
    });
  }
  function tunePiece(){
    document.querySelectorAll('#tab-lessons .lesson-motion-piece').forEach(p=>{ p.style.marginTop='3px'; });
  }
  function init(){
    style(); enrich(); tunePiece();
    const host=$('#lessonList');
    if(host && !host.__lessonPolishObserver){
      const obs=new MutationObserver(()=>{
        clearTimeout(host.__lessonPolishTimer);
        host.__lessonPolishTimer=setTimeout(()=>{enrich();tunePiece();},30);
      });
      obs.observe(host,{childList:true,subtree:true});
      host.__lessonPolishObserver=obs;
    }
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0),{once:true});
  else setTimeout(init,0);
})();
