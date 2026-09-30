/* ============================================================
   Подборки заданий в настоящем браузере: учитель (collections.html)
   собирает подборку, ученик без аккаунта (collection.html?code=…)
   решает и отправляет, учитель проверяет открытые ответы.

   Запуск:  node scripts/test-collections.js

   Supabase подменён: страница ходит в «базу», которая живёт здесь,
   в тесте (exposeBinding), — так учитель и ученик в разных браузерах
   видят одни и те же данные. Логика функций повторяет
   sql/schema-collections.sql в упрощённом виде; сами функции и RLS
   проверяет sql/tests/collections-tests.sql (scripts/test-rls.sh).
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page_ = f => 'file://' + path.join(ROOT, f);
const TEACHER = { id: 'u-teacher', email: 'anna@test', name: 'Анна Петровна', role: 'teacher' };
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

/* ---------- «база» ---------- */
const DB = { profiles: [Object.assign({}, TEACHER)], task_categories: [], task_collections: [], collection_submissions: [] };
const CALLS = [];
const clone = o => JSON.parse(JSON.stringify(o));
let seq = 0;
const now = () => new Date(Date.now() + (seq++)).toISOString();
const norm = t => String(t == null ? '' : t).trim().toLowerCase().replace(/ё/g, 'е').replace(/,/g, '.').replace(/\s+/g, ' ').replace(/\.$/, '');
const visible = (table, r, uid) => {
  if (table === 'task_categories' || table === 'task_collections') return !!uid && r.teacher_id === uid;
  if (table === 'collection_submissions') return !!uid && (r.student_id === uid || DB.task_collections.some(c => c.id === r.collection_id && c.teacher_id === uid));
  return true;
};

function query({ table, op, payload, filters, uid }) {
  const rows = DB[table] = DB[table] || [];
  const match = r => visible(table, r, uid) && filters.every(([k, v]) => r[k] === v);
  if (op === 'select') return { data: rows.filter(match).map(clone), error: null };
  if (op === 'insert') {
    if (!uid) return { data: null, error: { message: 'permission denied' } };
    const r = Object.assign({ created_at: now() }, payload);
    if (table === 'task_collections') {
      r.teacher_id = uid;
      do { r.share_code = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * 32)]).join(''); }
      while (DB.task_collections.some(c => c.share_code === r.share_code));
      if (!Array.isArray(r.tasks) || !r.tasks.length || r.tasks.length > 100) return { data: null, error: { message: 'check constraint tasks' } };
    }
    if (table === 'task_categories') r.teacher_id = uid;
    if (table === 'collection_submissions') return { data: null, error: { message: 'permission denied' } };
    rows.push(r);
    return { data: [clone(r)], error: null };
  }
  if (op === 'update') {
    rows.filter(match).forEach(r => Object.assign(r, payload));
    return { data: rows.filter(match).map(clone), error: null };
  }
  if (op === 'delete') {
    const gone = rows.filter(match);
    DB[table] = rows.filter(r => !gone.includes(r));
    if (table === 'task_collections') DB.collection_submissions = DB.collection_submissions.filter(s => !gone.some(c => c.id === s.collection_id));
    if (table === 'task_categories') DB.task_collections.forEach(c => { if (gone.some(g => g.id === c.category_id)) c.category_id = null; });
    return { data: null, error: null };
  }
  return { data: null, error: { message: 'unknown op' } };
}

function rpc({ fn, args, uid }) {
  const byCode = code => DB.task_collections.find(c => c.share_code === String(code || '').trim().toUpperCase());
  const gate = c => !c ? 'not_found' : c.expires_at && new Date(c.expires_at) <= new Date() ? 'expired' : !c.is_public && !uid ? 'login_required' : null;
  if (fn === 'get_collection_by_code') {
    const c = byCode(args.p_code);
    const err = gate(c);
    if (err) return { data: { error: err }, error: null };
    return { data: {
      id: c.id, code: c.share_code, title: c.title, description: c.description, subject: c.subject, expires_at: c.expires_at,
      teacher: (DB.profiles.find(p => p.id === c.teacher_id) || {}).name || null,
      tasks: c.tasks.map(t => ({ id: t.id, type: t.type || 'text', text: t.text, options: Array.isArray(t.options) ? t.options : [] }))
    }, error: null };
  }
  if (fn === 'submit_collection') {
    const c = byCode(args.p_code);
    const err = gate(c);
    if (err) return { data: { error: err }, error: null };
    let name = String(args.p_student_name || '').trim();
    if (!name && uid) name = (DB.profiles.find(p => p.id === uid) || {}).name || '';
    if (!name) return { data: { error: 'name_required' }, error: null };
    let correct = 0, auto = 0, open = 0;
    const answers = c.tasks.map(t => {
      const a = (args.p_answers || []).find(x => x.task_id === t.id) || {};
      const given = String(a.answer == null ? '' : a.answer);
      let v;
      if (t.type === 'choice' && Number.isInteger(t.answer)) { v = /^\d+$/.test(given) && Number(given) === t.answer; auto++; }
      else if (Array.isArray(t.accept) && t.accept.length) { v = norm(given) !== '' && t.accept.some(x => norm(x) === norm(given)); auto++; }
      else { v = null; open++; }
      if (v) correct++;
      return { task_id: t.id, answer: given, correct: v };
    });
    DB.collection_submissions.push({ id: 'sub-' + (DB.collection_submissions.length + 1), collection_id: c.id, student_id: uid || null, student_name: name,
      answers, score: correct, percent: Math.round(correct * 1000 / c.tasks.length) / 10, status: open ? 'pending' : 'checked', teacher_comment: null, created_at: now() });
    return { data: { ok: true, correct, auto, open, total: c.tasks.length }, error: null };
  }
  if (fn === 'review_collection_submission') {
    const s = DB.collection_submissions.find(x => x.id === args.p_id);
    const c = s && DB.task_collections.find(x => x.id === s.collection_id && x.teacher_id === uid);
    if (!c) return { data: null, error: { message: 'submission not found', code: '42501' } };
    s.answers = s.answers.map(a => typeof (args.p_marks || {})[a.task_id] === 'boolean' ? Object.assign({}, a, { correct: args.p_marks[a.task_id] }) : a);
    s.score = s.answers.filter(a => a.correct === true).length;
    s.percent = Math.round(s.score * 1000 / c.tasks.length) / 10;
    if (args.p_comment != null) s.teacher_comment = args.p_comment;
    s.status = s.answers.some(a => a.correct === null || a.correct === undefined) ? 'pending' : 'checked';
    return { data: clone(s), error: null };
  }
  return { data: null, error: { message: 'unknown rpc ' + fn } };
}

/* ---------- подмена supabase-js в странице ---------- */
function fakeSupabase(me) {
  const call = msg => window.__sky(Object.assign({ uid: me ? me.id : null }, msg));
  const Q = (table, op, payload) => {
    const filters = [];
    const run = () => call({ kind: 'query', table, op, payload: payload === undefined ? null : payload, filters });
    const q = {
      select() { return q; },
      eq(k, v) { filters.push([k, v]); return q; },
      maybeSingle() { return run().then(r => ({ data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: r.error })); },
      then(res, rej) { return run().then(res, rej); }
    };
    return q;
  };
  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: async () => ({ data: { session: me ? { access_token: 'jwt', user: { id: me.id, email: me.email, user_metadata: {} } } : null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null })
      },
      from: table => ({ select: () => Q(table, 'select'), insert: p => Q(table, 'insert', p), update: p => Q(table, 'update', p), delete: () => Q(table, 'delete') }),
      rpc: (fn, args) => call({ kind: 'rpc', fn, args: args || {} })
    })
  };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function context(me, viewport) {
    const ctx = await browser.newContext({ locale: 'ru-RU', viewport: viewport || { width: 1150, height: 900 } });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    await ctx.exposeBinding('__sky', (src, msg) => { CALLS.push(msg); return msg.kind === 'rpc' ? rpc(msg) : query(msg); });
    await ctx.addInitScript(fakeSupabase, me);
    return ctx;
  }
  async function open(ctx, file) {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(file + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|service ?worker/i.test(m.text())) errors.push(file + ': ' + m.text()); });
    page.on('dialog', d => d.accept());
    await page.goto(page_(file));
    return page;
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const shown = (page, sel) => page.$eval(sel, el => !el.classList.contains('hidden') && el.offsetParent !== null).catch(() => false);
  const toastLike = (page, re) => page.waitForFunction(src => {
    const t = document.querySelector('.toast.show');
    return t && new RegExp(src).test(t.textContent);
  }, re.source, { timeout: 5000 }).then(() => true, () => false);
  const rawKeys = page => page.evaluate(() => [...document.querySelectorAll('[data-i18n], [data-i18n-ph]')]
    .filter(el => el.dataset.i18n ? el.textContent.trim() === el.dataset.i18n : el.placeholder === el.dataset.i18nPh)
    .map(el => el.dataset.i18n || el.dataset.i18nPh));

  /* ========== учитель ========== */
  const tctx = await context(TEACHER);
  let t = await open(tctx, 'collections.html');
  await t.waitForSelector('#app:not(.hidden) .empty');
  ok('учитель: пустой список и вкладка «Все»', (await text(t, '#catTabs .cl-tab')) === 'Все0' && /Подборок пока нет/.test(await text(t, '#colls')));
  ok('все подписи переведены', !(await rawKeys(t)).length, (await rawKeys(t)).join());
  ok('в меню — «Подборки»', await t.$('#appHeader a[href="collections.html"]') !== null);

  /* категория */
  await t.click('#catAdd');
  await t.fill('.modal #catName', 'Дроби');
  await t.selectOption('.modal #catSubj', 'math');
  await t.click('.modal [data-go]');
  await t.waitForFunction(() => [...document.querySelectorAll('#catTabs .cl-tab')].some(b => /Дроби/.test(b.textContent) && b.getAttribute('aria-pressed') === 'true'));
  ok('категория создана и выбрана', DB.task_categories.length === 1 && DB.task_categories[0].name === 'Дроби' && DB.task_categories[0].subject === 'math' &&
    DB.task_categories[0].teacher_id === TEACHER.id && /Категория: Дроби · Математика/.test(await text(t, '#catLine')));

  /* новая подборка */
  await t.click('#newBtn');
  await t.waitForSelector('.modal .cl-new #bList .cl-bt');
  ok('окно подборки: предмет и категория из выбранной категории, банк — математика',
    (await t.$eval('.modal #nSubj', s => s.value)) === 'math' && (await t.$eval('.modal #nCat', s => s.selectedOptions[0].textContent)) === 'Дроби' &&
    (await t.$eval('.modal #bSubj', s => s.value)) === 'math');
  await t.click('.modal [data-go]');
  ok('без названия — не создаётся', await toastLike(t, /Впишите название/));
  await t.fill('.modal #nTitle', 'Проценты — разминка');
  await t.click('.modal [data-go]');
  ok('без заданий — не создаётся', await toastLike(t, /хотя бы одно задание/) && !DB.task_collections.length);
  await t.fill('.modal #nDesc', 'Решите до пятницы');
  await t.fill('.modal #bSearch', 'процент');
  await t.waitForFunction(() => document.querySelectorAll('.modal #bList .cl-bt').length > 0 && [...document.querySelectorAll('.modal #bList .cl-bt')].every(b => /процент/i.test(b.textContent)));
  const bankButtons = await t.$$('.modal #bList .cl-bt');
  await bankButtons[0].click();
  await t.waitForFunction(() => document.querySelectorAll('.modal #nPicked .cl-pk').length === 1);
  await (await t.$$('.modal #bList .cl-bt'))[1].click();
  await t.waitForFunction(() => document.querySelectorAll('.modal #nPicked .cl-pk').length === 2);
  ok('из банка: поиск и выбор, выбранное отмечено', (await t.$$('.modal #bList .cl-bt.on')).length === 2 && (await text(t, '.modal #nCount')) === '2');
  await (await t.$$('.modal #bList .cl-bt'))[1].click();
  await t.waitForFunction(() => document.querySelectorAll('.modal #nPicked .cl-pk').length === 1);
  ok('повторный клик снимает выбор', (await text(t, '.modal #nCount')) === '1');

  await t.click('.modal #nSrc [data-src="own"]');
  await t.fill('.modal #oText', 'Сколько будет 7 × 8?');
  const opts = await t.$$('.modal #oOpts .cl-opt');
  await (await opts[0].$('input[type=text]')).fill('54');
  await (await opts[1].$('input[type=text]')).fill('56');
  await (await opts[2].$('input[type=text]')).fill('58');
  await t.click('.modal #oAdd');
  ok('своё с вариантами: без отметки верного — нельзя', await toastLike(t, /Отметьте верный вариант/));
  await (await opts[1].$('input[type=radio]')).check();
  await t.click('.modal #oAdd');
  await t.click('.modal #oKind [data-kind="text"]');
  await t.fill('.modal #oText', 'Половина от единицы — это?');
  await t.fill('.modal #oAccept', '0,5; 1/2');
  await t.click('.modal #oAdd');
  await t.fill('.modal #oText', 'Опишите, где в жизни встречаются проценты');
  await t.click('.modal #oAdd');
  await t.waitForFunction(() => document.querySelectorAll('.modal #nPicked .cl-pk').length === 4);
  ok('свои задания: выбор, текст с ответом, открытое', /56/.test(await text(t, '.modal #nPicked .cl-pk:nth-child(2) .k')) &&
    /0,5 \/ 1\/2/.test(await text(t, '.modal #nPicked .cl-pk:nth-child(3) .k')) && /проверит учитель/.test(await text(t, '.modal #nPicked .cl-pk:nth-child(4) .k')));
  await t.selectOption('.modal #nDays', '3');
  if (process.env.SHOTS) await t.screenshot({ path: path.join(process.env.SHOTS, 'coll-new.png'), fullPage: true });
  await t.click('.modal [data-go]');
  await t.waitForSelector('.cl-card');
  const coll = DB.task_collections[0];
  ok('подборка сохранена: название, описание, предмет, категория, без входа',
    coll && coll.title === 'Проценты — разминка' && coll.description === 'Решите до пятницы' && coll.subject === 'math' &&
    coll.category_id === DB.task_categories[0].id && coll.is_public === true, JSON.stringify(coll && Object.assign({}, coll, { tasks: undefined })));
  ok('срок ссылки — 3 дня', coll && Math.abs(new Date(coll.expires_at) - Date.now() - 3 * 86400000) < 60000);
  ok('задания t1…t4: из банка с номером верного, свои — с ответами',
    coll.tasks.map(x => x.id).join() === 't1,t2,t3,t4' && coll.tasks[0].type === 'choice' && Number.isInteger(coll.tasks[0].answer) && /^bank:math:/.test(coll.tasks[0].source) &&
    coll.tasks[1].answer === 1 && coll.tasks[1].options.join() === '54,56,58' && coll.tasks[2].accept.join() === '0,5,1/2' && !('accept' in coll.tasks[3]) && coll.tasks[3].type === 'text');
  ok('код — 6 символов без I, O, 1, 0', /^[A-HJ-NP-Z2-9]{6}$/.test(coll.share_code));
  const card = await text(t, '.cl-card');
  ok('карточка: заданий, код, срок, «без входа», ответов 0', /Заданий: 4/.test(card) && card.includes(coll.share_code) && /до \d\d\.\d\d\.\d{4}/.test(card) && /без входа/.test(card) && /Ответов: 0/.test(card));
  ok('ссылка «Открыть» — collection.html?code=…', (await t.$eval('.cl-card a.btn', a => a.href)).endsWith('/collection.html?code=' + coll.share_code));
  await t.evaluate(() => {
    window.__copied = null;
    if (navigator.clipboard) navigator.clipboard.writeText = async v => { window.__copied = v; };
    document.execCommand = () => { window.__copied = document.activeElement && document.activeElement.value; return true; };
  });
  await t.click('.cl-card [data-act="copy"]');
  ok('«Скопировать ссылку»', await toastLike(t, /Ссылка скопирована/) && /\/collection\.html\?code=[A-Z2-9]{6}$/.test(await t.evaluate(() => window.__copied)), await t.evaluate(() => window.__copied));

  /* ========== ученик без аккаунта ========== */
  const sctx = await context(null, { width: 390, height: 844 });
  let s = await open(sctx, 'collection.html?code=' + coll.share_code.toLowerCase());
  await s.waitForSelector('#solveForm');
  ok('ученик: название, учитель, 4 задания, описание', (await text(s, 'h1')) === 'Проценты — разминка' && /Учитель: Анна Петровна/.test(await text(s, '.cn-meta')) &&
    (await s.$$('.cn-task')).length === 4 && /Решите до пятницы/.test(await text(s, '.cn-desc')));
  ok('выбор — переключатели, текст — поле ответа', (await s.$$('.cn-task:nth-child(1) input[type=radio]')).length === 4 &&
    (await s.$$('.cn-task:nth-child(3) textarea')).length === 1 && (await s.$$('.cn-task:nth-child(4) textarea')).length === 1);
  ok('без аккаунта — поле для имени', await shown(s, '#stName'));
  ok('ученик: все подписи переведены', !(await rawKeys(s)).length, (await rawKeys(s)).join());
  await s.click('#sendBtn');
  ok('без имени — не отправляется', await toastLike(s, /Впишите имя/) && !DB.collection_submissions.length);
  await s.fill('#stName', 'Петя Иванов');
  const right0 = coll.tasks[0].answer;
  await s.check(`.cn-task:nth-child(1) input[value="${right0}"]`);
  await s.check('.cn-task:nth-child(2) input[value="0"]');           /* 54 — неверно */
  await s.fill('.cn-task:nth-child(3) textarea', ' 0.5 ');
  ok('счётчик «Отвечено»', (await text(s, '#prog')) === 'Отвечено: 3 из 4');
  await s.reload();
  await s.waitForSelector('#solveForm');
  ok('черновик переживает перезагрузку', (await s.$eval('#stName', i => i.value)) === 'Петя Иванов' &&
    (await s.$eval(`.cn-task:nth-child(1) input[value="${right0}"]`, i => i.checked)) && (await s.$eval('.cn-task:nth-child(3) textarea', i => i.value)) === '0.5',
    JSON.stringify(await s.evaluate(() => [document.querySelector('#stName').value, Object.keys(sessionStorage), sessionStorage.getItem(Object.keys(sessionStorage).find(k => /clDraft/.test(k)) || 'x')])));
  if (process.env.SHOTS) await s.screenshot({ path: path.join(process.env.SHOTS, 'coll-student.png'), fullPage: true });
  await s.click('#sendBtn');                                           /* не всё решено → confirm, тест соглашается */
  await s.waitForSelector('.cn-done');
  const sub = DB.collection_submissions[0];
  const sentRpc = CALLS.filter(c => c.fn === 'submit_collection').pop();
  ok('отправлено: код, имя, ответы по task_id (номер варианта строкой)', sentRpc.args.p_code === coll.share_code && sentRpc.args.p_student_name === 'Петя Иванов' &&
    JSON.stringify(sentRpc.args.p_answers) === JSON.stringify([{ task_id: 't1', answer: String(right0) }, { task_id: 't2', answer: '0' }, { task_id: 't3', answer: '0.5' }, { task_id: 't4', answer: '' }]),
    JSON.stringify(sentRpc.args));
  ok('ученик видит «Ответы отправлены» и «Верно: 2 из 3», без оценки', /Ответы отправлены учителю/.test(await text(s, '.cn-done')) &&
    (await text(s, '.cn-done .score')) === 'Верно: 2 из 3' && /на проверке у учителя: 1/.test(await text(s, '.cn-done')) && /Оценку поставит учитель/.test(await text(s, '.cn-done')));
  ok('в базе: ждёт проверки учителем', sub && sub.status === 'pending' && sub.score === 2 && sub.student_name === 'Петя Иванов');
  if (process.env.SHOTS) await s.screenshot({ path: path.join(process.env.SHOTS, 'coll-sent.png'), fullPage: true });
  const overS = await s.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('телефон 390 px: страница ученика не шире экрана', overS <= 0, String(overS));

  /* ошибки и код */
  await s.goto(page_('collection.html?code=QQQQQQ'));
  await s.waitForSelector('#codeForm');
  ok('неизвестный код — «не найдена» и поле для кода', /не найдена/.test(await text(s, '#view')));
  await s.goto(page_('collection.html'));
  await s.waitForSelector('#codeIn');
  await s.fill('#codeIn', 'abc');
  await s.click('#codeForm button');
  ok('короткий код — подсказка', await toastLike(s, /6 букв и цифр/));
  await s.fill('#codeIn', coll.share_code.toLowerCase());
  await Promise.all([s.waitForNavigation(), s.click('#codeForm button')]);
  ok('ввод кода открывает подборку', /collection\.html\?code=/.test(s.url()) && await s.waitForSelector('#solveForm').then(() => true, () => false));
  DB.task_collections.push(Object.assign(clone(coll), { id: 'c-priv', share_code: 'PRVT22', is_public: false }));
  DB.task_collections.push(Object.assign(clone(coll), { id: 'c-old', share_code: 'EXPR22', expires_at: new Date(Date.now() - 1000).toISOString() }));
  await s.goto(page_('collection.html?code=PRVT22'));
  await s.waitForSelector('#gIn');
  ok('только с аккаунтом — просьба войти', /только для учеников с аккаунтом/.test(await text(s, '#view')));
  await s.goto(page_('collection.html?code=EXPR22'));
  await s.waitForSelector('#codeForm');
  ok('просроченная — «срок закончился»', /Срок этой подборки закончился/.test(await text(s, '#view')));
  DB.task_collections = DB.task_collections.filter(c => c.id === coll.id);

  /* ========== учитель: ответы и проверка ========== */
  await t.reload();
  await t.waitForSelector('.cl-card');
  ok('карточка: 1 ответ, ждёт проверки', /Ответов: 1/.test(await text(t, '.cl-card')) && /ждут проверки: 1/.test(await text(t, '.cl-card')));
  await t.click('.cl-card [data-act="results"]');
  await t.waitForSelector('.cl-card .ctable');
  const row = await text(t, '.cl-card .ctable tbody tr');
  ok('таблица: ученик, верно 2/4, 50 %, ждёт проверки', /Петя Иванов/.test(row) && /2 \/ 4/.test(row) && /50%/.test(row) && /ждёт проверки/.test(row), row);
  await t.click('.cl-card [data-review]');
  await t.waitForSelector('.modal .cl-review');
  const rv = await text(t, '.modal .cl-review');
  ok('проверка: задания, ответы ученика, верные ответы', /Петя Иванов/.test(rv) && /54/.test(rv) && /Верный ответ: 56/.test(rv) && /0\.5/.test(rv) && /нет ответа/.test(rv));
  ok('автопроверка уже отмечена', (await t.$eval('.modal [data-task="t2"] [data-mark="false"]', b => b.getAttribute('aria-pressed'))) === 'true' &&
    (await t.$eval('.modal [data-task="t3"] [data-mark="true"]', b => b.getAttribute('aria-pressed'))) === 'true');
  await t.click('.modal [data-task="t4"] [data-mark="true"]');
  await t.fill('.modal #rvComment', 'Хорошо, но повтори таблицу умножения');
  if (process.env.SHOTS) await t.screenshot({ path: path.join(process.env.SHOTS, 'coll-review.png') });
  await t.click('.modal [data-save]');
  await t.waitForFunction(() => !document.querySelector('.modal'));
  const rr = CALLS.filter(c => c.fn === 'review_collection_submission').pop();
  ok('проверка отправлена: отметка открытого и комментарий', rr.args.p_id === sub.id && JSON.stringify(rr.args.p_marks) === '{"t4":true}' && rr.args.p_comment === 'Хорошо, но повтори таблицу умножения');
  await t.waitForFunction(() => /проверено/.test(document.querySelector('.cl-card .ctable tbody tr').textContent));
  ok('после проверки: 3/4, 75 %, проверено', /3 \/ 4/.test(await text(t, '.cl-card .ctable tbody tr')) && /75%/.test(await text(t, '.cl-card .ctable tbody tr')));

  /* язык, телефон, удаление */
  await t.evaluate(() => Sky.setLang('en'));
  ok('английский интерфейс', (await text(t, '#newBtn')) === 'New collection' && /^All/.test(await text(t, '#catTabs .cl-tab')) && /Tasks: 4/.test(await text(t, '.cl-card')));
  await t.evaluate(() => Sky.setLang('ru'));
  await t.setViewportSize({ width: 390, height: 844 });
  await t.waitForTimeout(300);
  const overT = await t.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('телефон 390 px: страница учителя не шире экрана', overT <= 0, String(overT) + ' ' + await t.evaluate(() =>
    [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 6)
      .map(e => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)).join(' | ')));
  if (process.env.SHOTS) await t.screenshot({ path: path.join(process.env.SHOTS, 'coll-teacher-phone.png'), fullPage: true });
  await t.setViewportSize({ width: 1150, height: 900 });
  await t.click('.cl-card [data-act="del"]');
  await t.waitForSelector('#colls .empty');
  ok('удаление подборки — и её ответов', !DB.task_collections.length && !DB.collection_submissions.length);
  await t.click('#catDel');
  await t.waitForFunction(() => !/Дроби/.test(document.querySelector('#catTabs').textContent));
  ok('удаление категории', !DB.task_categories.length);
  await t.close();

  /* без входа страница учителя просит войти */
  const actx = await context(null);
  const a = await open(actx, 'collections.html');
  await a.waitForSelector('#gIn');
  ok('без входа — «Войдите», поле для кода на месте', /Войдите, чтобы собирать подборки/.test(await text(a, '#gate')) && await shown(a, '#codeForm') && !(await shown(a, '#app')));
  await a.close();

  /* homework.html: у ученика — поле «Код подборки» */
  const stctx = await context({ id: 'u-stud', email: 'kid@test', name: 'Саша', role: 'student' });
  DB.profiles.push({ id: 'u-stud', name: 'Саша', role: 'student' });
  const h = await open(stctx, 'homework.html');
  await h.waitForSelector('#studentView:not(.hidden)');
  ok('homework.html: у ученика поле «Код подборки»', /Есть код подборки/.test(await text(h, '#studentView')) && await shown(h, '#collCodeIn'));
  await h.fill('#collCodeIn', 'A3K7MN');
  await Promise.all([h.waitForNavigation(), h.click('#collCodeForm button')]);
  ok('homework.html: код ведёт на collection.html?code=', h.url().endsWith('/collection.html?code=A3K7MN'));
  await h.close();

  ok('ошибок JavaScript на страницах нет', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
