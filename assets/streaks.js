/* ============================================================
   Стрики SkyySchool — серия дней подряд.
   Считает, сколько дней подряд ученик занимался.
   Хранит в localStorage.
   ============================================================ */
'use strict';

window.Streaks = (function () {

  const KEY = 'sky_streak';

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{"days":0,"lastDay":""}');
    } catch (e) {
      return { days: 0, lastDay: '' };
    }
  }

  function save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  // Отметить, что ученик занимался сегодня
  function tick() {
    const s = load();
    const t = today();

    if (s.lastDay === t) return s;

    if (s.lastDay === yesterday()) {
      s.days += 1;
    } else {
      s.days = 1;
    }
    s.lastDay = t;
    save(s);
    return s;
  }

  function current() {
    return load().days;
  }

  // Отрисовка огонька в index.html
  function render(selector) {
    const el = document.querySelector(selector || '#stStreak');
    if (!el) return;
    el.textContent = current();
  }

  return { tick, current, render };
})();
