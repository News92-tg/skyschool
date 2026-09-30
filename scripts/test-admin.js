/* ============================================================
   Админ-панель (admin.html) в настоящем браузере.

   Запуск:  node scripts/test-admin.js

   Supabase подменён в самой странице (window.supabase до загрузки
   db.js): вход, profiles, plan_limits и функции admin_*. Сами функции
   и то, что не-админ их вызвать не может, проверяет
   sql/tests/text-admin-tests.sql (scripts/test-rls.sh).
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const path = require('path');

const PAGE = 'file://' + path.join(__dirname, '..', 'admin.html');

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

/* Выполняется в странице до всех скриптов. */
function fakeSupabase(opts) {
  const b64 = o => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const jwt = email => b64({ alg: 'HS256' }) + '.' + b64({ sub: 'me', email }) + '.sig';
  const today = new Date();
  const iso = d => new Date(today.getTime() - d * 86400000).toISOString();
  const key = d => new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(today.getTime() - d * 86400000));
  const S = window.__adm = {
    session: opts.signedIn ? { access_token: jwt(opts.email), user: { id: 'me', email: opts.email, user_metadata: {} } } : null,
    admin: opts.admin, calls: [], authCb: null, forbid: {}, missing: opts.missing || {}, tg: { 'u-ivan': '4242' }, audit: [],
    plans: [
      { plan: 'free', title: 'Free', price_rub: 0, requests_per_window: 1, window_seconds: 600, photos_per_request: 5, text_requests_per_window: 1, text_window_seconds: 300, feature_compare: false, feature_teacher: false, feature_plagiarism: false },
      { plan: 'premium', title: 'Премиум', price_rub: 209, requests_per_window: 3, window_seconds: 60, photos_per_request: 20, text_requests_per_window: 5, text_window_seconds: 60, feature_compare: true, feature_teacher: true, feature_plagiarism: true },
      { plan: 'paid', title: 'Платный', price_rub: 59, requests_per_window: 1, window_seconds: 60, photos_per_request: 10, text_requests_per_window: 2, text_window_seconds: 60, feature_compare: true, feature_teacher: false, feature_plagiarism: false }
    ],
    users: [
      { id: 'u-owner', email: 'owner@test', name: 'Владелец', role: 'teacher', created_at: iso(30), last_sign_in_at: iso(0), plan: 'free', expires_at: null, plan_active: false, plagiarism: false, admin: true, checks_total: 3, checks_7d: 2, tokens_7d: 900, last_check_at: iso(0) },
      { id: 'u-ivan', email: 'ivan@test', name: 'Иван', role: 'student', created_at: iso(2), last_sign_in_at: iso(1), plan: 'paid', expires_at: iso(-20), plan_active: true, plagiarism: false, admin: false, checks_total: 5, checks_7d: 5, tokens_7d: 4000, last_check_at: iso(1) },
      { id: 'u-olga', email: 'olga@test', name: 'Ольга', role: 'student', created_at: iso(40), last_sign_in_at: iso(10), plan: 'premium', expires_at: iso(3), plan_active: false, plagiarism: true, admin: false, checks_total: 0, checks_7d: 0, tokens_7d: 0, last_check_at: null }
    ],
    payments: [
      { id: 'p1', created_at: iso(0), user_id: 'u-ivan', email: 'ivan@test', amount: 209, plan: 'premium', purpose: 'premium_tariff', status: 'pending' },
      { id: 'p2', created_at: iso(1), user_id: 'u-olga', email: 'olga@test', amount: 40, plan: null, purpose: 'plagiarism', status: 'pending' },
      { id: 'p3', created_at: iso(5), user_id: 'u-olga', email: 'olga@test', amount: 59, plan: 'paid', purpose: 'paid_tariff', status: 'paid' }
    ],
    checks: [
      { id: 'c1', created_at: iso(0), user_id: 'u-ivan', email: 'ivan@test', ip: '1.2.3.4', mode: 'text', subject: 'russian', length: 'long', grade: 4, tokens_used: 1000, comment: 'Хорошее сочинение', cached: false },
      { id: 'c2', created_at: iso(0), user_id: null, email: null, ip: '5.6.7.8', mode: 'text', subject: 'literature', length: 'short', grade: 5, tokens_used: 0, comment: 'Отлично', cached: true },
      { id: 'c3', created_at: iso(1), user_id: 'u-owner', email: 'owner@test', ip: '9.9.9.9', mode: 'photo', subject: 'physics', length: 'long', grade: 3, tokens_used: 700, comment: 'Ошибка в формуле', cached: false }
    ],
    overview: {
      users_total: 3, users_7d: 1, plans: { paid: 1, premium: 1 }, checks_today: { photo: 3, text: 2 }, tokens_today: 12345,
      payments_pending: 2, submissions_pending: 4,
      daily: [{ day: key(0), photo: 3, text: 2, cached: 1, tokens: 12345 }, { day: key(3), photo: 1, text: 0, cached: 0, tokens: 500 }]
    }
  };
  const forbidden = { message: 'forbidden: admin only', code: '42501' };
  const log = (action, user, details, payment) => S.audit.unshift({ id: S.audit.length + 1, created_at: new Date().toISOString(), action,
    actor_email: 'owner@test', target_user: user || null, target_email: user ? (S.users.find(u => u.id === user) || {}).email : null, payment_id: payment || null, details: details || {} });
  const daysLeft = u => u.expires_at ? Math.ceil((new Date(u.expires_at) - today) / 86400000) : null;
  const rpc = async (fn, a) => {
    S.calls.push({ fn, args: a });
    if (fn === 'is_admin') return { data: S.admin, error: null };
    if (!S.admin || S.forbid[fn]) return { data: null, error: forbidden };
    if (S.missing[fn]) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.' + fn } };
    switch (fn) {
      case 'admin_user_list': return { data: S.users.filter(u =>
          (!a.p_search || u.email.includes(a.p_search) || u.name.includes(a.p_search)) &&
          (!a.p_plan || (a.p_plan === 'free' ? !u.plan_active : a.p_plan === 'expired' ? (!u.plan_active && u.plan !== 'free') : (u.plan_active && u.plan === a.p_plan))) &&
          (!a.p_since || u.created_at.slice(0, 10) >= a.p_since) && (!a.p_until || u.created_at.slice(0, 10) <= a.p_until))
        .map(u => Object.assign({ activated_at: iso(10), telegram: !!S.tg[u.id] }, u)), error: null };
      case 'admin_user_card': {
        const u = S.users.find(x => x.id === a.p_user);
        return { data: Object.assign({ activated_at: iso(10) }, u, { telegram_chat_id: S.tg[u.id] || null,
          payments: S.payments.filter(p => p.user_id === u.id),
          audit: S.audit.filter(x => x.target_user === u.id).map(x => ({ created_at: x.created_at, action: x.action, actor: x.actor_email, details: x.details })) }), error: null };
      }
      case 'admin_bulk_grant': {
        a.p_users.forEach(id => Object.assign(S.users.find(u => u.id === id), { plan: a.p_tariff, plan_active: true, expires_at: a.p_days ? iso(-a.p_days) : null }));
        log('bulk_grant', null, { plan: a.p_tariff, days: a.p_days, count: a.p_users.length });
        return { data: { count: a.p_users.length }, error: null };
      }
      case 'admin_extend_tariff': {
        const u = S.users.find(x => x.id === a.p_user);
        if (!u.expires_at || u.plan === 'free') return { data: null, error: { message: 'no paid plan to extend', code: '22023' } };
        u.expires_at = iso(-(Math.max(daysLeft(u), 0) + a.p_days)); u.plan_active = true;
        log('extend_tariff', u.id, { plan: u.plan, days: a.p_days, expires_at: u.expires_at });
        return { data: { plan: u.plan, expires_at: u.expires_at }, error: null };
      }
      case 'admin_revoke_tariff': {
        const u = S.users.find(x => x.id === a.p_user);
        log('revoke_tariff', u.id, { prev_plan: u.plan });
        Object.assign(u, { plan: 'free', plan_active: false, expires_at: null });
        return { data: { plan: 'free' }, error: null };
      }
      case 'admin_set_telegram': S.tg[a.p_user] = a.p_chat_id || null; log('set_telegram', a.p_user, { set: !!a.p_chat_id }); return { data: { telegram_chat_id: a.p_chat_id || null }, error: null };
      case 'admin_payment_list': return { data: S.payments.filter(p => (!a.p_status || p.status === a.p_status) && (!a.p_search || (p.email || '').includes(a.p_search)) &&
          (!a.p_since || p.created_at.slice(0, 10) >= a.p_since) && (!a.p_until || p.created_at.slice(0, 10) <= a.p_until))
        .map(p => Object.assign({ telegram: !!S.tg[p.user_id] }, p)), error: null };
      case 'admin_confirm_payment': case 'admin_reject_payment': {
        const p = S.payments.find(x => x.id === a.p_payment_id);
        p.status = fn === 'admin_confirm_payment' ? 'paid' : 'rejected';
        S.overview.payments_pending = S.payments.filter(x => x.status === 'pending').length;
        log(fn === 'admin_confirm_payment' ? 'confirm_payment' : 'reject_payment', p.user_id, { amount: p.amount, plan: p.plan, days: a.p_days }, p.id);
        return { data: { status: p.status, user_id: p.user_id }, error: null };
      }
      case 'admin_subscriptions': return { data: S.users.filter(u => u.plan !== 'free').map(u => {
          const d = daysLeft(u);
          return { user_id: u.id, email: u.email, name: u.name, plan: u.plan, activated_at: iso(10), expires_at: u.expires_at, days_left: d,
            state: d == null ? 'forever' : d <= 0 ? 'expired' : d <= 7 ? 'expiring' : 'active' };
        }), error: null };
      case 'admin_audit_log': return { data: S.audit.slice(), error: null };
      case 'admin_overview': return { data: S.overview, error: null };
      case 'admin_users': return { data: S.users.filter(u => !a.p_search || u.email.includes(a.p_search) || u.name.includes(a.p_search)), error: null };
      case 'admin_set_plan': {
        const u = S.users.find(x => x.id === a.p_user);
        Object.assign(u, { plan: a.p_plan, plan_active: true, expires_at: a.p_days ? iso(-a.p_days) : null });
        if (a.p_plagiarism != null) u.plagiarism = a.p_plagiarism;
        log('grant_tariff', u.id, { plan: a.p_plan, days: a.p_days });
        return { data: { user_id: u.id, plan: u.plan, expires_at: u.expires_at }, error: null };
      }
      case 'admin_payments': return { data: S.payments.filter(p => !a.p_status || p.status === a.p_status), error: null };
      case 'admin_payment_decide': {
        const p = S.payments.find(x => x.id === a.p_id);
        p.status = a.p_approve ? 'paid' : 'rejected';
        S.overview.payments_pending = S.payments.filter(x => x.status === 'pending').length;
        return { data: { status: p.status }, error: null };
      }
      case 'admin_checks': return { data: S.checks.filter(c => !a.p_mode || (a.p_mode === 'text' ? c.mode === 'text' : c.mode !== 'text')), error: null };
      case 'admin_update_limits': {
        const p = S.plans.find(x => x.plan === a.p_plan);
        Object.assign(p, a.p_patch);
        return { data: Object.assign({}, p), error: null };
      }
    }
    return { data: null, error: { message: 'unknown ' + fn } };
  };
  const query = table => {
    const q = {
      _rows: table === 'plan_limits' ? S.plans.map(p => Object.assign({}, p)) : table === 'profiles' ? [{ id: 'me', name: 'Владелец', role: 'teacher' }] : [],
      select() { return q; },
      eq(k, v) { q._rows = q._rows.filter(r => r[k] === v); return q; },
      maybeSingle() { return Promise.resolve({ data: q._rows[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: q._rows, error: null }).then(res, rej); }
    };
    return q;
  };
  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: S.session } }),
        onAuthStateChange: cb => { S.authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
        signInWithPassword: async ({ email, password }) => {
          S.calls.push({ fn: 'signInWithPassword', args: { email } });
          if (password !== 'secret1') return { data: {}, error: { message: 'Invalid login credentials' } };
          S.session = { access_token: jwt(email), user: { id: 'me', email, user_metadata: {} } };
          return { data: { user: S.session.user, session: S.session }, error: null };
        },
        signInWithOAuth: async o => { S.calls.push({ fn: 'signInWithOAuth', args: o }); return { data: { url: null }, error: null }; },
        signOut: async () => { S.session = null; if (S.authCb) await S.authCb('SIGNED_OUT', null); return { error: null }; }
      },
      from: query,
      rpc
    })
  };
}

const worker = { calls: [], legacy: false, notify: { sent: true } };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function open(opts, viewport) {
    const ctx = await browser.newContext({ locale: 'ru-RU', viewport: viewport || { width: 1200, height: 900 } });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
    /* Worker: /health нового и уведомление в Telegram (что пришло — в worker.calls) */
    await ctx.route(/workers\.dev\//, async r => {
      const url = new URL(r.request().url());
      worker.calls.push({ path: url.pathname, body: r.request().postData(), auth: r.request().headers().authorization });
      const reply = (status, body) => r.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
      if (url.pathname === '/health') return reply(200, { ok: true, endpoints: worker.legacy ? ['/check-photo'] : ['/api/check-photo', '/check-photo'] });
      if (url.pathname === '/api/notify-payment') return reply(200, worker.notify);
      return reply(404, { error: 'not found' });
    });
    await ctx.addInitScript(fakeSupabase, opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|service ?worker/i.test(m.text())) errors.push(m.text()); });
    await page.goto(PAGE);
    return page;
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, el => !el.classList.contains('hidden') && el.offsetParent !== null).catch(() => false);
  const calls = (page, fn) => page.evaluate(f => __adm.calls.filter(c => c.fn === f).map(c => c.args), fn);
  /* ждём тост с нужным текстом: прошлый («Готово») может ещё висеть */
  const toastLike = (page, re) => page.waitForFunction(src => {
    const t = document.querySelector('.toast.show');
    return t && new RegExp(src).test(t.textContent);
  }, re.source, { timeout: 5000 }).then(() => true, () => false);

  /* ---------- без входа ---------- */
  let page = await open({ signedIn: false });
  await page.waitForSelector('#gateLogin:not(.hidden)');
  ok('без входа: форма входа, панели нет', await visible(page, '#gateLogin') && !(await visible(page, '#admApp')));
  ok('без входа: админ-функции не вызывались', (await page.evaluate(() => __adm.calls.filter(c => /^admin_/.test(c.fn)).length)) === 0);
  ok('отдельный сайт: без меню сайта, noindex', !(await page.$('#appHeader')) && (await page.$eval('meta[name=robots]', m => m.content)) === 'noindex,nofollow');
  await page.click('#loginGoogle');
  const oauth = (await calls(page, 'signInWithOAuth'))[0];
  ok('вход через Google, возврат на эту же страницу', oauth && oauth.provider === 'google' && /admin\.html$/.test(oauth.options.redirectTo));
  await page.fill('#loginMail', 'owner@test');
  await page.fill('#loginPass', 'wrong');
  await page.click('#loginGo');
  ok('неверный пароль — сообщение', await toastLike(page, /Invalid login/));
  await page.evaluate(() => { __adm.admin = true; });
  await page.fill('#loginPass', 'secret1');
  await page.click('#loginGo');
  await page.waitForSelector('#admApp:not(.hidden)');
  ok('вход почтой — панель открылась', await visible(page, '#admApp') && (await text(page, '#admWho')) === 'owner@test');
  await page.close();

  /* ---------- не админ ---------- */
  page = await open({ signedIn: true, email: 'stranger@test', admin: false });
  await page.waitForSelector('#gateDenied:not(.hidden)');
  ok('не админ: «Нет доступа» и почта', /Нет доступа/.test(await text(page, '#gateDenied h1')) && (await text(page, '#deniedMail')) === 'stranger@test');
  ok('не админ: данные не запрашивались', (await page.evaluate(() => __adm.calls.filter(c => /^admin_/.test(c.fn)).length)) === 0);
  await page.click('#deniedOut');
  await page.waitForSelector('#gateLogin:not(.hidden)');
  ok('не админ: «выйти» — снова форма входа', await visible(page, '#gateLogin'));
  await page.close();

  /* ---------- админ ---------- */
  page = await open({ signedIn: true, email: 'owner@test', admin: true });
  await page.waitForSelector('#ovStats .stat');
  const raw = await page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-ph]')]
    .filter(el => el.dataset.i18n ? el.textContent.trim() === el.dataset.i18n : el.placeholder === el.dataset.i18nPh)
    .map(el => el.dataset.i18n || el.dataset.i18nPh));
  ok('все подписи переведены', !raw.length, raw.join(', '));
  const stats = await page.$$eval('#ovStats .stat', s => s.map(x => x.innerText.replace(/\s+/g, ' ').trim()));
  ok('обзор: пользователи и новые за 7 дней', /^3 пользователей \+1 за 7 дней$/.test(stats[0]), stats[0]);
  ok('обзор: платные тарифы по видам', /^2 платных тарифов (Платный 1 · Премиум 1|Премиум 1 · Платный 1)$/.test(stats[1]), stats[1]);
  ok('обзор: проверки сегодня — фото и текст', /^5 проверок сегодня фото 3 · текст 2$/.test(stats[2]), stats[2]);
  ok('обзор: токены сегодня', /^12\s345 токенов сегодня$/.test(stats[3]), stats[3]);
  ok('обзор: очередь оплат и работ', /^2 заявок на оплату/.test(stats[4]) && /^4 работ по ссылкам/.test(stats[5]));
  ok('вкладка «Оплаты» с числом ждущих', (await text(page, '#payCnt')) === '2');
  ok('график: 14 дней, сегодня — 5 проверок', (await page.$$('#ovChart .chart .col')).length === 14 &&
    (await page.$eval('#ovChart .chart .col:last-child .n', n => n.textContent)) === '5');
  const ov = (await calls(page, 'admin_overview'))[0];
  ok('обзор: сутки — в поясе браузера', ov && typeof ov.p_tz === 'string' && ov.p_tz.length > 1);

  /* пользователи */
  await page.click('#admTabs [data-tab="users"]');
  await page.waitForSelector('#usersBox table');
  ok('пользователи: три строки, админ помечен', (await page.$$('#usersBox tbody tr')).length === 3 && /админ/.test(await text(page, '#usersBox tbody tr:first-child td:nth-child(2)')));
  ok('пользователи: действующий и истёкший тариф, дата активации', /Платный/.test(await text(page, '#usersBox tbody tr:nth-child(2) td:nth-child(4)')) &&
    /с \d\d\.\d\d\.\d{4}/.test(await text(page, '#usersBox tbody tr:nth-child(2) td:nth-child(4)')) &&
    /Бесплатный.*истёк/.test(await text(page, '#usersBox tbody tr:nth-child(3) td:nth-child(4)')));
  ok('пользователи: новые функции с фильтрами', (await calls(page, 'admin_user_list')).length === 1 && !(await calls(page, 'admin_users')).length);
  ok('фильтр тарифа: все, Бесплатный, платные из справочника, истёкшие',
    (await page.$$eval('#userPlan option', o => o.map(x => x.value).join())) === ',free,paid,premium,expired');
  await page.selectOption('#userPlan', 'expired');
  await page.waitForFunction(() => document.querySelectorAll('#usersBox tbody tr').length === 1);
  ok('фильтр «Тариф истёк»: одна строка, p_plan в запросе', (await calls(page, 'admin_user_list')).pop().p_plan === 'expired' && /olga/.test(await text(page, '#usersBox tbody')));
  await page.selectOption('#userPlan', '');
  const since = await page.evaluate(() => new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10));
  await page.fill('#userSince', since);
  await page.waitForFunction(() => document.querySelectorAll('#usersBox tbody tr').length === 1);
  ok('фильтр по дате регистрации: за 5 дней — только Иван', (await calls(page, 'admin_user_list')).pop().p_since === since && /ivan/.test(await text(page, '#usersBox tbody')));
  await page.fill('#userSince', '');
  await page.waitForFunction(() => document.querySelectorAll('#usersBox tbody tr').length === 3);
  await page.fill('#userSearch', 'ivan');
  await page.waitForFunction(() => document.querySelectorAll('#usersBox tbody tr').length === 1);
  ok('поиск: запрос с текстом, одна строка', (await calls(page, 'admin_user_list')).pop().p_search === 'ivan');
  await page.click('#usersBox [data-grant="u-ivan"]');
  await page.waitForSelector('.modal #gPlan');
  await page.selectOption('#gPlan', 'premium');
  await page.selectOption('#gDays', '90');
  await page.selectOption('#gPlag', 'true');
  await page.click('.modal [data-go]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  const setPlan = (await calls(page, 'admin_set_plan'))[0];
  ok('выдать тариф: Премиум, 90 дней, со списыванием', setPlan && setPlan.p_user === 'u-ivan' && setPlan.p_plan === 'premium' && setPlan.p_days === 90 && setPlan.p_plagiarism === true, JSON.stringify(setPlan));
  await page.waitForFunction(() => /Премиум/.test(document.querySelector('#usersBox tbody tr td:nth-child(4)').textContent));
  ok('после выдачи строка обновилась', /списывание/.test(await text(page, '#usersBox tbody tr td:nth-child(4)')));
  await page.click('#usersBox [data-grant="u-ivan"]');
  await page.waitForSelector('.modal #gPlan');
  await page.selectOption('#gPlan', 'free');
  ok('Бесплатный — без выбора срока', !(await visible(page, '#gDaysF')) && await visible(page, '#gFree'));
  await page.selectOption('#gPlan', 'paid');
  await page.selectOption('#gDays', '');
  await page.click('.modal [data-go]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  const setPlan2 = (await calls(page, 'admin_set_plan'))[1];
  ok('выдать бессрочно, списывание не трогать', setPlan2.p_days === null && setPlan2.p_plagiarism === null && setPlan2.p_plan === 'paid');

  /* оплаты */
  await page.click('#admTabs [data-tab="payments"]');
  await page.waitForSelector('#paysBox table');
  ok('оплаты: по умолчанию ждущие', (await calls(page, 'admin_payment_list'))[0].p_status === 'pending' && (await page.$$('#paysBox tbody tr')).length === 2);
  ok('оплаты: отметка Telegram у того, у кого он есть', /TG/.test(await text(page, '#paysBox tbody tr:first-child td:nth-child(2)')) &&
    !/TG/.test(await text(page, '#paysBox tbody tr:nth-child(2) td:nth-child(2)')));
  ok('оплаты: что и сумма', /Тариф «Премиум»/.test(await text(page, '#paysBox tbody tr:first-child')) && /209 ₽/.test(await text(page, '#paysBox tbody tr:first-child')));
  await page.fill('#payDays', '60');
  await page.click('#paysBox [data-approve="p1"]');
  await page.waitForSelector('.modal [data-ok]');
  ok('подтверждение: вопрос с суммой, почтой и сроком', /209 ₽ от ivan@test.*60 дней/.test(await text(page, '.modal p')));
  await page.click('.modal [data-x]');
  ok('«Отмена» — ничего не вызвано', !(await calls(page, 'admin_confirm_payment')).length);
  await page.click('#paysBox [data-approve="p1"]');
  await page.waitForSelector('.modal [data-ok]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok('Esc — тоже «нет»', !(await calls(page, 'admin_confirm_payment')).length && !(await page.$('.modal')));
  await page.click('#paysBox [data-approve="p1"]');
  await page.click('.modal [data-ok]');
  await page.waitForFunction(() => document.querySelectorAll('#paysBox tbody tr').length === 1);
  const dec = (await calls(page, 'admin_confirm_payment'))[0];
  ok('подтвердить: admin_confirm_payment, заявка и срок 60 дней', dec.p_payment_id === 'p1' && dec.p_days === 60);
  ok('подтвердить: Worker отправил ученику сообщение', await toastLike(page, /ушло сообщение в Telegram/) &&
    worker.calls.some(c => c.path === '/api/notify-payment' && JSON.parse(c.body).payment_id === 'p1' && /^Bearer /.test(c.auth || '')));
  ok('после решения — счётчик оплат обновился', (await text(page, '#payCnt')) === '1');
  await page.click('#paysBox [data-reject="p2"]');
  await page.click('.modal [data-ok]');
  await page.waitForSelector('#paysBox .empty');
  ok('отклонить: admin_reject_payment, очередь пуста, счётчик скрыт', (await calls(page, 'admin_reject_payment'))[0].p_payment_id === 'p2' && !(await visible(page, '#payCnt')) &&
    worker.calls.filter(c => c.path === '/api/notify-payment').length === 1);
  await page.fill('#payDays', '0');
  await page.click('#payStatus [data-status="paid"]');
  await page.waitForFunction(() => document.querySelectorAll('#paysBox tbody tr').length === 2);
  ok('фильтр «Подтверждены»', (await calls(page, 'admin_payment_list')).pop().p_status === 'paid');
  await page.fill('#paySearch', 'olga');
  await page.waitForFunction(() => document.querySelectorAll('#paysBox tbody tr').length === 1);
  ok('оплаты: поиск по почте', (await calls(page, 'admin_payment_list')).pop().p_search === 'olga');
  const today = await page.evaluate(() => new Date().toISOString().slice(0, 10));
  await page.fill('#paySince', today);
  await page.waitForFunction(() => /p_since/.test(JSON.stringify(__adm.calls.filter(c => c.fn === 'admin_payment_list').pop().args)) &&
    __adm.calls.filter(c => c.fn === 'admin_payment_list').pop().args.p_since);
  ok('оплаты: фильтр по дате', (await calls(page, 'admin_payment_list')).pop().p_since === today);
  await page.fill('#paySince', '');
  await page.fill('#paySearch', '');
  await page.click('#payStatus [data-status=""]');
  await page.waitForFunction(() => document.querySelectorAll('#paysBox tbody tr').length === 3);
  const csvDl = page.waitForEvent('download');
  await page.click('#payCsv');
  const csvFile = await csvDl;
  const csvText = require('fs').readFileSync(await csvFile.path(), 'utf8');
  ok('оплаты: CSV — имя файла, заголовок и все строки', csvFile.suggestedFilename() === 'skyschool-payments.csv' &&
    csvText.startsWith('\ufeffДата,Почта,Что,"Сумма, ₽",Статус,ID заявки') && csvText.trim().split('\r\n').length === 4 && /подтверждена/.test(csvText), csvText.slice(0, 120));

  /* подписки */
  await page.click('#admTabs [data-tab="subs"]');
  await page.waitForSelector('#subsBox table');
  const subCounts = await page.$$eval('#subState .n', n => n.map(x => x.textContent).join());
  ok('подписки: счётчики действуют / истекают / истекли / все', subCounts === '1,0,1,2', subCounts);
  ok('подписки: по умолчанию действующие; бессрочный — без «Продлить»', (await page.$$('#subsBox tbody tr')).length === 1 &&
    /бессрочно/.test(await text(page, '#subsBox tbody')) && await page.$('#subsBox [data-extend="u-ivan"]') === null);
  await page.click('#subState [data-state="expired"]');
  ok('подписки: истёкшие', (await page.$$('#subsBox tbody tr')).length === 1 && /olga/.test(await text(page, '#subsBox tbody')) && /назад/.test(await text(page, '#subsBox tbody')));
  await page.click('#subsBox [data-extend="u-olga"]');
  await page.waitForFunction(() => __adm.calls.some(c => c.fn === 'admin_extend_tariff'));
  ok('подписки: продлить на 30 дней', JSON.stringify((await calls(page, 'admin_extend_tariff'))[0]) === '{"p_user":"u-olga","p_days":30}' && await toastLike(page, /Продлено на 30 дней/));
  await page.waitForFunction(() => document.querySelector('#subState [data-state="expired"] .n').textContent === '0');
  ok('подписки: после продления истёкших нет', (await text(page, '#subState [data-state="current"] .n')) === '2');

  /* журнал */
  await page.click('#admTabs [data-tab="audit"]');
  await page.waitForSelector('#auditBox table');
  const au = await page.$$eval('#auditBox tbody tr', t => t.map(r => r.innerText.replace(/\s+/g, ' ')));
  ok('журнал: последние действия сверху, кто и что', /тариф продлён/.test(au[0]) && /owner@test/.test(au[0]) && au.some(r => /оплата подтверждена.*ivan@test.*209 ₽/.test(r)) &&
    au.some(r => /оплата отклонена/.test(r)), au.slice(0, 3).join(' | '));

  /* карточка пользователя */
  await page.click('#admTabs [data-tab="users"]');
  await page.fill('#userSearch', '');
  await page.waitForFunction(() => document.querySelectorAll('#usersBox tbody tr').length === 3);
  await page.click('#usersBox [data-card="u-ivan"]');
  await page.waitForSelector('.ucard .facts');
  const card = await page.$eval('.ucard', el => el.innerText.replace(/\s+/g, ' '));
  ok('карточка: почта, тариф, активация, срок', /ivan@test/.test(card) && /Платный/i.test(card) && /Активирован/i.test(card) && /Действует до бессрочно/i.test(card), card.slice(0, 200));
  ok('карточка: история оплат и журнал', /209 ₽/.test(card) && /подтверждена/.test(card) && /оплата подтверждена/.test(card));
  ok('карточка: Telegram подставлен', (await page.$eval('#cTg', i => i.value)) === '4242');
  ok('карточка: бессрочный тариф не продлить', await page.$eval('.ucard [data-c="extend"]', b => b.disabled));
  await page.click('.ucard [data-c="close"]');
  await page.waitForFunction(() => !document.querySelector('.ucard'));
  await page.click('#usersBox [data-card="u-olga"]');
  await page.waitForSelector('.ucard .facts');
  ok('карточка Ольги: Telegram пуст, две оплаты', (await page.$eval('#cTg', i => i.value)) === '' && (await page.$$('.ucard .atable')).length >= 1 &&
    /59 ₽/.test(await text(page, '.ucard')) && /40 ₽/.test(await text(page, '.ucard')));
  await page.fill('#cDays', '15');
  await page.click('.ucard [data-c="extend"]');
  await page.waitForFunction(() => __adm.calls.filter(c => c.fn === 'admin_extend_tariff').length === 2);
  ok('карточка: «Продлить» на введённые дни', (await calls(page, 'admin_extend_tariff'))[1].p_days === 15);
  await page.fill('#cTg', 'abc');
  await page.click('.ucard [data-c="tg"]');
  ok('карточка: chat_id не цифры — не отправляется', await toastLike(page, /только цифры/) && !(await calls(page, 'admin_set_telegram')).length);
  await page.fill('#cTg', '-100500');
  await page.click('.ucard [data-c="tg"]');
  await page.waitForFunction(() => __adm.calls.some(c => c.fn === 'admin_set_telegram'));
  ok('карточка: chat_id сохранён', JSON.stringify((await calls(page, 'admin_set_telegram'))[0]) === '{"p_user":"u-olga","p_chat_id":"-100500"}');
  await page.click('.ucard [data-c="revoke"]');
  await page.waitForSelector('.modal-bg:last-child [data-ok]');
  ok('карточка: «Снять тариф» — с вопросом', /Снять тариф у olga@test/.test(await text(page, '.modal-bg:last-child .modal p')));
  await page.click('.modal-bg:last-child [data-ok]');
  await page.waitForFunction(() => __adm.calls.some(c => c.fn === 'admin_revoke_tariff'));
  await page.waitForFunction(() => /Бесплатный/.test((document.querySelector('.ucard .facts') || {}).textContent || ''));
  ok('карточка: тариф снят, карточка обновилась', (await calls(page, 'admin_revoke_tariff'))[0].p_user === 'u-olga' &&
    await page.$eval('.ucard [data-c="revoke"]', b => b.disabled));
  await page.click('.ucard [data-c="close"]');
  await page.waitForFunction(() => !document.querySelector('.ucard'));

  /* выдать тариф многим */
  ok('без выбора панели массовых действий нет', !(await visible(page, '#userBulk')));
  await page.check('#usersBox [data-sel="u-ivan"]');
  await page.check('#usersBox [data-sel="u-olga"]');
  ok('выбрано двое — панель «Выбрано: 2»', await visible(page, '#userBulk') && /Выбрано: 2/.test(await text(page, '#bulkCount')));
  await page.click('#bulkGrant');
  await page.waitForSelector('.modal #bPlan');
  await page.selectOption('#bPlan', 'paid');
  await page.selectOption('#bDays', '90');
  await page.click('.modal [data-go]');
  await page.waitForFunction(() => __adm.calls.some(c => c.fn === 'admin_bulk_grant'));
  const bulk = (await calls(page, 'admin_bulk_grant'))[0];
  ok('выдать многим: два пользователя, Платный, 90 дней', JSON.stringify(bulk.p_users.slice().sort()) === '["u-ivan","u-olga"]' && bulk.p_tariff === 'paid' && bulk.p_days === 90);
  ok('выдать многим: «Готово (2)», выбор снят', await toastLike(page, /тариф выдан \(2\)/) && !(await visible(page, '#userBulk')));
  await page.check('#selAll');
  ok('«выбрать всех»', /Выбрано: 3/.test(await text(page, '#bulkCount')));
  await page.click('#bulkClear');
  ok('«снять выделение»', !(await visible(page, '#userBulk')) && !(await page.$eval('#selAll', i => i.checked)));

  /* проверки */
  await page.click('#admTabs [data-tab="checks"]');
  await page.waitForSelector('#checksBox table');
  ok('проверки: все три', (await page.$$('#checksBox tbody tr')).length === 3);
  ok('проверки: без входа — адрес, кэш помечен', /без входа/.test(await text(page, '#checksBox tbody tr:nth-child(2) td:nth-child(2)')) &&
    /5\.6\.7\.8/.test(await text(page, '#checksBox tbody tr:nth-child(2)')) && /кэш/.test(await text(page, '#checksBox tbody tr:nth-child(2) td:nth-child(3)')));
  ok('проверки: предмет и оценка', /Литература/.test(await text(page, '#checksBox tbody tr:nth-child(2)')) && (await text(page, '#checksBox tbody tr:first-child .gr')) === '4');
  await page.click('#checkMode [data-mode="text"]');
  await page.waitForFunction(() => document.querySelectorAll('#checksBox tbody tr').length === 2);
  ok('фильтр «Текст»', (await calls(page, 'admin_checks')).pop().p_mode === 'text');

  /* тарифы */
  await page.click('#admTabs [data-tab="plans"]');
  await page.waitForSelector('#plansBox .plan-card');
  ok('тарифы: три карточки по цене', (await page.$$eval('#plansBox .plan-card', f => f.map(x => x.dataset.plan).join())) === 'free,paid,premium');
  await page.click('.plan-card[data-plan="premium"] button[type=submit]');
  ok('без изменений — «Ничего не поменялось»', await toastLike(page, /Ничего не поменялось/) && !(await calls(page, 'admin_update_limits')).length);
  await page.fill('#pl-premium-price_rub', '199');
  await page.fill('#pl-premium-text_requests_per_window', '6');
  await page.fill('#pl-premium-text_window_seconds', '120');
  ok('окно в секундах — подсказка в минутах', /2 мин/.test(await text(page, '.plan-card[data-plan="premium"] [data-f="text_window_seconds"] ~ [data-win]')));
  await page.uncheck('.plan-card[data-plan="premium"] [data-f="feature_plagiarism"]');
  await page.click('.plan-card[data-plan="premium"] button[type=submit]');
  await page.waitForFunction(() => __adm.calls.some(c => c.fn === 'admin_update_limits'));
  const upd = (await calls(page, 'admin_update_limits'))[0];
  ok('сохранить: только изменённые поля', upd.p_plan === 'premium' &&
    JSON.stringify(upd.p_patch) === '{"price_rub":199,"text_requests_per_window":6,"text_window_seconds":120,"feature_plagiarism":false}', JSON.stringify(upd));
  await page.fill('#pl-paid-requests_per_window', '0');
  await page.click('.plan-card[data-plan="paid"] button[type=submit]');
  /* браузер сам не отправит форму с min="1"; savePlan проверяет то же ещё раз */
  ok('лимит 0 — не отправляется', await page.$eval('#pl-paid-requests_per_window', i => !i.validity.valid) &&
    (await calls(page, 'admin_update_limits')).length === 1);
  await page.$eval('.plan-card[data-plan="paid"]', f => f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  ok('в обход проверки браузера — тоже не отправляется', await toastLike(page, /лимиты — от 1/) && (await calls(page, 'admin_update_limits')).length === 1);

  /* ошибки прав и язык */
  await page.evaluate(() => { __adm.forbid.admin_checks = true; });
  await page.click('#admTabs [data-tab="checks"]');
  await page.click('#admRefresh');
  ok('42501 от базы — «Нет прав администратора»', await toastLike(page, /Нет прав администратора/));
  await page.click('#admLang [data-lang="en"]');
  ok('английский: вкладки и заголовок', (await text(page, '#admTabs [data-tab="users"]')) === 'Users' && (await text(page, '#admApp h1')) === 'Admin panel');
  await page.click('#admLang [data-lang="ru"]');
  await page.close();

  /* ---------- база без новых функций, прежний Worker ---------- */
  worker.legacy = true;
  worker.calls = [];
  page = await open({ signedIn: true, email: 'owner@test', admin: true, missing: { admin_user_list: true, admin_payment_list: true, admin_confirm_payment: true, admin_subscriptions: true } });
  await page.waitForSelector('#ovStats .stat');
  await page.click('#admTabs [data-tab="users"]');
  await page.waitForSelector('#usersBox table');
  ok('нет admin_user_list — список прежней admin_users', (await calls(page, 'admin_users')).length === 1 && (await page.$$('#usersBox tbody tr')).length === 3);
  await page.click('#admTabs [data-tab="payments"]');
  await page.waitForSelector('#paysBox table');
  ok('нет admin_payment_list — прежняя admin_payments', (await calls(page, 'admin_payments')).length === 1);
  await page.click('#paysBox [data-approve="p1"]');
  await page.click('.modal [data-ok]');
  await page.waitForFunction(() => __adm.calls.some(c => c.fn === 'admin_payment_decide'));
  ok('нет admin_confirm_payment — прежняя admin_payment_decide', (await calls(page, 'admin_payment_decide'))[0].p_approve === true);
  ok('прежний Worker — уведомление не запрашивается, просто «Готово»', await toastLike(page, /^Готово$/) && !worker.calls.some(c => c.path === '/api/notify-payment'));
  await page.click('#admTabs [data-tab="subs"]');
  ok('нет admin_subscriptions — подсказка про миграцию', await toastLike(page, /schema-admin-automation\.sql/));
  await page.close();
  worker.legacy = false;

  /* ---------- телефон ---------- */
  page = await open({ signedIn: true, email: 'owner@test', admin: true }, { width: 390, height: 844 });
  await page.waitForSelector('#ovStats .stat');
  let over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.click('#admTabs [data-tab="users"]');
  await page.waitForSelector('#usersBox table');
  over = Math.max(over, await page.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  ok('телефон 390 px: страница не шире экрана (таблица листается внутри)', over <= 0, String(over));
  if (process.env.SHOTS) {
    await page.click('#admTabs [data-tab="overview"]');
    await page.screenshot({ path: path.join(process.env.SHOTS, 'admin-phone.png'), fullPage: true });
  }
  await page.close();
  if (process.env.SHOTS) {
    page = await open({ signedIn: true, email: 'owner@test', admin: true });
    await page.waitForSelector('#ovStats .stat');
    await page.screenshot({ path: path.join(process.env.SHOTS, 'admin-overview.png'), fullPage: true });
    await page.click('#admTabs [data-tab="users"]');
    await page.waitForSelector('#usersBox table');
    await page.screenshot({ path: path.join(process.env.SHOTS, 'admin-users.png'), fullPage: true });
    await page.click('#admTabs [data-tab="plans"]');
    await page.waitForSelector('#plansBox .plan-card');
    await page.screenshot({ path: path.join(process.env.SHOTS, 'admin-plans.png'), fullPage: true });
    await page.click('#admTabs [data-tab="subs"]');
    await page.click('#subState [data-state=""]');
    await page.waitForSelector('#subsBox table');
    await page.screenshot({ path: path.join(process.env.SHOTS, 'admin-subs.png') });
    await page.click('#subsBox [data-card="u-ivan"]');
    await page.waitForSelector('.ucard .facts');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(process.env.SHOTS, 'admin-card.png') });
    await page.close();
  }

  ok('ошибок JavaScript на странице нет', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
