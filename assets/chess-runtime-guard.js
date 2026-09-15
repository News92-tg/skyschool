/* SkyySchool — runtime guard for optional/blocked teacher-cloud UI.
   Keeps the page bootable when Supabase RLS is not configured yet or when
   another UI layer has removed an optional teacher node. */
'use strict';
(function () {
  function ensure(id, tag, parent, className) {
    let el = document.getElementById(id);
    if (el) return el;
    if (!parent) return null;
    el = document.createElement(tag || 'div');
    el.id = id;
    if (className) el.className = className;
    parent.appendChild(el);
    return el;
  }

  function repairTeacherDom() {
    const tab = document.getElementById('tab-teacher');
    if (!tab) return;
    const gate = ensure('tGate', 'div', tab);
    const body = ensure('tBody', 'div', tab, 'hidden');
    ensure('tTitle', 'h2', body);
    ensure('tNew', 'button', body, 'btn chess small hidden');
    ensure('tList', 'div', body, 'list');
    return { gate, body };
  }

  function boot() {
    repairTeacherDom();
    const tab = document.getElementById('tab-teacher');
    if (tab && !tab.__skyTeacherGuard) {
      tab.__skyTeacherGuard = true;
      new MutationObserver(repairTeacherDom).observe(tab, { childList: true, subtree: true });
    }
  }

  boot();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
