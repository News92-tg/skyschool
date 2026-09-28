/* ============================================================
   Вставляет worker/worker.js внутрь worker/news92-orders.js.

   Запуск:  node scripts/embed-legacy-worker.js          — обновить
            node scripts/embed-legacy-worker.js --check  — только сверить

   Зачем. Сайт зовёт по одному адресу (news92-orders) и новые
   эндпоинты (/api/…: тарифы, режим учителя, текст через Groq), и
   прежние (/explain, /check-photo, /check-homework, /chess-explain,
   /grade-essay — объяснения заданий, шахматы, essay.html). Прежние
   живут в worker/worker.js. В панели Cloudflare Worker — это один
   файл, импорта нет, поэтому worker.js кладётся внутрь news92-orders.js
   как есть, в свою область видимости (имена не пересекаются).

   Руками вставленный кусок не правят: правят worker/worker.js и
   запускают этот скрипт. scripts/test-worker.js проверяет, что копия
   не отстала.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LEGACY = path.join(ROOT, 'worker', 'worker.js');
const TARGET = path.join(ROOT, 'worker', 'news92-orders.js');
const BEGIN = '/* >>> worker/worker.js — вставлено scripts/embed-legacy-worker.js, руками не править */';
const END = '/* <<< worker/worker.js */';

function block() {
  const src = fs.readFileSync(LEGACY, 'utf8').replace(/\r\n/g, '\n');
  const n = (src.match(/^export default \{$/gm) || []).length;
  if (n !== 1) throw new Error('в worker/worker.js ожидается ровно одна строка «export default {», найдено ' + n);
  if (/^(import|export) /m.test(src.replace(/^export default \{$/m, ''))) throw new Error('в worker/worker.js есть другие import/export');
  return BEGIN + '\nconst LEGACY = (() => {\n' + src.replace(/^export default \{$/m, 'return {').replace(/\s*$/, '\n') + '})();\n' + END + '\n';
}

function current() {
  const s = fs.readFileSync(TARGET, 'utf8');
  const a = s.indexOf(BEGIN), b = s.indexOf(END);
  return { s, a, b, text: a >= 0 && b > a ? s.slice(a, b + END.length + 1) : null };
}

module.exports = { block, current };

if (require.main === module) {
  const want = block();
  const cur = current();
  if (process.argv.includes('--check')) {
    if (cur.text !== want) { console.error('worker/news92-orders.js: копия worker/worker.js устарела — запустите node scripts/embed-legacy-worker.js'); process.exit(1); }
    console.log('Копия worker/worker.js в news92-orders.js совпадает.');
    process.exit(0);
  }
  const out = cur.text ? cur.s.slice(0, cur.a) + want + cur.s.slice(cur.b + END.length + 1)
                       : cur.s.replace(/\s*$/, '\n\n\n') + want;
  fs.writeFileSync(TARGET, out);
  console.log('worker/news92-orders.js: копия worker/worker.js обновлена.');
}
