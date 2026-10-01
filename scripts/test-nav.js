/* ============================================================
   Главное меню (assets/core.js + assets/nav-overflow.js).

   Запуск:  node scripts/test-nav.js

   В строке — «Обзор», «Учёба», «Шахматы», «Класс», «План» и «Ещё»;
   остальные разделы — в «Ещё», ни одна страница из меню не пропала;
   на телефоне всё в одном меню, и спрятанные ссылки там видны;
   на страницах «Развития» — «Назад в меню»; на тренажёре, заданиях
   и плане — ни психолога, ни трекеров.
   ============================================================ */
'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

/* Все страницы, что были в меню до упрощения, — ни одна не должна пропасть. */
const ALL = ['index.html', 'trainer.html', 'test.html', 'exam.html', 'photo.html', 'essay.html', 'russian-for-en.html',
  'chess.html', 'homework.html', 'fast-check.html', 'classroom.html', 'headteacher.html', 'pe.html', 'plan.html',
  'kids.html', 'parent.html', 'teachers.html', 'psychologist.html', 'life.html', 'trackers.html', 'body.html', 'tools.html'];
const MORE = ['kids.html', 'parent.html', 'teachers.html', 'psychologist.html', 'life.html', 'trackers.html', 'body.html', 'tools.html'];

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(file, o) {
    o = o || {};
    const ctx = await browser.newContext({ locale: o.en ? 'en-US' : 'ru-RU', viewport: o.viewport || { width: 1280, height: 800 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    if (o.en) await ctx.addInitScript(() => localStorage.setItem('sky_lang', '"en"'));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(file + ': ' + e.message));
    await page.goto(url(file));
    await page.waitForFunction(() => window.NavOverflow && document.querySelector('#mainMenu .appnav'));
    await page.waitForTimeout(250);
    return { page, ctx };
  }
  /* Что видно в строке меню: подписи верхнего уровня. */
  const row = page => page.evaluate(() => [...document.querySelectorAll('#mainMenu .appnav > *')]
    .filter(e => !e.hidden && e.getBoundingClientRect().width)
    .map(e => (e.matches('a') ? e : e.querySelector(':scope > button')).textContent.replace(/[⌄\s]+$/, '').trim()));

  /* ---------- компьютер ---------- */
  let { page, ctx } = await open('index.html');
  ok('в строке: Обзор, Учёба, Шахматы, Класс, План, Ещё', JSON.stringify(await row(page)) === '["Обзор","Учёба","Шахматы","Класс","План","Ещё"]', JSON.stringify(await row(page)));
  ok('«Шахматы» — ссылка прямо в строке, без выпадающего списка', await page.$('#mainMenu .appnav > a[href="chess.html"]') !== null);
  ok('«План» — ссылка прямо в строке', await page.$('#mainMenu .appnav > a[href="plan.html"]') !== null);
  const hrefs = await page.$$eval('#appHeader a[href]', as => as.map(a => a.getAttribute('href')));
  const lost = ALL.filter(h => !hrefs.includes(h));
  ok('ни одна прежняя страница из меню не пропала', !lost.length, 'нет: ' + lost.join(', '));
  const inMore = await page.$$eval('#mainMenu [data-nav-group="more"] a', as => as.map(a => a.getAttribute('href')));
  ok('Детям, Родителям, Учителя и раздел «Развитие» — в «Ещё»', JSON.stringify(inMore) === JSON.stringify(MORE), JSON.stringify(inMore));
  const homework = await page.$$eval('#mainMenu [data-nav-group="class"] a', as => as.map(a => a.getAttribute('href')));
  ok('«Класс» начинается с «Заданий» (homework.html) — и без входа', homework[0] === 'homework.html', JSON.stringify(homework));

  await page.click('#mainMenu [data-nav-group="more"] > button');
  await page.waitForTimeout(250);
  const more = await page.evaluate(() => {
    const m = document.querySelector('#mainMenu [data-nav-group="more"] > .nav-group-menu');
    const r = m.getBoundingClientRect();
    return { open: getComputedStyle(m).visibility === 'visible', title: (m.querySelector('.nav-overflow-title') || {}).textContent, right: r.right, vw: innerWidth };
  });
  ok('«Ещё» раскрывается, у раздела заголовок «Развитие», окно не за краем', more.open && more.title === 'Развитие' && more.right <= more.vw, JSON.stringify(more));
  await ctx.close();

  /* текущая страница внутри «Ещё» подсвечивает саму «Ещё» */
  ({ page, ctx } = await open('life.html'));
  ok('на «Режиме дня» подсвечена «Ещё» и пункт внутри', await page.evaluate(() =>
    document.querySelector('#mainMenu [data-nav-group="more"]').classList.contains('is-active') &&
    !!document.querySelector('#mainMenu [data-nav-group="more"] a[href="life.html"][aria-current="page"]')));
  await ctx.close();

  ({ page, ctx } = await open('chess.html'));
  ok('на «Шахматах» пункт в строке отмечен текущим', await page.$('#mainMenu .appnav > a[href="chess.html"][aria-current="page"]') !== null);
  await ctx.close();

  /* ---------- английский ---------- */
  ({ page, ctx } = await open('index.html', { en: true }));
  ok('английский: Overview, Study, Chess, Class, Plan, More', JSON.stringify(await row(page)) === '["Overview","Study","Chess","Class","Plan","More"]', JSON.stringify(await row(page)));
  await ctx.close();

  /* ---------- телефон ---------- */
  ({ page, ctx } = await open('index.html', { viewport: { width: 390, height: 760 }, mobile: true }));
  await page.click('#mainMenu .nav-overflow:not([hidden]) > button');
  await page.waitForTimeout(250);
  const phone = await page.evaluate(() => {
    const m = document.querySelector('#mainMenu .nav-overflow-menu');
    const vis = [...m.querySelectorAll('a')].filter(a => a.getBoundingClientRect().height > 0).map(a => a.getAttribute('href'));
    const titles = [...m.querySelectorAll('.nav-overflow-title')].map(t => t.textContent);
    return { vis, titles, sw: document.documentElement.scrollWidth };
  });
  const missing = ALL.filter(h => !phone.vis.includes(h));
  ok('телефон: в меню видны все страницы, и «Обзор» тоже', !missing.length, 'не видно: ' + missing.join(', '));
  ok('телефон: разделы Учёба, Класс, Развитие; без «Ещё» внутри «Ещё»', JSON.stringify(phone.titles) === '["Учёба","Класс","Развитие"]', JSON.stringify(phone.titles));
  ok('телефон: страница не листается вбок', phone.sw <= 390, String(phone.sw));
  await ctx.close();

  /* ---------- «Назад в меню» на страницах «Развития» ---------- */
  const backs = [];
  for (const f of ['psychologist.html', 'life.html', 'tools.html', 'trackers.html', 'body.html']) {
    ({ page, ctx } = await open(f));
    backs.push(f + ': ' + await page.$eval('main > .back-link', a => a.textContent + ' → ' + a.getAttribute('href')).catch(() => 'нет'));
    await ctx.close();
  }
  ok('«Назад в меню» → index.html на психологе, режиме дня, инструментах, трекерах, теле',
    backs.every(b => /: Назад в меню → index\.html$/.test(b)), backs.join(' | '));
  ({ page, ctx } = await open('tools.html', { en: true }));
  ok('английский: «Back to menu»', await page.$eval('main > .back-link', a => a.textContent) === 'Back to menu');
  await ctx.close();

  /* ---------- учёба, задания, план — без психолога и трекеров ---------- */
  const extra = [];
  for (const f of ['trainer.html', 'homework.html', 'plan.html']) {
    ({ page, ctx } = await open(f));
    const hits = await page.evaluate(() => {
      const m = document.querySelector('main');
      const txt = m.innerText + ' ' + [...m.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).join(' ');
      return txt.match(/психолог\w*|трекер\w*|режим\w* дня|psychologist\.html|trackers\.html|life\.html|body\.html/gi) || [];
    });
    if (hits.length) extra.push(f + ': ' + hits.join(', '));
    await ctx.close();
  }
  ok('на тренажёре, заданиях и плане нет психолога, трекеров и режима дня', !extra.length, extra.join(' | '));

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
