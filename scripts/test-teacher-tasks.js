/* ============================================================
   Свои задания учителя («Мои задания» в collections.html,
   assets/teacher-tasks.js) в настоящем браузере.

   Запуск:  node scripts/test-teacher-tasks.js

   Supabase подменён (scripts/lib/fake-supabase.js), Worker /check-photo
   — маршрутом. Проверяем: создать вручную (ошибки — под полем), с фото
   (распознанный текст и варианты), фильтр и поиск, правка, удаление,
   «В подборку» — в существующую и в новую, вкладка «Мои задания» в
   окне новой подборки, сбой загрузки, телефон, английский.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);
const SHOTS = process.env.SHOTS;
const shot = (page, name, full) => SHOTS ? page.screenshot({ path: path.join(SHOTS, name), fullPage: !!full }) : null;

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

/* PNG 2×2 — настоящая картинка: страница рисует её на canvas и сжимает */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64');
const C1 = 'c2222222-0000-4000-8000-000000000001';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let photoCalls = [];

  async function open(o) {
    o = o || {};
    const fake = createBackend({
      users: [{ id: 'u-t', email: 'olga@school.test' }, { id: 'u-x', email: 'boris@school.test' }],
      tables: {
        profiles: [{ id: 'u-t', name: 'Ольга Петровна', role: 'teacher' }, { id: 'u-x', name: 'Борис', role: 'teacher' }],
        teacher_tasks: o.tasks || [{ id: 'tt-foreign', teacher_id: 'u-x', subject: 'math', task_text: 'Чужое задание', source: 'manual', created_at: new Date(Date.now() - 9e6).toISOString() }],
        task_categories: [],
        task_collections: [{ id: C1, teacher_id: 'u-t', title: 'Дроби — разминка', subject: 'math', share_code: 'A3K7MN', is_public: true, created_at: new Date(Date.now() - 5e6).toISOString(),
          tasks: [{ id: 't1', type: 'choice', text: '1 + 1 = ?', options: ['1', '2'], answer: 1 }] }],
        collection_submissions: []
      },
      /* как RLS: только свои задания и подборки */
      visible: (table, row, uid) => ['teacher_tasks', 'task_collections'].includes(table) ? row.teacher_id === uid : true,
      guard: (m, uid) => (m.table === 'teacher_tasks' && m.op === 'insert' && [].concat(m.payload).some(r => r.teacher_id !== uid))
        ? { message: 'new row violates row-level security policy for table "teacher_tasks"', code: '42501' } : null,
      selectError: o.failOnce ? m => (m.table === 'teacher_tasks' && o.failOnce.n-- > 0 ? { message: 'Failed to fetch', status: 0 } : null) : null
    });
    const ctx = await browser.newContext({ locale: o.en ? 'en-US' : 'ru-RU', viewport: o.viewport || { width: 1150, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    await ctx.route(/workers\.dev\/+check-photo$/, async r => {
      photoCalls.push(JSON.parse(r.request().postData() || '{}'));
      const bad = o.photoFail && o.photoFail.n-- > 0;
      return r.fulfill({ status: bad ? 502 : 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(bad ? { error: 'Модель не ответила' }
          : { grade: 4, recognized_text: '7. Сколько будет 7 · 8?\nА) 54\nБ) 56\nВ) 58', ai_feedback: '—' }) });
    });
    if (o.en) await ctx.addInitScript(() => localStorage.setItem('sky_lang', '"en"'));
    await fake.install(ctx, { session: 'u-t' });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    page.on('dialog', d => d.accept());
    await page.goto(url('collections.html' + (o.hash || '')));
    await page.waitForSelector('#app:not(.hidden)');
    await page.waitForTimeout(200);
    return { page, ctx, fake };
  }
  const text = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const modalGone = page => page.waitForFunction(() => !document.querySelector('.modal-bg'));

  /* ---------- пусто → создать вручную ---------- */
  let { page, ctx, fake } = await open();
  ok('вкладки «Подборки | Мои задания», открыты подборки', (await text(page, '#clViews')).startsWith('Подборки Мои задания') && !(await page.$eval('#viewColls', e => e.classList.contains('hidden'))));
  await page.click('[data-view="tasks"]');
  await page.waitForSelector('#viewTasks .empty');
  ok('своих нет — пояснение и «Создать задание», чужие не видны', /Своих заданий пока нет/.test(await text(page, '#viewTasks')) && !/Чужое/.test(await text(page, '#viewTasks')));
  ok('адрес — #tasks (вкладку можно открыть ссылкой)', new URL(page.url()).hash === '#tasks');

  await page.click('#viewTasks [data-tt="new"]');
  await page.waitForSelector('.tt-form');
  await page.click('#ttSave');
  ok('пустой текст — ошибка красным под полем', (await text(page, '#ttTextErr')) === 'Впишите текст задания' &&
    await page.$eval('#ttTextErr', e => e.closest('.field').classList.contains('invalid')));
  await page.fill('#ttTextIn', 'Сколько будет 2 + 2?');
  ok('поправил поле — ошибка ушла', (await text(page, '#ttTextErr')) === '');
  const opts = await page.$$('#ttOptRows input[type=text]');
  await opts[0].fill('3'); await opts[1].fill('4'); await opts[2].fill('5');
  await page.click('#ttSave');
  ok('не отмечен верный вариант — ошибка под вариантами', (await text(page, '#ttOptErr')) === 'Отметьте верный вариант');
  await page.check('#ttOptRows .tt-opt:nth-child(2) input[type=radio]');
  await page.fill('#ttExplIn', 'Два и два — четыре');
  await page.click('#ttSave');
  await modalGone(page);
  const row1 = fake.tables.teacher_tasks.find(x => x.task_text === 'Сколько будет 2 + 2?');
  ok('сохранено: свой teacher_id, варианты, верный — номер «1», объяснение, вручную', row1 && row1.teacher_id === 'u-t' &&
    JSON.stringify(row1.options) === '["3","4","5"]' && row1.correct_answer === '1' && row1.explanation === 'Два и два — четыре' && row1.source === 'manual', JSON.stringify(row1));
  await page.waitForSelector('.tt-card');
  ok('карточка: варианты, верный отмечен ✓, предмет и «варианты: 3»', /Б\. 4 ✓/.test(await text(page, '.tt-card .tt-opts li.ok')) &&
    /Математика/.test(await text(page, '.tt-card .tt-meta')) && /варианты: 3/.test(await text(page, '.tt-card .tt-meta')));
  ok('счётчик на вкладке — 1', (await text(page, '#ttN')) === '1');

  /* ответ словом, другой предмет */
  await page.click('#viewTasks [data-tt="new"]');
  await page.waitForSelector('.tt-form');
  await page.selectOption('#ttSubjIn', 'russian');
  await page.fill('#ttTextIn', 'Подберите синоним к слову «быстрый»');
  await page.click('[data-kind="text"]');
  await page.click('#ttSave');
  ok('ответ словом без ответа — подсказка «или выберите Проверю сам»', /Проверю сам/.test(await text(page, '#ttAcceptErr')));
  await page.fill('#ttAcceptIn', ' скорый ;стремительный ');
  await page.click('#ttSave');
  await modalGone(page);
  const row2 = fake.tables.teacher_tasks.find(x => x.subject === 'russian');
  ok('ответы через «;» сохранены аккуратно', row2 && row2.correct_answer === 'скорый; стремительный' && row2.options === null, JSON.stringify(row2));
  ok('новое — сверху, «✓ скорый / стремительный»', /скорый \/ стремительный/.test(await text(page, '.tt-card:first-child .tt-ans')));

  /* фильтр и поиск */
  await page.selectOption('#ttSubj', 'russian');
  ok('фильтр «Русский язык» — одно задание', (await page.$$('.tt-card')).length === 1 && /синоним/.test(await text(page, '.tt-card')));
  await page.selectOption('#ttSubj', '');
  await page.fill('#ttQ', '2 + 2');
  ok('поиск по тексту', (await page.$$('.tt-card')).length === 1 && /2 \+ 2/.test(await text(page, '.tt-card')));
  await page.fill('#ttQ', 'нет такого');
  ok('ничего не нашлось — пояснение', /Ничего не нашлось/.test(await text(page, '#viewTasks')));
  await page.fill('#ttQ', '');

  /* правка и удаление */
  await page.click('.tt-card:last-child [data-tt="edit"]');
  await page.waitForSelector('.tt-form');
  ok('правка: поля заполнены, верный отмечен', (await page.$eval('#ttTextIn', e => e.value)) === 'Сколько будет 2 + 2?' &&
    await page.$eval('#ttOptRows .tt-opt:nth-child(2) input[type=radio]', e => e.checked));
  await page.fill('#ttTextIn', 'Сколько будет два плюс два?');
  await page.click('#ttSave');
  await modalGone(page);
  ok('правка сохранена', fake.tables.teacher_tasks.some(x => x.id === row1.id && x.task_text === 'Сколько будет два плюс два?'));

  /* ---------- «В подборку»: в существующую ---------- */
  await page.click(`.tt-card[data-id="${row1.id}"] [data-tt="add"]`);
  await page.waitForSelector('.tt-add');
  ok('окно «Добавить в подборку»: подборка учителя, отмечена', /Дроби — разминка/.test(await text(page, '.tt-add-list')) && await page.$eval('.tt-add-item input', e => e.checked));
  await page.click('.tt-add [data-go]');
  await modalGone(page);
  const coll = fake.tables.task_collections.find(c => c.id === C1);
  const added = coll.tasks[1] || {};
  ok('задание дописано в подборку: выбор, верный 1, объяснение, источник', coll.tasks.length === 2 && added.type === 'choice' && added.answer === 1 &&
    added.explanation === 'Два и два — четыре' && added.source === 'teacher:' + row1.id && /^tt-/.test(added.id), JSON.stringify(added));
  ok('подтверждение «Добавлено в …»', /Добавлено в «Дроби — разминка»/.test(await page.evaluate(() => (document.querySelector('.toast') || {}).textContent || '')));
  await page.click(`.tt-card[data-id="${row1.id}"] [data-tt="add"]`);
  await page.waitForSelector('.tt-add');
  ok('второй раз — подборка помечена ✓ и недоступна', await page.$eval('.tt-add-item input', e => e.disabled) && /✓/.test(await text(page, '.tt-add-item')));
  /* в новую */
  await page.click('.tt-add [data-new]');
  await page.waitForSelector('.cl-new');
  ok('«Новая подборка с этим заданием» — окно подборки, задание уже в ней', (await text(page, '#nCount')) === '1' && /два плюс два/.test(await text(page, '#nPicked')));
  await page.click('#nSrc [data-src="mine"]');
  await page.waitForSelector('#mList .cl-bt');
  ok('в окне подборки — вкладка «Мои задания», выбранное отмечено', (await page.$$('#mList .cl-bt')).length === 2 && (await page.$$('#mList .cl-bt.on')).length === 1);
  await page.click('#mList .cl-bt:not(.on)');
  ok('выбрал второе — заданий 2', (await text(page, '#nCount')) === '2');
  await page.fill('#nTitle', 'Свои задания');
  await page.click('.cl-new [data-go]');
  await modalGone(page);
  const made = fake.tables.task_collections.find(c => c.title === 'Свои задания');
  ok('подборка создана из своих заданий: выбор и ответ словом', made && made.tasks.length === 2 && made.tasks[0].type === 'choice' &&
    made.tasks[1].type === 'text' && JSON.stringify(made.tasks[1].accept) === '["скорый","стремительный"]', made && JSON.stringify(made.tasks));
  await shot(page, 'teacher-tasks.png');

  await page.click('[data-view="tasks"]');
  await page.click(`.tt-card[data-id="${row2.id}"] [data-tt="del"]`);
  await page.waitForFunction(id => !document.querySelector(`.tt-card[data-id="${id}"]`), row2.id);
  ok('удаление (с подтверждением) — задания нет и в базе', !fake.tables.teacher_tasks.some(x => x.id === row2.id));
  await ctx.close();

  /* ---------- с фото ---------- */
  photoCalls = [];
  ({ page, ctx, fake } = await open({ hash: '#tasks', photoFail: { n: 1 } }));
  await page.waitForSelector('#viewTasks .empty');
  ok('ссылка #tasks сразу открывает «Мои задания»', !(await page.$eval('#viewTasks', e => e.classList.contains('hidden'))));
  await page.click('#viewTasks [data-tt="new-photo"]');
  await page.waitForSelector('.tt-form #ttPhotoPane:not(.hidden)');
  ok('«С фото» — подсказка, что тратится проверка; «Распознать» неактивна', /тратит одну проверку/.test(await text(page, '#ttPhotoPane')) && await page.$eval('#ttOcr', b => b.disabled));
  await page.setInputFiles('#ttFile', { name: 'task.png', mimeType: 'image/png', buffer: PNG });
  await page.click('#ttOcr');
  await page.waitForSelector('#ttOcrMsg.bad');
  ok('Worker не ответил — ошибка с причиной', /Не удалось распознать: Модель не ответила/.test(await text(page, '#ttOcrMsg')));
  await page.click('#ttOcr');
  await page.waitForSelector('#ttOcrMsg.ok');
  const sent = photoCalls[1] || {};
  ok('на /check-photo — сжатое JPEG, предмет, язык', /^data:image\/jpeg;base64,/.test(sent.imageBase64 || '') && sent.subject === 'Математика' && sent.lang === 'ru', JSON.stringify(Object.assign({}, sent, { imageBase64: String(sent.imageBase64 || '').slice(0, 30) })));
  const form = await page.evaluate(() => ({ text: document.querySelector('#ttTextIn').value,
    opts: [...document.querySelectorAll('#ttOptRows input[type=text]')].map(i => i.value), msg: document.querySelector('#ttOcrMsg').textContent }));
  ok('распознано: вопрос в поле, «А) Б) В)» — в варианты, просьба отметить верный', form.text === '7. Сколько будет 7 · 8?' &&
    JSON.stringify(form.opts.slice(0, 3)) === '["54","56","58"]' && /Нашлись варианты ответа: 3/.test(form.msg), JSON.stringify(form));
  await page.check('#ttOptRows .tt-opt:nth-child(2) input[type=radio]');
  await page.click('#ttSave');
  await modalGone(page);
  const ph = fake.tables.teacher_tasks.find(x => x.source === 'photo');
  ok('сохранено с источником «с фото», пустой вариант отброшен', ph && JSON.stringify(ph.options) === '["54","56","58"]' && ph.correct_answer === '1', JSON.stringify(ph));
  ok('в карточке — метка «с фото»', /с фото/.test(await text(page, '.tt-card .tt-meta')));
  await ctx.close();

  /* ---------- сбой загрузки, телефон, английский ---------- */
  ({ page, ctx } = await open({ hash: '#tasks', failOnce: { n: 1 } }));
  await page.waitForSelector('#viewTasks [data-tt="retry"]');
  ok('сбой загрузки — «Не удалось загрузить» и «Повторить», а не «пусто»', /Не удалось загрузить задания/.test(await text(page, '#viewTasks')) && !/пока нет/.test(await text(page, '#viewTasks')));
  await page.click('#viewTasks [data-tt="retry"]');
  await page.waitForSelector('#viewTasks .empty b');
  ok('«Повторить» — загрузилось', /Своих заданий пока нет/.test(await text(page, '#viewTasks')));
  await ctx.close();

  ({ page, ctx } = await open({ hash: '#tasks', viewport: { width: 360, height: 740 }, mobile: true,
    tasks: [{ id: 'tt-a', teacher_id: 'u-t', subject: 'math', task_text: 'Очень длинное задание '.repeat(12), options: ['1', '2', '3'], correct_answer: '0', source: 'photo', created_at: new Date().toISOString() }] }));
  await page.waitForSelector('.tt-card');
  ok('телефон 360 px: список не листается вбок', await page.evaluate(() => document.documentElement.scrollWidth) <= 360);
  await page.click('.tt-card [data-tt="edit"]');
  await page.waitForSelector('.tt-form');
  await page.waitForTimeout(400);                 /* окно открывается с лёгким увеличением — дождаться конца */
  const h = await page.evaluate(() => {
    const m = document.querySelector('.modal').getBoundingClientRect();
    const out = [...document.querySelectorAll('.tt-form .field, .tt-form .seg, .tt-form .tt-opt, .tt-form .tt-end')]
      .filter(el => el.getBoundingClientRect().right > m.right - 8).map(el => el.className || el.id);
    return { sw: document.documentElement.scrollWidth, opt: Math.round(document.querySelector('.tt-opt input[type=text]').getBoundingClientRect().height), out };
  });
  ok('телефон: форма не вылезает за край окна, поля вариантов ≥ 44 px', h.sw <= 360 && h.opt >= 44 && !h.out.length, JSON.stringify(h));
  await shot(page, 'teacher-tasks-phone.png');
  await ctx.close();

  ({ page, ctx } = await open({ en: true, hash: '#tasks' }));
  await page.waitForSelector('#viewTasks .empty');
  ok('английский: «My tasks», «No tasks of your own yet»', /My tasks/.test(await text(page, '#clViews')) && /No tasks of your own yet/.test(await text(page, '#viewTasks')));
  await ctx.close();

  ok('без ошибок на странице', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
