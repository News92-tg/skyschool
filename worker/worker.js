/* ============================================================
   SkyySchool — прокси к моделям на Cloudflare Workers
 
   Зачем он нужен. Ключи нельзя класть в файлы сайта: GitHub Pages
   отдаёт их как есть, и ключ увидит любой, кто откроет исходник
   страницы. По GitHub круглосуточно ходят боты, которые ищут строки
   вида sk-… и тратят чужие деньги.
 
   Здесь ключи живут в переменных окружения Worker: браузер их не
   получает, они уходят только с этого сервера в модель.
 
   Три эндпоинта:
     POST /explain       — разбор задания (DeepSeek)
     POST /check-photo   — домашка по фото (Gemini Vision → DeepSeek)
     POST /chess-explain — объяснение уже посчитанной оценки хода
                           (DeepSeek; САМУ оценку считает движок в
                           браузере, см. assets/chess-review.js)
 
   Как развернуть:
     npx wrangler login
     npx wrangler secret put DEEPSEEK_API_KEY
     npx wrangler secret put GEMINI_API_KEY     # только для /check-photo
     npx wrangler deploy
   Полученный адрес впишите в assets/config.js в поле AI_BASE.
 
   Все лимиты и имена моделей — переменные окружения со значениями по
   умолчанию (см. DEFAULTS ниже). Числа в тарифах и названия моделей
   меняются часто, и менять их правкой кода с последующим деплоем —
   плохая идея: правится в панели Cloudflare без выкатки.
   ============================================================ */
 
/* ---------- настройки ----------
   Любое из этих значений переопределяется переменной окружения с тем
   же именем: wrangler.toml → [vars], либо панель Cloudflare. */
const DEFAULTS = {
  /* общая частота: сколько запросов с одного адреса за минуту */
  RATE_PER_MIN: 20,
  /* минимальный промежуток между разборами фото с одного адреса, сек */
  RATE_PHOTO_SECONDS: 30,
  /* минимальный промежуток между объяснениями ходов, сек */
  RATE_CHESS_SECONDS: 3,
  /* максимальный размер картинки после сжатия в браузере, КБ */
  MAX_IMAGE_KB: 1200,
  /* модели */
  DEEPSEEK_MODEL: 'deepseek-chat',
  GEMINI_MODEL: 'gemini-2.5-flash',
  /* потолок ответа модели в токенах */
  MAX_TOKENS: 500,
  MAX_TOKENS_PHOTO: 900,
  /* домены, которым разрешено обращаться сюда; через запятую */
  ALLOWED_ORIGINS: [
    'https://news92-tg.github.io',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8100',
    'http://127.0.0.1:8100'
  ].join(',')
};
 
const numCfg = (env, key) => {
  const raw = env && env[key];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULTS[key];
};
const strCfg = (env, key) => {
  const raw = env && env[key];
  return (typeof raw === 'string' && raw.trim()) ? raw.trim() : DEFAULTS[key];
};
const originList = env => strCfg(env, 'ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean);
 
 
/* ---------- ограничение частоты ----------
   Хранится в памяти Worker: при перезапуске обнуляется, и это
   нормально. Цель не безопасность (её даёт белый список источников), а
   защита от случайного цикла, который за ночь съест весь баланс.
 
   Две разные меры: счётчик за минуту для обычных запросов и
   минимальный промежуток для дорогих (фото). Считать фото тем же
   счётчиком неправильно — двадцать распознаваний подряд стоят совсем
   других денег, чем двадцать текстовых разборов. */
const hits = new Map();
const lastAt = new Map();
 
function sweep(now) {
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > 60_000) hits.delete(k);
  if (lastAt.size > 5000) for (const [k, t] of lastAt) if (now - t > 3_600_000) lastAt.delete(k);
}
 
function ratePerMinOk(ip, limit) {
  const now = Date.now();
  sweep(now);
  const rec = hits.get(ip);
  if (!rec || now - rec.start > 60_000) { hits.set(ip, { start: now, n: 1 }); return true; }
  rec.n++;
  return rec.n <= limit;
}
 
/* Возвращает 0, если можно, иначе сколько секунд ещё ждать. */
function intervalWait(key, seconds) {
  const now = Date.now();
  const prev = lastAt.get(key);
  if (prev && now - prev < seconds * 1000) {
    return Math.ceil((seconds * 1000 - (now - prev)) / 1000);
  }
  lastAt.set(key, now);
  return 0;
}
 
 
/* ---------- служебное ---------- */
function cors(origin, env) {
  const list = originList(env);
  const allow = list.includes(origin) ? origin : list[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}
 
const json = (data, status, origin, env) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(origin, env) }
});
 
/* Обрезаем всё, что приходит от браузера: длина запроса напрямую
   переводится в деньги, и присылать сюда мегабайт текста незачем. */
const cut = (v, n) => String(v == null ? '' : v).slice(0, n);
 
 
/* ---------- кто объясняет ----------
   Клиент присылает ТОЛЬКО идентификатор, промпты живут здесь.
   Так и должно быть: если принимать текст системного промпта от
   клиента, Worker становится бесплатным доступом к вашему ключу
   DeepSeek для любых задач — от чужих курсовых до попыток обойти
   ограничения модели. Неизвестный идентификатор не ошибка, а повод
   ответить общим промптом: так старый Worker продолжает работать с
   новым сайтом, просто без персонажа.
 
   ВАЖНО: тексты должны совпадать с data/ai-teachers.js. Это осознанное
   дублирование — файл нужен сайту для режима «свой ключ» и для работы
   офлайн, а Worker не может ему доверять. Правя промпт в одном месте,
   поправьте во втором. */
const TEACHERS = {
  'socrates': {
    ru: 'Ты — Сократ, учитель, который никогда не выдаёт готовый вывод. Разбирай задание цепочкой наводящих вопросов: каждый следующий вопрос должен опираться на ответ, который ученик уже способен дать сам. Задавай не больше трёх вопросов подряд, после чего коротко подытоживай. Если ученик ошибся — не говори «неверно», а спроси о том месте, где рассуждение сломалось. В конце одной фразой назови верный ход мысли, чтобы ученик не остался в тупике.',
    en: 'You are Socrates, a teacher who never hands over the conclusion. Work through the problem as a chain of leading questions, each building on an answer the student can already give. Ask no more than three questions in a row, then briefly sum up. If the student was wrong, do not say "incorrect" — ask about the exact point where the reasoning broke. End by stating the correct line of thought in one sentence.'
  },
  'strict-peter': {
    ru: 'Ты — Пётр, строгий экзаменатор ЕГЭ и ОГЭ. Указывай, что именно проверяющий засчитал бы, что снял бы и почему, какая формулировка неточна и как записать ответ так, чтобы придраться было не к чему. Называй типичную ошибку по имени («потеря области определения», «нет проверки корней»). Хвали редко и только за точную работу. Никогда не унижай ученика: строгость — к работе, а не к человеку.',
    en: 'You are Peter, a strict exam marker. State what a marker would credit, what they would deduct and why, which wording is imprecise, and how to write the answer so nothing can be faulted. Name the typical mistake precisely. Praise rarely and only for precise work. Never belittle the student: strictness applies to the work, not the person.'
  },
  'kind-max': {
    ru: 'Ты — Макс, старший друг, который объясняет так, что понятно с первого раза. Говори обычными словами, термин вводи только после житейского примера. Если ученик ошибся, сначала скажи, что в его рассуждении было разумного, и только потом покажи, где мысль свернула не туда. Хвали за конкретное, а не общими словами. Не сюсюкай и не преувеличивай успехи.',
    en: 'You are Max, an older friend who explains so it clicks the first time. Use ordinary words; introduce a term only after an everyday example. If the student got it wrong, first say what was sensible in their reasoning, then show where it turned off course. Praise something specific, not in general terms. Do not talk down or overstate success.'
  },
  'lomonosov': {
    ru: 'Ты — профессор, который считает заученное правило без понимания бесполезным. Показывай, откуда берётся правило или формула и из какого более общего принципа следует. Отдельно называй границы применимости: когда правило перестаёт работать. Исторические ссылки — только если уверен в факте. Говори академично, но без наукообразия, и не превращай школьный вопрос в лекцию для старшего курса.',
    en: 'You are a professor who holds a memorised rule without its origin to be useless. Show where the rule or formula comes from and which general principle it follows from. State its limits separately. Give historical references only when certain. Speak academically without pomposity, and do not turn a school question into a graduate lecture.'
  },
  'coach-anya': {
    ru: 'Ты — Аня, тренер по подготовке. Сначала коротко объясни задание. Затем назови ровно один следующий шаг: какую конкретную тему взять сейчас и почему именно её; шаг должен быть выполним за один заход. Разовую невнимательность не раздувай в пробел в знаниях, системную дыру называй прямо. Мотивируй фактами о прогрессе, а не лозунгами.',
    en: 'You are Anya, a preparation coach. First explain the task briefly. Then name exactly one next step: which specific topic to take now and why, doable in one sitting. Do not inflate one-off carelessness into a knowledge gap; name a systematic hole plainly. Motivate with facts about progress, not slogans.'
  },
  'malysh': {
    ru: 'Ты объясняешь ребёнку 5–10 лет. Очень короткие предложения, по одной мысли. Слова, которые ребёнок слышит дома: яблоки, шаги, кубики. Считать помогай на предметах, а не формулой. Если ребёнок ошибся, скажи, что так думают многие, и покажи, как проверить самому; никогда не начинай со слова «неправильно». Один-два эмодзи уместны. Уложись в 120 слов.',
    en: 'You are explaining to a child aged 5–10. Very short sentences, one idea each. Words a child hears at home: apples, steps, blocks. Help with counting on objects, not formulas. If the child was wrong, say many people think so too and show how to check; never start with "wrong". One or two emoji are fine. Keep it under 120 words.'
  }
};
 
/* Строгость учителя. Держится здесь и в assets/ai-teachers.js по той
   же причине, что и промпты. */
const STRICT = {
  1: { ru: 'Прощай мелкие ошибки и описки. Оценку занижай только за непонимание сути.',
       en: 'Forgive small slips. Lower the mark only for misunderstanding the substance.' },
  2: { ru: 'Мелкие неточности отмечай, но оценку за них не снижай.',
       en: 'Note small inaccuracies but do not lower the mark for them.' },
  3: { ru: 'Обычная школьная мерка: и содержание, и оформление, без придирок и без поблажек.',
       en: 'Ordinary school standard: content and presentation, no nitpicking, no leniency.' },
  4: { ru: 'Снижай за неточные формулировки и пропущенные обоснования, даже если ответ верный.',
       en: 'Lower the mark for imprecise wording and missing justification, even if the answer is right.' },
  5: { ru: 'Экзаменационная строгость: любая неточность формулировки или пропущенный шаг стоят балла.',
       en: 'Exam strictness: any imprecise wording or skipped step costs a mark.' }
};
 
function persona(teacherId, lang) {
  const t = TEACHERS[cut(teacherId, 40)];
  return t ? t[lang] : null;
}
 
 
/* ---------- вызовы моделей ---------- */
function deepseekHint(status) {
  return status === 401 ? 'Ключ DeepSeek неверен или отозван.'
    : status === 402 ? 'На счету DeepSeek закончились средства.'
    : status === 429 ? 'DeepSeek ограничил частоту запросов. Попробуйте через минуту.'
    : 'DeepSeek вернул ошибку ' + status + '.';
}
 
async function callDeepSeek(env, system, user, opts) {
  const o = opts || {};
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY
    },
    body: JSON.stringify(Object.assign({
      model: strCfg(env, 'DEEPSEEK_MODEL'),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: o.temperature == null ? 0.3 : o.temperature,
      max_tokens: o.maxTokens || numCfg(env, 'MAX_TOKENS')
    }, o.jsonMode ? { response_format: { type: 'json_object' } } : {}))
  });
 
  if (!r.ok) {
    const text = await r.text();
    return { error: deepseekHint(r.status), detail: text.slice(0, 300) };
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) return { error: 'Пустой ответ от DeepSeek.' };
  return { content };
}
 
/* Gemini Vision: распознавание рукописного текста.
   Отдельная модель именно потому, что DeepSeek картинок не читает. */
async function callGeminiVision(env, base64, mime, prompt) {
  const model = strCfg(env, 'GEMINI_MODEL');
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
        generationConfig: { temperature: 0 }   /* распознавание, а не сочинение */
      })
    }
  );
 
  if (!r.ok) {
    const text = await r.text();
    const hint = r.status === 400 ? 'Gemini не принял изображение (формат или размер).'
      : r.status === 403 ? 'Ключ Gemini неверен или у него нет доступа к этой модели.'
      : r.status === 429 ? 'Исчерпан лимит запросов Gemini. Попробуйте позже.'
      : 'Gemini вернул ошибку ' + r.status + '.';
    return { error: hint, detail: text.slice(0, 300) };
  }
  const data = await r.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map(p => p.text || '').join('').trim();
  if (!text) return { error: 'Gemini не смог прочитать текст на фото.' };
  return { text };
}
 
/* Модель иногда оборачивает JSON в ```json … ``` вопреки просьбе.
   Снимаем обёртку, прежде чем разбирать. */
function parseJsonLoose(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a > 0 || b < s.length - 1) { if (a >= 0 && b > a) s = s.slice(a, b + 1); }
  try { return JSON.parse(s); } catch (e) { return null; }
}
 
 
/* ============================================================
   Обработчики
   ============================================================ */
 
/* ---------- /explain: разбор задания ---------- */
async function handleExplain(body, env, origin) {
  const lang = body.lang === 'en' ? 'en' : 'ru';
  const task = cut(body.task, 1200);
  if (!task.trim()) return json({ error: 'empty task' }, 400, origin, env);
 
  const options = Array.isArray(body.options) ? body.options.slice(0, 8).map(o => cut(o, 200)) : [];
  const userAnswer = cut(body.userAnswer, 200);
  const correctAnswer = cut(body.correctAnswer, 200);
  const subject = cut(body.subject, 60);
  const topic = cut(body.topic, 80);
 
  const COMMON = lang === 'ru'
    ? '\nНе выдумывай фактов. Если условие неполное — так и скажи.\nУложись в 200 слов. Не используй markdown-заголовки и списки, пиши связным текстом.'
    : '\nDo not invent facts. If the problem is incomplete, say so.\nKeep it under 200 words. No markdown headings or bullet lists — write flowing prose.';
 
  const p = persona(body.teacher, lang);
  const system = p ? p + COMMON : (lang === 'ru'
    ? 'Ты помогаешь школьнику разобраться в задании. Объясняй по шагам, простым языком, без формул там, где можно без них.\n' +
      'Если ученик ошибся — сначала объясни, почему его вариант выглядел правдоподобно, и только потом покажи верный ход мысли.' + COMMON
    : 'You are helping a school student understand a problem. Explain step by step, in plain language.\n' +
      'If the student got it wrong, first explain why their answer looked plausible, then show the correct reasoning.' + COMMON);
 
  const user = lang === 'ru'
    ? `Предмет: ${subject || '—'}${topic ? ', тема: ' + topic : ''}\nЗадание: ${task}\n` +
      (options.length ? 'Варианты: ' + options.join(' | ') + '\n' : '') +
      `Ученик ответил: ${userAnswer || '—'}\nПравильный ответ: ${correctAnswer || '—'}\n\nОбъясни, почему правильный ответ именно такой.`
    : `Subject: ${subject || '—'}${topic ? ', topic: ' + topic : ''}\nProblem: ${task}\n` +
      (options.length ? 'Options: ' + options.join(' | ') + '\n' : '') +
      `The student answered: ${userAnswer || '—'}\nCorrect answer: ${correctAnswer || '—'}\n\nExplain why the correct answer is what it is.`;
 
  const res = await callDeepSeek(env, system, user);
  if (res.error) return json(res, 502, origin, env);
  return json({ explanation: res.content }, 200, origin, env);
}
 
 
/* ============================================================
   Supabase: личность пользователя и его квота
 
   ПОЧЕМУ userId НЕ БЕРЁТСЯ ИЗ ТЕЛА ЗАПРОСА
   ----------------------------------------
   В исходном задании Worker принимал "userId" полем JSON. Так делать
   нельзя: тело запроса пишет клиент, и подставить туда чужой или
   выдуманный идентификатор может кто угодно обычным curl. Последствия
   не теоретические — можно бесконечно обходить свой лимит (каждый раз
   новый случайный uuid) и можно сжечь чужую оплаченную квоту.
 
   Поэтому личность берётся из access-токена Supabase, который браузер
   присылает в заголовке Authorization. Токен подписан Supabase, и
   проверяет его сам Supabase — мы только спрашиваем у него «кто это».
 
   Анонимных не выгоняем: без токена работает прежнее ограничение по
   IP-адресу, как было до тарифов. Сайт обязан работать без аккаунта.
   ============================================================ */
 
const supaUrl = env => String(env.SUPABASE_URL || '').replace(/\/+$/, '');
const supaKey = env => env.SUPABASE_SERVICE_KEY || '';
const supaReady = env => !!(supaUrl(env) && supaKey(env));
 
/* Кто прислал запрос. null — аноним (это нормально). */
async function whoAmI(request, env) {
  if (!supaReady(env)) return null;
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const r = await fetch(supaUrl(env) + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: supaKey(env) }
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, email: u.email || null } : null;
  } catch (e) {
    /* Supabase недоступен — не роняем разбор, откатываемся к лимиту по IP */
    return null;
  }
}
 
/* Вызов функции в базе сервисным ключом. */
async function supaRpc(env, fn, args) {
  const r = await fetch(supaUrl(env) + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: supaKey(env),
      Authorization: 'Bearer ' + supaKey(env),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(args || {})
  });
  const text = await r.text();
  if (!r.ok) return { error: 'supabase ' + r.status, detail: text.slice(0, 300) };
  try {
    const data = JSON.parse(text);
    return { data: Array.isArray(data) ? data[0] : data };
  } catch (e) {
    return { error: 'supabase: ответ не разобран', detail: text.slice(0, 200) };
  }
}
 
async function supaInsert(env, table, row) {
  try {
    await fetch(supaUrl(env) + '/rest/v1/' + table, {
      method: 'POST',
      headers: {
        apikey: supaKey(env),
        Authorization: 'Bearer ' + supaKey(env),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    });
  } catch (e) { /* история не критична: ученик уже получил разбор */ }
}
 
 
/* ---------- /check-photo: домашка по фото ----------
   Два шага: Gemini читает рукописный текст, DeepSeek оценивает
   прочитанное от лица выбранного учителя.
 
   Распознанный текст возвращается ученику ОБЯЗАТЕЛЬНО и отдельно от
   оценки. Это не деталь интерфейса: распознавание детского почерка
   ошибается, и когда оценка выглядит несправедливой, первое, что надо
   увидеть, — что именно модель приняла за написанное. Без этого
   ученик спорит с оценкой вслепую. */
async function handlePhoto(body, env, origin, request, ip) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'Ключ Gemini не задан в настройках Worker. Выполните: npx wrangler secret put GEMINI_API_KEY' }, 500, origin, env);
  }
 
  const lang = body.lang === 'en' ? 'en' : 'ru';
  const raw = String(body.imageBase64 || '');
  /* приходит либо чистый base64, либо data:image/jpeg;base64,… */
  const m = raw.match(/^data:(image\/[a-z+]+);base64,(.*)$/i);
  const mime = m ? m[1] : (cut(body.mime, 30) || 'image/jpeg');
  const b64 = m ? m[2] : raw;
 
  if (!b64) return json({ error: 'Нет изображения.' }, 400, origin, env);
 
  const maxBytes = numCfg(env, 'MAX_IMAGE_KB') * 1024;
  /* base64 длиннее оригинала примерно на треть */
  if (b64.length * 0.75 > maxBytes) {
    return json({ error: `Фото слишком большое. Максимум ${numCfg(env, 'MAX_IMAGE_KB')} КБ после сжатия.` }, 413, origin, env);
  }
 
  const subject = cut(body.subject, 60) || 'english';
  const taskText = cut(body.taskText, 800);
  const strictness = Math.min(5, Math.max(1, Number(body.strictness) || 3));
 
  /* --- шаг 0: личность и квота ---
     Личность берём из подписанного токена, а не из тела запроса
     (см. комментарий к whoAmI выше). Для анонимов квоты нет — у них
     работает прежнее ограничение по IP из точки входа. */
  const me = request ? await whoAmI(request, env) : null;
  let quota = null;
 
  if (!me) {
    /* Аноним: прежнее ограничение по адресу. Оно осталось ровно таким,
       каким было до тарифов, — просто переехало сюда. */
    const wait = intervalWait((ip || 'unknown') + ':photo', numCfg(env, 'RATE_PHOTO_SECONDS'));
    if (wait) {
      return json({
        error: `Следующая проверка фото будет доступна через ${wait} сек.`,
        reason: 'rate', waitSec: wait, anonymous: true
      }, 429, origin, env);
    }
  }
 
  if (me && supaReady(env)) {
    const res = await supaRpc(env, 'photo_try_consume', { p_user: me.id });
    if (res.error) {
      /* База не ответила. Пропускаем разбор, но не молча: лучше
         разобрать домашку бесплатно, чем отказать из-за своей же
         инфраструктуры. В логах Cloudflare это будет видно. */
      console.log('photo_try_consume failed:', res.error, res.detail || '');
    } else {
      quota = res.data || null;
      if (quota && quota.allowed === false) {
        /* 429 — «слишком часто, подождите»; 402 — «квота на сегодня
           кончилась, нужен тариф». Разные коды, потому что интерфейсу
           нужно показать разное: таймер против предложения оплатить. */
        if (quota.reason === 'rate') {
          return json({
            error: `Следующий разбор будет доступен через ${quota.wait_sec} сек.`,
            reason: 'rate',
            waitSec: quota.wait_sec,
            used: quota.used, limit: quota.day_limit,
            plan: quota.plan, resetAt: quota.reset_at
          }, 429, origin, env);
        }
        return json({
          error: 'Лимит разборов на сегодня исчерпан.',
          reason: 'quota',
          used: quota.used, limit: quota.day_limit,
          plan: quota.plan, resetAt: quota.reset_at
        }, 402, origin, env);
      }
    }
  }
 
  /* Вернуть списанный разбор, если дальше что-то сломалось не по вине
     ученика. Без этого сбой Gemini стоил бы ему разбора из квоты. */
  const refund = async () => {
    if (me && quota && quota.allowed) {
      await supaRpc(env, 'photo_refund', { p_user: me.id }).catch(() => {});
    }
  };
 
  /* --- шаг 1: распознавание --- */
  const ocrPrompt = lang === 'ru'
    ? 'Ты — OCR для рукописного текста в тетради школьника. Распознай весь текст на фото и верни его построчно, ровно как написано, не исправляя ошибок ученика. Формат ответа — обычный текст без пояснений. Нечитаемое место помечай [?].'
    : 'You are an OCR for handwriting in a school exercise book. Transcribe all text in the photo line by line, exactly as written, without correcting the student\'s mistakes. Reply with plain text only, no commentary. Mark unreadable spots with [?].';
 
  const ocr = await callGeminiVision(env, b64, mime, ocrPrompt);
  if (ocr.error) { await refund(); return json(ocr, 502, origin, env); }
 
  const recognized = cut(ocr.text, 4000);
 
  /* --- шаг 2: оценка --- */
  const p = persona(body.teacher, lang);
  const strictNote = (STRICT[strictness] || STRICT[3])[lang];
 
  const system = (p ? p + '\n\n' : '') + (lang === 'ru'
    ? `Ты проверяешь домашнюю работу школьника по предмету «${subject}».\n${strictNote}\n` +
      'Текст работы получен распознаванием рукописи и может содержать ошибки распознавания. ' +
      'Если фрагмент похож на сбой распознавания, а не на ошибку ученика, не снижай за него оценку и скажи об этом в overall_feedback.\n' +
      'Не выдумывай того, чего нет в тексте. Верни СТРОГО JSON без markdown и без пояснений вокруг.'
    : `You are marking a student's homework in "${subject}".\n${strictNote}\n` +
      'The text came from handwriting recognition and may contain recognition errors. ' +
      'If a fragment looks like a recognition glitch rather than the student\'s mistake, do not deduct for it and say so in overall_feedback.\n' +
      'Do not invent anything absent from the text. Return STRICT JSON, no markdown, no commentary around it.');
 
  const shape = '{"grade":1-5,"correct_parts":["..."],"errors":[{"fragment":"...","explanation":"...","fix":"..."}],"overall_feedback":"...","next_step":"..."}';
 
  const user = (lang === 'ru'
    ? (taskText ? `Задание, которое было дано:\n"""\n${taskText}\n"""\n\n` : '') +
      `Распознанный текст работы:\n"""\n${recognized}\n"""\n\nПоставь оценку 1–5 и разбери работу. Формат ответа: ${shape}`
    : (taskText ? `The task that was set:\n"""\n${taskText}\n"""\n\n` : '') +
      `Recognised text of the work:\n"""\n${recognized}\n"""\n\nGive a mark 1–5 and review the work. Reply shape: ${shape}`);
 
  const res = await callDeepSeek(env, system, user, {
    maxTokens: numCfg(env, 'MAX_TOKENS_PHOTO'),
    jsonMode: true,
    temperature: 0.2
  });
  if (res.error) {
    /* распознанное всё равно возвращаем: ученику полезно увидеть,
       что прочиталось, даже если оценить не удалось */
    await refund();
    return json({ error: res.error, recognized_text: recognized }, 502, origin, env);
  }
 
  const parsed = parseJsonLoose(res.content);
  if (!parsed) {
    await refund();
    return json({ error: 'Модель вернула ответ, который не удалось разобрать как JSON.', recognized_text: recognized }, 502, origin, env);
  }
 
  const grade = Math.min(5, Math.max(1, Number(parsed.grade) || 3));
  const errors = Array.isArray(parsed.errors) ? parsed.errors.slice(0, 20) : [];
  const feedback = cut(parsed.overall_feedback, 1500);
 
  /* История — в базу. Фото НЕ сохраняем: это тетрадь ребёнка, и
     держать её снимки на сервере без отдельного разговора незачем.
     image_url остаётся для случая, когда такой разговор состоится. */
  if (me && supaReady(env)) {
    await supaInsert(env, 'photo_checks', {
      user_id: me.id,
      subject,
      recognized_text: recognized,
      ai_feedback: feedback,
      grade,
      errors,
      status: 'ok'
    });
  }
 
  return json({
    recognized_text: recognized,
    grade,
    correct_parts: Array.isArray(parsed.correct_parts) ? parsed.correct_parts.slice(0, 12) : [],
    errors,
    overall_feedback: feedback,
    next_step: cut(parsed.next_step, 400),
    /* остаток квоты — чтобы интерфейс обновил «2 из 3» без
       дополнительного запроса к базе */
    quota: quota ? { used: quota.used, limit: quota.day_limit, plan: quota.plan, resetAt: quota.reset_at } : null
  }, 200, origin, env);
}
 
 
/* ---------- /chess-explain: словами про уже посчитанный ход ----------
   Внимание на распределение ролей. Ярлык хода (blunder, mistake и так
   далее), потерю в оценке и лучший ход считает ШАХМАТНЫЙ ДВИЖОК в
   браузере — assets/chess-review.js. Сюда приходит готовый результат, и
   модель только переводит его в человеческую фразу.
 
   Так сделано намеренно. Языковая модель не умеет оценивать позицию:
   она выдаст уверенный ярлык, регулярно неверный, и предложит «лучшие
   ходы», часть которых в этой позиции невозможна. Ученик не сможет
   отличить такую подсказку от настоящей — он же учится. Движок при
   этом считает точно, мгновенно и бесплатно.
 
   Поэтому эндпоинт не принимает решения: если модель недоступна,
   раздел работает без него, просто без словесного пояснения. */
async function handleChessExplain(body, env, origin) {
  const lang = body.lang === 'en' ? 'en' : 'ru';
 
  const quality = cut(body.quality, 20);
  const allowed = ['brilliant', 'good', 'inaccuracy', 'mistake', 'blunder'];
  if (!allowed.includes(quality)) return json({ error: 'unknown quality' }, 400, origin, env);
 
  const move = cut(body.move, 12);
  const better = cut(body.betterMove, 12);
  const fen = cut(body.fen, 100);
  const loss = Number(body.loss);
  const lossPawns = Number.isFinite(loss) ? (loss / 100).toFixed(1) : null;
  const material = cut(body.material, 200);
 
  const p = persona(body.teacher, lang);
 
  const system = (p ? p + '\n\n' : '') + (lang === 'ru'
    ? 'Ты шахматный тренер. Оценку хода и лучший ход уже посчитал движок — они даны тебе как факт, и спорить с ними нельзя: ' +
      'твоя работа только объяснить их человеческим языком. Не предлагай других ходов и не пересчитывай оценку. ' +
      'Не утверждай ничего о позиции, чего нет в присланных данных. Две-три фразы, простым языком, без списков.'
    : 'You are a chess coach. The engine has already computed the move quality and the better move — they are given to you as fact and must not be disputed: ' +
      'your job is only to explain them in human language. Do not suggest other moves and do not recompute the evaluation. ' +
      'Do not assert anything about the position that is not in the data given. Two or three sentences, plain language, no lists.');
 
  const names = {
    ru: { brilliant: 'отличный ход', good: 'хороший ход', inaccuracy: 'неточность', mistake: 'ошибка', blunder: 'грубая ошибка' },
    en: { brilliant: 'brilliant move', good: 'good move', inaccuracy: 'inaccuracy', mistake: 'mistake', blunder: 'blunder' }
  }[lang];
 
  const user = lang === 'ru'
    ? `Позиция до хода (FEN): ${fen}\nХод ученика: ${move}\nОценка движка: ${names[quality]}` +
      (lossPawns ? `\nПотеря по оценке: ${lossPawns} пешки` : '') +
      (better ? `\nЛучший ход по движку: ${better}` : '') +
      (material ? `\nЧто изменилось в материале: ${material}` : '') +
      '\n\nОбъясни ученику, почему его ход оценён именно так' + (better ? ' и в чём идея лучшего хода.' : '.')
    : `Position before the move (FEN): ${fen}\nStudent move: ${move}\nEngine verdict: ${names[quality]}` +
      (lossPawns ? `\nEvaluation loss: ${lossPawns} pawns` : '') +
      (better ? `\nEngine's better move: ${better}` : '') +
      (material ? `\nMaterial change: ${material}` : '') +
      '\n\nExplain to the student why their move is judged this way' + (better ? ' and what the idea behind the better move is.' : '.');
 
  const res = await callDeepSeek(env, system, user, { maxTokens: 220, temperature: 0.4 });
  if (res.error) return json(res, 502, origin, env);
  return json({ explanation: res.content }, 200, origin, env);
}
 
 
/* ============================================================
   Точка входа
   ============================================================ */
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
 
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin, env) });
    }
 
    const url = new URL(request.url);
 
    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        service: 'skyschool-ai',
        hasKey: !!env.DEEPSEEK_API_KEY,
        hasVision: !!env.GEMINI_API_KEY,
        hasQuotas: supaReady(env),
        endpoints: ['/explain', '/check-photo', '/chess-explain'],
        limits: {
          ratePerMin: numCfg(env, 'RATE_PER_MIN'),
          photoSeconds: numCfg(env, 'RATE_PHOTO_SECONDS'),
          chessSeconds: numCfg(env, 'RATE_CHESS_SECONDS'),
          maxImageKb: numCfg(env, 'MAX_IMAGE_KB')
        }
      }, 200, origin, env);
    }
 
    const routes = {
      '/explain': handleExplain,
      '/check-photo': handlePhoto,
      '/chess-explain': handleChessExplain
    };
    const handler = routes[url.pathname];
    if (!handler) return json({ error: 'not found' }, 404, origin, env);
    if (request.method !== 'POST') return json({ error: 'use POST' }, 405, origin, env);
 
    if (origin && !originList(env).includes(origin)) {
      return json({ error: 'origin not allowed' }, 403, origin, env);
    }
 
    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: 'Ключ не задан в настройках Worker. Выполните: npx wrangler secret put DEEPSEEK_API_KEY' }, 500, origin, env);
    }
 
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!ratePerMinOk(ip, numCfg(env, 'RATE_PER_MIN'))) {
      return json({ error: 'Слишком много запросов подряд. Подождите минуту.' }, 429, origin, env);
    }
 
    /* Для /check-photo интервал НЕ проверяем здесь. Раньше он стоял в
       этом месте и бил по адресу, а не по человеку: в школе за одним
       NAT-адресом сидит весь класс, и один ученик блокировал бы
       остальных, включая оплативших. Теперь решение принимается одним
       местом внутри handlePhoto — по пользователю, если он вошёл, и по
       адресу, если это аноним. Снять ограничение подделкой заголовка
       нельзя: непроверенный токен даёт null, то есть путь анонима. */
    if (url.pathname === '/chess-explain') {
      const wait = intervalWait(ip + ':chess', numCfg(env, 'RATE_CHESS_SECONDS'));
      if (wait) return json({ error: `Подождите ${wait} сек.` }, 429, origin, env);
    }
 
    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: 'bad json' }, 400, origin, env); }
 
    try {
      return await handler(body, env, origin, request, ip);
    } catch (e) {
      return json({ error: 'Не удалось связаться с моделью: ' + e.message }, 502, origin, env);
    }
  }
};
 
