/* ============================================================
   UX-аудит: измеримая часть.

   Запуск:  node scripts/audit-ux.js

   Здесь нет мнений — только числа, которые потом подставляются в
   разбор: ширина экрана телефона, размеры кнопок под палец, контраст
   текста, alt у картинок, доступные имена у кнопок, фокус с
   клавиатуры, горизонтальный вылет.

   Почему 360×640. Это не «маленький телефон для галочки», а типичный
   бюджетный Android, с которого школьник и заходит: iPhone SE — 375,
   Galaxy A-серии — 360. Если на 360 контент режется, режется он у
   половины аудитории.

   Порог 44×44 CSS-пикселя — из руководств Apple и Google по размеру
   цели под палец; ниже него промахи по кнопке становятся заметными.
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['single.html', 'offline.html']);
const TAP = 44;

/* Относительная яркость и контраст по WCAG 2.1 */
function luminance(rgb) {
  const [r, g, b] = rgb.map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return ((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05));
}
const parseRgb = s => (String(s).match(/\d+/g) || []).slice(0, 3).map(Number);

(async () => {
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP.has(f)).sort();
  const browser = await chromium.launch();

  /* ---------- контраст токенов дизайн-системы ---------- */
  const themeCtx = await browser.newContext();
  const tp = await themeCtx.newPage();
  await tp.goto('file://' + path.join(ROOT, 'index.html'));
  for (const theme of ['light', 'dark']) {
    const vals = await tp.evaluate(t => {
      document.documentElement.dataset.theme = t;
      const s = getComputedStyle(document.documentElement);
      const pick = n => s.getPropertyValue(n).trim();
      const probe = (color, bg) => {
        const d = document.createElement('div');
        d.style.color = color; d.style.backgroundColor = bg;
        document.body.appendChild(d);
        const c = getComputedStyle(d);
        const out = [c.color, c.backgroundColor];
        d.remove();
        return out;
      };
      /* Кнопку и вердикты меряем НА ЖИВЫХ элементах, а не по токенам:
         токен --accent используется и как заливка, и как текст, а
         реальная кнопка может быть покрашена другим токеном. Отчёт
         должен говорить о том, что видит человек на экране. */
      const real = (html, sel) => {
        const box = document.createElement('div');
        box.innerHTML = html;
        document.body.appendChild(box);
        const el = box.querySelector(sel);
        const cs = getComputedStyle(el);
        let bg = cs.backgroundColor, node = el;
        while (bg === 'rgba(0, 0, 0, 0)' && node.parentElement) { node = node.parentElement; bg = getComputedStyle(node).backgroundColor; }
        const out = [cs.color, bg === 'rgba(0, 0, 0, 0)' ? pick('--panel') : bg];
        box.remove();
        return out;
      };

      return {
        mutedOnPanel: probe(pick('--muted'), pick('--panel')),
        faintOnPanel: probe(pick('--faint'), pick('--panel')),
        inkOnPanel: probe(pick('--ink'), pick('--panel')),
        accentOnPanel: probe(pick('--accent'), pick('--panel')),
        btnLabel: real('<button class="btn">x</button>', '.btn'),
        verdictOk: real('<div class="verdict ok">x</div>', '.verdict'),
        verdictNo: real('<div class="verdict no">x</div>', '.verdict'),
        tagWarn: real('<span class="tag warn">x</span>', '.tag')
      };
    }, theme);
    console.log('\nКонтраст, тема ' + theme + ' (норма: 4.5 для текста, 3.0 для крупного):');
    for (const [name, [fg, bg]] of Object.entries(vals)) {
      const r = contrast(parseRgb(fg), parseRgb(bg));
      const mark = r >= 4.5 ? 'ok  ' : r >= 3 ? 'СЛАБО' : 'ПЛОХО';
      console.log('  ' + mark + '  ' + name.padEnd(18) + r.toFixed(2));
    }
  }
  await themeCtx.close();

  /* ---------- страницы на экране телефона ---------- */
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  console.log('\nЭкран 360×640 (типичный бюджетный Android):\n');
  console.log('страница                вылет  мелких_целей  без_alt  без_имени  поля_без_подписи');

  const totals = { overflow: 0, small: 0, noAlt: 0, noName: 0, noLabel: 0 };
  const worst = [];

  for (const file of pages) {
    const page = await ctx.newPage();
    await page.goto('file://' + path.join(ROOT, file));
    await page.waitForTimeout(250);

    const r = await page.evaluate(TAPSIZE => {
      const vis = el => {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
        return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      };
      const name = el =>
        (el.getAttribute('aria-label') || el.textContent || el.title ||
         el.getAttribute('data-i18n') || el.value || '').trim();

      /* мелкие цели под палец */
      const small = [];
      document.querySelectorAll('button, a[href], input[type=checkbox], input[type=radio], select, .opt, .ren-ico, .pa-drop, .icon-btn')
        .forEach(el => {
          if (!vis(el)) return;
          const b = el.getBoundingClientRect();
          if (b.width < TAPSIZE || b.height < TAPSIZE) {
            small.push({
              what: (el.id || el.className || el.tagName).toString().slice(0, 34),
              text: name(el).slice(0, 24),
              w: Math.round(b.width), h: Math.round(b.height)
            });
          }
        });

      const noAlt = [...document.querySelectorAll('img')].filter(i => vis(i) && !i.hasAttribute('alt')).length;

      const noName = [...document.querySelectorAll('button, a[href]')]
        .filter(el => vis(el) && !name(el)).length;

      const noLabel = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')]
        .filter(el => {
          if (!vis(el)) return false;
          if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
          if (el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]')) return false;
          return !el.closest('label');
        }).length;

      return {
        overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        small, noAlt, noName, noLabel,
        h1: document.querySelectorAll('h1').length,
        live: document.querySelectorAll('[aria-live]').length
      };
    }, TAP);

    totals.overflow += r.overflow ? 1 : 0;
    totals.small += r.small.length;
    totals.noAlt += r.noAlt;
    totals.noName += r.noName;
    totals.noLabel += r.noLabel;
    if (r.small.length) worst.push({ file, list: r.small });

    console.log(
      file.padEnd(22) +
      String(r.overflow ? r.overflow + 'px' : '—').padStart(6) +
      String(r.small.length).padStart(13) +
      String(r.noAlt).padStart(9) +
      String(r.noName).padStart(11) +
      String(r.noLabel).padStart(17)
    );
    await page.close();
  }

  console.log('\nИтого: страниц с вылетом ' + totals.overflow + ', мелких целей ' + totals.small +
              ', картинок без alt ' + totals.noAlt + ', кнопок без имени ' + totals.noName +
              ', полей без подписи ' + totals.noLabel);

  console.log('\nСамые мелкие цели (первые 12):');
  worst.flatMap(w => w.list.map(s => Object.assign({ file: w.file }, s)))
    .sort((a, b) => (a.w * a.h) - (b.w * b.h))
    .slice(0, 12)
    .forEach(s => console.log('  ' + (s.w + '×' + s.h).padEnd(8) + s.file.padEnd(20) +
                              s.what.padEnd(36) + (s.text || '')));

  /* ---------- клавиатура ---------- */
  const kb = await ctx.newPage();
  await kb.goto('file://' + path.join(ROOT, 'trainer.html'));
  await kb.waitForTimeout(250);
  /* ВАЖНО: правила читаем ИЗ ФАЙЛОВ, а не через document.styleSheets.
     На file:// обращение к cssRules падает с SecurityError, и первая
     версия этого скрипта молча ловила исключение — из-за чего отчёт
     уверенно сообщил, что в проекте нет ни стилей фокуса, ни учёта
     prefers-reduced-motion. И то и другое в sky.css было. Тихий catch
     в измерительном инструменте хуже отсутствия инструмента: он не
     оставляет следов и выдаёт выдумку за факт. */
  const cssText = fs.readdirSync(path.join(ROOT, 'assets'))
    .filter(f => f.endsWith('.css'))
    .map(f => fs.readFileSync(path.join(ROOT, 'assets', f), 'utf8'))
    .join('\n');

  const focus = {
    focusVisible: /:focus-visible/.test(cssText),
    focusAny: /:focus\b/.test(cssText),
    skipLink: /\.skip-link/.test(cssText) &&
              fs.readFileSync(path.join(ROOT, 'assets/core.js'), 'utf8').includes('skip-link'),
    reducedMotion: /prefers-reduced-motion/.test(cssText)
  };
  console.log('\nКлавиатура и движение:');
  console.log('  стили :focus-visible — ' + (focus.focusVisible ? 'есть' : 'НЕТ'));
  console.log('  стили :focus вообще — ' + (focus.focusAny ? 'есть' : 'НЕТ'));
  console.log('  ссылка «к содержимому» — ' + (focus.skipLink ? 'есть' : 'НЕТ'));
  console.log('  учёт prefers-reduced-motion — ' + (focus.reducedMotion ? 'есть' : 'НЕТ'));

  /* Проверка порядка обхода табом: доходит ли клавиатура до кнопки
     «Начать», не застревая в шапке. */
  const tabs = await kb.evaluate(async () => {
    const seen = [];
    let el = document.body;
    for (let i = 0; i < 40; i++) {
      const list = [...document.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter(e => e.offsetParent !== null);
      return { count: list.length, first: list.slice(0, 6).map(e => (e.id || e.textContent || e.tagName).toString().trim().slice(0, 18)) };
    }
    return { count: seen.length, first: [] };
  });
  console.log('  фокусируемых элементов на странице тренажёра: ' + tabs.count);
  console.log('  первые в порядке обхода: ' + tabs.first.join(' → '));

  await browser.close();
})();
