/* SkyySchool — runtime hardening for early auth events and partial chess DOM. */
'use strict';
(function(){
  let installed=false;

  function ensureTeacherDom(){
    const root=document.getElementById('tab-teacher');
    if(!root)return false;
    const ensure=(id,tag='div',parent=root,cls='')=>{
      let el=document.getElementById(id);
      if(!el){el=document.createElement(tag);el.id=id;if(cls)el.className=cls;parent.appendChild(el);}
      return el;
    };
    const gate=ensure('tGate');
    const body=ensure('tBody');
    body.classList.add('hidden');
    const head=body.querySelector('.section-head')||body.insertBefore(document.createElement('div'),body.firstChild);
    head.classList.add('section-head');
    ensure('tTitle','h2',head);
    ensure('tNew','button',head,'btn chess small hidden');
    ensure('tList','div',body,'list');
    return true;
  }

  function patch(){
    ensureTeacherDom();
    if(installed)return true;
    const fn=window.loadTeacherTasks;
    if(typeof fn!=='function')return false;
    if(fn.__skySafe)return true;
    const safe=async function(){
      ensureTeacherDom();
      try{return await fn.apply(this,arguments);}catch(err){
        console.error('[SkyySchool] teacher tasks failed',err);
        const gate=document.getElementById('tGate');
        if(gate)gate.innerHTML='<div class="panel"><div class="empty"><div class="big">⚠️</div><b>Не удалось загрузить задания</b><p>Проверьте подключение Supabase и права таблиц.</p></div></div>';
        return null;
      }
    };
    safe.__skySafe=true;
    window.loadTeacherTasks=safe;
    installed=true;
    return true;
  }

  /* Важно: начинаем ждать сразу. Supabase может успеть разрешить auth
     promise раньше DOMContentLoaded, поэтому ждать DOMContentLoaded здесь
     уже слишком поздно. */
  const timer=setInterval(()=>{
    ensureTeacherDom();
    if(patch())clearInterval(timer);
  },25);
  patch();
  setTimeout(()=>clearInterval(timer),15000);

  window.addEventListener('error',e=>{
    const msg=String(e?.message||'');
    if(msg.includes('Cannot read properties of null') && document.getElementById('tab-teacher')){
      ensureTeacherDom();
      patch();
    }
  });
})();
