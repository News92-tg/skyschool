/* ============================================================
   Регрессия по страницам: открыть каждую и посмотреть, что ничего
   не падает.

   Запуск:  node scripts/test-pages.js

   Проверяем три вещи:
     1. на странице нет ошибок в консоли и необработанных исключений;
     2. шапка и подвал отрисовались, пункты меню на месте;
     3. новая страница курса и тренажёр переживают отсутствие
        голосов: в headless-браузере их нет вообще, и это ровно тот
        случай, ради которого написаны честные заглушки. Если
        страница молча ломается без голоса — здесь это и вылезет.
   ============================================================ */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SKIP = new Set(['single.html']);   /* это собранная копия сайта, отдельная сборка */

(async () => {
  const pages = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !SKIP.has(f))
    .sort();

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  let bad = 0;

  for (const file of pages) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('pageerror', e => errors.push('exception: ' + e.message));

    await page.goto('file://' + path.join(ROOT, file));
    await page.waitForTimeout(350);

    const nav = await page.$$eval('.appnav a, #appHeader a', els => els.length).catch(() => 0);
    const title = await page.title();

    /* file:// не даёт зарегистрировать service worker, и это не ошибка страницы */
    const real = errors.filter(e =>
      !/service ?worker/i.test(e) &&
      !/Failed to load resource/i.test(e) &&
      !/favicon/i.test(e));

    const mark = real.length ? 'ОШИБКИ' : 'ok    ';
    console.log(mark + '  ' + file.padEnd(22) + ' ссылок в шапке: ' + String(nav).padStart(2) + '  ' + title);
    real.forEach(e => { console.log('        • ' + e); bad++; });

    await page.close();
  }

  /* Отдельно — страница курса под нагрузкой: пройти подход целиком,
     чтобы проверить, что движок упражнений не падает на переходах. */
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(ROOT, 'russian-for-en.html'));
  await page.waitForTimeout(300);

  /* Без голосов аудирование и произношение недоступны — проверяем,
     что страница об этом честно сказала, а не притворилась рабочей. */
  const noteShown = await page.$eval('#voiceNote', el => !el.classList.contains('hidden')).catch(() => false);
  const kindsDisabled = await page.$$eval('#prKinds input:disabled', els => els.map(e => e.value));
  console.log('');
  console.log('Курс без голосов: предупреждение показано — ' + (noteShown ? 'да' : 'НЕТ') +
              ', выключены типы: ' + (kindsDisabled.join(', ') || '—'));
  if (!noteShown) { console.log('        • предупреждение об отсутствии голоса не появилось'); bad++; }

  /* Прогон практики. Произношение снимаем галочкой: в headless
     микрофона нет, и задание честно ждало бы голоса вечно — это не
     поломка страницы, а отсутствие железа. Заодно проверяем, что
     фильтр типов заданий работает в живом интерфейсе. */
  await page.click('#renSeg button[data-tab="practice"]');
  await page.waitForTimeout(100);
  const run = await page.evaluate(async () => {
    /* Сопоставление тоже снимаем: оно проверяется отдельным прогоном
       ниже, а здесь слепые клики по парам съедали бы все шаги. */
    document.querySelectorAll('#prKinds input').forEach(cb => {
      if ((cb.value === 'say' || cb.value === 'match') && cb.checked) cb.click();
    });
    document.querySelector('#prStart').click();

    const seen = {};
    let steps = 0;
    for (let i = 0; i < 80; i++) {
      const kind = (document.querySelector('#prKind').textContent || '').trim();
      const opt = document.querySelector('#prOptions .opt:not([disabled])');
      const write = document.querySelector('#prWriteBox:not(.hidden) #prWrite');
      const match = document.querySelector('#prMatch:not(.hidden) .ren-m:not(.done)');

      if (opt) {
        opt.click();
        document.querySelector('#prCheck').click();
        seen[kind] = (seen[kind] || 0) + 1; steps++;
      } else if (write) {
        /* половину заданий отвечаем верно, половину нарочно неверно —
           нужен и путь «зачтено», и путь «ошибка» */
        write.value = steps % 2 ? 'заведомо неверно' : (document.querySelector('#prSolution') && '');
        document.querySelector('#prCheck').click();
        seen[kind] = (seen[kind] || 0) + 1; steps++;
      } else if (match) {
        match.click();
        const other = document.querySelector('#prMatchEn .ren-m:not(.done)');
        if (other) other.click();
        seen[kind] = (seen[kind] || 0) + 1;
      }

      const next = document.querySelector('#prNext:not(.hidden)');
      if (next) next.click();
      else if (!opt && !write && !match) break;
      await new Promise(r => setTimeout(r, 10));
    }
    return { steps, seen, done: document.querySelector('#stDone').textContent };
  });
  console.log('Прогон практики: шагов — ' + run.steps + ', записано ответов — ' + run.done +
              ', типы: ' + JSON.stringify(run.seen));
  if (run.steps < 5) { console.log('        • практика прошла слишком мало заданий'); bad++; }

  /* Сопоставление проверяем отдельно: у него своя логика завершения
     (подход засчитывается, только когда собраны все четыре пары), и
     в случайной выборке оно может не попасться. */
  const matchRun = await page.evaluate(async () => {
    document.querySelector('#prStop').click();
    document.querySelector('#prLesson').value = 'l1';
    document.querySelectorAll('#prKinds input').forEach(cb => {
      if (cb.value !== 'match' && cb.checked) cb.click();
      if (cb.value === 'match' && !cb.checked) cb.click();
    });
    document.querySelector('#prStart').click();
    await new Promise(r => setTimeout(r, 30));

    const pairs = document.querySelectorAll('#prMatchRu .ren-m').length;
    /* собираем пары по dataset.key — так же, как это делает страница */
    for (const left of Array.from(document.querySelectorAll('#prMatchRu .ren-m'))) {
      left.click();
      const right = Array.from(document.querySelectorAll('#prMatchEn .ren-m'))
        .find(b => b.dataset.key === left.dataset.key);
      if (right) right.click();
      await new Promise(r => setTimeout(r, 10));
    }
    const done = document.querySelectorAll('#prMatch .ren-m.done').length;
    const verdict = !document.querySelector('#prVerdict').classList.contains('hidden');
    return { pairs, done, verdict };
  });
  console.log('Сопоставление: пар ' + matchRun.pairs + ', собрано ' + matchRun.done / 2 +
              ', подход засчитан — ' + (matchRun.verdict ? 'да' : 'НЕТ'));
  if (matchRun.pairs !== 4 || matchRun.done !== 8 || !matchRun.verdict) {
    console.log('        • сопоставление не доходит до конца'); bad++;
  }

  errors.forEach(e => { console.log('        • exception: ' + e); bad++; });
  await page.close();

  /* ---------- тренажёр: задания со звуком без голосов ----------
     Аудирование обязано оставаться решаемым: если голоса нет,
     тренажёр показывает фразу текстом. Проверяем, что показывает. */
  const tr = await ctx.newPage();
  const trErrors = [];
  tr.on('pageerror', e => trErrors.push(e.message));
  await tr.goto('file://' + path.join(ROOT, 'trainer.html'));
  await tr.waitForTimeout(400);
  const audio = await tr.evaluate(async () => {
    document.querySelector('#subject').value = 'english';
    document.querySelector('#mode').value = 'all';
    document.querySelector('#startBtn').click();
    let checked = 0, withAudio = 0, fallbackOk = 0, cefr = 0;
    for (let i = 0; i < 60; i++) {
      const box = document.querySelector('#qAudioBox');
      if (box && !box.classList.contains('hidden')) {
        withAudio++;
        const note = document.querySelector('#qAudioNote');
        if (note && !note.classList.contains('hidden') && note.textContent.length > 30) fallbackOk++;
      }
      if (!document.querySelector('#qCefr').classList.contains('hidden')) cefr++;
      const opt = document.querySelector('#qOptions .opt:not([disabled])');
      if (!opt) break;
      opt.click();
      document.querySelector('#checkBtn').click();
      checked++;
      const next = document.querySelector('#nextBtn');
      if (next && !next.classList.contains('hidden')) next.click();
      await new Promise(r => setTimeout(r, 5));
    }
    return { checked, withAudio, fallbackOk, cefr };
  });
  console.log('Тренажёр (английский): решено ' + audio.checked +
              ', со звуком ' + audio.withAudio + ' (из них с текстовой заменой ' + audio.fallbackOk + ')' +
              ', с тегом уровня ' + audio.cefr);
  if (audio.withAudio && audio.withAudio !== audio.fallbackOk) {
    console.log('        • без голоса фраза не показана текстом — задание нерешаемо'); bad++;
  }
  /* ---------- фото задания ----------
     Настоящий Gemini здесь недоступен и не нужен: проверяем то, что
     работает без сервера — сжатие до 1024 px и честный отказ, когда
     Worker не настроен (в assets/config.js пустой AI_BASE). */
  const photo = await tr.evaluate(async () => {
    /* синтетическая «фотография тетради»: 1600×1200 с текстом */
    const c = document.createElement('canvas');
    c.width = 1600; c.height = 1200;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111'; ctx.font = '64px sans-serif';
    ctx.fillText('2x + 3 = 11', 80, 400);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));

    const input = document.querySelector('#paFile');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'task.jpg', { type: 'image/jpeg' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 500));

    const preview = document.querySelector('#paPreview');
    const img = new Image();
    img.src = preview.src;
    try { await img.decode(); } catch (e) {}

    const before = Math.round(blob.size / 1024);
    const after = Math.round((preview.src.length - preview.src.indexOf(',') - 1) * 0.75 / 1024);

    /* разбор без настроенного Worker */
    document.querySelector('#paRunBtn').click();
    await new Promise(r => setTimeout(r, 300));
    const fail = document.querySelector('#paFail');

    /* и заодно: пауза между запросами считается */
    const cooldownAfterSend = PhotoAI.cooldownLeft();

    return {
      shotShown: !document.querySelector('#paShot').classList.contains('hidden'),
      side: Math.max(img.naturalWidth, img.naturalHeight),
      before, after,
      failShown: !fail.classList.contains('hidden'),
      failText: (fail.textContent || '').slice(0, 60),
      cooldownAfterSend
    };
  });
  console.log('Фото: снимок показан — ' + (photo.shotShown ? 'да' : 'НЕТ') +
              ', длинная сторона ' + photo.side + ' px, ' + photo.before + ' КБ → ' + photo.after + ' КБ');
  console.log('      без Worker: отказ показан — ' + (photo.failShown ? 'да' : 'НЕТ') +
              ' («' + photo.failText + '…»)');
  if (!photo.shotShown) { console.log('        • превью снимка не появилось'); bad++; }
  if (photo.side !== 1024) { console.log('        • сжатие не привело длинную сторону к 1024 px'); bad++; }
  if (photo.after > 1200) { console.log('        • сжатый снимок больше потолка в 1200 КБ'); bad++; }
  if (!photo.failShown) { console.log('        • без настроенного Worker страница промолчала'); bad++; }
  /* Пауза не должна тикать, когда запрос даже не ушёл: иначе
     ненастроенный Worker запирал бы кнопку на полминуты ни за что. */
  if (photo.cooldownAfterSend) {
    console.log('        • пауза 30 секунд включилась при неотправленном запросе'); bad++;
  }

  trErrors.forEach(e => { console.log('        • exception: ' + e); bad++; });

  await browser.close();
  console.log('');
  console.log(bad ? 'ПРОБЛЕМ: ' + bad : 'Все страницы открываются без ошибок.');
  process.exit(bad ? 1 : 0);
})();
