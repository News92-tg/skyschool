/* ============================================================
   «Быстрая проверка теста» (fast-check.html) в настоящем браузере.

   Запуск:  node scripts/test-fast-check.js

   Worker подменён: с новым (в /health есть /api/check-photo и
   /fast-check) страница шлёт POST /fast-check, с прежним — честно
   пишет, что функции пока нет, и ничего не отправляет. Сам разбор и
   пороги оценок (90/75/60) проверяет scripts/test-worker.js. Вход и
   хранилище подменяются в Sky.db после загрузки, как в
   scripts/test-photo-orders.js.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'fast-check.html');
const IMG = path.join(ROOT, 'assets', 'icon-192.png');
const WORKER = 'https://news92-orders.almazpro0927.workers.dev';

const PREMIUM = { plan: 'premium', title: 'Премиум', price_rub: 209, limits: { requests: 3, window_seconds: 60, photos: 20 },
  features: { compare: true, teacher: true, plagiarism: true }, user: true, rate: { allowed: true, remaining: 3, retry_after: 0, reset_in: 0 } };

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

(async () => {
  const browser = await browserLaunch();
  /* failName — работы с таким ФИО Worker «не разобрал» (status failed) */
  const state = { legacy: false, calls: [], next: null, failName: null };

  async function newCtx(viewport) {
    const ctx = await browser.newContext({ locale: 'ru-RU', viewport: viewport || { width: 1100, height: 900 }, acceptDownloads: true });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
    await ctx.route(WORKER + '/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      state.calls.push({ method: req.method(), path: url.pathname, headers: req.headers(), body: req.postData() });
      const reply = (status, body, type) => route.fulfill({ status, contentType: type || 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
      if (url.pathname === '/health') {
        return reply(200, { ok: true, endpoints: state.legacy
          ? ['/explain', '/check-photo', '/check-homework', '/chess-explain', '/grade-essay']
          : ['/api/check-text', '/api/check-photo', '/fast-check', '/explain', '/check-photo'] });
      }
      if (url.pathname === '/api/limits') return reply(200, PREMIUM);
      if (url.pathname === '/fast-check') {
        if (state.next) { const n = state.next; state.next = null; return reply(n.status, n.body); }
        const body = JSON.parse(req.postData());
        const pct = [100, 80, 70, 50];
        const students = body.student_imgs.map((s, i) => {
          const p = pct[i % 4], total = body.total || 10, correct = Math.round(p * total / 100);
          if (state.failName && s.name === state.failName) return { index: i + 1, name: s.name, class: s.class, status: 'failed', error: 'Модель не разобрала эту работу' };
          return { index: i + 1, name: s.name || 'С фото ' + (i + 1), class: s.class, correct, total, percent: p,
            grade: p >= 90 ? 5 : p >= 75 ? 4 : p >= 60 ? 3 : 2, errors: p < 100 ? [{ n: 3, student: 'Б', correct: 'А' }] : [], comment: '', status: 'ok' };
        });
        const done = { students, summary: { students: students.length, checked: students.length, failed: 0, total: body.total, avg_percent: 75, avg_grade: 3.5, grades: { 5: 1, 4: 1, 3: 1, 2: 0 } },
          csv_url: 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿ФИО,Класс,Верно,Всего,%,Оценка\r\n' + students.map(s => [s.name, s.class, s.correct, s.total, s.percent, s.grade].join(',')).join('\r\n')),
          tokens_used: { prompt: 10, completion: 5, total: 15 } };
        const lines = [JSON.stringify({ type: 'progress', done: students.length, total: students.length }), JSON.stringify(Object.assign({ type: 'result', status: 200 }, done))];
        return reply(200, lines.join('\n') + '\n', 'application/x-ndjson');
      }
      return reply(404, { error: 'not found' });
    });
    return ctx;
  }

  const errors = [];
  async function open(ctx) {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|service ?worker/i.test(m.text())) errors.push(m.text()); });
    await page.goto(PAGE);
    await page.waitForFunction(() => window.SkyCheck && window.Sky && Sky.db);
    await page.evaluate(() => {
      Sky.db.token = async () => 'jwt-test';
      Sky.db.me = () => ({ id: 'u1', name: 'Учитель', role: 'teacher' });
      window.__uploads = []; window.__removed = [];
      Sky.db.upload = async (b, p, blob) => { window.__uploads.push({ b, p, type: blob.type }); return p; };
      Sky.db.signedUrl = async (b, p) => 'https://sb.test/sign/' + p + '?token=x';
      Sky.db.removeFiles = async (b, ps) => { window.__removed.push(...ps); };
    });
    await page.evaluate(() => SkyCheck.loadLimits());
    return page;
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, el => !el.classList.contains('hidden') && el.offsetParent !== null).catch(() => false);

  /* ========== новый Worker ========== */
  let ctx = await newCtx();
  let page = await open(ctx);
  await page.waitForFunction(() => document.querySelector('#fcSubject').options.length > 0);
  const raw = await page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-ph]')]
    .filter(el => el.dataset.i18n ? el.textContent.trim() === el.dataset.i18n : el.placeholder === el.dataset.i18nPh)
    .map(el => el.dataset.i18n || el.dataset.i18nPh));
  ok('все подписи переведены', !raw.length, raw.join(', '));
  ok('шкала оценок 90/75/60 на странице', /90% и выше — 5/.test(await text(page, '#fcScale')) && /75–89% — 4/.test(await text(page, '#fcScale')) && /меньше 60% — 2/.test(await text(page, '#fcScale')));
  ok('новый Worker: предупреждения нет', !(await visible(page, '#fcNote')));
  ok('без фото кнопка неактивна', await page.$eval('#fcRun', b => b.disabled));
  ok('пункт меню «Быстрая проверка теста»', await page.$('#appHeader a[href="fast-check.html"], #appHeader [data-href="fast-check.html"]') !== null ||
    await page.evaluate(() => /fast-check\.html/.test(document.getElementById('appHeader').innerHTML)));

  await page.setInputFiles('#fcRefFile', IMG);
  ok('эталон добавлен', (await page.$$('#fcRef .roster-row')).length === 1);
  ok('только эталон — кнопка всё ещё неактивна', await page.$eval('#fcRun', b => b.disabled));
  await page.setInputFiles('#fcFiles', [IMG, IMG, IMG]);
  ok('3 работы, счётчик «3 из 30»', (await page.$$('#fcRoster .roster-row')).length === 3 && /3 из 30/.test(await text(page, '#fcCount')));
  await page.fill('#fcRoster .roster-row:nth-child(1) input[data-k="name"]', 'Иванов Иван');
  await page.fill('#fcRoster .roster-row:nth-child(2) input[data-k="cls"]', '7А');
  await page.fill('#fcTotal', '20');
  await page.fill('#fcClass', '7Б');
  await page.selectOption('#fcSubject', 'physics');
  ok('с эталоном и работами кнопка активна', !(await page.$eval('#fcRun', b => b.disabled)));

  await page.click('#fcRun');
  await page.waitForSelector('#fcResult .rtable');
  const call = state.calls.filter(c => c.path === '/fast-check').pop();
  const body = JSON.parse(call.body);
  ok('POST /fast-check: эталон отдельно, 3 работы, всего 20, предмет',
    /^https:\/\/sb\.test\/sign\/u1\/f.+\/1\.jpg/.test(body.reference_img) && body.student_imgs.length === 3 && body.total === 20 && body.subject === 'physics', call.body.slice(0, 200));
  ok('работы: ФИО из поля, класс из строки или «для всех»', body.student_imgs[0].name === 'Иванов Иван' && body.student_imgs[0].class === '7Б' && body.student_imgs[1].class === '7А' &&
    /\/2\.jpg/.test(body.student_imgs[0].img));
  ok('вход — заголовком, прогресс — потоком', call.headers.authorization === 'Bearer jwt-test' && /ndjson/.test(call.headers.accept));
  ok('фото сжаты в jpeg, после проверки удалены (4)', await page.evaluate(() => __uploads.length === 4 && __uploads.every(u => u.type === 'image/jpeg' && u.b === 'homework') && __removed.length === 4));

  const rows = await page.$$eval('#fcResult tbody tr', trs => trs.map(tr => [...tr.children].map(td => td.textContent.trim())));
  ok('таблица: ученик, верно/всего, %, оценка', rows.length === 3 && rows[0][1] === 'Иванов Иван' && rows[0][3] === '20/20' && rows[0][4] === '100%' && rows[0][5] === '5' &&
    rows[1][4] === '80%' && rows[1][5] === '4' && rows[2][5] === '3', JSON.stringify(rows));
  /* сводка — по самой таблице (100, 80, 70 % → в среднем 83 %, оценки 5, 4, 3 → 4) */
  ok('итог: средний % и средняя оценка по таблице, распределение', /83%/.test(await text(page, '#fcResult .stat.accent b')) && /\b4\b/.test(await text(page, '#fcResult .stat:nth-child(2) b')) &&
    (await page.$$('#fcResult .fc-dist > span')).length === 4, await page.textContent('#fcResult .stats') + ' / ' + (await page.$$('#fcResult .fc-dist > span')).length);
  ok('ошибки — свёрнуто в строке', await page.$('#fcResult tbody details') !== null);

  const dl = page.waitForEvent('download');
  await page.click('#fcCsv');
  const file = await dl;
  const csv = fs.readFileSync(await file.path(), 'utf8');
  ok('CSV: имя файла и столбцы «ФИО, класс, верно, всего, %, оценка»', file.suggestedFilename() === 'skyschool-fast-check.csv' && csv.startsWith('﻿ФИО,Класс,Верно,Всего,%,Оценка\r\nИванов Иван,7Б,20,20,100,5'), csv.slice(0, 80));

  /* ограничение 30 фото */
  await page.setInputFiles('#fcFiles', Array(30).fill(IMG));
  ok('больше 30 работ не берёт', (await page.$$('#fcRoster .roster-row')).length === 30 && /Не больше 30/.test(await text(page, '.toast')));
  await page.click('#fcClear');
  ok('«Очистить» убирает работы', (await page.$$('#fcRoster .roster-row')).length === 0);

  /* 402 — окно «Тарифы» */
  await page.setInputFiles('#fcFiles', IMG);
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next = { status: 402, body: { error: 'Проверка класса и тестов — в тарифе Премиум', code: 'tariff', need: 'premium' } };
  await page.click('#fcRun');
  await page.waitForSelector('.modal .tariffs');
  ok('402: окно «Тарифы» и причина', /Премиум/.test(await text(page, '#fcResult .limit-note')));
  await page.click('.modal [data-close]');

  /* 404 — Worker новый, но без /fast-check */
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next = { status: 404, body: { error: 'not found' } };
  await page.click('#fcRun');
  await page.waitForFunction(() => /news92-orders/.test((document.querySelector('#fcResult .limit-note') || {}).textContent || ''));
  ok('404: объяснение про новый Worker', /прежний/.test(await text(page, '#fcResult .limit-note')));
  await page.close();

  /* ---------- одно плохое фото не ломает остальные ---------- */
  const BAD = { name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('это не картинка') };
  const GOOD = { name: 'work.png', mimeType: 'image/png', buffer: fs.readFileSync(IMG) };
  const rowsOf = p => p.$$eval('#fcResult tbody tr', trs => trs.map(tr => ({ failed: tr.classList.contains('failed'), cells: [...tr.children].map(td => td.textContent.trim()) })));
  const sent = () => JSON.parse(state.calls.filter(c => c.path === '/fast-check').pop().body);

  page = await open(ctx);
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', [GOOD, GOOD, BAD, GOOD, GOOD]);
  await page.fill('#fcTotal', '10');
  await page.click('#fcRun');
  await page.waitForSelector('#fcResult .rtable');
  let r5 = await rowsOf(page);
  ok('5 фото, третье битое: в Worker ушли 4, проверены 4', sent().student_imgs.length === 4 && r5.length === 5 && r5.filter(r => !r.failed).length === 4, JSON.stringify(r5.map(r => r.failed)));
  ok('битое — «Не проверено: фото не открылось», номер на месте', r5[2].failed && r5[2].cells[0] === '3' && /фото не открылось/.test(r5[2].cells[6]), JSON.stringify(r5[2]));
  ok('сводка: проверено 4/5, подсказка и «Перепроверить непроверенные (1)»', /4\/5/.test(await text(page, '#fcResult .stat.ok b')) &&
    /Не проверено: 1/.test(await text(page, '.fc-failnote')) && (await text(page, '#fcRetry')) === 'Перепроверить непроверенные (1)');
  if (process.env.SHOTS) await (await page.$('#fcResultSec')).screenshot({ path: path.join(process.env.SHOTS, 'fast-check-failed.png') });
  const callsBefore = state.calls.filter(c => c.path === '/fast-check').length;
  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('#fcRetry');
  await page.waitForFunction(() => !document.querySelector('#fcProgress:not(.hidden)'));
  await page.waitForTimeout(150);
  ok('повтор: битое снова не открылось — в Worker ничего не ушло, проверенные на месте', state.calls.filter(c => c.path === '/fast-check').length === callsBefore &&
    (await rowsOf(page)).filter(r => !r.failed).length === 4);
  await page.close();

  page = await open(ctx);
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', Array(15).fill(IMG));
  for (let i = 1; i <= 15; i++) await page.fill(`#fcRoster .roster-row:nth-child(${i}) input[data-k="name"]`, 'Ученик ' + i);
  state.failName = 'Ученик 7';
  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('#fcRun');
  await page.waitForSelector('#fcResult .rtable');
  let r15 = await rowsOf(page);
  ok('15 фото: седьмую Worker не разобрал — она помечена, 14 проверены', r15.length === 15 && r15[6].failed && /модель не разобрала/i.test(r15[6].cells[6]) &&
    r15.filter(r => !r.failed).length === 14, JSON.stringify(r15.map(r => r.failed)));
  state.failName = null;
  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('#fcRetry');
  await page.waitForFunction(() => /15\/15/.test((document.querySelector('#fcResult .stat.ok b') || {}).textContent || ''));
  const again = sent();
  r15 = await rowsOf(page);
  ok('«Перепроверить непроверенные» — ушла одна работа, ответ встал в седьмую строку', again.student_imgs.length === 1 && again.student_imgs[0].name === 'Ученик 7' &&
    !r15[6].failed && r15[6].cells[1] === 'Ученик 7' && r15[6].cells[0] === '7', JSON.stringify(again.student_imgs));
  ok('всё проверено — кнопка стала «Проверить ещё раз», подсказки нет', (await text(page, '#fcRetry')) === 'Проверить ещё раз' && !(await page.$('.fc-failnote')));
  const dl15 = page.waitForEvent('download');
  await page.click('#fcCsv');
  const csv15 = fs.readFileSync(await (await dl15).path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  ok('CSV после перепроверки: 15 учеников, у седьмого — верно, всего, %, оценка', csv15.length === 16 && /^Ученик 7,,\d+,\d+,\d+,[2-5]$/.test(csv15[7]), csv15[7]);
  await page.close();

  /* весь запрос не прошёл — работы помечены с причиной, повтор их проверяет */
  page = await open(ctx);
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', [IMG, IMG]);
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next = { status: 503, body: { error: 'Сервис перегружен', code: 'upstream' } };
  await page.click('#fcRun');
  await page.waitForSelector('#fcResult .rtable');
  ok('сбой запроса: обе работы «Не проверено» с причиной и «Перепроверить непроверенные (2)»', (await rowsOf(page)).every(r => r.failed) &&
    /Проверка не прошла/.test(await text(page, '#fcResult .limit-note')) && (await text(page, '#fcRetry')) === 'Перепроверить непроверенные (2)');
  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('#fcRetry');
  await page.waitForFunction(() => /2\/2/.test((document.querySelector('#fcResult .stat.ok b') || {}).textContent || ''));
  ok('повтор после сбоя — обе проверены, причина сбоя убрана', (await rowsOf(page)).every(r => !r.failed) && !(await page.$('#fcResult .limit-note')));
  await page.close();

  /* телефон: без горизонтальной прокрутки */
  page = await open(ctx);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', [IMG, IMG]);
  await page.click('#fcRun');
  await page.waitForSelector('#fcResult .rtable');
  ok('телефон: страница не шире экрана (таблица листается внутри)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  ok('телефон: столбец «Оценка» виден без прокрутки', await page.$eval('#fcResult tbody tr:first-child .gr', el => el.getBoundingClientRect().right <= innerWidth));
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'fast-check-phone.png'), fullPage: true });
  await page.close();
  await ctx.close();

  /* ========== прежний Worker ========== */
  state.legacy = true;
  state.calls = [];
  ctx = await newCtx();
  page = await open(ctx);
  await page.waitForFunction(() => !document.querySelector('#fcNote').classList.contains('hidden'));
  ok('прежний Worker: предупреждение про news92-orders', /news92-orders\.js/.test(await text(page, '#fcNote')));
  await page.setInputFiles('#fcRefFile', IMG);
  await page.setInputFiles('#fcFiles', IMG);
  ok('прежний Worker: кнопка неактивна', await page.$eval('#fcRun', b => b.disabled));
  ok('прежний Worker: запросов к /fast-check нет', !state.calls.some(c => c.path === '/fast-check'));
  await page.close();
  await ctx.close();

  ok('без ошибок на странице', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });

function browserLaunch() { return chromium.launch(); }
