/* SkyySchool — runtime guard for optional/blocked cloud UI and partial DOM. */
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

  function repairChessDom() {
    const main = document.querySelector('main.wrap') || document.body;
    const tabs = document.querySelector('.tabs');
    const names = ['lessons','puzzles','game','teacher','live'];

    /* The tab click handler assumes every target section exists. Keep that
       invariant true even if an optional layer removes a node. */
    if (tabs) {
      names.forEach(name => ensure('tab-' + name, 'section', main, name === 'lessons' ? '' : 'hidden'));
    }

    const teacher = document.getElementById('tab-teacher');
    if (!teacher) return;
    const gate = ensure('tGate', 'div', teacher);
    const body = ensure('tBody', 'div', teacher, 'hidden');
    let head = body.querySelector('.section-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'section-head';
      body.insertBefore(head, body.firstChild || null);
    }
    ensure('tTitle', 'h2', head);
    ensure('tNew', 'button', head, 'btn chess small hidden');
    ensure('tList', 'div', body, 'list');
    return { gate, body };
  }

  function boot() {
    repairChessDom();
    const teacher = document.getElementById('tab-teacher');
    if (teacher && !teacher.__skyTeacherGuard) {
      teacher.__skyTeacherGuard = true;
      new MutationObserver(repairChessDom).observe(teacher, { childList: true, subtree: true });
    }
  }

  boot();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
