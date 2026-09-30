/* ============================================================
   SkyySchool — Worker news92-orders
   https://news92-orders.almazpro0927.workers.dev

   Это НЕ worker.js из этой же папки: тот — прежний прокси
   (skyschool-ai), а этот файл — то, что развёрнуто под именем
   news92-orders и на что смотрит assets/config.js → AI_BASE.
   Разворачивается вставкой в Cloudflare → Workers → news92-orders
   → Edit code, или через wrangler.

   Эндпоинты:
     GET  / , /health                — жив ли Worker и список эндпоинтов
     POST /explain, /check-photo, /check-homework, /chess-explain,
          /grade-essay               — прежние, код worker/worker.js как
                                       есть (он вставлен в конец файла)
     GET|POST /api/check-text        — сочинение, Groq llama-3.1-8b-instant.
                                       Длинный текст — только POST (JSON):
                                       в адресе Cloudflare держит до 16 КБ.
     GET  /api/check-photo?img=      — проверка фото (Z.AI). Без новых
                                       параметров — прежнее поведение.
     GET  /api/limits                — тариф и остаток запросов
     POST /api/check-test            — тест: эталон + работы учеников
     POST /fast-check                — быстрая проверка теста: то же +
                                       оценка по проценту (90/75/60), CSV
                                       «ФИО, класс, верно, всего, %, оценка»
     POST /api/check-teacher-report  — класс: по фото на ученика, CSV
     POST /api/submit-homework       — ученик отправляет работу по ссылке
     GET  /api/homework/:id          — работа по ссылке
     POST /api/payments              — заявка на оплату (заглушка); админу
                                       уходит сообщение в Telegram
     POST /api/notify-payment        — только админ: оплата подтверждена →
                                       сообщение ученику в Telegram
     POST /notify                    — сообщение в Telegram {user_id, type,
                                       message}: себе, админом — кому угодно,
                                       или сервером с заголовком X-Notify-Key
     POST /api/notify-submission     — ученик сдал подборку: учителю одно
                                       сообщение в Telegram (только свежие)
     POST /telegram/webhook          — бот: /start <код> привязывает чат,
                                       /stop отвязывает
     GET  /api/telegram/bot          — имя бота для ссылки t.me/<бот>?start=
     POST /api/telegram/setup        — только админ: подключить вебхук бота

   Секреты (Cloudflare → Worker → Settings → Variables and Secrets):
     ZAI_API_KEY           — Z.AI, фото. Если не задан — берётся GLM_API_KEY
                             прежнего Worker: та же площадка api.z.ai и
                             та же модель glm-4.6v-flash
     GROQ_API_KEY          — Groq, проверка текста (уже задан)
     SUPABASE_URL          — https://gtznaybjvqwhbybhxwjq.supabase.co
     SUPABASE_ANON_KEY     — publishable/anon: проверка входа ученика
                             (не задан — вход проверяется сервисным ключом)
     SUPABASE_SERVICE_KEY  — secret/service_role: лимиты, история,
                             хранилище. Только здесь, никогда во фронте.
     TELEGRAM_BOT_TOKEN    — бот для уведомлений (@BotFather). Без него
                             уведомлений просто нет, всё остальное работает
     ADMIN_CHAT_ID         — куда слать «новая заявка на оплату» (ваш chat_id)
     TELEGRAM_WEBHOOK_SECRET — любая длинная строка (A-Z, a-z, 0-9, _ и -):
                             Telegram присылает её в каждом запросе на
                             /telegram/webhook, чужие запросы отбрасываются.
                             Без неё вебхук не принимает ничего
     NOTIFY_KEY            — необязательно: ключ для /notify с сервера
                             (заголовок X-Notify-Key)
   Необязательные переменные:
     ZAI_MODEL             — по умолчанию glm-4.6v-flash
     SITE_URL              — по умолчанию https://news92-tg.github.io/skyschool/
     TELEGRAM_BOT_USERNAME — имя бота без @; не задано — спросим у Telegram (getMe)

   Без SUPABASE_* Worker тоже работает: все считаются бесплатными,
   лимиты — в памяти по IP, история не пишется.

   Нужны миграции sql/schema-tariffs.sql и sql/schema-text-check.sql
   (функции sky_*).

   Прежним эндпоинтам нужны свои секреты, как в worker/wrangler.toml:
   GROQ_API_KEY (уже есть), GLM_API_KEY или GEMINI_API_KEY — фото.
   ============================================================ */

const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const DEFAULT_MODEL = "glm-4.6v-flash";

/* Ключ и адрес Z.AI. ZAI_API_KEY — ключ этого Worker; если его нет —
   GLM_API_KEY прежнего (worker/worker.js): площадка та же, и тогда
   уважаем и его GLM_API_URL / GLM_MODEL. Так новый код встаёт на место
   прежнего без новых секретов. */
function zaiCfg(env) {
  if (env.ZAI_API_KEY) return { key: env.ZAI_API_KEY, url: ZAI_URL, model: env.ZAI_MODEL || DEFAULT_MODEL };
  return { key: env.GLM_API_KEY || "", url: env.GLM_API_URL || ZAI_URL, model: env.ZAI_MODEL || env.GLM_MODEL || DEFAULT_MODEL };
}
const DEFAULT_SITE = "https://news92-tg.github.io/skyschool/";
const BUCKET = "homework";
const ZAI_TIMEOUT_MS = 120000;
const SIGNED_TTL = 3600;               // подписанная ссылка на фото — час
const TEACHER_MAX_PHOTOS = 30;         // класс и тест: до 30 учеников
const TEST_BATCH = 5;                  // работ теста в одном запросе к модели
const MAX_UPLOAD_BYTES = 1572864;      // как file_size_limit бакета homework
const SUBMIT_LIMIT = { window: 600, max: 10 };   // отправок работ за 10 минут
const PAY_LIMIT = { window: 600, max: 5 };

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";   // не 70B: у 8B 14 400 запросов в день, у 70B — 1 000
const GROQ_TIMEOUT_MS = 30000;
const GROQ_PAUSE_MS = 2000;            // пауза, когда упёрлись в лимит Groq (30 запросов/мин)
const GROQ_TOKENS_RESERVE = 3000;      // столько токенов минуты нужно на одну подробную проверку
const TEXT_MAX_CHARS = 15000;          // длиннее — 400, пусть разобьют на части
const TEXT_CHECK_CHARS = 8000;         // длиннее — проверяем первые 8000
const TEXT_MAX_TOKENS = { short: 800, long: 1800 };
const TEXT_CACHE_DAYS = 7;
/* Лимиты текста, если sky_plan их не отдал (миграция schema-text-check.sql
   не выполнена): [запросов, за секунд]. */
const TEXT_LIMITS = { free: [1, 300], paid: [2, 60], premium: [5, 60] };

/* Флаг списывания ставит модель по признакам списывания (см. промт).
   В задании было «совпадение с решением ИИ < 80% → подозрение», но так
   под подозрение попадает каждый, кто просто ошибся. Если всё же нужно
   именно правило порога — впишите сюда 80. */
const PLAGIARISM_BY_MATCH_BELOW = null;

/* На случай, когда Supabase не настроен или миграция ещё не выполнена. */
const FALLBACK_PLAN = {
  plan: "free", title: "Бесплатный", price_rub: 0,
  requests_per_window: 1, window_seconds: 600, photos_per_request: 5,
  compare: false, teacher: false, plagiarism: false, expires_at: null,
  text_requests_per_window: 1, text_window_seconds: 300
};

const SUBJECTS = {
  physics:   { name: "физика",          focus: "формулы, единицы СИ, вычисления, ответ",          ru: ["физика"] },
  algebra:   { name: "алгебра",         focus: "преобразования, знаки, ОДЗ, проверка корней",    ru: ["алгебра"] },
  russian:   { name: "русский язык",    focus: "орфография, пунктуация, грамматика",             ru: ["русский", "русский язык"] },
  chemistry: { name: "химия",           focus: "уравнения реакций, баланс, стехиометрия",        ru: ["химия"] },
  geometry:  { name: "геометрия",       focus: "чертёж, теоремы, доказательства, вычисления",    ru: ["геометрия"] },
  biology:   { name: "биология",        focus: "термины, определения, схемы",                    ru: ["биология"] },
  history:   { name: "история",         focus: "даты, события, причинно-следственные связи",     ru: ["история"] },
  english:   { name: "английский язык", focus: "grammar, tenses, vocabulary, word order",        ru: ["английский", "английский язык"] },
  other:     { name: "",                focus: "",                                               ru: ["другое"] }
};
const SUBJECT_KEYS = Object.keys(SUBJECTS);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

/* Эти адреса целиком обслуживает прежний код (worker/worker.js),
   включая свой CORS и OPTIONS: сайт ими пользуется (объяснения
   заданий, шахматы, essay.html), и после замены Worker они должны
   работать ровно как раньше. */
const LEGACY_PATHS = ["/explain", "/check-photo", "/check-homework", "/chess-explain", "/grade-essay"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (LEGACY_PATHS.includes(url.pathname)) return LEGACY.fetch(request, env, ctx);

    // CORS
    const corsHeaders = CORS;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "skyschool-ai",
        endpoints: ["/api/check-text", "/api/check-photo", "/fast-check", "/notify", "/api/telegram/bot", ...LEGACY_PATHS]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // --- Проверка ФОТО через Z.AI ---
    if (url.pathname === "/api/check-photo") {
      // С новыми параметрами (или несколькими img) — тарифы, лимиты, JSON.
      if (!isLegacyPhotoRequest(url)) {
        return handleCheckPhoto(request, env, ctx, url);
      }

      // Без них — ровно как раньше: этим пользуются старые версии страницы.
      const img = url.searchParams.get("img");
      if (!img) {
        return new Response(JSON.stringify({ error: "img param required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      try {
        const zc = zaiCfg(env);
        const response = await fetch(zc.url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${zc.key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: zc.model,
            messages: [
              {
                role: "system",
                content: "Ты учитель. Посмотри на фото домашней работы. Распознай текст, реши задачу сам, сравни с ответом ученика, укажи ошибки и поставь оценку."
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Проверь это ДЗ." },
                  { type: "image_url", image_url: { url: img } }
                ]
              }
            ]
          })
        });

        const data = await response.text();
        return new Response(data, {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    try {
      if (url.pathname === "/api/check-text") return await handleCheckText(request, env, ctx, url);
      if (url.pathname === "/api/limits" && request.method === "GET") return await handleLimits(request, env);
      if (url.pathname === "/api/check-test") return await handleCheckTest(request, env, ctx);
      if (url.pathname === "/fast-check" || url.pathname === "/api/fast-check") return await handleCheckTest(request, env, ctx, true);
      if (url.pathname === "/api/check-teacher-report") return await handleTeacherReport(request, env, ctx);
      if (url.pathname === "/api/submit-homework") return await handleSubmit(request, env, url);
      if (url.pathname === "/api/payments") return await handlePayment(request, env, ctx);
      if (url.pathname === "/api/notify-payment") return await handleNotifyPayment(request, env);
      if (url.pathname === "/notify" || url.pathname === "/api/notify") return await handleNotify(request, env);
      if (url.pathname === "/api/notify-submission") return await handleNotifySubmission(request, env);
      if (url.pathname === "/telegram/webhook") return await handleTelegramWebhook(request, env);
      if (url.pathname === "/api/telegram/bot" && request.method === "GET") return await handleTelegramBot(env);
      if (url.pathname === "/api/telegram/setup") return await handleTelegramSetup(request, env, url);
      const hw = url.pathname.match(/^\/api\/homework\/([^/]+)$/);
      if (hw && request.method === "GET") return await handleHomeworkGet(env, decodeURIComponent(hw[1]));
    } catch (e) {
      console.error("[worker]", url.pathname, e && e.stack || e);
      return json({ error: "Внутренняя ошибка сервиса", code: "internal" }, 500);
    }

    // 404
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};


/* ============================================================
   Общее
   ============================================================ */

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra }
  });
}

const PHOTO_PARAMS = ["mode", "subject", "grade", "grade_text", "length", "accuracy", "total", "task", "criteria"];
function isLegacyPhotoRequest(url) {
  return url.searchParams.getAll("img").length <= 1 && !PHOTO_PARAMS.some(p => url.searchParams.has(p));
}

const isHttpUrl = s => typeof s === "string" && /^https?:\/\/[^\s]+$/i.test(s.trim());
const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ""));

function parseBool(v, name) {
  if (v == null || v === "") return false;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes"].includes(s)) return true;
  if (["false", "0", "no"].includes(s)) return false;
  throw new BadRequest(`${name} must be true or false`);
}

/* subject: ключ (physics), русское название (физика) или пусто. */
function parseSubject(v) {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return "";
  if (SUBJECTS[s]) return s;
  const key = SUBJECT_KEYS.find(k => SUBJECTS[k].ru.includes(s));
  if (!key) throw new BadRequest("subject must be one of: физика, алгебра, русский, химия, геометрия, биология, история, английский");
  return key;
}

class BadRequest extends Error {}

const str = v => v == null ? "" : Array.isArray(v) ? v.map(str).join("\n")
  : typeof v === "object" ? JSON.stringify(v) : String(v);
const clampInt = (v, lo, hi) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
};
const gradeOf = v => {
  const g = parseInt(v, 10);
  return g >= 1 && g <= 5 ? g : "N/A";
};
const GRADE_WORDS = { 5: "5 (отлично)", 4: "4 (хорошо)", 3: "3 (удовлетворительно)", 2: "2 (неудовлетворительно)", 1: "1 (плохо)" };

function normErrors(list) {
  return (Array.isArray(list) ? list : [])
    .filter(e => e && typeof e === "object")
    .map(e => ({ type: str(e.type), fragment: str(e.fragment), correction: str(e.correction) }));
}

/* ---------- Критерии оценивания от учителя ----------
   Учитель задаёт [{name, weight}], модель ставит балл 1–5 по каждому.
   Итог считаем здесь, а не просим у модели: арифметика модели ненадёжна.
     score = Σ(вес × балл) / Σ(веса), до десятых   — 4.2
     assessment = округление score                 — 4.2 → 4, 4.5 → 5
   Критерий без балла (модель не смогла оценить) в итог не входит. */
const CRITERIA_MAX = 10;

function parseCriteria(v) {
  if (v == null || v === "") return null;
  let list = v;
  if (typeof v === "string") {
    try { list = JSON.parse(v); }
    catch (e) { throw new BadRequest("criteria must be a JSON array: [{\"name\":\"...\",\"weight\":1}]"); }
  }
  if (!Array.isArray(list)) throw new BadRequest("criteria must be an array of {name, weight}");
  const out = [], seen = new Set();
  for (const c of list) {
    const name = str(c && typeof c === "object" ? c.name : c).replace(/\s+/g, " ").trim().slice(0, 60);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    let weight = Number(c && typeof c === "object" ? c.weight : 1);
    if (!(weight > 0)) weight = 1;
    weight = Math.min(10, Math.round(weight * 100) / 100);
    seen.add(key);
    out.push({ name, weight });
    if (out.length >= CRITERIA_MAX) break;
  }
  if (!out.length) throw new BadRequest("criteria: at least one {name} is required");
  return out;
}

function critKey(s) { return str(s).toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/g, ""); }

/* Ответ модели → ровно те критерии, что задал учитель, в его порядке. */
function normCriteriaScores(got, want) {
  const list = (Array.isArray(got) ? got : []).filter(x => x && typeof x === "object");
  return want.map((c, i) => {
    const hit = list.find(g => critKey(g.name) === critKey(c.name)) || (list[i] && !want.some(w => critKey(w.name) === critKey(list[i].name)) ? list[i] : null);
    return {
      name: c.name,
      weight: c.weight,
      score: hit ? clampInt(hit.score, 1, 5) : null,
      comment: hit ? str(hit.comment).slice(0, 400) : ""
    };
  });
}

function weightedScore(items) {
  let sum = 0, weights = 0;
  for (const c of items) {
    if (typeof c.score !== "number") continue;
    sum += c.weight * c.score;
    weights += c.weight;
  }
  return weights ? Math.round(sum / weights * 10) / 10 : null;
}

const gradeFromScore = s => s == null ? "N/A" : Math.min(5, Math.max(1, Math.floor(s + 0.5)));

/* Ответ модели → объект. glm-4.6v оборачивает ответ в
   <|begin_of_box|>…<|end_of_box|>, иногда в ```json. */
function parseModelJson(content) {
  const raw = String(content || "").replace(/<\|(?:begin|end)_of_box\|>/g, "").trim();
  let parsed = null;
  try { parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch (e) {}
  return { raw, parsed: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null };
}

async function readJsonBody(request) {
  try { return await request.json(); } catch (e) { throw new BadRequest("body must be JSON"); }
}

function csvCell(v) {
  let s = str(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                 // Excel не должен принять ячейку за формулу
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvDataUrl(header, rows) {
  const text = [header, ...rows].map(r => r.map(csvCell).join(",")).join("\r\n");
  return "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + text);   // BOM — чтобы Excel прочёл кириллицу
}

const sumUsage = (a, b) => ({
  prompt: a.prompt + b.prompt, completion: a.completion + b.completion, total: a.total + b.total
});
const ZERO_USAGE = { prompt: 0, completion: 0, total: 0 };


/* ============================================================
   Supabase
   ============================================================ */

const sbBase = env => String(env.SUPABASE_URL || "").replace(/\/+$/, "");
const sbReady = env => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);

/* Ключи нового образца (sb_secret_…) — не JWT: их кладут только в
   apikey. Старый service_role — JWT (eyJ…): его ещё и в Authorization. */
function sbHeaders(key, extra) {
  const h = { apikey: key, ...(extra || {}) };
  if (/^eyJ/.test(key)) h.Authorization = `Bearer ${key}`;
  return h;
}

async function sbFetch(env, path, init) {
  const r = await fetch(sbBase(env) + path, {
    ...init,
    headers: sbHeaders(env.SUPABASE_SERVICE_KEY, init && init.headers)
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    const err = new Error(`supabase ${path.split("?")[0]}: ${r.status} ${body.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return r;
}

async function sbRpc(env, fn, args) {
  const r = await sbFetch(env, `/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  return r.json();
}

/* Кто спрашивает. JWT проверяем у Supabase Auth, а не разбираем сами:
   подпись проверит тот, у кого секрет. Неверный JWT — 401, а не
   молчаливый «аноним»: иначе платный ученик тихо упал бы в бесплатный. */
async function identify(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "";
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(\S+)$/i);
  const apikey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY;
  if (!m || !env.SUPABASE_URL || !apikey) return { userId: null, ip };
  const r = await fetch(sbBase(env) + "/auth/v1/user", {
    headers: { apikey, Authorization: `Bearer ${m[1]}` }
  });
  if (r.status === 401 || r.status === 403) return { denied: true, ip };
  if (!r.ok) throw new Error("auth check failed: " + r.status);
  const u = await r.json();
  return { userId: u && u.id || null, ip };
}

const sessionExpired = () => json({ error: "Сессия истекла. Войдите заново.", code: "session" }, 401);

async function getPlan(env, userId) {
  if (!sbReady(env)) return FALLBACK_PLAN;
  try {
    const rows = await sbRpc(env, "sky_plan", { p_user: userId });
    return (Array.isArray(rows) ? rows[0] : rows) || FALLBACK_PLAN;
  } catch (e) {
    console.error("[plan]", e.message);
    return FALLBACK_PLAN;
  }
}

/* Лимит в памяти — запасной путь, когда нет Supabase. Живёт, пока жив
   экземпляр Worker: защищает от случайного цикла, не от злого умысла. */
const memWindows = new Map();
function memRate(key, windowSec, max, delta) {
  const now = Date.now();
  let w = memWindows.get(key);
  if (!w || now - w.start >= windowSec * 1000) w = { start: now, count: 0 };
  const resetIn = () => Math.max(1, Math.ceil((w.start + windowSec * 1000 - now) / 1000));
  if (delta > 0 && w.count + delta > max) {
    return { allowed: false, remaining: Math.max(max - w.count, 0), retry_after: resetIn(), reset_in: resetIn() };
  }
  if (delta !== 0) {
    if (w.count === 0 && delta > 0) w.start = now;
    w.count = Math.max(w.count + delta, 0);
    memWindows.set(key, w);
  }
  const reset = w.count ? resetIn() : 0;
  return { allowed: delta > 0 || w.count < max, remaining: Math.max(max - w.count, 0),
           retry_after: w.count >= max ? reset : 0, reset_in: reset };
}

async function rateHit(env, who, scope, windowSec, max, delta) {
  if (sbReady(env)) {
    try {
      const rows = await sbRpc(env, "sky_rate", {
        p_user: who.userId, p_ip: who.ip || null, p_scope: scope,
        p_window: windowSec, p_max: max, p_delta: delta
      });
      const r = Array.isArray(rows) ? rows[0] : rows;
      if (r) return r;
    } catch (e) {
      console.error("[rate]", e.message);
    }
  }
  return memRate(`${who.userId || "ip:" + who.ip}|${scope}`, windowSec, max, delta);
}

function planPublic(plan) {
  return {
    plan: plan.plan,
    title: planTitle(plan),
    price_rub: plan.price_rub,
    expires_at: plan.expires_at || null,
    limits: {
      requests: plan.requests_per_window,
      window_seconds: plan.window_seconds,
      photos: plan.photos_per_request
    },
    features: { compare: !!plan.compare, teacher: !!plan.teacher, plagiarism: !!plan.plagiarism }
  };
}

const tooMany = (rate, plan) => json({
  error: `Лимит тарифа: следующая проверка через ${rate.retry_after} с`,
  code: "rate_limit",
  retry_after: rate.retry_after,
  plan: plan.plan
}, 429, { "Retry-After": String(rate.retry_after) });

const needPlan = (need, error) => json({ error, code: "tariff", need }, 402);

const PLAN_TITLES = { free: "Бесплатный", paid: "Платный", premium: "Премиум" };
const planTitle = plan => PLAN_TITLES[plan.plan] || plan.title || plan.plan;

async function logCheck(env, who, img, meta, result, tokens) {
  if (!sbReady(env)) return;
  try {
    await sbRpc(env, "sky_log_check", {
      p_user: who.userId, p_ip: who.ip || null,
      p_img_url: img ? String(img).split("?")[0] : null,   // без подписи: токен в истории ни к чему
      p_subject: meta.subject || null, p_mode: meta.mode || null, p_length: meta.length || null,
      p_result: result, p_tokens: tokens || 0
    });
  } catch (e) {
    console.error("[log]", e.message);
  }
}

async function signPath(env, path, ttl) {
  const r = await sbFetch(env, `/storage/v1/object/sign/${BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: ttl || SIGNED_TTL })
  });
  const data = await r.json();
  const signed = data.signedURL || data.signedUrl;
  if (!signed) throw new Error("storage sign: no URL");
  return /^https?:/i.test(signed) ? signed : sbBase(env) + "/storage/v1" + (signed.startsWith("/") ? "" : "/") + signed;
}


/* ============================================================
   Z.AI
   ============================================================ */

/* state — общий на весь запрос: если модель однажды отказалась от
   response_format, в следующих вызовах его уже не шлём. */
async function zai(env, state, system, userText, images) {
  const content = [{ type: "text", text: userText }]
    .concat(images.map(u => ({ type: "image_url", image_url: { url: u } })));
  const zc = zaiCfg(env);
  if (!zc.key) return { ok: false, status: 401, body: "ZAI_API_KEY / GLM_API_KEY не заданы" };
  const send = withFormat => fetch(zc.url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${zc.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: zc.model,
      temperature: 0.2,
      ...(withFormat ? { response_format: { type: "json_object" } } : {}),
      messages: [{ role: "system", content: system }, { role: "user", content }]
    }),
    signal: AbortSignal.timeout(ZAI_TIMEOUT_MS)
  });

  let r;
  try {
    r = await send(!state.noFormat);
    // 400 на response_format — повторяем без него.
    if (r.status === 400 && !state.noFormat) {
      state.noFormat = true;
      r = await send(false);
    }
  } catch (e) {
    const timeout = e && (e.name === "TimeoutError" || e.name === "AbortError");
    return { ok: false, status: timeout ? 504 : 502, body: String(e && e.message || e) };
  }

  const text = await r.text();
  if (!r.ok) return { ok: false, status: r.status, body: text };
  let data = null;
  try { data = JSON.parse(text); } catch (e) {}
  const choice = data && data.choices && data.choices[0];
  const u = (data && data.usage) || {};
  return {
    ok: true,
    content: (choice && choice.message && choice.message.content) || "",
    truncated: !!(choice && choice.finish_reason === "length"),
    usage: { prompt: u.prompt_tokens | 0, completion: u.completion_tokens | 0, total: u.total_tokens | 0 }
  };
}

/* Ошибка Z.AI → ответ клиенту. */
function zaiFailure(z) {
  console.warn("[zai]", z.status, String(z.body).slice(0, 300));
  if (z.status === 429) return { status: 429, body: { error: "лимит Z.AI", code: "zai_limit", retry_after: 60 } };
  if (z.status === 401 || z.status === 403) return { status: 401, body: { error: "Ошибка ключа API Z.AI", code: "zai_key" } };
  if (z.status === 504) return { status: 504, body: { error: "Модель не ответила вовремя", code: "zai_timeout" } };
  if (z.status === 400) return { status: 400, body: { error: "Модель не приняла запрос (часто — фото недоступно по ссылке)", code: "zai_bad_request" } };
  return { status: 502, body: { error: "Сервис проверки временно недоступен", code: "zai_down" } };
}


/* ============================================================
   Промт проверки одной работы
   ============================================================ */

function checkPrompt(o) {
  const subj = SUBJECTS[o.subject] || SUBJECTS.other;
  const wantGrade = o.grade || o.gradeText;
  const compare = o.mode === "compare";
  const test = o.mode === "test";

  const shape = { recognized_text: "...", errors: [{ type: "...", fragment: "...", correction: "..." }] };
  if (o.label) { shape.student_name = "..."; shape.student_class = "..."; }
  if (compare) { shape.ai_solution = "..."; shape.discrepancies = "..."; }
  if (test) shape.test = { total: o.total || 10, answers: [{ n: 1, student: "...", correct: "...", ok: true }] };
  if (wantGrade) { shape.assessment = 4; shape.assessment_text = "4 (хорошо)"; shape.assessment_reason = "..."; }
  if (o.accuracy) { shape.confidence = 90; shape.ai_match = 85; shape.plagiarism_flag = false; shape.plagiarism_reason = "..."; }
  if (o.criteria) shape.criteria = o.criteria.map(c => ({ name: c.name, score: 4, comment: "..." }));
  shape.comment = "...";

  const lines = [
    "Ты школьный учитель. Проверь работу ученика.",
    subj.name ? `Предмет: ${subj.name}. Особое внимание: ${subj.focus}.` : null,
    o.photos > 1 ? `Работа на ${o.photos} фото — это страницы одной работы по порядку.` : null,
    o.task ? `Что было задано: ${o.task}` : null,
    o.length === "short"
      ? "recognized_text — только ответы ученика, коротко."
      : "recognized_text — текст с фото дословно, с переносами строк.",
    "errors — ошибки ученика; если их нет — []. type — вид ошибки, fragment — место с ошибкой дословно, как написал ученик, correction — как правильно.",
    compare
      ? "Реши задания сам, затем сравни с решением ученика по шагам. ai_solution — твоё полное решение с ответом; discrepancies — где и чем решение ученика расходится с твоим."
      : null,
    test
      ? "На фото — тест. test.answers — по каждому вопросу: n — номер, student — ответ ученика, correct — правильный ответ (реши сам), ok — верно ли. " +
        (o.total ? `Всего вопросов: ${o.total}.` : "Вопросы посчитай сам, test.total — их число.")
      : null,
    wantGrade
      ? "Поставь оценку. Текстом, как в тетради. assessment — целое число от 1 до 5; assessment_text — оценка словами, как пишет учитель в тетради, например «4 (хорошо)»; assessment_reason — обоснование в 1–2 предложениях. Если работу нельзя прочитать — assessment: \"N/A\"."
      : null,
    o.accuracy
      ? "Оцени уверенность распознавания текста (confidence, 0–100) и совпадение решения ученика с твоим решением (ai_match, 0–100). " +
        "plagiarism_flag — подозрение на списывание: true, только если есть признаки — решение слово в слово как в решебнике, ответ без хода решения, резкая смена почерка или стиля, чужие исправления. Ошибки сами по себе не признак списывания. plagiarism_reason — какие признаки увидел; если флага нет — пустая строка."
      : null,
    o.label ? "student_name, student_class — ФИО и класс, если они подписаны на фото; иначе пустые строки." : null,
    o.criteria
      ? "Оцени работу по критериям учителя: " + o.criteria.map((c, i) => `${i + 1}) «${c.name}»`).join("; ") + ". " +
        "criteria — массив в том же порядке и с теми же названиями: score — целое число от 1 до 5 (5 — критерий выполнен полностью), " +
        "comment — одно предложение, за что снижен балл или что сделано хорошо. Если по фото критерий оценить нельзя — score: null."
      : null,
    o.length === "short"
      ? "Ответь кратко: только список ошибок" + (wantGrade ? " и оценка" : "") + ". Без подробного разбора. comment — одно предложение."
      : "comment — общий комментарий учителя ученику, 2–4 предложения, по-русски.",
    "",
    "Ответь ТОЛЬКО одним JSON-объектом, без markdown и без текста до или после него, ровно с такими полями:",
    JSON.stringify(shape)
  ];
  return lines.filter(l => l !== null).join("\n");
}

function normTest(t, total) {
  const answers = (t && Array.isArray(t.answers) ? t.answers : [])
    .filter(a => a && typeof a === "object")
    .map((a, i) => ({ n: clampInt(a.n, 1, 1000) || i + 1, student: str(a.student), correct: str(a.correct), ok: a.ok === true || a.ok === "true" }));
  const all = total || clampInt(t && t.total, 1, 1000) || answers.length;
  const right = answers.filter(a => a.ok).length;
  return { total: all, correct: Math.min(right, all), percent: all ? Math.round(Math.min(right, all) / all * 100) : 0, answers };
}

/* Разбор модели → ответ API. Поля — только те, что просили. */
function normCheck(parsed, raw, o) {
  const p = parsed || { comment: raw };      // не JSON — весь текст в comment
  const r = { recognized_text: str(p.recognized_text), errors: normErrors(p.errors) };
  if (o.label) {
    r.student_name = str(p.student_name).slice(0, 100);
    r.student_class = str(p.student_class).slice(0, 20);
  }
  if (o.mode === "compare") {
    r.ai_solution = str(p.ai_solution);
    r.discrepancies = str(p.discrepancies);
  }
  if (o.mode === "test") r.test = normTest(p.test, o.total);
  if (o.grade) r.assessment = gradeOf(p.assessment);
  if (o.gradeText) r.assessment_text = str(p.assessment_text) || GRADE_WORDS[gradeOf(p.assessment)] || "N/A";
  if (o.grade || o.gradeText) r.assessment_reason = str(p.assessment_reason);
  if (o.criteria) {
    /* с критериями оценка — из них, а не «на глаз» модели */
    r.criteria = normCriteriaScores(p.criteria, o.criteria);
    r.score = weightedScore(r.criteria);
    r.assessment = gradeFromScore(r.score);
    if (o.gradeText) r.assessment_text = GRADE_WORDS[r.assessment] || "N/A";
  }
  if (o.accuracy) {
    r.confidence = clampInt(p.confidence, 0, 100);
    r.ai_match = clampInt(p.ai_match, 0, 100);
    r.plagiarism_flag = p.plagiarism_flag === true || p.plagiarism_flag === "true";
    if (PLAGIARISM_BY_MATCH_BELOW != null && r.ai_match != null) r.plagiarism_flag = r.ai_match < PLAGIARISM_BY_MATCH_BELOW;
    r.plagiarism_reason = str(p.plagiarism_reason);
  }
  r.comment = str(p.comment);
  return r;
}

function photoOptions(get) {
  const mode = String(get("mode") || "check").trim().toLowerCase();
  if (!["check", "compare", "grade", "test"].includes(mode)) throw new BadRequest("mode must be check, compare, grade or test");
  const length = String(get("length") || "long").trim().toLowerCase();
  if (!["short", "long"].includes(length)) throw new BadRequest("length must be short or long");
  const totalRaw = get("total");
  let total = null;
  if (totalRaw != null && totalRaw !== "") {
    total = parseInt(totalRaw, 10);
    if (!(total >= 1 && total <= 200)) throw new BadRequest("total must be a number from 1 to 200");
  }
  return {
    mode,
    length,
    subject: parseSubject(get("subject")),
    grade: mode === "grade" || parseBool(get("grade"), "grade"),
    gradeText: parseBool(get("grade_text"), "grade_text"),
    accuracy: parseBool(get("accuracy"), "accuracy"),
    total,
    task: String(get("task") || "").trim().slice(0, 800),
    criteria: parseCriteria(get("criteria"))
  };
}


/* ============================================================
   /api/check-photo — с тарифами и лимитами
   ============================================================ */

async function handleCheckPhoto(request, env, ctx, url) {
  const imgs = url.searchParams.getAll("img").map(s => s.trim()).filter(Boolean);
  if (!imgs.length) return json({ error: "img param required", code: "no_photo" }, 400);
  if (!imgs.every(isHttpUrl)) return json({ error: "img must be a public http(s) URL", code: "bad_img" }, 400);

  let o;
  try { o = photoOptions(k => url.searchParams.get(k)); }
  catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message, code: "bad_param" }, 400);
    throw e;
  }
  o.photos = imgs.length;

  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  const plan = await getPlan(env, who.userId);

  if (imgs.length > plan.photos_per_request) {
    return needPlan(plan.plan === "free" ? "paid" : "premium",
      `Тариф «${planTitle(plan)}»: не больше ${plan.photos_per_request} фото за раз`);
  }
  if (o.mode === "compare" && !plan.compare) return needPlan("paid", "Сверка с решением ИИ — в тарифе Платный и выше");
  if (o.accuracy && !plan.plagiarism) return needPlan("plagiarism", "Проверка на списывание — в тарифе Премиум или отдельной покупкой");

  const rate = await rateHit(env, who, "check", plan.window_seconds, plan.requests_per_window, 1);
  if (!rate.allowed) {
    /* Вошёл и привязал Telegram — раз в сутки напомним там, что лимит
       кончился и когда будет следующая проверка. */
    const warn = warnLimit(env, who, rate, plan).catch(e => console.warn("[limit warn]", e && e.message));
    if (ctx && ctx.waitUntil) ctx.waitUntil(warn);
    return tooMany(rate, plan);
  }

  const z = await zai(env, {}, checkPrompt(o), "Проверь эту работу. Ответ — только JSON.", imgs);
  const { raw, parsed } = z.ok ? parseModelJson(z.content) : { raw: "" };
  if (!z.ok || !raw) {
    // Разбора нет — запрос не в счёт.
    ctx.waitUntil(rateHit(env, who, "check", plan.window_seconds, plan.requests_per_window, -1));
    if (!z.ok) {
      const f = zaiFailure(z);
      return json(f.body, f.status);
    }
    return json({ error: "Модель вернула пустой ответ", code: "empty" }, 502);
  }

  const result = normCheck(parsed, raw, o);
  if (z.truncated) result.truncated = true;
  result.tokens_used = z.usage;
  ctx.waitUntil(logCheck(env, who, imgs[0], o, { ...result }, z.usage.total));

  result.plan = plan.plan;
  result.rate = { remaining: rate.remaining, retry_after: rate.retry_after, reset_in: rate.reset_in };
  return json(result);
}


/* ============================================================
   Groq — проверка текста (llama-3.1-8b-instant)
   ------------------------------------------------------------
   Лимиты модели: 30 запросов/мин, 14 400/день, 6 000 токенов/мин,
   500 000/день. Заголовки ответа Groq:
     x-ratelimit-remaining-requests — запросов осталось на сегодня
     x-ratelimit-remaining-tokens   — токенов осталось на эту минуту
     x-ratelimit-reset-tokens       — через сколько минута обнулится
   Упёрлись (429 или токенов минуты меньше, чем на одну проверку) —
   следующий вызов ждёт 2 секунды; 429 после паузы — «Лимит Groq».
   ============================================================ */

const groqPace = { until: 0 };      // раньше этого момента Groq не зовём (на экземпляр Worker)
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* "2m59.56s", "7.66s", "480ms", "1h2m3s" → мс */
function groqDuration(v) {
  const m = String(v || "").trim().match(/^(?:([\d.]+)h)?(?:([\d.]+)m(?!s))?(?:([\d.]+)s)?(?:([\d.]+)ms)?$/);
  if (!m || !m[0]) return null;
  return Math.round(((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0)) * 1000 + (+m[4] || 0));
}

function groqLimits(h) {
  const num = k => { const v = h.get(k); return v == null || v === "" || isNaN(v) ? null : Number(v); };
  return {
    remaining_requests: num("x-ratelimit-remaining-requests"),
    remaining_tokens: num("x-ratelimit-remaining-tokens"),
    reset_requests_ms: groqDuration(h.get("x-ratelimit-reset-requests")),
    reset_tokens_ms: groqDuration(h.get("x-ratelimit-reset-tokens"))
  };
}

function groqPaceFrom(l) {
  const now = Date.now();
  if (l.remaining_tokens != null && l.remaining_tokens < GROQ_TOKENS_RESERVE) {
    groqPace.until = Math.max(groqPace.until, now + (l.reset_tokens_ms || GROQ_PAUSE_MS));
  }
  if (l.remaining_requests === 0) {
    groqPace.until = Math.max(groqPace.until, now + (l.reset_requests_ms || GROQ_PAUSE_MS));
  }
}

async function groq(env, system, user, maxTokens) {
  const wait = groqPace.until - Date.now();
  if (wait > 0) await sleep(Math.min(wait, GROQ_PAUSE_MS));

  const send = () => fetch(GROQ_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    }),
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS)
  });

  let r, text, limits, retryAfter = null;
  for (let attempt = 0; ; attempt++) {
    try {
      r = await send();
      text = await r.text();
    } catch (e) {
      const timeout = e && (e.name === "TimeoutError" || e.name === "AbortError");
      return { ok: false, status: timeout ? 504 : 502, body: String(e && e.message || e) };
    }
    limits = groqLimits(r.headers);
    groqPaceFrom(limits);
    if (r.status !== 429) break;
    const ra = parseFloat(r.headers.get("retry-after"));
    retryAfter = Number.isFinite(ra) ? Math.max(1, Math.ceil(ra)) : null;
    groqPace.until = Math.max(groqPace.until, Date.now() + (retryAfter ? retryAfter * 1000 : GROQ_PAUSE_MS));
    // Лимит в минуту (30 запросов) — ждём 2 с и пробуем ещё раз. Дольше ждать не держим человека.
    if (attempt > 0 || (retryAfter && retryAfter * 1000 > GROQ_PAUSE_MS)) break;
    await sleep(GROQ_PAUSE_MS);
  }

  let data = null;
  try { data = JSON.parse(text); } catch (e) {}
  const err = data && data.error;
  // json_object: модель ответила не JSON — Groq отдаёт 400, а сам ответ кладёт в failed_generation.
  if (r.status === 400 && err && err.code === "json_validate_failed" && err.failed_generation) {
    return { ok: true, content: String(err.failed_generation), truncated: false, usage: ZERO_USAGE, limits };
  }
  if (!r.ok) return { ok: false, status: r.status, body: text, limits, retryAfter };
  const choice = data && data.choices && data.choices[0];
  const u = (data && data.usage) || {};
  return {
    ok: true,
    content: (choice && choice.message && choice.message.content) || "",
    truncated: !!(choice && choice.finish_reason === "length"),
    usage: { prompt: u.prompt_tokens | 0, completion: u.completion_tokens | 0, total: u.total_tokens | 0 },
    limits
  };
}

/* Ошибка Groq → ответ клиенту. */
function groqFailure(g) {
  console.warn("[groq]", g.status, String(g.body).slice(0, 300));
  if (g.status === 429) {
    const ra = g.retryAfter || 60;
    return { status: 429, body: { error: "Лимит Groq, подождите", code: "groq_limit", retry_after: ra }, headers: { "Retry-After": String(ra) } };
  }
  // 413 — запрос не влез в 6 000 токенов минуты
  if (g.status === 413) return { status: 400, body: { error: "Текст слишком длинный, разбейте на части", code: "too_long" } };
  if (g.status === 401 || g.status === 403) return { status: 401, body: { error: "Ошибка ключа API Groq", code: "groq_key" } };
  if (g.status === 504) return { status: 504, body: { error: "Модель не ответила вовремя", code: "groq_timeout" } };
  return { status: 502, body: { error: "Сервис проверки временно недоступен", code: "groq_down" } };
}


/* ============================================================
   /api/check-text — сочинение
   ------------------------------------------------------------
   Параметры (GET — в адресе, POST — JSON с теми же именами):
     text        — текст сочинения, обязательно
     subject     — русский | английский | литература (или russian,
                   english, literature), по умолчанию русский
     length      — short | long, по умолчанию long
     grade       — true: оценка числом (assessment)
     grade_text  — true: оценка словами (assessment_text)
     criteria    — false: без таблицы критериев (по умолчанию true;
                   критерии есть только в length=long)
     topic       — тема сочинения, необязательно: по ней считается
                   topic_match; без неё модель берёт тему из заголовка
   Модель всегда ставит оценку и критерии: так один разбор в кэше
   годится для любых флажков, а флажки лишь отбирают поля ответа.
   ============================================================ */

const TEXT_SUBJECTS = {
  russian:    { ru: ["русский", "русский язык"],
                who: "Ты учитель русского языка и литературы." },
  literature: { ru: ["литература"],
                who: "Ты учитель русского языка и литературы.",
                note: "Предмет — литература: главное — понимание произведения, аргументы и примеры из текста произведения; грамотность тоже учитывай." },
  english:    { ru: ["английский", "английский язык"],
                who: "Ты учитель английского языка.",
                note: "Сочинение написано по-английски: fragment и correction — по-английски, type и comment — по-русски." }
};
const CRITERIA = ["topic_match", "argumentation", "composition", "logic", "spelling", "grammar"];

function parseTextSubject(v) {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return "russian";
  if (TEXT_SUBJECTS[s]) return s;
  const key = Object.keys(TEXT_SUBJECTS).find(k => TEXT_SUBJECTS[k].ru.includes(s));
  if (!key) throw new BadRequest("subject must be one of: русский, английский, литература");
  return key;
}

function textOptions(get) {
  const length = String(get("length") || "long").trim().toLowerCase();
  if (!["short", "long"].includes(length)) throw new BadRequest("length must be short or long");
  const crit = get("criteria");
  return {
    subject: parseTextSubject(get("subject")),
    length,
    grade: parseBool(get("grade"), "grade"),
    gradeText: parseBool(get("grade_text"), "grade_text"),
    criteria: crit == null || crit === "" ? true : parseBool(crit, "criteria"),
    topic: length === "long" ? String(get("topic") || "").replace(/\s+/g, " ").trim().slice(0, 300) : ""
  };
}

/* Обрезка до max символов — по границе слова, если она недалеко. */
function cutText(t, max) {
  const cut = t.slice(0, max);
  const sp = cut.search(/\s\S*$/);
  return (sp > max - 200 ? cut.slice(0, sp) : cut).trim();
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function textLimit(plan) {
  const d = TEXT_LIMITS[plan.plan] || TEXT_LIMITS.free;
  return { max: plan.text_requests_per_window || d[0], window: plan.text_window_seconds || d[1] };
}

function textPrompt(o) {
  const s = TEXT_SUBJECTS[o.subject];
  const lines = [
    `${s.who} Проверяешь сочинение ученика 5-11 класса. Отвечай ТОЛЬКО валидным JSON, без markdown.`,
    s.note || null
  ];
  if (o.length === "short") {
    lines.push(
      "Найди ошибки: орфография, пунктуация, грамматика.",
      "Для каждой: type, fragment, correction.",
      "Поставь оценку 1-5.",
      'Верни JSON: {"errors":[{"type":"...","fragment":"...","correction":"..."}],"assessment":N,"comment":"1 предложение"}'
    );
  } else {
    lines.push(
      "Проверь по критериям:",
      "1. topic_match — соответствие теме (0-5)",
      "2. argumentation — аргументация с примерами (0-5)",
      "3. composition — композиция: вступление, основная часть, вывод (0-5)",
      "4. logic — логика и связность (0-5)",
      "5. spelling — орфография (0-5)",
      "6. grammar — грамматика и речь (0-5)",
      "Ошибки: type, fragment, correction.",
      "Поставь оценку 1-5.",
      "Верни JSON:",
      '{"criteria":{"topic_match":N,"argumentation":N,"composition":N,"logic":N,"spelling":N,"grammar":N},' +
        '"errors":[{"type":"...","fragment":"...","correction":"..."}],"assessment":N,"comment":"2-3 предложения"}',
      "Если ошибок нет — errors: [].",
      "Если ученик написал не по теме — topic_match: 0, остальные критерии не считай."
    );
  }
  lines.push("fragment — место с ошибкой дословно из текста, correction — как правильно. assessment — целое число от 1 до 5. comment — по-русски.");
  return lines.filter(l => l !== null).join("\n");
}

function textUser(o, text) {
  const topic = o.length !== "long" ? ""
    : o.topic ? `Тема сочинения: ${o.topic}\n\n`
    : "Тема не указана — возьми её из заголовка или первой фразы.\n\n";
  return topic + "Сочинение:\n" + text;
}

/* Разбор модели → полный результат (он же идёт в кэш и историю). */
function normText(parsed, raw, o) {
  const p = parsed || { comment: raw };      // не JSON — весь текст в comment
  const r = {};
  if (o.length === "long") {
    const c = p.criteria && typeof p.criteria === "object" && !Array.isArray(p.criteria) ? p.criteria : {};
    r.criteria = {};
    CRITERIA.forEach(k => { r.criteria[k] = clampInt(c[k], 0, 5); });
    // не по теме — остальные критерии не считаются
    if (r.criteria.topic_match === 0) CRITERIA.slice(1).forEach(k => { r.criteria[k] = null; });
  }
  r.errors = normErrors(p.errors);
  r.assessment = gradeOf(p.assessment);
  r.comment = str(p.comment);
  return r;
}

/* Полный результат → ответ API: поля — только те, что просили. */
function textResponse(full, o, m) {
  const r = { subject: o.subject, length: o.length };
  if (o.criteria && full.criteria) r.criteria = full.criteria;
  r.errors = full.errors;
  if (o.grade) r.assessment = full.assessment;
  if (o.gradeText) r.assessment_text = GRADE_WORDS[full.assessment] || "N/A";
  r.comment = full.comment;
  if (full.truncated) r.truncated = true;
  if (m.cut) {
    r.truncated_input = true;
    r.warning = `Текст длиннее ${TEXT_CHECK_CHARS} символов — проверены первые ${TEXT_CHECK_CHARS}`;
  }
  r.cached = !!m.cached;
  r.tokens_used = m.tokens;
  r.plan = m.plan.plan;
  r.rate = { remaining: m.rate.remaining, retry_after: m.rate.retry_after, reset_in: m.rate.reset_in };
  if (m.limits) r.groq = { remaining_requests: m.limits.remaining_requests, remaining_tokens: m.limits.remaining_tokens };
  return r;
}

async function textCache(env, hash) {
  if (!sbReady(env)) return null;
  try {
    const rows = await sbRpc(env, "sky_text_cache", { p_hash: hash, p_days: TEXT_CACHE_DAYS });
    const row = Array.isArray(rows) ? rows[0] : rows;
    return row && row.result && typeof row.result === "object" ? row.result : null;
  } catch (e) {
    console.error("[cache]", e.message);
    return null;
  }
}

async function logText(env, who, o, hash, result, tokens) {
  if (!sbReady(env)) return;
  try {
    await sbRpc(env, "sky_log_text", {
      p_user: who.userId, p_ip: who.ip || null, p_subject: o.subject, p_length: o.length,
      p_text_hash: hash, p_result: result, p_tokens: tokens || 0
    });
  } catch (e) {
    console.error("[log]", e.message);
  }
}

async function handleCheckText(request, env, ctx, url) {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method not allowed" }, 405);
  let o, text;
  try {
    let get = k => url.searchParams.get(k);
    if (request.method === "POST") {
      const body = await readJsonBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequest("body must be a JSON object");
      get = k => body[k];
    }
    const t = get("text");
    text = (t == null ? "" : String(t)).replace(/\r\n?/g, "\n").trim();
    o = textOptions(get);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message, code: "bad_param" }, 400);
    throw e;
  }
  if (!text) return json({ error: "text param required", code: "no_text" }, 400);
  if (text.length > TEXT_MAX_CHARS) {
    return json({ error: "Текст слишком длинный, разбейте на части", code: "too_long", max: TEXT_MAX_CHARS }, 400);
  }
  const cut = text.length > TEXT_CHECK_CHARS;
  if (cut) text = cutText(text, TEXT_CHECK_CHARS);

  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  const plan = await getPlan(env, who.userId);
  const lim = textLimit(plan);
  const rate = await rateHit(env, who, "text", lim.window, lim.max, 1);
  if (!rate.allowed) return tooMany(rate, plan);

  // Кэш: тот же текст с теми же настройками за 7 дней — без вызова модели.
  const hash = await sha256Hex([o.subject, o.length, o.topic, text].join("|"));
  const cached = await textCache(env, hash);
  if (cached) {
    const full = normText(cached, "", o);
    ctx.waitUntil(logText(env, who, o, hash, { ...full, cached: true }, 0));
    return json(textResponse(full, o, { cut, cached: true, tokens: ZERO_USAGE, plan, rate }));
  }

  const g = await groq(env, textPrompt(o), textUser(o, text), TEXT_MAX_TOKENS[o.length]);
  const { raw, parsed } = g.ok ? parseModelJson(g.content) : { raw: "" };
  if (!g.ok || !raw) {
    // Разбора нет — запрос не в счёт.
    ctx.waitUntil(rateHit(env, who, "text", lim.window, lim.max, -1));
    if (!g.ok) {
      const f = groqFailure(g);
      return json(f.body, f.status, f.headers);
    }
    return json({ error: "Модель вернула пустой ответ", code: "empty" }, 502);
  }

  const full = normText(parsed, raw, o);
  if (g.truncated) full.truncated = true;
  // Не JSON или обрезан по max_tokens — в историю пишем, в кэш (без хэша) нет.
  const cacheable = parsed && !g.truncated;
  ctx.waitUntil(logText(env, who, o, cacheable ? hash : null, full, g.usage.total));
  return json(textResponse(full, o, { cut, cached: false, tokens: g.usage, plan, rate, limits: g.limits }));
}


/* ============================================================
   /api/limits — что можно этому человеку сейчас
   ============================================================ */

async function handleLimits(request, env) {
  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  const plan = await getPlan(env, who.userId);
  const lim = textLimit(plan);
  const [rate, trate] = await Promise.all([
    rateHit(env, who, "check", plan.window_seconds, plan.requests_per_window, 0),
    rateHit(env, who, "text", lim.window, lim.max, 0)
  ]);
  const pub = r => ({ allowed: r.allowed, remaining: r.remaining, retry_after: r.retry_after, reset_in: r.reset_in });
  return json({
    ...planPublic(plan),
    user: !!who.userId,
    rate: pub(rate),
    text: { requests: lim.max, window_seconds: lim.window, rate: pub(trate) }
  });
}


/* ============================================================
   Поток прогресса для долгих проверок
   ------------------------------------------------------------
   Класс из 30 работ проверяется минуты. С заголовком
   Accept: application/x-ndjson ответ идёт построчно:
     {"type":"progress","done":3,"total":30,...}
     …
     {"type":"result","status":200, ...тот же JSON, что без потока}
   Без заголовка — обычный JSON в конце.
   ============================================================ */

function respondWork(request, ctx, work) {
  const streaming = (request.headers.get("Accept") || "").includes("application/x-ndjson");
  if (!streaming) {
    return work(() => {}).then(res => json(res.body, res.status));
  }
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const emit = obj => writer.write(enc.encode(JSON.stringify(obj) + "\n")).catch(() => {});
  const done = (async () => {
    try {
      const res = await work(emit);
      await emit({ type: "result", status: res.status, ...res.body });
    } catch (e) {
      console.error("[stream]", e && e.stack || e);
      await emit({ type: "result", status: 500, error: "Внутренняя ошибка сервиса", code: "internal" });
    } finally {
      try { await writer.close(); } catch (e) {}
    }
  })();
  ctx.waitUntil(done);
  return new Response(readable, {
    headers: { ...CORS, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" }
  });
}

/* Общая часть учительских эндпоинтов: вход, Премиум, лимит. */
async function teacherGate(request, env) {
  const who = await identify(request, env);
  if (who.denied) return { response: sessionExpired() };
  const plan = await getPlan(env, who.userId);
  if (!plan.teacher) return { response: needPlan("premium", "Режим учителя — в тарифе Премиум") };
  const rate = await rateHit(env, who, "check", plan.window_seconds, plan.requests_per_window, 1);
  if (!rate.allowed) return { response: tooMany(rate, plan) };
  return { who, plan, rate };
}

function cleanPeople(list, max) {
  if (!Array.isArray(list) || !list.length) throw new BadRequest("list of photos is empty");
  if (list.length > max) throw new BadRequest(`at most ${max} photos`);
  return list.map((p, i) => {
    const img = p && typeof p === "object" ? p.img : p;
    if (!isHttpUrl(img)) throw new BadRequest(`photo ${i + 1}: img must be a public http(s) URL`);
    const sid = p && p.submission_id;
    if (sid != null && sid !== "" && !isUuid(sid)) throw new BadRequest(`photo ${i + 1}: bad submission_id`);
    return {
      img: String(img).trim(),
      name: str(p && p.name).trim().slice(0, 100),
      class: str(p && p.class).trim().slice(0, 20),
      submission_id: sid || null
    };
  });
}


/* ============================================================
   /api/check-test — эталон + работы учеников
   ============================================================ */

function testPrompt(subject, total, people) {
  const subj = SUBJECTS[subject] || SUBJECTS.other;
  const list = people.map((p, i) => ({ index: i + 1, name: p.name, class: p.class }));
  const shape = {
    reference: { answers: [{ n: 1, answer: "..." }] },
    students: [{ index: 1, name: "...", class: "...", correct: 0, total: total || 0, errors: [{ n: 1, student: "...", correct: "..." }], comment: "..." }]
  };
  return [
    "Ты школьный учитель. Проверь тест.",
    subj.name ? `Предмет: ${subj.name}. Особое внимание: ${subj.focus}.` : null,
    "1-е фото — эталон с ответами. Остальные — работы учеников, по порядку.",
    "Список учеников по порядку фото: " + JSON.stringify(list),
    "Для каждой работы: распознай метку (ФИО, класс) с фото; если в списке имя или класс пустые — возьми с фото, иначе оставь из списка. Сверь с эталоном, посчитай верные ответы.",
    total ? `Всего вопросов: ${total}.` : "Число вопросов определи по эталону.",
    "reference.answers — ответы эталона: n — номер вопроса, answer — ответ.",
    "students — по объекту на КАЖДУЮ работу, в том же порядке: index — номер из списка, name, class, correct — сколько верных, total — сколько всего вопросов, errors — неверные ответы (n — номер, student — ответ ученика, correct — ответ эталона), comment — одно предложение.",
    "",
    "Ответь ТОЛЬКО одним JSON-объектом, без markdown и без текста до или после него:",
    JSON.stringify(shape)
  ].filter(l => l !== null).join("\n");
}

/* Быстрая проверка (/fast-check): оценка по доле верных ответов. */
const gradeByPercent = p => p >= 90 ? 5 : p >= 75 ? 4 : p >= 60 ? 3 : 2;

/* /api/check-test и /fast-check — один и тот же разбор: 1-е фото —
   эталон, дальше работы, по TEST_BATCH работ на запрос к модели
   (больше картинок за раз glm-4.6v-flash читает хуже). fast — ещё
   оценка у каждого ученика и CSV «ФИО, класс, верно, всего, %,
   оценка». */
async function handleCheckTest(request, env, ctx, fast) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  let body, people, subject, total;
  try {
    body = await readJsonBody(request);
    if (!isHttpUrl(body.reference_img)) throw new BadRequest("reference_img must be a public http(s) URL");
    people = cleanPeople(body.student_imgs, TEACHER_MAX_PHOTOS);
    subject = parseSubject(body.subject);
    total = body.total == null || body.total === "" ? null : clampInt(body.total, 1, 200);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message, code: "bad_param" }, 400);
    throw e;
  }

  const gate = await teacherGate(request, env);
  if (gate.response) return gate.response;
  const { who, plan } = gate;

  return respondWork(request, ctx, async emit => {
    const state = {};
    let usage = ZERO_USAGE, reference = null, zaiError = null;
    const found = new Array(people.length).fill(null);

    for (let start = 0; start < people.length; start += TEST_BATCH) {
      const batch = people.slice(start, start + TEST_BATCH);
      if (!zaiError || zaiError.status !== 429) {
        const z = await zai(env, state, testPrompt(subject, total, batch),
          "Проверь тест. Ответ — только JSON.", [body.reference_img.trim(), ...batch.map(p => p.img)]);
        if (!z.ok) {
          zaiError = zaiFailure(z);
        } else {
          usage = sumUsage(usage, z.usage);
          const { parsed } = parseModelJson(z.content);
          if (parsed) {
            if (!reference && parsed.reference) {
              reference = {
                answers: (Array.isArray(parsed.reference.answers) ? parsed.reference.answers : [])
                  .filter(a => a && typeof a === "object")
                  .map((a, i) => ({ n: clampInt(a.n, 1, 1000) || i + 1, answer: str(a.answer) }))
              };
            }
            (Array.isArray(parsed.students) ? parsed.students : []).forEach((s, k) => {
              if (!s || typeof s !== "object") return;
              const idx = clampInt(s.index, 1, batch.length);
              const at = start + ((idx || k + 1) - 1);
              if (at < start + batch.length && !found[at]) found[at] = s;
            });
          }
        }
      }
      emit({ type: "progress", done: Math.min(start + TEST_BATCH, people.length), total: people.length });
    }

    const students = people.map((p, i) => {
      const s = found[i];
      if (!s) {
        return { index: i + 1, name: p.name, class: p.class, status: "failed",
                 error: zaiError ? zaiError.body.error : "Модель не разобрала эту работу" };
      }
      const all = total || clampInt(s.total, 1, 1000) || (reference ? reference.answers.length : 0);
      const right = Math.min(clampInt(s.correct, 0, 1000) || 0, all || 1000);
      return {
        index: i + 1,
        name: p.name || str(s.name).slice(0, 100),
        class: p.class || str(s.class).slice(0, 20),
        correct: right,
        total: all,
        percent: all ? Math.round(right / all * 100) : 0,
        grade: fast ? gradeByPercent(all ? Math.round(right / all * 100) : 0) : undefined,
        errors: (Array.isArray(s.errors) ? s.errors : []).filter(e => e && typeof e === "object")
          .map(e => ({ n: clampInt(e.n, 1, 1000), student: str(e.student), correct: str(e.correct) })),
        comment: str(s.comment),
        status: "ok"
      };
    });

    const ok = students.filter(s => s.status === "ok");
    if (!ok.length && zaiError) {
      await rateHit(env, who, "check", plan.window_seconds, plan.requests_per_window, -1);
      return zaiError;
    }

    const summary = {
      students: students.length,
      checked: ok.length,
      failed: students.length - ok.length,
      total: total || (reference ? reference.answers.length : null),
      avg_percent: ok.length ? Math.round(ok.reduce((a, s) => a + s.percent, 0) / ok.length) : null
    };
    if (fast) {
      summary.avg_grade = ok.length ? Math.round(ok.reduce((a, s) => a + s.grade, 0) / ok.length * 10) / 10 : null;
      summary.grades = { 5: 0, 4: 0, 3: 0, 2: 0 };
      ok.forEach(s => { summary.grades[s.grade]++; });
    }
    const csv_url = fast
      ? csvDataUrl(["ФИО", "Класс", "Верно", "Всего", "%", "Оценка"],
          students.map(s => s.status === "ok"
            ? [s.name, s.class, s.correct, s.total, s.percent, s.grade]
            : [s.name, s.class, "", "", "", "Не проверено: " + s.error]))
      : csvDataUrl(["ФИО", "Класс", "Верно", "Всего", "Процент", "Ошибки"],
          students.map(s => [s.name, s.class, s.status === "ok" ? s.correct : "", s.status === "ok" ? s.total : "",
            s.status === "ok" ? s.percent : "", s.status === "ok" ? s.errors.map(e => `№${e.n}: ${e.student} → ${e.correct}`).join("; ") : s.error]));

    const out = { reference, students, summary, tokens_used: usage, csv_url };
    await logCheck(env, who, body.reference_img, { subject, mode: fast ? "fast-check" : "test", length: null },
      { reference, students, summary }, usage.total);
    return { status: 200, body: out };
  });
}


/* ============================================================
   /api/check-teacher-report — класс, по фото на ученика
   ============================================================ */

async function handleTeacherReport(request, env, ctx) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  let body, people, o;
  try {
    body = await readJsonBody(request);
    people = cleanPeople(body.photos, TEACHER_MAX_PHOTOS);
    o = {
      mode: "check",
      subject: parseSubject(body.subject),
      grade: body.grade == null ? true : parseBool(body.grade, "grade"),
      gradeText: false,
      accuracy: false,
      length: body.length === "short" ? "short" : "long",
      task: str(body.task).trim().slice(0, 800),
      label: true,
      photos: 1,
      criteria: parseCriteria(body.criteria)
    };
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message, code: "bad_param" }, 400);
    throw e;
  }

  const gate = await teacherGate(request, env);
  if (gate.response) return gate.response;
  const { who, plan } = gate;

  return respondWork(request, ctx, async emit => {
    const state = {};
    let usage = ZERO_USAGE, stopped = null;
    const reports = [];

    // По одному и по очереди: параллельно бесплатная модель отвечает 429.
    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      let rep;
      if (stopped) {
        rep = { index: i + 1, name: p.name, class: p.class, status: "failed", error: stopped.body.error };
      } else {
        const z = await zai(env, state, checkPrompt(o), "Проверь эту работу. Ответ — только JSON.", [p.img]);
        const { raw, parsed } = z.ok ? parseModelJson(z.content) : { raw: "" };
        if (!z.ok || !raw) {
          const f = z.ok ? { status: 502, body: { error: "Модель вернула пустой ответ" } } : zaiFailure(z);
          if (f.status === 429) stopped = f;       // дальше будет то же самое
          rep = { index: i + 1, name: p.name, class: p.class, status: "failed", error: f.body.error };
        } else {
          usage = sumUsage(usage, z.usage);
          const r = normCheck(parsed, raw, o);
          rep = {
            index: i + 1,
            name: p.name || r.student_name,
            class: p.class || r.student_class,
            assessment: o.grade || o.criteria ? r.assessment : undefined,
            assessment_reason: r.assessment_reason,
            criteria: r.criteria,
            score: r.score,
            errors_count: r.errors.length,
            errors: r.errors,
            comment: r.comment,
            recognized_text: r.recognized_text,
            status: "ok"
          };
        }
      }
      if (p.submission_id) rep.submission_id = p.submission_id;
      reports.push(rep);
      emit({ type: "progress", done: i + 1, total: people.length, name: rep.name, status: rep.status });
    }

    const ok = reports.filter(r => r.status === "ok");
    if (!ok.length && stopped) {
      await rateHit(env, who, "check", plan.window_seconds, plan.requests_per_window, -1);
      return stopped;
    }
    const graded = ok.map(r => r.assessment).filter(g => typeof g === "number");
    const summary = {
      avg: graded.length ? Math.round(graded.reduce((a, g) => a + g, 0) / graded.length * 100) / 100 : null,
      total: reports.length,
      checked: ok.length,
      failed: reports.length - ok.length
    };
    /* с критериями — ещё столбец итогового балла и по столбцу на критерий */
    const crit = o.criteria || [];
    const csv_url = csvDataUrl(["ФИО", "Класс", "Оценка", "Комментарий", "Ошибок"]
        .concat(crit.length ? ["Балл"].concat(crit.map(c => `${c.name} (вес ${c.weight})`)) : []),
      reports.map(r => [r.name, r.class,
        r.status === "ok" ? (r.assessment == null ? "" : r.assessment) : "",
        r.status === "ok" ? r.comment : "Не проверено: " + r.error,
        r.status === "ok" ? r.errors_count : ""]
        .concat(crit.length ? [r.status === "ok" && r.score != null ? String(r.score).replace(".", ",") : ""]
          .concat(crit.map((c, k) => r.status === "ok" && r.criteria && r.criteria[k].score != null ? r.criteria[k].score : "")) : [])));

    // Работы по ссылкам: отметить проверенные.
    const items = reports.filter(r => r.submission_id).map(r => ({
      id: r.submission_id,
      status: r.status === "ok" ? "checked" : "failed",
      result: r.status === "ok"
        ? { assessment: r.assessment, assessment_reason: r.assessment_reason, errors: r.errors, comment: r.comment, criteria: r.criteria, score: r.score }
        : { error: r.error }
    }));
    if (items.length && sbReady(env)) {
      try { await sbRpc(env, "sky_submissions_update", { p_items: items }); }
      catch (e) { console.error("[submissions]", e.message); }
    }

    await logCheck(env, who, people[0].img, { subject: o.subject, mode: "teacher-report", length: o.length },
      { reports: reports.map(({ recognized_text, ...r }) => r), summary }, usage.total);
    return { status: 200, body: { reports, summary, csv_url, tokens_used: usage } };
  });
}


/* ============================================================
   /api/submit-homework — работа по ссылке
   ------------------------------------------------------------
   Тело — либо сама картинка (Content-Type: image/jpeg, поля в
   query: student_name, class, subject), либо JSON с img_base64 или
   img_url. Страница шлёт картинку как есть: разбирать base64 на
   бесплатном тарифе Cloudflare дорого по процессору.
   ============================================================ */

function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: "png", type: "image/png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

function decodeBase64(s) {
  const clean = String(s).replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
  if ((clean.length * 3) / 4 > MAX_UPLOAD_BYTES + 3) throw new BadRequest("photo is larger than 1.5 MB");
  let bin;
  try { bin = atob(clean); } catch (e) { throw new BadRequest("img_base64 is not valid base64"); }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function handleSubmit(request, env, url) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!sbReady(env)) return json({ error: "Хранилище не настроено", code: "storage" }, 503);

  const ctype = (request.headers.get("Content-Type") || "").toLowerCase();
  let meta, bytes = null, externalUrl = null;
  try {
    if (ctype.startsWith("image/")) {
      const len = parseInt(request.headers.get("Content-Length") || "0", 10);
      if (len > MAX_UPLOAD_BYTES) throw new BadRequest("photo is larger than 1.5 MB");
      bytes = new Uint8Array(await request.arrayBuffer());
      meta = { student_name: url.searchParams.get("student_name"), class: url.searchParams.get("class"), subject: url.searchParams.get("subject") };
    } else {
      meta = await readJsonBody(request);
      if (meta.img_base64) bytes = decodeBase64(meta.img_base64);
      else if (isHttpUrl(meta.img_url) && /^https:/i.test(meta.img_url)) externalUrl = meta.img_url.trim();
      else throw new BadRequest("img_base64 or https img_url is required");
    }
    if (bytes) {
      if (!bytes.length) throw new BadRequest("photo is empty");
      if (bytes.length > MAX_UPLOAD_BYTES) throw new BadRequest("photo is larger than 1.5 MB");
    }
    meta.student_name = str(meta.student_name).trim();
    if (!meta.student_name) throw new BadRequest("student_name is required");
    if (meta.student_name.length > 100) throw new BadRequest("student_name is too long");
    meta.class = str(meta.class).trim();
    if (meta.class.length > 20) throw new BadRequest("class is too long");
    meta.subject = parseSubject(meta.subject);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: e.message, code: "bad_param" }, 400);
    throw e;
  }

  let image = null;
  if (bytes) {
    image = sniffImage(bytes);
    if (!image) return json({ error: "Нужна картинка jpg, png или webp", code: "bad_img" }, 400);
  }

  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  const rate = await rateHit(env, who, "submit", SUBMIT_LIMIT.window, SUBMIT_LIMIT.max, 1);
  if (!rate.allowed) {
    return json({ error: `Слишком много отправок, попробуйте через ${rate.retry_after} с`, code: "rate_limit", retry_after: rate.retry_after },
      429, { "Retry-After": String(rate.retry_after) });
  }

  const id = crypto.randomUUID();
  let stored = externalUrl;
  if (bytes) {
    stored = `submissions/${id}.${image.ext}`;
    await sbFetch(env, `/storage/v1/object/${BUCKET}/${stored}`, {
      method: "POST",
      headers: { "Content-Type": image.type, "x-upsert": "false" },
      body: bytes
    });
  }
  try {
    await sbFetch(env, "/rest/v1/homework_submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        id, student_id: who.userId, student_name: meta.student_name, class: meta.class || null,
        subject: meta.subject || null, img_url: stored
      })
    });
  } catch (e) {
    if (bytes) {
      await sbFetch(env, `/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [stored] })
      }).catch(() => {});
    }
    throw e;
  }

  const site = String(env.SITE_URL || DEFAULT_SITE).replace(/\/?$/, "/");
  return json({ id, url: `${site}photo.html?hw=${id}` }, 201);
}


/* ============================================================
   /api/homework/:id
   ============================================================ */

async function handleHomeworkGet(env, id) {
  if (!isUuid(id)) return json({ error: "bad id", code: "bad_param" }, 400);
  if (!sbReady(env)) return json({ error: "Хранилище не настроено", code: "storage" }, 503);
  const r = await sbFetch(env,
    `/rest/v1/homework_submissions?id=eq.${id}&select=id,student_name,class,subject,img_url,status,result,created_at`, {});
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return json({ error: "Работа не найдена", code: "not_found" }, 404);
  if (row.img_url && !/^https?:/i.test(row.img_url)) row.img_url = await signPath(env, row.img_url, SIGNED_TTL);
  return json(row);
}


/* ============================================================
   /api/payments — заявка на оплату (ЮKassa ещё не подключена)
   ============================================================ */

const PURPOSES = {
  paid_tariff:    { plan: "paid" },
  premium_tariff: { plan: "premium" },
  plagiarism:     { plan: null, amount: 40 }
};

async function handlePayment(request, env, ctx) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!sbReady(env)) return json({ error: "Оплата не настроена", code: "storage" }, 503);
  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  if (!who.userId) return json({ error: "Войдите, чтобы оформить тариф", code: "login" }, 401);

  let body;
  try { body = await readJsonBody(request); } catch (e) { return json({ error: e.message, code: "bad_param" }, 400); }
  const p = PURPOSES[body && body.purpose];
  if (!p) return json({ error: "purpose must be paid_tariff, premium_tariff or plagiarism", code: "bad_param" }, 400);

  const rate = await rateHit(env, who, "pay", PAY_LIMIT.window, PAY_LIMIT.max, 1);
  if (!rate.allowed) return json({ error: "Слишком много заявок, попробуйте позже", code: "rate_limit", retry_after: rate.retry_after }, 429);

  // Сумму берём из справочника, а не от клиента.
  let amount = p.amount;
  if (p.plan) {
    const r = await sbFetch(env, `/rest/v1/plan_limits?plan=eq.${p.plan}&select=price_rub`, {});
    const rows = await r.json();
    amount = rows && rows[0] ? rows[0].price_rub : null;
    if (amount == null) return json({ error: "Тариф не найден — выполните sql/schema-tariffs.sql", code: "storage" }, 503);
  }
  const r = await sbFetch(env, "/rest/v1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ user_id: who.userId, amount, currency: "RUB", status: "pending", plan: p.plan, purpose: body.purpose })
  });
  const rows = await r.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  // Админу — сообщение в Telegram. Не вышло — заявка всё равно создана.
  const note = notifyAdminNewPayment(env, row && row.id, amount, body.purpose).catch(e => console.warn("[telegram]", e && e.message));
  if (ctx && ctx.waitUntil) ctx.waitUntil(note); else await note;
  return json({ id: row && row.id, status: "pending", amount, purpose: body.purpose, message: "Оплата скоро" }, 201);
}


/* ============================================================
   Telegram: уведомления об оплате
   ------------------------------------------------------------
   Секреты — только здесь, в Worker: TELEGRAM_BOT_TOKEN (бот) и
   ADMIN_CHAT_ID (куда слать о новых заявках). chat_id ученика —
   таблица user_telegram (sql/schema-admin-automation.sql), данные
   заявки — функция sky_payment_info (только service_role).
   Токен бота в ответы и логи не попадает.
   ============================================================ */

const TG_TIMEOUT_MS = 8000;
const PURPOSE_TITLES = { paid_tariff: "тариф «Платный»", premium_tariff: "тариф «Премиум»", plagiarism: "проверка на списывание" };

async function tgSend(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, reason: "no_bot" };
  if (!chatId) return { ok: false, reason: "no_chat" };
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: String(chatId), text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TG_TIMEOUT_MS)
    });
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || !d.ok) return { ok: false, reason: "telegram", description: str(d && d.description).slice(0, 200) };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "telegram", description: str(e && e.message).slice(0, 200) };
  }
}

const ruDate = v => {
  const d = new Date(v);
  return isNaN(d) ? "" : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Moscow" });
};

async function notifyAdminNewPayment(env, paymentId, amount, purpose) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.ADMIN_CHAT_ID) return;
  let info = null;
  if (paymentId) { try { info = await sbRpc(env, "sky_payment_info", { p_id: paymentId }); } catch (e) { info = null; } }
  const site = String(env.SITE_URL || DEFAULT_SITE).replace(/\/?$/, "/");
  await tgSend(env, env.ADMIN_CHAT_ID, [
    "💳 Новая заявка на оплату",
    (info && info.email) || "без почты",
    `${PURPOSE_TITLES[purpose] || purpose} — ${amount} ₽`,
    `Подтвердить: ${site}admin.html`
  ].join("\n"));
}

/* Страница админки после «Подтвердить» (admin_confirm_payment уже
   выполнена в базе) просит отправить ученику сообщение. Вызвать может
   только админ: вход (JWT) проверен в identify(), а админ ли это —
   функция sky_is_admin (только для сервисного ключа). */
async function isAdminCaller(env, userId) {
  if (!userId) return false;
  try { return (await sbRpc(env, "sky_is_admin", { p_user: userId })) === true; }
  catch (e) { console.warn("[admin check]", e.message); return false; }
}

async function handleNotifyPayment(request, env) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!sbReady(env)) return json({ error: "Хранилище не настроено", code: "storage" }, 503);
  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  if (!who.userId) return json({ error: "Войдите", code: "login" }, 401);
  if (!(await isAdminCaller(env, who.userId))) return json({ error: "Только для администратора", code: "forbidden" }, 403);

  let body;
  try { body = await readJsonBody(request); } catch (e) { return json({ error: e.message, code: "bad_param" }, 400); }
  if (!isUuid(body && body.payment_id)) return json({ error: "payment_id must be a uuid", code: "bad_param" }, 400);

  const info = await sbRpc(env, "sky_payment_info", { p_id: body.payment_id });
  if (!info) return json({ error: "Заявка не найдена", code: "not_found" }, 404);
  if (info.status !== "paid") return json({ error: "Заявка ещё не подтверждена", code: "not_paid" }, 409);

  const site = String(env.SITE_URL || DEFAULT_SITE).replace(/\/?$/, "/");
  const what = info.purpose === "plagiarism"
    ? "Проверка на списывание включена."
    : `Тариф «${info.plan_title || info.plan}» активен${info.expires_at ? " до " + ruDate(info.expires_at) : ""}.`;
  const res = await tgSend(env, info.chat_id, ["✅ Оплата подтверждена", what, `SkyySchool: ${site}photo.html`].join("\n"));
  return json({ sent: res.ok, reason: res.ok ? undefined : res.reason, description: res.description });
}


/* ============================================================
   Telegram: уведомления и бот
   ------------------------------------------------------------
   Привязка: профиль просит у базы одноразовый код (telegram_link_start),
   человек открывает t.me/<бот>?start=<код>, Telegram присылает сюда
   /start <код> — sky_telegram_link сохраняет chat_id в user_telegram.
   Вебхук принимает только запросы с секретом TELEGRAM_WEBHOOK_SECRET
   (заголовок X-Telegram-Bot-Api-Secret-Token). Сообщения — обычный
   текст: parse_mode не включаем, чтобы имя ученика вида «<b>» не
   превращалось в разметку.
   ============================================================ */

const NOTIFY_TYPES = {
  new_submission:    { icon: "📥", title: "Новая работа" },
  payment_confirmed: { icon: "✅", title: "Оплата подтверждена" },
  limit_warning:     { icon: "⏳", title: "Лимит проверок" },
  test:              { icon: "👋", title: "Проверка связи" }
};
const NOTIFY_MAX_CHARS = 1000;
const NOTIFY_SUB_LIMIT = { window: 600, max: 30 };   // /api/notify-submission с одного адреса

const siteUrl = env => String(env.SITE_URL || DEFAULT_SITE).replace(/\/?$/, "/");

/* Сравнение секретов за постоянное время: по времени ответа их не подобрать. */
function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* Текст от людей: без управляющих символов и не длиннее предела. */
const cleanText = (v, max) => str(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);

async function handleNotify(request, env) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!sbReady(env)) return json({ error: "Хранилище не настроено", code: "storage" }, 503);
  let body;
  try { body = await readJsonBody(request); } catch (e) { return json({ error: e.message, code: "bad_param" }, 400); }
  body = body || {};
  if (!isUuid(body.user_id)) return json({ error: "user_id must be a uuid", code: "bad_param" }, 400);
  const kind = NOTIFY_TYPES[body.type];
  if (!kind) return json({ error: "type must be one of: " + Object.keys(NOTIFY_TYPES).join(", "), code: "bad_param" }, 400);
  const message = cleanText(body.message, NOTIFY_MAX_CHARS);

  /* Кто может: сервер с ключом NOTIFY_KEY, админ — кому угодно,
     остальные — только себе (кнопка «Проверить» в профиле). */
  const byKey = env.NOTIFY_KEY && safeEqual(request.headers.get("X-Notify-Key"), env.NOTIFY_KEY);
  if (!byKey) {
    const who = await identify(request, env);
    if (who.denied) return sessionExpired();
    if (!who.userId) return json({ error: "Войдите в аккаунт", code: "login" }, 401);
    if (who.userId !== body.user_id && !(await isAdminCaller(env, who.userId))) {
      return json({ error: "Можно писать только себе", code: "forbidden" }, 403);
    }
  }

  const chat = await sbRpc(env, "sky_telegram_chat", { p_user: body.user_id });
  if (!chat) return json({ sent: false, reason: "no_chat" });
  const res = await tgSend(env, chat, `${kind.icon} ${kind.title}` + (message ? "\n" + message : ""));
  return json({ sent: res.ok, reason: res.ok ? undefined : res.reason, description: res.description });
}

/* Ученик сдал подборку — учителю одно сообщение. Входить не нужно
   (сдают и без аккаунта), поэтому доверяем только базе: работа должна
   существовать и быть свежей (15 минут), а sky_notify_once не даёт
   отправить о ней второй раз. */
async function handleNotifySubmission(request, env) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!sbReady(env)) return json({ error: "Хранилище не настроено", code: "storage" }, 503);
  let body;
  try { body = await readJsonBody(request); } catch (e) { return json({ error: e.message, code: "bad_param" }, 400); }
  if (!body || body.kind !== "collection" || !isUuid(body.id)) return json({ error: "kind must be collection, id a uuid", code: "bad_param" }, 400);
  const who = { userId: null, ip: request.headers.get("CF-Connecting-IP") || "" };
  const rate = await rateHit(env, who, "notify-sub", NOTIFY_SUB_LIMIT.window, NOTIFY_SUB_LIMIT.max, 1);
  if (!rate.allowed) return json({ error: "Слишком часто", code: "rate_limit", retry_after: rate.retry_after }, 429);

  const info = await sbRpc(env, "sky_collection_submission_info", { p_id: body.id });
  if (!info) return json({ sent: false, reason: "not_found" }, 404);
  if (!info.chat_id) return json({ sent: false, reason: "no_chat" });
  if (!(await sbRpc(env, "sky_notify_once", { p_key: "sub:" + body.id }))) return json({ sent: false, reason: "already" });

  const pct = info.percent != null ? ` (${String(info.percent).replace(".", ",")}%)` : "";
  const lines = [
    `${NOTIFY_TYPES.new_submission.icon} ${NOTIFY_TYPES.new_submission.title}`,
    `${cleanText(info.student_name, 100) || "Ученик"} сдал(а) «${cleanText(info.title, 200)}»: ${info.score} из ${info.total}${pct}`,
    info.status === "pending" ? "Есть задания с развёрнутым ответом — ждут вашей проверки." : "",
    `Открыть: ${siteUrl(env)}profile.html#inbox`
  ].filter(Boolean);
  const res = await tgSend(env, info.chat_id, lines.join("\n"));
  return json({ sent: res.ok, reason: res.ok ? undefined : res.reason });
}

/* Лимит проверок кончился — раз в сутки сообщение в Telegram. */
async function warnLimit(env, who, rate, plan) {
  if (!who.userId || !sbReady(env) || !env.TELEGRAM_BOT_TOKEN) return;
  const chat = await sbRpc(env, "sky_telegram_chat", { p_user: who.userId });
  if (!chat) return;
  const day = new Date().toISOString().slice(0, 10);
  if (!(await sbRpc(env, "sky_notify_once", { p_key: `limit:${who.userId}:${day}` }))) return;
  const mins = Math.max(1, Math.ceil((rate.retry_after || 60) / 60));
  await tgSend(env, chat, [
    `${NOTIFY_TYPES.limit_warning.icon} ${NOTIFY_TYPES.limit_warning.title}`,
    `На тарифе «${planTitle(plan)}» проверки на это время закончились. Следующая — через ${mins} мин.`,
    `Больше проверок: ${siteUrl(env)}profile.html#plan`
  ].join("\n"));
}

async function handleTelegramWebhook(request, env) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return json({ error: "Бот не настроен", code: "no_bot" }, 503);
  if (!safeEqual(request.headers.get("X-Telegram-Bot-Api-Secret-Token"), env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ error: "forbidden", code: "forbidden" }, 403);
  }
  let upd = null;
  try { upd = await request.json(); } catch (e) { return json({ ok: true }); }
  const msg = upd && (upd.message || upd.edited_message);
  /* Только личные чаты: в группе /start с кодом увидели бы все. */
  if (!msg || !msg.chat || msg.chat.type !== "private") return json({ ok: true });
  const chatId = String(msg.chat.id);
  const text = str(msg.text).trim();
  const site = siteUrl(env);

  let reply;
  const start = text.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{16,64}))?\s*$/);
  if (start && start[1] && sbReady(env)) {
    const r = await sbRpc(env, "sky_telegram_link", { p_code: start[1], p_chat_id: chatId });
    reply = r && r.ok
      ? [`✅ Готово${r.name ? ", " + cleanText(r.name, 80) : ""}! Уведомления SkyySchool включены.`,
         "Напишу, когда ученик сдаст работу, когда подтвердится оплата и когда закончится лимит проверок.",
         "Отключить — команда /stop."].join("\n")
      : ["Ссылка устарела или уже использована.",
         `Откройте профиль и нажмите «Привязать Telegram» ещё раз: ${site}profile.html#telegram`].join("\n");
  } else if (/^\/stop(?:@\w+)?\s*$/.test(text) && sbReady(env)) {
    const n = await sbRpc(env, "sky_telegram_unlink", { p_chat_id: chatId });
    reply = n ? "Уведомления выключены. Включить снова — в профиле на сайте." : "Этот чат и так не привязан к SkyySchool.";
  } else {
    reply = ["Это бот уведомлений SkyySchool.",
             `Чтобы получать сообщения, откройте профиль и нажмите «Привязать Telegram»: ${site}profile.html#telegram`,
             "/stop — отключить уведомления."].join("\n");
  }
  await tgSend(env, chatId, reply);
  return json({ ok: true });
}

/* Имя бота — для ссылки t.me/<бот>?start=<код>. getMe спрашиваем
   один раз на экземпляр Worker. */
let botNameCache = null;
async function botUsername(env) {
  if (env.TELEGRAM_BOT_USERNAME) return String(env.TELEGRAM_BOT_USERNAME).replace(/^@/, "");
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  if (botNameCache) return botNameCache;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`, { signal: AbortSignal.timeout(TG_TIMEOUT_MS) });
    const d = await r.json();
    botNameCache = d && d.ok && d.result && d.result.username || null;
  } catch (e) { botNameCache = null; }
  return botNameCache;
}

async function handleTelegramBot(env) {
  const username = await botUsername(env);
  return json({
    ready: !!(env.TELEGRAM_BOT_TOKEN && username && env.TELEGRAM_WEBHOOK_SECRET && sbReady(env)),
    username: username || null,
    webhook_secret: !!env.TELEGRAM_WEBHOOK_SECRET
  });
}

/* Один раз после развёртывания: сказать Telegram, куда слать сообщения
   боту. Только админ. Адрес — этот же Worker. */
async function handleTelegramSetup(request, env, url) {
  if (request.method !== "POST") return json({ error: "use POST", code: "method" }, 405);
  if (!sbReady(env)) return json({ error: "Хранилище не настроено", code: "storage" }, 503);
  const who = await identify(request, env);
  if (who.denied) return sessionExpired();
  if (!who.userId) return json({ error: "Войдите", code: "login" }, 401);
  if (!(await isAdminCaller(env, who.userId))) return json({ error: "Только для администратора", code: "forbidden" }, 403);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ error: "Задайте секреты TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET", code: "no_bot" }, 503);
  }
  const hook = `${url.origin}/telegram/webhook`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: hook, secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"], drop_pending_updates: true }),
      signal: AbortSignal.timeout(TG_TIMEOUT_MS)
    });
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return json({ ok: false, error: str(d && d.description).slice(0, 200) || "Telegram не принял вебхук", code: "telegram" }, 502);
    return json({ ok: true, webhook: hook, username: await botUsername(env) });
  } catch (e) {
    return json({ ok: false, error: "Telegram не ответил", code: "telegram" }, 502);
  }
}


/* >>> worker/worker.js — вставлено scripts/embed-legacy-worker.js, руками не править */
const LEGACY = (() => {
/* ============================================================
   SkyySchool — прокси к моделям на Cloudflare Workers

   Зачем он нужен. Ключи нельзя класть в файлы сайта: GitHub Pages
   отдаёт их как есть, и ключ увидит любой, кто откроет исходник
   страницы. По GitHub круглосуточно ходят боты, которые ищут строки
   вида sk-… и тратят чужие деньги.

   Здесь ключи живут в переменных окружения Worker: браузер их не
   получает, они уходят только с этого сервера в модель.

   Четыре эндпоинта:
     POST /explain       — разбор задания (Groq)
     POST /check-photo   — домашка по фото (Gemini читает → Groq оценивает)
     POST /chess-explain — объяснение уже посчитанной оценки хода
                           (Groq; САМУ оценку считает движок в
                           браузере, см. assets/chess-review.js)
     POST /grade-essay   — проверка сочинения по критериям (Groq)

   Разделение простое: весь текст — Groq, всё, что с картинкой, —
   зрячая модель. Никаких других поставщиков здесь нет.

   Зрячая модель выбирается по тому, какой ключ задан: GLM, если есть
   GLM_API_KEY (бесплатный тариф), иначе Gemini. Задать оба можно —
   тогда работает GLM; какой выбран, показывает /health в поле
   visionProvider.

   Секреты (задаются в панели Cloudflare или через wrangler):
     GROQ_API_KEY           — текстовые эндпоинты
     GLM_API_KEY            — /check-photo, основной
     GEMINI_API_KEY         — /check-photo, запасной; можно не задавать
     SUPABASE_URL           — лимиты и история разборов
     SUPABASE_SERVICE_KEY   — то же; ключ обходит RLS, только сюда
   Необязательные переменные: GROQ_MODEL, GLM_MODEL, GLM_API_URL,
   GEMINI_MODEL, RATE_*, MAX_TOKENS*, ALLOWED_ORIGINS — меняются без
   выкатки.
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
  /* ---------- модели ----------
     Текст — Groq, фото — Gemini. Больше никого.

     Про GROQ_MODEL. Документация Groq сама себе противоречит: страница
     отказа от моделей НЕ числит llama-3.3-70b-versatile устаревшей и
     даже называет её заменой для старых Llama, а страница моделей
     ставит рядом метку Enterprise / Contact Sales. Что из этого верно
     для конкретного ключа — покажет первый же запрос.

     Поэтому здесь стоит запрошенная модель, но она вынесена в
     переменную окружения: если Groq ответит «нет такой модели» или
     «нет доступа», в Cloudflare достаточно поменять GROQ_MODEL на
     openai/gpt-oss-120b и нажать Save — без правки кода и выкатки.
     Текст ошибки об этом прямо говорит, см. groqHint(). */
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  GEMINI_MODEL: 'gemini-2.5-flash',
  /* ЗРЕНИЕ: GLM ПО УМОЛЧАНИЮ, GEMINI — ЕСЛИ ЕГО КЛЮЧ ЗАДАН

     Имя модели и адрес вынесены в переменные не для красоты. У GLM две
     площадки с разными именами моделей: на китайской open.bigmodel.cn
     бесплатная зрячая модель называется glm-4v-flash, на
     международной api.z.ai та же роль у glm-4.6v-flash. Ключ работает
     только на своей площадке. Если запрос вернёт «нет такой модели»
     или 401, в Cloudflare достаточно поменять GLM_MODEL и GLM_API_URL
     и нажать Save — без правки кода и выкатки. Текст ошибки об этом
     прямо говорит, см. glmHint(). */
  /* ПОЧЕМУ ЗДЕСЬ 4.6, А НЕ 4v

     Сначала тут стояла glm-4v-flash — так эта модель называется в
     документации open.bigmodel.cn. На живом ключе площадка ответила,
     что модель недоступна: в тарифах аккаунта бесплатной значится
     GLM-4.6V-Flash. Менять это переменной GLM_MODEL в панели
     Cloudflare оказалось ненадёжно — значение до воркера не доезжало,
     и /health продолжал показывать старое. Поэтому рабочее имя стоит
     значением по умолчанию: тогда ничего настраивать не нужно, а
     переменная остаётся на случай, когда имя опять поменяют. */
  GLM_MODEL: 'glm-4.6v-flash',
  /* Международная площадка Z.AI — так указано в задании. В прошлой
     правке здесь по недосмотру осталась китайская open.bigmodel.cn.
     Ключ работает только на своей площадке: если он выдан на
     bigmodel.cn, поменяйте GLM_API_URL в настройках Worker. */
  GLM_API_URL: 'https://api.z.ai/api/paas/v4/chat/completions',
  /* потолок ответа модели в токенах */
  MAX_TOKENS: 500,
  MAX_TOKENS_PHOTO: 900,
  /* сочинение длиннее разбора задачи, и разбор по критериям тоже */
  MAX_TOKENS_ESSAY: 1200,
  /* максимальная длина сочинения на входе, символов */
  MAX_ESSAY_CHARS: 12000,
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
   Groq для любых задач — от чужих курсовых до попыток обойти
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
function groqHint(status) {
  if (status === 401) return 'Groq не принял ключ. Проверьте GROQ_API_KEY в настройках Worker.';
  if (status === 429) return 'Groq: слишком много запросов или кончился лимит.';
  if (status === 404) return 'Groq не знает такой модели. Проверьте GROQ_MODEL — список доступных моделей меняется.';
  if (status >= 500) return 'Groq временно недоступен.';
  return 'Groq ответил ошибкой ' + status + '.';
}

/* Groq говорит на том же языке, что и OpenAI, поэтому тело запроса
   почти совпадает с любым OpenAI-совместимым API. */
async function callGroq(env, system, user, opts) {
  const o = opts || {};
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + env.GROQ_API_KEY
    },
    body: JSON.stringify(Object.assign({
      model: modelCfg(env, 'GROQ_MODEL'),
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: o.temperature == null ? 0.3 : o.temperature,
      max_tokens: o.maxTokens || numCfg(env, 'MAX_TOKENS')
    }, o.jsonMode ? { response_format: { type: 'json_object' } } : {}))
  });

  if (!r.ok) {
    const text = await r.text();
    return { error: groqHint(r.status), detail: text.slice(0, 300), status: r.status };
  }
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) return { error: 'Пустой ответ от Groq.' };
  return { content, provider: 'groq' };
}

/* ---------- единственный текстовый поставщик ----------
   Запасного нет намеренно: держать второй ключ живым ради редкого
   отказа — это второй счёт, второй лимит и второе место, где всё
   может протухнуть незаметно. Когда Groq недоступен, сайт не остаётся
   пустым: на страницах работает assets/ai-fallback.js, который
   собирает разбор из заготовленных фраз голосом выбранного учителя. */
async function callModel(env, system, user, opts) {
  if (!env.GROQ_API_KEY) {
    return { error: 'Ключ Groq не задан. Выполните: npx wrangler secret put GROQ_API_KEY' };
  }
  try {
    return await callGroq(env, system, user, opts);
  } catch (e) {
    return { error: 'Groq недоступен: ' + e.message };
  }
}

/* ---------- зрение ----------
   Читает фото и возвращает распознанный текст. Провайдера выбираем по
   тому, какой ключ задан: GLM бесплатный и потому основной, Gemini
   остаётся запасным, если его ключ есть.

   Почему выбор по ключу, а не отдельной переменной: одна переменная
   меньше, и невозможно выставить провайдера, для которого не задан
   ключ, — самая частая ошибка настройки. */

function glmHint(status, model, url) {
  if (status === 401 || status === 403)
    return 'Ключ GLM не принят. Проверьте GLM_API_KEY и что он выдан для площадки ' + url + '.';
  /* glm-4v-flash по документации принимает ровно одно фото и не
     принимает base64. Сказать об этом прямо — иначе ошибка выглядит
     как «модель недоступна», и искать будут не там. */
  if (status === 400 && /^glm-4v-flash$/i.test(model))
    return 'Модель glm-4v-flash принимает только одно фото за запрос и не принимает base64. ' +
      'Для проверки нескольких фото нужна glm-4.6v-flash — уберите переменную GLM_MODEL в настройках Worker.';
  if (status === 404 || status === 400)
    return 'GLM не принял запрос: возможно, модель «' + model + '» недоступна на этой площадке. ' +
      'Бесплатная зрячая модель называется glm-4.6v-flash (и на open.bigmodel.cn, и на api.z.ai). ' +
      'Поменяйте GLM_MODEL и GLM_API_URL в настройках Worker.';
  if (status === 429)
    return 'Исчерпан лимит запросов GLM. Попробуйте позже.';
  return 'GLM вернул ошибку ' + status + '.';
}

async function callGlmVision(env, base64, mime, prompt) {
  const model = modelCfg(env, 'GLM_MODEL');
  const url = strCfg(env, 'GLM_API_URL');

  /* Картинку GLM принимает строкой data:<MIME>;base64,… — именно с
     префиксом. Сюда base64 приходит уже без него (его сняли выше,
     чтобы посчитать размер), поэтому собираем обратно. */
  const dataUrl = 'data:' + mime + ';base64,' + base64;

  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GLM_API_KEY },
      body: JSON.stringify({
        model,
        temperature: 0,          /* распознавание, а не сочинение */
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });
  } catch (e) {
    return { error: 'GLM недоступен: ' + e.message };
  }

  if (!r.ok) {
    const text = await r.text();
    return { error: glmHint(r.status, model, url), detail: text.slice(0, 300) };
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  /* Ответ обычно строка, но у части моделей — массив кусков. */
  const text = (Array.isArray(content)
    ? content.map(c => (typeof c === 'string' ? c : c?.text || '')).join('')
    : String(content || '')).trim();

  if (!text) return { error: 'GLM не смог прочитать текст на фото.' };
  return { text };
}

/* ---------- защита от ключа, вставленного не в то поле ----------

   Случай из жизни: ключ GLM вписали в переменную GLM_MODEL вместо
   GLM_API_KEY. GLM_MODEL — обычная переменная, а не секрет, и /health
   честно показывал её значение всем подряд. Ключ оказался открыт в
   публичном ответе.

   Виноват тут не только тот, кто перепутал поля: /health не должен был
   выводить наружу значение, которое выглядит как ключ. Поэтому теперь
   две вещи. Первая — looksLikeSecret() ловит типичные формы ключей, и
   такое значение не показывается и не используется как имя модели:
   вместо него берётся значение по умолчанию. Вторая — /health прямо
   говорит, что переменная заполнена неверно, чтобы это чинили, а не
   гадали, почему не работает.

   Идеально это не ловит и не может: ключ — просто строка. Но
   перекрывает те формы, которые встречаются у Groq, Gemini, OpenAI и
   Zhipu, и главное — закрывает вывод наружу. */
function looksLikeSecret(v) {
  const s = String(v || '');
  if (!s) return false;
  /* Адрес площадки длиннее сорока символов и под правило длины попадал —
     на этом моя же проверка и споткнулась на первом прогоне. */
  if (/^https?:\/\//i.test(s)) return false;
  if (s.length > 40) return true;                 /* имена моделей короче */
  if (/^(gsk_|sk-|AIza|xai-|Bearer\s)/i.test(s)) return true;
  if (/^[0-9a-f]{16,}\./i.test(s)) return true;    /* Zhipu: id.secret */
  return false;
}

/* Имя модели для ответа наружу: подозрительное — прячем. */
function safeModelName(v) {
  if (!v) return null;
  return looksLikeSecret(v) ? '(скрыто: значение похоже на ключ, а не на имя модели)' : v;
}

/* Имя модели для запроса: подозрительное — берём значение по умолчанию,
   иначе запрос заведомо уйдёт в никуда с ключом в поле model. */
function modelCfg(env, name) {
  const v = strCfg(env, name);
  return looksLikeSecret(v) ? DEFAULTS[name] : v;
}

function visionProvider(env) {
  if (env.GLM_API_KEY) return 'glm';
  if (env.GEMINI_API_KEY) return 'gemini';
  return null;
}

async function callVision(env, base64, mime, prompt) {
  const who = visionProvider(env);
  if (who === 'glm') return callGlmVision(env, base64, mime, prompt);
  if (who === 'gemini') return callGeminiVision(env, base64, mime, prompt);
  return { error: 'Не задан ключ для распознавания фото. Выполните: npx wrangler secret put GLM_API_KEY' };
}

async function callGeminiVision(env, base64, mime, prompt) {
  const model = modelCfg(env, 'GEMINI_MODEL');
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

  const res = await callModel(env, system, user);
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

/* Вызов функции в базе ОТ ИМЕНИ УЧЕНИКА, его же токеном.

   Зачем отдельно от supaRpc: homework_try_consume берёт личность из
   auth.uid(). Под сервисным ключом auth.uid() пуст, и функция сочла
   бы вызывающего анонимом. Поэтому сюда идёт токен ученика.

   Подменить себя этим нельзя: токен проверяет Supabase, а лимит
   зашит внутри функции и параметром не передаётся. */
async function supaRpcAsUser(env, token, fn, args) {
  const r = await fetch(supaUrl(env) + '/rest/v1/rpc/' + fn, {
    method: 'POST',
    headers: {
      apikey: supaKey(env),
      Authorization: 'Bearer ' + token,
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
   Два шага: Gemini читает рукописный текст, Groq оценивает
   прочитанное от лица выбранного учителя.

   Распознанный текст возвращается ученику ОБЯЗАТЕЛЬНО и отдельно от
   оценки. Это не деталь интерфейса: распознавание детского почерка
   ошибается, и когда оценка выглядит несправедливой, первое, что надо
   увидеть, — что именно модель приняла за написанное. Без этого
   ученик спорит с оценкой вслепую. */
/* ---------- /check-homework: разбор домашки по фото ----------

   СЕАНС

   Одно нажатие «проверить» — один сеанс. В сеансе от 1 до 5 фото
   бесплатно и до 20 у VIP. Бесплатно — один сеанс в день на предмет,
   день считается по местному времени ученика. Всё это решает база
   (homework_try_consume), здесь — только подготовка и передача.

   ПОЧЕМУ ФОТО ПРИХОДЯТ ПУТЯМИ, А НЕ КАРТИНКАМИ

   Замер: на бесплатном тарифе Workers лимит 10 мс процессора, а
   разбор и пересборка JSON с фотографиями стоят 16 мс для пяти фото
   обычного размера и 85–350 мс для двадцати. Worker обрывался бы.
   Поэтому страница кладёт фото в хранилище Supabase (бакет homework,
   папка ученика), а сюда присылает пути. Здесь пути превращаются в
   подписанные ссылки, и модель скачивает картинки сама. Процессора
   на это уходит доли миллисекунды.

   Побочный плюс: международная документация Z.AI показывает
   картинки только ссылками, про base64 там не сказано ничего.
   Ссылки — путь, который описан.

   ОДИН ЗАПРОС К МОДЕЛИ

   Все фото уходят одним chat/completions: текст задания и дальше
   картинки, каждая с подписью «Фото N». Подписи нужны, чтобы модель
   не путала, какая задача где, когда отвечает по номерам.

   Проверку делает только GLM. Gemini не умеет брать картинки по
   произвольной ссылке, а скачивать и перекодировать их здесь — ровно
   та работа процессора, от которой мы уходим. */

const HOMEWORK_BUCKET = 'homework';
const HOMEWORK_MAX_PHOTOS = 20;          /* жёсткий потолок до похода в базу */

const HOMEWORK_SUBJECTS = {
  physics: {
    ru: 'физике', en: 'physics',
    extraRu: 'Для физики отдельно проверь единицы измерения и размерность: сходится ли размерность в каждой формуле, ' +
             'переведены ли величины в СИ, не потеряны ли множители. Если формула применена не к тому случаю — скажи, к какому она применима.',
    extraEn: 'For physics, check units and dimensional analysis, SI conversion, and whether each formula fits the case.'
  },
  algebra: {
    ru: 'алгебре', en: 'algebra',
    extraRu: 'Для алгебры проверяй ХОД решения, а не только итоговый ответ. Укажи конкретную строку, где переход неверен, ' +
             'и почему. Если ответ случайно совпал, а решение неправильное — так и скажи.',
    extraEn: 'For algebra, check the steps, not only the final answer. Point at the exact line where a step is wrong.'
  },
  other: { ru: 'этому предмету', en: 'this subject', extraRu: '', extraEn: '' }
};

function homeworkSubject(raw) {
  const k = String(raw || '').toLowerCase().trim();
  return HOMEWORK_SUBJECTS[k] ? k : 'other';
}

/* Промпт — по заданию, с одной правкой по смыслу. В задании было
   «На фото N задач», где N — число фото. Но на одном фото бывает три
   задачи, а одна задача бывает на двух фото, и модель получала бы
   заведомо неверное число. Поэтому говорим о N ФОТО, а нумеровать
   просим задачи. */
function homeworkPrompt(subjectKey, lang, taskText, n) {
  const s = HOMEWORK_SUBJECTS[subjectKey];
  if (lang === 'en') {
    return `There are ${n} photo(s) with solutions to ${s.en} problems. Check each problem separately.\n` +
      'Structure the answer by number: Problem 1: …, Problem 2: …\n' +
      'For each problem: solve it yourself, compare with the student\'s solution, and state 1) what is correct, ' +
      '2) where the mistake is, 3) the correct answer with an explanation.\n' +
      'If one photo holds several problems or one problem continues on the next photo, number problems, not photos.\n' +
      'Be brief and friendly.' + (s.extraEn ? '\n' + s.extraEn : '') +
      (taskText ? '\n\nThe task as the teacher set it: ' + taskText : '') +
      '\n\nIf a photo is unreadable, say which one and do not guess its content.';
  }
  return `Прислано фото: ${n}. На них решения задач по ${s.ru}. Проверь каждую задачу отдельно.\n` +
    'Ответ структурируй по номерам: Задача 1: …, Задача 2: …\n' +
    'Для каждой задачи: реши её сам, сравни с решением ученика и укажи 1) что верно, 2) где ошибка, ' +
    '3) правильный ответ с пояснением.\n' +
    'Если на одном фото несколько задач или одна задача продолжается на следующем фото — нумеруй задачи, а не фото.\n' +
    'Пиши кратко, дружелюбно, на русском.' + (s.extraRu ? '\n' + s.extraRu : '') +
    (taskText ? '\n\nЗадание, которое дал учитель: ' + taskText : '') +
    /* Без этого модель охотно «дорисовывает» неразборчивое. */
    '\n\nЕсли какое-то фото нечитаемое — скажи, какое именно, и не придумывай, что на нём.';
}

/* Потолок ответа растёт с числом фото: на двадцать задач по-другому
   не хватит, и разбор обрывался бы на середине. Верх — 8000 токенов:
   документация даёт glm-4.6v-flash до 32K, но ждать такой ответ
   ученику пришлось бы минутами. */
function homeworkMaxTokens(n) {
  return Math.min(8000, 700 + 550 * n);
}

async function callGlmVisionUrls(env, urls, prompt, maxTokens) {
  const model = modelCfg(env, 'GLM_MODEL');
  const url = strCfg(env, 'GLM_API_URL');

  const content = [{ type: 'text', text: prompt }];
  urls.forEach((u, i) => {
    content.push({ type: 'text', text: 'Фото ' + (i + 1) });
    content.push({ type: 'image_url', image_url: { url: u } });
  });

  let r;
  try {
    r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GLM_API_KEY },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: maxTokens,
        messages: [{ role: 'user', content }] })
    });
  } catch (e) {
    return { error: 'GLM недоступен: ' + e.message };
  }
  if (!r.ok) {
    const text = await r.text();
    return { error: glmHint(r.status, model, url), detail: text.slice(0, 300) };
  }
  const data = await r.json();
  const c = data?.choices?.[0]?.message?.content;
  const text = (Array.isArray(c)
    ? c.map(x => (typeof x === 'string' ? x : x?.text || '')).join('')
    : String(c || '')).trim();
  if (!text) return { error: 'GLM не прислал разбор.' };
  /* Упёрлись в потолок токенов — разбор оборван. Лучше сказать об
     этом, чем выдать ученику половину как целое. */
  const cut = data?.choices?.[0]?.finish_reason === 'length';
  return { text, truncated: cut };
}

/* ---------- хранилище ---------- */

async function storageSign(env, paths, seconds) {
  const r = await fetch(`${supaUrl(env)}/storage/v1/object/sign/${HOMEWORK_BUCKET}`, {
    method: 'POST',
    headers: { apikey: supaKey(env), Authorization: 'Bearer ' + supaKey(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: seconds, paths })
  });
  if (!r.ok) return { error: 'хранилище ' + r.status, detail: (await r.text()).slice(0, 200) };
  const list = await r.json();
  const byPath = {};
  (Array.isArray(list) ? list : []).forEach(x => { if (x && x.path) byPath[x.path] = x; });
  const urls = [];
  for (const p of paths) {
    const x = byPath[p];
    /* signedURL приходит относительным: /object/sign/… — так же его
       достраивает официальный клиент Supabase. */
    if (!x || x.error || !x.signedURL) return { error: 'фото не найдено в хранилище: ' + p };
    urls.push(encodeURI(`${supaUrl(env)}/storage/v1${x.signedURL}`));
  }
  return { urls };
}

async function storageRemove(env, paths) {
  if (!paths.length) return;
  try {
    await fetch(`${supaUrl(env)}/storage/v1/object/${HOMEWORK_BUCKET}`, {
      method: 'DELETE',
      headers: { apikey: supaKey(env), Authorization: 'Bearer ' + supaKey(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths })
    });
  } catch (e) { /* не удалось убрать — не повод ронять разбор */ }
}

/* Фоновая работа: пусть идёт после ответа ученику, если платформа
   это умеет; иначе — дождёмся. */
function later(ctx, promise) {
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(promise);
  else return promise;
}

async function handleHomework(body, env, origin, request, ip, ctx) {
  const lang = body.lang === 'en' ? 'en' : 'ru';
  const t = (ru, en) => (lang === 'en' ? en : ru);

  if (!env.GLM_API_KEY) {
    return json({ error: t('Для проверки нескольких фото нужен ключ GLM. Выполните: npx wrangler secret put GLM_API_KEY',
      'A GLM key is required. Run: npx wrangler secret put GLM_API_KEY') }, 500, origin, env);
  }
  if (!supaReady(env)) {
    return json({ error: t('Хранилище фото не настроено: нужны SUPABASE_URL и SUPABASE_SERVICE_KEY.',
      'Photo storage is not configured.') }, 500, origin, env);
  }

  const subject = homeworkSubject(body.subject);
  /* Пояс проверяет база по списку поясов; здесь только отсекаем мусор,
     чтобы не гонять его туда. Неизвестный пояс база превратит в UTC. */
  const tz = /^[A-Za-z0-9_+\-\/]{1,64}$/.test(String(body.tz || '')) ? String(body.tz) : 'UTC';

  /* --- кто --- */
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const me = await whoAmI(request, env);
  if (!me) {
    return json({ error: t('Войдите, чтобы отправить домашку на проверку: бесплатный лимит считается на ученика.',
      'Sign in to have your homework checked.'), reason: 'anonymous' }, 401, origin, env);
  }

  /* --- какие фото ---
     Каждый путь обязан лежать в папке этого ученика. Проверка
     обязательная: ссылки подписываются сервисным ключом, который
     видит всё хранилище, и без неё ученик мог бы отправить на разбор
     чужие фото, просто указав их путь. */
  const raw = Array.isArray(body.paths) ? body.paths : [];
  const prefix = me.id + '/';
  const paths = raw.filter(p => typeof p === 'string');
  const pathOk = p => p.startsWith(prefix) && p.length < 300 && !p.includes('..') &&
    /^[A-Za-z0-9._\-\/]+$/.test(p);

  if (!paths.length) {
    return json({ error: t('Нет фото для проверки.', 'No photos to check.'), reason: 'no_photos' }, 400, origin, env);
  }
  if (paths.length > HOMEWORK_MAX_PHOTOS || paths.length !== raw.length || !paths.every(pathOk)) {
    return json({ error: t('Неверный список фото.', 'Invalid photo list.'), reason: 'bad_paths' }, 400, origin, env);
  }

  /* --- сеанс --- */
  const res = await supaRpcAsUser(env, token, 'homework_try_consume',
    { p_subject: subject, p_photos: paths.length, p_tz: tz });
  if (res.error) {
    return json({ error: t('Не удалось проверить лимит: ', 'Could not check the limit: ') + res.error,
      detail: res.detail }, 502, origin, env);
  }
  const q = res.data || {};
  if (!q.allowed) {
    /* Фото уже лежат в хранилище, а разбора не будет — убираем. */
    const cleanup = storageRemove(env, paths);
    const reply = {
      reason: q.reason, subject, vip: !!q.vip,
      photo_limit: q.photo_limit, day_limit: q.day_limit, used: q.used
    };
    if (q.reason === 'limit') {
      reply.error = t('Бесплатно — 1 проверка в день по каждому предмету. Оформи подписку для безлимита.',
        'Free plan: one check per subject per day. Subscribe for unlimited.');
      reply.paywall = true;
      await later(ctx, cleanup);
      return json(reply, 402, origin, env);
    }
    if (q.reason === 'too_many_photos') {
      reply.error = q.vip
        ? t(`В одном сеансе — не больше ${q.photo_limit} фото.`, `At most ${q.photo_limit} photos per check.`)
        : t(`Бесплатно — до ${q.photo_limit} фото за раз. В VIP — до 20.`, `Free: up to ${q.photo_limit} photos. VIP: up to 20.`);
      reply.paywall = !q.vip;
      await later(ctx, cleanup);
      return json(reply, q.vip ? 400 : 402, origin, env);
    }
    reply.error = t('Проверка не разрешена.', 'Check not allowed.');
    await later(ctx, cleanup);
    return json(reply, 403, origin, env);
  }

  /* Вернуть сеанс, если разбор не состоялся не по вине ученика.
     День берём тот, что вернула база при списании, — см. комментарий
     к homework_refund: за время разбора могла наступить полночь. */
  const refund = () => supaRpc(env, 'homework_refund',
    { p_user: me.id, p_subject: subject, p_day: q.local_day, p_photos: paths.length }).catch(() => {});

  const signed = await storageSign(env, paths, 600);
  if (signed.error) {
    await refund();
    await later(ctx, storageRemove(env, paths));
    return json({ error: t('Не удалось подготовить фото: ', 'Could not prepare photos: ') + signed.error },
      502, origin, env);
  }

  const taskText = cut(body.taskText, 800);
  const out = await callGlmVisionUrls(env, signed.urls,
    homeworkPrompt(subject, lang, taskText, paths.length), homeworkMaxTokens(paths.length));

  /* Фото больше не нужны ни при успехе, ни при сбое. */
  const cleanup = storageRemove(env, paths);

  if (out.error) {
    await refund();
    await later(ctx, cleanup);
    return json({ error: out.error, detail: out.detail }, 502, origin, env);
  }

  /* История. Колонки — как в schema-photo-limits.sql: ai_feedback и
     status. В прошлой версии здесь стояли task_text и result_text,
     которых в таблице нет; запись молча падала, и история не
     сохранялась вовсе. */
  const history = supaInsert(env, 'photo_checks', {
    user_id: me.id, subject, ai_feedback: out.text.slice(0, 8000), status: out.truncated ? 'truncated' : 'ok'
  });
  await later(ctx, Promise.all([cleanup, history]));

  return json({
    ok: true, subject, photos: paths.length, text: out.text, truncated: !!out.truncated,
    quota: { used: q.used, day_limit: q.day_limit, photo_limit: q.photo_limit, vip: !!q.vip, local_day: q.local_day }
  }, 200, origin, env);
}

async function handlePhoto(body, env, origin, request, ip) {
  if (!visionProvider(env)) {
    return json({ error: 'Не задан ключ для распознавания фото. Выполните: npx wrangler secret put GLM_API_KEY (бесплатная модель) или GEMINI_API_KEY.' }, 500, origin, env);
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

  const ocr = await callVision(env, b64, mime, ocrPrompt);
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

  const res = await callModel(env, system, user, {
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

  const res = await callModel(env, system, user, { maxTokens: 220, temperature: 0.4 });
  if (res.error) return json(res, 502, origin, env);
  return json({ explanation: res.content }, 200, origin, env);
}


/* ---------- /grade-essay: проверка сочинения ----------

   Отличается от /explain не длиной, а тем, что здесь оценка. Поэтому
   три решения.

   Первое: разбор идёт ПО КРИТЕРИЯМ, а не одной оценкой. «4» без
   объяснения не говорит ученику ничего и спорить с ней нельзя; по
   критериям видно, где именно потеряно и что править.

   Второе: цитата обязательна. Модель должна показать фрагмент, к
   которому относится замечание, — иначе «есть речевые ошибки»
   невозможно проверить, и ученику остаётся верить на слово.

   Третье: сочинение не переписывается за ученика. Модели свойственно
   выдать «вот как надо», и это ровно тот случай, когда помощь вредна:
   готовый текст можно сдать, ничему не научившись. Поэтому в промпте
   прямой запрет, а в ответе есть next_step — что сделать самому.
   ============================================================ */
async function handleEssay(body, env, origin) {
  const lang = body.lang === 'en' ? 'en' : 'ru';
  const text = cut(body.text, numCfg(env, 'MAX_ESSAY_CHARS'));
  if (!text.trim()) return json({ error: 'empty essay' }, 400, origin, env);

  const topic = cut(body.topic, 300);
  const subject = cut(body.subject, 60) || (lang === 'ru' ? 'русский язык' : 'language');
  const kind = cut(body.kind, 40);          /* сочинение, изложение, эссе, letter… */
  const strictness = Math.min(5, Math.max(1, Number(body.strictness) || 3));

  /* Критерии можно прислать свои (у разных экзаменов они разные).
     Если не прислали — берём школьные по умолчанию. */
  const DEFAULT_CRITERIA = lang === 'ru'
    ? ['соответствие теме', 'логика и композиция', 'аргументация и примеры',
       'речевое оформление', 'грамотность']
    : ['relevance to the topic', 'structure and logic', 'argument and examples',
       'style and word choice', 'accuracy'];
  const criteria = (Array.isArray(body.criteria) && body.criteria.length
    ? body.criteria.slice(0, 8).map(c => cut(c, 80))
    : DEFAULT_CRITERIA);

  const p = persona(body.teacher, lang);
  const strictNote = (STRICT[strictness] || STRICT[3])[lang];

  const system = (p ? p + '\n\n' : '') + (lang === 'ru'
    ? `Ты проверяешь письменную работу школьника по предмету «${subject}»${kind ? ` (${kind})` : ''}.\n${strictNote}\n` +
      'Оценивай по каждому критерию отдельно и подкрепляй КАЖДОЕ замечание цитатой из работы — дословным фрагментом, а не пересказом.\n' +
      'НЕ переписывай работу за ученика и не давай готовых формулировок для вставки: покажи, что не так и почему, но исправляет пусть он сам.\n' +
      'Не выдумывай того, чего в тексте нет. Верни СТРОГО JSON без markdown и пояснений вокруг.'
    : `You are marking a student's written work in "${subject}"${kind ? ` (${kind})` : ''}.\n${strictNote}\n` +
      'Assess each criterion separately and back EVERY remark with a verbatim quotation from the work, not a paraphrase.\n' +
      'Do NOT rewrite the work for the student and do not supply ready-made sentences to paste in: show what is wrong and why, but let them fix it.\n' +
      'Do not invent anything absent from the text. Return STRICT JSON, no markdown, no commentary around it.');

  const shape = '{"grade":1-5,"criteria":[{"name":"...","score":1-5,"comment":"..."}],' +
                '"strengths":["..."],"issues":[{"quote":"...","problem":"...","why":"..."}],' +
                '"overall_feedback":"...","next_step":"..."}';

  const user = (lang === 'ru'
    ? (topic ? `Тема: ${topic}\n\n` : '') +
      `Критерии оценивания: ${criteria.join('; ')}\n\n` +
      `Текст работы:\n"""\n${text}\n"""\n\n` +
      `Оцени работу по каждому критерию и в целом по пятибалльной шкале. Формат ответа: ${shape}`
    : (topic ? `Topic: ${topic}\n\n` : '') +
      `Marking criteria: ${criteria.join('; ')}\n\n` +
      `The work:\n"""\n${text}\n"""\n\n` +
      `Assess it against each criterion and overall on a 1-5 scale. Reply shape: ${shape}`);

  const res = await callModel(env, system, user, {
    maxTokens: numCfg(env, 'MAX_TOKENS_ESSAY'),
    jsonMode: true,
    temperature: 0.2
  });
  if (res.error) return json(res, 502, origin, env);

  const parsed = parseJsonLoose(res.content);
  if (!parsed) {
    return json({ error: 'Модель вернула ответ, который не удалось разобрать как JSON.' }, 502, origin, env);
  }

  const clampScore = v => Math.min(5, Math.max(1, Number(v) || 3));

  return json({
    grade: clampScore(parsed.grade),
    criteria: Array.isArray(parsed.criteria)
      ? parsed.criteria.slice(0, 8).map(c => ({
          name: cut(c && c.name, 80),
          score: clampScore(c && c.score),
          comment: cut(c && c.comment, 500)
        }))
      : [],
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 8).map(x => cut(x, 300)) : [],
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.slice(0, 20).map(i => ({
          quote: cut(i && i.quote, 300),
          problem: cut(i && i.problem, 300),
          why: cut(i && i.why, 400)
        }))
      : [],
    overall_feedback: cut(parsed.overall_feedback, 1500),
    next_step: cut(parsed.next_step, 400),
    chars: text.length
  }, 200, origin, env);
}


/* ============================================================
   Точка входа
   ============================================================ */
return {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin, env) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return json({
        ok: true,
        service: 'skyschool-ai',
        hasKey: !!env.GROQ_API_KEY,
        hasVision: !!visionProvider(env),
        visionProvider: visionProvider(env),
        hasQuotas: supaReady(env),
        endpoints: ['/explain', '/check-photo', '/check-homework', '/chess-explain', '/grade-essay'],
        models: {
          text: safeModelName(strCfg(env, 'GROQ_MODEL')),
          vision: safeModelName(visionProvider(env) === 'gemini'
            ? strCfg(env, 'GEMINI_MODEL')
            : strCfg(env, 'GLM_MODEL'))
        },
        /* Пустой список — всё в порядке. Иначе здесь названы переменные,
           в которые попало похожее на ключ значение: их надо исправить,
           а сам ключ считать засвеченным и выпустить заново. */
        misconfigured: ['GROQ_MODEL', 'GLM_MODEL', 'GEMINI_MODEL', 'GLM_API_URL']
          .filter(n => looksLikeSecret(strCfg(env, n))),
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
      '/check-homework': handleHomework,
      '/chess-explain': handleChessExplain,
      '/grade-essay': handleEssay
    };
    const handler = routes[url.pathname];
    if (!handler) return json({ error: 'not found' }, 404, origin, env);
    if (request.method !== 'POST') return json({ error: 'use POST' }, 405, origin, env);

    if (origin && !originList(env).includes(origin)) {
      return json({ error: 'origin not allowed' }, 403, origin, env);
    }

    if (!env.GROQ_API_KEY) {
      return json({ error: 'Ключ Groq не задан в настройках Worker. Выполните: npx wrangler secret put GROQ_API_KEY' }, 500, origin, env);
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
      return await handler(body, env, origin, request, ip, ctx);
    } catch (e) {
      return json({ error: 'Не удалось связаться с моделью: ' + e.message }, 502, origin, env);
    }
  }
};
})();
/* <<< worker/worker.js */
