/* ============================================================
   Проверка двух новых связок:
     1) сон ↔ результаты   (assets/insights.js, карточка в трекерах)
     2) фото → повторение  (assets/photo-tasks.js, карточка в тренажёре)

   Запуск:  node scripts/test-insights.js

   Обе фичи опасны одинаково: они делают ВЫВОД о человеке. Поэтому
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

  /* ================== 2. ФОТО → ПОВТОРЕНИЕ ================== */
  const t = await ctx.newPage();
  t.on('pageerror', e => errors.push('trainer: ' + e.message));
  await t.goto('file://' + path.join(ROOT, 'trainer.html'));
  await t.waitForTimeout(400);

  const added = await t.evaluate(() => {
    const one = PhotoTasks.add({
      text: 'Решите уравнение 2x + 3 = 11',
      solution: ['Перенесём 3 вправо: 2x = 8', 'Разделим обе части на 2: x = 4'],
      feedback: 'Следи за знаком при переносе.'
    }, { subject: 'math' });
    /* повторное добавление того же условия не должно плодить дубли */
    const again = PhotoTasks.add({ text: 'Решите уравнение 2x + 3 = 11', solution: ['…'] });
    return { id: one.id, same: again.id === one.id, count: PhotoTasks.all().length };
  });
  check('фото: задача добавлена', !!added.id);
  check('фото: дубль не создаётся', added.same && added.count === 1, 'карточек ' + added.count);

  await t.reload();
  await t.waitForTimeout(400);

  const flow = await t.evaluate(async () => {
    const subjects = [...document.querySelector('#subject').options].map(o => o.value);
    const note = document.querySelector('#photoNote');
    const noteShown = !note.classList.contains('hidden');

    document.querySelector('#subject').value = 'photo';
    document.querySelector('#mode').value = 'all';
    document.querySelector('#startBtn').click();
    await new Promise(r => setTimeout(r, 150));

    const shown = {
      text: document.querySelector('#qText').textContent,
      selfVisible: !document.querySelector('#qSelf').classList.contains('hidden'),
      optionsHidden: document.querySelector('#qOptions').classList.contains('hidden'),
      checkHidden: document.querySelector('#checkBtn').classList.contains('hidden'),
      solutionHidden: document.querySelector('#qSolution').classList.contains('hidden')
    };

    document.querySelector('#qReveal').click();
    await new Promise(r => setTimeout(r, 60));
    const revealed = {
      solution: document.querySelector('#qSolution').textContent,
      gradeVisible: !document.querySelector('#qSelfGrade').classList.contains('hidden')
    };

    document.querySelector('#qGotIt').click();
    await new Promise(r => setTimeout(r, 80));

    const id = PhotoTasks.all()[0].id;
    return { subjects, noteShown, shown, revealed,
             verdict: document.querySelector('#qVerdict').textContent.trim(),
             box: Sky.boxOf('photo', id),
             due: PhotoTasks.dueCount(),
             stat: Sky.stats().bySubject.photo };
  });

  check('фото: появился отдельный предмет в списке', flow.subjects.includes('photo'),
        flow.subjects.join(','));
  check('фото: о задачах напомнили на экране настроек', flow.noteShown);
  check('фото: условие показано целиком', /2x \+ 3 = 11/.test(flow.shown.text), flow.shown.text);
  /* Главное отличие карточки: вариантов нет, есть самопроверка. */
  check('фото: вариантов ответа нет', flow.shown.optionsHidden && flow.shown.selfVisible);
  check('фото: кнопка «Проверить» скрыта', flow.shown.checkHidden);
  check('фото: решение до нажатия скрыто', flow.shown.solutionHidden);
  check('фото: решение открывается по кнопке', /Разделим обе части/.test(flow.revealed.solution),
        flow.revealed.solution.slice(0, 40));
  check('фото: после решения появляется самооценка', flow.revealed.gradeVisible);
  check('фото: «справился» засчитан', /Верно|Correct/.test(flow.verdict), flow.verdict);
  /* Ради чего всё затевалось: карточка встала в расписание повторения. */
  check('фото: карточка попала в коробку повторения', flow.box === 1, 'коробка ' + flow.box);
  check('фото: сегодня повторять её уже не нужно', flow.due === 0, 'ждёт ' + flow.due);
  check('фото: попало в общую статистику', flow.stat && flow.stat.n === 1,
        JSON.stringify(flow.stat));

  /* «Не вспомнил» роняет коробку обратно в ноль */
  const missed = await t.evaluate(async () => {
    const id = PhotoTasks.all()[0].id;
    document.querySelector('#stopBtn').click();
    document.querySelector('#mode').value = 'all';
    document.querySelector('#startBtn').click();
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('#qReveal').click();
    await new Promise(r => setTimeout(r, 40));
    document.querySelector('#qMissed').click();
    await new Promise(r => setTimeout(r, 60));
    const rec = Sky.srs()['photo:' + id] || {};
    return { box: Sky.boxOf('photo', id), due: PhotoTasks.dueCount(),
             hoursAhead: Math.round((rec.due - Date.now()) / 36e5),
             verdict: document.querySelector('#qVerdict').textContent.trim() };
  });
  check('фото: «не вспомнил» возвращает карточку в начало', missed.box === 0, 'коробка ' + missed.box);
  /* Здесь тест сначала требовал, чтобы карточка ждала повторения ПРЯМО
     СЕЙЧАС, и падал. Прав оказался код: нулевая коробка ставит возврат
     на завтра — ровно то, что тренажёр обещает на первом экране
     («Ошиблись — задание вернётся завтра»). Делать для фото-карточек
     исключение значило бы, что одно и то же действие в одном разделе
     работает иначе, чем в другом. */
  check('фото: сегодня её больше не показывают', missed.due === 0, 'ждёт ' + missed.due);
  check('фото: но завтра она вернётся', missed.hoursAhead >= 20 && missed.hoursAhead <= 25,
        'через ' + missed.hoursAhead + ' ч');
  check('фото: вердикт про ошибку', /Неверно|Not quite/.test(missed.verdict), missed.verdict);

  /* Удаление карточки убирает предмет целиком */
  const removed = await t.evaluate(() => {
    PhotoTasks.remove(PhotoTasks.all()[0].id);
    return { left: PhotoTasks.all().length, bank: PhotoTasks.bank() };
  });
  check('фото: карточка удаляется', removed.left === 0);
  check('фото: пустой банк не создаётся', removed.bank === null);

  await t.close();
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
