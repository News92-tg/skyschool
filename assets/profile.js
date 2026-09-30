/* ============================================================
   SkyySchool — профиль (profile.html)

   Кто я (имя, почта, роль), тариф и «Сменить тариф», статистика
   (my_stats() в базе), быстрые ссылки и «Выйти». Имя можно поправить
   прямо здесь.

   Другие модули добавляют свои разделы через SkyProfile.ready:
     SkyProfile.ready.then(({ me, section }) => section('telegram', …))
   — «Новые работы» (assets/submissions.js), Telegram.
   ============================================================ */
'use strict';

(function () {

  Sky.init({
    pfTitle:{ru:'Профиль',en:'Profile'},
    pfPlan:{ru:'Тариф',en:'Plan'},
    pfPlanUntil:{ru:'до %1',en:'until %1'},
    pfPlanForever:{ru:'бессрочно',en:'no end date'},
    pfPlanChange:{ru:'Сменить тариф',en:'Change plan'},
    pfSignOut:{ru:'Выйти',en:'Sign out'},
    pfEdit:{ru:'Изменить имя',en:'Edit name'},
    pfSave:{ru:'Сохранить',en:'Save'},
    pfCancel:{ru:'Отмена',en:'Cancel'},
    pfSaved:{ru:'Имя сохранено',en:'Name saved'},
    pfNeedName:{ru:'Имя не может быть пустым',en:'Name cannot be empty'},
    pfStatsH:{ru:'Статистика',en:'Statistics'},
    pfChecks:{ru:'Проверок всего',en:'Checks in total'},
    pfStudents:{ru:'Учеников',en:'Students'},
    pfAvg:{ru:'Средний балл',en:'Average mark'},
    pfAvgClass:{ru:'Средний балл класса',en:'Class average'},
    pfLast:{ru:'Последняя проверка',en:'Last check'},
    pfNever:{ru:'ещё не было',en:'none yet'},
    pfNoMarks:{ru:'нет оценок',en:'no marks'},
    pfOf:{ru:'из %1 оценок',en:'from %1 marks'},
    pfPending:{ru:'%1 ждут проверки',en:'%1 awaiting review'},
    pfStatsErr:{ru:'Статистика не загрузилась',en:'Statistics did not load'},
    pfQuick:{ru:'Быстрые действия',en:'Quick actions'},
    pfQColl:{ru:'Подборки',en:'Task sets'},
    pfQCollD:{ru:'задания по ссылке',en:'tasks by link'},
    pfQPhoto:{ru:'Проверка по фото',en:'Photo check'},
    pfQPhotoD:{ru:'тетради за минуту',en:'notebooks in a minute'},
    pfQFast:{ru:'Быстрая проверка теста',en:'Quick test check'},
    pfQFastD:{ru:'класс по эталону',en:'whole class by key'},
    pfQAnalytics:{ru:'Аналитика',en:'Analytics'},
    pfQAnalyticsD:{ru:'успеваемость класса',en:'class performance'},
    pfQTrainer:{ru:'Тренажёр',en:'Trainer'},
    pfQTrainerD:{ru:'задания с разбором',en:'tasks with walkthroughs'},
    pfQHomework:{ru:'Задания',en:'Homework'},
    pfQHomeworkD:{ru:'от учителя',en:'from your teacher'},
    pfQParent:{ru:'Родителям',en:'For parents'},
    pfQParentD:{ru:'успехи ребёнка',en:'your child’s progress'},
    pfAdmin:{ru:'Админ-панель',en:'Admin panel'},
    pfOnboard:{ru:'Первые шаги: создайте подборку за 2 минуты',en:'First steps: create a set in 2 minutes'},
    pfLocal:{ru:'Облако не подключено: профиль хранится только на этом устройстве.',en:'The cloud is not connected: the profile lives on this device only.'},
    pfJust:{ru:'только что',en:'just now'},
    pfMin:{ru:'%1 мин назад',en:'%1 min ago'},
    pfHour:{ru:'%1 ч назад',en:'%1 h ago'},
    pfYesterday:{ru:'вчера',en:'yesterday'},
    pfDays:{ru:'%1 дн. назад',en:'%1 days ago'}
  });

  const $ = s => document.querySelector(s);
  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const locale = () => Sky.lang === 'en' ? 'en-GB' : 'ru-RU';
  const num = v => Sky.lang === 'en' ? String(v) : String(v).replace('.', ',');

  let me = null;
  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });

  function ago(iso) {
    if (!iso) return t('pfNever');
    const d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 90) return t('pfJust');
    if (s < 3600) return t('pfMin').replace('%1', Math.round(s / 60));
    if (s < 86400) return t('pfHour').replace('%1', Math.round(s / 3600));
    if (s < 172800) return t('pfYesterday');
    if (s < 7 * 86400) return t('pfDays').replace('%1', Math.floor(s / 86400));
    return d.toLocaleDateString(locale(), { day: 'numeric', month: 'long' });
  }

  /* ---------- шапка профиля ---------- */
  const PLAN_KEYS = { free: 'planFree', paid: 'planPaid', premium: 'planPremium' };
  let plan = { id: 'free', title: null, expires: null };

  async function loadPlan() {
    if (!Sky.db.isCloud()) return;
    const [rows, limits] = await Promise.all([Sky.db.list('user_plans', { user_id: me.id }), Sky.db.list('plan_limits')]);
    const row = (rows || [])[0];
    const live = row && row.plan && (!row.expires_at || new Date(row.expires_at) > new Date());
    const id = live ? row.plan : 'free';
    const ref = (limits || []).find(l => l.plan === id) || {};
    plan = { id, title: ref.title || null, expires: live ? row.expires_at : null };
  }
  const planName = () => PLAN_KEYS[plan.id] ? Sky.t(PLAN_KEYS[plan.id]) : (plan.title || plan.id);

  function renderHead() {
    const role = me.role || 'student';
    const until = plan.expires
      ? t('pfPlanUntil').replace('%1', new Date(plan.expires).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' }))
      : (plan.id !== 'free' ? t('pfPlanForever') : '');
    $('#pfHead').innerHTML = `
      <div class="pf-id">
        ${Sky.avatar(me.name, 'lg', me.emoji)}
        <div class="pf-who">
          <div class="pf-name-row">
            <h1 id="pfName">${esc(me.name || me.email || '')}</h1>
            ${Sky.db.isCloud() ? `<button type="button" class="pf-icon" id="pfEditBtn" aria-label="${esc(t('pfEdit'))}" title="${esc(t('pfEdit'))}">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg></button>` : ''}
          </div>
          <div class="pf-meta">
            <span class="tag ${role === 'teacher' ? 'teach' : role === 'parent' ? 'life' : ''}">${esc(Sky.t(role))}</span>
            ${me.email ? `<span class="pf-mail">${esc(me.email)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="pf-plan">
        <div><span class="pf-lbl">${esc(t('pfPlan'))}</span>
          <b class="pf-plan-name plan-${esc(plan.id)}">${esc(planName())}</b>${until ? `<span class="pf-until">${esc(until)}</span>` : ''}</div>
        <div class="pf-plan-acts">
          <button type="button" class="btn small" id="pfPlanBtn">${esc(t('pfPlanChange'))}</button>
          <button type="button" class="btn ghost small" id="pfOut">${esc(t('pfSignOut'))}</button>
        </div>
      </div>`;
    $('#pfPlanBtn').addEventListener('click', () => SkyCheck.openTariffs(plan.id === 'free' ? 'paid' : plan.id));
    $('#pfOut').addEventListener('click', async () => {
      await Sky.db.signOut();
      location.href = 'index.html';
    });
    const edit = $('#pfEditBtn');
    if (edit) edit.addEventListener('click', editName);
  }

  function editName() {
    const row = $('.pf-name-row');
    row.innerHTML = `<form class="pf-name-form"><input id="pfNameIn" type="text" maxlength="80" value="${esc(me.name || '')}" autocomplete="name" aria-label="${esc(t('pfEdit'))}">
      <button type="submit" class="btn small">${esc(t('pfSave'))}</button><button type="button" class="btn ghost small" data-x>${esc(t('pfCancel'))}</button></form>`;
    const input = $('#pfNameIn');
    input.focus();
    input.select();
    row.querySelector('[data-x]').addEventListener('click', renderHead);
    row.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) { Sky.toast(t('pfNeedName')); input.focus(); return; }
      const saved = await Sky.db.update('profiles', me.id, { name });
      if (!saved) return;
      me.name = name;
      if (window.SkyErrors) SkyErrors.success(t('pfSaved')); else Sky.toast(t('pfSaved'));
      renderHead();
      if (Sky.auth && Sky.auth.renderSlot) Sky.auth.renderSlot();
    });
  }

  /* ---------- статистика ---------- */
  async function loadStats() {
    const box = $('#pfStats');
    if (!Sky.db.isCloud()) { box.innerHTML = ''; return; }
    box.innerHTML = [0, 1, 2, 3].map(() => '<div class="stat pf-skel"><b>&nbsp;</b><span>&nbsp;</span></div>').join('');
    let s;
    try { s = await Sky.db.rpc('my_stats'); }
    catch (e) {
      box.innerHTML = `<div class="pf-err">${esc(t('pfStatsErr'))}</div>`;
      if (window.SkyErrors) SkyErrors.show(e, { retry: loadStats, context: 'stats' });
      return;
    }
    s = s || {};
    const teacher = me.role === 'teacher';
    const avg = s.avg_grade != null ? num(Number(s.avg_grade).toFixed(1)) : '—';
    const cards = [
      { v: s.checks_total || 0, l: t('pfChecks'), sub: teacher && s.pending ? t('pfPending').replace('%1', s.pending) : '', cls: 'accent', key: 'checks' },
      teacher ? { v: s.students || 0, l: t('pfStudents'), key: 'students' } : null,
      { v: avg, l: t(teacher ? 'pfAvgClass' : 'pfAvg'), sub: s.graded ? t('pfOf').replace('%1', s.graded) : t('pfNoMarks'), cls: s.avg_grade >= 4 ? 'ok' : '', key: 'avg' },
      { v: ago(s.last_check_at), l: t('pfLast'), cls: 'pf-text', key: 'last',
        title: s.last_check_at ? new Date(s.last_check_at).toLocaleString(locale()) : '' }
    ].filter(Boolean);
    box.innerHTML = cards.map(c => `
      <div class="stat ${c.cls || ''}" data-stat="${c.key}"${c.title ? ` title="${esc(c.title)}"` : ''}>
        <b>${esc(c.v)}</b><span>${esc(c.l)}</span>${c.sub ? `<small>${esc(c.sub)}</small>` : ''}
      </div>`).join('');
  }

  /* ---------- быстрые ссылки ---------- */
  function renderQuick(isAdmin) {
    const role = me.role || 'student';
    const Q = role === 'teacher'
      ? [['collections.html', '🗂️', 'pfQColl', 'pfQCollD'], ['photo.html', '📷', 'pfQPhoto', 'pfQPhotoD'],
         ['fast-check.html', '⚡', 'pfQFast', 'pfQFastD'], ['analytics.html', '📊', 'pfQAnalytics', 'pfQAnalyticsD']]
      : role === 'parent'
        ? [['parent.html', '👪', 'pfQParent', 'pfQParentD'], ['trainer.html', '🎯', 'pfQTrainer', 'pfQTrainerD']]
        : [['homework.html', '📚', 'pfQHomework', 'pfQHomeworkD'], ['photo.html', '📷', 'pfQPhoto', 'pfQPhotoD'], ['trainer.html', '🎯', 'pfQTrainer', 'pfQTrainerD']];
    $('#pfQuick').innerHTML = Q.map(([href, ico, k, d]) => `
      <a class="pf-q" href="${href}"><span class="ico" aria-hidden="true">${ico}</span><span><b>${esc(t(k))}</b><small>${esc(t(d))}</small></span></a>`).join('') +
      (isAdmin ? `<a class="pf-q admin" href="admin.html"><span class="ico" aria-hidden="true">🛡️</span><span><b>${esc(t('pfAdmin'))}</b><small>admin.html</small></span></a>` : '');
    const tour = $('#pfTour');
    tour.hidden = !(role === 'teacher' && !me.onboarding_done);
  }

  /* ---------- разделы других модулей ---------- */
  function section(id, html, o) {
    o = o || {};
    let el = document.querySelector(`[data-section="${id}"]`);
    if (!html) { if (el) el.remove(); return null; }
    if (!el) {
      el = document.createElement('section');
      el.className = 'panel pf-sec';
      el.dataset.section = id;
      el.id = id;
      const host = $('#pfSections');
      const after = o.first ? host.firstChild : null;
      host.insertBefore(el, after);
    }
    el.innerHTML = html;
    return el;
  }

  /* ---------- запуск ---------- */
  async function boot() {
    await Sky.db.ready;
    me = Sky.db.me();
    if (!me) { location.replace('auth.html?next=profile.html'); return; }
    $('#pfLocal').hidden = Sky.db.isCloud();
    $('#pfMain').hidden = false;
    try { await loadPlan(); } catch (e) { /* тариф не прочитался — покажем бесплатный */ }
    renderHead();
    renderQuick(false);
    loadStats();
    if (Sky.db.isCloud()) {
      Sky.db.rpc('is_admin').then(a => { if (a === true) renderQuick(true); }).catch(() => {});
    }
    readyResolve({ me, section, ago });
    if (location.hash) {
      const target = document.querySelector(location.hash);
      if (target) setTimeout(() => target.scrollIntoView({ block: 'start' }), 300);
    }
  }

  document.addEventListener('langchange', () => {
    if (!me) return;
    renderHead();
    renderQuick(!!document.querySelector('.pf-q.admin'));
    loadStats();
  });
  /* Вышли в другой вкладке — здесь делать нечего. */
  document.addEventListener('authchange', () => {
    if (me && Sky.db.me() === null) location.replace('auth.html?next=profile.html');
  });

  window.SkyProfile = { ready, get me() { return me; }, section, ago, reloadStats: loadStats };
  boot();
})();
