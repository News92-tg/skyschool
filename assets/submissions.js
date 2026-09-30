/* ============================================================
   SkyySchool — «Новые работы» в профиле учителя (profile.html#inbox)

   Что ждёт учителя (teacher_inbox() в базе):
     • ответы по его подборкам с развёрнутыми заданиями —
       «Проверить» открывает collections.html?review=<id>;
     • работы по фото, присланные ему по ссылке photo.html?to=<его id> —
       «Проверить» открывает photo.html?hw=<id>.
   Число в заголовке — сколько ждут. Здесь же ссылка для учеников:
   по ней работа по фото сразу попадает сюда, без пересылки ссылок.
   Список обновляется сам, когда вкладка снова на экране.
   ============================================================ */
'use strict';

(function () {

  Sky.extendDict({
    ibH:{ru:'Новые работы',en:'New work'},
    ibLead:{ru:'Ждут вашей проверки: ответы по подборкам и работы по фото.',en:'Waiting for your review: set answers and photo work.'},
    ibEmpty:{ru:'Новых работ нет — всё проверено.',en:'Nothing new — all reviewed.'},
    ibCheck:{ru:'Проверить',en:'Review'},
    ibPhoto:{ru:'Работа по фото',en:'Photo work'},
    ibScore:{ru:'%1 из %2',en:'%1 of %2'},
    ibMore:{ru:'Показать все (%1)',en:'Show all (%1)'},
    ibLinkH:{ru:'Ссылка для учеников',en:'Link for students'},
    ibLinkD:{ru:'Ученик открывает её, фотографирует работу — и она появляется здесь.',en:'A student opens it, snaps their work — and it shows up here.'},
    ibCopy:{ru:'Копировать',en:'Copy'},
    ibCopied:{ru:'Ссылка скопирована',en:'Link copied'},
    ibErr:{ru:'Список работ не загрузился',en:'Could not load the list'},
    ibNoName:{ru:'Без имени',en:'No name'}
  });

  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const SUBJ = { math:'Математика', algebra:'Алгебра', geometry:'Геометрия', physics:'Физика', chemistry:'Химия', biology:'Биология',
    history:'История', russian:'Русский', english:'Английский', informatics:'Информатика', geography:'География', social:'Обществознание' };
  const SUBJ_EN = { math:'Maths', algebra:'Algebra', geometry:'Geometry', physics:'Physics', chemistry:'Chemistry', biology:'Biology',
    history:'History', russian:'Russian', english:'English', informatics:'Computer science', geography:'Geography', social:'Social studies' };
  const subj = k => (Sky.lang === 'en' ? SUBJ_EN : SUBJ)[k] || '';
  const SHOW = 5;

  let me = null, section = null, ago = null;
  let items = [], expanded = false, failed = false, loadedAt = 0;

  const openUrl = it => it.kind === 'collection'
    ? 'collections.html?review=' + encodeURIComponent(it.id)
    : 'photo.html?hw=' + encodeURIComponent(it.id);
  const studentLink = () => new URL('photo.html?to=' + encodeURIComponent(me.id), location.href).href;

  function row(it) {
    const name = it.student_name || t('ibNoName');
    const what = it.kind === 'collection'
      ? `${esc(it.title || '')}${it.total ? ' · ' + esc(t('ibScore').replace('%1', it.score || 0).replace('%2', it.total)) : ''}`
      : `${esc(t('ibPhoto'))}${it.subject && subj(it.subject) ? ' · ' + esc(subj(it.subject)) : ''}${it.class ? ' · ' + esc(it.class) : ''}`;
    return `<li class="ib-row">
      ${Sky.avatar(name, 'sm')}
      <div class="ib-txt"><b>${esc(name)}</b><span>${what}</span></div>
      <span class="ib-when" title="${esc(new Date(it.created_at).toLocaleString(Sky.lang === 'en' ? 'en-GB' : 'ru-RU'))}">${esc(ago(it.created_at))}</span>
      <a class="btn small" href="${esc(openUrl(it))}">${esc(t('ibCheck'))}</a>
    </li>`;
  }

  function render() {
    const n = items.length;
    const list = expanded ? items : items.slice(0, SHOW);
    const body = failed
      ? `<p class="ib-empty">${esc(t('ibErr'))}</p>`
      : !n ? `<p class="ib-empty"><span aria-hidden="true">✅</span> ${esc(t('ibEmpty'))}</p>`
      : `<ul class="ib-list">${list.map(row).join('')}</ul>` +
        (n > SHOW && !expanded ? `<button type="button" class="ib-more" data-ib="more">${esc(t('ibMore').replace('%1', n))}</button>` : '');
    const el = section('inbox', `
      <h2><span>${esc(t('ibH'))}</span>${n ? `<span class="ib-badge" aria-label="${n}">${n > 99 ? '99+' : n}</span>` : ''}</h2>
      <p>${esc(t('ibLead'))}</p>
      ${body}
      <div class="ib-link">
        <div><b>${esc(t('ibLinkH'))}</b><span>${esc(t('ibLinkD'))}</span></div>
        <div class="ib-link-row"><input type="text" readonly value="${esc(studentLink())}" aria-label="${esc(t('ibLinkH'))}"><button type="button" class="btn ghost small" data-ib="copy">${esc(t('ibCopy'))}</button></div>
      </div>`, { first: true });
    el.querySelectorAll('[data-ib]').forEach(b => b.addEventListener('click', () => act(b.dataset.ib)));
  }

  async function act(what) {
    if (what === 'more') { expanded = true; render(); return; }
    if (what === 'copy') {
      const v = studentLink();
      let ok = false;
      try { await navigator.clipboard.writeText(v); ok = true; } catch (e) {
        const i = document.querySelector('#inbox .ib-link input');
        if (i) { i.select(); try { ok = document.execCommand('copy'); } catch (err) {} }
      }
      Sky.toast(ok ? t('ibCopied') : v, 3000);
    }
  }

  async function load() {
    try {
      items = (await Sky.db.rpc('teacher_inbox', { p_limit: 100 })) || [];
      failed = false;
    } catch (e) {
      failed = true;
      if (window.SkyErrors) SkyErrors.show(e, { retry: load, context: 'inbox' });
    }
    loadedAt = Date.now();
    render();
  }

  if (!window.SkyProfile) return;
  SkyProfile.ready.then(p => {
    me = p.me; section = p.section; ago = p.ago;
    if (me.role !== 'teacher' || !Sky.db.isCloud()) return;
    load();
  });
  /* Вернулись во вкладку (например, из проверки) — обновить список, но
     не чаще раза в 20 секунд. */
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && section && me && me.role === 'teacher' && Date.now() - loadedAt > 20000) load();
  });
  document.addEventListener('langchange', () => { if (section && me && me.role === 'teacher') render(); });

  window.SkyInbox = { reload: load, get count() { return items.length; } };
})();
