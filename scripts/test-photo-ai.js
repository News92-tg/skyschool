/* ============================================================
   Проверка разбора фото: worker/photo-analyze.js и обвязка в worker.js.

   Запуск:  node scripts/test-photo-ai.js

   Сети здесь нет и ключей нет: Gemini подменяется заглушкой. Проверяем
   то, что ломается молча и дорого — промпт, валидацию картинки,
   приведение ответа модели к обещанному виду и поведение при отказах.

   Файл Worker написан в модулях ES, а тесты в проекте — обычные
   скрипты Node. Вместо package.json с "type":"module" (он потянул бы
   за собой правки в сборке Worker) просто снимаем слово export и
   выполняем текст: приём тот же, что в test-language-banks.js.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const ok = [];

function check(name, cond, detail) {
  if (cond) ok.push(name);
  else problems.push(name + (detail ? ' — ' + detail : ''));
}

/* ---------- загрузка модуля Worker ---------- */
function loadWorkerModule(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/^import[^;]+;$/gm, '')      /* импортов здесь нет, но на будущее */
    .replace(/^export\s+/gm, '');
  const exportsBox = {};
  new Function('box', src + '\nbox.buildPrompt = buildPrompt;' +
                           '\nbox.readImage = readImage;' +
                           '\nbox.normalise = normalise;' +
                           '\nbox.handleAnalyze = handleAnalyze;')(exportsBox);
  return exportsBox;
}

const PA = loadWorkerModule('worker/photo-analyze.js');

/* ---------- 1. Промпт ---------- */
(function promptTests() {
  const ru = PA.buildPrompt('ru', 'математика', 'Решите уравнение x² − 5x + 6 = 0');
  const en = PA.buildPrompt('en', 'maths', '');

  check('промпт: русский по-русски', /дословно/.test(ru));
  check('промпт: английский по-английски', /Transcribe everything/.test(en));
  check('промпт: предмет попадает внутрь', ru.includes('математика'));
  check('промпт: текущее задание попадает внутрь', ru.includes('x² − 5x + 6 = 0'));
  check('промпт: без задания нет пустой рубрики', !/"""\s*"""/.test(en));

  /* Главный запрет. Модель, которую просят и прочитать, и решить,
     охотно «исправляет» условие под красивый ответ — и ученик решает
     не свою задачу. Если эта строка пропадёт из промпта, заметить
     это по ответам почти невозможно, поэтому проверяем текстом. */
  check('промпт: запрет тихо править условие', /Никогда не исправляй молча/.test(ru));
  check('промпт: запрет тихо править условие (en)', /Never silently fix/.test(en));

  check('промпт: требует строгий JSON', /СТРОГО JSON/.test(ru) && /STRICT JSON/.test(en));
  check('промпт: оба режима описаны', /kind="task"/.test(ru) && /kind="homework"/.test(ru));
  check('промпт: что делать с пустым фото', /не выдумывай задание|Не выдумывай задание/.test(ru));
})();

/* ---------- 2. Проверка картинки ---------- */
(function imageTests() {
  const MAX = 1200 * 1024;
  const body = (b64, mime) => ({ imageBase64: b64, mime });
  const bigEnough = 'A'.repeat(4000);          /* ~3 КБ после base64 */

  const plain = PA.readImage(body(bigEnough, 'image/jpeg'), MAX);
  check('картинка: чистый base64 принимается', !plain.error && plain.mime === 'image/jpeg');

  const dataUrl = PA.readImage(body('data:image/png;base64,' + bigEnough), MAX);
  check('картинка: data-URL разбирается', !dataUrl.error && dataUrl.mime === 'image/png',
        JSON.stringify(dataUrl).slice(0, 80));

  check('картинка: пустое тело отклоняется', PA.readImage(body(''), MAX).status === 400);
  check('картинка: чужой формат отклоняется',
        PA.readImage(body(bigEnough, 'application/pdf'), MAX).status === 415);
  check('картинка: мусор вместо base64 отклоняется',
        PA.readImage(body('не base64 совсем!!!', 'image/jpeg'), MAX).status === 400);

  /* Слишком большое: 2 МБ при потолке 1.2 МБ */
  const huge = 'A'.repeat(Math.ceil(2 * 1024 * 1024 / 0.75));
  const hugeRes = PA.readImage(body(huge, 'image/jpeg'), MAX);
  check('картинка: слишком большое отклоняется с 413', hugeRes.status === 413);
  check('картинка: в отказе назван размер', /КБ/.test(hugeRes.error || ''));

  /* Слишком маленькое: иконка вместо фотографии */
  check('картинка: слишком маленькое отклоняется',
        PA.readImage(body('AAAA', 'image/jpeg'), MAX).status === 400);

  /* Пробелы и переводы строк внутри base64 (почта, копипаста) не должны
     ломать разбор: их убираем, а не считаем повреждением. */
  const spaced = PA.readImage(body(bigEnough.slice(0, 2000) + '\n' + bigEnough.slice(2000), 'image/jpeg'), MAX);
  check('картинка: переносы строк в base64 не мешают', !spaced.error);
})();

/* ---------- 3. Приведение ответа ---------- */
(function normaliseTests() {
  const cut = (v, n) => String(v == null ? '' : v).slice(0, n);

  const full = PA.normalise({
    kind: 'homework',
    text: 'x2 - 5x + 6 = 0',
    solution: ['Разложим на множители', 'Найдём корни'],
    errors: [{ fragment: 'x = 5', why: 'подставлено неверно', fix: 'x = 2 или x = 3' }],
    feedback: 'Проверяй подстановку.'
  }, cut);
  check('ответ: kind сохраняется', full.kind === 'homework');
  check('ответ: шаги массивом', Array.isArray(full.solution) && full.solution.length === 2);
  check('ответ: ошибка разложена по полям',
        full.errors[0].fragment === 'x = 5' && full.errors[0].fix === 'x = 2 или x = 3');

  /* Модель часто отдаёт решение одним абзацем с нумерацией — разбираем
     на шаги сами, иначе «по шагам» превращается в стену текста. */
  const paragraph = PA.normalise({ solution: '1. Сначала это. 2. Потом то. 3. И наконец.' }, cut);
  check('ответ: абзац с нумерацией разбирается на шаги', paragraph.solution.length === 3,
        JSON.stringify(paragraph.solution));

  const empty = PA.normalise({}, cut);
  check('ответ: пустое приводится к пустому, а не к undefined',
        empty.kind === 'task' && empty.text === '' &&
        Array.isArray(empty.solution) && Array.isArray(empty.errors));

  const junk = PA.normalise({ kind: 'странное', errors: [{}, { why: 'без фрагмента' }], solution: 42 }, cut);
  check('ответ: неизвестный kind становится task', junk.kind === 'task');
  check('ответ: пустые ошибки выбрасываются', junk.errors.length === 1);
  check('ответ: число вместо шагов не ломает', Array.isArray(junk.solution) && !junk.solution.length);

  /* Поле explanation вместо why встречается у моделей постоянно */
  const alt = PA.normalise({ errors: [{ fragment: 'a', explanation: 'почему' }] }, cut);
  check('ответ: explanation принимается как why', alt.errors[0].why === 'почему');
})();

/* ---------- 4. Обработчик целиком ----------
   Подменяем всё, что ходит наружу, и смотрим на ответы. */
(function handlerTests() {
  const deps = geminiReply => ({
    json: (data, status) => ({ status, data }),
    cut: (v, n) => String(v == null ? '' : v).slice(0, n),
    numCfg: () => 1200,
    parseJsonLoose: raw => { try { return JSON.parse(String(raw).replace(/^```json\s*|```$/g, '')); } catch (e) { return null; } },
    callGeminiVision: async () => geminiReply
  });

  const photo = { imageBase64: 'A'.repeat(4000), mime: 'image/jpeg', subject: 'математика' };
  const env = { GEMINI_API_KEY: 'test' };
  const run = (body, reply, e) => PA.handleAnalyze(body, e || env, '', deps(reply));

  Promise.all([
    /* норма */
    run(photo, { text: JSON.stringify({
      kind: 'task', text: 'Решите: 2x = 10', solution: ['Разделим обе части на 2', 'x = 5'],
      errors: [], feedback: 'Проверь деление.'
    }) }),
    /* нет ключа */
    run(photo, { text: '{}' }, {}),
    /* битая картинка */
    run({ imageBase64: '' }, { text: '{}' }),
    /* Gemini недоступен */
    run(photo, { error: 'Gemini вернул ошибку 503.' }),
    /* модель ответила не JSON */
    run(photo, { text: 'Тут просто текст про уравнение, без всякого JSON' }),
    /* модель ответила пустотой */
    run(photo, { text: '{"kind":"task","text":"","solution":[],"errors":[],"feedback":""}' }),
    /* JSON в ```-обёртке */
    run(photo, { text: '```json\n{"kind":"task","text":"Задача","solution":["шаг"],"feedback":"ок"}\n```' })
  ]).then(([good, noKey, badImg, gemDown, notJson, empty, fenced]) => {
    check('обработчик: норма отдаёт 200', good.status === 200);
    check('обработчик: обещанные поля на месте',
          ['kind','text','solution','errors','feedback'].every(k => k in good.data));
    check('обработчик: шаги дошли', good.data.solution.length === 2);

    check('обработчик: без ключа 500 и понятная причина',
          noKey.status === 500 && /wrangler secret put GEMINI_API_KEY/.test(noKey.data.error));
    check('обработчик: без картинки 400', badImg.status === 400);
    check('обработчик: падение Gemini отдаётся как 502', gemDown.status === 502);

    /* Не JSON — но распознанное всё равно ценно: отдаём текст, а не
       пустой экран с «ошибка модели». */
    check('обработчик: не-JSON не теряет распознанное',
          notJson.status === 200 && /уравнение/.test(notJson.data.text) && notJson.data.error);

    check('обработчик: пустой разбор отдаёт 422 с советом переснять',
          empty.status === 422 && /ближе/.test(empty.data.error), JSON.stringify(empty));

    check('обработчик: JSON в markdown-обёртке разбирается',
          fenced.status === 200 && fenced.data.text === 'Задача');

    report();
  }).catch(e => {
    problems.push('обработчик: исключение — ' + e.message);
    report();
  });
})();

/* ---------- 5. Обвязка в worker.js ----------
   Проверяем текстом: это про то, как маршрут подключён, а не про
   логику. Такие вещи ломаются при перестановке строк и незаметны. */
function wiringTests() {
  const w = fs.readFileSync(path.join(ROOT, 'worker/worker.js'), 'utf8');

  check('worker: маршрут подключён', /'\/photo-analyze':\s*analyze/.test(w));
  check('worker: модуль импортируется', /import \{ handleAnalyze \} from '\.\/photo-analyze\.js'/.test(w));

  /* Общий счётчик на оба фото-маршрута: платим за распознавание, и
     чередование маршрутов не должно удваивать разрешённое. */
  const rate = w.match(/if \(url\.pathname === '\/check-photo' \|\| url\.pathname === '\/photo-analyze'\)[\s\S]{0,220}/);
  check('worker: у обоих фото-маршрутов общий лимит', !!rate);
  check('worker: лимит берёт один и тот же ключ', !!rate && /ip \+ ':photo'/.test(rate[0]));

  /* /photo-analyze работает на одном Gemini: требовать ключ DeepSeek
     значило бы выключить его тем, у кого DeepSeek не заведён. */
  const needs = w.match(/const NEEDS_DEEPSEEK = \[[^\]]+\]/);
  check('worker: список маршрутов с DeepSeek есть', !!needs);
  check('worker: /photo-analyze не требует DeepSeek', !!needs && !needs[0].includes('/photo-analyze'));

  check('worker: эндпоинт виден в /health', /'\/photo-analyze'/.test(w.split('endpoints:')[1] || ''));

  /* Ключи в файлах сайта — то, ради чего Worker и существует. */
  ['assets/photo-ai.js', 'trainer.html', 'photo.html', 'assets/config.js'].forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    check('нет ключа Gemini в ' + f, !/AIza[0-9A-Za-z_\-]{20,}/.test(src));
    check('нет ключа DeepSeek в ' + f, !/\bsk-[0-9a-f]{20,}/.test(src));
  });

  /* Потолки на фронте и в Worker должны совпадать: разъехались —
     пользователь получает 413 вместо разбора. */
  const front = fs.readFileSync(path.join(ROOT, 'assets/photo-ai.js'), 'utf8');
  const frontKb = (front.match(/MAX_KB\s*=\s*(\d+)/) || [])[1];
  const workerKb = (w.match(/MAX_IMAGE_KB:\s*(\d+)/) || [])[1];
  check('потолок размера одинаков на фронте и в Worker', frontKb === workerKb,
        'фронт ' + frontKb + ' КБ, Worker ' + workerKb + ' КБ');

  const frontSec = (front.match(/COOLDOWN_SEC\s*=\s*(\d+)/) || [])[1];
  const workerSec = (w.match(/RATE_PHOTO_SECONDS:\s*(\d+)/) || [])[1];
  check('пауза между фото одинакова на фронте и в Worker', frontSec === workerSec,
        'фронт ' + frontSec + ' с, Worker ' + workerSec + ' с');

  /* Сжатие должно быть одно на обе страницы. */
  const photoPage = fs.readFileSync(path.join(ROOT, 'photo.html'), 'utf8');
  check('photo.html пользуется общим сжатием', /PhotoAI\.compressImage/.test(photoPage));
  check('photo.html не держит свою копию сжатия', !/for \(const q of \[0\.82/.test(photoPage));
}

function report() {
  wiringTests();
  console.log('');
  console.log('Проверок пройдено: ' + ok.length);
  if (problems.length) {
    console.log('НАЙДЕНО ПРОБЛЕМ: ' + problems.length);
    problems.forEach(p => console.log('  • ' + p));
    process.exit(1);
  }
  console.log('Все проверки пройдены.');
}
