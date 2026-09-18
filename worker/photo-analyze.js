/* ============================================================
   SkyySchool — разбор фотографии задания через Gemini Vision.

   Подключается к worker.js как маршрут POST /photo-analyze.

   ПОЧЕМУ ОТДЕЛЬНЫЙ ЭНДПОИНТ, А НЕ ПРАВКА /check-photo.
   В Worker уже есть /check-photo, и он делает ДРУГУЮ работу:
   Gemini читает рукопись, а DeepSeek выставляет оценку 1–5 голосом
   выбранного ИИ-учителя, со строгостью из его карточки. Это проверка
   домашней работы: там важны оценка, персона и флаг «распознано
   неверно», на котором держится страница photo.html.

   Здесь задача другая: ученик фотографирует УСЛОВИЕ — страницу
   учебника, доску, распечатку — и хочет понять, как это решается.
   Оценка не нужна, персона не нужна, нужен разбор по шагам.

   Поэтому:
     /check-photo    — «проверь мою работу»  (Gemini OCR → DeepSeek оценка)
     /photo-analyze  — «объясни это задание» (один вызов Gemini)

   Один вызов вместо двух — это вдвое меньше задержки и денег, а
   второй модели здесь просто нечего делать: Gemini и читает, и решает.

   Разделение не жёсткое: если на фото окажется ученическая работа, а
   не условие, модель это увидит сама и вернёт kind:'homework' с
   разбором ошибок. Спорить с фотографией бессмысленно — лучше честно
   ответить на то, что на ней есть.

   Всё, что здесь есть, — чистые функции плюс handleAnalyze, который
   получает зависимости аргументом. Так весь разбор проверяется
   тестами в Node без сети и без Cloudflare (scripts/test-photo-ai.js).
   ============================================================ */

/* ---------- промпт ----------
   Главное правило промпта — «не исправляй молча». Модель, которую
   попросили и распознать, и решить, охотно чинит условие под
   удобный ей ответ: «x² – 5x + 6» превращается в «x² – 5x + 4»,
   если так красивее делятся корни. Ученик этого не замечает и
   получает решение чужой задачи. Отсюда и требование вернуть text
   дословно, и отдельный запрет на тихие правки. */
export function buildPrompt(lang, subject, taskText) {
  const shape =
    '{"kind":"task"|"homework",' +
    '"text":"...",' +
    '"solution":["шаг 1","шаг 2"],' +
    '"errors":[{"fragment":"...","why":"...","fix":"..."}],' +
    '"feedback":"..."}';

  if (lang === 'en') {
    return [
      'You are a school tutor looking at a photo taken by a student.',
      subject ? `The subject is "${subject}".` : '',
      taskText ? `The task the student is working on right now:\n"""\n${taskText}\n"""` : '',
      '',
      'Step 1. Transcribe everything on the photo into "text", exactly as written,',
      'including the student\'s own mistakes. Never silently fix the wording or the',
      'numbers of the task: a corrected condition turns into a different problem.',
      'Mark unreadable spots with [?].',
      '',
      'Step 2. Decide what the photo shows.',
      '  kind="task" — a printed or written task with no attempt at solving it.',
      '      Fill "solution" with the steps of the solution, one step per item,',
      '      each a complete sentence a student can follow. Leave "errors" empty.',
      '  kind="homework" — the student has already written something.',
      '      Fill "errors" with what is wrong: the exact fragment, why it is wrong,',
      '      and the fix. Put the correct line of reasoning in "solution".',
      '      If the work is correct, leave "errors" empty and say so in "feedback".',
      '',
      'Step 3. "feedback" — two or three sentences to the student: what to pay',
      'attention to next time. Plain, not patronising, no grade.',
      '',
      'If the photo has no task at all — a cat, a wall, a blurred page — return',
      'kind="task", an empty solution and say plainly in "feedback" what you see.',
      'Do not invent a task that is not there.',
      '',
      'Return STRICT JSON, no markdown fences, no commentary: ' + shape
    ].filter(Boolean).join('\n');
  }

  return [
    'Ты школьный репетитор и смотришь на фотографию, которую сделал ученик.',
    subject ? `Предмет — «${subject}».` : '',
    taskText ? `Задание, над которым ученик работает сейчас:\n"""\n${taskText}\n"""` : '',
    '',
    'Шаг 1. Перепиши в поле text всё, что есть на фото, дословно — вместе с',
    'ошибками ученика. Никогда не исправляй молча формулировку или числа',
    'условия: исправленное условие — это уже другая задача, и решение к ней',
    'ученику не поможет. Нечитаемые места помечай [?].',
    '',
    'Шаг 2. Определи, что на фото.',
    '  kind="task" — условие задания, к которому ещё не приступали.',
    '      Заполни solution шагами решения: один шаг — один пункт, каждый',
    '      законченным предложением, по которому можно идти самому.',
    '      Поле errors оставь пустым.',
    '  kind="homework" — ученик уже что-то написал.',
    '      Заполни errors: точный фрагмент, почему неверно, как исправить.',
    '      В solution положи правильный ход решения.',
    '      Если работа верна — errors пустой, и скажи об этом в feedback.',
    '',
    'Шаг 3. feedback — две-три фразы ученику: на что обратить внимание в',
    'следующий раз. Спокойно, без сюсюканья и без оценки.',
    '',
    'Если на фото нет задания — кот, стена, размытая страница — верни',
    'kind="task", пустой solution и честно напиши в feedback, что видно.',
    'Не выдумывай задание, которого нет.',
    '',
    'Ответ — СТРОГО JSON, без markdown и без пояснений вокруг: ' + shape
  ].filter(Boolean).join('\n');
}


/* ---------- разбор картинки из тела запроса ----------
   Принимаем и «чистый» base64, и data:image/jpeg;base64,… — браузер
   отдаёт второе, а curl в тестах обычно первое. */
export function readImage(body, maxBytes) {
  const raw = String(body && body.imageBase64 || '');
  if (!raw) return { error: 'Нет изображения.', status: 400 };

  const m = raw.match(/^data:(image\/[a-z0-9+.-]+);base64,(.*)$/i);
  const mime = (m ? m[1] : String(body.mime || 'image/jpeg')).slice(0, 40).toLowerCase();
  const b64 = (m ? m[2] : raw).replace(/\s+/g, '');

  if (!b64) return { error: 'Нет изображения.', status: 400 };

  /* Gemini понимает эти четыре; всё остальное лучше отклонить здесь,
     чем платить за запрос и получить 400 от модели. */
  const OK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  if (!OK_MIME.includes(mime)) {
    return { error: 'Такой формат не поддерживается. Нужен JPEG, PNG, WebP или HEIC.', status: 415 };
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    return { error: 'Изображение повреждено при передаче.', status: 400 };
  }

  /* base64 длиннее исходных байтов примерно на треть */
  const bytes = Math.floor(b64.length * 0.75);
  if (bytes > maxBytes) {
    return { error: 'Фото слишком большое: ' + Math.round(bytes / 1024) + ' КБ после сжатия.', status: 413 };
  }
  /* Меньше килобайта — это не фотография задания, а иконка или обрезок:
     модель на таком «увидит» что угодно, и лучше сказать сразу. */
  if (bytes < 1024) {
    return { error: 'Фото слишком маленькое, текст на нём не разобрать.', status: 400 };
  }

  return { b64, mime, bytes };
}


/* ---------- приведение ответа модели к обещанному виду ----------
   Модель может вернуть строку вместо массива, лишние поля, пустоту.
   Страница не должна об этом знать: ей обещаны text, solution,
   errors, feedback — их она и получает, всегда нужного типа. */
export function normalise(parsed, cut) {
  const trim = cut || (v => String(v == null ? '' : v));
  const p = parsed || {};

  const kind = p.kind === 'homework' ? 'homework' : 'task';

  /* solution приходит то массивом, то абзацем с нумерацией — второе
     разбираем на шаги сами, иначе «по шагам» превращается в стену. */
  let solution = [];
  if (Array.isArray(p.solution)) {
    solution = p.solution;
  } else if (typeof p.solution === 'string' && p.solution.trim()) {
    solution = p.solution.split(/\n+|(?:^|\s)\d+[.)]\s+/).filter(s => s && s.trim());
  }
  solution = solution.map(s => trim(s, 600)).filter(Boolean).slice(0, 15);

  const errors = (Array.isArray(p.errors) ? p.errors : [])
    .filter(e => e && (e.fragment || e.why || e.fix))
    .slice(0, 20)
    .map(e => ({
      fragment: trim(e.fragment, 300),
      why: trim(e.why || e.explanation, 500),
      fix: trim(e.fix, 300)
    }));

  return {
    kind,
    text: trim(p.text, 4000),
    solution,
    errors,
    feedback: trim(p.feedback, 1500)
  };
}


/* ---------- обработчик ----------
   deps приходят из worker.js: json, cut, numCfg, callGeminiVision,
   parseJsonLoose. Это не «инъекция ради инъекции» — так весь разбор
   проверяется в Node подставным fetch, без ключей и без сети. */
export async function handleAnalyze(body, env, origin, deps) {
  const { json, cut, numCfg, callGeminiVision, parseJsonLoose } = deps;

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Ключ Gemini не задан в настройках Worker. Выполните: npx wrangler secret put GEMINI_API_KEY' }, 500, origin, env);
  }

  const img = readImage(body, numCfg(env, 'MAX_IMAGE_KB') * 1024);
  if (img.error) return json({ error: img.error }, img.status, origin, env);

  const lang = body.lang === 'en' ? 'en' : 'ru';
  const subject = cut(body.subject, 60);
  const taskText = cut(body.taskText, 800);

  const res = await callGeminiVision(env, img.b64, img.mime, buildPrompt(lang, subject, taskText));
  if (res.error) return json({ error: res.error, detail: res.detail }, 502, origin, env);

  const parsed = parseJsonLoose(res.text);
  if (!parsed) {
    /* JSON не разобрался — но распознанное всё равно ценно, и отдать
       его лучше, чем показать пустой экран с «ошибка модели». */
    return json({
      error: 'Модель ответила не в том формате, разбор показать не получилось.',
      kind: 'task',
      text: cut(res.text, 4000),
      solution: [],
      errors: [],
      feedback: ''
    }, 200, origin, env);
  }

  const out = normalise(parsed, cut);

  /* Пустой текст при успешном ответе — это «на фото ничего не
     прочиталось». Сообщаем прямо, а не отдаём пустые поля. */
  if (!out.text && !out.solution.length && !out.feedback) {
    return json({ error: 'На фото не удалось разобрать ни задания, ни текста. Попробуйте снять ближе и при лучшем свете.' }, 422, origin, env);
  }

  return json(out, 200, origin, env);
}
