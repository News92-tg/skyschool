/* ============================================================
   Разбор работ (teacher-review.html) в настоящем браузере.

   Запуск:  node scripts/test-teacher-review.js

   Supabase подменён (scripts/lib/fake-supabase.js): таблицы подборок и
   отправок в памяти, «RLS» — хук visible. Worker /explain подменён
   маршрутом: проверяем, что уходит в запрос и что видит учитель.

   Путь учителя: подборки → ученики (сортировка, CSV) → разбор работы
   (ответ, правильный, ✓/✗, «Объяснить») → «назад» браузера. Отдельно:
   старая отправка без task_details, чужая подборка, ученик, не вошёл,
   сбой загрузки, телефон, английский.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');
const SHOTS = process.env.SHOTS;
const shot = (page, name, full) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name), fullPage: !!full }) : null;

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

const ago = m => new Date(Date.now() - m * 60e3).toISOString();
const C1 = 'c1111111-0000-4000-8000-000000000001', C2 = 'c1111111-0000-4000-8000-000000000002', CX = 'c1111111-0000-4000-8000-0000000000ff';
const TASKS = [
  { id: 't1', type: 'choice', text: '2 + 2 = ?', options: ['3', '4', '5'], answer: 1 },
  { id: 't2', type: 'text', text: 'Половина от единицы?', accept: ['0,5', '1/2'] },
  { id: 't3', type: 'text', text: 'Где в жизни встречаются дроби?' }
];
/* Петя: выбор верно, текст неверно, открытое ждёт — как пишет база */
const PETYA = {
  id: 's-petya', collection_id: C1, student_name: 'Петя Иванов', student_class: '7Б', created_at: ago(30), status: 'pending', score: 1, percent: 33.3,
  answers: [{ task_id: 't1', answer: '1', correct: true }, { task_id: 't2', answer: '2', correct: false }, { task_id: 't3', answer: 'В рецептах', correct: null }],
  task_details: [
    { task_id: 't1', type: 'choice', question: '2 + 2 = ?', options: ['3', '4', '5'], student_answer: '4', student_choice: 1, is_correct: true },
    { task_id: 't2', type: 'text', question: 'Половина от единицы?', options: [], student_answer: '2', student_choice: null, is_correct: false },
    { task_id: 't3', type: 'text', question: 'Где в жизни встречаются дроби?', options: [], student_answer: 'В рецептах', student_choice: null, is_correct: null }
  ]
};
/* Аня: всё верно, открытое учитель засчитал */
const ANYA = {
  id: 's-anya', collection_id: C1, student_name: 'Аня Белова', student_class: '7А', created_at: ago(90), status: 'checked', score: 3, percent: 100,
  teacher_comment: 'Отлично!',
  answers: [{ task_id: 't1', answer: '1', correct: true }, { task_id: 't2', answer: '1/2', correct: true }, { task_id: 't3', answer: 'В магазине', correct: true }],
  task_details: [
    { task_id: 't1', type: 'choice', question: '2 + 2 = ?', options: ['3', '4', '5'], student_answer: '4', student_choice: 1, is_correct: true },
    { task_id: 't2', type: 'text', question: 'Половина от единицы?', options: [], student_answer: '1/2', student_choice: null, is_correct: true },
    { task_id: 't3', type: 'text', question: 'Где в жизни встречаются дроби?', options: [], student_answer: 'В магазине', student_choice: null, is_correct: true }
  ]
};
/* Вова: отправил до появления task_details — разбор из answers; имя-формула для CSV */
const VOVA = {
  id: 's-vova', collection_id: C1, student_name: '=Вова', student_class: null, created_at: ago(200), status: 'checked', score: 2, percent: 66.7,
  answers: [{ task_id: 't1', answer: '0', correct: false }, { task_id: 't2', answer: '0.5', correct: true }, { task_id: 't3', answer: 'Пицца', correct: true }],
  task_details: null
};
const FOREIGN = { id: 's-foreign', collection_id: CX, student_name: 'Чужой', created_at: ago(5), status: 'checked', score: 1, percent: 100, answers: [], task_details: [] };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let explainCalls = [];

  async function open(o) {
    o = o || {};
    const fake = createBackend({
      users: [{ id: 'u-t', email: 'olga@school.test' }, { id: 'u-s', email: 'masha@school.test' }, { id: 'u-x', email: 'boris@school.test' }],
      tables: {
        profiles: [{ id: 'u-t', name: 'Ольга Петровна', role: 'teacher' }, { id: 'u-s', name: 'Маша', role: 'student' }, { id: 'u-x', name: 'Борис', role: 'teacher' }],
        task_collections: [
          { id: C1, teacher_id: 'u-t', title: 'Дроби — разминка', subject: 'math', share_code: 'A3K7MN', tasks: TASKS, is_public: true, created_at: ago(500) },
          { id: C2, teacher_id: 'u-t', title: 'Пустая подборка', subject: 'physics', share_code: 'B4P8QR', tasks: [TASKS[0]], is_public: true, created_at: ago(400) },
          { id: CX, teacher_id: 'u-x', title: 'Чужая подборка', subject: 'math', share_code: 'XXXXXX', tasks: [TASKS[0]], is_public: true, created_at: ago(300) }
        ],
        collection_submissions: o.subs || [PETYA, ANYA, VOVA, FOREIGN]
      },
      /* как RLS: учитель видит только свои подборки и ответы по ним */
      visible: (table, row, uid) => {
        if (table === 'task_collections') return row.teacher_id === uid;
        if (table === 'collection_submissions') return [C1, C2].includes(row.collection_id) ? uid === 'u-t' : row.collection_id === CX && uid === 'u-x';
        return true;
      },
      selectError: o.failOnce ? (m) => (m.table === 'collection_submissions' && o.failOnce.n-- > 0 ? { message: 'Failed to fetch', status: 0 } : null) : null
    });
    const ctx = await browser.newContext({ locale: o.en ? 'en-US' : 'ru-RU', viewport: o.viewport || { width: 1150, height: 900 },
      isMobile: !!o.mobile, hasTouch: !!o.mobile, acceptDownloads: true });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    /* Worker /explain — последний зарегистрированный маршрут срабатывает первым */
    await ctx.route(/workers\.dev\/+explain$/, async r => {
      const body = JSON.parse(r.request().postData() || '{}');
      explainCalls.push(body);
      if (o.explainFail && o.explainFail.n-- > 0) return r.fulfill({ status: 502, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'Модель не ответила' }) });
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ explanation: 'Половина — это 1 разделить на 2.\n\nПолучается 0,5, а не 2: ученик перепутал деление и умножение.' }) });
    });
    if (o.en) await ctx.addInitScript(() => localStorage.setItem('sky_lang', '"en"'));
    await fake.install(ctx, { session: o.session === undefined ? 'u-t' : o.session });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    const nav = page.waitForRequest(r => r.isNavigationRequest() && !/teacher-review\.html$/.test(new URL(r.url()).pathname), { timeout: 4000 }).catch(() => null);
    await page.goto(url('teacher-review.html' + (o.qs || '')));
    if (o.session !== null) await page.waitForFunction(() => window.SkyReview && (SkyReview.loaded || document.querySelector('#trView .empty'))).catch(() => {});
    await page.waitForTimeout(150);
    return { page, ctx, fake, nav };
  }
  const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

  /* ---------- 1. подборки ---------- */
  let { page, ctx } = await open();
  await shot(page, 'review-colls.png');
  const cards = await page.$$eval('.tr-coll', a => a.map(x => x.querySelector('h3').textContent));
  ok('подборки учителя — свои две, чужой нет; сначала та, где были ответы', JSON.stringify(cards) === '["Дроби — разминка","Пустая подборка"]', JSON.stringify(cards));
  const c1 = await text(page, '.tr-coll:first-child');
  ok('в карточке: предмет, заданий, код, работ, средний %, ждут проверки', /Математика/.test(c1) && /Заданий: 3/.test(c1) && /A3K7MN/.test(c1) &&
    /3 работ/.test(c1) && /· в среднем 67%/.test(c1) && /в среднем 67%/.test(c1) && /ждут проверки: 1/.test(c1), c1);
  ok('пустая — «ответов пока нет»', /ответов пока нет/.test(await text(page, '.tr-coll:nth-child(2)')));
  ok('в меню учителя — «Разбор работ»', await page.$('#appHeader a[href="teacher-review.html"]') !== null);

  /* ---------- 2. ученики ---------- */
  await page.click('.tr-coll:first-child');
  await page.waitForSelector('.tr-students');
  ok('адрес — ?c=<подборка>', new URL(page.url()).searchParams.get('c') === C1);
  const studs = () => page.$$eval('.tr-students tbody tr', r => r.map(x => [...x.children].map(c => c.textContent.replace(/\s+/g, ' ').trim())));
  let rows = await studs();
  ok('ученики: ФИО, класс, дата, верно, %, оценка — новые сверху', rows.length === 3 && rows[0][0].startsWith('Петя Иванов') && rows[0][1] === '7Б' &&
    rows[0][3] === '1 / 3' && rows[0][4] === '33,3%' && rows[0][5] === '2' && rows[1][0] === 'Аня Белова' && rows[1][5] === '5' && rows[2][1] === '—', JSON.stringify(rows));
  ok('у непроверенной — «ждёт проверки»', /ждёт проверки/.test(rows[0][0]));
  const sum = await text(page, '.tr-sum');
  ok('сводка: работ 3, средний 67%, оценки 5×1 3×1 2×1', /Работ: 3/.test(sum) && /Средний результат: 67%/.test(sum) && /5 ×1/.test(sum) && /3 ×1/.test(sum) && /2 ×1/.test(sum), sum);
  await page.click('[data-sort="name"]');
  rows = await studs();
  await shot(page, 'review-students.png');
  ok('«По имени» — по алфавиту', rows.map(r => r[0].replace(' ждёт проверки', '')).join('|') === '=Вова|Аня Белова|Петя Иванов', JSON.stringify(rows.map(r => r[0])));
  await page.click('[data-sort="score"]');
  rows = await studs();
  ok('«По результату» — лучшие сверху', rows[0][0] === 'Аня Белова' && rows[2][0].startsWith('Петя'), JSON.stringify(rows.map(r => r[0])));

  /* CSV */
  const dl = page.waitForEvent('download');
  await page.click('#trCsv');
  const file = await dl;
  const csv = fs.readFileSync(await file.path(), 'utf8');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  ok('CSV: BOM и заголовок ФИО;Класс;Верно;Всего;Процент;Оценка', csv.charCodeAt(0) === 0xfeff && lines[0] === 'ФИО;Класс;Верно;Всего;Процент;Оценка', lines[0]);
  ok('CSV: строки учеников в порядке на экране', lines[1] === 'Аня Белова;7А;3;3;100;5' && lines[3] === 'Петя Иванов;7Б;1;3;33,3;2', lines.join(' | '));
  ok('CSV: формула в имени обезврежена, имя файла по коду', lines[2].startsWith("'=Вова;;2;3;66,7;3") && file.suggestedFilename() === 'skyschool-A3K7MN.csv', lines[2] + ' ' + file.suggestedFilename());

  /* ---------- 3. разбор работы ---------- */
  await page.click('[data-sort="date"]');
  await page.click('.tr-students tbody tr:first-child td:nth-child(4)');      /* клик по строке, не по имени */
  await page.waitForSelector('.tr-tasks');
  ok('адрес — ?c=…&s=<работа>', new URL(page.url()).searchParams.get('s') === 's-petya');
  ok('шапка: имя, класс', (await text(page, 'h1')) === 'Петя Иванов' && /Класс: 7Б/.test(await text(page, '.tr-meta')));
  ok('сводка «Верно 1 из 3 (33,3%), оценка 2»', (await text(page, '#trSummary')) === 'Верно 1 из 3 (33,3%), оценка 2', await text(page, '#trSummary'));
  ok('ещё одно ждёт учителя — подсказка и «Проверить» в подборки', /Ещё 1/.test(await text(page, '.tr-note')) &&
    await page.$('.tr-note a[href="collections.html?review=s-petya"]') !== null);
  const det = await page.$$eval('.tr-tasks tbody tr', r => r.map(x => ({
    q: x.querySelector('.q').textContent, a: x.children[2].textContent.trim(), r: x.children[3].textContent.trim(),
    m: (x.querySelector('.tr-mark') || {}).textContent, ex: !!x.querySelector('[data-explain]'), wrong: x.classList.contains('is-wrong') })));
  ok('№1: вариант буквой «Б. 4», правильный «Б. 4», ✓, без «Объяснить»', det[0].a === 'Б. 4' && det[0].r === 'Б. 4' && det[0].m === '✓' && !det[0].ex, JSON.stringify(det[0]));
  ok('№2: ответ «2», правильный «0,5 / 1/2», ✗, строка выделена, есть «Объяснить»', det[1].a === '2' && det[1].r === '0,5 / 1/2' && det[1].m === '✗' && det[1].ex && det[1].wrong, JSON.stringify(det[1]));
  ok('№3: открытое — «оцениваете вы», ?', det[2].r === 'оцениваете вы' && det[2].m === '?' && !det[2].ex, JSON.stringify(det[2]));

  /* «Объяснить» */
  explainCalls = [];
  await page.click('[data-explain="t2"]');
  await page.waitForSelector('.tr-ex-body p');
  const sent = explainCalls[0] || {};
  ok('«Объяснить» → /explain: задание, ответ, правильный, предмет, lang ru', explainCalls.length === 1 && sent.task === 'Половина от единицы?' && sent.userAnswer === '2' &&
    sent.correctAnswer === '0,5 / 1/2' && sent.subject === 'Математика' && sent.lang === 'ru' && !('options' in sent), JSON.stringify(sent));
  const exText = await text(page, '.tr-ex-body');
  ok('объяснение в окне: абзацы и пометка «написал ИИ»', (await page.$$('.tr-ex-body p')).length === 2 && /перепутал деление/.test(exText) && /написал ИИ/.test(exText), exText);
  ok('в окне — ответ ученика и правильный рядом', /Ответ ученика\s*2/.test(await text(page, '.tr-ex .pair')) && /Правильный\s*0,5 \/ 1\/2/.test(await text(page, '.tr-ex .pair')), await text(page, '.tr-ex .pair'));
  await shot(page, 'review-explain.png');
  await page.keyboard.press('Escape');
  await shot(page, 'review-work.png', true);
  await page.click('[data-explain="t2"]');
  await page.waitForSelector('.tr-ex-body p');
  ok('второй раз — без нового запроса к Worker', explainCalls.length === 1);
  await page.keyboard.press('Escape');

  /* «назад» браузера и следующий ученик */
  await page.goBack();
  await page.waitForSelector('.tr-students');
  ok('«назад» браузера — снова список учеников', !(await page.$('.tr-tasks')) && (await studs()).length === 3);
  await page.goForward();
  await page.waitForSelector('.tr-tasks');
  await page.click('.tr-pn a');
  await page.waitForSelector('.tr-tasks');
  ok('«Следующий ученик» — Аня, 3 из 3, оценка 5, комментарий учителя', (await text(page, 'h1')) === 'Аня Белова' &&
    /Верно 3 из 3 \(100%\), оценка 5/.test(await text(page, '#trSummary')) && /Отлично!/.test(await text(page, '.tr-comment')) && !(await page.$('.tr-note')));
  await ctx.close();

  /* ---------- старая отправка без task_details, сразу по ссылке ---------- */
  explainCalls = [];
  ({ page, ctx } = await open({ qs: `?c=${C1}&s=s-vova`, explainFail: { n: 1 } }));
  await page.waitForSelector('.tr-tasks');
  const old = await page.$$eval('.tr-tasks tbody tr', r => r.map(x => [x.children[2].textContent.trim(), x.children[3].textContent.trim(), (x.querySelector('.tr-mark') || {}).textContent]));
  ok('без task_details — разбор из ответов: «А. 3» ✗, «0.5» ✓, открытое ✓', JSON.stringify(old) === JSON.stringify([['А. 3', 'Б. 4', '✗'], ['0.5', '0,5 / 1/2', '✓'], ['Пицца', 'оцениваете вы', '✓']]), JSON.stringify(old));
  await page.click('[data-explain="t1"]');
  await page.waitForSelector('.tr-ex-body .err');
  ok('Worker не ответил — понятная ошибка и «Повторить»', /Модель не ответила/.test(await text(page, '.tr-ex-body')) && await page.$('#trExAgain') !== null);
  await page.click('#trExAgain');
  await page.waitForSelector('.tr-ex-body p:not(.err)');
  const sent2 = explainCalls[1] || {};
  ok('повтор — объяснение пришло; варианты ушли с буквами', explainCalls.length === 2 && JSON.stringify(sent2.options) === JSON.stringify(['А. 3', 'Б. 4', 'В. 5']) &&
    sent2.userAnswer === 'А. 3' && sent2.correctAnswer === 'Б. 4', JSON.stringify(sent2));
  await ctx.close();

  /* ---------- пустая подборка, чужая, ученик, не вошёл, сбой ---------- */
  ({ page, ctx } = await open({ qs: `?c=${C2}` }));
  ok('подборка без ответов — пояснение и «Скопировать ссылку»', /Ответов пока нет/.test(await text(page, '#trView')) && await page.$('[data-copy="B4P8QR"]') !== null);
  await ctx.close();

  ({ page, ctx } = await open({ qs: `?c=${CX}` }));
  ok('чужая подборка по ссылке — «Не нашлось», данных нет', /Не нашлось/.test(await text(page, '#trView')) && !/Чужой/.test(await text(page, '#trView')));
  await ctx.close();

  ({ page, ctx } = await open({ session: 'u-s' }));
  ok('ученику — «Разбор работ — для учителей», без данных', /для учителей/.test(await text(page, '#trView')) && !(await page.$('.tr-coll')));
  await ctx.close();

  let r = await open({ session: null, qs: `?c=${C1}` });
  const navReq = await r.nav;
  ok('не вошёл — на вход с возвратом сюда же', !!navReq && /auth\.html\?next=teacher-review\.html%3Fc%3D/.test(navReq.url()), navReq && navReq.url());
  await r.ctx.close();

  ({ page, ctx } = await open({ failOnce: { n: 1 } }));
  await page.waitForSelector('#trView .empty');
  ok('сбой загрузки — не «подборок нет», а «не удалось загрузить» и «Повторить»', /Не удалось загрузить работы/.test(await text(page, '#trView')) &&
    !/Подборок пока нет/.test(await text(page, '#trView')) && (await text(page, '.sx .sx-acts button')) === 'Повторить');
  await page.click('.sx .sx-acts button');                            /* настоящая кнопка из уведомления */
  await page.waitForSelector('.tr-coll', { timeout: 4000 }).catch(() => {});
  ok('«Повторить» — подборки загрузились', (await page.$$('.tr-coll')).length === 2);
  await ctx.close();

  /* ---------- телефон, английский ---------- */
  ({ page, ctx } = await open({ qs: `?c=${C1}&s=s-petya`, viewport: { width: 360, height: 740 }, mobile: true }));
  await page.waitForSelector('.tr-tasks');
  const m = await page.evaluate(() => {
    const row = document.querySelector('.tr-tasks tbody tr:nth-child(2)').getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, thead: getComputedStyle(document.querySelector('.tr-tasks thead')).display, w: Math.round(row.width) };
  });
  await shot(page, 'review-phone.png', true);
  ok('телефон 360 px: задания карточками, вбок не листается', m.sw <= 360 && m.thead === 'none' && m.w <= 340, JSON.stringify(m));
  await page.goto(url('teacher-review.html?c=' + C1));
  await page.waitForSelector('.tr-students');
  ok('телефон: список учеников не растягивает страницу', await page.evaluate(() => document.documentElement.scrollWidth) <= 360);
  await ctx.close();

  ({ page, ctx } = await open({ en: true, qs: `?c=${C1}&s=s-petya` }));
  await page.waitForSelector('.tr-tasks');
  ok('английский: «Correct 1 of 3 (33.3%), mark 2», варианты A/B/C', (await text(page, '#trSummary')) === 'Correct 1 of 3 (33.3%), mark 2' &&
    (await text(page, '.tr-tasks tbody tr:first-child td:nth-child(3)')) === 'B. 4');
  await ctx.close();

  ok('без ошибок на странице', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
