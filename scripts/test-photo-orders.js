/* ============================================================
   «Домашка по фото» в настоящем браузере, когда по адресу
   news92-orders стоит НОВЫЙ Worker (worker/news92-orders.js: в GET
   /health есть /api/check-photo): ученик (фото и текст), учитель,
   тарифы. С прежним Worker (worker/worker.js) — scripts/test-photo.js.

   Запуск:  node scripts/test-photo-orders.js

   Worker (AI_BASE) подменён: ответы собираются здесь, в тесте, а
   сам Worker проверяет scripts/test-worker.js. Supabase недоступен
   (страница уходит в локальный режим), вход и хранилище подменяются
   прямо в Sky.db после загрузки.
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'photo.html');
const IMG = path.join(ROOT, 'assets', 'icon-192.png');
const WORKER = 'https://news92-orders.almazpro0927.workers.dev';
const HW_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const PLANS = {
  free:    { plan: 'free', title: 'Бесплатный', price_rub: 0, limits: { requests: 1, window_seconds: 600, photos: 5 }, features: { compare: false, teacher: false, plagiarism: false },
             text: { requests: 1, window_seconds: 300, rate: { allowed: true, remaining: 1, retry_after: 0, reset_in: 0 } } },
  premium: { plan: 'premium', title: 'Премиум', price_rub: 209, limits: { requests: 3, window_seconds: 60, photos: 20 }, features: { compare: true, teacher: true, plagiarism: true },
             text: { requests: 5, window_seconds: 60, rate: { allowed: true, remaining: 5, retry_after: 0, reset_in: 0 } } },
  /* тариф, выданный в админке, — не из трёх основных */
  family:  { plan: 'family', title: 'Family', price_rub: 649, limits: { requests: 3, window_seconds: 60, photos: 20 }, features: { compare: true, teacher: true, plagiarism: true },
             text: { requests: 5, window_seconds: 60, rate: { allowed: true, remaining: 5, retry_after: 0, reset_in: 0 } } }
};
const TEXT = {
  subject: 'russian', length: 'long',
  criteria: { topic_match: 5, argumentation: 4, composition: 4, logic: 3, spelling: 4, grammar: 5 },
  errors: [{ type: 'пунктуация', fragment: 'Я думаю что', correction: 'Я думаю, что' }],
  assessment: 4, comment: 'Хорошая работа, добавьте примеры.', cached: false,
  tokens_used: { prompt: 700, completion: 300, total: 1000 }, plan: 'free', rate: { remaining: 0, retry_after: 300, reset_in: 300 }
};
const CHECK = {
  recognized_text: '2+2=5', errors: [{ type: 'вычислительная', fragment: '2+2=5', correction: '2+2=4' }],
  assessment: 3, assessment_text: '3 (удовлетворительно)', assessment_reason: 'Ошибка в ответе', comment: 'Внимательнее со сложением.',
  tokens_used: { prompt: 100, completion: 50, total: 150 }, plan: 'free', rate: { remaining: 0, retry_after: 600, reset_in: 600 }
};

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());

  /* ---------- подменённый Worker ---------- */
  const state = { plan: 'free', next: {}, calls: [], textDelay: 0 };
  await ctx.route(WORKER + '/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    state.calls.push({ method: req.method(), path: url.pathname, search: url.search, headers: req.headers(), body: req.postDataBuffer() });
    const reply = (status, body, type) => route.fulfill({
      status, contentType: type || 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    if (url.pathname === '/health') {
      return reply(200, { ok: true, service: 'skyschool-ai', endpoints: ['/api/check-text', '/api/check-photo', '/explain', '/check-photo', '/check-homework', '/chess-explain', '/grade-essay'] });
    }
    const custom = state.next[url.pathname];
    if (custom) { delete state.next[url.pathname]; return reply(custom.status, custom.body, custom.type); }
    if (url.pathname === '/api/limits') {
      return reply(200, Object.assign({}, PLANS[state.plan], { user: true, rate: { allowed: true, remaining: PLANS[state.plan].limits.requests, retry_after: 0, reset_in: 0 } }));
    }
    if (url.pathname === '/api/check-photo') return reply(200, CHECK);
    if (url.pathname === '/api/check-text') {
      await new Promise(r => setTimeout(r, state.textDelay));
      return reply(200, TEXT);
    }
    if (url.pathname === '/api/payments') return reply(201, { id: 'p1', status: 'pending', amount: 209, message: 'Оплата скоро' });
    if (url.pathname === '/api/submit-homework') return reply(201, { id: HW_ID, url: 'https://news92-tg.github.io/skyschool/photo.html?hw=' + HW_ID });
    if (url.pathname === '/api/homework/' + HW_ID) {
      return reply(200, { id: HW_ID, student_name: 'Петров Пётр', class: '9Б', subject: 'algebra', img_url: 'https://sb.test/sign/sub.jpg?token=t', status: 'pending' });
    }
    if (url.pathname.startsWith('/api/homework/')) return reply(404, { error: 'Работа не найдена', code: 'not_found' });
    if (url.pathname === '/api/check-teacher-report') {
      const body = JSON.parse(req.postData());
      const reports = body.photos.map((p, i) => i === 1
        ? { index: i + 1, name: p.name || 'С фото', class: p.class, status: 'failed', error: 'Сервис проверки временно недоступен', submission_id: p.submission_id }
        : Object.assign({ index: i + 1, name: p.name || 'Сидоров С.', class: p.class, assessment: 5 - i % 2, assessment_reason: 'ок', errors_count: 1,
            errors: [{ type: 'орфография', fragment: 'малоко', correction: 'молоко' }], comment: 'Хорошо', status: 'ok', submission_id: p.submission_id },
            body.criteria ? { criteria: body.criteria.map((c, k) => Object.assign({ score: 5 - k * 2, comment: '' }, c)), score: 4.3 } : {}));
      const done = { reports, summary: { avg: 4.5, total: reports.length, checked: reports.filter(r => r.status === 'ok').length, failed: reports.filter(r => r.status !== 'ok').length },
        csv_url: 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿ФИО,Класс,Оценка,Комментарий,Ошибок\r\n'), tokens_used: { prompt: 300, completion: 90, total: 390 } };
      if ((req.headers().accept || '').includes('ndjson')) {
        const lines = reports.map((r, i) => JSON.stringify({ type: 'progress', done: i + 1, total: reports.length, name: r.name, status: r.status }));
        lines.push(JSON.stringify(Object.assign({ type: 'result', status: 200 }, done)));
        return reply(200, lines.join('\n') + '\n', 'application/x-ndjson');
      }
      return reply(200, done);
    }
    if (url.pathname === '/api/check-test') {
      const body = JSON.parse(req.postData());
      const students = body.student_imgs.map((s, i) => ({ index: i + 1, name: s.name || 'С фото ' + (i + 1), class: s.class, correct: 8, total: body.total || 10, percent: 80,
        errors: [{ n: 3, student: 'Б', correct: 'А' }], comment: 'ок', status: 'ok' }));
      const done = { reference: { answers: [] }, students, summary: { students: students.length, checked: students.length, failed: 0, total: 10, avg_percent: 80 },
        csv_url: 'data:text/csv;charset=utf-8,x', tokens_used: { prompt: 10, completion: 5, total: 15 } };
      const lines = [JSON.stringify({ type: 'progress', done: students.length, total: students.length }), JSON.stringify(Object.assign({ type: 'result', status: 200 }, done))];
      return reply(200, lines.join('\n') + '\n', 'application/x-ndjson');
    }
    return reply(404, { error: 'not found' });
  });

  const errors = [];
  async function open(url, viewport) {
    const page = await ctx.newPage();
    if (viewport) await page.setViewportSize(viewport);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|service ?worker/i.test(m.text())) errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.SkyCheck && window.Sky && Sky.db);
    /* «вход» и хранилище — подмена */
    await page.evaluate(() => {
      Sky.db.token = async () => 'jwt-test';
      Sky.db.me = () => ({ id: 'u1', name: 'Тест', role: 'student' });
      window.__uploads = [];
      window.__removed = [];
      Sky.db.upload = async (b, p, blob) => { window.__uploads.push({ p, type: blob.type, size: blob.size }); return p; };
      Sky.db.signedUrl = async (b, p) => 'https://sb.test/sign/' + p + '?token=x';
      Sky.db.removeFiles = async (b, ps) => { window.__removed.push(...ps); };
    });
    await page.evaluate(() => SkyCheck.loadLimits());
    return page;
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, el => !el.classList.contains('hidden') && el.offsetParent !== null).catch(() => false);

  /* ========== ученик, Бесплатный ========== */
  let page = await open(PAGE);
  ok('Worker опознан по /health как новый', await page.evaluate(() => SkyCheck.mode()) === 'orders');
  ok('строка тарифа: Бесплатный, 1 запрос / 10 мин, до 5 фото',
    (await text(page, '#planChip')) === 'Тариф: Бесплатный' && (await text(page, '#planLimit')) === '1 запрос / 10 мин · до 5 фото', await text(page, '#planLimit'));
  ok('кнопка «Тарифы» в шапке', await visible(page, '#tariffsHdr'));
  ok('9 предметов (8 + «Другое»)', (await page.$$('#subjRow .subj-btn')).length === 9);
  const raw = await page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-ph]')]
    .filter(el => el.dataset.i18n ? el.textContent.trim() === el.dataset.i18n : el.placeholder === el.dataset.i18nPh)
    .map(el => el.dataset.i18n || el.dataset.i18nPh));
  ok('все подписи переведены (и в режиме учителя)', !raw.length, raw.join(', '));
  ok('пометки тарифа у сверки и списывания видны', await visible(page, '#optCompare ~ .lock') && await visible(page, '#optAccuracy ~ .lock'));
  ok('по умолчанию: оценка включена, подробно', await page.$eval('#optGrade', i => i.checked) && (await page.$eval('#lengthSeg [data-len="long"]', b => b.getAttribute('aria-pressed'))) === 'true');

  await page.click('label:has(#optCompare)');
  await page.waitForSelector('.modal .tariffs');
  ok('сверка без тарифа: галочка не ставится, открыты «Тарифы» с Платным', !(await page.$eval('#optCompare', i => i.checked)) && await page.$('.tf-card.focus') !== null &&
    /Платный/.test(await text(page, '.tf-card.focus .tf-head')));
  ok('в окне три тарифа и докупка списывания +40 ₽', (await page.$$('.tf-list .tf-card')).length === 3 && /\+40 ₽/.test(await text(page, '.tf-card.addon')));
  await page.click('.tf-card [data-buy="premium_tariff"]');
  await page.waitForFunction(() => /Оплата скоро/.test((document.querySelector('.toast') || {}).textContent || ''));
  const pay = state.calls.find(c => c.path === '/api/payments');
  ok('«Купить»: заявка с назначением и входом, «Оплата скоро»', pay && JSON.parse(pay.body.toString()).purpose === 'premium_tariff' && pay.headers.authorization === 'Bearer jwt-test');
  await page.click('.modal [data-close]');

  await page.click('#lengthSeg [data-len="short"]');
  await page.setInputFiles('#fileIn', [IMG, IMG]);
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  const call = state.calls.filter(c => c.path === '/api/check-photo').pop();
  const qs = new URLSearchParams(call.search);
  ok('проверка: одним запросом, оба фото, опции в параметрах',
    qs.getAll('img').length === 2 && qs.get('mode') === 'check' && qs.get('subject') === 'physics' && qs.get('grade') === 'true' && qs.get('length') === 'short' && !qs.has('accuracy'), call.search);
  ok('проверка: временные ссылки, JWT в заголовке', /^https:\/\/sb\.test\/sign\/u1\//.test(qs.get('img')) && call.headers.authorization === 'Bearer jwt-test');
  ok('проверка: фото сжаты в jpeg и после проверки удалены', await page.evaluate(() => __uploads.length === 2 && __uploads.every(u => u.type === 'image/jpeg') && __removed.length === 2));
  ok('разбор: цифра оценки по центру плашки (утилита сетки .g3 из sky.css не мешает)',
    await page.$eval('#result .grade', el => getComputedStyle(el).gridTemplateColumns.split(' ').length === 1));
  ok('разбор: оценка, текст оценки, обоснование', (await text(page, '#result .grade')) === '3' && /удовлетворительно/.test(await text(page, '#result .said')) && /Ошибка в ответе/.test(await text(page, '#result .said')));
  ok('разбор: ошибка с видом и исправлением', /вычислительная/.test(await text(page, '#result .err-item .kind')) && /2\+2=4/.test(await text(page, '#result .err-item .fix')));
  ok('разбор: комментарий и распознанный текст (свёрнут)', /Внимательнее/.test(await page.textContent('#result')) && await page.$('#result details .recog') !== null);
  ok('счётчик токенов внизу', /Потрачено: 150 токенов/.test(await text(page, '#tokenLine')), await text(page, '#tokenLine'));
  ok('лимит исчерпан: обратный отсчёт и кнопка неактивна',
    /следующая проверка через 0?9:5\d|10:00/.test(await text(page, '#studentMode .js-wait')) && await visible(page, '#studentMode .js-wait'), await text(page, '#studentMode .js-wait'));
  await page.setInputFiles('#fileIn', IMG);
  ok('с новым фото кнопка всё равно ждёт', await page.$eval('#checkBtn', b => b.disabled));
  const shot = await page.$eval('#studentMode .js-wait', el => el.textContent);
  await page.waitForTimeout(1200);
  ok('отсчёт идёт', shot !== await page.$eval('#studentMode .js-wait', el => el.textContent));

  /* «Проверить ещё раз» */
  await page.click('#againBtn');
  ok('«Проверить ещё раз» прячет разбор', !(await visible(page, '#resultSection')));

  /* 429 и 402 от Worker */
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next['/api/check-photo'] = { status: 429, body: { error: 'x', code: 'rate_limit', retry_after: 321 } };
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  ok('429 тарифа: сообщение с временем и отсчёт', /через 05:2\d/.test(await text(page, '#result .limit-note')) && /05:2\d/.test(await text(page, '#studentMode .js-wait')));
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next['/api/check-photo'] = { status: 402, body: { error: 'Тариф «Бесплатный»: не больше 5 фото за раз', code: 'tariff', need: 'paid' } };
  await page.click('#checkBtn');
  await page.waitForSelector('.modal .tariffs');
  ok('402: окно «Тарифы» и текст причины', /не больше 5 фото/.test(await text(page, '#result .limit-note')));
  await page.click('.modal [data-close]');
  await page.close();

  /* ========== Премиум: все опции, режим учителя ========== */
  state.plan = 'premium';
  page = await open(PAGE);
  ok('Премиум: пометки тарифа спрятаны', !(await visible(page, '#optCompare ~ .lock')) && !(await visible(page, '#optAccuracy ~ .lock')));
  await page.click('label:has(#optCompare)');
  await page.click('label:has(#optAccuracy)');
  await page.click('label:has(#optGradeText)');
  ok('Премиум: сверка и списывание включаются', await page.$eval('#optCompare', i => i.checked) && await page.$eval('#optAccuracy', i => i.checked));
  state.next['/api/check-photo'] = { status: 200, body: Object.assign({}, CHECK, { ai_solution: '2+2=4', discrepancies: 'В ответе 5 вместо 4', confidence: 92, ai_match: 40, plagiarism_flag: true, plagiarism_reason: 'ответ без хода решения', rate: { remaining: 2, retry_after: 0, reset_in: 60 } }) };
  await page.setInputFiles('#fileIn', IMG);
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  const q2 = new URLSearchParams(state.calls.filter(c => c.path === '/api/check-photo').pop().search);
  ok('Премиум: mode=compare, accuracy, grade_text в запросе', q2.get('mode') === 'compare' && q2.get('accuracy') === 'true' && q2.get('grade_text') === 'true');
  const res = await page.textContent('#result');
  ok('разбор: списывание — проценты и флаг с причиной', /92%/.test(res) && /40%/.test(res) && /Подозрение на списывание: ответ без хода решения/.test(res));
  ok('разбор: расхождения и решение ИИ', /В ответе 5 вместо 4/.test(res) && await page.$('#result details .res-text') !== null);
  if (process.env.SHOTS) await (await page.$('#resultSection')).screenshot({ path: path.join(process.env.SHOTS, 'result-premium.png') });
  ok('остался запрос в окне — кнопка не ждёт', !(await visible(page, '#studentMode .js-wait')));

  /* критерии оценивания: список уходит в Worker, он же считает итог */
  await page.click('label:has(#optCompare)');
  await page.click('label:has(#optAccuracy)');
  await page.click('label:has(#optCriteria)');
  ok('критерии: редактор открыт', await visible(page, '#critBox') && (await page.$$('#critBox .crit-row')).length === 3);
  await page.fill('#critBox .crit-row:nth-child(1) .crit-name', 'верно');
  await page.fill('#critBox .crit-row:nth-child(1) .crit-weight', '1');
  await page.fill('#critBox .crit-row:nth-child(2) .crit-name', 'оформление');
  await page.fill('#critBox .crit-row:nth-child(2) .crit-weight', '0.5');
  await page.click('#critBox .crit-row:nth-child(3) .crit-del');
  await page.fill('#critBox .crit-row:nth-child(2) .crit-name', '');
  await page.click('#critBox .crit-add');
  await page.fill('#critBox .crit-row:nth-child(3) .crit-name', 'оформление');
  await page.fill('#critBox .crit-row:nth-child(3) .crit-weight', '0.5');
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next['/api/check-photo'] = { status: 200, body: Object.assign({}, CHECK, { assessment: 4, score: 4.3,
    criteria: [{ name: 'верно', weight: 1, score: 5, comment: '' }, { name: 'оформление', weight: 0.5, score: 3, comment: 'Неаккуратно' }],
    rate: { remaining: 2, retry_after: 0, reset_in: 60 } }) };
  await page.setInputFiles('#fileIn', IMG);
  await page.click('#checkBtn');
  await page.waitForSelector('#result .crit-result');
  const q3 = new URLSearchParams(state.calls.filter(c => c.path === '/api/check-photo').pop().search);
  ok('критерии: в запросе [{name, weight}] без пустых строк', q3.get('criteria') === JSON.stringify([{ name: 'верно', weight: 1 }, { name: 'оформление', weight: 0.5 }]), q3.get('criteria'));
  ok('критерии: итог 4,3/5, оценка 4, таблица', /4,3/.test(await text(page, '#result .crit-big')) && (await text(page, '#result .crit-grade .grade')) === '4' &&
    (await page.$$('#result .crit-table tbody tr')).length === 2 && /Неаккуратно/.test(await page.textContent('#result .crit-table')));
  ok('критерии: квадрат оценки не дублируется', !(await page.$('#result .gradebox')));
  await page.click('label:has(#optCriteria)');
  const q4 = await (async () => {
    await page.evaluate(() => SkyCheck.setWait(0));
    state.next['/api/check-photo'] = { status: 200, body: Object.assign({}, CHECK, { rate: { remaining: 2, retry_after: 0, reset_in: 60 } }) };
    await page.setInputFiles('#fileIn', IMG);
    await page.click('#againBtn');
    await page.click('#checkBtn');
    await page.waitForSelector('#againBtn');
    return new URLSearchParams(state.calls.filter(c => c.path === '/api/check-photo').pop().search);
  })();
  ok('критерии выключены — параметра нет', !q4.has('criteria'));

  await page.click('#roleSeg [data-role="teacher"]');
  ok('режим учителя: вкладки, замка нет', await visible(page, '#teacherMode') && !(await visible(page, '#studentMode')) && !(await visible(page, '#tLock')));

  /* А) класс */
  await page.setInputFiles('#cFiles', [IMG, IMG, IMG]);
  const rows = await page.$$('#cRoster .roster-row');
  await rows[0].$('input[data-k="name"]').then(i => i.fill('Иванов Иван'));
  await page.fill('#cClass', '9А');
  await page.click('label:has(#cCriteria)');
  ok('класс: галочка критериев подтягивает сохранённый набор', (await page.$$('#cCritBox .crit-row')).length === 2 &&
    await page.$eval('#cCritBox .crit-row:nth-child(2) .crit-name', i => i.value) === 'оформление');
  await page.click('#cRun');
  await page.waitForSelector('#cResult .rtable');
  const rep = state.calls.filter(c => c.path === '/api/check-teacher-report').pop();
  const repBody = JSON.parse(rep.body.toString());
  ok('класс: 3 фото, ФИО из поля, класс «для всех», поток прогресса',
    repBody.photos.length === 3 && repBody.photos[0].name === 'Иванов Иван' && repBody.photos[2].class === '9А' && /ndjson/.test(rep.headers.accept) && repBody.grade === true);
  ok('класс: критерии в запросе', JSON.stringify(repBody.criteria) === JSON.stringify([{ name: 'верно', weight: 1 }, { name: 'оформление', weight: 0.5 }]));
  ok('класс: столбец «Балл» 4,3 и таблица критериев в строке', /Балл/.test(await text(page, '#cResult thead')) && /4,3/.test(await text(page, '#cResult tbody tr:first-child')) &&
    (await page.$$('#cResult tbody .crit-table')).length === 2);
  ok('класс: таблица, сбой строки помечен, средний балл', (await page.$$('#cResult .rtable > tbody > tr')).length === 3 && (await page.$$('#cResult tr.failed')).length === 1 && /4,5/.test(await text(page, '#cResult .stat.accent b')));
  if (process.env.SHOTS) await (await page.$('#tab-class')).screenshot({ path: path.join(process.env.SHOTS, 'class-report.png') });
  const dl = page.waitForEvent('download');
  await page.click('#cCsv');
  ok('класс: «Скачать CSV»', (await dl).suggestedFilename() === 'skyschool-class.csv');

  /* Б) тест */
  await page.click('#tTabs [data-tab="test"]');
  await page.setInputFiles('#tRefFile', IMG);
  await page.setInputFiles('#tFiles', [IMG, IMG]);
  await page.fill('#tTotal', '20');
  await page.click('#tRun');
  await page.waitForSelector('#tResult .rtable');
  const tb = JSON.parse(state.calls.filter(c => c.path === '/api/check-test').pop().body.toString());
  ok('тест: эталон отдельно, 2 работы, всего 20', /^https:\/\/sb\.test\/sign\//.test(tb.reference_img) && tb.student_imgs.length === 2 && tb.total === 20);
  ok('тест: таблица «верно/всего» и %', /8\/20/.test(await page.textContent('#tResult')) && /80%/.test(await page.textContent('#tResult')));

  /* В) по ссылкам: ученик */
  await page.click('#tTabs [data-tab="links"]');
  await page.fill('#lName', 'Петров Пётр');
  await page.fill('#lClass', '9Б');
  await page.setInputFiles('#lFile', IMG);
  await page.click('#lSend');
  await page.waitForSelector('#lOut:not(.hidden)');
  const sub = state.calls.filter(c => c.path === '/api/submit-homework').pop();
  const sq = new URLSearchParams(sub.search);
  ok('отправка работы: картинка телом (jpeg), ФИО и класс в запросе',
    sub.headers['content-type'] === 'image/jpeg' && sub.body[0] === 0xff && sub.body[1] === 0xd8 && sq.get('student_name') === 'Петров Пётр' && sq.get('class') === '9Б');
  ok('отправка работы: ссылка для учителя', (await page.$eval('#lUrl', i => i.value)).endsWith('?hw=' + HW_ID));

  /* В) по ссылкам: учитель */
  await page.fill('#lLinks', 'https://news92-tg.github.io/skyschool/photo.html?hw=' + HW_ID + '\nмусор\nhttps://x/photo.html?hw=11111111-2222-3333-4444-555555555555');
  await page.click('#lResolve');
  await page.waitForFunction(() => document.querySelectorAll('#lList .roster-row').length === 2);
  ok('ссылки: работа открыта, чужая ссылка — «не найдена»', /Петров Пётр, 9Б/.test(await page.textContent('#lList')) && /не найдена/.test(await page.textContent('#lList')));
  ok('ссылки: предмет взят из работы', (await page.$eval('#lCheckSubject', s => s.value)) === 'algebra');
  await page.click('#lRun');
  await page.waitForSelector('#lResult .rtable');
  const lb = JSON.parse(state.calls.filter(c => c.path === '/api/check-teacher-report').pop().body.toString());
  ok('ссылки: в отчёт ушли только найденные работы с submission_id', lb.photos.length === 1 && lb.photos[0].submission_id === HW_ID && lb.photos[0].img === 'https://sb.test/sign/sub.jpg?token=t');
  ok('ссылки: статус работы обновился', /проверена/.test(await page.textContent('#lList')));
  /* 150 (ученик) + 2 × 150 (проверки с критериями и без) + 390 (класс) + 15 (тест) + 390 (ссылки) */
  ok('токены за сессию сложились', /Потрачено: 1\s?245 токенов \(~0 ₽\)/.test(await text(page, '#tokenLine')), await text(page, '#tokenLine'));
  await page.close();

  /* ========== ссылка ?hw= и замок учителя на Бесплатном ========== */
  state.plan = 'free';
  page = await open(PAGE + '?hw=' + HW_ID);
  await page.waitForFunction(() => document.querySelectorAll('#lList .roster-row').length === 1);
  ok('?hw=: сразу учитель, вкладка ссылок, работа открыта', await visible(page, '#tab-links') && /Петров Пётр/.test(await page.textContent('#lList')));
  ok('Бесплатный: замок учителя с кнопкой тарифов', await visible(page, '#tLock'));
  await page.click('#lRun');
  await page.waitForSelector('.modal .tariffs');
  ok('Бесплатный: «Проверить все» открывает «Тарифы» на Премиум', /Премиум/.test(await text(page, '.tf-card.focus .tf-head')));
  await page.close();

  /* ========== ученик: вкладка «Текст» (сочинение) ========== */
  state.plan = 'free';
  page = await open(PAGE);
  await page.click('#roleSeg [data-role="student"]');       /* выше страницу оставили в режиме учителя */
  ok('текст: по умолчанию открыта вкладка «Фото»', await visible(page, '#photoTab') && !(await visible(page, '#textTab')));
  await page.click('#kindSeg [data-kind="text"]');
  ok('текст: вкладка «Текст» — форма видна, фото спрятано', await visible(page, '#textTab') && !(await visible(page, '#photoTab')) &&
    (await page.$eval('#kindSeg [data-kind="text"]', b => b.getAttribute('aria-pressed'))) === 'true');
  ok('текст: поле до 8000 символов, счётчик 0 / 8 000', (await page.$eval('#xText', t => t.maxLength)) === 8000 && /^0 \/ 8\s000$/.test(await text(page, '#xCount')), await text(page, '#xCount'));
  ok('текст: три предмета, русский по умолчанию', (await page.$$eval('#xSubjRow .subj-btn', bs => bs.map(b => b.textContent).join())) === 'Русский,Английский,Литература' &&
    (await text(page, '#xSubjRow .subj-btn.active')) === 'Русский');
  ok('текст: подробно, критерии и оценка включены', (await page.$eval('#xLengthSeg [data-len="long"]', b => b.getAttribute('aria-pressed'))) === 'true' &&
    await page.$eval('#xCriteria', i => i.checked && !i.disabled) && await page.$eval('#xGrade', i => i.checked));
  ok('текст: пустое поле — кнопка неактивна', await page.$eval('#xCheck', b => b.disabled));
  ok('текст: строка лимита текста по тарифу', (await text(page, '#xPlanLine')) === 'Текст по тарифу «Бесплатный»: 1 запрос / 5 мин', await text(page, '#xPlanLine'));
  await page.click('#xLengthSeg [data-len="short"]');
  ok('текст: «Коротко» — критерии недоступны, темы нет', await page.$eval('#xCriteria', i => i.disabled) && !(await visible(page, '#xTopicField')));
  await page.click('#xLengthSeg [data-len="long"]');
  const essayText = 'Я думаю что осень — лучшее время года.\nЛистья жёлтые.';
  await page.fill('#xText', essayText);
  await page.fill('#xTopic', 'Моё любимое время года');
  await page.click('#xSubjRow [data-subject="literature"]');
  ok('текст: счётчик считает', (await text(page, '#xCount')).startsWith(essayText.length + ' / '));
  state.textDelay = 700;
  await page.click('#xCheck');
  await page.waitForFunction(() => /Проверяю/.test(document.querySelector('#xCheck').textContent));
  ok('текст: пока идёт проверка — «Проверяю...», кнопка неактивна, «5-15 секунд»', await page.$eval('#xCheck', b => b.disabled) &&
    await visible(page, '#xProgress') && /Идёт проверка, это займёт 5-15 секунд/.test(await text(page, '#xProgress .progress-text')));
  await page.waitForSelector('#xAgain');
  state.textDelay = 0;
  const tcall = state.calls.filter(c => c.path === '/api/check-text').pop();
  const tbody = JSON.parse(tcall.body.toString());
  ok('текст: POST JSON с текстом и настройками, вход в заголовке', tcall.method === 'POST' && !tcall.search && tbody.text === essayText && tbody.subject === 'literature' &&
    tbody.length === 'long' && tbody.criteria === true && tbody.grade === true && tbody.topic === 'Моё любимое время года' && tcall.headers.authorization === 'Bearer jwt-test', JSON.stringify(tbody));
  ok('текст: адрес Worker из AI_BASE_ORDERS', await page.evaluate(() => Sky.cfg.AI_BASE_ORDERS === 'https://news92-orders.almazpro0927.workers.dev/'));
  ok('текст: кнопка вернулась в обычный вид', (await text(page, '#xCheck')) === 'Проверить' && !(await visible(page, '#xProgress')));
  ok('текст: оценка', (await text(page, '#xResult .grade')) === '4');
  ok('текст: таблица критериев — 6 строк с баллами', (await page.$$('#xResult table.crit tr')).length === 6 &&
    /Логика и связность/.test(await page.textContent('#xResult .crit')) && (await page.$$eval('#xResult .crit-v', t => t.map(x => x.textContent).join())) === '5/5,4/5,4/5,3/5,4/5,5/5');
  ok('текст: полоса балла по ширине', (await page.$eval('#xResult .crit tr:nth-child(4) .crit-bar i', i => i.style.width)) === '60%');
  ok('текст: ошибка и исправление, комментарий', /Я думаю, что/.test(await text(page, '#xResult .err-item .fix')) && /добавьте примеры/.test(await page.textContent('#xResult')));
  ok('текст: токены — в разборе и в счётчике', /ушло токенов: 1000/.test(await page.textContent('#xResult')) && /Потрачено: 1\s000 токенов/.test(await text(page, '#tokenLine')), await text(page, '#tokenLine'));
  ok('текст: лимит исчерпан — отсчёт 05:00 и кнопка ждёт', /через 0[45]:\d\d/.test(await text(page, '#xWait')) && await page.$eval('#xCheck', b => b.disabled), await text(page, '#xWait'));
  ok('текст: отсчёт текста не трогает лимит фото', await page.evaluate(() => SkyCheck.canRequest()));
  await page.click('#xAgain');
  ok('текст: «Проверить ещё раз» — разбор спрятан, текст на месте', !(await visible(page, '#xResultSec')) && (await page.$eval('#xText', t => t.value)) === essayText);

  await page.evaluate(() => { document.querySelector('#xWait').classList.add('hidden'); });
  await page.evaluate(() => SkyCheck.loadLimits());                   /* новый ответ /api/limits — окно свободно */
  await page.waitForFunction(() => !document.querySelector('#xCheck').disabled);
  state.next['/api/check-text'] = { status: 429, body: { error: 'Лимит Groq, подождите', code: 'groq_limit', retry_after: 2 } };
  await page.click('#xCheck');
  await page.waitForSelector('#xAgain');
  ok('текст: 429 Groq — «Лимит Groq, подождите»', (await text(page, '#xResult .limit-note')) === 'Лимит Groq, подождите' && !(await visible(page, '#xResult .grade')));
  state.next['/api/check-text'] = { status: 400, body: { error: 'Текст слишком длинный, разбейте на части', code: 'too_long' } };
  await page.click('#xCheck');
  await page.waitForFunction(() => /разбейте/.test((document.querySelector('#xResult .limit-note') || {}).textContent || ''));
  ok('текст: 400 — «Текст слишком длинный, разбейте на части»', true);
  state.next['/api/check-text'] = { status: 429, body: { error: 'x', code: 'rate_limit', retry_after: 200 } };
  await page.click('#xCheck');
  await page.waitForFunction(() => /03:[12]\d/.test(document.querySelector('#xWait').textContent));
  ok('текст: 429 тарифа — отсчёт по retry_after', /следующая проверка через 03:[12]\d/.test(await text(page, '#xResult .limit-note')));
  await page.evaluate(() => SkyCheck.loadLimits());
  await page.waitForFunction(() => !document.querySelector('#xCheck').disabled);
  state.next['/api/check-text'] = { status: 200, body: Object.assign({}, TEXT, { cached: true, tokens_used: { prompt: 0, completion: 0, total: 0 },
    criteria: { topic_match: 0, argumentation: null, composition: null, logic: null, spelling: null, grammar: null }, rate: { remaining: 1, retry_after: 0, reset_in: 60 } }) };
  await page.click('#xCheck');
  await page.waitForSelector('#xResult .crit');
  ok('текст: из кэша — пометка, токены не потрачены', /уже проверяли за последние 7 дней/.test(await page.textContent('#xResult')) && !/ушло токенов/.test(await page.textContent('#xResult')));
  ok('текст: не по теме — пометка и прочерки', /не по теме/.test(await text(page, '#xResult .flag.warn')) && (await page.$$eval('#xResult .crit-v', t => t.filter(x => x.textContent === '—').length)) === 5);

  await page.uncheck('#xCriteria');
  await page.uncheck('#xGrade');
  state.next['/api/check-text'] = { status: 200, body: { subject: 'russian', length: 'long', errors: [], comment: 'Ок', cached: false, tokens_used: TEXT.tokens_used, plan: 'free', rate: { remaining: 1 } } };
  await page.click('#xCheck');
  await page.waitForFunction(() => /Ошибок не нашлось/.test(document.querySelector('#xResult').textContent));
  const tb2 = JSON.parse(state.calls.filter(c => c.path === '/api/check-text').pop().body.toString());
  ok('текст: без критериев и оценки — так и уходит, и не показывается', tb2.criteria === false && tb2.grade === false && !(await page.$('#xResult .crit')) && !(await page.$('#xResult .grade')));

  await page.evaluate(() => Sky.setLang('en'));
  ok('текст: английский интерфейс', (await text(page, '#kindSeg [data-kind="text"]')) === 'Text' && (await text(page, '#xCheck')) === 'Check' &&
    (await page.$eval('#xText', t => t.placeholder)).startsWith('Paste or type') && (await text(page, '#xSubjRow .subj-btn')) === 'Russian');
  await page.evaluate(() => Sky.setLang('ru'));
  await page.close();

  page = await open(PAGE);
  ok('текст: выбранная вкладка и настройки запоминаются', await visible(page, '#textTab') && (await text(page, '#xSubjRow .subj-btn.active')) === 'Литература' &&
    !(await page.$eval('#xCriteria', i => i.checked)));
  await page.close();
  page = await open(PAGE + '?kind=photo');
  ok('текст: ?kind=photo открывает фото', await visible(page, '#photoTab'));
  await page.close();
  page = await open(PAGE + '?kind=text', { width: 390, height: 844 });
  await page.fill('#xText', 'Короткий текст.');
  await page.click('#xCheck');
  await page.waitForSelector('#xResult .crit');
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('текст: телефон 390 px — не шире экрана, с таблицей критериев', overflowX <= 0, String(overflowX));
  if (process.env.SHOTS) await page.screenshot({ path: path.join(process.env.SHOTS, 'text-phone.png'), fullPage: true });
  await page.close();

  /* ========== тариф из админки (Family) ========== */
  state.plan = 'family';
  page = await open(PAGE);
  await page.waitForFunction(() => /Family/.test(document.querySelector('#planChip').textContent));
  ok('Family из админки: название, цвет как у Премиум, до 20 фото', (await text(page, '#planChip')) === 'Тариф: Family' &&
    await page.$eval('#planChip', el => el.classList.contains('teach')) && /до 20 фото/.test(await text(page, '#planLimit')));
  await page.click('#roleSeg [data-role="teacher"]');
  ok('Family: режим учителя открыт', !(await visible(page, '#tLock')));
  await page.click('#roleSeg [data-role="student"]');
  await page.close();
  state.plan = 'free';

  /* ========== телефон ========== */
  page = await open(PAGE, { width: 390, height: 844 });
  const overflowS = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.click('#roleSeg [data-role="teacher"]');
  await page.setInputFiles('#cFiles', [IMG, IMG]);
  const overflowT = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('телефон 390 px: страница не шире экрана (ученик и учитель)', overflowS <= 0 && overflowT <= 0, `ученик ${overflowS}, учитель ${overflowT}`);
  if (process.env.SHOTS) {
    await page.screenshot({ path: path.join(process.env.SHOTS, 'teacher-phone.png'), fullPage: true });
    await page.click('#roleSeg [data-role="student"]');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(process.env.SHOTS, 'student-phone.png'), fullPage: true });
    await page.click('#planBtn');
    await page.waitForSelector('.modal .tariffs');
    await page.waitForTimeout(500);           /* окно появляется с анимацией */
    await page.screenshot({ path: path.join(process.env.SHOTS, 'tariffs-phone.png') });
  }
  await page.close();

  ok('ошибок JavaScript на странице нет', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
