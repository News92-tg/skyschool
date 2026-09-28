/* ============================================================
   SkyySchool — админ-панель (admin.html)

   Вкладки:
     Обзор         — пользователи, тарифы, проверки и токены за
                     сегодня, очередь оплат, столбики за 14 дней
     Пользователи  — поиск, тариф, расход; «Выдать тариф»
     Оплаты        — заявки: подтвердить (тариф выдаётся) или отклонить
     Проверки      — последние проверки фото и текста
     Тарифы        — цены и лимиты из plan_limits

   Всё через функции admin_* (sql/schema-admin.sql): они сами
   проверяют, что вошедший — администратор. Ключей здесь нет.
   ============================================================ */
'use strict';

(function () {
  Sky.init({
    aTheme:{ru:'Тема',en:'Theme'},
    aOut:{ru:'Выйти',en:'Sign out'},
    aOutOther:{ru:'Выйти и войти другим аккаунтом',en:'Sign out and use another account'},
    aLoading:{ru:'Загружаю…',en:'Loading…'},
    aH1:{ru:'Админ-панель',en:'Admin panel'},
    aNoCloud:{ru:'Supabase не подключён: заполните SUPABASE_URL и SUPABASE_ANON_KEY в assets/config.js.',
              en:'Supabase is not connected: fill in SUPABASE_URL and SUPABASE_ANON_KEY in assets/config.js.'},
    aLoginH:{ru:'Вход в админ-панель',en:'Admin sign-in'},
    aLoginLead:{ru:'Войдите аккаунтом администратора. Другой аккаунт увидит только «нет доступа».',
                en:'Sign in with the administrator account. Any other account only sees “no access”.'},
    aGoogle:{ru:'Войти через Google',en:'Sign in with Google'},
    aOr:{ru:'или почтой',en:'or with email'},
    aMail:{ru:'Почта',en:'Email'},
    aPass:{ru:'Пароль',en:'Password'},
    aLogin:{ru:'Войти',en:'Sign in'},
    aNeedMail:{ru:'Введите почту и пароль',en:'Enter your email and password'},
    aDeniedH:{ru:'Нет доступа',en:'No access'},
    aDenied:{ru:'Этот аккаунт не администратор:',en:'This account is not an administrator:'},
    aForbidden:{ru:'Нет прав администратора',en:'Administrator rights required'},
    aRefresh:{ru:'Обновить',en:'Refresh'},
    aUpdated:{ru:'обновлено в %1',en:'updated at %1'},
    aDone:{ru:'Готово',en:'Done'},
    aCancel:{ru:'Отмена',en:'Cancel'},
    aNone:{ru:'Пусто',en:'Nothing here'},

    tOverview:{ru:'Обзор',en:'Overview'},
    tUsers:{ru:'Пользователи',en:'Users'},
    tPayments:{ru:'Оплаты',en:'Payments'},
    tChecks:{ru:'Проверки',en:'Checks'},
    tPlans:{ru:'Тарифы',en:'Plans'},

    ovUsers:{ru:'пользователей',en:'users'},
    ovUsers7:{ru:'+%1 за 7 дней',en:'+%1 in 7 days'},
    ovPaidPlans:{ru:'платных тарифов',en:'paid plans'},
    ovChecksToday:{ru:'проверок сегодня',en:'checks today'},
    ovChecksSplit:{ru:'фото %1 · текст %2',en:'photo %1 · text %2'},
    ovTokensToday:{ru:'токенов сегодня',en:'tokens today'},
    ovPayments:{ru:'заявок на оплату',en:'payment requests'},
    ovPaymentsGo:{ru:'открыть очередь →',en:'open the queue →'},
    ovSubmissions:{ru:'работ по ссылкам ждут',en:'linked works waiting'},
    ovChartH:{ru:'Проверки за 14 дней',en:'Checks over 14 days'},
    ovPhoto:{ru:'фото',en:'photo'},
    ovText:{ru:'текст',en:'text'},
    ovCached:{ru:'из кэша',en:'cached'},
    ovTokens:{ru:'токены',en:'tokens'},
    ovDay:{ru:'день',en:'day'},
    ovTable:{ru:'Таблицей',en:'As a table'},

    uSearch:{ru:'Поиск по почте или имени',en:'Search by email or name'},
    uUser:{ru:'Пользователь',en:'User'},
    uRole:{ru:'Роль',en:'Role'},
    uPlan:{ru:'Тариф',en:'Plan'},
    uChecks:{ru:'Проверки 7 дн / всего',en:'Checks 7d / total'},
    uTokens:{ru:'Токены 7 дн',en:'Tokens 7d'},
    uLast:{ru:'Последняя проверка',en:'Last check'},
    uSince:{ru:'Регистрация / вход',en:'Joined / last sign-in'},
    uAdmin:{ru:'админ',en:'admin'},
    uUntil:{ru:'до %1',en:'until %1'},
    uForever:{ru:'бессрочно',en:'no end date'},
    uExpired:{ru:'истёк %1',en:'expired %1'},
    uPlag:{ru:'списывание',en:'cheating check'},
    uGrant:{ru:'Выдать тариф',en:'Grant a plan'},
    gH:{ru:'Выдать тариф',en:'Grant a plan'},
    gPlan:{ru:'Тариф',en:'Plan'},
    gDays:{ru:'Срок',en:'Period'},
    gDaysN:{ru:'%1 дней',en:'%1 days'},
    gForever:{ru:'Бессрочно',en:'No end date'},
    gPlag:{ru:'Проверка на списывание',en:'Cheating check'},
    gKeep:{ru:'Не менять',en:'Keep as is'},
    gOn:{ru:'Включить',en:'Turn on'},
    gOff:{ru:'Выключить',en:'Turn off'},
    gGo:{ru:'Выдать',en:'Grant'},
    gFreeNote:{ru:'Бесплатный тариф — без срока.',en:'The free plan has no end date.'},

    pPending:{ru:'Ждут',en:'Pending'},
    pPaid:{ru:'Оплачены',en:'Paid'},
    pRejected:{ru:'Отклонены',en:'Rejected'},
    pAll:{ru:'Все',en:'All'},
    pDays:{ru:'Срок тарифа, дней',en:'Plan period, days'},
    pNote:{ru:'Оплата на сайте пока не подключена: заявка появляется, когда ученик нажимает «Купить». Получили деньги — «Подтвердить»: тариф выдаётся на указанный срок (действующий такой же — продлевается), проверка на списывание включается.',
           en:'Online payment is not connected yet: a request appears when a student presses “Buy”. Once you have the money, press “Approve”: the plan is granted for the given period (an active one is extended), the cheating check is turned on.'},
    pDate:{ru:'Дата',en:'Date'},
    pWho:{ru:'Кто',en:'Who'},
    pWhat:{ru:'Что',en:'What'},
    pSum:{ru:'Сумма',en:'Amount'},
    pStatus:{ru:'Статус',en:'Status'},
    pApprove:{ru:'Подтвердить',en:'Approve'},
    pReject:{ru:'Отклонить',en:'Reject'},
    pApproveQ:{ru:'Подтвердить оплату %1 ₽ от %2? Тариф выдастся на %3 дней.',en:'Approve %1 ₽ from %2? The plan will be granted for %3 days.'},
    pRejectQ:{ru:'Отклонить заявку от %1?',en:'Reject the request from %1?'},
    pBadDays:{ru:'Срок — от 1 до 3660 дней',en:'Period must be 1 to 3660 days'},
    st_pending:{ru:'ждёт',en:'pending'},
    st_paid:{ru:'оплачена',en:'paid'},
    st_rejected:{ru:'отклонена',en:'rejected'},
    pu_paid_tariff:{ru:'Тариф «Платный»',en:'Paid plan'},
    pu_premium_tariff:{ru:'Тариф «Премиум»',en:'Premium plan'},
    pu_plagiarism:{ru:'Проверка на списывание',en:'Cheating check'},

    cAll:{ru:'Все',en:'All'},
    cPhoto:{ru:'Фото',en:'Photo'},
    cText:{ru:'Текст',en:'Text'},
    cWhen:{ru:'Когда',en:'When'},
    cWho:{ru:'Кто',en:'Who'},
    cKind:{ru:'Вид',en:'Kind'},
    cSubject:{ru:'Предмет',en:'Subject'},
    cGrade:{ru:'Оценка',en:'Mark'},
    cTokens:{ru:'Токены',en:'Tokens'},
    cComment:{ru:'Комментарий',en:'Comment'},
    cCached:{ru:'кэш',en:'cache'},
    cShort:{ru:'коротко',en:'short'},
    cLong:{ru:'подробно',en:'detailed'},
    cAnon:{ru:'без входа',en:'not signed in'},

    plNote:{ru:'Лимиты и цены действуют сразу: Worker берёт их из базы при каждой проверке, сумму заявки на оплату — тоже. Цены в окне «Тарифы» на странице «Домашка по фото» записаны в assets/photo-api.js — поменяли цену здесь, поменяйте и там.',
            en:'Limits and prices apply at once: the Worker reads them from the database on every check, and so does the payment request amount. Prices in the “Plans” window on the photo homework page live in assets/photo-api.js — change them there too.'},
    plTitle:{ru:'Название',en:'Title'},
    plPrice:{ru:'Цена, ₽',en:'Price, ₽'},
    plPhoto:{ru:'Проверка по фото',en:'Photo check'},
    plText:{ru:'Проверка текста',en:'Text check'},
    plReq:{ru:'Запросов за окно',en:'Requests per window'},
    plWin:{ru:'Окно, секунд',en:'Window, seconds'},
    plWinHint:{ru:'= %1',en:'= %1'},
    plPhotos:{ru:'Фото за раз',en:'Photos at once'},
    plFeat:{ru:'Возможности',en:'Features'},
    plCompare:{ru:'Сверка с решением ИИ',en:'Comparison with the AI solution'},
    plTeacher:{ru:'Режим учителя',en:'Teacher mode'},
    plPlag:{ru:'Проверка на списывание',en:'Cheating check'},
    plSave:{ru:'Сохранить',en:'Save'},
    plNoChange:{ru:'Ничего не поменялось',en:'Nothing changed'},
    plBad:{ru:'Цена — от 0, лимиты — от 1',en:'Price must be 0 or more, limits 1 or more'},
    minShort:{ru:'%1 мин',en:'%1 min'},
    secShort:{ru:'%1 с',en:'%1 s'},

    sj_physics:{ru:'Физика',en:'Physics'}, sj_algebra:{ru:'Алгебра',en:'Algebra'}, sj_geometry:{ru:'Геометрия',en:'Geometry'},
    sj_russian:{ru:'Русский',en:'Russian'}, sj_chemistry:{ru:'Химия',en:'Chemistry'}, sj_biology:{ru:'Биология',en:'Biology'},
    sj_history:{ru:'История',en:'History'}, sj_english:{ru:'Английский',en:'English'}, sj_literature:{ru:'Литература',en:'Literature'},
    sj_other:{ru:'Другое',en:'Other'}
  });

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } })();
  const loc = () => Sky.lang === 'en' ? 'en-GB' : 'ru-RU';
  const num = n => Number(n || 0).toLocaleString(loc());
  const when = v => v ? new Date(v).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const day = v => v ? new Date(v).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const tOr = (key, fallback) => { const v = Sky.t(key); return v && v !== key ? v : fallback; };

  const S = {
    tab: 'overview', plans: [], overview: null, users: [], payments: [], checks: [],
    payStatus: 'pending', checkMode: '', search: '', loaded: {}
  };

  /* ---------- состояния страницы ---------- */
  const GATES = ['gateLoading', 'gateNoCloud', 'gateLogin', 'gateDenied', 'admApp'];
  function show(id) { GATES.forEach(g => $('#' + g).classList.toggle('hidden', g !== id)); }

  function renderBrand() {
    $('#admBrand').innerHTML = Sky.logoSvg('logo') + '<span>Skyy<b>School</b></span><span class="adm-badge">admin</span>';
  }
  function renderLang() {
    $('#admLang').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === Sky.lang)));
  }

  /* Почта из JWT: профиль в profiles почту не хранит. */
  function emailOf(token) {
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(escape(atob(part)))).email || '';
    } catch (e) { return ''; }
  }

  async function rpc(fn, args) {
    try {
      return await Sky.db.rpc(fn, args);
    } catch (e) {
      Sky.toast(e && e.code === '42501' ? Sky.t('aForbidden') : (e && e.message) || String(e), 6000);
      throw e;
    }
  }

  /* ---------- вход ---------- */
  let bootRun = 0;
  async function boot() {
    const run = ++bootRun;
    const mode = await Sky.db.ready;
    if (run !== bootRun) return;
    if (mode !== 'cloud') { show('gateNoCloud'); return; }
    const token = await Sky.db.token();
    if (run !== bootRun) return;
    $('#admOut').classList.toggle('hidden', !token);
    if (!token) { $('#admWho').textContent = ''; show('gateLogin'); return; }
    const mail = emailOf(token);
    $('#admWho').textContent = mail;
    let admin = false;
    try { admin = await Sky.db.rpc('is_admin'); } catch (e) { admin = false; }
    if (run !== bootRun) return;
    if (!admin) { $('#deniedMail').textContent = mail; show('gateDenied'); return; }
    show('admApp');
    S.loaded = {};
    await Promise.all([loadPlans(), loadOverview()]);
    await openTab(S.tab);
  }

  async function signInMail() {
    const mail = $('#loginMail').value.trim();
    const pass = $('#loginPass').value;
    if (!mail || !pass) { Sky.toast(Sky.t('aNeedMail')); return; }
    const btn = $('#loginGo');
    btn.disabled = true;
    const res = await Sky.db.signIn(mail, pass);
    btn.disabled = false;
    if (res && res.error) Sky.toast(res.error, 6000);
    /* при успехе придёт authchange — boot сам покажет панель */
  }

  /* ---------- вкладки ---------- */
  async function openTab(tab) {
    S.tab = tab;
    Sky.set('admTab', tab);
    $('#admTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    document.querySelectorAll('.adm-tab').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + tab));
    if (!S.loaded[tab]) await load(tab);
  }

  async function load(tab) {
    try {
      if (tab === 'overview') await loadOverview();
      if (tab === 'users') await loadUsers();
      if (tab === 'payments') await loadPayments();
      if (tab === 'checks') await loadChecks();
      if (tab === 'plans') { await loadPlans(); renderPlans(); }
      S.loaded[tab] = true;
      $('#admUpdated').textContent = Sky.t('aUpdated').replace('%1', new Date().toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' }));
    } catch (e) { /* тост уже показан */ }
  }

  async function refresh() {
    S.loaded = {};
    await Promise.all([loadPlans(), S.tab === 'overview' ? null : loadOverview().catch(() => {})]);
    await load(S.tab);
  }

  /* ---------- названия ---------- */
  const planTitle = id => {
    const p = S.plans.find(x => x.plan === id);
    const std = { free: { ru: 'Бесплатный', en: 'Free' }, paid: { ru: 'Платный', en: 'Paid' }, premium: { ru: 'Премиум', en: 'Premium' } }[id];
    return std ? Sky.L(std) : (p && p.title) || id;
  };
  const planTag = id => id === 'premium' || id === 'pro' || id === 'family' ? 'teach' : id === 'free' ? 'gray' : 'ok';
  const subj = k => k ? tOr('sj_' + k, k) : '—';

  /* ---------- обзор ---------- */
  async function loadOverview() {
    S.overview = await rpc('admin_overview', { p_tz: tz });
    renderOverview();
  }

  function renderOverview() {
    const o = S.overview;
    if (!o) return;
    const plans = o.plans || {};
    const paid = Object.keys(plans).filter(k => k !== 'free');
    const paidTotal = paid.reduce((s, k) => s + (plans[k] | 0), 0);
    const ct = o.checks_today || {};
    const photoToday = Object.keys(ct).filter(k => k !== 'text').reduce((s, k) => s + (ct[k] | 0), 0);
    const textToday = ct.text | 0;
    const stat = (cls, big, label, small) =>
      `<div class="stat ${cls}"><b>${big}</b><span>${esc(label)}</span>${small ? `<small>${small}</small>` : ''}</div>`;
    $('#ovStats').innerHTML =
      stat('accent', num(o.users_total), Sky.t('ovUsers'), esc(Sky.t('ovUsers7').replace('%1', num(o.users_7d)))) +
      stat('ok', num(paidTotal), Sky.t('ovPaidPlans'), paid.map(k => esc(planTitle(k)) + ' ' + num(plans[k])).join(' · ')) +
      stat('', num(photoToday + textToday), Sky.t('ovChecksToday'), esc(Sky.t('ovChecksSplit').replace('%1', num(photoToday)).replace('%2', num(textToday)))) +
      stat('', num(o.tokens_today), Sky.t('ovTokensToday'), '') +
      `<button type="button" class="stat link ${o.payments_pending ? 'warn' : ''}" id="ovPay"><b>${num(o.payments_pending)}</b><span>${esc(Sky.t('ovPayments'))}</span><small>${esc(Sky.t('ovPaymentsGo'))}</small></button>` +
      stat('', num(o.submissions_pending), Sky.t('ovSubmissions'), '');
    $('#ovPay').addEventListener('click', () => { S.payStatus = 'pending'; renderPayStatus(); S.loaded.payments = false; openTab('payments'); });

    const cnt = $('#payCnt');
    cnt.textContent = o.payments_pending || '';
    cnt.classList.toggle('hidden', !o.payments_pending);

    /* 14 дней до сегодня включительно — дни без проверок тоже показываем */
    const byDay = {};
    (o.daily || []).forEach(d => { byDay[String(d.day).slice(0, 10)] = d; });
    const keyOf = t => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(t);
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const k = keyOf(new Date(Date.now() - i * 86400000));
      days.push(Object.assign({ day: k, photo: 0, text: 0, cached: 0, tokens: 0 }, byDay[k] || {}));
    }
    const max = Math.max(1, ...days.map(d => (d.photo | 0) + (d.text | 0)));
    const label = k => k.slice(8, 10) + '.' + k.slice(5, 7);
    $('#ovChart').innerHTML =
      `<div class="chart" role="img" aria-label="${esc(Sky.t('ovChartH'))}">${days.map(d => {
        const total = (d.photo | 0) + (d.text | 0);
        const tip = `${label(d.day)}: ${Sky.t('ovPhoto')} ${d.photo}, ${Sky.t('ovText')} ${d.text}, ${Sky.t('ovTokens')} ${num(d.tokens)}`;
        return `<div class="col" title="${esc(tip)}">${total ? `<span class="n">${total}</span>` : ''}` +
          `<div class="bar tx" style="height:${(d.text | 0) / max * 88}%"></div>` +
          `<div class="bar ph" style="height:${(d.photo | 0) / max * 88}%"></div></div>`;
      }).join('')}</div>` +
      `<div class="chart-days">${days.map(d => `<span>${d.day.slice(8, 10)}<i>.${d.day.slice(5, 7)}</i></span>`).join('')}</div>` +
      `<div class="legend"><span><i style="background:var(--accent)"></i>${esc(Sky.t('ovPhoto'))}</span><span><i style="background:var(--ok)"></i>${esc(Sky.t('ovText'))}</span></div>` +
      `<details class="adm-more"><summary>${esc(Sky.t('ovTable'))}</summary><div class="table-wrap"><table class="atable">
        <thead><tr><th>${esc(Sky.t('ovDay'))}</th><th class="num">${esc(Sky.t('ovPhoto'))}</th><th class="num">${esc(Sky.t('ovText'))}</th>
          <th class="num">${esc(Sky.t('ovCached'))}</th><th class="num">${esc(Sky.t('ovTokens'))}</th></tr></thead>
        <tbody>${days.slice().reverse().map(d => `<tr><td>${esc(label(d.day))}</td><td class="num">${d.photo}</td><td class="num">${d.text}</td>
          <td class="num">${d.cached}</td><td class="num">${num(d.tokens)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  /* ---------- пользователи ---------- */
  async function loadUsers() {
    S.users = (await rpc('admin_users', { p_search: S.search || null, p_limit: 200 })) || [];
    renderUsers();
  }

  function planCell(u) {
    let s = `<span class="tag ${planTag(u.plan_active ? u.plan : 'free')}">${esc(planTitle(u.plan_active ? u.plan : 'free'))}</span>`;
    if (u.plan !== 'free') {
      s += `<span class="sub">${esc(!u.expires_at ? Sky.t('uForever')
        : (u.plan_active ? Sky.t('uUntil') : Sky.t('uExpired') + ' · ' + planTitle(u.plan)).replace('%1', day(u.expires_at)))}</span>`;
    }
    if (u.plagiarism) s += `<span class="sub">+ ${esc(Sky.t('uPlag'))}</span>`;
    return s;
  }

  function renderUsers() {
    const rows = S.users;
    $('#usersBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable users"><thead><tr>
        <th>${esc(Sky.t('uUser'))}</th><th>${esc(Sky.t('uRole'))}</th><th>${esc(Sky.t('uPlan'))}</th>
        <th class="num">${esc(Sky.t('uChecks'))}</th><th class="num">${esc(Sky.t('uTokens'))}</th>
        <th>${esc(Sky.t('uLast'))}</th><th>${esc(Sky.t('uSince'))}</th><th></th></tr></thead><tbody>${rows.map(u => `
        <tr>
          <td><b>${esc(u.email || '—')}</b>${u.admin ? ` <span class="tag warn">${esc(Sky.t('uAdmin'))}</span>` : ''}<span class="sub">${esc(u.name || '')}</span></td>
          <td>${esc(u.role ? tOr(u.role, u.role) : '—')}</td>
          <td>${planCell(u)}</td>
          <td class="num">${num(u.checks_7d)} / ${num(u.checks_total)}</td>
          <td class="num">${num(u.tokens_7d)}</td>
          <td class="nowrap">${esc(when(u.last_check_at))}</td>
          <td class="nowrap">${esc(day(u.created_at))}<span class="sub">${esc(when(u.last_sign_in_at))}</span></td>
          <td><button type="button" class="btn small" data-grant="${esc(u.id)}">${esc(Sky.t('uGrant'))}</button></td>
        </tr>`).join('')}</tbody></table>`;
  }

  function grant(id) {
    const u = S.users.find(x => x.id === id);
    if (!u) return;
    const plans = S.plans.length ? S.plans : [{ plan: 'free' }, { plan: 'paid' }, { plan: 'premium' }];
    const cur = u.plan_active ? u.plan : 'free';
    Sky.modal(`
      <div class="adm-modal">
        <h2>${esc(Sky.t('gH'))}</h2>
        <p>${esc(u.email || u.id)}</p>
        <div class="field"><label for="gPlan">${esc(Sky.t('gPlan'))}</label>
          <select id="gPlan">${plans.map(p => `<option value="${esc(p.plan)}"${p.plan === (cur === 'free' ? 'premium' : cur) ? ' selected' : ''}>${esc(planTitle(p.plan))}${p.price_rub != null ? ' — ' + esc(p.price_rub) + ' ₽' : ''}</option>`).join('')}</select></div>
        <div class="field" id="gDaysF"><label for="gDays">${esc(Sky.t('gDays'))}</label>
          <select id="gDays">${[7, 30, 90, 180, 365].map(d => `<option value="${d}"${d === 30 ? ' selected' : ''}>${esc(Sky.t('gDaysN').replace('%1', d))}</option>`).join('')}
            <option value="">${esc(Sky.t('gForever'))}</option></select></div>
        <p class="hidden" id="gFree">${esc(Sky.t('gFreeNote'))}</p>
        <div class="field"><label for="gPlag">${esc(Sky.t('gPlag'))}</label>
          <select id="gPlag"><option value="">${esc(Sky.t('gKeep'))}</option><option value="true">${esc(Sky.t('gOn'))}</option><option value="false">${esc(Sky.t('gOff'))}</option></select></div>
        <div class="acts"><button type="button" class="btn ghost" data-x>${esc(Sky.t('aCancel'))}</button><button type="button" class="btn" data-go>${esc(Sky.t('gGo'))}</button></div>
      </div>`, (box, close) => {
      const sync = () => {
        const free = box.querySelector('#gPlan').value === 'free';
        box.querySelector('#gDaysF').classList.toggle('hidden', free);
        box.querySelector('#gFree').classList.toggle('hidden', !free);
      };
      box.querySelector('#gPlan').addEventListener('change', sync);
      sync();
      box.querySelector('[data-x]').addEventListener('click', close);
      box.querySelector('[data-go]').addEventListener('click', async e => {
        const plag = box.querySelector('#gPlag').value;
        const days = box.querySelector('#gDays').value;
        e.currentTarget.disabled = true;
        try {
          await rpc('admin_set_plan', {
            p_user: u.id, p_plan: box.querySelector('#gPlan').value,
            p_days: days ? Number(days) : null, p_plagiarism: plag === '' ? null : plag === 'true'
          });
        } catch (err) { e.currentTarget.disabled = false; return; }
        close();
        Sky.toast(Sky.t('aDone'));
        await Promise.all([loadUsers(), loadOverview()]).catch(() => {});
      });
    });
  }

  /* ---------- оплаты ---------- */
  async function loadPayments() {
    S.payments = (await rpc('admin_payments', { p_status: S.payStatus || null, p_limit: 200 })) || [];
    renderPayments();
  }

  function renderPayStatus() {
    $('#payStatus').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === S.payStatus)));
  }

  function renderPayments() {
    const rows = S.payments;
    const stTag = s => `<span class="tag ${s === 'paid' ? 'ok' : s === 'rejected' ? 'no' : 'warn'}">${esc(tOr('st_' + s, s))}</span>`;
    $('#paysBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable pays"><thead><tr><th>${esc(Sky.t('pDate'))}</th><th>${esc(Sky.t('pWho'))}</th><th>${esc(Sky.t('pWhat'))}</th>
        <th class="num">${esc(Sky.t('pSum'))}</th><th>${esc(Sky.t('pStatus'))}</th><th></th></tr></thead><tbody>${rows.map(p => `
        <tr>
          <td class="nowrap">${esc(when(p.created_at))}</td>
          <td>${esc(p.email || p.user_id || '—')}</td>
          <td>${esc(tOr('pu_' + p.purpose, p.plan ? planTitle(p.plan) : p.purpose || '—'))}</td>
          <td class="num"><b>${num(p.amount)} ₽</b></td>
          <td>${stTag(p.status)}</td>
          <td>${p.status === 'pending' ? `<div class="acts">
            <button type="button" class="btn small ok" data-approve="${esc(p.id)}">${esc(Sky.t('pApprove'))}</button>
            <button type="button" class="btn small ghost" data-reject="${esc(p.id)}">${esc(Sky.t('pReject'))}</button></div>` : ''}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  /* Вопрос «да / нет». Закрыли фоном или Esc — это «нет». */
  function confirmBox(text, okLabel) {
    return new Promise(resolve => {
      Sky.modal(`<div class="adm-modal"><p style="color:var(--ink);font-size:14.5px;word-break:normal">${esc(text)}</p>
        <div class="acts"><button type="button" class="btn ghost" data-x>${esc(Sky.t('aCancel'))}</button>
        <button type="button" class="btn" data-ok>${esc(okLabel)}</button></div></div>`, (box, close) => {
        const bg = box.parentNode;
        let done = false;
        const obs = new MutationObserver(() => {
          if (!bg.isConnected && !done) { done = true; obs.disconnect(); resolve(false); }
        });
        obs.observe(document.body, { childList: true });
        const finish = v => { if (done) return; done = true; obs.disconnect(); close(); resolve(v); };
        box.querySelector('[data-x]').addEventListener('click', () => finish(false));
        box.querySelector('[data-ok]').addEventListener('click', () => finish(true));
      });
    });
  }

  async function decide(id, approve) {
    const p = S.payments.find(x => x.id === id);
    if (!p) return;
    const days = Number($('#payDays').value);
    if (approve && !(days >= 1 && days <= 3660)) { Sky.toast(Sky.t('pBadDays')); $('#payDays').focus(); return; }
    const who = p.email || p.user_id || '—';
    const ok = await confirmBox(approve
      ? Sky.t('pApproveQ').replace('%1', num(p.amount)).replace('%2', who).replace('%3', days)
      : Sky.t('pRejectQ').replace('%1', who), Sky.t(approve ? 'pApprove' : 'pReject'));
    if (!ok) return;
    try { await rpc('admin_payment_decide', { p_id: id, p_approve: approve, p_days: days || 30 }); }
    catch (e) { return; }
    Sky.toast(Sky.t('aDone'));
    S.loaded.users = false;
    await Promise.all([loadPayments(), loadOverview()]).catch(() => {});
  }

  /* ---------- проверки ---------- */
  async function loadChecks() {
    S.checks = (await rpc('admin_checks', { p_mode: S.checkMode || null, p_limit: 200 })) || [];
    renderChecks();
  }

  function renderChecks() {
    const rows = S.checks;
    $('#checksBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable checks"><thead><tr><th>${esc(Sky.t('cWhen'))}</th><th>${esc(Sky.t('cWho'))}</th><th>${esc(Sky.t('cKind'))}</th>
        <th>${esc(Sky.t('cSubject'))}</th><th>${esc(Sky.t('cGrade'))}</th><th class="num">${esc(Sky.t('cTokens'))}</th><th>${esc(Sky.t('cComment'))}</th></tr></thead><tbody>${rows.map(c => {
        const cmt = String(c.comment || '');
        return `<tr>
          <td class="nowrap">${esc(when(c.created_at))}</td>
          <td>${c.email ? esc(c.email) : `<span class="sub">${esc(Sky.t('cAnon'))}</span>`}${c.ip ? `<span class="sub mono">${esc(c.ip)}</span>` : ''}</td>
          <td class="nowrap"><span class="tag ${c.mode === 'text' ? 'ok' : 'gray'}">${esc(Sky.t(c.mode === 'text' ? 'cText' : 'cPhoto'))}</span>
            ${c.cached ? `<span class="tag warn">${esc(Sky.t('cCached'))}</span>` : ''}
            ${c.length ? `<span class="sub">${esc(Sky.t(c.length === 'short' ? 'cShort' : 'cLong'))}</span>` : ''}</td>
          <td>${esc(subj(c.subject))}</td>
          <td>${c.grade ? `<span class="gr g${c.grade}">${c.grade}</span>` : '—'}</td>
          <td class="num">${num(c.tokens_used)}</td>
          <td class="cmt" title="${esc(cmt)}">${esc(cmt.length > 140 ? cmt.slice(0, 140) + '…' : cmt || '—')}</td>
        </tr>`;
      }).join('')}</tbody></table>`;
  }

  /* ---------- тарифы ---------- */
  async function loadPlans() {
    const rows = await Sky.db.list('plan_limits');
    S.plans = (rows || []).slice().sort((a, b) => (a.price_rub | 0) - (b.price_rub | 0));
  }

  const NUM_FIELDS = ['price_rub', 'requests_per_window', 'window_seconds', 'photos_per_request', 'text_requests_per_window', 'text_window_seconds'];
  const FEATS = [['feature_compare', 'plCompare'], ['feature_teacher', 'plTeacher'], ['feature_plagiarism', 'plPlag']];
  const winText = s => s >= 60 && s % 60 === 0 ? Sky.t('minShort').replace('%1', s / 60) : Sky.t('secShort').replace('%1', s);

  function renderPlans() {
    const f = (p, key, label, min) => `<div class="field"><label for="pl-${esc(p.plan)}-${key}">${esc(Sky.t(label))}</label>
      <input type="number" id="pl-${esc(p.plan)}-${key}" data-f="${key}" min="${min}" value="${esc(p[key] == null ? '' : p[key])}" inputmode="numeric">
      ${/window_seconds$/.test(key) ? `<span class="help" data-win>${esc(p[key] ? Sky.t('plWinHint').replace('%1', winText(p[key])) : '')}</span>` : ''}</div>`;
    $('#plansBox').innerHTML = S.plans.map(p => `
      <form class="panel plan-card" data-plan="${esc(p.plan)}">
        <h3><span class="tag ${planTag(p.plan)}">${esc(planTitle(p.plan))}</span> <code>${esc(p.plan)}</code></h3>
        <div class="pair">
          <div class="field"><label for="pl-${esc(p.plan)}-title">${esc(Sky.t('plTitle'))}</label><input type="text" id="pl-${esc(p.plan)}-title" data-f="title" maxlength="40" value="${esc(p.title || '')}"></div>
          ${f(p, 'price_rub', 'plPrice', 0)}
        </div>
        <div class="grp">${esc(Sky.t('plPhoto'))}</div>
        <div class="pair">${f(p, 'requests_per_window', 'plReq', 1)}${f(p, 'window_seconds', 'plWin', 1)}</div>
        <div class="pair">${f(p, 'photos_per_request', 'plPhotos', 1)}</div>
        <div class="grp">${esc(Sky.t('plText'))}</div>
        <div class="pair">${f(p, 'text_requests_per_window', 'plReq', 1)}${f(p, 'text_window_seconds', 'plWin', 1)}</div>
        <div class="grp">${esc(Sky.t('plFeat'))}</div>
        <div class="feat">${FEATS.map(([k, l]) => `<label><input type="checkbox" data-f="${k}"${p[k] ? ' checked' : ''}>${esc(Sky.t(l))}</label>`).join('')}</div>
        <button type="submit" class="btn">${esc(Sky.t('plSave'))}</button>
      </form>`).join('') || `<div class="empty">${esc(Sky.t('aNone'))}</div>`;
  }

  async function savePlan(form) {
    const plan = S.plans.find(p => p.plan === form.dataset.plan);
    if (!plan) return;
    const patch = {};
    form.querySelectorAll('[data-f]').forEach(inp => {
      const k = inp.dataset.f;
      if (inp.type === 'checkbox') { if (!!plan[k] !== inp.checked) patch[k] = inp.checked; return; }
      if (NUM_FIELDS.includes(k)) {
        if (inp.value === '') return;
        const v = Number(inp.value);
        if (v !== plan[k]) patch[k] = v;
        return;
      }
      const v = inp.value.trim();
      if (v && v !== plan[k]) patch[k] = v;
    });
    if (!Object.keys(patch).length) { Sky.toast(Sky.t('plNoChange')); return; }
    const bad = NUM_FIELDS.some(k => k in patch && (!Number.isInteger(patch[k]) || patch[k] < (k === 'price_rub' ? 0 : 1)));
    if (bad) { Sky.toast(Sky.t('plBad')); return; }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    let saved;
    try { saved = await rpc('admin_update_limits', { p_plan: plan.plan, p_patch: patch }); }
    catch (e) { btn.disabled = false; return; }
    Object.assign(plan, saved || patch);
    renderPlans();
    Sky.toast(Sky.t('aDone'));
  }

  /* ---------- события ---------- */
  $('#admTabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (b) openTab(b.dataset.tab);
  });
  $('#admRefresh').addEventListener('click', refresh);
  $('#loginGoogle').addEventListener('click', async () => {
    const res = await Sky.db.signInGoogle();
    if (res && res.error) Sky.toast(res.error, 6000);
  });
  $('#loginGo').addEventListener('click', signInMail);
  $('#loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') signInMail(); });
  $('#admOut').addEventListener('click', () => Sky.db.signOut());
  $('#deniedOut').addEventListener('click', () => Sky.db.signOut());
  $('#admTheme').addEventListener('click', () => Sky.toggleTheme());
  $('#admLang').addEventListener('click', e => {
    const b = e.target.closest('button[data-lang]');
    if (b) Sky.setLang(b.dataset.lang);
  });

  let searchTimer = null;
  $('#userSearch').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { S.search = e.target.value.trim(); loadUsers().catch(() => {}); }, 300);
  });
  $('#usersBox').addEventListener('click', e => {
    const b = e.target.closest('[data-grant]');
    if (b) grant(b.dataset.grant);
  });
  $('#payStatus').addEventListener('click', e => {
    const b = e.target.closest('button[data-status]');
    if (!b) return;
    S.payStatus = b.dataset.status;
    renderPayStatus();
    loadPayments().catch(() => {});
  });
  $('#paysBox').addEventListener('click', e => {
    const a = e.target.closest('[data-approve]');
    const r = e.target.closest('[data-reject]');
    if (a) decide(a.dataset.approve, true);
    if (r) decide(r.dataset.reject, false);
  });
  $('#checkMode').addEventListener('click', e => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    S.checkMode = b.dataset.mode;
    $('#checkMode').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mode === S.checkMode)));
    loadChecks().catch(() => {});
  });
  $('#plansBox').addEventListener('submit', e => { e.preventDefault(); savePlan(e.target); });
  $('#plansBox').addEventListener('input', e => {
    const inp = e.target;
    if (!/window_seconds$/.test(inp.dataset.f || '')) return;
    const hint = inp.parentNode.querySelector('[data-win]');
    const v = Number(inp.value);
    if (hint) hint.textContent = v > 0 ? Sky.t('plWinHint').replace('%1', winText(v)) : '';
  });

  document.addEventListener('authchange', boot);
  document.addEventListener('langchange', () => {
    renderLang();
    if (S.overview) renderOverview();
    if (S.loaded.users) renderUsers();
    if (S.loaded.payments) renderPayments();
    if (S.loaded.checks) renderChecks();
    if (S.loaded.plans) renderPlans();
  });

  /* ---------- запуск ---------- */
  renderBrand();
  renderLang();
  const savedTab = Sky.get('admTab', 'overview');
  S.tab = ['overview', 'users', 'payments', 'checks', 'plans'].includes(savedTab) ? savedTab : 'overview';
  boot();
})();
