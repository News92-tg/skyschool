/* ============================================================
   Telegram в профиле (assets/telegram.js) и уведомление учителю
   после сдачи подборки (assets/collection.js).

   Запуск:  node scripts/test-telegram.js

   Supabase подменён (scripts/lib/fake-supabase.js), Worker — тоже.
   Сами эндпоинты Worker (/notify, /telegram/webhook…) проверяет
   scripts/test-worker.js, функции базы — scripts/test-rls.sh.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);
const WORKER = 'https://news92-orders.almazpro0927.workers.dev';

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(o) {
    o = o || {};
    const worker = { calls: [], bot: o.bot === undefined ? { ready: true, username: 'SkyySchoolBot', webhook_secret: true } : o.bot, legacy: !!o.legacy, sent: o.sent !== false };
    const fake = createBackend({
      users: [{ id: 'u-t', email: 't@school.test' }],
      tables: {
        profiles: [{ id: 'u-t', email: 't@school.test', name: 'Ольга', role: 'teacher', onboarding_done: true }],
        user_telegram: o.linked ? [{ user_id: 'u-t', chat_id: '424242' }] : [],
        user_plans: [], plan_limits: []
      },
      rpc: {
        my_stats: () => ({ checks_total: 0 }),
        is_admin: () => !!o.admin,
        telegram_link_start: () => ({ code: 'Labc123def456abc123def456abc123de', expires_at: new Date(Date.now() + (o.ttl || 15 * 60e3)).toISOString() })
      }
    });
    const ctx = await browser.newContext({ locale: 'ru-RU', viewport: o.viewport || { width: 1100, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
    await ctx.route(WORKER + '/**', async route => {
      const req = route.request();
      const u = new URL(req.url());
      worker.calls.push({ path: u.pathname, method: req.method(), body: req.postData(), auth: req.headers().authorization });
      const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
      if (u.pathname === '/health') return reply(200, { endpoints: worker.legacy ? ['/explain', '/check-photo'] : ['/api/check-photo', '/notify', '/api/telegram/bot'] });
      if (u.pathname === '/api/limits') return reply(200, { plan: 'free', limits: { requests: 1, window_seconds: 600, photos: 5 }, features: {}, rate: { remaining: 1 } });
      if (u.pathname === '/api/telegram/bot') return reply(200, worker.bot);
      if (u.pathname === '/notify') return reply(200, { sent: worker.sent, reason: worker.sent ? undefined : 'telegram' });
      if (u.pathname === '/api/telegram/setup') { worker.bot = { ready: true, username: 'SkyySchoolBot' }; return reply(200, { ok: true, username: 'SkyySchoolBot' }); }
      if (u.pathname === '/api/notify-submission') return reply(200, { sent: true });
      return reply(404, { error: 'not found' });
    });
    await fake.install(ctx, { session: 'u-t' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    page.on('dialog', d => d.accept());
    await page.goto(url(o.file || 'profile.html'));
    if (!o.file) {
      await page.evaluate(() => SkyProfile.ready);
      await page.waitForSelector('#telegram', { timeout: 4000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    return { page, ctx, fake, worker };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);

  /* ---------- привязка ---------- */
  let { page, ctx, fake, worker } = await open();
  ok('раздел Telegram в профиле: заголовок и что будет приходить', await text(page, '#telegram h2') === 'Уведомления в Telegram' && /сдаст работу/.test(await text(page, '#telegram > p')));
  ok('бот готов — кнопка «Привязать Telegram»', await text(page, '[data-tg=link]') === 'Привязать Telegram');
  await page.click('[data-tg=link]');
  await page.waitForSelector('[data-tg=open]');
  const href = await page.$eval('[data-tg=open]', a => a.getAttribute('href'));
  ok('ссылка на бота с одноразовым кодом из базы (не id пользователя)', href === 'https://t.me/SkyySchoolBot?start=Labc123def456abc123def456abc123de' && !/u-t/.test(href), href);
  ok('ссылка открывается в новой вкладке', await page.$eval('[data-tg=open]', a => a.target === '_blank' && /noopener/.test(a.rel)));
  ok('«Ждём» и «действует 15 минут»', /Запустить/.test(await text(page, '.tg-wait')) && /15 минут/.test(await text(page, '#telegram')));
  ok('код выдан вызовом telegram_link_start', fake.calls.some(c => c.kind === 'rpc' && c.fn === 'telegram_link_start'));
  fake.tables.user_telegram.push({ user_id: 'u-t', chat_id: '777000111' });   // бот сохранил chat_id
  await page.waitForSelector('.tg-state.on', { timeout: 6000 }).catch(() => {});
  ok('бот привязал чат — страница сама показывает «Подключено»', await text(page, '.tg-state b') === 'Подключено');
  ok('…и сообщает об этом', /Telegram подключён/.test(await text(page, '.sx-stack') || ''));
  await ctx.close();

  /* ---------- подключено: проверить и отключить ---------- */
  ({ page, ctx, fake, worker } = await open({ linked: true }));
  ok('уже подключено — «Подключено», «Проверить», «Отключить»', await text(page, '.tg-state b') === 'Подключено' && !!(await page.$('[data-tg=test]')) && !!(await page.$('[data-tg=off]')));
  await page.click('[data-tg=test]');
  await page.waitForFunction(() => /отправлено/.test((document.querySelector('.sx-stack') || {}).textContent || ''), null, { timeout: 4000 }).catch(() => {});
  const n = worker.calls.find(c => c.path === '/notify') || {};
  const nb = n.body ? JSON.parse(n.body) : {};
  ok('«Проверить» — POST /notify себе, тип test, со входом', nb.user_id === 'u-t' && nb.type === 'test' && /^Bearer /.test(n.auth || ''), JSON.stringify(n));
  ok('«Проверить» — «Тестовое сообщение отправлено»', /Тестовое сообщение отправлено/.test(await text(page, '.sx-stack')));
  await page.click('[data-tg=off]');
  await page.waitForSelector('[data-tg=link]', { timeout: 4000 }).catch(() => {});
  ok('«Отключить» — строка user_telegram удалена, снова «Привязать»', !fake.tables.user_telegram.length && !!(await page.$('[data-tg=link]')));
  await ctx.close();

  ({ page, ctx } = await open({ linked: true, sent: false }));
  await page.click('[data-tg=test]');
  await page.waitForFunction(() => /\/start/.test((document.querySelector('.toast.show') || {}).textContent || ''), null, { timeout: 4000 }).catch(() => {});
  ok('Telegram не принял — подсказка написать боту /start', /\/start/.test(await text(page, '.toast')));
  await ctx.close();

  /* ---------- ссылка устарела ---------- */
  ({ page, ctx } = await open({ ttl: 1500 }));
  await page.click('[data-tg=link]');
  await page.waitForSelector('[data-tg=open]');
  await page.waitForFunction(() => /устарела/.test(document.querySelector('#telegram').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('ссылка устарела — «получите новую» и кнопка «Новая ссылка»', /устарела/.test(await text(page, '#telegram')) && await text(page, '[data-tg=link]') === 'Новая ссылка');
  await ctx.close();

  /* ---------- бот не готов ---------- */
  ({ page, ctx, worker } = await open({ legacy: true }));
  ok('прежний Worker — «Бот ещё не подключён», кнопки нет, /api/telegram/bot не спрашиваем',
    /ещё не подключён/.test(await text(page, '#telegram')) && !(await page.$('[data-tg=link]')) && !worker.calls.some(c => c.path === '/api/telegram/bot'));
  await ctx.close();

  ({ page, ctx, worker } = await open({ bot: { ready: false, username: null }, admin: true }));
  ok('админу — что задать в Cloudflare и «Подключить вебхук»', /TELEGRAM_WEBHOOK_SECRET/.test(await text(page, '.tg-note.admin')) && !!(await page.$('[data-tg=setup]')));
  await page.click('[data-tg=setup]');
  await page.waitForSelector('[data-tg=link]', { timeout: 4000 }).catch(() => {});
  ok('«Подключить вебхук» — POST /api/telegram/setup, и появилась «Привязать»', worker.calls.some(c => c.path === '/api/telegram/setup' && c.method === 'POST') && !!(await page.$('[data-tg=link]')));
  await ctx.close();

  ({ page, ctx } = await open({ bot: { ready: false }, admin: false }));
  ok('не админу инструкций для Cloudflare не показываем', !(await page.$('.tg-note.admin')) && !(await page.$('[data-tg=setup]')));
  await ctx.close();

  /* ---------- телефон ---------- */
  ({ page, ctx } = await open({ viewport: { width: 360, height: 760 }, mobile: true }));
  await page.click('[data-tg=link]');
  await page.waitForSelector('[data-tg=open]');
  ok('телефон: без прокрутки вбок', await page.evaluate(() => document.documentElement.scrollWidth) <= 360);
  await ctx.close();

  /* ---------- ученик сдал подборку — учителю уведомление ---------- */
  {
    const fk = createBackend({
      tables: {},
      rpc: {
        get_collection_by_code: () => ({ id: 'c1', code: 'KX7P2M', title: 'Дроби', teacher: 'Ольга', tasks: [{ id: 't1', type: 'text', text: '1/2 + 1/2 = ?', options: [] }] }),
        submit_collection: () => ({ ok: true, id: 'eeeeeeee-0000-4000-8000-000000000001', correct: 1, auto: 1, open: 0, total: 1 })
      }
    });
    const c2 = await browser.newContext({ locale: 'ru-RU' });
    await c2.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
    const beacons = [];
    await c2.route(WORKER + '/**', route => {
      const req = route.request();
      beacons.push({ path: new URL(req.url()).pathname, body: req.postData() });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"sent":true}' });
    });
    await fk.install(c2, { session: null });
    const p2 = await c2.newPage();
    p2.on('pageerror', e => errors.push('collection: ' + e.message));
    await p2.goto(url('collection.html') + '?code=KX7P2M');
    await p2.waitForSelector('#sendBtn');
    await p2.fill('#stName', 'Маша');
    await p2.fill('textarea[name=a_t1]', '1');
    await p2.click('#sendBtn');
    await p2.waitForSelector('.cn-done', { timeout: 5000 }).catch(() => {});
    await p2.waitForTimeout(500);
    const b = beacons.find(x => x.path === '/api/notify-submission');
    ok('после сдачи — Worker просят сообщить учителю: kind и id работы', b && JSON.parse(b.body).kind === 'collection' && JSON.parse(b.body).id === 'eeeeeeee-0000-4000-8000-000000000001', JSON.stringify(beacons));
    ok('ученик видит «Ответы отправлены», уведомление его не задерживает', /отправлены/.test(await text(p2, '.cn-done')));
    await c2.close();
  }

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
