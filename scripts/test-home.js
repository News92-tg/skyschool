/* ============================================================
   Главная (index.html): две цели — «Я ученик» и «Я учитель».

   Запуск:  node scripts/test-home.js

   Проверяем: кнопки целей и куда ведут; на главной нет детского
   раздела, психолога, трекеров и режима дня; отсчёт до экзамена на
   месте; вошедшему учителю его карточка отмечена и идёт первой;
   «Работа над ошибками» — только когда ошибки есть; телефон, английский.
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

const inDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(o) {
    o = o || {};
    const ctx = await browser.newContext({ locale: o.en ? 'en-US' : 'ru-RU', viewport: o.viewport || { width: 1280, height: 900 },
      isMobile: !!o.mobile, hasTouch: !!o.mobile, colorScheme: o.dark ? 'dark' : 'light' });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    if (o.session) {
      const fake = createBackend({
        users: [{ id: 'u-t', email: 'olga@school.test' }, { id: 'u-s', email: 'masha@school.test' }],
        tables: { profiles: [{ id: 'u-t', name: 'Ольга', role: 'teacher' }, { id: 'u-s', name: 'Маша', role: 'student' }] }
      });
      await fake.install(ctx, { session: o.session });
    }
    await ctx.addInitScript(st => { for (const k in st) localStorage.setItem('sky_' + k, JSON.stringify(st[k])); }, Object.assign(o.en ? { lang: 'en' } : {}, o.stored || {}));
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url('index.html'));
    await page.waitForSelector('#studentLinks a');
    if (o.session) await page.waitForFunction(() => Sky.db.me && Sky.db.me()).catch(() => {});
    await page.waitForTimeout(250);
    return { page, ctx };
  }
  const links = (page, sel) => page.$$eval(sel + ' a', as => as.map(a => a.querySelector('b').textContent + ' → ' + a.getAttribute('href')));

  /* ---------- не вошёл ---------- */
  let { page, ctx } = await open();
  ok('заголовки целей: «Я ученик» и «Я учитель»', await page.$eval('#goalStudentT', e => e.textContent) === 'Я ученик' && await page.$eval('#goalTeacherT', e => e.textContent) === 'Я учитель');
  const st = await links(page, '#studentLinks');
  ok('ученик: ОГЭ/ЕГЭ, задания от учителя, шахматы, план', JSON.stringify(st) === JSON.stringify([
    'Готовиться к ОГЭ/ЕГЭ → trainer.html', 'Мои задания от учителя → homework.html', 'Играть в шахматы → chess.html', 'Мой план → plan.html']), JSON.stringify(st));
  const te = await links(page, '#teacherLinks');
  ok('учитель: создать задание, проверить работы, мои ученики', JSON.stringify(te) === JSON.stringify([
    'Создать задание → collections.html', 'Проверить работы → fast-check.html', 'Мои ученики → teacher-review.html']), JSON.stringify(te));
  ok('без входа своя карточка не отмечена', await page.$$eval('.goal.mine', e => e.length) === 0);

  const main = await page.evaluate(() => {
    const m = document.querySelector('main');
    return m.innerText + ' ' + [...m.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).join(' ');
  });
  const banned = (main.match(/детям|психолог|трекер|режим дня|питани|сон\b|kids\.html|life\.html|psychologist\.html|trackers\.html|body\.html|tools\.html|teachers\.html/gi) || []);
  ok('на главной нет детского раздела, психолога, трекеров, режима дня', !banned.length, banned.join(', '));

  ok('отсчёт до экзамена на месте: без даты — «Поставить дату»', await page.$eval('#examDays', e => e.textContent) === '—' &&
    await page.$('#examExtra a[href="plan.html"]') !== null);
  ok('«Что повторить» — предмет на строку, ведёт в тренажёр', await page.$$eval('#subjectCards a.subj', as => as.length >= 6 && as.every(a => /^trainer\.html\?subject=/.test(a.getAttribute('href')))));
  ok('ошибок нет — блока «Работа над ошибками» нет', await page.$eval('#weakSection', e => e.hidden));
  await ctx.close();

  /* ---------- дата экзамена и ошибки ---------- */
  ({ page, ctx } = await open({ stored: { plan: { exam: inDays(40), goal: 10 } } }));
  ok('дата через 40 дней — «40» и «дней на подготовку»', await page.$eval('#examDays', e => e.textContent) === '40' &&
    /дней на подготовку/.test(await page.$eval('#examNote', e => e.textContent)));
  const taskId = await page.evaluate(() => { const b = Object.values(BANKS)[0]; return b.id + ':' + b.tasks[0].id; });
  await page.evaluate(k => { const s = Sky.srs ? Sky.srs() : {}; s[k] = Object.assign({}, s[k], { fails: 2 }); localStorage.setItem('sky_srs', JSON.stringify(s)); }, taskId);
  await page.reload(); await page.waitForSelector('#studentLinks a');
  ok('есть ошибка — «Работа над ошибками» появляется с кнопкой «Решать»', !(await page.$eval('#weakSection', e => e.hidden)) &&
    await page.$('#weakList a[href*="mode=weak"]') !== null);
  await ctx.close();

  /* ---------- вошёл учитель / ученик ---------- */
  ({ page, ctx } = await open({ session: 'u-t' }));
  const t = await page.evaluate(() => {
    const a = document.getElementById('goalTeacher'), b = document.getElementById('goalStudent');
    return { mine: a.classList.contains('mine'), tag: !a.querySelector('.tag').hidden && a.querySelector('.tag').textContent, first: a.getBoundingClientRect().left < b.getBoundingClientRect().left, other: b.classList.contains('mine') };
  });
  ok('учитель: его карточка отмечена «Это вы» и стоит первой', t.mine && t.tag === 'Это вы' && t.first && !t.other, JSON.stringify(t));
  await ctx.close();

  ({ page, ctx } = await open({ session: 'u-s' }));
  ok('ученик: отмечена карточка ученика', await page.$eval('#goalStudent', e => e.classList.contains('mine')) && !(await page.$eval('#goalTeacher', e => e.classList.contains('mine'))));
  await ctx.close();

  /* ---------- телефон, тёмная, английский ---------- */
  ({ page, ctx } = await open({ viewport: { width: 360, height: 740 }, mobile: true, dark: true }));
  const m = await page.evaluate(() => {
    const s = document.getElementById('goalStudent').getBoundingClientRect(), te = document.getElementById('goalTeacher').getBoundingClientRect();
    const a = document.querySelector('#studentLinks a').getBoundingClientRect();
    return { sw: document.documentElement.scrollWidth, stacked: te.top >= s.bottom, tap: Math.round(a.height), cloud: getComputedStyle(document.getElementById('heroCloud')).display };
  });
  ok('телефон 360 px: цели одна под другой, кнопки не меньше 48 px, вбок не листается', m.sw <= 360 && m.stacked && m.tap >= 48 && m.cloud === 'none', JSON.stringify(m));
  await ctx.close();

  ({ page, ctx } = await open({ en: true }));
  ok('английский: I’m a student / I’m a teacher, Prepare for exams', await page.$eval('#goalStudentT', e => e.textContent) === 'I’m a student' &&
    await page.$eval('#goalTeacherT', e => e.textContent) === 'I’m a teacher' && /Prepare for exams/.test(await page.$eval('#studentLinks', e => e.textContent)));
  await ctx.close();

  ok('без ошибок на странице', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
