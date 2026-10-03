/* ============================================================
   «Домашка по фото» и «Проверка сочинения» в настоящем браузере,
   когда по адресу news92-orders стоит ПРЕЖНИЙ Worker (worker/worker.js,
   GET /health без /api/… в списке). Запросы — такие, как он принимает:

     POST /check-photo  { imageBase64, mime, subject, taskText, lang, teacher, strictness }
     POST /grade-essay  { text, topic, subject, kind, criteria, lang, teacher, strictness }

   Только POST с JSON, без заголовка Authorization (CORS Worker его не
   пропускает), и ни одного запроса на /api/… — таких адресов у Worker нет.

   Запуск:  node scripts/test-photo.js
   С новым Worker (worker/news92-orders.js) — scripts/test-photo-orders.js.

   Worker подменён: ответы собираются здесь, в тесте. Supabase
   недоступен (страница уходит в локальный режим).
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'photo.html');
const ESSAY = 'file://' + path.join(ROOT, 'essay.html');
const IMG = path.join(ROOT, 'assets', 'icon-192.png');
const WORKER = 'https://news92-orders.almazpro0927.workers.dev';

/* ответы — в форме handlePhoto / handleEssay из worker/worker.js */
const PHOTO = n => ({
  recognized_text: 'Фото ' + n + ': 2+2=5', grade: 3,
  correct_parts: ['Условие записано верно'],
  errors: [{ fragment: '2+2=5', explanation: 'Ошибка в сложении', fix: '2+2=4' }],
  overall_feedback: 'Внимательнее со сложением.', next_step: 'Повтори таблицу сложения.', quota: null
});
const ESSAY_RES = {
  grade: 4,
  criteria: [{ name: 'Соответствие теме', score: 5, comment: 'Тема раскрыта' }, { name: 'Аргументация с примерами', score: 3, comment: 'Мало примеров' }],
  strengths: ['Живой язык'],
  issues: [{ quote: 'Я думаю что', problem: 'Нет запятой', why: 'Придаточное отделяется запятой' }],
  overall_feedback: 'Хорошая работа.', next_step: 'Добавьте примеры.'
};

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: 'ru-RU', viewport: { width: 1100, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());

  /* ---------- подменённый Worker ---------- */
  const state = { queue: {}, calls: [], delay: 0 };
  await ctx.route(WORKER + '/**', async route => {
    const req = route.request();
    const url = new URL(req.url());
    let body = null;
    try { body = JSON.parse(req.postData() || 'null'); } catch (e) {}
    state.calls.push({ method: req.method(), path: url.pathname, search: url.search, headers: req.headers(), body });
    const reply = (status, data) => route.fulfill({
      status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(data)
    });
    if (url.pathname === '/health') {
      return reply(200, { ok: true, service: 'skyschool-ai', endpoints: ['/explain', '/check-photo', '/check-homework', '/chess-explain', '/grade-essay'] });
    }
    if (state.delay) await new Promise(r => setTimeout(r, state.delay));
    if (req.method() !== 'POST') return reply(405, { error: 'use POST' });
    const q = state.queue[url.pathname];
    if (q && q.length) { const next = q.shift(); return reply(next.status, next.body); }
    if (url.pathname === '/check-photo') return reply(200, PHOTO(state.calls.filter(c => c.path === '/check-photo').length));
    if (url.pathname === '/grade-essay') return reply(200, ESSAY_RES);
    return reply(404, { error: 'not found' });
  });
  const push = (p, status, body) => { (state.queue[p] = state.queue[p] || []).push({ status, body }); };

  const errors = [];
  async function open(url, viewport) {
    const page = await ctx.newPage();
    if (viewport) await page.setViewportSize(viewport);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|service ?worker/i.test(m.text())) errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.Sky && Sky.db);
    /* «вход»: у ученика есть токен — он НЕ должен уйти в Worker */
    await page.evaluate(() => {
      Sky.db.token = async () => 'jwt-test';
      Sky.db.me = () => ({ id: 'u1', name: 'Тест', role: 'student' });
    });
    return page;
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, el => !el.classList.contains('hidden') && el.offsetParent !== null).catch(() => false);
  const calls = p => state.calls.filter(c => c.path === p);

  /* ========== ученик: фото ========== */
  let page = await open(PAGE);
  await page.waitForFunction(() => window.SkyCheck && SkyCheck.limits);
  ok('строка тарифа без запроса к серверу: 1 запрос / 30 с, до 5 фото',
    (await text(page, '#planChip')) === 'Тариф: Бесплатный' && (await text(page, '#planLimit')) === '1 запрос / 30 с · до 5 фото', await text(page, '#planLimit'));
  const raw = await page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-ph]')]
    .filter(el => el.dataset.i18n ? el.textContent.trim() === el.dataset.i18n : el.placeholder === el.dataset.i18nPh)
    .map(el => el.dataset.i18n || el.dataset.i18nPh));
  ok('все подписи переведены', !raw.length, raw.join(', '));
  ok('9 предметов (8 + «Другое»)', (await page.$$('#subjRow .subj-btn')).length === 9);

  await page.click('#planBtn');
  await page.waitForSelector('.modal .tariffs');
  await page.click('.tf-card [data-buy="premium_tariff"]');
  await page.waitForFunction(() => /Оплата скоро/.test((document.querySelector('.toast') || {}).textContent || ''));
  ok('Worker опознан по /health как прежний', await page.evaluate(() => SkyCheck.mode()) === 'legacy');
  ok('«Купить» — «Оплата скоро», без запроса к Worker', state.calls.every(c => c.path === '/health'));
  await page.click('.modal [data-close]');

  await page.fill('#taskText', '№ 5');
  await page.setInputFiles('#fileIn', [IMG, IMG]);
  push('/check-photo', 200, PHOTO(1));
  push('/check-photo', 429, { error: 'Следующая проверка фото будет доступна через 2 сек.', reason: 'rate', waitSec: 2, anonymous: true });
  state.delay = 300;
  await page.click('#checkBtn');
  await page.waitForFunction(() => /Проверяю/.test(document.querySelector('#checkBtn').textContent));
  ok('идёт проверка: «Проверяю...», кнопка неактивна', await page.$eval('#checkBtn', b => b.disabled));
  await page.waitForFunction(() => /сервер примет его через/.test((document.querySelector('#progressText') || {}).textContent || ''));
  ok('Worker просит подождать — отсчёт до следующего фото', /Фото 2 из 2: сервер примет его через \d с/.test(await text(page, '#progressText')), await text(page, '#progressText'));
  await page.waitForSelector('#againBtn', { timeout: 15000 });
  state.delay = 0;
  const cp = calls('/check-photo');
  ok('POST /check-photo: по запросу на фото (+1 повтор после «подождите»)', cp.length === 3 && cp.every(c => c.method === 'POST' && !c.search), cp.map(c => c.method).join());
  const b0 = cp[0].body || {};
  ok('тело JSON: imageBase64 (jpeg), mime, subject, taskText, lang, strictness',
    /^data:image\/jpeg;base64,/.test(b0.imageBase64) && b0.mime === 'image/jpeg' && b0.subject === 'Физика' && b0.taskText === '№ 5' &&
    b0.lang === 'ru' && b0.strictness === 3 && cp[0].headers['content-type'] === 'application/json', JSON.stringify(Object.assign({}, b0, { imageBase64: String(b0.imageBase64).slice(0, 30) })));
  ok('фото сжато под лимит Worker (до 1100 КБ)', cp.every(c => c.body.imageBase64.length * 0.75 <= 1100 * 1024));
  ok('без Authorization (CORS Worker его не пропускает)', state.calls.every(c => !c.headers.authorization));

  const res = await page.textContent('#result');
  ok('разбор по каждому фото', (await page.$$('#result .part-h')).length === 2 && /Фото 1/.test(res) && /Фото 2/.test(res));
  ok('оценка, что верно, ошибка с объяснением и исправлением',
    (await text(page, '#result .grade')) === '3' && /Условие записано верно/.test(res) && /Ошибка в сложении/.test(res) && /Как надо: 2\+2=4/.test(res));
  ok('комментарий, «что дальше», распознанный текст', /Внимательнее со сложением/.test(res) && /Повтори таблицу сложения/.test(res) && (await page.$$('#result .recog-box .recog')).length === 2 && !(await page.$('#result details .recog')));
  ok('после проверки — ждать 30 с, кнопка ждёт', /через 00:(29|30)/.test(await text(page, '#studentMode .js-wait')) && await visible(page, '#studentMode .js-wait'));

  await page.click('#againBtn');
  ok('«Проверить ещё раз» прячет разбор', !(await visible(page, '#resultSection')));

  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('label:has(#optGrade)');                 /* оценку не просим */
  push('/check-photo', 500, { error: 'Не задан ключ для распознавания фото. Выполните: npx wrangler secret put GLM_API_KEY' });
  await page.setInputFiles('#fileIn', IMG);
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  ok('ошибка Worker — его текст', /Не задан ключ для распознавания фото/.test(await text(page, '#result .limit-note')));
  push('/check-photo', 429, { error: 'Следующая проверка фото будет доступна через 100 сек.', reason: 'rate', waitSec: 100 });
  await page.click('#checkBtn');
  await page.waitForFunction(() => /01:(39|40)/.test((document.querySelector('#result .limit-note') || {}).textContent || ''));
  ok('долгое «подождите» — без повтора, отсчёт на кнопке', /01:(39|40)/.test(await text(page, '#studentMode .js-wait')) && calls('/check-photo').length === 5);
  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('#checkBtn');
  await page.waitForSelector('#result .part-h, #result .err-item');
  ok('«Выставить оценку» снята — оценки нет', !(await page.$('#result .grade')));
  await page.click('label:has(#optGrade)');

  /* критерии: прежний Worker их не знает — текст с фото уходит в /grade-essay,
     итог и оценку страница считает сама по формуле */
  await page.evaluate(() => SkyCheck.setWait(0));
  await page.click('label:has(#optCriteria)');
  ok('критерии: редактор открыт, шаблон «Задачи» — 3 критерия', await visible(page, '#critBox') && (await page.$$('#critBox .crit-row')).length === 3);
  await page.selectOption('#critBox .crit-preset', 'essay');
  ok('критерии: шаблон «Сочинение» — 4 критерия', (await page.$$('#critBox .crit-row')).length === 4);
  await page.fill('#critBox .crit-row:nth-child(1) .crit-name', 'Соответствие теме');
  await page.fill('#critBox .crit-row:nth-child(1) .crit-weight', '1');
  await page.fill('#critBox .crit-row:nth-child(2) .crit-name', 'Аргументация с примерами');
  await page.fill('#critBox .crit-row:nth-child(2) .crit-weight', '0,5');
  await page.click('#critBox .crit-row:nth-child(4) .crit-del');
  await page.click('#critBox .crit-row:nth-child(3) .crit-del');
  ok('критерии: удаление строк', (await page.$$('#critBox .crit-row')).length === 2);
  const essaysBefore = calls('/grade-essay').length;
  await page.setInputFiles('#fileIn', IMG);
  await page.click('#checkBtn');
  await page.waitForSelector('#result .crit-result', { timeout: 15000 });
  const ge0 = calls('/grade-essay').pop();
  ok('критерии: после фото — POST /grade-essay с текстом с фото и нашими критериями',
    calls('/grade-essay').length === essaysBefore + 1 && /2\+2=5/.test(ge0.body.text) &&
    JSON.stringify(ge0.body.criteria) === JSON.stringify(['Соответствие теме', 'Аргументация с примерами']), JSON.stringify(ge0.body));
  /* 5 и 3 с весами 1 и 0,5: (5 + 1,5) / 1,5 = 4,33 → 4,3 → 4 */
  ok('критерии: итог 4,3/5 и оценка 4 — по формуле', /4,3/.test(await text(page, '#result .crit-big')) && (await text(page, '#result .crit-grade .grade')) === '4',
    await text(page, '#result .crit-total'));
  ok('критерии: таблица — вес, балл, комментарий', (await page.$$('#result .crit-table tbody tr')).length === 2 &&
    /0,5/.test(await page.textContent('#result .crit-table')) && /Мало примеров/.test(await page.textContent('#result .crit-table')));
  ok('критерии: набор сохранён в браузере', await page.evaluate(() => Sky.get('gradeCriteria').length === 2 && Sky.get('gradeCriteria')[1].weight === 0.5 && Sky.get('hwOpts').criteria === true));
  await page.evaluate(() => SkyCheck.setWait(0));
  push('/grade-essay', 429, { error: 'Слишком много запросов подряд. Подождите минуту.' });
  await page.setInputFiles('#fileIn', IMG);
  await page.click('#checkBtn');
  await page.waitForSelector('#againBtn');
  ok('критерии: сбой /grade-essay — разбор фото есть, про критерии честная строка',
    /Оценить по критериям не удалось/.test(await text(page, '#result .limit-note')) && (await page.$$('#result .err-item')).length > 0);
  await page.click('label:has(#optCriteria)');
  await page.evaluate(() => SkyCheck.setWait(0));

  /* режим учителя: у Worker нет этих адресов — запросов нет */
  const before = state.calls.length;
  await page.click('#roleSeg [data-role="teacher"]');
  await page.click('#tTabs [data-tab="links"]');
  await page.fill('#lName', 'Петров');
  await page.setInputFiles('#lFile', IMG);
  await page.click('#lSend');
  await page.waitForFunction(() => /нет в Worker/.test((document.querySelector('.toast') || {}).textContent || '') ||
    /нет в Worker/.test(document.querySelector('#teacherMode').textContent));
  ok('режим учителя: «функции пока нет», запросов к Worker нет', state.calls.length === before);
  await page.click('#roleSeg [data-role="student"]');
  await page.close();

  /* ========== ученик: вкладка «Текст» → /grade-essay ========== */
  page = await open(PAGE);
  await page.click('#kindSeg [data-kind="text"]');
  ok('вкладка «Текст»: форма, счётчик 0 / 8 000', await visible(page, '#textTab') && /^0 \/ 8\s000$/.test(await text(page, '#xCount')));
  const essayText = 'Я думаю что осень — лучшее время года.\nЛистья жёлтые.';
  await page.fill('#xText', essayText);
  await page.fill('#xTopic', 'Моё любимое время года');
  await page.click('#xSubjRow [data-subject="literature"]');
  state.delay = 500;
  await page.click('#xCheck');
  await page.waitForFunction(() => /Проверяю/.test(document.querySelector('#xCheck').textContent));
  ok('текст: «Проверяю...» и «5-15 секунд»', await page.$eval('#xCheck', b => b.disabled) && /5-15 секунд/.test(await text(page, '#xProgress .progress-text')));
  await page.waitForSelector('#xAgain');
  state.delay = 0;
  const ge = calls('/grade-essay').pop();
  const gb = ge.body || {};
  ok('POST /grade-essay: text, topic, subject, kind, criteria, lang, strictness',
    ge.method === 'POST' && gb.text === essayText && gb.topic === 'Моё любимое время года' && gb.subject === 'литература' && gb.kind === 'сочинение' &&
    Array.isArray(gb.criteria) && gb.criteria.length === 6 && gb.criteria[0] === 'Соответствие теме' && gb.lang === 'ru' && gb.strictness === 3, JSON.stringify(gb));
  ok('текст: без Authorization', !ge.headers.authorization);
  const xr = await page.textContent('#xResult');
  ok('текст: оценка из grade', (await text(page, '#xResult .grade')) === '4');
  ok('текст: критерии из ответа — название, балл, комментарий', (await page.$$('#xResult table.crit tr')).length === 2 &&
    (await page.$$eval('#xResult .crit-v', t => t.map(x => x.textContent).join())) === '5/5,3/5' && /Мало примеров/.test(xr));
  ok('текст: сильные стороны, замечание (цитата, проблема, почему), вывод, шаг',
    /Живой язык/.test(xr) && /Я думаю что/.test(xr) && /Нет запятой/.test(xr) && /Почему: Придаточное/.test(xr) && /Хорошая работа/.test(xr) && /Добавьте примеры/.test(xr));

  await page.click('#xLengthSeg [data-len="short"]');
  await page.click('#xCheck');
  await page.waitForFunction(() => !document.querySelector('#xCheck').disabled && document.querySelector('#xResult .err-item'));
  const sb = calls('/grade-essay').pop().body;
  const xs = await page.textContent('#xResult');
  ok('«Коротко»: без темы; в разборе оценка, замечания и вывод — без критериев и шага',
    sb.topic === '' && !(await page.$('#xResult table.crit')) && !/Живой язык/.test(xs) && !/Добавьте примеры/.test(xs) && /Нет запятой/.test(xs) && /Хорошая работа/.test(xs));
  await page.click('#xLengthSeg [data-len="long"]');
  await page.uncheck('#xGrade');
  await page.uncheck('#xCriteria');
  await page.click('#xCheck');
  await page.waitForFunction(() => !document.querySelector('#xCheck').disabled && document.querySelector('#xResult .err-item'));
  ok('без оценки и критериев — их нет в разборе', !(await page.$('#xResult .grade')) && !(await page.$('#xResult table.crit')));
  push('/grade-essay', 400, { error: 'empty essay' });
  await page.click('#xCheck');
  await page.waitForFunction(() => /empty essay/.test((document.querySelector('#xResult .limit-note') || {}).textContent || ''));
  ok('ошибка Worker — его текст', true);
  push('/grade-essay', 429, { error: 'Слишком много запросов подряд. Подождите минуту.' });
  await page.click('#xCheck');
  await page.waitForFunction(() => /Подождите минуту/.test((document.querySelector('#xResult .limit-note') || {}).textContent || ''));
  ok('429 — «подождите минуту»', true);
  await page.evaluate(() => Sky.setLang('en'));
  ok('английский интерфейс', (await text(page, '#kindSeg [data-kind="text"]')) === 'Text' && (await text(page, '#xCheck')) === 'Check');
  await page.evaluate(() => Sky.setLang('ru'));
  await page.close();

  page = await open(PAGE + '?kind=text', { width: 390, height: 844 });
  await page.fill('#xText', 'Короткий текст.');
  await page.check('#xCriteria');                            /* выше галочки сняли — они запоминаются */
  await page.check('#xGrade');
  await page.click('#xCheck');
  await page.waitForSelector('#xResult .crit');
  const overX = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await page.click('#kindSeg [data-kind="photo"]');
  await page.click('#roleSeg [data-role="teacher"]');
  const overT = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('телефон 390 px: страница не шире экрана', overX <= 0 && overT <= 0, `${overX}, ${overT}`);
  if (process.env.SHOTS) {
    await page.click('#roleSeg [data-role="student"]');
    await page.screenshot({ path: path.join(process.env.SHOTS, 'student-phone.png'), fullPage: true });
  }
  await page.close();

  /* ========== essay.html → /grade-essay (через Sky.gradeEssay в core.js) ========== */
  page = await open(ESSAY);
  await page.waitForFunction(() => !!document.querySelector('#eText'));
  await page.selectOption('#eSubj', 'english');
  await page.fill('#ePrompt', 'My favourite book');
  await page.fill('#eText', 'I think that reading is important because it helps us learn new words and ideas every day.');
  await page.click('#checkBtn');
  await page.waitForSelector('#result .scorerow');
  const eb = calls('/grade-essay').pop();
  ok('essay.html: POST /grade-essay с text и topic (не essay/prompt), 4 критерия',
    eb.body.text.startsWith('I think') && eb.body.topic === 'My favourite book' && eb.body.subject === 'английский язык' &&
    eb.body.criteria.length === 4 && !('essay' in eb.body) && !('prompt' in eb.body), JSON.stringify(Object.keys(eb.body)));
  ok('essay.html: баллы по критериям по порядку, итог — grade',
    (await page.$$eval('#result .scorerow .num', n => n.map(x => x.textContent).join())) === '5,3,3,3,4');
  ok('essay.html: замечание с цитатой и причиной', /Нет запятой — Придаточное/.test(await page.textContent('#result')));
  await page.close();

  ok('ни одного запроса на /api/… и ни одного GET к Worker, кроме /health',
    state.calls.every(c => !c.path.startsWith('/api/') && (c.method === 'POST' || c.path === '/health')),
    state.calls.filter(c => c.path.startsWith('/api/') || (c.method !== 'POST' && c.path !== '/health')).map(c => c.method + ' ' + c.path).join());
  ok('ошибок JavaScript на странице нет', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
