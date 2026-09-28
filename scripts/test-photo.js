/* ============================================================
   «Домашка по фото» в настоящем браузере: ученик, учитель, тарифы.

   Запуск:  node scripts/test-photo.js

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
  free:    { plan: 'free', title: 'Бесплатный', price_rub: 0, limits: { requests: 1, window_seconds: 600, photos: 5 }, features: { compare: false, teacher: false, plagiarism: false } },
  premium: { plan: 'premium', title: 'Премиум', price_rub: 209, limits: { requests: 3, window_seconds: 60, photos: 20 }, features: { compare: true, teacher: true, plagiarism: true } }
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
  const state = { plan: 'free', next: {}, calls: [] };
  await ctx.route(WORKER + '/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    state.calls.push({ method: req.method(), path: url.pathname, search: url.search, headers: req.headers(), body: req.postDataBuffer() });
    const reply = (status, body, type) => route.fulfill({
      status, contentType: type || 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
    const custom = state.next[url.pathname];
    if (custom) { delete state.next[url.pathname]; return reply(custom.status, custom.body, custom.type); }
    if (url.pathname === '/api/limits') {
      return reply(200, Object.assign({}, PLANS[state.plan], { user: true, rate: { allowed: true, remaining: PLANS[state.plan].limits.requests, retry_after: 0, reset_in: 0 } }));
    }
    if (url.pathname === '/api/check-photo') return reply(200, CHECK);
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
        : { index: i + 1, name: p.name || 'Сидоров С.', class: p.class, assessment: 5 - i % 2, assessment_reason: 'ок', errors_count: 1,
            errors: [{ type: 'орфография', fragment: 'малоко', correction: 'молоко' }], comment: 'Хорошо', status: 'ok', submission_id: p.submission_id });
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
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next['/api/check-photo'] = { status: 200, body: { choices: [{ message: { content: '<|begin_of_box|>### Ошибки\n- мало\n\n**Оценка: 4**<|end_of_box|>' } }] } };
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  ok('старый Worker (ответ Z.AI как есть) — разбор текстом с оценкой', (await text(page, '#result .grade')) === '4' && /Ошибки/.test(await text(page, '#result .hw-text')));
  await page.evaluate(() => SkyCheck.setWait(0));
  state.next['/api/check-photo'] = { status: 200, body: { error: { code: '1302', message: 'rate' } } };
  await page.click('#againBtn');
  await page.setInputFiles('#fileIn', IMG);
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  ok('старый Worker, ошибка Z.AI в теле — «лимит Z.AI»', /лимит Z\.AI/.test(await text(page, '#result .limit-note')));
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

  await page.click('#roleSeg [data-role="teacher"]');
  ok('режим учителя: вкладки, замка нет', await visible(page, '#teacherMode') && !(await visible(page, '#studentMode')) && !(await visible(page, '#tLock')));

  /* А) класс */
  await page.setInputFiles('#cFiles', [IMG, IMG, IMG]);
  const rows = await page.$$('#cRoster .roster-row');
  await rows[0].$('input[data-k="name"]').then(i => i.fill('Иванов Иван'));
  await page.fill('#cClass', '9А');
  await page.click('#cRun');
  await page.waitForSelector('#cResult .rtable');
  const rep = state.calls.filter(c => c.path === '/api/check-teacher-report').pop();
  const repBody = JSON.parse(rep.body.toString());
  ok('класс: 3 фото, ФИО из поля, класс «для всех», поток прогресса',
    repBody.photos.length === 3 && repBody.photos[0].name === 'Иванов Иван' && repBody.photos[2].class === '9А' && /ndjson/.test(rep.headers.accept) && repBody.grade === true);
  ok('класс: таблица, сбой строки помечен, средний балл', (await page.$$('#cResult tbody tr')).length === 3 && (await page.$$('#cResult tr.failed')).length === 1 && /4,5/.test(await text(page, '#cResult .stat.accent b')));
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
  /* 150 (ученик) + 390 (класс) + 15 (тест) + 390 (ссылки) */
  ok('токены за сессию сложились', /Потрачено: 945 токенов \(~0 ₽\)/.test(await text(page, '#tokenLine')), await text(page, '#tokenLine'));
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
