/* ============================================================
   SkyySchool — подборки заданий: общее для страниц
     collections.html (учитель), collection.html (ученик),
     homework.html (поле «Код подборки» у ученика).

   Код подборки — 6 символов из алфавита без I, O, 1, 0 (как код
   класса); его ставит база (sql/schema-collections.sql).
   ============================================================ */
'use strict';

window.SkyCollections = (function () {
  Sky.extendDict({
    haveCode:{ru:'Есть код подборки от учителя?',en:'Got a collection code from your teacher?'},
    openCode:{ru:'Открыть',en:'Open'},
    badCode:{ru:'Код — 6 букв и цифр, например A3K7MN',en:'The code is 6 letters and digits, e.g. A3K7MN'}
  });

  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isCode = s => new RegExp('^[' + ALPHABET + ']{6}$').test(s);

  /* Ссылка на подборку — рядом с текущей страницей: на сайте это
     https://news92-tg.github.io/skyschool/collection.html?code=… */
  const url = code => new URL('collection.html?code=' + encodeURIComponent(code), location.href).href;

  function bindCodeForm(form, input) {
    input.addEventListener('input', () => {
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      try { input.setSelectionRange(pos, pos); } catch (e) {}
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const code = normCode(input.value);
      if (!isCode(code)) { Sky.toast(Sky.t('badCode'), 4000); input.focus(); return; }
      location.href = url(code);
    });
  }

  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) {}
    /* запасной путь: старые браузеры и страницы не по https */
    const t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;top:-100px;opacity:0';
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    t.remove();
    return ok;
  }

  return { ALPHABET, normCode, isCode, url, bindCodeForm, copy };
})();
