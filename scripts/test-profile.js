/* ============================================================
   Профиль (profile.html) в настоящем браузере.

   Запуск:  node scripts/test-profile.js

   Supabase подменён (scripts/lib/fake-supabase.js), my_stats и
   is_admin — как в базе. Проверяем: данные и тариф, статистику
   учителя и ученика, «Сменить тариф», «Изменить имя», «Выйти»,
   ошибку статистики с «Повторить», вход не выполнен, телефон.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

const PROFILES = [
  { id: 'u-t', email: 'olga@school.test', name: 'Ольга Сергеевна', role: 'teacher', onboarding_done: false },
  { id: 'u-s', email: 'vanya@school.test', name: 'Ваня', role: 'student', onboarding_done: false }
];
const IN_AN_HOUR = new Date(Date.now() - 2 * 3600e3).toISOString();

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(o) {
    o = o || {};
    const fake = createBackend({
      users: PROFILES.map(p => ({ id: p.id, email: p.email })),
      tables: {
        profiles: PROFILES.map(p => Object.assign({}, p)),
        user_plans: o.plans || [{ user_id: 'u-t', plan: 'premium', expires_at: '2099-10-12T00:00:00Z' }],
        plan_limits: [{ plan: 'free', title: 'Бесплатный' }, { plan: 'paid', title: 'Платный' }, { plan: 'premium', title: 'Премиум' }]
      },
      rpc: {
        my_stats: (a, uid) => {
          if (o.statsFail && o.statsFail.n-- > 0) { const e = new Error('upstream'); e.code = '500'; throw Object.assign(e, { status: 503 }); }
          return uid === 'u-t'
            ? { checks_total: 128, photo_checks: 40, submissions: 88, pending: 5, students: 27, avg_grade: 4.2, graded: 96, last_check_at: IN_AN_HOUR }
            : { checks_total: 3, photo_checks: 3, submissions: 0, pending: 0, students: 0, avg_grade: 3.7, graded: 3, last_check_at: null };
        },
        is_admin: (a, uid) => !!o.admin && uid === 'u-t'
      }
    });
    const ctx = await browser.newContext({ locale: o.locale || 'ru-RU', viewport: o.viewport || { width: 1150, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    await fake.install(ctx, { session: o.session === undefined ? 'u-t' : o.session });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    const nav = page.waitForRequest(r => r.isNavigationRequest() && !/\/profile\.html$/.test(new URL(r.url()).pathname), { timeout: 4000 }).catch(() => null);
    await page.goto(url('profile.html'));
    await page.evaluate(() => window.SkyProfile && SkyProfile.ready).catch(() => {});
    await page.waitForTimeout(250);
    return { page, ctx, fake, nav };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
  const stat = (page, key) => page.$eval(`[data-stat="${key}"]`, el => ({ v: el.querySelector('b').textContent, l: el.querySelector('span').textContent, s: (el.querySelector('small') || {}).textContent || '' })).catch(() => null);

  /* ---------- учитель ---------- */
  let { page, ctx, fake } = await open();
  ok('имя, почта, роль', await text(page, '#pfName') === 'Ольга Сергеевна' && await text(page, '.pf-mail') === 'olga@school.test' && await text(page, '.pf-meta .tag') === 'Учитель');
  ok('тариф из user_plans: «Премиум, до 12 октября 2099»', await text(page, '.pf-plan-name') === 'Премиум' && /до 12 октября 2099/.test(await text(page, '.pf-until')), await text(page, '.pf-plan'));
  const checks = await stat(page, 'checks');
  ok('«Проверок всего: 128», «5 ждут проверки»', checks && checks.v === '128' && checks.l === 'Проверок всего' && checks.s === '5 ждут проверки', JSON.stringify(checks));
  ok('«Учеников в классе: 27»', (await stat(page, 'students') || {}).v === '27');
  const avg = await stat(page, 'avg');
  ok('«Средний балл класса: 4,2» из 96 оценок', avg && avg.v === '4,2' && avg.l === 'Средний балл класса' && avg.s === 'из 96 оценок', JSON.stringify(avg));
  ok('«Последняя проверка: 2 ч назад»', (await stat(page, 'last') || {}).v === '2 ч назад', JSON.stringify(await stat(page, 'last')));
  ok('быстрые действия учителя: подборки, фото, быстрая проверка, аналитика',
    await page.$$eval('#pfQuick a', a => a.map(x => x.getAttribute('href')).join()) === 'collections.html,photo.html,fast-check.html,analytics.html');
  ok('онбординг не пройден — ссылка «Первые шаги»', await page.$eval('#pfTour', e => !e.hidden));
  ok('не админ — ссылки на админку нет', !(await page.$('.pf-q.admin')));

  await page.click('#pfPlanBtn');
  ok('«Сменить тариф» — окно тарифов', await page.waitForSelector('.modal .pw.tariffs', { timeout: 2000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');

  await page.click('#pfEditBtn');
  await page.fill('#pfNameIn', '  ');
  await page.click('.pf-name-form [type=submit]');
  ok('пустое имя не сохраняется', await page.$('#pfNameIn') !== null && fake.tables.profiles[0].name === 'Ольга Сергеевна');
  await page.fill('#pfNameIn', 'Ольга Петрова');
  await page.click('.pf-name-form [type=submit]');
  await page.waitForFunction(() => document.querySelector('#pfName') && document.querySelector('#pfName').textContent === 'Ольга Петрова', null, { timeout: 3000 }).catch(() => {});
  ok('«Изменить имя» сохраняет в profiles и в шапке', fake.tables.profiles[0].name === 'Ольга Петрова' && /Ольга Петрова/.test(await text(page, '#btnMe')));

  ok('в шапке аккаунт — ссылка на профиль', await page.$eval('#btnMe', a => a.tagName === 'A' && a.getAttribute('href') === 'profile.html'));

  const out = page.waitForRequest(r => r.isNavigationRequest() && /index\.html$/.test(r.url()), { timeout: 3000 }).catch(() => null);
  await page.click('#pfOut');
  ok('«Выйти» — сессия закрыта, на главную', !!(await out) && fake.state.session === null);
  await ctx.close();

  /* ---------- админ, ученик ---------- */
  ({ page, ctx } = await open({ admin: true }));
  await page.waitForSelector('.pf-q.admin', { timeout: 2000 }).catch(() => {});
  ok('админ — ссылка «Админ-панель»', await page.$eval('.pf-q.admin', a => a.getAttribute('href')).catch(() => null) === 'admin.html');
  await ctx.close();

  ({ page, ctx } = await open({ session: 'u-s', plans: [] }));
  ok('ученик: тариф «Бесплатный», без срока', await text(page, '.pf-plan-name') === 'Бесплатный' && !(await page.$('.pf-until')));
  ok('ученик: без «Учеников», «Средний балл», «ещё не было»', !(await page.$('[data-stat="students"]')) && (await stat(page, 'avg') || {}).l === 'Средний балл' && (await stat(page, 'last') || {}).v === 'ещё не было');
  ok('ученик: свои быстрые действия, без онбординга', await page.$$eval('#pfQuick a', a => a.map(x => x.getAttribute('href')).join()) === 'homework.html,photo.html,trainer.html' && await page.$eval('#pfTour', e => e.hidden));
  await ctx.close();

  ({ page, ctx } = await open({ plans: [{ user_id: 'u-t', plan: 'premium', expires_at: '2020-01-01T00:00:00Z' }] }));
  ok('тариф истёк — «Бесплатный»', await text(page, '.pf-plan-name') === 'Бесплатный');
  await ctx.close();

  /* ---------- ошибка статистики ---------- */
  ({ page, ctx } = await open({ statsFail: { n: 1 } }));
  await page.waitForSelector('.sx.in', { timeout: 3000 }).catch(() => {});
  ok('статистика упала — понятное сообщение и «Повторить»', await text(page, '.pf-err') === 'Статистика не загрузилась' && /Повторить/.test(await text(page, '.sx-acts')), await text(page, '.sx'));
  await page.click('.sx .sx-btn');
  await page.waitForSelector('[data-stat="checks"]', { timeout: 3000 }).catch(() => {});
  ok('«Повторить» — статистика на месте', (await stat(page, 'checks') || {}).v === '128');
  await ctx.close();

  /* ---------- не вошёл, телефон ---------- */
  let r = await open({ session: null });
  const went = await r.nav;
  ok('не вошёл — на auth.html с возвратом в профиль', went && /auth\.html\?next=profile\.html$/.test(went.url()), went && went.url());
  await r.ctx.close();

  ({ page, ctx } = await open({ viewport: { width: 360, height: 780 }, mobile: true }));
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cols: getComputedStyle(document.getElementById('pfStats')).gridTemplateColumns.split(' ').length }));
  ok('телефон: без прокрутки вбок, статистика в 2 колонки', m.sw <= 360 && m.cols === 2, JSON.stringify(m));
  await page.evaluate(() => Sky.setLang('en'));
  await page.waitForTimeout(200);
  ok('английский: «Checks in total», «Change plan», «2 h ago»', (await stat(page, 'checks') || {}).l === 'Checks in total' && await text(page, '#pfPlanBtn') === 'Change plan' && (await stat(page, 'last') || {}).v === '2 h ago');
  await ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
