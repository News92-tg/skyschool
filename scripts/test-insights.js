/* ============================================================
   Проверка связки «сон ↔ результаты» (assets/insights.js, карточка
   в трекерах).

   Запуск:  node scripts/test-insights.js

   Фича опасна тем, что делает ВЫВОД о человеке. Поэтому
   проверяем не только «работает ли», но и «молчит ли, когда сказать
   нечего» — на трёх днях данных любой вывод случаен, а ученику он
   запомнится как факт о себе.
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
let passed = 0;

function check(name, cond, detail) {
  if (cond) { passed++; return; }
  problems.push(name + (detail ? ' — ' + detail : ''));
}

/* Наполняет localStorage днями: сон + результаты тренажёра за те же даты */
function seed(days) {
  return days;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
  const errors = [];

  /* ================== 1. СОН И РЕЗУЛЬТАТЫ ================== */
  const tr = await ctx.newPage();
  tr.on('pageerror', e => errors.push('trackers: ' + e.message));
  await tr.goto('file://' + path.join(ROOT, 'trackers.html'));
  await tr.waitForTimeout(400);

  /* пусто — должен молчать и объяснить, чего ждёт */
  const empty = await tr.evaluate(() => ({
    waiting: !document.querySelector('#linkWait').classList.contains('hidden'),
    result: !document.querySelector('#linkResult').classList.contains('hidden'),
    text: document.querySelector('#linkWaitText').textContent
  }));
  check('сон: без данных вывода нет', empty.waiting && !empty.result);
  check('сон: объясняет, сколько дней нужно', /10|дней|days/.test(empty.text), empty.text.slice(0, 50));

  /* мало дней — всё ещё молчит */
  const few = await tr.evaluate(() => {
    const life = Sky.get('life', {}) || {}; life.sleep = {};
    const stats = Sky.stats(); stats.byDay = {};
    for (let i = 0; i < 5; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      life.sleep[d] = { hours: i % 2 ? 5 : 9 };
      stats.byDay[d] = { n: 10, right: i % 2 ? 4 : 9 };
    }
    Sky.set('life', life); Sky.set('stats', stats);
    renderLink();
    return !document.querySelector('#linkResult').classList.contains('hidden');
  });
  check('сон: на пяти днях вывода нет', !few);

  /* достаточно дней и разница есть — показывает числа */
  const rich = await tr.evaluate(() => {
    const life = Sky.get('life', {}); life.sleep = {};
    const stats = Sky.stats(); stats.byDay = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const short = i % 2 === 0;
      life.sleep[d] = { hours: short ? 5.5 : 8.5 };
      stats.byDay[d] = { n: short ? 6 : 12, right: short ? 3 : 10 };
    }
    Sky.set('life', life); Sky.set('stats', stats);
    renderLink();
    return {
      shown: !document.querySelector('#linkResult').classList.contains('hidden'),
      short: document.querySelector('#linkShort').textContent,
      long: document.querySelector('#linkLong').textContent,
      days: document.querySelector('#linkDays').textContent,
      phrase: document.querySelector('#linkPhrase').textContent,
      volume: document.querySelector('#linkVolume').textContent
    };
  });
  check('сон: на 14 днях вывод появляется', rich.shown);
  check('сон: точность после коротких ночей ниже', rich.short === '50%' && rich.long === '83%',
        rich.short + ' / ' + rich.long);
  check('сон: посчитаны все 14 дней', rich.days === '14', rich.days);
  /* Формулировка обязана говорить «связь», а не «причина»: это не
     стилистика, это разница между наблюдением и обвинением. */
  check('сон: сказано про связь, а не про причину',
        /связь, а не причина|a link, not a cause/.test(rich.phrase), rich.phrase.slice(0, 60));
  check('сон: показан и объём решённого', /6|12/.test(rich.volume), rich.volume);

  /* однородные ночи — сравнивать не с чем, молчим */
  const flat = await tr.evaluate(() => {
    const life = Sky.get('life', {}); life.sleep = {};
    const stats = Sky.stats(); stats.byDay = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      life.sleep[d] = { hours: 8 }; stats.byDay[d] = { n: 10, right: 8 };
    }
    Sky.set('life', life); Sky.set('stats', stats);
    renderLink();
    return { result: !document.querySelector('#linkResult').classList.contains('hidden'),
             text: document.querySelector('#linkWaitText').textContent };
  });
  check('сон: при одинаковых ночах вывода нет', !flat.result);
  check('сон: объяснено, почему нечего сравнивать',
        /одинаков|same length/.test(flat.text), flat.text.slice(0, 60));

  /* разницы почти нет — говорим прямо, что её нет */
  const noGap = await tr.evaluate(() => {
    const life = Sky.get('life', {}); life.sleep = {};
    const stats = Sky.stats(); stats.byDay = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      const short = i % 2 === 0;
      life.sleep[d] = { hours: short ? 5.5 : 8.5 };
      stats.byDay[d] = { n: 10, right: short ? 8 : 8 };   /* одинаковая точность */
    }
    Sky.set('life', life); Sky.set('stats', stats);
    renderLink();
    return document.querySelector('#linkPhrase').textContent;
  });
  check('сон: при отсутствии разницы так и сказано',
        /разницы.*не видно|no clear difference/.test(noGap), noGap.slice(0, 60));
  await tr.close();

  /* Раздел «фото → повторение» проверял карточки из assets/photo-tasks.js.
     Их наполнял фото-разбор через Gemini, от которого отказались, поэтому
     в тренажёр они не подключены — и проверять здесь нечего. */

  await browser.close();

  errors.forEach(e => problems.push('исключение — ' + e));

  console.log('');
  console.log('Проверок пройдено: ' + passed);
  if (problems.length) {
    console.log('НАЙДЕНО ПРОБЛЕМ: ' + problems.length);
    problems.forEach(p => console.log('  • ' + p));
    process.exit(1);
  }
  console.log('Все проверки пройдены.');
})();
