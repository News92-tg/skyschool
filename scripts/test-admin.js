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
    admin: opts.admin, calls: [], authCb: null, forbid: {},
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
  const rpc = async (fn, a) => {
    S.calls.push({ fn, args: a });
    if (fn === 'is_admin') return { data: S.admin, error: null };
    if (!S.admin || S.forbid[fn]) return { data: null, error: forbidden };
    switch (fn) {
      case 'admin_overview': return { data: S.overview, error: null };
      case 'admin_users': return { data: S.users.filter(u => !a.p_search || u.email.includes(a.p_search) || u.name.includes(a.p_search)), error: null };
      case 'admin_set_plan': {
        const u = S.users.find(x => x.id === a.p_user);
        Object.assign(u, { plan: a.p_plan, plan_active: true, expires_at: a.p_days ? iso(-a.p_days) : null });
        if (a.p_plagiarism != null) u.plagiarism = a.p_plagiarism;
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

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function open(opts, viewport) {
    const ctx = await browser.newContext({ locale: 'ru-RU', viewport: viewport || { width: 1200, height: 900 } });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
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
  ok('пользователи: три строки, админ помечен', (await page.$$('#usersBox tbody tr')).length === 3 && /админ/.test(await text(page, '#usersBox tbody tr:first-child td:first-child')));
  ok('пользователи: действующий и истёкший тариф', /Платный/.test(await text(page, '#usersBox tbody tr:nth-child(2) td:nth-child(3)')) &&
    /Бесплатный.*истёк/.test(await text(page, '#usersBox tbody tr:nth-child(3) td:nth-child(3)')));
  await page.fill('#userSearch', 'ivan');
  await page.waitForFunction(() => document.querySelectorAll('#usersBox tbody tr').length === 1);
  ok('поиск: запрос с текстом, одна строка', (await calls(page, 'admin_users')).pop().p_search === 'ivan');
  await page.click('#usersBox [data-grant="u-ivan"]');
  await page.waitForSelector('.modal #gPlan');
  await page.selectOption('#gPlan', 'premium');
  await page.selectOption('#gDays', '90');
  await page.selectOption('#gPlag', 'true');
  await page.click('.modal [data-go]');
  await page.waitForFunction(() => !document.querySelector('.modal'));
  const setPlan = (await calls(page, 'admin_set_plan'))[0];
  ok('выдать тариф: Премиум, 90 дней, со списыванием', setPlan && setPlan.p_user === 'u-ivan' && setPlan.p_plan === 'premium' && setPlan.p_days === 90 && setPlan.p_plagiarism === true, JSON.stringify(setPlan));
  await page.waitForFunction(() => /Премиум/.test(document.querySelector('#usersBox tbody tr td:nth-child(3)').textContent));
  ok('после выдачи строка обновилась', /списывание/.test(await text(page, '#usersBox tbody tr td:nth-child(3)')));
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
  ok('оплаты: по умолчанию ждущие', (await calls(page, 'admin_payments'))[0].p_status === 'pending' && (await page.$$('#paysBox tbody tr')).length === 2);
  ok('оплаты: что и сумма', /Тариф «Премиум»/.test(await text(page, '#paysBox tbody tr:first-child')) && /209 ₽/.test(await text(page, '#paysBox tbody tr:first-child')));
  await page.fill('#payDays', '60');
  await page.click('#paysBox [data-approve="p1"]');
  await page.waitForSelector('.modal [data-ok]');
  ok('подтверждение: вопрос с суммой, почтой и сроком', /209 ₽ от ivan@test.*60 дней/.test(await text(page, '.modal p')));
  await page.click('.modal [data-x]');
  ok('«Отмена» — ничего не вызвано', !(await calls(page, 'admin_payment_decide')).length);
  await page.click('#paysBox [data-approve="p1"]');
  await page.waitForSelector('.modal [data-ok]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  ok('Esc — тоже «нет»', !(await calls(page, 'admin_payment_decide')).length && !(await page.$('.modal')));
  await page.click('#paysBox [data-approve="p1"]');
  await page.click('.modal [data-ok]');
  await page.waitForFunction(() => document.querySelectorAll('#paysBox tbody tr').length === 1);
  const dec = (await calls(page, 'admin_payment_decide'))[0];
  ok('подтвердить: заявка и срок 60 дней', dec.p_id === 'p1' && dec.p_approve === true && dec.p_days === 60);
  ok('после решения — счётчик оплат обновился', (await text(page, '#payCnt')) === '1');
  await page.click('#paysBox [data-reject="p2"]');
  await page.click('.modal [data-ok]');
  await page.waitForSelector('#paysBox .empty');
  ok('отклонить: p_approve=false, очередь пуста, счётчик скрыт', (await calls(page, 'admin_payment_decide'))[1].p_approve === false && !(await visible(page, '#payCnt')));
  await page.fill('#payDays', '0');
  await page.click('#payStatus [data-status="paid"]');
  await page.waitForFunction(() => document.querySelectorAll('#paysBox tbody tr').length === 2);
  ok('фильтр «Оплачены»', (await calls(page, 'admin_payments')).pop().p_status === 'paid');

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
    await page.close();
  }

  ok('ошибок JavaScript на странице нет', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
