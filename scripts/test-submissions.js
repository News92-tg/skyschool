/* ============================================================
   Связь ученик ↔ учитель: «Новые работы» в профиле
   (assets/submissions.js), отправка работы учителю по ссылке
   photo.html?to=<id учителя> и «Проверить» → collections.html?review=.

   Запуск:  node scripts/test-submissions.js

   Supabase и Worker подменены. teacher_inbox() в базе проверяет
   scripts/test-rls.sh, приём работы с teacher_id — test-worker.js.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = (f, q) => 'file://' + path.join(ROOT, f) + (q || '');
const WORKER = 'https://news92-orders.almazpro0927.workers.dev';
const IMG = path.join(ROOT, 'assets', 'icon-192.png');
const TID = 'aaaaaaaa-0000-4000-8000-00000000000a';

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

const ago = m => new Date(Date.now() - m * 60e3).toISOString();
const INBOX = [
  { kind: 'photo', id: 'p1', student_name: 'Петя', class: '7А', subject: 'physics', status: 'pending', created_at: ago(5) },
  { kind: 'collection', id: 's1', student_name: 'Маша', title: 'Дроби', subject: 'math', score: 7, total: 10, percent: 70, status: 'pending', created_at: ago(30) },
  ...['Аня', 'Боря', 'Вика', 'Гоша'].map((n, i) => ({ kind: 'collection', id: 's' + (i + 2), student_name: n, title: 'Дроби', score: 1, total: 10, status: 'pending', created_at: ago(60 * (i + 2)) }))
];

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(file, q, o) {
    o = o || {};
    const worker = { calls: [] };
    const fake = createBackend({
      users: [{ id: TID, email: 'olga@school.test' }, { id: 'u-s', email: 'vanya@school.test' }],
      tables: Object.assign({
        profiles: [{ id: TID, email: 'olga@school.test', name: 'Ольга Сергеевна', role: 'teacher', onboarding_done: true },
                   { id: 'u-s', email: 'vanya@school.test', name: 'Ваня', role: 'student' }],
        user_telegram: [], user_plans: [], plan_limits: []
      }, o.tables || {}),
      rpc: {
        my_stats: () => ({ checks_total: 6 }),
        is_admin: () => false,
        teacher_inbox: (a, uid) => {
          worker.inboxCalls = (worker.inboxCalls || 0) + 1;
          if (o.inboxFail && o.inboxFail.n-- > 0) throw Object.assign(new Error('upstream'), { code: 'XX000' });
          return uid === TID ? (o.inbox || INBOX) : [];
        }
      }
    });
    const ctx = await browser.newContext({ locale: 'ru-RU', viewport: o.viewport || { width: 1100, height: 900 }, isMobile: !!o.mobile, hasTouch: !!o.mobile, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co/, r => r.abort());
    await ctx.route(WORKER + '/**', async route => {
      const req = route.request();
      const u = new URL(req.url());
      worker.calls.push({ path: u.pathname, search: u.search, method: req.method() });
      const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
      if (u.pathname === '/health') return reply(200, { endpoints: ['/api/check-photo', '/notify', '/api/telegram/bot'] });
      if (u.pathname === '/api/limits') return reply(200, { plan: 'free', limits: { requests: 1, window_seconds: 600, photos: 5 }, features: {}, rate: { remaining: 1 } });
      if (u.pathname === '/api/telegram/bot') return reply(200, { ready: false });
      if (u.pathname === '/api/submit-homework') return reply(201, { id: 'dddddddd-0000-4000-8000-00000000000d', url: 'https://x/photo.html?hw=dddddddd-0000-4000-8000-00000000000d', teacher: !!u.searchParams.get('teacher_id') });
      return reply(404, { error: 'not found' });
    });
    await fake.install(ctx, { session: o.session === undefined ? TID : o.session });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(file + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(file + ': ' + m.text()); });
    await page.goto(url(file, q));
    await page.evaluate(() => Sky.db.ready);
    await page.waitForTimeout(500);
    return { page, ctx, fake, worker };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);

  /* ---------- профиль учителя ---------- */
  let { page, ctx, worker } = await open('profile.html');
  await page.waitForSelector('#inbox', { timeout: 4000 }).catch(() => {});
  ok('«Новые работы» — первым разделом, значок с числом 6', await page.$eval('#pfSections > section', s => s.id) === 'inbox' && await text(page, '#inbox .ib-badge') === '6');
  const rows = await page.$$eval('#inbox .ib-row', r => r.map(x => ({ n: x.querySelector('b').textContent, w: x.querySelector('.ib-txt span').textContent, a: x.querySelector('a').getAttribute('href') })));
  ok('показаны 5 последних, остальное — «Показать все (6)»', rows.length === 5 && await text(page, '[data-ib=more]') === 'Показать все (6)');
  ok('работа по фото: имя, «Работа по фото · Физика · 7А», «Проверить» → photo.html?hw=', rows[0].n === 'Петя' && rows[0].w === 'Работа по фото · Физика · 7А' && rows[0].a === 'photo.html?hw=p1', JSON.stringify(rows[0]));
  ok('работа по подборке: «Дроби · 7 из 10», «Проверить» → collections.html?review=', rows[1].n === 'Маша' && rows[1].w === 'Дроби · 7 из 10' && rows[1].a === 'collections.html?review=s1', JSON.stringify(rows[1]));
  ok('когда пришла: «5 мин назад»', await page.$eval('#inbox .ib-when', e => e.textContent) === '5 мин назад');
  await page.click('[data-ib=more]');
  ok('«Показать все» — все 6', (await page.$$('#inbox .ib-row')).length === 6);
  ok('ссылка для учеников — photo.html?to=<id учителя>', /\/photo\.html\?to=aaaaaaaa-0000-4000-8000-00000000000a$/.test(await page.$eval('#inbox .ib-link input', i => i.value)));
  await page.click('[data-ib=copy]');
  await page.waitForTimeout(200);
  ok('«Копировать» — ссылка в буфере', /photo\.html\?to=aaaaaaaa/.test(await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))));
  await ctx.close();

  ({ page, ctx } = await open('profile.html', '', { inbox: [] }));
  ok('пусто — «Новых работ нет — всё проверено», без значка', /Новых работ нет/.test(await text(page, '#inbox .ib-empty')) && !(await page.$('#inbox .ib-badge')));
  await ctx.close();

  ({ page, ctx, worker } = await open('profile.html', '', { inboxFail: { n: 1 } }));
  ok('не загрузилось — сообщение и «Повторить»', /не загрузился/.test(await text(page, '#inbox .ib-empty')) && /Повторить/.test(await text(page, '.sx-acts') || ''));
  await page.click('.sx .sx-btn');
  await page.waitForSelector('#inbox .ib-row', { timeout: 3000 }).catch(() => {});
  ok('«Повторить» — список на месте', (await page.$$('#inbox .ib-row')).length === 5);
  await ctx.close();

  ({ page, ctx } = await open('profile.html', '', { session: 'u-s' }));
  ok('у ученика раздела «Новые работы» нет', !(await page.$('#inbox')));
  await ctx.close();

  ({ page, ctx } = await open('profile.html', '', { viewport: { width: 360, height: 800 }, mobile: true }));
  await page.waitForSelector('#inbox .ib-row');
  ok('телефон: список без прокрутки вбок', await page.evaluate(() => document.documentElement.scrollWidth) <= 360);
  await ctx.close();

  /* ---------- ученик сдаёт работу по ссылке учителя ---------- */
  ({ page, ctx, worker } = await open('photo.html', '?to=' + TID, { session: null }));
  const v = await page.evaluate(() => ({
    teacher: !document.getElementById('teacherMode').classList.contains('hidden'),
    modeBar: getComputedStyle(document.querySelector('.mode-bar')).display,
    tabs: getComputedStyle(document.getElementById('tTabs')).display,
    check: getComputedStyle(document.querySelectorAll('#tab-links > .panel')[1]).display,
    links: !document.getElementById('tab-links').classList.contains('hidden')
  }));
  ok('?to=: только форма «Отправить работу учителю» — без выбора режима, вкладок и проверки по ссылкам',
    v.teacher && v.links && v.modeBar === 'none' && v.tabs === 'none' && v.check === 'none', JSON.stringify(v));
  await page.waitForFunction(() => /Ольга Сергеевна/.test((document.getElementById('lToNote') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => {});
  ok('видно, кому уйдёт работа: «…учителю: Ольга Сергеевна»', /учителю: Ольга Сергеевна/.test(await text(page, '#lToNote')), await text(page, '#lToNote'));
  ok('заголовок — «Отправить работу учителю»', await text(page, '#tab-links .panel h2') === 'Отправить работу учителю');
  await page.fill('#lName', 'Петя Иванов');
  await page.fill('#lClass', '7А');
  await page.setInputFiles('#lFile', IMG);
  await page.waitForFunction(() => !document.getElementById('lSend').disabled, null, { timeout: 3000 }).catch(() => {});
  await page.click('#lSend');
  await page.waitForFunction(() => /у учителя/.test((document.querySelector('.toast.show') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const sub = worker.calls.find(c => c.path === '/api/submit-homework') || {};
  const sp = new URLSearchParams(sub.search || '');
  ok('отправка: POST /api/submit-homework с teacher_id учителя', sub.method === 'POST' && sp.get('teacher_id') === TID && sp.get('student_name') === 'Петя Иванов' && sp.get('class') === '7А', JSON.stringify(sub));
  ok('ученику — «Готово! Работа у учителя»', /Работа у учителя/.test(await text(page, '.toast')));
  await ctx.close();

  ({ page, ctx, worker } = await open('photo.html', '?to=not-a-uuid', { session: null }));
  ok('?to= с мусором — обычная страница, без режима отправки', !(await page.$('#lToNote')) && await page.evaluate(() => !document.querySelector('#teacherMode.send-to')));
  await ctx.close();

  /* ---------- «Проверить» → collections.html?review= ---------- */
  const coll = { id: 'c1', teacher_id: TID, title: 'Дроби', share_code: 'KX7P2M', is_public: true, created_at: ago(600),
    tasks: [{ id: 't1', type: 'text', text: 'Объясни, почему 1/2 = 2/4' }] };
  const csub = { id: 's1', collection_id: 'c1', student_name: 'Маша', answers: [{ task_id: 't1', answer: 'Потому что…', correct: null }], score: 0, percent: 0, status: 'pending', created_at: ago(30) };
  ({ page, ctx } = await open('collections.html', '?review=s1', { tables: { task_collections: [coll], collection_submissions: [csub], task_categories: [] } }));
  await page.waitForSelector('.modal .cl-review', { timeout: 4000 }).catch(() => {});
  ok('?review=<id> — открыта проверка работы Маши, подборка раскрыта',
    !!(await page.$('.modal .cl-review')) && /Маша/.test(await text(page, '.modal')) && await page.$eval('.cl-card[data-id="c1"]', c => c.classList.contains('open')));
  await ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
