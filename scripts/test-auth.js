/* ============================================================
   Страница входа (auth.html) в настоящем браузере.

   Запуск:  node scripts/test-auth.js

   Supabase подменён (scripts/lib/fake-supabase.js): страница идёт
   настоящим путём через assets/db.js, а тест видит, что именно она
   попросила у Supabase Auth.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = (f, q) => 'file://' + path.join(ROOT, f) + (q || '');

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

const USERS = [
  { id: 'u-olga', email: 'olga@school.test', password: 'secret1' },
  { id: 'u-ivan', email: 'ivan@school.test', password: 'secret1' }
];
const PROFILES = [
  { id: 'u-olga', email: 'olga@school.test', name: 'Ольга Сергеевна', role: 'teacher' },
  { id: 'u-ivan', email: 'ivan@school.test', name: 'Иван', role: 'student' }
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(q, o) {
    o = o || {};
    const fake = createBackend(Object.assign({ users: USERS, tables: { profiles: PROFILES } }, o.backend || {}));
    const ctx = await browser.newContext({ locale: o.locale || 'ru-RU', viewport: o.viewport || { width: 1150, height: 860 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    await fake.install(ctx, { session: o.session || null, recovery: o.recovery, providers: o.providers });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    await page.goto(url(o.file || 'auth.html', q));
    await page.waitForFunction(() => window.Sky && Sky.db && document.querySelector('#auTitle') ? document.querySelector('#auTitle').textContent : true);
    await page.evaluate(() => Sky.db.ready);
    await page.waitForTimeout(120);
    return { page, ctx, fake };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim()).catch(() => null);
  const visible = (page, sel) => page.$eval(sel, el => !el.hidden && el.offsetParent !== null).catch(() => false);
  const err = page => text(page, '.au-err:not([hidden])');
  const errIs = (page, want) => page.waitForFunction(w => { const e = document.querySelector('.au-err:not([hidden])'); return e && e.textContent.trim() === w; }, want, { timeout: 4000 }).then(() => true, () => false);
  /* Куда страница ушла. Ловим сам запрос перехода: целевой страницы
     может ещё не быть в этой сборке — важен адрес, а не то, открылся ли он. */
  const navTo = async (page, act, re) => {
    const req = page.waitForRequest(r => r.isNavigationRequest() && re.test(r.url()), { timeout: 5000 }).catch(() => null);
    await act();
    const r = await req;
    return r ? r.url() : page.url();
  };
  const rawKeys = page => page.evaluate(() => [...document.querySelectorAll('[data-i18n]')].filter(el => el.textContent.trim() === el.dataset.i18n).map(el => el.dataset.i18n));

  /* ---------- вход ---------- */
  let { page, ctx, fake } = await open('?next=photo.html');
  ok('вход: заголовок и вкладки', await text(page, '#auTitle') === 'С возвращением' && await visible(page, '#auTabs'));
  ok('вход: переводы на месте', !(await rawKeys(page)).length, (await rawKeys(page)).join(','));
  ok('Google не настроен — кнопки нет', !(await visible(page, '#auAlt')));

  await page.click('#auBody [type=submit]');
  ok('пустая почта — «Напишите почту», поле подсвечено', await err(page) === 'Напишите почту' && await page.$eval('#aEmail', e => e.getAttribute('aria-invalid')) === 'true');
  await page.fill('#aEmail', 'olga@');
  await page.click('#auBody [type=submit]');
  ok('опечатка в почте', await err(page) === 'Похоже, в почте опечатка');

  await page.fill('#aEmail', 'olga@school.test');
  await page.fill('#aPass', 'wrong');
  await page.click('#auBody [type=submit]');
  ok('неверный пароль — по-русски, без «Invalid login credentials»', await errIs(page, 'Неверная почта или пароль'), await err(page));

  await page.click('[data-eye=aPass]');
  ok('«Показать пароль» показывает', await page.$eval('#aPass', e => e.type) === 'text');

  await page.fill('#aPass', 'secret1');
  await Promise.all([page.waitForURL(/\/photo\.html$/, { timeout: 5000 }).catch(() => {}), page.click('#auBody [type=submit]')]);
  ok('верный пароль — назад, откуда пришли (?next=photo.html)', /\/photo\.html$/.test(page.url()), page.url());
  await ctx.close();

  for (const bad of ['https://evil.test/x.html', '//evil.test/a.html', 'javascript:alert(1)', 'auth.html']) {
    ({ page, ctx } = await open('?next=' + encodeURIComponent(bad)));
    await page.fill('#aEmail', 'olga@school.test');
    await page.fill('#aPass', 'secret1');
    const went = await navTo(page, () => page.click('#auBody [type=submit]'), /\.html($|\?)|evil|javascript/);
    ok('чужой next «' + bad + '» — не уходим, а в профиль', /\/profile\.html$/.test(went), went);
    await ctx.close();
  }

  /* ---------- регистрация ---------- */
  ({ page, ctx, fake } = await open('?mode=signup&role=teacher'));
  ok('регистрация: ?mode=signup открывает вкладку, роль «Учитель» из ?role',
    await text(page, '#auTitle') === 'Создать аккаунт' && await page.$eval('input[name=aRole][value=teacher]', e => e.checked));
  await page.fill('#aEmail', 'new@school.test');
  await page.fill('#aPass', 'secret9');
  await page.click('#auBody [type=submit]');
  ok('регистрация без имени — «Напишите имя»', await err(page) === 'Напишите имя');
  await page.fill('#aName', 'Мария Ивановна');
  await page.fill('#aPass', '123');
  await page.click('#auBody [type=submit]');
  ok('короткий пароль — подсказка', await err(page) === 'Пароль — не меньше 6 символов');
  await page.fill('#aPass', 'secret9');
  const afterUp = await navTo(page, () => page.click('#auBody [type=submit]'), /\/(profile|onboarding)\.html$/);
  const prof = fake.tables.profiles.find(p => p.email === 'new@school.test');
  ok('регистрация: профиль с ролью учителя и именем', prof && prof.role === 'teacher' && prof.name === 'Мария Ивановна', JSON.stringify(prof));
  ok('после регистрации — дальше (профиль или онбординг)', /\/(profile|onboarding)\.html$/.test(afterUp), afterUp);
  await ctx.close();

  ({ page, ctx } = await open('?mode=signup'));
  await page.fill('#aName', 'Ольга'); await page.fill('#aEmail', 'olga@school.test'); await page.fill('#aPass', 'secret1');
  await page.click('#auBody [type=submit]');
  ok('почта уже есть — «зарегистрирована — войдите»', await errIs(page, 'Эта почта уже зарегистрирована — войдите'), await err(page));
  await ctx.close();

  ({ page, ctx } = await open('?mode=signup', { backend: { confirmEmail: true } }));
  await page.fill('#aName', 'Пётр'); await page.fill('#aEmail', 'petr@school.test'); await page.fill('#aPass', 'secret1');
  await page.click('#auBody [type=submit]');
  await page.waitForFunction(() => document.querySelector('#auTitle').textContent === 'Подтвердите почту', null, { timeout: 5000 }).catch(() => {});
  ok('нужно подтвердить почту — экран с адресом', /petr@school\.test/.test(await text(page, '#auSub')), await text(page, '#auSub'));
  await ctx.close();

  /* ---------- восстановление ---------- */
  ({ page, ctx, fake } = await open('?next=collections.html'));
  await page.fill('#aEmail', 'olga@school.test');
  await page.click('.au-forgot');
  ok('«Забыли пароль?» — почта переносится', await text(page, '#auTitle') === 'Восстановить пароль' && await page.$eval('#aEmail', e => e.value) === 'olga@school.test' && !(await visible(page, '#auTabs')));
  await page.click('#auBody [type=submit]');
  await page.waitForFunction(() => document.querySelector('#auTitle').textContent === 'Проверьте почту');
  const mail = fake.state.mail[0] || {};
  ok('письмо запрошено, ссылка ведёт на auth.html?mode=reset и помнит next', mail.email === 'olga@school.test' && /auth\.html\?mode=reset&next=collections\.html$/.test(mail.redirectTo), JSON.stringify(mail));
  ok('экран «Проверьте почту» с адресом', /olga@school.test/.test(await text(page, '#auSub')));
  await ctx.close();

  ({ page, ctx } = await open('?mode=forgot', { backend: { mailWait: true } }));
  await page.fill('#aEmail', 'olga@school.test');
  await page.click('#auBody [type=submit]');
  ok('часто просят письмо — «Подождите 42 с»', await errIs(page, 'Подождите 42 с и попробуйте снова'), await err(page));
  await ctx.close();

  ({ page, ctx, fake } = await open('?mode=reset', { session: 'u-olga', recovery: true }));
  await page.waitForFunction(() => document.querySelector('#auTitle').textContent === 'Новый пароль');
  ok('по ссылке из письма — «Новый пароль»', true);
  await page.fill('#aPass', 'newpass1'); await page.fill('#aPass2', 'newpass2');
  await page.click('#auBody [type=submit]');
  ok('пароли не совпали', await err(page) === 'Пароли не совпадают');
  await page.fill('#aPass2', 'newpass1');
  const afterReset = await navTo(page, () => page.click('#auBody [type=submit]'), /\/profile\.html$/);
  ok('новый пароль сохранён и — в профиль', fake.state.passwordUpdates[0] && fake.state.passwordUpdates[0].password === 'newpass1' && /\/profile\.html$/.test(afterReset), afterReset + ' ' + JSON.stringify(fake.state.passwordUpdates));
  await ctx.close();

  /* ---------- уже вошли, Google, шапка ---------- */
  ({ page, ctx } = await open('', { session: 'u-ivan', providers: { google: true } }));
  ok('уже вошли — «Вы уже вошли» и почта', await text(page, '#auTitle') === 'Вы уже вошли' && /ivan@school.test/.test(await text(page, '#auSub')));
  ok('«Продолжить» ведёт в профиль', await page.$eval('#auBody a.btn', a => a.getAttribute('href')) === 'profile.html');
  await page.click('[data-act=out]');
  await page.waitForFunction(() => document.querySelector('#auTitle').textContent === 'С возвращением');
  ok('«Выйти» — снова экран входа', true);
  ok('Google включён — кнопка есть', await visible(page, '#auAlt'));
  await page.click('#auGoogle');
  ok('Google: возврат на auth.html', await page.evaluate(() => /auth\.html$/.test(window.__oauth.options.redirectTo) && window.__oauth.provider === 'google'));
  ok('на странице входа нет кнопки «Войти» в шапке', !(await page.$('#btnSignIn')));
  await ctx.close();

  ({ page, ctx } = await open('', { file: 'index.html' }));
  await page.waitForSelector('#btnSignIn');
  ok('шапка: «Войти» — ссылка на auth.html?next=текущая', await page.$eval('#btnSignIn', a => a.tagName === 'A' && a.getAttribute('href') === 'auth.html?next=index.html'));
  await ctx.close();

  /* ---------- телефон и английский ---------- */
  ({ page, ctx } = await open('?mode=signup', { viewport: { width: 360, height: 740 }, mobile: true }));
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, aside: getComputedStyle(document.querySelector('.au-aside')).display,
    roles: document.querySelectorAll('.au-role-card').length, card: document.querySelector('.au-card').getBoundingClientRect().width }));
  ok('телефон: без прокрутки вбок, колонка с преимуществами спрятана', m.sw <= 360 && m.aside === 'none' && m.roles === 3 && m.card <= 340, JSON.stringify(m));
  await page.evaluate(() => Sky.setLang('en'));
  ok('английский: «Create an account»', await text(page, '#auTitle') === 'Create an account' && await text(page, '#auBody [type=submit]') === 'Create account');
  await ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
