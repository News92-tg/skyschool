/* SkyySchool — runtime hardening for pages that receive auth events before DOM is ready. */
'use strict';
(function(){
  var installed=false;
  function patch(){
    if(installed)return true;
    if(typeof window.loadTeacherTasks!=='function')return false;
    var original=window.loadTeacherTasks;
    if(original.__skySafe)return true;
    var safe=async function(){
      if(!document.getElementById('tGate')||!document.getElementById('tBody')) return;
      try{return await original.apply(this,arguments);}catch(err){
        console.error('SkyySchool: teacher tasks failed',err);
        var gate=document.getElementById('tGate');
        if(gate){gate.innerHTML='<div class="panel"><div class="empty"><div class="big">⚠️</div><b>Не удалось загрузить задания</b><p>Попробуйте обновить страницу.</p></div></div>';} 
      }
    };
    safe.__skySafe=true;
    window.loadTeacherTasks=safe;
    installed=true;
    return true;
  }
  function start(){
    patch();
    if(installed)return;
    var tries=0,t=setInterval(function(){if(patch()||++tries>80)clearInterval(t);},50);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
