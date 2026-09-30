/* ============================================================
   Знакомство учителя (onboarding.html) в настоящем браузере.

   Запуск:  node scripts/test-onboarding.js

   Supabase подменён (scripts/lib/fake-supabase.js). Проверяем путь
   целиком: предметы → первая подборка → «Готово» и что записано в
   базу; кто мастер НЕ видит; черновик переживает перезагрузку.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

const TEACHER = { id: 'u-t', email: 't@school.test', name: 'Ольга Сергеевна', role: 'teacher', onboarding_done: false, subjects: [] };
const STUDENT = { id: 'u-s', email: 's@school.test', name: 'Ваня', role: 'student', onboarding_done: false };

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(o) {
    const fake = createBackend({
      users: [TEACHER, STUDENT].map(p => ({ id: p.id, email: p.email })),
      tables: Object.assign({ profiles: [Object.assign({}, TEACHER), Object.assign({}, STUDENT)], task_collections: [] }, o.tables || {}),
      guard: (m) => {
        if (m.table === 'task_collections' && m.op === 'insert') {
          const row = Array.isArray(m.payload) ? m.payload[0] : m.payload;
          row.teacher_id = row.teacher_id || o.session;
          row.share_code = 'KX7P2M';
        }
        return null;
      }
    });
    const ctx = o.ctx || await browser.newContext({ locale: 'ru-RU', viewport: o.viewport || { width: 1100, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    await fake.install(ctx, { session: o.session });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    const nav = page.waitForRequest(r => r.isNavigationRequest() && !/\/onboarding\.html$/.test(new URL(r.url()).pathname), { timeout: 4000 }).catch(() => null);
    await page.goto(url('onboarding.html'));
    await page.evaluate(() => Sky.db.ready).catch(() => {});
    await page.waitForTimeout(250);
    return { page, ctx, fake, nav };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);

  /* ---------- кому мастер не показывается ---------- */
  let r = await open({ session: null });
  let went = await r.nav;
  ok('не вошёл — на регистрацию учителя с возвратом сюда', went && /auth\.html\?mode=signup&role=teacher&next=onboarding\.html$/.test(went.url()), went && went.url());
  await r.ctx.close();

  r = await open({ session: 'u-s' });
  ok('ученику — «Это знакомство для учителей» и ссылка в профиль', /для учителей/.test(await text(r.page, '#obGate')) && await r.page.$eval('#obCard', e => e.hidden));
  await r.ctx.close();

  r = await open({ session: 'u-t', tables: { task_collections: [{ id: 'c1', teacher_id: 'u-t', title: 'Уже есть', share_code: 'AAAAAA', tasks: [] }] } });
  went = await r.nav;
  ok('у учителя уже есть подборки — сразу в «Подборки»', went && /collections\.html$/.test(went.url()), went && went.url());
  ok('…и онбординг отмечен пройденным', r.fake.tables.profiles.find(p => p.id === 'u-t').onboarding_done === true);
  await r.ctx.close();

  /* ---------- путь целиком ---------- */
  r = await open({ session: 'u-t' });
  const { page, fake } = r;
  ok('шаг 1: приветствие, «Шаг 1 из 4»', /Добро пожаловать/.test(await text(page, '#obBody h1')) && await text(page, '#obCount') === 'Шаг 1 из 4');
  ok('шаг 1: три коротких предложения', (await text(page, '#obBody .lead')).split(/[.!?](\s|$)/).filter(s => s && s.trim().length > 3).length === 3);
  await page.click('[data-to="2"]');
  ok('шаг 2: восемь предметов', await page.$$eval('.ob-subj', b => b.length) === 8);
  await page.click('[data-act=subjects]');
  ok('шаг 2: без предмета дальше нельзя', await text(page, '.ob-err') === 'Выберите хотя бы один предмет');
  await page.click('[data-subj=math]');
  await page.click('[data-subj=physics]');
  await page.click('[data-subj=history]');
  await page.click('[data-subj=history]');
  ok('шаг 2: мультивыбор, повторный клик снимает', await page.$$eval('.ob-subj[aria-pressed=true]', b => b.map(x => x.dataset.subj).join()) === 'math,physics');
  await page.click('[data-act=subjects]');
  await page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '3');
  ok('предметы сохранены в profiles.subjects', JSON.stringify(fake.tables.profiles.find(p => p.id === 'u-t').subjects) === '["math","physics"]');

  ok('шаг 3: название подставлено по предмету', await page.$eval('#obTitle', e => e.value) === 'Проверочная: Математика');
  ok('шаг 3: предметы — только выбранные', await page.$$eval('#obSubj option', o => o.map(x => x.value).join()) === 'math,physics');
  await page.click('#obBody [type=submit]');
  ok('шаг 3: без задания — «Напишите задание»', await text(page, '.ob-err') === 'Напишите задание');
  await page.fill('#obQ', 'Сколько будет 7 × 8?');
  await page.fill('[data-opt="0"]', '54');
  await page.fill('[data-opt="1"]', '56');
  await page.click('#obBody [type=submit]');
  ok('шаг 3: без верного — «Отметьте верный вариант»', await text(page, '.ob-err') === 'Отметьте верный вариант');

  /* черновик переживает перезагрузку */
  await page.click('[data-to="2"]');
  await page.reload();
  await page.evaluate(() => Sky.db.ready);
  await page.waitForFunction(() => document.querySelector('#obBody') && document.querySelector('#obBody').dataset.step === '2', null, { timeout: 4000 }).catch(() => {});
  ok('перезагрузка: остались на шаге 2 с теми же предметами', await page.$$eval('.ob-subj[aria-pressed=true]', b => b.length) === 2);
  await page.click('[data-act=subjects]');
  await page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '3');
  ok('перезагрузка: черновик задания на месте', await page.$eval('#obQ', e => e.value) === 'Сколько будет 7 × 8?' && await page.$eval('[data-opt="1"]', e => e.value) === '56');

  await page.click('.ob-opt:nth-child(2) .ob-right');
  await page.click('#obBody [type=submit]');
  await page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '4');
  const coll = fake.tables.task_collections[0] || {};
  ok('подборка создана: название, предмет, открыта по ссылке',
    coll.title === 'Проверочная: Математика' && coll.subject === 'math' && coll.is_public === true, JSON.stringify(coll));
  ok('задание: выбор, 2 варианта, верный — «56»',
    coll.tasks && coll.tasks.length === 1 && coll.tasks[0].type === 'choice' && coll.tasks[0].options.join() === '54,56' && coll.tasks[0].answer === 1, JSON.stringify(coll.tasks));
  ok('шаг 4: «Готово!», код подборки и ссылка', await text(page, '#obBody h1') === 'Готово!' && await text(page, '.ob-code') === 'KX7P2M'
    && /collection\.html\?code=KX7P2M$/.test(await page.$eval('.ob-link input', e => e.value)));
  ok('шаг 4: «Перейти в подборки»', await page.$eval('#obGo', a => a.getAttribute('href') === 'collections.html' && a.textContent === 'Перейти в подборки'));
  await page.waitForTimeout(150);
  ok('онбординг отмечен: profiles.onboarding_done = true', fake.tables.profiles.find(p => p.id === 'u-t').onboarding_done === true);
  ok('шаг 4: «Пропустить» спрятана', await page.$eval('#obSkip', b => b.hidden));
  await r.ctx.close();

  /* ---------- ответ словом, «Сделаю позже», «Пропустить» ---------- */
  r = await open({ session: 'u-t' });
  await r.page.click('[data-to="2"]');
  await r.page.click('[data-subj=russian]');
  await r.page.click('[data-act=subjects]');
  await r.page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '3');
  await r.page.click('[data-kind=text]');
  await r.page.fill('#obQ', 'Столица России?');
  await r.page.click('#obBody [type=submit]');
  ok('ответ словом: без ответа — «Напишите правильный ответ»', await text(r.page, '.ob-err') === 'Напишите правильный ответ');
  await r.page.fill('#obAns', 'Москва; москва');
  await r.page.click('#obBody [type=submit]');
  await r.page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '4');
  const t2 = (r.fake.tables.task_collections[0] || { tasks: [{}] }).tasks[0];
  ok('ответ словом: accept — оба варианта', t2.type === 'text' && JSON.stringify(t2.accept) === '["Москва","москва"]', JSON.stringify(t2));
  await r.ctx.close();

  r = await open({ session: 'u-t' });
  await r.page.click('[data-to="2"]');
  await r.page.click('[data-subj=english]');
  await r.page.click('[data-act=subjects]');
  await r.page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '3');
  await r.page.click('[data-act=later]');
  await r.page.waitForFunction(() => document.querySelector('#obBody').dataset.step === '4');
  ok('«Сделаю позже»: финал без кода, подборка не создана', !(await r.page.$('.ob-code')) && !r.fake.tables.task_collections.length);
  await r.ctx.close();

  r = await open({ session: 'u-t' });
  const skipNav = r.page.waitForRequest(q => q.isNavigationRequest() && /profile\.html$/.test(q.url()), { timeout: 3000 }).catch(() => null);
  await r.page.click('#obSkip');
  ok('«Пропустить» — в профиль и отмечено', !!(await skipNav) && r.fake.tables.profiles.find(p => p.id === 'u-t').onboarding_done === true);
  await r.ctx.close();

  /* ---------- телефон и английский ---------- */
  r = await open({ session: 'u-t', viewport: { width: 360, height: 740 }, mobile: true });
  await r.page.click('[data-to="2"]');
  const m = await r.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cols: getComputedStyle(document.querySelector('.ob-subjects')).gridTemplateColumns.split(' ').length }));
  ok('телефон: без прокрутки вбок, предметы в 2 колонки', m.sw <= 360 && m.cols === 2, JSON.stringify(m));
  await r.page.evaluate(() => Sky.setLang('en'));
  ok('английский: «What do you teach?» и «Step 2 of 4»', await text(r.page, '#obBody h1') === 'What do you teach?' && await text(r.page, '#obCount') === 'Step 2 of 4');
  await r.ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
