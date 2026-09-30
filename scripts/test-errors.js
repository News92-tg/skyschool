/* ============================================================
   Понятные ошибки (assets/errors.js) в настоящем браузере.

   Запуск:  node scripts/test-errors.js

   Проверяем:
     1. любой сбой узнаётся правильно: статусы 401/402/403/429/5xx,
        коды Worker (session, tariff, rate_limit), ошибки Supabase
        (42501, PGRST301), таймаут, нет сети;
     2. уведомление: иконка, понятный текст, «Повторить» вызывает
        повтор, на 429 — обратный отсчёт и кнопка ждёт его конца,
        на 401 — «Войти» ведёт на auth.html с возвратом;
     3. SkyErrors.fetch не бросает: 502, таймаут и обрыв сети приходят
        одним объектом;
     4. модуль подключается сам на странице, где его <script> нет;
     5. на телефоне уведомление не шире экрана.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page0 = f => 'file://' + path.join(ROOT, f);
const API = 'https://api.skyschool.test';

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1100, height: 800 } });
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
  await ctx.route(API + '/**', async route => {
    const u = new URL(route.request().url());
    const reply = (status, body, headers) => route.fulfill({ status, contentType: 'application/json',
      headers: Object.assign({ 'Access-Control-Allow-Origin': '*' }, headers || {}), body: JSON.stringify(body) });
    if (u.pathname === '/ok') return reply(200, { hello: 1 });
    if (u.pathname === '/bad-gateway') return reply(502, { error: 'upstream' });
    /* как Worker: срок и в заголовке, и в теле — заголовок CORS браузеру не отдаёт */
    if (u.pathname === '/rate') return reply(429, { error: 'wait', code: 'rate_limit', retry_after: 7 }, { 'Retry-After': '7' });
    if (u.pathname === '/slow') return; /* не отвечаем — ждём таймаута */
    if (u.pathname === '/down') return route.abort('internetdisconnected');
    return reply(404, { error: 'nope' });
  });

  const errors = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  /* index.html подключает только core.js — errors.js обязан прийти сам */
  await page.goto(page0('index.html'));
  await page.waitForFunction(() => window.SkyErrors, null, { timeout: 5000 }).catch(() => {});
  ok('подключается сам на странице без своего <script>', await page.evaluate(() => !!window.SkyErrors && Sky.errors === window.SkyErrors));

  /* ---------- 1. классификация ---------- */
  const kinds = await page.evaluate(() => {
    const k = x => SkyErrors.classify(x).kind;
    return {
      s401: k(401), session: k({ status: 401, data: { code: 'session' } }), login: k({ status: 401, data: { code: 'login' } }),
      jwt: k({ code: 'PGRST301', message: 'JWT expired' }),
      s402: k({ status: 402, data: { code: 'tariff', need: 'premium' } }),
      s403: k(403), rls: k({ code: '42501', message: 'new row violates row-level security policy' }),
      s404: k(404),
      s429: k({ status: 429, data: { code: 'rate_limit', retry_after: 12 } }),
      wait: SkyErrors.classify({ status: 429, data: { retry_after: 12 } }).wait,
      zai: k({ status: 429, data: { code: 'zai_limit' } }),
      s500: k(500), s502: k(502), s503: k({ status: 503, data: { error: 'x' } }),
      timeout: k({ timeout: true }), abort: k({ name: 'AbortError' }),
      net: k({ network: true }), typeErr: k(new TypeError('Failed to fetch')),
      bad: k({ status: 400, data: { error: 'Нужна картинка', code: 'bad_param' } }),
      raise: k({ code: 'P0001', message: 'Подборка закрыта' }),
      msg429: SkyErrors.message({ status: 429, data: { retry_after: 9 } }),
      msgRaise: SkyErrors.message({ code: 'P0001', message: 'Подборка закрыта' }),
      msg500: SkyErrors.message(500)
    };
  });
  ok('401 → «войдите»', kinds.s401 === 'auth' && kinds.session === 'auth' && kinds.login === 'auth');
  ok('истёкший JWT Supabase → «войдите»', kinds.jwt === 'auth');
  ok('402 и code=tariff → «тариф»', kinds.s402 === 'plan');
  ok('403 и RLS 42501 → «нет доступа»', kinds.s403 === 'forbidden' && kinds.rls === 'forbidden');
  ok('404 → «не найдено»', kinds.s404 === 'notfound');
  ok('429 → «подождите» со сроком из ответа', kinds.s429 === 'rate' && kinds.wait === 12 && kinds.zai === 'rate');
  ok('500/502/503 → «сервис недоступен»', kinds.s500 === 'server' && kinds.s502 === 'server' && kinds.s503 === 'server');
  ok('таймаут → «превышено время»', kinds.timeout === 'timeout' && kinds.abort === 'timeout');
  ok('обрыв сети → «нет соединения»', kinds.net === 'network' && kinds.typeErr === 'network');
  ok('400 и raise из базы — текст сервера', kinds.bad === 'bad' && kinds.raise === 'bad' && kinds.msgRaise === 'Подборка закрыта');
  ok('короткие тексты: «Подождите 9 с», «Сервис временно недоступен»', kinds.msg429 === 'Подождите 9 с' && kinds.msg500 === 'Сервис временно недоступен', JSON.stringify(kinds));

  /* ---------- 2. уведомления ---------- */
  await page.evaluate(() => { window.__retries = 0; SkyErrors.show(502, { retry: () => { window.__retries++; } }); });
  await page.waitForSelector('.sx.in');
  const s1 = await page.evaluate(() => {
    const el = document.querySelector('.sx');
    return { title: el.querySelector('.sx-title').textContent, text: el.querySelector('.sx-text').textContent,
      icon: !!el.querySelector('.sx-ico svg'), role: el.getAttribute('role'), btn: el.querySelector('.sx-btn').textContent };
  });
  ok('5xx: иконка, заголовок, пояснение, role=alert', s1.icon && s1.title === 'Сервис временно недоступен' && /минуту/.test(s1.text) && s1.role === 'alert', JSON.stringify(s1));
  await page.click('.sx .sx-btn');
  ok('«Повторить» вызывает повтор и закрывает уведомление',
    await page.evaluate(() => window.__retries) === 1 && await page.waitForFunction(() => !document.querySelector('.sx'), null, { timeout: 2000 }).then(() => true, () => false));

  await page.evaluate(() => { window.__r2 = 0; SkyErrors.show({ status: 429, data: { retry_after: 2 } }, { retry: () => { window.__r2++; } }); });
  await page.waitForSelector('.sx.in');
  const r0 = await page.evaluate(() => ({ t: document.querySelector('.sx-title').textContent, dis: document.querySelector('.sx-btn').disabled }));
  ok('429: «Подождите 2 с», «Повторить» пока неактивна', r0.t === 'Подождите 2 с' && r0.dis, JSON.stringify(r0));
  await page.waitForFunction(() => { const b = document.querySelector('.sx-btn'); return b && !b.disabled; }, null, { timeout: 4000 }).catch(() => {});
  ok('429: после отсчёта «Повторить» доступна', await page.evaluate(() => !document.querySelector('.sx-btn').disabled));
  await page.click('.sx .sx-btn');
  ok('429: повтор вызван', await page.evaluate(() => window.__r2) === 1);

  await page.waitForFunction(() => !document.querySelector('.sx'), null, { timeout: 2000 }).catch(() => {});
  await page.evaluate(() => SkyErrors.show({ status: 401, data: { code: 'session' } }));
  await page.waitForSelector('.sx.in .sx-btn');
  const signIn = await page.evaluate(() => { const a = document.querySelector('.sx .sx-btn'); return { text: a.textContent, tag: a.tagName, href: a.getAttribute('href') }; });
  ok('401: кнопка «Войти»', signIn.text === 'Войти', JSON.stringify(signIn));
  ok('401: «Войти» — ссылка на auth.html, помнит, откуда пришли', signIn.tag === 'A' && signIn.href === 'auth.html?next=index.html', JSON.stringify(signIn));
  await page.evaluate(() => SkyErrors.show(401, { modal: true }));
  await page.waitForTimeout(250);
  await page.click('.sx .sx-btn');
  ok('401 с modal: окно входа на месте, без перехода', await page.waitForSelector('.modal-bg', { timeout: 2000 }).then(() => true, () => false) && /index\.html/.test(page.url()));

  await page.goto(page0('index.html'));
  await page.waitForFunction(() => window.SkyErrors);
  await page.evaluate(() => { SkyErrors.show(500); SkyErrors.show(500); SkyErrors.show(403); });
  await page.waitForTimeout(300);
  ok('одинаковые ошибки подряд не множатся', await page.evaluate(() => document.querySelectorAll('.sx').length) === 2);
  await page.evaluate(() => document.querySelectorAll('.sx-x').forEach(b => b.click()));

  /* ---------- 3. запрос ---------- */
  const f = await page.evaluate(async api => ({
    good: await SkyErrors.fetch(api + '/ok'),
    bad: await SkyErrors.fetch(api + '/bad-gateway'),
    rate: await SkyErrors.fetch(api + '/rate'),
    slow: await SkyErrors.fetch(api + '/slow', { timeout: 400 }),
    down: await SkyErrors.fetch(api + '/down')
  }), API);
  ok('fetch: 200 — данные', f.good.ok && f.good.data.hello === 1);
  ok('fetch: 502 — не бросает, статус и данные', !f.bad.ok && f.bad.status === 502 && f.bad.data.error === 'upstream');
  ok('fetch: 429 — срок из Retry-After', f.rate.status === 429 && f.rate.retryAfter === 7);
  ok('fetch: таймаут', !f.slow.ok && f.slow.timeout === true);
  ok('fetch: обрыв сети', !f.down.ok && f.down.network === true);

  await page.evaluate(api => SkyErrors.fetch(api + '/bad-gateway', { toast: true, retry: () => {} }), API);
  ok('fetch с toast: ошибка показана сама', await page.waitForSelector('.sx.in', { timeout: 2000 }).then(() => true, () => false));

  /* ---------- 4. офлайн ---------- */
  await page.evaluate(() => document.querySelectorAll('.sx').forEach(e => e.remove()));
  await ctx.setOffline(true);
  await page.waitForSelector('.sx .sx-title', { timeout: 3000 }).catch(() => {});
  ok('пропала сеть — «Нет соединения»', /Нет соединения/.test(await page.textContent('.sx-stack').catch(() => '')));
  await ctx.setOffline(false);
  await page.waitForFunction(() => /Связь восстановлена/.test(document.querySelector('.sx-stack').textContent), null, { timeout: 3000 }).catch(() => {});
  ok('сеть вернулась — «Связь восстановлена»', /Связь восстановлена/.test(await page.textContent('.sx-stack')));

  /* ---------- 5. телефон и английский ---------- */
  const m = await browser.newContext({ locale: 'en-US', viewport: { width: 360, height: 700 }, isMobile: true, hasTouch: true });
  await m.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
  const mp = await m.newPage();
  mp.on('pageerror', e => errors.push(e.message));
  await mp.goto(page0('index.html'));
  await mp.waitForFunction(() => window.SkyErrors);
  await mp.evaluate(() => { Sky.setLang('en'); SkyErrors.show(402, { retry: () => {} }); });
  await mp.waitForSelector('.sx.in');
  const box = await mp.evaluate(() => { const r = document.querySelector('.sx').getBoundingClientRect(); return { l: r.left, r: r.right, sw: document.documentElement.scrollWidth, t: document.querySelector('.sx-title').textContent, b: document.querySelector('.sx-btn').textContent }; });
  ok('телефон: уведомление в экране, поля 16 px', box.l >= 15 && box.r <= 345 && box.sw <= 360, JSON.stringify(box));
  ok('английский: «Choose a plan» и кнопка «Plans»', box.t === 'Choose a plan' && box.b === 'Plans', JSON.stringify(box));
  await m.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));

  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
