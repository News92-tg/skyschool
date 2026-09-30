/* ============================================================
   SkyySchool — окно «Оформление» (кнопка ◐ в шапке)

   Тема: «Светлая», «Тёмная», «Как в системе» (следит за системой —
   сменилась ночью, сменится и сайт). Цвет акцента: небо (как всегда),
   фиалка, изумруд, коралл, океан — кнопки, выделение, ссылки.
   Выбор хранится в браузере (Sky.setTheme / Sky.setAccent в core.js),
   применяется до отрисовки следующей страницы.

   Подключается сам на каждой странице (assets/core.js).
   ============================================================ */
'use strict';

(function () {
  if (window.SkyTheme) return;

  Sky.extendDict({
    thTitle:{ru:'Оформление',en:'Appearance'},
    thMode:{ru:'Тема',en:'Theme'},
    thLight:{ru:'Светлая',en:'Light'},
    thDark:{ru:'Тёмная',en:'Dark'},
    thAuto:{ru:'Как в системе',en:'System'},
    thAccent:{ru:'Цвет',en:'Colour'},
    thSky:{ru:'Небо',en:'Sky'},
    thViolet:{ru:'Фиалка',en:'Violet'},
    thEmerald:{ru:'Изумруд',en:'Emerald'},
    thCoral:{ru:'Коралл',en:'Coral'},
    thOcean:{ru:'Океан',en:'Ocean'},
    thClose:{ru:'Закрыть',en:'Close'}
  });

  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const MODES = [
    ['light', 'thLight', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
    ['dark', 'thDark', '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'],
    ['auto', 'thAuto', '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>']
  ];
  const ACCENTS = [['sky', 'thSky', '#2f8dfa'], ['violet', 'thViolet', '#7048e8'], ['emerald', 'thEmerald', '#0a7f58'], ['coral', 'thCoral', '#d23a47'], ['ocean', 'thOcean', '#0e7c9a']];
  const icon = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  let pop = null, anchor = null;

  function html() {
    const mode = Sky.themePref(), acc = Sky.accent();
    return `
      <div class="th-head"><b id="thTitle">${esc(t('thTitle'))}</b>
        <button type="button" class="th-x" data-th="close" aria-label="${esc(t('thClose'))}">×</button></div>
      <div class="th-lbl">${esc(t('thMode'))}</div>
      <div class="th-modes" role="radiogroup" aria-label="${esc(t('thMode'))}">
        ${MODES.map(([id, k, d]) => `<button type="button" role="radio" data-mode="${id}" aria-checked="${mode === id}" tabindex="${mode === id ? 0 : -1}">${icon(d)}<span>${esc(t(k))}</span></button>`).join('')}
      </div>
      <div class="th-lbl">${esc(t('thAccent'))}</div>
      <div class="th-accents" role="radiogroup" aria-label="${esc(t('thAccent'))}">
        ${ACCENTS.map(([id, k, c]) => `<button type="button" role="radio" data-accent="${id}" aria-checked="${acc === id}" tabindex="${acc === id ? 0 : -1}"
            aria-label="${esc(t(k))}" title="${esc(t(k))}" style="--sw:${c}"><span aria-hidden="true"></span></button>`).join('')}
      </div>`;
  }

  function place() {
    if (!pop || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = pop.offsetWidth, vw = document.documentElement.clientWidth;
    if (vw <= 560) { pop.style.left = ''; pop.style.top = ''; return; }   /* на телефоне — снизу, по CSS */
    pop.style.left = Math.max(12, Math.min(vw - w - 12, r.right - w)) + 'px';
    pop.style.top = (r.bottom + 8) + 'px';
  }

  function render() {
    if (!pop) return;
    pop.innerHTML = html();
    pop.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { Sky.setTheme(b.dataset.mode); refresh('[data-mode="' + b.dataset.mode + '"]'); }));
    pop.querySelectorAll('[data-accent]').forEach(b => b.addEventListener('click', () => { Sky.setAccent(b.dataset.accent); refresh('[data-accent="' + b.dataset.accent + '"]'); }));
    pop.querySelector('[data-th=close]').addEventListener('click', () => close(true));
  }
  function refresh(focusSel) {
    render();
    const f = pop.querySelector(focusSel);
    if (f) f.focus();
  }

  /* Стрелки внутри группы — как у обычных переключателей. */
  function onKey(e) {
    if (!pop) return;
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    const group = e.target.closest && e.target.closest('[role=radiogroup]');
    if (!group || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const items = [...group.querySelectorAll('[role=radio]')];
    const i = items.indexOf(e.target);
    const next = items[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
    e.preventDefault();
    next.click();
  }
  function onOutside(e) {
    if (pop && !pop.contains(e.target) && e.target !== anchor && !(anchor && anchor.contains(e.target))) close(false);
  }

  function open(btn) {
    anchor = btn;
    pop = document.createElement('div');
    pop.className = 'th-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-labelledby', 'thTitle');
    document.body.appendChild(pop);
    render();
    place();
    requestAnimationFrame(() => pop && pop.classList.add('in'));
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    const cur = pop.querySelector('[data-mode][aria-checked="true"]');
    if (cur) cur.focus();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
  }

  function close(returnFocus) {
    if (!pop) return;
    const p = pop; pop = null;
    p.classList.remove('in');
    setTimeout(() => p.remove(), 180);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onOutside, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (returnFocus) anchor.focus(); }
  }

  function toggle(btn) { if (pop) close(true); else open(btn || document.getElementById('themeBtn')); }

  /* Шапку перерисовывают при смене языка — окно закрываем, иначе оно
     висело бы у кнопки, которой больше нет. */
  document.addEventListener('langchange', () => close(false));
  document.addEventListener('headerready', () => close(false));

  window.SkyTheme = { open, close, toggle, get isOpen() { return !!pop; } };
})();
