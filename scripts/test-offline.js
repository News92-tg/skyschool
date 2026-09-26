/* ============================================================
   Офлайн-кэш не отстаёт от сайта.

   Запуск:  node scripts/test-offline.js

   Список PRECACHE_URLS в sw.js ведётся руками, и он уже однажды
   отстал на двадцать файлов: новые страницы (трекеры, курс русского,
   тест) и их скрипты без сети просто не открывались. Здесь сверяем
   список с тем, что реально подключают страницы.

   Проверяем:
     1. каждая страница сайта (кроме single.html — это отдельная
        сборка) есть в списке;
     2. каждый локальный скрипт, стиль и картинка, на которые
        ссылается страница, есть в списке;
     3. в списке нет файлов, которых больше не существует: такая
        запись молча не кэшируется, и это легко не заметить.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP_PAGES = new Set(['single.html']);

const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const block = sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\];/);
if (!block) { console.error('В sw.js не найден PRECACHE_URLS'); process.exit(1); }
const listed = new Set([...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]));

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !SKIP_PAGES.has(f));
const problems = [];

for (const page of pages) {
  if (!listed.has(page)) problems.push(`sw.js: нет страницы ${page}`);
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)=["']([^"'#?]+\.(?:js|css|json|svg|png))["']/g)) {
    const url = m[1].replace(/^\.\//, '');
    if (/^(https?:|\/\/|data:)/.test(url)) continue;
    if (!fs.existsSync(path.join(ROOT, url))) continue;   /* битые ссылки — не забота кэша */
    if (!listed.has(url)) problems.push(`sw.js: ${page} подключает ${url}, а его нет в кэше`);
  }
}

for (const url of listed) {
  if (url === './') continue;
  if (!fs.existsSync(path.join(ROOT, url))) problems.push(`sw.js: в кэше записан ${url}, но такого файла нет`);
}

const unique = [...new Set(problems)];
if (unique.length) {
  console.log('НАЙДЕНО ПРОБЛЕМ: ' + unique.length);
  unique.forEach(p => console.log('  • ' + p));
  process.exit(1);
}
console.log(`Офлайн-кэш в порядке: ${pages.length} страниц, ${listed.size} записей.`);
