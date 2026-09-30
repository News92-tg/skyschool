/* ============================================================
   SkyySchool — подборка заданий для ученика (collection.html?code=…)

   1. Подборку по коду отдаёт функция get_collection_by_code — задания
      без правильных ответов.
   2. Ученик пишет имя (или входит), решает и жмёт «Отправить».
   3. submit_collection проверяет на сервере всё, где есть правильный
      ответ, и возвращает «Верно: 7 из 10». Оценку ставит учитель.
   Без кода — поле «Код подборки».
   ============================================================ */
'use strict';

(function () {
  Sky.init({
    h1Code:{ru:'Подборка заданий',en:'Task collection'},
    leadCode:{ru:'Впишите код, который дал учитель, — откроются задания.',en:'Enter the code your teacher gave you to open the tasks.'},
    needCloud:{ru:'Подборки работают только с облаком: в assets/config.js не заполнен Supabase.',en:'Collections need the cloud: Supabase is not set in assets/config.js.'},
    notFound:{ru:'Подборка с таким кодом не найдена. Проверьте код у учителя.',en:'No collection with this code. Check the code with your teacher.'},
    expired:{ru:'Срок этой подборки закончился — ссылка больше не работает.',en:'This collection has expired — the link no longer works.'},
    loginRequired:{ru:'Учитель открыл эту подборку только для учеников с аккаунтом. Войдите, чтобы решать.',en:'Your teacher opened this collection for signed-in students only. Sign in to solve it.'},
    loadFail:{ru:'Не удалось загрузить подборку. Проверьте интернет и обновите страницу.',en:'Could not load the collection. Check your connection and reload.'},
    signIn:{ru:'Войти',en:'Sign in'},
    otherCode:{ru:'Другой код',en:'Another code'},
    fromTeacher:{ru:'Учитель: %1',en:'Teacher: %1'},
    tasksN:{ru:'Заданий: %1',en:'Tasks: %1'},
    until:{ru:'Сдать до %1',en:'Due %1'},
    nameL:{ru:'Ваше имя и фамилия',en:'Your first and last name'},
    namePh:{ru:'Например: Петя Иванов',en:'For example: Peter Smith'},
    nameAs:{ru:'Ответы уйдут от имени: %1',en:'Answers will be sent as: %1'},
    answerPh:{ru:'Ваш ответ',en:'Your answer'},
    progress:{ru:'Отвечено: %1 из %2',en:'Answered: %1 of %2'},
    send:{ru:'Отправить',en:'Send'},
    sending:{ru:'Отправляю…',en:'Sending…'},
    needName:{ru:'Впишите имя — учитель увидит, чьи это ответы',en:'Enter your name so the teacher knows whose answers these are'},
    notAll:{ru:'Ответ есть не на все задания (%1 из %2). Отправить так?',en:'Not every task is answered (%1 of %2). Send anyway?'},
    sent:{ru:'Ответы отправлены учителю',en:'Your answers were sent to the teacher'},
    right:{ru:'Верно: %1 из %2',en:'Correct: %1 of %2'},
    openLeft:{ru:'Ещё заданий на проверке у учителя: %1',en:'Tasks the teacher will check: %1'},
    allOpen:{ru:'Все задания проверит учитель.',en:'The teacher will check all tasks.'},
    noMark:{ru:'Оценку поставит учитель.',en:'Your teacher will give the mark.'},
    again:{ru:'Решить ещё раз',en:'Solve again'},
    errTooFast:{ru:'Ответы уже отправлены — подождите немного перед повторной отправкой.',en:'Answers were just sent — wait a bit before sending again.'},
    errFull:{ru:'В эту подборку больше нельзя отправлять ответы.',en:'This collection no longer accepts answers.'},
    errSend:{ru:'Не удалось отправить. Ответы сохранены на странице — попробуйте ещё раз.',en:'Could not send. Your answers are still on the page — try again.'}
  });

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const C = window.SkyCollections;
  const code = C.normCode(new URLSearchParams(location.search).get('code'));
  const DRAFT = 'clDraft_' + code;
  let coll = null, busy = false;

  /* Черновик ответов — в браузере: случайно закрыл вкладку — не всё потеряно. */
  const draft = () => { try { return JSON.parse(sessionStorage.getItem(DRAFT)) || {}; } catch (e) { return {}; } };
  const saveDraft = d => { try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) {} };

  function view(html) { $('#view').innerHTML = html; Sky.applyI18n($('#view')); }

  /* ---------- без кода: поле для кода ---------- */
  function askCode(msg) {
    view(`<div class="panel"><div class="empty" style="padding:30px 10px">
      <div class="big">🗂️</div>
      <b data-i18n="h1Code"></b>
      <p>${msg ? esc(msg) : esc(Sky.t('leadCode'))}</p>
      <form class="cl-code-form" id="codeForm" style="margin-top:16px">
        <input type="text" id="codeIn" maxlength="6" autocomplete="off" spellcheck="false" placeholder="A3K7MN" aria-label="code" value="${esc(code)}">
        <button type="submit" class="btn" data-i18n="openCode"></button>
      </form></div></div>`);
    C.bindCodeForm($('#codeForm'), $('#codeIn'));
    $('#codeIn').focus();
  }

  /* ---------- загрузка ---------- */
  async function load() {
    const mode = await Sky.db.ready;
    if (!code) { askCode(); return; }
    if (mode !== 'cloud') { askCode(Sky.t('needCloud')); return; }
    if (!C.isCode(code)) { askCode(Sky.t('notFound')); return; }
    let res;
    try { res = await Sky.db.rpc('get_collection_by_code', { p_code: code }); }
    catch (e) { askCode(Sky.t('loadFail')); return; }
    if (!res || res.error) {
      if (res && res.error === 'login_required') {
        view(`<div class="panel"><div class="empty"><div class="big">🔐</div><b data-i18n="h1Code"></b>
          <p>${esc(Sky.t('loginRequired'))}</p>
          <div class="actions" style="justify-content:center;margin-top:14px"><button class="btn" id="gIn" data-i18n="signIn"></button></div></div></div>`);
        $('#gIn').addEventListener('click', () => Sky.auth.openAuth());
        return;
      }
      askCode(Sky.t(res && res.error === 'expired' ? 'expired' : 'notFound'));
      return;
    }
    coll = res;
    render();
  }

  /* ---------- задания ---------- */
  function render() {
    const me = Sky.db.me();
    const d = draft();
    const tasks = Array.isArray(coll.tasks) ? coll.tasks : [];
    document.title = coll.title + ' — SkyySchool';
    view(`<div class="section" style="margin-top:0">
      <div class="cn-head">
        <h1 style="margin:0">${esc(coll.title)}</h1>
        <div class="cn-meta">
          ${coll.teacher ? `<span>${esc(Sky.t('fromTeacher').replace('%1', coll.teacher))}</span>` : ''}
          <span>${esc(Sky.t('tasksN').replace('%1', tasks.length))}</span>
          ${coll.expires_at ? `<span>${esc(Sky.t('until').replace('%1', new Date(coll.expires_at).toLocaleString(Sky.lang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })))}</span>` : ''}
        </div>
        ${coll.description ? `<div class="cn-desc">${esc(coll.description)}</div>` : ''}
      </div>
    </div>
    <div class="panel pad-sm" style="margin-top:16px">
      ${me ? `<div style="font-size:13.5px;font-weight:700">${esc(Sky.t('nameAs').replace('%1', me.name || me.email || ''))}</div>`
           : `<div class="field"><label for="stName" data-i18n="nameL"></label><input type="text" id="stName" maxlength="100" autocomplete="name" value="${esc(d.__name || '')}" data-i18n-ph="namePh"></div>`}
    </div>
    <form id="solveForm" class="list" style="margin-top:16px" novalidate>
      ${tasks.map((t, i) => `<div class="cn-task" data-task="${esc(t.id)}">
        <div class="cn-q"><b>${i + 1}.</b><span>${esc(t.text)}</span></div>
        ${t.type === 'choice' && Array.isArray(t.options) && t.options.length
          ? `<div class="cn-opts" role="radiogroup">${t.options.map((o, k) => `<label class="cn-opt">
              <input type="radio" name="a_${esc(t.id)}" value="${k}"${String(d[t.id]) === String(k) ? ' checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>`
          : `<textarea name="a_${esc(t.id)}" maxlength="2000" data-i18n-ph="answerPh">${esc(d[t.id] || '')}</textarea>`}
      </div>`).join('')}
      <div class="cn-bottom">
        <div class="cn-progress" id="prog" aria-live="polite"></div>
        <button type="submit" class="btn full big" id="sendBtn" data-i18n="send"></button>
      </div>
    </form>`);
    $('#solveForm').addEventListener('input', onInput);
    $('#solveForm').addEventListener('change', onInput);
    $('#solveForm').addEventListener('submit', submit);
    const nameIn = $('#stName');
    if (nameIn) nameIn.addEventListener('input', () => { const dd = draft(); dd.__name = nameIn.value; saveDraft(dd); });
    progress();
  }

  function answers() {
    const form = $('#solveForm');
    return coll.tasks.map(t => {
      if (t.type === 'choice') {
        const c = form.querySelector(`input[name="a_${CSS.escape(t.id)}"]:checked`);
        return { task_id: t.id, answer: c ? c.value : '' };
      }
      const ta = form.querySelector(`textarea[name="a_${CSS.escape(t.id)}"]`);
      return { task_id: t.id, answer: ta ? ta.value.trim() : '' };
    });
  }

  function onInput() {
    const d = draft();
    answers().forEach(a => { d[a.task_id] = a.answer; });
    saveDraft(d);
    progress();
  }

  function progress() {
    const a = answers();
    const done = a.filter(x => x.answer !== '').length;
    $('#prog').textContent = Sky.t('progress').replace('%1', done).replace('%2', a.length);
    document.querySelectorAll('.cn-task').forEach(el => {
      const x = a.find(y => y.task_id === el.dataset.task);
      el.classList.toggle('answered', !!(x && x.answer !== ''));
    });
  }

  /* ---------- отправка ---------- */
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const me = Sky.db.me();
    const nameIn = $('#stName');
    const name = nameIn ? nameIn.value.trim() : '';
    if (!me && !name) { Sky.toast(Sky.t('needName'), 4000); nameIn.focus(); return; }
    const a = answers();
    const done = a.filter(x => x.answer !== '').length;
    if (done < a.length && !confirm(Sky.t('notAll').replace('%1', done).replace('%2', a.length))) return;

    busy = true;
    const btn = $('#sendBtn');
    btn.disabled = true;
    btn.innerHTML = `<span class="spin"></span> ${esc(Sky.t('sending'))}`;
    let res = null;
    try { res = await Sky.db.rpc('submit_collection', { p_code: code, p_student_name: name || null, p_answers: a }); }
    catch (err) { res = null; }
    busy = false;
    btn.disabled = false;
    btn.textContent = Sky.t('send');

    if (!res || res.error) {
      const e2 = res && res.error;
      const msg = e2 === 'too_fast' ? 'errTooFast' : e2 === 'full' ? 'errFull' : e2 === 'expired' ? 'expired'
        : e2 === 'login_required' ? 'loginRequired' : e2 === 'name_required' ? 'needName' : e2 === 'not_found' ? 'notFound' : 'errSend';
      Sky.toast(Sky.t(msg), 6000);
      return;
    }
    try { sessionStorage.removeItem(DRAFT); } catch (err) {}
    notifyTeacher(res.id);
    done_(res);
  }

  /* Учителю — сообщение в Telegram, если он его привязал. Отправляем
     «в фоне» (sendBeacon): ученику ждать нечего и ошибка ему не
     интересна. Worker сам проверит, что работа настоящая и свежая, и
     не отправит о ней дважды. Прежний Worker такого адреса не знает —
     ничего не случится. */
  function notifyTeacher(id) {
    const base = String(Sky.cfg.AI_BASE_ORDERS || Sky.cfg.AI_BASE || '').trim().replace(/\/+$/, '');
    if (!id || !/^https?:\/\//.test(base) || !navigator.sendBeacon) return;
    try { navigator.sendBeacon(base + '/api/notify-submission', JSON.stringify({ kind: 'collection', id })); } catch (e) {}
  }

  function done_(r) {
    view(`<div class="panel"><div class="cn-done">
      <div class="big">✅</div>
      <h2 style="margin:0" data-i18n="sent"></h2>
      ${r.auto > 0 ? `<div class="score">${esc(Sky.t('right').replace('%1', r.correct).replace('%2', r.auto))}</div>` : `<p style="margin:0">${esc(Sky.t('allOpen'))}</p>`}
      ${r.open > 0 && r.auto > 0 ? `<p style="margin:0;color:var(--muted);font-weight:700">${esc(Sky.t('openLeft').replace('%1', r.open))}</p>` : ''}
      <p style="margin:0;color:var(--muted)">${esc(Sky.t('noMark'))}</p>
      <div class="actions" style="justify-content:center;margin-top:8px">
        <button type="button" class="btn ghost" id="againBtn" data-i18n="again"></button>
        <a class="btn ghost" href="collection.html" data-i18n="otherCode"></a>
      </div>
    </div></div>`);
    $('#againBtn').addEventListener('click', render);
  }

  /* db.js сам шлёт authchange после старта — отдельный вызов load() не нужен,
     а одновременные склеиваются. */
  let loading = null;
  const reload = () => loading || (loading = load().finally(() => { loading = null; }));
  document.addEventListener('authchange', () => { if (coll && $('#solveForm')) render(); else if (!coll) reload(); });
  document.addEventListener('langchange', () => { if (coll && $('#solveForm')) { onInput(); render(); } });
  reload();
})();
