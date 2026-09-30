/* ============================================================
   Лимиты проверок на странице (assets/limits.js).

   Запуск:  node scripts/test-limits.js

   Worker подменён. Проверяем на fast-check.html и photo.html:
     «Осталось: 2/3 проверок» в шапке и на странице; ноль — кнопка
     неактивна и отсчёт; 429 — отсчёт по retry_after; 402 — окно
     «Оформите тариф» с причиной; /api/limits нет (404) — заглушка;
     прежний Worker — его правило без запроса; телефон.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = f => 'file://' + path.join(ROOT, f);
const IMG = path.join(ROOT, 'assets', 'icon-192.png');
const WORKER = 'https://news92-orders.almazpro0927.workers.dev';

const plan = (remaining, extra) => Object.assign({
  plan: 'premium', title: 'Премиум', price_rub: 209, user: true,
  limits: { requests: 3, window_seconds: 60, photos: 20 },
  features: { compare: true, teacher: true, plagiarism: true },
  rate: { allowed: remaining > 0, remaining, retry_after: remaining > 0 ? 0 : 42, reset_in: 42 }
}, extra || {});

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const state = { legacy: false, limits: plan(2), limits404: false, fast: null, calls: [] };

  async function open(file, o) {
    o = o || {};
    const ctx = await browser.newContext({ locale: o.locale || 'ru-RU', viewport: o.viewport || { width: 1200, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
    await ctx.route(WORKER + '/**', async route => {
      const req = route.request();
      const u = new URL(req.url());
      state.calls.push(u.pathname);
      const reply = (status, body, type) => route.fulfill({ status, contentType: type || 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
      if (u.pathname === '/health') return reply(200, { ok: true, endpoints: state.legacy ? ['/explain', '/check-photo'] : ['/api/check-photo', '/fast-check', '/api/limits'] });
      if (u.pathname === '/api/limits') return state.limits404 ? reply(404, { error: 'not found' }) : reply(200, state.limits);
      if (u.pathname === '/fast-check') {
        const n = state.fast || { status: 200, body: { students: [], summary: { students: 0 } } };
        state.fast = null;
        return reply(n.status, n.body);
      }
      return reply(404, { error: 'not found' });
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|service ?worker/i.test(m.text())) errors.push(m.text()); });
    await page.goto(PAGE(file));
    await page.waitForFunction(() => window.SkyCheck && window.SkyLimits && Sky.db);
    await page.evaluate(() => {
      Sky.db.token = async () => 'jwt-test';
      Sky.db.me = () => ({ id: 'u1', name: 'Учитель', role: 'teacher' });
      Sky.db.upload = async (b, p) => p;
      Sky.db.signedUrl = async (b, p) => 'https://sb.test/sign/' + p;
      Sky.db.removeFiles = async () => {};
    });
    await page.evaluate(() => SkyCheck.loadLimits());
    await page.waitForTimeout(100);
    return { page, ctx };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const meter = page => text(page, '[data-limit-meter]:not([hidden]) .lm-text');
  const chip = page => text(page, '#tariffsHdr .lm-text');

  /* ---------- fast-check: осталось 2 из 3 ---------- */
  let { page, ctx } = await open('fast-check.html');
  ok('шапка: «Осталось: 2/3 проверок»', await chip(page) === 'Осталось: 2/3 проверок', await chip(page));
  ok('шапка: цвет «ещё есть», подсказка с тарифом', await page.$eval('#tariffsHdr', b => b.classList.contains('lm-chip') && !b.classList.contains('out') && /Премиум/.test(b.title)));
  ok('на странице — тот же счётчик (виден и на телефоне)', await meter(page) === 'Осталось: 2/3 проверок');
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', [IMG]);
  ok('есть проверки и фото — кнопка активна', !(await page.$eval('#fcRun', b => b.disabled)));
  await page.click('#tariffsHdr');
  ok('счётчик в шапке открывает «Тарифы»', await page.waitForSelector('.modal .pw.tariffs', { timeout: 2000 }).then(() => true, () => false)
    && await text(page, '.modal .pw h2') === 'Тарифы');
  await page.keyboard.press('Escape');

  /* 429 от Worker — отсчёт, кнопка неактивна */
  state.fast = { status: 429, body: { error: 'Подождите', code: 'rate_limit', retry_after: 5 } };
  await page.click('#fcRun');
  await page.waitForFunction(() => /Следующая через/.test((document.querySelector('#tariffsHdr .lm-text') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  ok('429: в шапке «Следующая через 00:0…»', /^Следующая через 00:0[3-5]$/.test(await chip(page)), await chip(page));
  ok('429: кнопка неактивна и объясняет почему', await page.$eval('#fcRun', b => b.disabled && /Следующая через/.test(b.title)));
  ok('429: счётчик красный, есть «Больше проверок»', await page.$eval('[data-limit-meter]', m => m.classList.contains('out')) && !!(await page.$('[data-limit-meter] .lm-more')));
  const t1 = await chip(page);
  await page.waitForTimeout(1200);
  ok('отсчёт идёт', await chip(page) !== t1, t1 + ' → ' + await chip(page));
  await ctx.close();

  /* лимит уже исчерпан при загрузке */
  state.limits = plan(0);
  ({ page, ctx } = await open('fast-check.html'));
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', [IMG]);
  ok('0 проверок: кнопка «Проверить» неактивна даже с фото', await page.$eval('#fcRun', b => b.disabled));
  ok('0 проверок: «Следующая через 00:42»', /^Следующая через 00:4[0-2]$/.test(await chip(page)), await chip(page));
  await page.click('[data-limit-meter] .lm-more');
  ok('«Больше проверок» — окно тарифов', await page.waitForSelector('.modal .pw.tariffs', { timeout: 2000 }).then(() => true, () => false));
  await page.keyboard.press('Escape');
  await ctx.close();

  /* 402 — окно «Оформите тариф» с причиной, одно */
  state.limits = plan(2, { plan: 'free', title: 'Бесплатный', features: { compare: false, teacher: true, plagiarism: false } });
  ({ page, ctx } = await open('fast-check.html'));
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', [IMG]);
  state.fast = { status: 402, body: { error: 'Быстрая проверка — в тарифе Премиум', code: 'tariff', need: 'premium' } };
  await page.click('#fcRun');
  await page.waitForSelector('.modal .pw.tariffs', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(200);
  ok('402: окно «Оформите тариф»', await text(page, '.modal .pw h2') === 'Оформите тариф');
  ok('402: причина от Worker', await text(page, '.modal .pw-reason') === 'Быстрая проверка — в тарифе Премиум');
  ok('402: нужный тариф подсвечен', await page.$eval('.modal .tf-card.focus', c => c.dataset.plan) === 'premium');
  ok('402: окно одно, хоть звали и страница, и limits.js', await page.$$eval('.modal .pw.tariffs', m => m.length) === 1);
  await ctx.close();

  /* ---------- /api/limits нет — заглушка ---------- */
  state.limits404 = true;
  ({ page, ctx } = await open('fast-check.html'));
  ok('/api/limits 404 — заглушка бесплатного тарифа', await page.evaluate(() => SkyCheck.limits && SkyCheck.limits.plan === 'free') && await chip(page) === 'Осталось: 1/1 проверок', await chip(page));
  await ctx.close();
  state.limits404 = false;

  /* ---------- photo.html ---------- */
  state.limits = plan(3);
  ({ page, ctx } = await open('photo.html'));
  ok('photo: «Осталось: 3/3 проверок» в шапке', await chip(page) === 'Осталось: 3/3 проверок', await chip(page));
  ok('photo: счётчик в строке тарифа', await meter(page) === 'Осталось: 3/3 проверок');
  ok('photo: кнопки проверки под охраной лимита', await page.$$eval('[data-needs-limit]', b => b.map(x => x.id).join()) === 'checkBtn,cRun,tRun,lRun');
  await page.evaluate(() => SkyCheck.applyRate({ allowed: true, remaining: 0, retry_after: 30, reset_in: 30 }));
  ok('photo: после последней проверки — «Следующая через 00:30», кнопка неактивна',
    /^Следующая через 00:(29|30)$/.test(await chip(page)) && await page.$eval('#checkBtn', b => b.disabled), await chip(page));
  await ctx.close();

  /* прежний Worker — без /api/limits, по его правилу */
  state.legacy = true;
  state.calls.length = 0;
  ({ page, ctx } = await open('photo.html'));
  ok('прежний Worker: «Осталось: 1/1», /api/limits не запрашивается', await chip(page) === 'Осталось: 1/1 проверок' && !state.calls.includes('/api/limits'), await chip(page) + ' ' + state.calls.join());
  await ctx.close();
  state.legacy = false;

  /* ---------- телефон и английский ---------- */
  state.limits = plan(1);
  ({ page, ctx } = await open('fast-check.html', { viewport: { width: 360, height: 740 }, mobile: true, locale: 'en-US' }));
  await page.evaluate(() => Sky.setLang('en'));
  await page.waitForTimeout(100);
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, hdr: getComputedStyle(document.getElementById('tariffsHdr')).display,
    meter: (document.querySelector('[data-limit-meter] .lm-text') || {}).textContent, low: document.querySelector('[data-limit-meter]').classList.contains('low') }));
  ok('телефон: шапка не шире экрана, счётчик — на странице', m.sw <= 360 && m.hdr === 'none' && m.meter === 'Left: 1/3 checks', JSON.stringify(m));
  ok('1 из 3 — предупреждающий цвет', m.low);
  await ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
