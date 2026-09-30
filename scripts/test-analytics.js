/* ============================================================
   Аналитика учителя (analytics.html) в настоящем браузере.

   Запуск:  node scripts/test-analytics.js

   Supabase подменён; teacher_analytics() возвращает то же, что
   функция в базе (её саму проверяет scripts/test-rls.sh).
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { createBackend } = require('./lib/fake-supabase');

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

function makeData(days) {
  const series = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    series.push({ day, photo: i === 0 ? 3 : i % 5 === 0 ? 2 : 0, test: i === 2 ? 4 : 0, collection: i % 3 === 0 ? 1 : 0 });
  }
  const works = series.reduce((a, d) => a + d.photo + d.test + d.collection, 0);
  return {
    days, from: series[0].day,
    totals: { works, graded: works - 2, avg_grade: 3.8, students: 7, pending: 3 },
    series,
    subjects: [{ subject: 'physics', works: 10, graded: 9, avg_grade: 3.2 }, { subject: 'math', works: 20, graded: 20, avg_grade: 4.4 }, { subject: 'other', works: 2, graded: 0, avg_grade: null }],
    errors: [
      { kind: 'type', label: 'вычислительная', cnt: 9 },
      { kind: 'task', title: 'Дроби', label: 'Сложите 1/2 и 1/3', n: 2, cnt: 6 },
      { kind: 'test', subject: 'math', n: 3, day: series[days - 3].day, cnt: 4 },
      { kind: 'type', label: 'орфографическая', cnt: 2 },
      { kind: 'type', label: '=HYPERLINK("x")', cnt: 1 }
    ],
    students: [
      { name: 'Лена', works: 3, graded: 3, avg_grade: 2.3, avg_percent: 45, last_at: new Date().toISOString() },
      { name: 'Петя', works: 2, graded: 2, avg_grade: 2.5, avg_percent: null, last_at: new Date().toISOString() },
      { name: '=cmd|x', works: 1, graded: 1, avg_grade: 3, avg_percent: 60, last_at: new Date().toISOString() },
      { name: 'Маша', works: 4, graded: 4, avg_grade: 3.5, avg_percent: 70, last_at: new Date().toISOString() },
      { name: 'Коля', works: 1, graded: 1, avg_grade: 4, avg_percent: null, last_at: new Date().toISOString() },
      { name: 'Оля', works: 2, graded: 2, avg_grade: 5, avg_percent: 100, last_at: new Date().toISOString() },
      { name: 'Без оценок', works: 1, graded: 0, avg_grade: null, avg_percent: null, last_at: new Date().toISOString() }
    ]
  };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(o) {
    o = o || {};
    const calls = [];
    const fake = createBackend({
      users: [{ id: 'u-t', email: 't@school.test' }, { id: 'u-s', email: 's@school.test' }],
      tables: { profiles: [{ id: 'u-t', email: 't@school.test', name: 'Ольга', role: 'teacher' }, { id: 'u-s', email: 's@school.test', name: 'Ваня', role: 'student' }] },
      rpc: {
        teacher_analytics: (a) => {
          calls.push(a);
          if (o.fail && o.fail.n-- > 0) throw Object.assign(new Error('boom'), { code: 'XX000' });
          if (o.empty) return { days: a.p_days, totals: { works: 0, pending: 0 }, series: [], subjects: [], errors: [], students: [] };
          return makeData(a.p_days);
        }
      }
    });
    const ctx = await browser.newContext({ locale: o.locale || 'ru-RU', viewport: o.viewport || { width: 1150, height: 1000 }, isMobile: !!o.mobile, hasTouch: !!o.mobile, acceptDownloads: true, colorScheme: o.dark ? 'dark' : 'light' });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    await fake.install(ctx, { session: o.session === undefined ? 'u-t' : o.session });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_FILE_NOT_FOUND|service ?worker/i.test(m.text())) errors.push(m.text()); });
    const nav = page.waitForRequest(r => r.isNavigationRequest() && !/\/analytics\.html$/.test(new URL(r.url()).pathname), { timeout: 3000 }).catch(() => null);
    await page.goto(url('analytics.html'));
    await page.evaluate(() => Sky.db.ready).catch(() => {});   // «не вошёл» уводит со страницы
    await page.waitForTimeout(400);
    return { page, ctx, calls, nav };
  }
  const text = (page, sel) => page.$eval(sel, el => el.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);

  let { page, ctx, calls } = await open();
  ok('по умолчанию — 30 дней, часовой пояс браузера', calls[0] && calls[0].p_days === 30 && typeof calls[0].p_tz === 'string' && calls[0].p_tz.length > 2, JSON.stringify(calls[0]));
  ok('заголовок и период: «30 дней» выбран', await text(page, 'h1') === 'Аналитика класса' && await text(page, '#anPeriod [aria-pressed=true]') === '30 дней');
  const k = await page.$$eval('.an-kpi', els => els.map(e => [e.dataset.kpi, e.querySelector('b').textContent]));
  ok('четыре показателя: работ, средний балл 3,8, учеников 7, ждут 3', JSON.stringify(k.map(x => x[0])) === '["works","avg","students","pending"]' && k[1][1] === '3,8' && k[2][1] === '7' && k[3][1] === '3', JSON.stringify(k));
  ok('«Ждут проверки» ведёт в «Новые работы» профиля', await page.$eval('[data-kpi=pending] a', a => a.getAttribute('href')) === 'profile.html#inbox');
  ok('заголовок графика — «Проверки за 30 дней»', await text(page, '#anChartH') === 'Проверки за 30 дней');
  const ch = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.an-bars path')];
    const boxes = bars.map(b => b.getBBox());
    return { n: bars.length, hits: document.querySelectorAll('.an-hits rect').length, maxW: Math.max(...boxes.map(b => b.width)),
      fill: getComputedStyle(bars[0]).fill, ticks: [...document.querySelectorAll('.an-xtick text')].map(t => t.textContent),
      y: [...document.querySelectorAll('.an-ytick text')].map(t => t.textContent) };
  });
  ok('столбцы только за дни с работами, но на каждый день — зона наведения', ch.n > 5 && ch.n < 30 && ch.hits === 30, JSON.stringify(ch));
  ok('столбец не толще 24 px', ch.maxW <= 24.01, ch.maxW);
  ok('цвет — токен --chart (#2f8dfa)', ch.fill === 'rgb(47, 141, 250)', ch.fill);
  ok('ось Y — круглые числа от 0', ch.y[0] === '0' && ch.y.every(v => /^\d+$/.test(v)), ch.y.join());
  ok('последняя подпись оси X — сегодня', ch.ticks.length >= 3 && ch.ticks[ch.ticks.length - 1] === new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), ch.ticks.join('|'));

  await page.hover('.an-hits rect:last-child');
  await page.waitForSelector('.an-tip:not([hidden])');
  const tip = await page.$eval('.an-tip', t => ({ b: t.querySelector('b').textContent, rows: [...t.querySelectorAll('.an-tip-r')].map(r => [...r.children].map(c => c.textContent).join(' ')) }));
  ok('наведение на день — подсказка: «4 работ», по фото 3, подборки 1', tip.b === '4 работ' && JSON.stringify(tip.rows) === '["3 по фото","1 подборки"]', JSON.stringify(tip));
  await page.focus('.an-hits rect[data-i="27"]');
  ok('с клавиатуры — та же подсказка (фокус на день)', /тесты/.test(await text(page, '.an-tip')), await text(page, '.an-tip'));

  await page.click('#anToggle');
  const tbl = await page.$$eval('#anDaysTable tbody tr', r => r.map(x => [...x.children].map(c => c.textContent)));
  ok('«Таблица» — те же числа, только дни с работами, свежие сверху', tbl.length > 5 && tbl[0][1] === '4' && tbl[0][2] === '3' && await page.$eval('#anChart', e => e.hidden), JSON.stringify(tbl[0]));
  await page.click('#anToggle');

  const subj = await page.$$eval('.an-bars-h li', l => l.map(x => [x.querySelector('.an-lab').textContent, x.querySelector('.an-val').textContent, x.querySelector('i').style.width]));
  ok('предметы: лучший сверху, без оценок — не показан, ширина по шкале 0–5', JSON.stringify(subj) === JSON.stringify([['Математика', '4,4', '88%'], ['Физика', '3,2', '64%']]), JSON.stringify(subj));
  const errs = await page.$$eval('.an-errs li', l => l.map(x => [x.querySelector('b').textContent, x.querySelector('.an-cnt').textContent]));
  ok('топ-5 ошибок: тип с заглавной, задание подборки, вопрос теста', errs.length === 5 && errs[0][0] === 'Вычислительная' && errs[0][1] === '9 раз'
    && errs[1][0] === '«Дроби», задание 2' && /^Тест \d\d\.\d\d \(Математика\): вопрос №3$/.test(errs[2][0]), JSON.stringify(errs));
  ok('текст задания под названием подборки', /Сложите 1\/2 и 1\/3/.test(await text(page, '.an-errs li:nth-child(2)')));

  const weak = await page.$$eval('section[aria-labelledby=anWeakH] tbody tr', r => r.map(x => [...x.children].map(c => c.textContent)));
  ok('слабейшие — 5, без учеников без оценок, первая Лена 2,3', weak.length === 5 && weak[0][0] === 'Лена' && weak[0][2] === '2,3' && weak[0][3] === '45%' && weak[1][3] === '—', JSON.stringify(weak.slice(0, 2)));
  ok('балл ниже 3 — красный значок', await page.$eval('.ctable tbody tr:first-child .tag', t => t.classList.contains('no')));
  await page.click('#anMore');
  ok('«Все ученики (6)» — показывает всех с оценками', (await page.$$('section[aria-labelledby=anWeakH] tbody tr')).length === 6);

  const dl = page.waitForEvent('download');
  await page.click('#anCsv');
  const file = await dl;
  const csv = fs.readFileSync(await file.path(), 'utf8');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  ok('CSV: BOM, заголовок, все 7 учеников', csv.charCodeAt(0) === 0xfeff && lines[0] === 'Ученик;Работ;С оценкой;Средний балл;Средний %;Последняя работа' && lines.length === 8, lines.slice(0, 2).join(' | '));
  ok('CSV: формула в имени обезврежена', lines.some(l => l.startsWith("'=cmd|x;")), lines.find(l => /cmd/.test(l)));
  ok('CSV: имя файла по периоду', file.suggestedFilename() === 'skyschool-students-30d.csv', file.suggestedFilename());

  await page.click('[data-days="7"]');
  await page.waitForFunction(() => document.querySelector('#anChartH') && /7 дней/.test(document.querySelector('#anChartH').textContent));
  ok('период 7 дней — новый запрос и заголовок', calls[calls.length - 1].p_days === 7 && (await page.$$('.an-hits rect')).length === 7);
  await page.reload();
  await page.waitForFunction(() => window.SkyAnalytics && SkyAnalytics.data, null, { timeout: 4000 }).catch(() => {});
  ok('период запомнился: после перезагрузки — 7 дней', await text(page, '#anPeriod [aria-pressed=true]') === '7 дней' && calls[calls.length - 1].p_days === 7);
  await ctx.close();

  /* ---------- пусто, ошибка, не учитель, не вошёл ---------- */
  ({ page, ctx } = await open({ empty: true }));
  ok('данных нет — пояснение и куда идти, CSV неактивен', /Данных пока нет/.test(await text(page, '#anBody')) && !!(await page.$('#anBody a[href="collections.html"]')) && await page.$eval('#anCsv', b => b.disabled));
  await ctx.close();

  ({ page, ctx } = await open({ fail: { n: 1 } }));
  ok('не загрузилось — «Аналитика не загрузилась» и «Повторить»', /не загрузилась/.test(await text(page, '#anBody')) && /Повторить/.test(await text(page, '.sx-acts') || ''));
  await page.click('.sx .sx-btn');
  await page.waitForSelector('.an-kpi', { timeout: 3000 }).catch(() => {});
  ok('«Повторить» — аналитика на месте', (await page.$$('.an-kpi')).length === 4);
  await ctx.close();

  ({ page, ctx } = await open({ session: 'u-s' }));
  ok('ученику — «Аналитика — для учителей», запроса нет', /для учителей/.test(await text(page, '#anBody')) && await page.$eval('#anTools', e => e.hidden));
  await ctx.close();

  let r = await open({ session: null });
  const went = await r.nav;
  ok('не вошёл — на вход с возвратом', went && /auth\.html\?next=analytics\.html$/.test(went.url()), went && went.url());
  await r.ctx.close();

  /* ---------- меню, телефон, тёмная тема, английский ---------- */
  ({ page, ctx } = await open());
  ok('в меню учителя — «Аналитика класса»', await page.evaluate(() => /analytics\.html/.test(document.getElementById('appHeader').innerHTML)));
  await ctx.close();

  ({ page, ctx } = await open({ viewport: { width: 360, height: 800 }, mobile: true, dark: true }));
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, kpiCols: getComputedStyle(document.querySelector('.an-kpis')).gridTemplateColumns.split(' ').length,
    fill: getComputedStyle(document.querySelector('.an-bars path')).fill, svgW: document.querySelector('.an-chart svg').getBoundingClientRect().width }));
  ok('телефон: без прокрутки вбок, показатели 2×2, график по ширине', m.sw <= 360 && m.kpiCols === 2 && m.svgW <= 330, JSON.stringify(m));
  ok('тёмная тема: столбцы — свой шаг #3f93f0', m.fill === 'rgb(63, 147, 240)', m.fill);
  await page.evaluate(() => Sky.setLang('en'));
  await page.waitForTimeout(200);
  ok('английский: «Checks over 30 days», «Top 5 class mistakes»', await text(page, '#anChartH') === 'Checks over 30 days' && await text(page, '#anErrH') === 'Top 5 class mistakes');
  await ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
