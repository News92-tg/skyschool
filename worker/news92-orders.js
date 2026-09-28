/* ============================================================
   SkyySchool — Worker news92-orders
   https://news92-orders.almazpro0927.workers.dev

   Это НЕ worker.js из этой же папки: тот — прежний прокси
   (skyschool-ai), а этот файл — то, что развёрнуто под именем
   news92-orders и на что смотрит assets/config.js → AI_BASE.
   Разворачивается вставкой в Cloudflare → Workers → news92-orders
   → Edit code, или через wrangler.

   Эндпоинты:
     GET  / , /health                — жив ли Worker (без изменений)
     GET|POST /api/check-text        — сочинение, Groq llama-3.1-8b-instant.
                                       Длинный текст — только POST (JSON):
                                       в адресе Cloudflare держит до 16 КБ.
     GET  /api/check-photo?img=      — проверка фото (Z.AI). Без новых
                                       параметров — прежнее поведение.
     GET  /api/limits                — тариф и остаток запросов
     POST /api/check-test            — тест: эталон + работы учеников
     POST /api/check-teacher-report  — класс: по фото на ученика, CSV
     POST /api/submit-homework       — ученик отправляет работу по ссылке
     GET  /api/homework/:id          — работа по ссылке
     POST /api/payments              — заявка на оплату (заглушка)

   Секреты (Cloudflare → Worker → Settings → Variables and Secrets):
     ZAI_API_KEY           — Z.AI, фото (уже задан)
     GROQ_API_KEY          — Groq, проверка текста (уже задан)
     SUPABASE_URL          — https://gtznaybjvqwhbybhxwjq.supabase.co
     SUPABASE_ANON_KEY     — publishable/anon: проверка входа ученика
     SUPABASE_SERVICE_KEY  — secret/service_role: лимиты, история,
                             хранилище. Только здесь, никогда во фронте.
   Необязательные переменные:
     ZAI_MODEL             — по умолчанию glm-4.6v-flash
     SITE_URL              — по умолчанию https://news92-tg.github.io/skyschool/

   Без SUPABASE_* Worker тоже работает: все считаются бесплатными,
   лимиты — в памяти по IP, история не пишется.

   Нужны миграции sql/schema-tariffs.sql и sql/schema-text-check.sql
   (функции sky_*).
   ============================================================ */

const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const DEFAULT_MODEL = "glm-4.6v-flash";
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

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
        endpoints: ["/api/check-text", "/api/check-photo"]
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
        const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.ZAI_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "glm-4.6v-flash",
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
      if (url.pathname === "/api/check-teacher-report") return await handleTeacherReport(request, env, ctx);
      if (url.pathname === "/api/submit-homework") return await handleSubmit(request, env, url);
      if (url.pathname === "/api/payments") return await handlePayment(request, env);
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

const PHOTO_PARAMS = ["mode", "subject", "grade", "grade_text", "length", "accuracy", "total", "task"];
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
  const send = withFormat => fetch(ZAI_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.ZAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.ZAI_MODEL || DEFAULT_MODEL,
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
    task: String(get("task") || "").trim().slice(0, 800)
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
  if (!rate.allowed) return tooMany(rate, plan);

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

async function handleCheckTest(request, env, ctx) {
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
    const csv_url = csvDataUrl(["ФИО", "Класс", "Верно", "Всего", "Процент", "Ошибки"],
      students.map(s => [s.name, s.class, s.status === "ok" ? s.correct : "", s.status === "ok" ? s.total : "",
        s.status === "ok" ? s.percent : "", s.status === "ok" ? s.errors.map(e => `№${e.n}: ${e.student} → ${e.correct}`).join("; ") : s.error]));

    const out = { reference, students, summary, tokens_used: usage, csv_url };
    await logCheck(env, who, body.reference_img, { subject, mode: "test", length: null },
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
      photos: 1
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
            assessment: o.grade ? r.assessment : undefined,
            assessment_reason: r.assessment_reason,
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
    const csv_url = csvDataUrl(["ФИО", "Класс", "Оценка", "Комментарий", "Ошибок"],
      reports.map(r => [r.name, r.class,
        r.status === "ok" ? (r.assessment == null ? "" : r.assessment) : "",
        r.status === "ok" ? r.comment : "Не проверено: " + r.error,
        r.status === "ok" ? r.errors_count : ""]));

    // Работы по ссылкам: отметить проверенные.
    const items = reports.filter(r => r.submission_id).map(r => ({
      id: r.submission_id,
      status: r.status === "ok" ? "checked" : "failed",
      result: r.status === "ok"
        ? { assessment: r.assessment, assessment_reason: r.assessment_reason, errors: r.errors, comment: r.comment }
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

async function handlePayment(request, env) {
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
  return json({ id: row && row.id, status: "pending", amount, purpose: body.purpose, message: "Оплата скоро" }, 201);
}
