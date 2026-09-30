/* ============================================================
   SkyySchool — страница входа (auth.html)

   Экраны:
     in      — вход: почта + пароль, «Забыли пароль?», Google
     up      — регистрация: имя, почта, пароль, роль
     forgot  — восстановление: почта → письмо со ссылкой
     sent    — «письмо отправлено»
     reset   — новый пароль (пришли по ссылке из письма)
     confirm — «подтвердите почту» после регистрации
     signed  — уже вошли: продолжить или выйти

   Куда после входа: ?next=страница.html (только страницы этого
   сайта — ссылкой нельзя увести на чужой адрес), иначе profile.html.
   Учитель после регистрации — сразу в онбординг.

   Аккаунты — Sky.db (Supabase Auth). Окно входа в шапке других
   страниц (assets/auth.js) остаётся: там вход нужен «не уходя».
   ============================================================ */
'use strict';

(function () {

  Sky.init({
    auTitleIn:{ru:'С возвращением',en:'Welcome back'},
    auSubIn:{ru:'Войдите, чтобы продолжить с того же места.',en:'Sign in to pick up where you left off.'},
    auTitleUp:{ru:'Создать аккаунт',en:'Create an account'},
    auSubUp:{ru:'Бесплатно. Займёт меньше минуты.',en:'Free. Takes less than a minute.'},
    auTitleForgot:{ru:'Восстановить пароль',en:'Reset your password'},
    auSubForgot:{ru:'Пришлём ссылку для нового пароля.',en:'We will email you a link to set a new password.'},
    auTitleSent:{ru:'Проверьте почту',en:'Check your email'},
    auSubSent:{ru:'Письмо со ссылкой отправили на %1. Если его нет — загляните в «Спам».',en:'We sent a link to %1. If you do not see it, check your spam folder.'},
    auTitleReset:{ru:'Новый пароль',en:'New password'},
    auSubReset:{ru:'Придумайте пароль — и вы снова в аккаунте.',en:'Choose a new password and you are back in.'},
    auTitleConfirm:{ru:'Подтвердите почту',en:'Confirm your email'},
    auSubConfirm:{ru:'Отправили письмо на %1. Откройте ссылку из него — и можно входить.',en:'We sent an email to %1. Open the link in it, then sign in.'},
    auTitleSigned:{ru:'Вы уже вошли',en:'You are signed in'},
    auSubSigned:{ru:'Как %1.',en:'As %1.'},
    auTabIn:{ru:'Вход',en:'Sign in'},
    auTabUp:{ru:'Регистрация',en:'Sign up'},
    auName:{ru:'Как вас зовут',en:'Your name'},
    auNamePh:{ru:'Анна Петрова',en:'Anna Smith'},
    auEmail:{ru:'Почта',en:'Email'},
    auPass:{ru:'Пароль',en:'Password'},
    auPassNew:{ru:'Новый пароль',en:'New password'},
    auPass2:{ru:'Ещё раз',en:'Repeat it'},
    auPassHint:{ru:'Не меньше 6 символов',en:'At least 6 characters'},
    auShow:{ru:'Показать пароль',en:'Show password'},
    auHide:{ru:'Скрыть пароль',en:'Hide password'},
    auForgot:{ru:'Забыли пароль?',en:'Forgot password?'},
    auRole:{ru:'Я',en:'I am'},
    auRoleStudent:{ru:'Ученик',en:'Student'},
    auRoleStudentD:{ru:'решаю и сдаю',en:'solve and submit'},
    auRoleTeacher:{ru:'Учитель',en:'Teacher'},
    auRoleTeacherD:{ru:'проверяю и даю',en:'check and assign'},
    auRoleParent:{ru:'Родитель',en:'Parent'},
    auRoleParentD:{ru:'слежу за успехами',en:'follow progress'},
    auDoIn:{ru:'Войти',en:'Sign in'},
    auDoUp:{ru:'Создать аккаунт',en:'Create account'},
    auDoForgot:{ru:'Отправить ссылку',en:'Send the link'},
    auDoReset:{ru:'Сохранить пароль',en:'Save password'},
    auContinue:{ru:'Продолжить',en:'Continue'},
    auSignOut:{ru:'Выйти',en:'Sign out'},
    auBack:{ru:'← Ко входу',en:'← Back to sign in'},
    auResend:{ru:'Отправить ещё раз',en:'Send again'},
    auOr:{ru:'или',en:'or'},
    auGoogle:{ru:'Войти через Google',en:'Continue with Google'},
    auTerms:{ru:'Нажимая «Создать аккаунт», вы соглашаетесь хранить данные учеников бережно.',en:'By creating an account you agree to handle student data with care.'},
    auLocal:{ru:'Облако не подключено: аккаунт живёт только на этом устройстве, пароль не нужен.',en:'Cloud is not connected: the account lives on this device only, no password needed.'},
    auNeedName:{ru:'Напишите имя',en:'Enter your name'},
    auNeedEmail:{ru:'Напишите почту',en:'Enter your email'},
    auBadEmail:{ru:'Похоже, в почте опечатка',en:'That email looks mistyped'},
    auNeedPass:{ru:'Пароль — не меньше 6 символов',en:'Password must be at least 6 characters'},
    auPassDiff:{ru:'Пароли не совпадают',en:'Passwords do not match'},
    auErrCreds:{ru:'Неверная почта или пароль',en:'Wrong email or password'},
    auErrExists:{ru:'Эта почта уже зарегистрирована — войдите',en:'This email is already registered — sign in'},
    auErrConfirm:{ru:'Почта не подтверждена: откройте ссылку из письма',en:'Email not confirmed: open the link from the email'},
    auErrWait:{ru:'Подождите %1 с и попробуйте снова',en:'Wait %1 s and try again'},
    auErrMailLimit:{ru:'Слишком много писем подряд. Попробуйте через час.',en:'Too many emails. Try again in an hour.'},
    auErrWeak:{ru:'Пароль слишком простой — добавьте букв и цифр',en:'The password is too weak — add letters and digits'},
    auErrSame:{ru:'Новый пароль совпадает со старым',en:'The new password matches the old one'},
    auErrLink:{ru:'Ссылка устарела. Запросите новую.',en:'The link has expired. Request a new one.'},
    auPassSaved:{ru:'Пароль сохранён',en:'Password saved'},
    auWelcome:{ru:'Добро пожаловать, %1!',en:'Welcome, %1!'},
    auPerk1:{ru:'Проверка тетрадей по фото за минуту',en:'Homework checked from a photo in a minute'},
    auPerk2:{ru:'Подборки заданий по ссылке — без регистрации учеников',en:'Task sets by link — students need no account'},
    auPerk3:{ru:'Аналитика класса и уведомления в Telegram',en:'Class analytics and Telegram alerts'},
    auAsideH:{ru:'Всё для урока в одном месте',en:'Everything for your lesson in one place'}
  });

  const $ = s => document.querySelector(s);
  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  const qs = new URLSearchParams(location.search);
  /* Только своя страница: «photo.html», «collection.html?c=AB12».
     Никаких «https://…» и «//чужой.сайт» — иначе открытый редирект. */
  const safeNext = v => (v && /^[a-z0-9][a-z0-9-]*\.html(?:[?#][^\s]*)?$/i.test(v) && v !== 'auth.html' && !v.startsWith('auth.html')) ? v : '';
  const next = safeNext(qs.get('next'));
  /* Вернулись от Google: Supabase уберёт токен из адреса, поэтому
     запоминаем это сразу при загрузке. */
  const oauthReturn = /access_token=|error_description=|[?&]code=/.test(location.hash + location.search);
  const home = () => next || 'profile.html';

  let view = { in: 'in', signup: 'up', up: 'up', forgot: 'forgot', reset: 'reset' }[qs.get('mode')] || 'in';
  let role = ['student', 'teacher', 'parent'].includes(qs.get('role')) ? qs.get('role') : 'student';
  let email = '';
  let busy = false;
  const cloud = () => Sky.db.isCloud();

  /* ---------- ошибки Supabase Auth по-человечески ---------- */
  function authError(msg, status) {
    const m = String(msg || '');
    const wait = m.match(/after (\d+) seconds?/i);
    if (wait) return t('auErrWait').replace('%1', wait[1]);
    if (/invalid login credentials|invalid.*(email|password)/i.test(m)) return t('auErrCreds');
    if (/already (registered|exists)|user already/i.test(m)) return t('auErrExists');
    if (/email not confirmed/i.test(m)) return t('auErrConfirm');
    if (/rate limit/i.test(m)) return t('auErrMailLimit');
    if (/should be different|same.*password/i.test(m)) return t('auErrSame');
    if (/weak|pwned|at least|characters/i.test(m)) return /at least/i.test(m) ? t('auNeedPass') : t('auErrWeak');
    if (/expired|invalid.*(token|link)|otp/i.test(m)) return t('auErrLink');
    if (window.SkyErrors) return SkyErrors.message({ status, message: m });
    return m;
  }

  /* ---------- разметка ---------- */
  const eye = open => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${open
    ? '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M3 3l18 18M10.6 5.1A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3 3.9M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'}</svg>`;

  const field = (id, label, type, o) => `
    <div class="field au-field">
      <label for="${id}">${esc(label)}</label>
      <div class="au-input">
        <input id="${id}" type="${type}" ${o.ac ? `autocomplete="${o.ac}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}
          ${o.value ? `value="${esc(o.value)}"` : ''} ${type === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''} ${o.req ? 'required' : ''}>
        ${type === 'password' ? `<button type="button" class="au-eye" data-eye="${id}" aria-label="${esc(t('auShow'))}">${eye(true)}</button>` : ''}
      </div>
      ${o.help ? `<span class="help">${esc(o.help)}</span>` : ''}
    </div>`;

  const ROLES = [
    ['student', 'auRoleStudent', 'auRoleStudentD', '🎒'],
    ['teacher', 'auRoleTeacher', 'auRoleTeacherD', '🧑‍🏫'],
    ['parent',  'auRoleParent',  'auRoleParentD',  '👪']
  ];

  function formHtml() {
    const pass = cloud();
    switch (view) {
      case 'in': return `
        <form class="au-form" novalidate data-form="in">
          ${field('aEmail', t('auEmail'), 'email', { ac: 'email', value: email, req: 1 })}
          ${pass ? field('aPass', t('auPass'), 'password', { ac: 'current-password', req: 1 }) : ''}
          ${pass ? `<button type="button" class="au-link au-forgot" data-go="forgot">${esc(t('auForgot'))}</button>` : ''}
          <p class="au-err" role="alert" hidden></p>
          <button type="submit" class="btn big full">${esc(t('auDoIn'))}</button>
        </form>`;
      case 'up': return `
        <form class="au-form" novalidate data-form="up">
          <fieldset class="au-roles">
            <legend>${esc(t('auRole'))}</legend>
            ${ROLES.map(([id, k, d, ico]) => `
              <label class="au-role">
                <input type="radio" name="aRole" value="${id}" ${id === role ? 'checked' : ''}>
                <span class="au-role-card"><span class="ico" aria-hidden="true">${ico}</span><b>${esc(t(k))}</b><small>${esc(t(d))}</small></span>
              </label>`).join('')}
          </fieldset>
          ${field('aName', t('auName'), 'text', { ac: 'name', ph: t('auNamePh'), req: 1 })}
          ${field('aEmail', t('auEmail'), 'email', { ac: 'email', value: email, req: 1 })}
          ${pass ? field('aPass', t('auPass'), 'password', { ac: 'new-password', help: t('auPassHint'), req: 1 }) : ''}
          <p class="au-err" role="alert" hidden></p>
          <button type="submit" class="btn big full">${esc(t('auDoUp'))}</button>
          <p class="au-fine">${esc(t('auTerms'))}</p>
        </form>`;
      case 'forgot': return `
        <form class="au-form" novalidate data-form="forgot">
          ${field('aEmail', t('auEmail'), 'email', { ac: 'email', value: email, req: 1 })}
          <p class="au-err" role="alert" hidden></p>
          <button type="submit" class="btn big full">${esc(t('auDoForgot'))}</button>
          <button type="button" class="au-link" data-go="in">${esc(t('auBack'))}</button>
        </form>`;
      case 'sent': case 'confirm': return `
        <div class="au-form au-done">
          <div class="au-mail" aria-hidden="true">✉️</div>
          <button type="button" class="btn ghost full" data-go="${view === 'sent' ? 'forgot' : 'in'}">${esc(t(view === 'sent' ? 'auResend' : 'auDoIn'))}</button>
          ${view === 'sent' ? `<button type="button" class="au-link" data-go="in">${esc(t('auBack'))}</button>` : ''}
        </div>`;
      case 'reset': return `
        <form class="au-form" novalidate data-form="reset">
          ${field('aPass', t('auPassNew'), 'password', { ac: 'new-password', help: t('auPassHint'), req: 1 })}
          ${field('aPass2', t('auPass2'), 'password', { ac: 'new-password', req: 1 })}
          <p class="au-err" role="alert" hidden></p>
          <button type="submit" class="btn big full">${esc(t('auDoReset'))}</button>
        </form>`;
      case 'signed': {
        const me = Sky.db.me() || {};
        return `
        <div class="au-form au-done">
          <div class="au-me">${Sky.avatar(me.name, 'lg', me.emoji)}<div><b>${esc(me.name || '')}</b><span>${esc(me.email || '')}</span></div></div>
          <a class="btn big full" href="${esc(home())}">${esc(t('auContinue'))}</a>
          <button type="button" class="btn ghost full" data-act="out">${esc(t('auSignOut'))}</button>
        </div>`;
      }
    }
    return '';
  }

  const TITLES = {
    in: ['auTitleIn', 'auSubIn'], up: ['auTitleUp', 'auSubUp'], forgot: ['auTitleForgot', 'auSubForgot'],
    sent: ['auTitleSent', 'auSubSent'], reset: ['auTitleReset', 'auSubReset'], confirm: ['auTitleConfirm', 'auSubConfirm'],
    signed: ['auTitleSigned', 'auSubSigned']
  };

  let googleOn = false;
  function render(focus) {
    const [h, sub] = TITLES[view];
    const me = Sky.db.me() || {};
    $('#auTitle').textContent = t(h);
    $('#auSub').textContent = t(sub).replace('%1', view === 'signed' ? (me.email || me.name || '') : email);
    const tabs = view === 'in' || view === 'up';
    $('#auTabs').hidden = !tabs;
    $('#auTabs').querySelectorAll('[data-go]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.go === view)));
    $('#auBody').innerHTML = formHtml();
    const g = tabs && cloud() && googleOn;
    $('#auAlt').hidden = !g;
    $('#auLocal').hidden = cloud();
    wire();
    if (focus !== false) {
      const first = $('#auBody input:not([type=radio])');
      if (first && !first.value) first.focus({ preventScroll: true });
      else if ($('#aPass')) $('#aPass').focus({ preventScroll: true });
    }
  }

  function go(v) {
    const em = $('#aEmail');
    if (em) email = em.value.trim();
    view = v;
    render();
  }

  function setErr(msg, fieldId) {
    const p = $('#auBody .au-err');
    document.querySelectorAll('#auBody [aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
    if (!p) return;
    p.hidden = !msg;
    p.textContent = msg || '';
    if (fieldId && $('#' + fieldId)) { $('#' + fieldId).setAttribute('aria-invalid', 'true'); $('#' + fieldId).focus(); }
  }

  function setBusy(on) {
    busy = on;
    const b = $('#auBody [type=submit]');
    if (!b) return;
    b.disabled = on;
    if (on) { b.dataset.label = b.textContent; b.innerHTML = '<span class="spin"></span>'; }
    else if (b.dataset.label) b.textContent = b.dataset.label;
  }

  const val = id => ($('#' + id) || {}).value || '';
  const mailOk = s => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);

  function done(name) {
    Sky.toast(t('auWelcome').replace('%1', name || ''), 2500);
    location.replace(home());
  }

  async function submit(kind) {
    if (busy) return;
    setErr('');
    const em = val('aEmail').trim();
    const pw = val('aPass');
    if (kind !== 'reset') {
      if (!em) return setErr(t('auNeedEmail'), 'aEmail');
      if (!mailOk(em)) return setErr(t('auBadEmail'), 'aEmail');
      email = em;
    }

    if (kind === 'in') {
      if (cloud() && !pw) return setErr(t('auNeedPass'), 'aPass');
      setBusy(true);
      const res = await Sky.db.signIn(em, pw);
      setBusy(false);
      if (res.error) return setErr(authError(res.error), cloud() ? 'aPass' : 'aEmail');
      const me = Sky.db.me() || {};
      return done(me.name || em);
    }

    if (kind === 'up') {
      const name = val('aName').trim();
      role = (document.querySelector('input[name=aRole]:checked') || {}).value || 'student';
      if (!name) return setErr(t('auNeedName'), 'aName');
      if (cloud() && pw.length < 6) return setErr(t('auNeedPass'), 'aPass');
      setBusy(true);
      const res = await Sky.db.signUp(em, pw, { name, role, emoji: null });
      setBusy(false);
      if (res.error) return setErr(authError(res.error), 'aEmail');
      if (res.needsConfirm) { view = 'confirm'; return render(false); }
      Sky.toast(t('auWelcome').replace('%1', name), 2500);
      /* Учителю — сразу короткое знакомство (onboarding.html), если он
         не шёл на конкретную страницу. */
      location.replace(role === 'teacher' && !next ? 'onboarding.html' : home());
      return;
    }

    if (kind === 'forgot') {
      setBusy(true);
      const back = new URL('auth.html?mode=reset' + (next ? '&next=' + encodeURIComponent(next) : ''), location.href).href;
      const res = await Sky.db.resetPassword(em, back);
      setBusy(false);
      if (res.error) return setErr(authError(res.error, res.status), 'aEmail');
      view = 'sent';
      return render(false);
    }

    if (kind === 'reset') {
      if (pw.length < 6) return setErr(t('auNeedPass'), 'aPass');
      if (pw !== val('aPass2')) return setErr(t('auPassDiff'), 'aPass2');
      setBusy(true);
      const res = await Sky.db.updatePassword(pw);
      setBusy(false);
      if (res.error) return setErr(authError(res.error, res.status), 'aPass');
      if (window.SkyErrors) SkyErrors.success(t('auPassSaved'));
      setTimeout(() => location.replace(home()), 600);
    }
  }

  function wire() {
    const form = $('#auBody form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); submit(form.dataset.form); });
    document.querySelectorAll('#auBody [data-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    document.querySelectorAll('#auBody [data-eye]').forEach(b => b.addEventListener('click', () => {
      const i = $('#' + b.dataset.eye);
      const show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      b.innerHTML = eye(!show);
      b.setAttribute('aria-label', t(show ? 'auHide' : 'auShow'));
    }));
    document.querySelectorAll('#auBody input[name=aRole]').forEach(r => r.addEventListener('change', () => { role = r.value; }));
    const out = $('#auBody [data-act=out]');
    if (out) out.addEventListener('click', async () => { await Sky.db.signOut(); view = 'in'; render(); });
  }

  /* ---------- запуск ---------- */
  $('#auTabs').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });
  $('#auGoogle').addEventListener('click', async () => {
    const back = new URL('auth.html' + (next ? '?next=' + encodeURIComponent(next) : ''), location.href).href;
    const res = await Sky.db.signInGoogle(back);
    if (res && res.error) setErr(authError(res.error));
  });

  render();
  Sky.db.ready.then(async () => {
    if (Sky.db.isRecovery()) view = 'reset';
    else if (Sky.db.me() && oauthReturn) return location.replace(home());
    else if (Sky.db.me() && view !== 'reset') view = 'signed';
    render(view === 'in' || view === 'up');
    const p = await Sky.db.authProviders();
    googleOn = !!p.google;
    if (view === 'in' || view === 'up') $('#auAlt').hidden = !(cloud() && googleOn);
  });
  document.addEventListener('passwordrecovery', () => { view = 'reset'; render(); });
  /* Вход через Google вернул сюда уже с сессией — дальше, куда шли. */
  document.addEventListener('authchange', () => {
    if (Sky.db.me() && oauthReturn && view !== 'reset' && !Sky.db.isRecovery()) location.replace(home());
  });
  document.addEventListener('langchange', () => render(false));
})();
