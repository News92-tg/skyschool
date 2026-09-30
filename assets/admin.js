/* ============================================================
   SkyySchool — админ-панель (admin.html)

   Вкладки:
     Обзор         — пользователи, тарифы, проверки и токены за
                     сегодня, очередь оплат, столбики за 14 дней
     Пользователи  — поиск по почте, фильтры (тариф, дата регистрации),
                     выбор строк и «Выдать тариф» сразу многим; клик по
                     почте — карточка: тариф, срок, «Выдать / Продлить /
                     Снять тариф», Telegram, история оплат и журнал
     Оплаты        — заявки: фильтры (статус, даты, почта), CSV,
                     подтвердить (тариф выдаётся, ученику — сообщение в
                     Telegram через Worker) или отклонить
     Подписки      — действуют / истекают за 7 дней / истекли,
                     «Продлить на 30 дней»
     Журнал        — кто из админов что сделал
     Проверки      — последние проверки фото и текста
     Тарифы        — цены и лимиты из plan_limits

   Всё через функции admin_* (sql/schema-admin.sql и
   sql/schema-admin-automation.sql): они сами проверяют, что вошедший —
   администратор. Ключей здесь нет: токен бота Telegram — только в
   Worker, страница лишь просит его отправить сообщение.
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
    tSubs:{ru:'Подписки',en:'Subscriptions'},
    tAudit:{ru:'Журнал',en:'Log'},
    needMigration:{ru:'В базе нет новых функций админки — выполните sql/schema-admin-automation.sql.',en:'The database lacks the new admin functions — run sql/schema-admin-automation.sql.'},

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
    uJoined:{ru:'Регистрация',en:'Joined'},
    uAllPlans:{ru:'Все тарифы',en:'All plans'},
    uExpiredPlans:{ru:'Тариф истёк',en:'Plan expired'},
    uActivated:{ru:'с %1',en:'since %1'},
    uSelectAll:{ru:'Выбрать всех',en:'Select all'},
    uSelect:{ru:'Выбрать',en:'Select'},
    uCard:{ru:'Карточка',en:'Card'},
    bulkN:{ru:'Выбрано: %1',en:'Selected: %1'},
    bulkGrant:{ru:'Выдать тариф выбранным',en:'Grant a plan to selected'},
    bulkClear:{ru:'Снять выделение',en:'Clear selection'},
    bulkH:{ru:'Выдать тариф: %1',en:'Grant a plan: %1'},
    bulkDone:{ru:'Готово: тариф выдан (%1)',en:'Done: plan granted (%1)'},
    cardPlan:{ru:'Тариф',en:'Plan'},
    cardActivated:{ru:'Активирован',en:'Activated'},
    cardUntil:{ru:'Действует до',en:'Valid until'},
    cardPlag:{ru:'Списывание',en:'Cheating check'},
    cardJoined:{ru:'Регистрация',en:'Joined'},
    cardLast:{ru:'Последний вход',en:'Last sign-in'},
    cardChecks:{ru:'Проверок',en:'Checks'},
    cardYes:{ru:'включено',en:'on'},
    cardNo:{ru:'нет',en:'off'},
    cardExtend:{ru:'Продлить',en:'Extend'},
    cardDays:{ru:'дней',en:'days'},
    cardRevoke:{ru:'Снять тариф',en:'Remove plan'},
    cardRevokeQ:{ru:'Снять тариф у %1? Останется Бесплатный.',en:'Remove the plan from %1? The free plan stays.'},
    cardTg:{ru:'Telegram для уведомлений',en:'Telegram for notifications'},
    cardTgPh:{ru:'chat_id, например 123456789',en:'chat_id, e.g. 123456789'},
    cardTgSave:{ru:'Сохранить',en:'Save'},
    cardTgBad:{ru:'chat_id — только цифры (у групп — с минусом)',en:'chat_id is digits only (groups start with a minus)'},
    cardPays:{ru:'Оплаты',en:'Payments'},
    cardAudit:{ru:'Журнал',en:'Log'},
    cardNoPays:{ru:'Оплат не было',en:'No payments yet'},
    cardExtendBad:{ru:'Продлить можно действующий платный тариф со сроком',en:'Only a paid plan with an end date can be extended'},
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
    pPaid:{ru:'Подтверждены',en:'Confirmed'},
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
    pSearch:{ru:'Почта',en:'Email'},
    pPeriod:{ru:'Дата',en:'Date'},
    pCsv:{ru:'Скачать CSV',en:'Download CSV'},
    pTg:{ru:'Telegram',en:'Telegram'},
    tgSent:{ru:'Готово. Ученику ушло сообщение в Telegram.',en:'Done. The student got a Telegram message.'},
    tgNoChat:{ru:'Готово. У пользователя не указан Telegram — сообщения не было.',en:'Done. The user has no Telegram set — no message sent.'},
    tgNoBot:{ru:'Готово. Бот Telegram в Worker не настроен (TELEGRAM_BOT_TOKEN) — сообщения не было.',en:'Done. The Telegram bot is not set up in the Worker (TELEGRAM_BOT_TOKEN) — no message sent.'},
    tgFail:{ru:'Готово, но сообщение в Telegram не ушло: %1',en:'Done, but the Telegram message failed: %1'},
    st_pending:{ru:'ждёт',en:'pending'},
    st_paid:{ru:'подтверждена',en:'confirmed'},
    st_rejected:{ru:'отклонена',en:'rejected'},
    pu_paid_tariff:{ru:'Тариф «Платный»',en:'Paid plan'},
    pu_premium_tariff:{ru:'Тариф «Премиум»',en:'Premium plan'},
    pu_plagiarism:{ru:'Проверка на списывание',en:'Cheating check'},

    sCurrent:{ru:'Действуют',en:'Active'},
    sExpiring:{ru:'Истекают за 7 дней',en:'Ending within 7 days'},
    sExpired:{ru:'Истекли',en:'Expired'},
    sDaysLeft:{ru:'Осталось',en:'Left'},
    sDaysN:{ru:'%1 дн.',en:'%1 d'},
    sAgoN:{ru:'%1 дн. назад',en:'%1 d ago'},
    sExtend30:{ru:'Продлить на 30 дней',en:'Extend by 30 days'},
    sExtended:{ru:'Продлено на 30 дней',en:'Extended by 30 days'},
    st_active:{ru:'действует',en:'active'},
    st_expiring:{ru:'скоро кончится',en:'ending soon'},
    st_expired:{ru:'истёк',en:'expired'},
    st_forever:{ru:'бессрочно',en:'no end date'},

    auNote:{ru:'Каждое действие админов: выдача, продление и снятие тарифа, решения по оплатам, изменения цен и лимитов, Telegram. Записывают сами функции в базе — из браузера журнал не подделать.',
            en:'Every admin action: granting, extending and removing plans, payment decisions, price and limit changes, Telegram. The database functions write it themselves — it cannot be forged from the browser.'},
    auWhen:{ru:'Когда',en:'When'},
    auWho:{ru:'Кто',en:'Who'},
    auAction:{ru:'Действие',en:'Action'},
    auUser:{ru:'Пользователь',en:'User'},
    auDetails:{ru:'Подробности',en:'Details'},
    act_grant_tariff:{ru:'выдан тариф',en:'plan granted'},
    act_extend_tariff:{ru:'тариф продлён',en:'plan extended'},
    act_revoke_tariff:{ru:'тариф снят',en:'plan removed'},
    act_bulk_grant:{ru:'выдан тариф многим',en:'plan granted in bulk'},
    act_set_plagiarism:{ru:'проверка на списывание',en:'cheating check'},
    act_confirm_payment:{ru:'оплата подтверждена',en:'payment confirmed'},
    act_reject_payment:{ru:'оплата отклонена',en:'payment rejected'},
    act_update_limits:{ru:'цены и лимиты',en:'prices and limits'},
    act_set_telegram:{ru:'Telegram',en:'Telegram'},

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
    tab: 'overview', plans: [], overview: null, users: [], payments: [], checks: [], subs: [], audit: [],
    payStatus: 'pending', checkMode: '', search: '', loaded: {},
    userPlan: '', userSince: '', userUntil: '', selected: new Set(),
    paySearch: '', paySince: '', payUntil: '', subState: 'current'
  };
  const TABS = ['overview', 'users', 'payments', 'subs', 'audit', 'checks', 'plans'];

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

  /* Новая функция из schema-admin-automation.sql, а если её в базе ещё
     нет (миграцию не выполнили) — прежняя из schema-admin.sql. */
  const missingFn = e => !!e && (e.code === 'PGRST202' || /Could not find the function/i.test(e.message || ''));
  async function rpcOr(fn, args, oldFn, oldArgs) {
    try {
      return await Sky.db.rpc(fn, args);
    } catch (e) {
      if (oldFn && missingFn(e)) return rpc(oldFn, oldArgs);
      if (missingFn(e)) { Sky.toast(Sky.t('needMigration'), 7000); throw e; }
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
      if (tab === 'subs') await loadSubs();
      if (tab === 'audit') await loadAudit();
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
    S.users = (await rpcOr('admin_user_list',
      { p_search: S.search || null, p_plan: S.userPlan || null, p_since: S.userSince || null, p_until: S.userUntil || null, p_limit: 200 },
      'admin_users', { p_search: S.search || null, p_limit: 200 })) || [];
    /* выбранные, которых больше нет в списке, — не выбраны */
    const ids = new Set(S.users.map(u => u.id));
    [...S.selected].forEach(id => { if (!ids.has(id)) S.selected.delete(id); });
    renderUsers();
  }

  function renderUserPlan() {
    const sel = $('#userPlan');
    const opts = [['', Sky.t('uAllPlans')], ['free', planTitle('free')]]
      .concat(S.plans.filter(p => p.plan !== 'free').map(p => [p.plan, planTitle(p.plan)]))
      .concat([['expired', Sky.t('uExpiredPlans')]]);
    sel.innerHTML = opts.map(([v, l]) => `<option value="${esc(v)}"${v === S.userPlan ? ' selected' : ''}>${esc(l)}</option>`).join('');
  }

  function renderBulk() {
    const n = S.selected.size;
    $('#userBulk').classList.toggle('hidden', !n);
    $('#bulkCount').textContent = Sky.t('bulkN').replace('%1', n);
  }

  function planCell(u) {
    let s = `<span class="tag ${planTag(u.plan_active ? u.plan : 'free')}">${esc(planTitle(u.plan_active ? u.plan : 'free'))}</span>`;
    if (u.plan !== 'free') {
      s += `<span class="sub">${esc(!u.expires_at ? Sky.t('uForever')
        : (u.plan_active ? Sky.t('uUntil') : Sky.t('uExpired') + ' · ' + planTitle(u.plan)).replace('%1', day(u.expires_at)))}</span>`;
    }
    if (u.plan_active && u.activated_at) s += `<span class="sub">${esc(Sky.t('uActivated').replace('%1', day(u.activated_at)))}</span>`;
    if (u.plagiarism) s += `<span class="sub">+ ${esc(Sky.t('uPlag'))}</span>`;
    return s;
  }

  function renderUsers() {
    const rows = S.users;
    const all = rows.length && rows.every(u => S.selected.has(u.id));
    $('#usersBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable users"><thead><tr>
        <th class="ck"><input type="checkbox" id="selAll" aria-label="${esc(Sky.t('uSelectAll'))}"${all ? ' checked' : ''}></th>
        <th>${esc(Sky.t('uUser'))}</th><th>${esc(Sky.t('uRole'))}</th><th>${esc(Sky.t('uPlan'))}</th>
        <th class="num">${esc(Sky.t('uChecks'))}</th><th class="num">${esc(Sky.t('uTokens'))}</th>
        <th>${esc(Sky.t('uLast'))}</th><th>${esc(Sky.t('uSince'))}</th><th></th></tr></thead><tbody>${rows.map(u => `
        <tr class="${S.selected.has(u.id) ? 'sel' : ''}">
          <td class="ck"><input type="checkbox" data-sel="${esc(u.id)}" aria-label="${esc(Sky.t('uSelect'))} ${esc(u.email || '')}"${S.selected.has(u.id) ? ' checked' : ''}></td>
          <td><button type="button" class="link" data-card="${esc(u.id)}">${esc(u.email || '—')}</button>${u.admin ? ` <span class="tag warn">${esc(Sky.t('uAdmin'))}</span>` : ''}${u.telegram ? ` <span class="tag gray">TG</span>` : ''}<span class="sub">${esc(u.name || '')}</span></td>
          <td>${esc(u.role ? tOr(u.role, u.role) : '—')}</td>
          <td>${planCell(u)}</td>
          <td class="num">${num(u.checks_7d)} / ${num(u.checks_total)}</td>
          <td class="num">${num(u.tokens_7d)}</td>
          <td class="nowrap">${esc(when(u.last_check_at))}</td>
          <td class="nowrap">${esc(day(u.created_at))}<span class="sub">${esc(when(u.last_sign_in_at))}</span></td>
          <td><div class="acts"><button type="button" class="btn small" data-grant="${esc(u.id)}">${esc(Sky.t('uGrant'))}</button>
            <button type="button" class="btn small ghost" data-card="${esc(u.id)}">${esc(Sky.t('uCard'))}</button></div></td>
        </tr>`).join('')}</tbody></table>`;
    renderBulk();
  }

  function grant(id, after) {
    const u = S.users.find(x => x.id === id) || (S.card && S.card.id === id ? S.card : null);
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
        S.loaded.subs = false; S.loaded.audit = false;
        await Promise.all([loadUsers(), loadOverview()]).catch(() => {});
        if (after) after();
      });
    });
  }

  /* ---------- выдать тариф многим ---------- */
  function bulkGrant() {
    const ids = [...S.selected];
    if (!ids.length) return;
    const plans = (S.plans.length ? S.plans : [{ plan: 'paid' }, { plan: 'premium' }]).filter(p => p.plan !== 'free');
    Sky.modal(`
      <div class="adm-modal">
        <h2>${esc(Sky.t('bulkH').replace('%1', ids.length))}</h2>
        <p>${esc(ids.map(id => (S.users.find(u => u.id === id) || {}).email || id).join(', '))}</p>
        <div class="field"><label for="bPlan">${esc(Sky.t('gPlan'))}</label>
          <select id="bPlan">${plans.map(p => `<option value="${esc(p.plan)}"${p.plan === 'premium' ? ' selected' : ''}>${esc(planTitle(p.plan))}</option>`).join('')}</select></div>
        <div class="field"><label for="bDays">${esc(Sky.t('gDays'))}</label>
          <select id="bDays">${[7, 30, 90, 180, 365].map(d => `<option value="${d}"${d === 30 ? ' selected' : ''}>${esc(Sky.t('gDaysN').replace('%1', d))}</option>`).join('')}
            <option value="">${esc(Sky.t('gForever'))}</option></select></div>
        <div class="acts"><button type="button" class="btn ghost" data-x>${esc(Sky.t('aCancel'))}</button><button type="button" class="btn" data-go>${esc(Sky.t('gGo'))}</button></div>
      </div>`, (box, close) => {
      box.querySelector('[data-x]').addEventListener('click', close);
      box.querySelector('[data-go]').addEventListener('click', async e => {
        const days = box.querySelector('#bDays').value;
        e.currentTarget.disabled = true;
        let r;
        try { r = await rpcOr('admin_bulk_grant', { p_users: ids, p_tariff: box.querySelector('#bPlan').value, p_days: days ? Number(days) : null }); }
        catch (err) { e.currentTarget.disabled = false; return; }
        close();
        Sky.toast(Sky.t('bulkDone').replace('%1', (r && r.count) || ids.length));
        S.selected.clear();
        S.loaded.subs = false; S.loaded.audit = false;
        await Promise.all([loadUsers(), loadOverview()]).catch(() => {});
      });
    });
  }

  /* ---------- карточка пользователя ---------- */
  function planUntil(c) {
    if (!c.plan || c.plan === 'free') return '—';
    if (!c.expires_at) return Sky.t('uForever');
    return (new Date(c.expires_at) > new Date() ? '' : Sky.t('uExpired').replace('%1', '') ) + day(c.expires_at);
  }

  async function openCard(id) {
    let c;
    try { c = await rpcOr('admin_user_card', { p_user: id }); } catch (e) { return; }
    if (!c) return;
    S.card = c;
    Sky.modal('<div class="ucard" id="ucard"></div>', (box, close) => {
      S.cardClose = close;
      renderCard(box.querySelector('#ucard'));
    });
  }

  async function reloadCard() {
    const el = document.getElementById('ucard');
    if (!el || !S.card) return;
    try { S.card = await rpcOr('admin_user_card', { p_user: S.card.id }); } catch (e) { return; }
    renderCard(el);
  }

  function renderCard(el) {
    const c = S.card;
    const fact = (k, v) => `<div class="fact"><span>${esc(Sky.t(k))}</span><b>${v}</b></div>`;
    const active = c.plan_active ? c.plan : 'free';
    const canExtend = c.plan && c.plan !== 'free' && c.expires_at;
    el.innerHTML = `
      <h2>${esc(c.email || c.id)}${c.admin ? ` <span class="tag warn">${esc(Sky.t('uAdmin'))}</span>` : ''}</h2>
      <p class="sub" style="margin:-8px 0 0;color:var(--muted);font-size:13px">${esc([c.name, c.role ? tOr(c.role, c.role) : ''].filter(Boolean).join(' · '))}</p>
      <div class="facts">
        ${fact('cardPlan', `<span class="tag ${planTag(active)}">${esc(planTitle(c.plan || 'free'))}</span>`)}
        ${fact('cardActivated', esc(day(c.activated_at)))}
        ${fact('cardUntil', esc(planUntil(c)))}
        ${fact('cardPlag', esc(Sky.t(c.plagiarism ? 'cardYes' : 'cardNo')))}
        ${fact('cardJoined', esc(day(c.created_at)))}
        ${fact('cardLast', esc(when(c.last_sign_in_at)))}
        ${fact('cardChecks', esc(num(c.checks_total)))}
      </div>
      <div class="row-acts">
        <button type="button" class="btn small" data-c="grant">${esc(Sky.t('uGrant'))}</button>
        <span class="row-acts"><button type="button" class="btn small ghost" data-c="extend"${canExtend ? '' : ' disabled'}>${esc(Sky.t('cardExtend'))}</button>
          <input type="number" id="cDays" min="1" max="3660" value="30" inputmode="numeric" aria-label="${esc(Sky.t('cardDays'))}"> ${esc(Sky.t('cardDays'))}</span>
        <button type="button" class="btn small ghost" data-c="revoke"${c.plan && c.plan !== 'free' ? '' : ' disabled'} style="color:var(--no)">${esc(Sky.t('cardRevoke'))}</button>
      </div>
      <div class="field" style="margin:0"><label for="cTg">${esc(Sky.t('cardTg'))}</label>
        <div class="tg"><input type="text" id="cTg" inputmode="numeric" maxlength="21" placeholder="${esc(Sky.t('cardTgPh'))}" value="${esc(c.telegram_chat_id || '')}">
          <button type="button" class="btn small ghost" data-c="tg">${esc(Sky.t('cardTgSave'))}</button></div></div>
      <h3>${esc(Sky.t('cardPays'))}</h3>
      ${(c.payments || []).length ? `<div class="table-wrap"><table class="atable"><tbody>${c.payments.map(p => `<tr>
          <td class="nowrap">${esc(when(p.created_at))}</td>
          <td>${esc(tOr('pu_' + p.purpose, p.plan ? planTitle(p.plan) : p.purpose || '—'))}</td>
          <td class="num"><b>${num(p.amount)} ₽</b></td>
          <td>${stTag(p.status)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${esc(Sky.t('cardNoPays'))}</div>`}
      ${(c.audit || []).length ? `<h3>${esc(Sky.t('cardAudit'))}</h3><div class="table-wrap"><table class="atable"><tbody>${c.audit.map(a => `<tr>
          <td class="nowrap">${esc(when(a.created_at))}</td><td>${esc(tOr('act_' + a.action, a.action))}</td>
          <td>${esc(auditDetails(a.action, a.details))}</td><td class="sub">${esc(a.actor || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div style="display:flex;justify-content:flex-end"><button type="button" class="btn ghost" data-c="close">${esc(Sky.t('aDone'))}</button></div>`;
  }

  async function cardAction(act, el) {
    const c = S.card;
    if (!c) return;
    const after = async () => {
      S.loaded.subs = false; S.loaded.audit = false;
      await Promise.all([reloadCard(), loadUsers().catch(() => {}), loadOverview().catch(() => {})]);
    };
    if (act === 'close') { if (S.cardClose) S.cardClose(); return; }
    if (act === 'grant') { grant(c.id, reloadCard); return; }
    if (act === 'extend') {
      const days = Number(el.querySelector('#cDays').value);
      if (!(days >= 1 && days <= 3660)) { Sky.toast(Sky.t('pBadDays')); return; }
      try { await rpcOr('admin_extend_tariff', { p_user: c.id, p_days: days }); } catch (e) { return; }
      Sky.toast(Sky.t('aDone'));
      await after();
      return;
    }
    if (act === 'revoke') {
      if (!(await confirmBox(Sky.t('cardRevokeQ').replace('%1', c.email || c.id), Sky.t('cardRevoke')))) return;
      try { await rpcOr('admin_revoke_tariff', { p_user: c.id }); } catch (e) { return; }
      Sky.toast(Sky.t('aDone'));
      await after();
      return;
    }
    if (act === 'tg') {
      const v = el.querySelector('#cTg').value.trim();
      if (v && !/^-?\d{3,20}$/.test(v)) { Sky.toast(Sky.t('cardTgBad')); return; }
      try { await rpcOr('admin_set_telegram', { p_user: c.id, p_chat_id: v }); } catch (e) { return; }
      Sky.toast(Sky.t('aDone'));
      await after();
    }
  }

  /* ---------- оплаты ---------- */
  async function loadPayments() {
    S.payments = (await rpcOr('admin_payment_list',
      { p_status: S.payStatus || null, p_since: S.paySince || null, p_until: S.payUntil || null, p_search: S.paySearch || null, p_limit: 200 },
      'admin_payments', { p_status: S.payStatus || null, p_limit: 200 })) || [];
    renderPayments();
  }

  function paymentsCsv() {
    const cell = v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const rows = [['Дата', 'Почта', 'Что', 'Сумма, ₽', 'Статус', 'ID заявки']].concat(S.payments.map(p => [
      new Date(p.created_at).toISOString().replace('T', ' ').slice(0, 16), p.email || p.user_id || '',
      tOr('pu_' + p.purpose, p.plan ? planTitle(p.plan) : p.purpose || ''), p.amount, tOr('st_' + p.status, p.status), p.id]));
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n'));
    a.download = 'skyschool-payments.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- Telegram через Worker ----------
     Сообщение ученику отправляет Worker (там токен бота); страница
     только просит. Прежний Worker этого не умеет — тогда молчим. */
  let workerKind = null;
  async function notifyPayment(id) {
    const base = String((window.SKY_CONFIG || {}).AI_BASE || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(base)) return { skipped: true };
    try {
      if (!workerKind) {
        const h = await fetch(base + '/health').then(r => r.json());
        workerKind = Array.isArray(h.endpoints) && h.endpoints.includes('/api/check-photo') ? 'orders' : 'legacy';
      }
      if (workerKind !== 'orders') return { skipped: true };
      const token = await Sky.db.token();
      const r = await fetch(base + '/api/notify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ payment_id: id })
      });
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { sent: false, reason: 'http', description: d.error || String(r.status) };
    } catch (e) {
      return { sent: false, reason: 'network', description: e && e.message };
    }
  }
  function notifyText(n) {
    if (!n || n.skipped) return Sky.t('aDone');
    if (n.sent) return Sky.t('tgSent');
    if (n.reason === 'no_chat') return Sky.t('tgNoChat');
    if (n.reason === 'no_bot') return Sky.t('tgNoBot');
    return Sky.t('tgFail').replace('%1', n.description || n.reason || '');
  }

  function renderPayStatus() {
    $('#payStatus').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === S.payStatus)));
  }

  const stTag = s => `<span class="tag ${s === 'paid' ? 'ok' : s === 'rejected' ? 'no' : 'warn'}">${esc(tOr('st_' + s, s))}</span>`;
  function renderPayments() {
    const rows = S.payments;
    $('#paysBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable pays"><thead><tr><th>${esc(Sky.t('pDate'))}</th><th>${esc(Sky.t('pWho'))}</th><th>${esc(Sky.t('pWhat'))}</th>
        <th class="num">${esc(Sky.t('pSum'))}</th><th>${esc(Sky.t('pStatus'))}</th><th></th></tr></thead><tbody>${rows.map(p => `
        <tr>
          <td class="nowrap">${esc(when(p.created_at))}</td>
          <td>${p.user_id ? `<button type="button" class="link" data-card="${esc(p.user_id)}">${esc(p.email || p.user_id)}</button>` : '—'}${p.telegram ? ` <span class="tag gray">TG</span>` : ''}</td>
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
    try {
      if (approve) await rpcOr('admin_confirm_payment', { p_payment_id: id, p_days: days || 30 }, 'admin_payment_decide', { p_id: id, p_approve: true, p_days: days || 30 });
      else await rpcOr('admin_reject_payment', { p_payment_id: id }, 'admin_payment_decide', { p_id: id, p_approve: false, p_days: 30 });
    } catch (e) { return; }
    S.loaded.users = false; S.loaded.subs = false; S.loaded.audit = false;
    await Promise.all([loadPayments(), loadOverview()]).catch(() => {});
    Sky.toast(approve ? notifyText(await notifyPayment(id)) : Sky.t('aDone'), 6000);
  }

  /* ---------- подписки ---------- */
  async function loadSubs() {
    S.subs = (await rpcOr('admin_subscriptions', { p_limit: 1000 })) || [];
    renderSubs();
  }
  const inState = (x, st) => !st || (st === 'current' ? x.state !== 'expired' : x.state === st);

  function renderSubs() {
    const count = st => S.subs.filter(x => inState(x, st)).length;
    $('#subState').querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.state === S.subState));
      b.querySelector('.n').textContent = count(b.dataset.state);
    });
    const rows = S.subs.filter(x => inState(x, S.subState));
    const left = x => x.state === 'forever' ? Sky.t('st_forever')
      : x.days_left > 0 ? Sky.t('sDaysN').replace('%1', x.days_left) : Sky.t('sAgoN').replace('%1', Math.abs(x.days_left || 0));
    $('#subsBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable subs"><thead><tr><th>${esc(Sky.t('uUser'))}</th><th>${esc(Sky.t('uPlan'))}</th><th>${esc(Sky.t('cardActivated'))}</th>
        <th>${esc(Sky.t('cardUntil'))}</th><th class="num">${esc(Sky.t('sDaysLeft'))}</th><th></th></tr></thead><tbody>${rows.map(x => `
        <tr>
          <td><button type="button" class="link" data-card="${esc(x.user_id)}">${esc(x.email || x.user_id)}</button><span class="sub">${esc(x.name || '')}</span></td>
          <td><span class="tag ${planTag(x.plan)}">${esc(planTitle(x.plan))}</span>
            <span class="sub">${esc(tOr('st_' + x.state, x.state))}</span></td>
          <td class="nowrap">${esc(day(x.activated_at))}</td>
          <td class="nowrap">${esc(x.expires_at ? day(x.expires_at) : '—')}</td>
          <td class="num"><span class="tag ${x.state === 'expired' ? 'no' : x.state === 'expiring' ? 'warn' : 'ok'}">${esc(left(x))}</span></td>
          <td>${x.state === 'forever' ? '' : `<button type="button" class="btn small" data-extend="${esc(x.user_id)}">${esc(Sky.t('sExtend30'))}</button>`}</td>
        </tr>`).join('')}</tbody></table>`;
  }

  async function extend30(userId, btn) {
    btn.disabled = true;
    try { await rpcOr('admin_extend_tariff', { p_user: userId, p_days: 30 }); }
    catch (e) { btn.disabled = false; return; }
    Sky.toast(Sky.t('sExtended'));
    S.loaded.users = false; S.loaded.audit = false;
    await Promise.all([loadSubs(), loadOverview()]).catch(() => {});
  }

  /* ---------- журнал ---------- */
  async function loadAudit() {
    S.audit = (await rpcOr('admin_audit_log', { p_limit: 300, p_user: null })) || [];
    renderAudit();
  }

  function auditDetails(action, d) {
    d = d || {};
    const parts = [];
    if (d.plan) parts.push(planTitle(d.plan));
    if (d.days) parts.push(Sky.t('gDaysN').replace('%1', d.days));
    else if (action === 'grant_tariff' && d.plan !== 'free' && 'days' in d) parts.push(Sky.t('gForever'));
    if (d.expires_at && action !== 'confirm_payment') parts.push('→ ' + day(d.expires_at));
    if (d.amount != null) parts.push(num(d.amount) + ' ₽');
    if (d.count) parts.push('× ' + d.count);
    if (d.prev_plan && action === 'revoke_tariff') parts.push(planTitle(d.prev_plan) + ' →');
    if ('on' in d) parts.push(Sky.t(d.on ? 'cardYes' : 'cardNo'));
    if ('set' in d) parts.push(d.set ? 'chat_id' : '—');
    if (d.changes) parts.push(Object.keys(d.changes).map(k => `${k}: ${d.changes[k][0]} → ${d.changes[k][1]}`).join(', '));
    return parts.join(' · ');
  }

  function renderAudit() {
    const rows = S.audit;
    $('#auditBox').innerHTML = !rows.length ? `<div class="empty">${esc(Sky.t('aNone'))}</div>` :
      `<table class="atable audit"><thead><tr><th>${esc(Sky.t('auWhen'))}</th><th>${esc(Sky.t('auWho'))}</th><th>${esc(Sky.t('auAction'))}</th>
        <th>${esc(Sky.t('auUser'))}</th><th>${esc(Sky.t('auDetails'))}</th></tr></thead><tbody>${rows.map(a => `
        <tr>
          <td class="nowrap">${esc(when(a.created_at))}</td>
          <td>${esc(a.actor_email || '—')}</td>
          <td><b>${esc(tOr('act_' + a.action, a.action))}</b></td>
          <td>${a.target_user ? `<button type="button" class="link" data-card="${esc(a.target_user)}">${esc(a.target_email || a.target_user)}</button>` : '—'}</td>
          <td>${esc(auditDetails(a.action, a.details))}</td>
        </tr>`).join('')}</tbody></table>`;
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
    renderUserPlan();
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
  $('#usersBox').addEventListener('change', e => {
    if (e.target.id === 'selAll') {
      S.users.forEach(u => { if (e.target.checked) S.selected.add(u.id); else S.selected.delete(u.id); });
      renderUsers();
      return;
    }
    const id = e.target.dataset.sel;
    if (!id) return;
    if (e.target.checked) S.selected.add(id); else S.selected.delete(id);
    e.target.closest('tr').classList.toggle('sel', e.target.checked);
    const all = $('#selAll');
    if (all) all.checked = S.users.every(u => S.selected.has(u.id));
    renderBulk();
  });
  $('#userPlan').addEventListener('change', e => { S.userPlan = e.target.value; loadUsers().catch(() => {}); });
  $('#userSince').addEventListener('change', e => { S.userSince = e.target.value; loadUsers().catch(() => {}); });
  $('#userUntil').addEventListener('change', e => { S.userUntil = e.target.value; loadUsers().catch(() => {}); });
  $('#bulkGrant').addEventListener('click', bulkGrant);
  $('#bulkClear').addEventListener('click', () => { S.selected.clear(); renderUsers(); });
  /* карточка — по почте в любой таблице */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-card]');
    if (b && b.closest('#admApp')) { openCard(b.dataset.card); return; }
    const c = e.target.closest('.ucard [data-c]');
    if (c) cardAction(c.dataset.c, c.closest('.ucard'));
  });
  $('#subState').addEventListener('click', e => {
    const b = e.target.closest('button[data-state]');
    if (!b) return;
    S.subState = b.dataset.state;
    renderSubs();
  });
  $('#subsBox').addEventListener('click', e => {
    const b = e.target.closest('[data-extend]');
    if (b) extend30(b.dataset.extend, b);
  });
  let paySearchTimer = null;
  $('#paySearch').addEventListener('input', e => {
    clearTimeout(paySearchTimer);
    paySearchTimer = setTimeout(() => { S.paySearch = e.target.value.trim(); loadPayments().catch(() => {}); }, 300);
  });
  $('#paySince').addEventListener('change', e => { S.paySince = e.target.value; loadPayments().catch(() => {}); });
  $('#payUntil').addEventListener('change', e => { S.payUntil = e.target.value; loadPayments().catch(() => {}); });
  $('#payCsv').addEventListener('click', paymentsCsv);
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
    renderUserPlan();
    if (S.loaded.users) renderUsers();
    if (S.loaded.payments) renderPayments();
    if (S.loaded.subs) renderSubs();
    if (S.loaded.audit) renderAudit();
    if (S.loaded.checks) renderChecks();
    if (S.loaded.plans) renderPlans();
  });

  /* ---------- запуск ---------- */
  renderBrand();
  renderLang();
  const savedTab = Sky.get('admTab', 'overview');
  S.tab = TABS.includes(savedTab) ? savedTab : 'overview';
  boot();
})();
