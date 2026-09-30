/* ============================================================
   Окно «Оформление» (assets/theme.js) и тема в core.js.

   Запуск:  node scripts/test-theme.js

   Проверяем: «Как в системе» по умолчанию и слежение за системой;
   «Светлая» / «Тёмная» — запоминаются и не зависят от системы;
   прежний сохранённый выбор ('dark') работает как раньше; цвет
   акцента меняет кнопки; клавиатура (стрелки, Escape); телефон.
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

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function open(o) {
    o = o || {};
    const ctx = await browser.newContext({ locale: 'ru-RU', colorScheme: o.scheme || 'light', viewport: o.viewport || { width: 1100, height: 800 }, isMobile: !!o.mobile, hasTouch: !!o.mobile });
    await ctx.route(/fonts\.(googleapis|gstatic)|jsdelivr|supabase\.co|workers\.dev/, r => r.abort());
    if (o.stored) await ctx.addInitScript(s => { for (const k in s) localStorage.setItem('sky_' + k, JSON.stringify(s[k])); }, o.stored);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url(o.file || 'index.html'));
    await page.waitForFunction(() => window.SkyTheme);
    return { page, ctx };
  }
  const state = page => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, accent: document.documentElement.dataset.accent || 'sky',
    pref: Sky.themePref(), bg: getComputedStyle(document.body).backgroundColor, accentVar: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }));

  /* ---------- по умолчанию — как в системе, и следим за ней ---------- */
  let { page, ctx } = await open({ scheme: 'dark' });
  let st = await state(page);
  ok('без выбора — «Как в системе»: система тёмная → тёмная', st.pref === 'auto' && st.theme === 'dark', JSON.stringify(st));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', null, { timeout: 2000 }).catch(() => {});
  ok('система сменилась — сайт следом, без перезагрузки', (await state(page)).theme === 'light');

  await page.click('#themeBtn');
  await page.waitForSelector('.th-pop.in');
  const pop = await page.evaluate(() => ({ title: document.querySelector('.th-pop b').textContent, role: document.querySelector('.th-pop').getAttribute('role'),
    modes: [...document.querySelectorAll('[data-mode]')].map(b => b.textContent.trim() + ':' + b.getAttribute('aria-checked')),
    acc: document.querySelectorAll('[data-accent]').length, focus: document.activeElement.dataset.mode,
    exp: document.getElementById('themeBtn').getAttribute('aria-expanded') }));
  ok('◐ открывает «Оформление»: три режима, выбран «Как в системе», фокус на нём', pop.title === 'Оформление' && pop.role === 'dialog' && pop.acc === 5 &&
    JSON.stringify(pop.modes) === '["Светлая:false","Тёмная:false","Как в системе:true"]' && pop.focus === 'auto' && pop.exp === 'true', JSON.stringify(pop));

  await page.click('[data-mode=dark]');
  st = await state(page);
  ok('«Тёмная» — сразу тёмная и запомнена', st.theme === 'dark' && st.pref === 'dark' && await page.evaluate(() => localStorage.getItem('sky_theme')) === '"dark"');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(200);
  ok('выбрана руками — система не перебивает', (await state(page)).theme === 'dark');

  await page.click('[data-accent=violet]');
  st = await state(page);
  ok('акцент «Фиалка» — тёмный вариант цвета', st.accent === 'violet' && st.accentVar === '#a78bfa', JSON.stringify(st));
  await page.keyboard.press('ArrowRight');
  st = await state(page);
  ok('стрелка вправо — следующий цвет («Изумруд»)', st.accent === 'emerald', st.accent);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  ok('Escape закрывает, фокус возвращается на ◐', !(await page.$('.th-pop')) && await page.evaluate(() => document.activeElement.id === 'themeBtn' && document.activeElement.getAttribute('aria-expanded') === 'false'));

  await page.goto(url('photo.html'));
  await page.waitForFunction(() => window.SkyTheme);
  st = await state(page);
  const btn = await page.evaluate(() => getComputedStyle(document.querySelector('.btn:not(.ghost)')).backgroundColor);
  ok('на другой странице — та же тема и цвет, кнопки зелёные', st.theme === 'dark' && st.accent === 'emerald' && btn === 'rgb(52, 211, 153)', JSON.stringify(st) + ' ' + btn);

  await page.click('#themeBtn');
  await page.waitForSelector('.th-pop.in');
  await page.click('[data-mode=light]');
  st = await state(page);
  ok('светлая + изумруд — белый текст на кнопке 5:1 цвет #0a7f58', st.theme === 'light' && st.accentVar === '#0a7f58');
  await page.mouse.click(10, 700);
  await page.waitForTimeout(250);
  ok('щелчок мимо окна закрывает его', !(await page.$('.th-pop')));
  await page.click('#themeBtn');
  await page.waitForSelector('.th-pop.in');
  await page.click('[data-mode=auto]');
  await page.click('[data-accent=sky]');
  st = await state(page);
  ok('вернуть «Как в системе» и «Небо» — как было', st.pref === 'auto' && st.accent === 'sky' && await page.evaluate(() => !document.documentElement.hasAttribute('data-accent')));
  await ctx.close();

  /* ---------- прежний сохранённый выбор ---------- */
  ({ page, ctx } = await open({ scheme: 'light', stored: { theme: 'dark' } }));
  st = await state(page);
  ok('раньше сохранили «dark» — тёмная, как и было', st.theme === 'dark' && st.pref === 'dark');
  await page.evaluate(() => Sky.toggleTheme());
  ok('Sky.toggleTheme (админка) по-прежнему переключает', (await state(page)).theme === 'light');
  await ctx.close();

  ({ page, ctx } = await open({ stored: { theme: 'пурпурная', accent: 'rainbow' } }));
  st = await state(page);
  ok('мусор в хранилище — «Как в системе» и «Небо»', st.pref === 'auto' && st.accent === 'sky');
  await ctx.close();

  /* ---------- телефон, английский ---------- */
  ({ page, ctx } = await open({ viewport: { width: 360, height: 740 }, mobile: true }));
  await page.evaluate(() => Sky.setLang('en'));
  await page.click('#themeBtn');
  await page.waitForSelector('.th-pop.in');
  await page.waitForTimeout(300);   /* дождаться конца анимации появления */
  const m = await page.evaluate(() => { const r = document.querySelector('.th-pop').getBoundingClientRect(); return { l: r.left, r: r.right, b: innerHeight - r.bottom, sw: document.documentElement.scrollWidth, t: document.querySelector('.th-pop b').textContent }; });
  ok('телефон: окно снизу во всю ширину с полями 16 px', m.l >= 15 && m.r <= 345 && m.b >= 15 && m.sw <= 360, JSON.stringify(m));
  ok('английский: «Appearance»', m.t === 'Appearance');
  await ctx.close();

  ok('без ошибок на страницах', !errors.length, errors.join(' | '));
  await browser.close();
  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  process.exit(failed ? 1 : 0);
})();
