/* ============================================================
   «Доступно обновление» (assets/pwa.js + sw.js) в настоящем браузере.

   Запуск:  node scripts/test-pwa.js

   Service worker не работает со страниц file://, поэтому здесь свой
   маленький http-сервер. «Выкладка новой версии» — sw.js начинает
   отдаваться с другой последней строкой, как после git push.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

let build = 1;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  let body = fs.readFileSync(file);
  if (p === '/sw.js') body = Buffer.concat([body, Buffer.from('\n// build ' + build + '\n')]);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(body);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1100, height: 800 } });
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(base + '/index.html');
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
  ok('первая установка: sw.js сразу управляет страницей', await page.evaluate(() => !!navigator.serviceWorker.controller));
  ok('кэш новой версии — sky-v5-static', await page.evaluate(async () => (await caches.keys()).includes('sky-v5-static')));
  ok('pwa.js подключился сам', await page.evaluate(() => !!window.SkyPWA));
  ok('без новой версии баннера нет', !(await page.$('.pwa-bar')));

  /* выкладка новой версии */
  build = 2;
  await page.evaluate(() => SkyPWA.check());
  await page.waitForSelector('.pwa-bar.in', { timeout: 20000 }).catch(() => {});
  const txt = await page.$eval('.pwa-bar', b => ({ t: b.querySelector('b').textContent, go: b.querySelector('.pwa-go').textContent, later: b.querySelector('.pwa-later').textContent, role: b.getAttribute('role') })).catch(() => null);
  ok('новая версия — «Доступно обновление», «Обновить», «Позже»', txt && txt.t === 'Доступно обновление' && txt.go === 'Обновить' && txt.later === 'Позже' && txt.role === 'status', JSON.stringify(txt));
  ok('новая версия ждёт, страницей пока управляет прежняя', await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!(r.waiting && r.active); }));

  await page.click('.pwa-later');
  await page.waitForTimeout(400);
  ok('«Позже» — баннер убран', !(await page.$('.pwa-bar')));
  await page.reload();
  await page.waitForTimeout(1500);
  ok('после перезагрузки в той же вкладке — не пристаёт снова', !(await page.$('.pwa-bar')));

  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForSelector('.pwa-bar.in', { timeout: 10000 }).catch(() => {});
  ok('новая вкладка (без «Позже») — ожидающая версия снова предложена', !!(await page.$('.pwa-bar.in')));

  const nav = page.waitForNavigation({ timeout: 15000 }).then(() => true, () => false);
  await page.click('.pwa-go');
  ok('«Обновить» — страница перезагрузилась', await nav);
  await page.waitForTimeout(800);
  ok('после обновления — новая версия активна, ожидающей нет, баннера нет', await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !r.waiting && !!r.active && !document.querySelector('.pwa-bar');
  }));

  /* телефон и английский */
  build = 3;
  await page.setViewportSize({ width: 360, height: 740 });
  await page.evaluate(() => { Sky.setLang('en'); SkyPWA.check(); });
  await page.waitForSelector('.pwa-bar.in', { timeout: 20000 }).catch(() => {});
  const m = await page.evaluate(() => { const r = document.querySelector('.pwa-bar').getBoundingClientRect(); return { l: r.left, r: r.right, t: document.querySelector('.pwa-bar b').textContent, sw: document.documentElement.scrollWidth }; }).catch(() => null);
  ok('телефон: баннер в экране с полями 16 px, английский текст', m && m.l >= 15 && m.r <= 345 && m.sw <= 360 && m.t === 'Update available', JSON.stringify(m));

  ok('без ошибок на странице', !errors.length, errors.join(' | '));
  await browser.close();
  server.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
