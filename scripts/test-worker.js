/* ============================================================
   Тесты Worker news92-orders (worker/news92-orders.js)

   Запуск:  node scripts/test-worker.js

   Сеть не нужна: Supabase (Auth, RPC sky_*, REST, Storage), Z.AI и
   Groq подменены в памяти. Подмена sky_rate повторяет логику функции из
   sql/schema-tariffs.sql — саму функцию проверяет scripts/test-rls.sh.
   ============================================================ */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.join(__dirname, '..', 'worker', 'news92-orders.js');
const SB = 'https://sb.test';
const ZAI = 'https://api.z.ai/api/paas/v4/chat/completions';
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const USERS = { 'jwt-premium': 'u-premium', 'jwt-paid': 'u-paid', 'jwt-free': 'u-free' };
const PLANS = {
  free:    { plan: 'free', title: 'Free', price_rub: 0, requests_per_window: 1, window_seconds: 600, photos_per_request: 5, compare: false, teacher: false, plagiarism: false, expires_at: null },
  paid:    { plan: 'paid', title: 'Платный', price_rub: 59, requests_per_window: 1, window_seconds: 60, photos_per_request: 10, compare: true, teacher: false, plagiarism: false, expires_at: null },
  premium: { plan: 'premium', title: 'Премиум', price_rub: 209, requests_per_window: 3, window_seconds: 60, photos_per_request: 20, compare: true, teacher: true, plagiarism: true, expires_at: null }
};
const PLAN_OF = { 'u-premium': 'premium', 'u-paid': 'paid' };

let failed = 0, passed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('ok    ' + name); }
  else { failed++; console.log('FAIL  ' + name + (extra ? '\n        ' + extra : '')); }
}

/* ---------- подмена сети ---------- */
let zaiQueue = [], zaiSent = [], sbCalls = [], windows = new Map(), storage = new Map(), rows = new Map(), payments = [];
let groqQueue = [], groqSent = [], textLog = [];

function reset() {
  zaiQueue = []; zaiSent = []; sbCalls = []; windows = new Map(); storage = new Map(); rows = new Map(); payments = [];
  groqQueue = []; groqSent = []; textLog = [];
}
const zaiOk = (content, usage) => ({ status: 200, body: JSON.stringify({
  choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }],
  usage: usage || { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
}) });
const GROQ_HEADERS = { 'x-ratelimit-remaining-requests': '14399', 'x-ratelimit-remaining-tokens': '5000',
  'x-ratelimit-reset-requests': '6s', 'x-ratelimit-reset-tokens': '7.66s' };
const groqOk = (content, usage, finish) => ({ status: 200, headers: GROQ_HEADERS, body: JSON.stringify({
  choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: finish || 'stop' }],
  usage: usage || { prompt_tokens: 700, completion_tokens: 300, total_tokens: 1000 }
}) });
const groqErr = (status, headers, error) => ({ status, headers: Object.assign({}, GROQ_HEADERS, headers || {}),
  body: JSON.stringify({ error: error || { message: 'x', type: 'x', code: String(status) } }) });
const zaiErr = (status, code) => ({ status, body: JSON.stringify({ error: { code: code || String(status), message: 'x' } }) });

function skyRate(a) {
  const key = (a.p_user || 'ip:' + a.p_ip) + '|' + a.p_scope;
  const now = Date.now();
  let w = windows.get(key);
  if (w && now - w.start >= a.p_window * 1000) w = null;
  let count = w ? w.count : 0;
  const reset = w ? Math.max(1, Math.ceil((w.start + a.p_window * 1000 - now) / 1000)) : 0;
  if (a.p_delta > 0) {
    if (count + a.p_delta > a.p_max) return [{ allowed: false, remaining: Math.max(a.p_max - count, 0), retry_after: reset, reset_in: reset }];
    if (!w) { w = { start: now, count: 0 }; windows.set(key, w); }
    w.count += a.p_delta; count = w.count;
    const r = Math.max(1, Math.ceil((w.start + a.p_window * 1000 - now) / 1000));
    return [{ allowed: true, remaining: Math.max(a.p_max - count, 0), retry_after: count >= a.p_max ? r : 0, reset_in: r }];
  }
  if (a.p_delta < 0 && w) { w.count = Math.max(w.count + a.p_delta, 0); count = w.count; }
  return [{ allowed: count < a.p_max, remaining: Math.max(a.p_max - count, 0), retry_after: count >= a.p_max ? reset : 0, reset_in: reset }];
}

const J = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json' } });

globalThis.fetch = async (input, init) => {
  const url = String(input);
  init = init || {};
  if (url === ZAI) {
    const body = JSON.parse(init.body);
    zaiSent.push(body);
    const next = zaiQueue.shift();
    if (!next) throw new Error('Z.AI: нет подготовленного ответа');
    if (next.hang) return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))));
    if (typeof next === 'function') return next(body);
    return new Response(next.body, { status: next.status });
  }
  if (url === GROQ) {
    const body = JSON.parse(init.body);
    groqSent.push({ body, headers: init.headers, at: Date.now() });
    const next = groqQueue.shift();
    if (!next) throw new Error('Groq: нет подготовленного ответа');
    return new Response(next.body, { status: next.status, headers: next.headers || {} });
  }
  if (url.startsWith(SB)) {
    const p = url.slice(SB.length);
    const headers = init.headers || {};
    sbCalls.push({ path: p, method: init.method || 'GET', headers, body: init.body });
    if (p === '/auth/v1/user') {
      const token = (headers.Authorization || '').replace('Bearer ', '');
      return USERS[token] ? J({ id: USERS[token] }) : J({ msg: 'bad jwt' }, 401);
    }
    if (headers.apikey !== 'svc-key') return J({ message: 'no apikey' }, 401);
    if (p === '/rest/v1/rpc/sky_plan') {
      const u = JSON.parse(init.body).p_user;
      return J([PLANS[PLAN_OF[u] || 'free']]);
    }
    if (p === '/rest/v1/rpc/sky_rate') return J(skyRate(JSON.parse(init.body)));
    if (p === '/rest/v1/rpc/sky_log_check') return J('log-id');
    if (p === '/rest/v1/rpc/sky_text_cache') {
      const a = JSON.parse(init.body);
      const hit = textLog.filter(r => r.p_text_hash && r.p_text_hash === a.p_hash).pop();
      return J(hit ? [{ result: hit.p_result, created_at: 'now' }] : []);
    }
    if (p === '/rest/v1/rpc/sky_log_text') { textLog.push(JSON.parse(init.body)); return J('log-id'); }
    if (p === '/rest/v1/rpc/sky_submissions_update') return J(JSON.parse(init.body).p_items.length);
    if (p.startsWith('/storage/v1/object/sign/homework/')) {
      return J({ signedURL: '/object/sign/homework/' + p.slice('/storage/v1/object/sign/homework/'.length) + '?token=t' });
    }
    if (p.startsWith('/storage/v1/object/homework/') && init.method === 'POST') {
      storage.set(p.slice('/storage/v1/object/homework/'.length), { type: headers['Content-Type'], bytes: init.body });
      return J({ Key: 'homework/x' });
    }
    if (p === '/storage/v1/object/homework' && init.method === 'DELETE') {
      JSON.parse(init.body).prefixes.forEach(k => storage.delete(k));
      return J([]);
    }
    if (p === '/rest/v1/homework_submissions' && init.method === 'POST') {
      const r = JSON.parse(init.body);
      rows.set(r.id, Object.assign({ status: 'pending', result: null, created_at: 'now' }, r));
      return new Response(null, { status: 201 });
    }
    if (p.startsWith('/rest/v1/homework_submissions?id=eq.')) {
      const id = p.match(/id=eq\.([^&]+)/)[1];
      const r = rows.get(id);
      return J(r ? [{ id: r.id, student_name: r.student_name, class: r.class, subject: r.subject, img_url: r.img_url, status: r.status, result: r.result, created_at: r.created_at }] : []);
    }
    if (p.startsWith('/rest/v1/plan_limits?plan=eq.')) {
      const plan = p.match(/plan=eq\.([a-z]+)/)[1];
      return J(PLANS[plan] ? [{ price_rub: PLANS[plan].price_rub }] : []);
    }
    if (p === '/rest/v1/payments' && init.method === 'POST') {
      const r = Object.assign({ id: 'pay-' + (payments.length + 1) }, JSON.parse(init.body));
      payments.push(r);
      return J([r], 201);
    }
    return J({ message: 'unexpected ' + p }, 500);
  }
  throw new Error('Неожиданный запрос: ' + url);
};

/* ---------- вызов Worker ---------- */
let worker;
const ENV = { ZAI_API_KEY: 'zai', GROQ_API_KEY: 'groq', SUPABASE_URL: SB + '/', SUPABASE_ANON_KEY: 'anon-key', SUPABASE_SERVICE_KEY: 'svc-key' };

async function call(pathname, opts) {
  opts = opts || {};
  const waits = [];
  const headers = Object.assign({ 'CF-Connecting-IP': opts.ip || '10.0.0.1' }, opts.headers || {});
  if (opts.jwt) headers.Authorization = 'Bearer ' + opts.jwt;
  const req = new Request('https://w.test' + pathname, { method: opts.method || 'GET', headers, body: opts.body });
  const res = await worker.fetch(req, opts.env || ENV, { waitUntil: p => waits.push(p) });
  const text = await res.text();
  await Promise.all(waits);
  let body = null;
  try { body = JSON.parse(text); } catch (e) {}
  return { status: res.status, headers: res.headers, text, body };
}

const IMG = 'https://sb.test/storage/v1/object/sign/homework/u/1.jpg?token=secret';
const q = s => encodeURIComponent(s);
const full = {
  recognized_text: '2+2=5', errors: [{ type: 'вычислительная', fragment: '2+2=5', correction: '2+2=4' }, null],
  ai_solution: '2+2=4', discrepancies: ['В ответе 5 вместо 4'], assessment: '3', assessment_text: 'удовлетворительно',
  assessment_reason: 'Ошибка в ответе', confidence: 91, ai_match: 40, plagiarism_flag: false, plagiarism_reason: '',
  test: { total: 20, answers: [{ n: 1, student: 'А', correct: 'А', ok: true }, { n: 2, student: 'Б', correct: 'В', ok: false }] },
  student_name: 'Сидоров С.', student_class: '9В', comment: 'Внимательнее.'
};

async function main() {
  const tmp = path.join(os.tmpdir(), 'news92-orders-' + process.pid + '.mjs');
  fs.copyFileSync(SRC, tmp);
  worker = (await import(pathToFileURL(tmp).href)).default;
  fs.unlinkSync(tmp);

  /* ---------- прежнее поведение ---------- */
  reset();
  const zaiRaw = JSON.stringify({ choices: [{ message: { content: 'Оценка: 4' } }] });
  zaiQueue.push({ status: 200, body: zaiRaw });
  let r = await call('/api/check-photo?img=' + q(IMG));
  ok('без новых параметров — ответ Z.AI как есть', r.status === 200 && r.text === zaiRaw);
  ok('без новых параметров — прежний промт и модель, без response_format',
    zaiSent[0].model === 'glm-4.6v-flash' && !zaiSent[0].response_format && /Ты учитель\. Посмотри на фото/.test(zaiSent[0].messages[0].content));
  ok('без новых параметров — ни лимитов, ни Supabase', sbCalls.length === 0);
  zaiQueue.push(zaiErr(429, '1302'));
  r = await call('/api/check-photo?img=' + q(IMG));
  ok('без новых параметров — ошибка Z.AI по-старому со статусом 200', r.status === 200 && /1302/.test(r.text));
  r = await call('/api/check-photo');
  ok('без img — 400 как раньше', r.status === 400 && r.body.error === 'img param required');
  r = await call('/health');
  ok('/health как раньше', r.status === 200 && r.body.ok === true && r.body.service === 'skyschool-ai');
  r = await call('/');
  ok('/ — тот же health', r.status === 200 && r.body.ok === true);
  r = await call('/nope');
  ok('404 как раньше', r.status === 404 && r.body.error === 'not found');
  r = await call('/api/check-photo', { method: 'OPTIONS' });
  ok('OPTIONS — CORS', r.headers.get('Access-Control-Allow-Origin') === '*' && /Authorization/.test(r.headers.get('Access-Control-Allow-Headers')));

  /* ---------- новая проверка: бесплатный, без входа ---------- */
  reset();
  zaiQueue.push(zaiOk('<|begin_of_box|>```json\n' + JSON.stringify(full) + '\n```<|end_of_box|>'));
  r = await call('/api/check-photo?img=' + q(IMG) + '&subject=' + q('Физика') + '&task=' + q('№ 5'));
  ok('mode=check по умолчанию: поля только recognized_text, errors, comment + служебные',
    r.status === 200 && JSON.stringify(Object.keys(r.body)) === '["recognized_text","errors","comment","tokens_used","plan","rate"]', r.text);
  ok('пустые ошибки отброшены', r.body.errors.length === 1);
  ok('tokens_used из usage', r.body.tokens_used.total === 150 && r.body.tokens_used.prompt === 100);
  ok('rate после списания: 0 осталось, ждать ~600 с', r.body.rate.remaining === 0 && r.body.rate.reset_in > 590);
  const sys = zaiSent[0].messages[0].content;
  ok('промт: база, предмет и фокус, задание', /Ты школьный учитель\. Проверь работу ученика\./.test(sys) && /Предмет: физика\. Особое внимание: формулы, единицы СИ/.test(sys) && /Что было задано: № 5/.test(sys));
  ok('response_format отправлен', zaiSent[0].response_format && zaiSent[0].response_format.type === 'json_object');
  const log = sbCalls.find(c => c.path === '/rest/v1/rpc/sky_log_check');
  const logBody = log && JSON.parse(log.body);
  ok('история записана без подписи ссылки', logBody && logBody.p_img_url === 'https://sb.test/storage/v1/object/sign/homework/u/1.jpg' && logBody.p_tokens === 150 && logBody.p_subject === 'physics');
  ok('в историю не попали служебные поля', logBody && !('rate' in logBody.p_result) && !('plan' in logBody.p_result));

  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check');
  ok('второй запрос бесплатного сразу — 429 с retry_after', r.status === 429 && r.body.code === 'rate_limit' && r.body.retry_after > 590 && r.headers.get('Retry-After') === String(r.body.retry_after));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { ip: '10.0.0.2' });
  ok('другой IP не задет', r.status !== 429, r.text);

  reset();
  r = await call('/api/check-photo?' + Array(6).fill('img=' + q(IMG)).join('&'));
  ok('6 фото на бесплатном — 402, нужен Платный', r.status === 402 && r.body.need === 'paid' && /Бесплатный/.test(r.body.error));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=compare');
  ok('сверка на бесплатном — 402 need=paid', r.status === 402 && r.body.need === 'paid');
  r = await call('/api/check-photo?img=' + q(IMG) + '&accuracy=true');
  ok('списывание на бесплатном — 402 need=plagiarism', r.status === 402 && r.body.need === 'plagiarism');
  ok('отказы 402 не тратят лимит', !windows.size);
  for (const bad of ['mode=foo', 'subject=' + q('астрология'), 'grade=maybe', 'length=medium', 'total=0', 'total=abc']) {
    r = await call('/api/check-photo?img=' + q(IMG) + '&' + bad);
    ok('400 на ' + decodeURIComponent(bad), r.status === 400 && r.body.code === 'bad_param', r.text);
  }
  r = await call('/api/check-photo?img=' + q('javascript:alert(1)') + '&mode=check');
  ok('img не http(s) — 400', r.status === 400 && r.body.code === 'bad_img');
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { jwt: 'expired' });
  ok('просроченный вход — 401 session', r.status === 401 && r.body.code === 'session');

  /* ---------- Премиум: все режимы ---------- */
  reset();
  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&img=' + q(IMG) + '&mode=compare&grade=true&grade_text=true&accuracy=true&subject=algebra', { jwt: 'jwt-premium' });
  const b = r.body || {};
  ok('Премиум compare+grade+grade_text+accuracy — 200', r.status === 200, r.text);
  ok('compare: ai_solution, discrepancies (массив → строка)', b.ai_solution === '2+2=4' && b.discrepancies === 'В ответе 5 вместо 4');
  ok('grade: оценка числом и обоснование', b.assessment === 3 && b.assessment_reason === 'Ошибка в ответе');
  ok('grade_text: оценка текстом', b.assessment_text === 'удовлетворительно');
  ok('accuracy: confidence, ai_match, plagiarism_flag', b.confidence === 91 && b.ai_match === 40 && b.plagiarism_flag === false && 'plagiarism_reason' in b);
  ok('Премиум: 2 фото одной работой', zaiSent[0].messages[1].content.length === 3 && /на 2 фото/.test(zaiSent[0].messages[0].content));
  ok('ученик по JWT, лимит по пользователю', [...windows.keys()][0] === 'u-premium|check');
  const sys2 = zaiSent[0].messages[0].content;
  ok('промт: сверка, оценка «как в тетради», списывание', /Реши задания сам, затем сравни с решением ученика по шагам/.test(sys2) && /Поставь оценку\. Текстом, как в тетради\./.test(sys2) && /Оцени уверенность распознавания текста/.test(sys2));

  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&grade_text=true&length=short', { jwt: 'jwt-premium' });
  ok('grade_text без grade: есть текст, нет числа', r.body.assessment_text === 'удовлетворительно' && !('assessment' in r.body) && 'assessment_reason' in r.body);
  ok('length=short: промт «Ответь кратко»', /Ответь кратко: только список ошибок и оценка\. Без подробного разбора\./.test(zaiSent[1].messages[0].content));

  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=grade', { jwt: 'jwt-premium' });
  ok('mode=grade = check + оценка', r.body.assessment === 3 && !('ai_solution' in r.body));

  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=test&total=20', { jwt: 'jwt-premium' });
  ok('4-й запрос Премиума за минуту — 429', r.status === 429 && zaiQueue.length === 1);

  reset();
  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=test&total=20', { jwt: 'jwt-premium' });
  ok('mode=test: верно/всего/процент', r.body.test && r.body.test.total === 20 && r.body.test.correct === 1 && r.body.test.percent === 5 && r.body.test.answers.length === 2, r.text);

  zaiQueue.push(zaiOk('Оценка 3. Ошибка в задаче 1.'));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=grade', { jwt: 'jwt-premium' });
  ok('не JSON → весь текст в comment, оценка N/A', r.status === 200 && r.body.comment === 'Оценка 3. Ошибка в задаче 1.' && r.body.assessment === 'N/A');

  /* ---------- критерии оценивания ---------- */
  reset();
  const CRIT = [{ name: 'верно', weight: 1 }, { name: 'оформление', weight: 0.5 }];
  zaiQueue.push(zaiOk(Object.assign({}, full, { assessment: 2,
    criteria: [{ name: 'Оформление', score: 3, comment: 'грязно' }, { name: 'верно', score: '5', comment: '' }] })));
  r = await call('/api/check-photo?img=' + q(IMG) + '&criteria=' + q(JSON.stringify(CRIT)), { jwt: 'jwt-premium' });
  const cr = r.body || {};
  ok('критерии: 200, баллы в порядке учителя, веса на месте', r.status === 200 && cr.criteria && cr.criteria.length === 2 &&
    cr.criteria[0].name === 'верно' && cr.criteria[0].score === 5 && cr.criteria[1].score === 3 && cr.criteria[1].weight === 0.5 && cr.criteria[1].comment === 'грязно', r.text);
  ok('критерии: итог = Σ(вес×балл)/Σвесов = (5·1+3·0,5)/1,5 = 4.3', cr.score === 4.3);
  ok('критерии: оценка из итога (4.3 → 4), а не от модели (2)', cr.assessment === 4);
  ok('критерии: промт перечисляет критерии', /Оцени работу по критериям учителя: 1\) «верно»; 2\) «оформление»/.test(zaiSent[0].messages[0].content));
  const logC = sbCalls.find(c => c.path === '/rest/v1/rpc/sky_log_check');
  ok('критерии: в историю уходят criteria и score', logC && JSON.parse(logC.body).p_result.score === 4.3 && JSON.parse(logC.body).p_result.criteria.length === 2);

  zaiQueue.push(zaiOk(Object.assign({}, full, { criteria: [{ name: 'a', score: 5 }, { name: 'b', score: 4 }] })));
  r = await call('/api/check-photo?img=' + q(IMG) + '&criteria=' + q('[{"name":"a"},{"name":"b"}]'), { jwt: 'jwt-premium' });
  ok('критерии: 4.5 → 5, вес по умолчанию 1', r.body.score === 4.5 && r.body.assessment === 5 && r.body.criteria[1].weight === 1);

  zaiQueue.push(zaiOk(Object.assign({}, full, { criteria: [{ name: 'a', score: 5 }, { name: 'b', score: null }] })));
  r = await call('/api/check-photo?img=' + q(IMG) + '&criteria=' + q('[{"name":"a","weight":2},{"name":"b","weight":3}]'), { jwt: 'jwt-premium' });
  ok('критерии: без балла — в итог не входит', r.body.criteria[1].score === null && r.body.score === 5 && r.body.assessment === 5);

  reset();
  for (const [bad, why] of [['{oops', 'не JSON'], ['{"name":"a"}', 'не массив'], ['[{"name":"  "}]', 'пустые названия']]) {
    r = await call('/api/check-photo?img=' + q(IMG) + '&criteria=' + q(bad), { jwt: 'jwt-premium' });
    ok('критерии: ' + why + ' — 400 до модели', r.status === 400 && r.body.code === 'bad_param' && zaiSent.length === 0);
  }
  const many = Array.from({ length: 14 }, (_, i) => ({ name: 'к' + (i % 12), weight: i === 0 ? -5 : 50 }));
  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&criteria=' + q(JSON.stringify(many)), { jwt: 'jwt-premium' });
  ok('критерии: не больше 10, без повторов, вес ≤ 10, плохой вес → 1',
    r.body.criteria.length === 10 && r.body.criteria[0].weight === 1 && r.body.criteria[1].weight === 10 && new Set(r.body.criteria.map(c => c.name)).size === 10);
  ok('критерии: модель не оценила — итог и оценка пустые', r.body.score === null && r.body.assessment === 'N/A');

  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&grade=true', { jwt: 'jwt-premium' });
  ok('без критериев — ответ как раньше', r.body.assessment === 3 && !('criteria' in r.body) && !('score' in r.body));

  /* ---------- ошибки Z.AI ---------- */
  reset();
  zaiQueue.push(zaiErr(400, '1210'), zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { jwt: 'jwt-paid' });
  ok('400 на response_format → повтор без него', r.status === 200 && zaiSent.length === 2 && zaiSent[0].response_format && !zaiSent[1].response_format);

  reset();
  zaiQueue.push(zaiErr(429, '1302'));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { jwt: 'jwt-paid' });
  ok('429 от Z.AI → 429 «лимит Z.AI»', r.status === 429 && r.body.error === 'лимит Z.AI' && r.body.code === 'zai_limit');
  ok('после сбоя Z.AI запрос вернули в лимит', windows.get('u-paid|check').count === 0);
  zaiQueue.push(zaiErr(401, '1002'));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { jwt: 'jwt-paid' });
  ok('401 от Z.AI → 401 zai_key', r.status === 401 && r.body.code === 'zai_key');
  zaiQueue.push(zaiErr(500));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { jwt: 'jwt-paid' });
  ok('500 от Z.AI → 502', r.status === 502 && r.body.code === 'zai_down');
  zaiQueue.push(zaiOk(''));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=check', { jwt: 'jwt-paid' });
  ok('пустой ответ модели → 502 и лимит не тронут', r.status === 502 && windows.get('u-paid|check').count === 0);

  /* ---------- /api/limits ---------- */
  reset();
  r = await call('/api/limits');
  ok('limits без входа: бесплатный, 1 / 600 с, 5 фото, доступно', r.body.plan === 'free' && r.body.limits.requests === 1 && r.body.limits.window_seconds === 600 && r.body.limits.photos === 5 && r.body.rate.allowed && r.body.user === false && r.body.title === 'Бесплатный');
  r = await call('/api/limits', { jwt: 'jwt-premium' });
  ok('limits Премиум: учитель и списывание', r.body.plan === 'premium' && r.body.features.teacher && r.body.features.plagiarism && r.body.user === true);
  ok('limits ничего не списывает', !windows.size);

  /* ---------- /api/check-test ---------- */
  reset();
  const people = Array.from({ length: 7 }, (_, i) => ({ img: IMG + '&s=' + i, name: i === 0 ? '' : 'Ученик ' + (i + 1), class: '9А' }));
  const testBody = JSON.stringify({ reference_img: IMG, student_imgs: people, subject: 'физика', total: 10 });
  r = await call('/api/check-test', { method: 'POST', body: testBody, jwt: 'jwt-paid', headers: { 'Content-Type': 'application/json' } });
  ok('тест на Платном — 402 need=premium', r.status === 402 && r.body.need === 'premium');

  zaiQueue.push(body => {
    const n = body.messages[1].content.length - 2;   // текст + эталон
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      reference: { answers: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, answer: 'А' })) },
      students: Array.from({ length: n }, (_, i) => ({ index: i + 1, name: 'С фото ' + (i + 1), class: '9Б', correct: 8, total: 10, errors: [{ n: 3, student: 'Б', correct: 'А' }], comment: 'ок' }))
    }) } }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }), { status: 200 });
  });
  zaiQueue.push(zaiOk({ students: [{ index: 1, name: 'x', correct: 11, total: 10 }] }));
  r = await call('/api/check-test', { method: 'POST', body: testBody, jwt: 'jwt-premium', headers: { 'Content-Type': 'application/json' } });
  ok('тест: 7 учеников = 2 запроса к модели (по 5)', r.status === 200 && zaiSent.length === 2 && zaiSent[0].messages[1].content.length === 7 && zaiSent[1].messages[1].content.length === 4, r.text.slice(0, 300));
  ok('тест: эталон — первое фото в каждом запросе', zaiSent.every(s => s.messages[1].content[1].image_url.url === IMG));
  ok('тест: промт «1-е фото — эталон»', /1-е фото — эталон с ответами/.test(zaiSent[0].messages[0].content));
  const st = r.body.students || [];
  ok('тест: имя с фото, если учитель не вписал; иначе из списка', st[0].name === 'С фото 1' && st[1].name === 'Ученик 2' && st[1].class === '9А');
  ok('тест: верно/всего/процент', st[0].correct === 8 && st[0].total === 10 && st[0].percent === 80);
  ok('тест: верных не больше, чем вопросов', st[5].correct === 10);
  ok('тест: работа, которую модель пропустила, — failed', st[6].status === 'failed');
  ok('тест: итог', r.body.summary.checked === 6 && r.body.summary.failed === 1 && r.body.summary.total === 10);
  ok('тест: токены сложены', r.body.tokens_used.total === 165);
  const csv = decodeURIComponent((r.body.csv_url || '').split(',').slice(1).join(','));
  ok('тест: CSV с BOM и заголовком', csv.startsWith('﻿ФИО,Класс,Верно,Всего,Процент,Ошибки'));

  reset();
  zaiQueue.push(zaiErr(429));
  r = await call('/api/check-test', { method: 'POST', body: testBody, jwt: 'jwt-premium', headers: { 'Content-Type': 'application/json' } });
  ok('тест: 429 Z.AI сразу — 429 и дальше не спрашиваем', r.status === 429 && zaiSent.length === 1 && windows.get('u-premium|check').count === 0);
  r = await call('/api/check-test', { method: 'POST', body: JSON.stringify({ student_imgs: people }), jwt: 'jwt-premium' });
  ok('тест без эталона — 400', r.status === 400);
  r = await call('/api/check-test', { method: 'POST', body: JSON.stringify({ reference_img: IMG, student_imgs: Array(31).fill({ img: IMG }) }), jwt: 'jwt-premium' });
  ok('тест: больше 30 учеников — 400', r.status === 400 && /30/.test(r.body.error));
  r = await call('/api/check-test', { jwt: 'jwt-premium' });
  ok('тест GET — 405', r.status === 405);

  /* ---------- /api/check-teacher-report ---------- */
  reset();
  const sid = '11111111-2222-3333-4444-555555555555';
  const reportBody = JSON.stringify({ photos: [
    { img: IMG, name: 'Иванов Иван', class: '9А' },
    { img: IMG, name: '', class: '', submission_id: sid },
    { img: IMG, name: '=cmd', class: '9А' }
  ], subject: 'русский', grade: true });
  zaiQueue.push(zaiOk(Object.assign({}, full, { assessment: 5 })), zaiErr(500), zaiOk(Object.assign({}, full, { assessment: 4, comment: 'Хорошо, "но" есть ошибки' })));
  r = await call('/api/check-teacher-report', { method: 'POST', body: reportBody, jwt: 'jwt-premium', headers: { Accept: 'application/x-ndjson' } });
  const lines = r.text.trim().split('\n').map(l => JSON.parse(l));
  ok('отчёт: поток — 3 строки прогресса и итог', r.headers.get('Content-Type').startsWith('application/x-ndjson') && lines.length === 4 && lines[0].type === 'progress' && lines[2].done === 3 && lines[3].type === 'result');
  const rep = lines[3];
  ok('отчёт: сбой одного фото не останавливает остальные', rep.reports[0].status === 'ok' && rep.reports[1].status === 'failed' && rep.reports[2].status === 'ok');
  ok('отчёт: средний балл по проверенным', rep.summary.avg === 4.5 && rep.summary.total === 3 && rep.summary.failed === 1);
  ok('отчёт: по очереди, по одному фото', zaiSent.length === 3 && zaiSent.every(s => s.messages[1].content.length === 2));
  ok('отчёт: имя с фото, если учитель не вписал', rep.reports[0].name === 'Иванов Иван');
  const csv2 = decodeURIComponent(rep.csv_url.split(',').slice(1).join(','));
  ok('отчёт: CSV «ФИО,Класс,Оценка,Комментарий,Ошибок»', csv2.startsWith('﻿ФИО,Класс,Оценка,Комментарий,Ошибок\r\nИванов Иван,9А,5,'));
  ok('отчёт: CSV экранирует кавычки и формулы', /"Хорошо, ""но"" есть ошибки"/.test(csv2) && /\n'=cmd,/.test(csv2));
  const upd = sbCalls.find(c => c.path === '/rest/v1/rpc/sky_submissions_update');
  ok('отчёт: работа по ссылке отмечена как failed', upd && JSON.parse(upd.body).p_items[0].id === sid && JSON.parse(upd.body).p_items[0].status === 'failed');

  reset();
  zaiQueue.push(zaiOk(full), zaiErr(429));
  r = await call('/api/check-teacher-report', { method: 'POST', body: reportBody, jwt: 'jwt-premium' });
  ok('отчёт: 429 Z.AI — остальные сразу failed, без лишних запросов', r.status === 200 && zaiSent.length === 2 && r.body.reports[2].status === 'failed' && r.body.reports[2].error === 'лимит Z.AI');
  r = await call('/api/check-teacher-report', { method: 'POST', body: reportBody, jwt: 'jwt-paid' });
  ok('отчёт на Платном — 402', r.status === 402 && r.body.need === 'premium');
  r = await call('/api/check-teacher-report', { method: 'POST', body: '{"photos":[{"img":"x"}]}', jwt: 'jwt-premium' });
  ok('отчёт: плохая ссылка — 400', r.status === 400);

  reset();
  zaiQueue.push(zaiOk(Object.assign({}, full, { criteria: [{ name: 'верно', score: 4 }, { name: 'оформление', score: 5 }] })));
  r = await call('/api/check-teacher-report', { method: 'POST', jwt: 'jwt-premium',
    body: JSON.stringify({ photos: [{ img: IMG, name: 'Петров', class: '9А' }], grade: false, criteria: CRIT }) });
  const rc = r.body && r.body.reports && r.body.reports[0];
  ok('отчёт с критериями: баллы, итог 4.3 и оценка', rc && rc.score === 4.3 && rc.assessment === 4 && rc.criteria[1].score === 5, r.text);
  const csv3 = decodeURIComponent(r.body.csv_url.split(',').slice(1).join(','));
  ok('отчёт с критериями: CSV со столбцами «Балл» и по критерию', /Ошибок,Балл,верно \(вес 1\),оформление \(вес 0\.5\)\r\nПетров,9А,4,.*,"4,3",4,5/.test(csv3), csv3.split('\r\n').slice(0, 2).join(' | '));

  /* ---------- /api/submit-homework ---------- */
  reset();
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
  r = await call('/api/submit-homework?student_name=' + q('Иванов Иван') + '&class=' + q('9А') + '&subject=' + q('физика'),
    { method: 'POST', body: jpeg, headers: { 'Content-Type': 'image/jpeg' } });
  ok('отправка: 201, id и ссылка ?hw=', r.status === 201 && /^[0-9a-f-]{36}$/.test(r.body.id) && r.body.url === 'https://news92-tg.github.io/skyschool/photo.html?hw=' + r.body.id, r.text);
  const hwId = r.body.id;
  ok('отправка: фото в бакете в submissions/', storage.has('submissions/' + hwId + '.jpg') && storage.get('submissions/' + hwId + '.jpg').type === 'image/jpeg');
  ok('отправка: строка в homework_submissions', rows.get(hwId) && rows.get(hwId).student_name === 'Иванов Иван' && rows.get(hwId).subject === 'physics' && rows.get(hwId).student_id === null);

  r = await call('/api/submit-homework', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_name: 'Петров', class: '9Б', subject: 'алгебра', img_base64: 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).toString('base64') }), jwt: 'jwt-free' });
  ok('отправка base64 (png) от вошедшего ученика', r.status === 201 && storage.has('submissions/' + r.body.id + '.png') && rows.get(r.body.id).student_id === 'u-free', r.text);
  r = await call('/api/submit-homework?student_name=X', { method: 'POST', body: new Uint8Array([1, 2, 3]), headers: { 'Content-Type': 'image/jpeg' } });
  ok('отправка: не картинка — 400', r.status === 400 && r.body.code === 'bad_img');
  r = await call('/api/submit-homework', { method: 'POST', body: jpeg, headers: { 'Content-Type': 'image/jpeg' } });
  ok('отправка без имени — 400', r.status === 400);
  r = await call('/api/submit-homework?student_name=X', { method: 'POST', body: new Uint8Array(1572865), headers: { 'Content-Type': 'image/jpeg' } });
  ok('отправка больше 1,5 МБ — 400', r.status === 400 && /1.5 MB/.test(r.body.error));
  r = await call('/api/submit-homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_name: 'X', img_url: 'http://insecure/x.jpg' }) });
  ok('отправка: внешняя ссылка только https', r.status === 400);
  r = await call('/api/submit-homework', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_name: 'X', img_url: 'https://cdn.test/x.jpg' }) });
  ok('отправка: готовая https-ссылка без загрузки', r.status === 201 && rows.get(r.body.id).img_url === 'https://cdn.test/x.jpg');
  for (let i = 0; i < 9; i++) await call('/api/submit-homework?student_name=X', { method: 'POST', body: jpeg, headers: { 'Content-Type': 'image/jpeg' }, ip: '10.9.9.9' });
  r = await call('/api/submit-homework?student_name=X', { method: 'POST', body: jpeg, headers: { 'Content-Type': 'image/jpeg' }, ip: '10.9.9.9' });
  const r11 = await call('/api/submit-homework?student_name=X', { method: 'POST', body: jpeg, headers: { 'Content-Type': 'image/jpeg' }, ip: '10.9.9.9' });
  ok('отправка: не больше 10 за 10 минут с адреса', r.status === 201 && r11.status === 429);
  ok('отправки не трогают лимит проверок', !windows.has('ip:10.9.9.9|check'));

  /* ---------- /api/homework/:id ---------- */
  r = await call('/api/homework/' + hwId);
  ok('работа по ссылке: данные и подписанная ссылка на фото', r.status === 200 && r.body.student_name === 'Иванов Иван' && r.body.status === 'pending' &&
    r.body.img_url === SB + '/storage/v1/object/sign/homework/submissions/' + hwId + '.jpg?token=t', r.text);
  r = await call('/api/homework/00000000-0000-0000-0000-000000000000');
  ok('нет такой работы — 404', r.status === 404);
  r = await call('/api/homework/..%2F..%2Fetc');
  ok('кривой id — 400', r.status === 400);

  /* ---------- /api/payments ---------- */
  r = await call('/api/payments', { method: 'POST', body: '{"purpose":"premium_tariff"}' });
  ok('оплата без входа — 401 login', r.status === 401 && r.body.code === 'login');
  r = await call('/api/payments', { method: 'POST', body: '{"purpose":"premium_tariff","amount":1}', jwt: 'jwt-free' });
  ok('заявка на Премиум: сумма из справочника, не от клиента', r.status === 201 && payments[0].amount === 209 && payments[0].plan === 'premium' && payments[0].status === 'pending' && payments[0].user_id === 'u-free');
  r = await call('/api/payments', { method: 'POST', body: '{"purpose":"plagiarism"}', jwt: 'jwt-free' });
  ok('заявка на проверку списывания +40 ₽', r.status === 201 && payments[1].amount === 40 && payments[1].plan === null);
  r = await call('/api/payments', { method: 'POST', body: '{"purpose":"gift"}', jwt: 'jwt-free' });
  ok('неизвестная покупка — 400', r.status === 400);

  /* ---------- /api/check-text: сочинение через Groq ---------- */
  reset();
  const essay = 'Моё любимое время года\n\nЯ люблю осень. Осенью в лесу очень красиво, листья жёлтые и красные. Мы с друзьями ходим в парк.';
  const longRes = {
    criteria: { topic_match: 5, argumentation: '3', composition: 4, logic: 9, spelling: 4, grammar: 'хорошо' },
    errors: [{ type: 'пунктуация', fragment: 'листья жёлтые и красные', correction: 'листья — жёлтые и красные' }, 'мусор'],
    assessment: 4, comment: 'Хорошее сочинение. Добавьте примеры.'
  };
  const postText = (body, o) => call('/api/check-text', Object.assign({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, o || {}));

  groqQueue.push(groqOk(longRes));
  r = await postText({ text: essay });
  ok('текст: POST, по умолчанию русский и подробно — 200', r.status === 200 && r.body.subject === 'russian' && r.body.length === 'long', r.text);
  ok('текст: по умолчанию criteria есть, оценки нет',
    JSON.stringify(Object.keys(r.body)) === '["subject","length","criteria","errors","comment","cached","tokens_used","plan","rate","groq"]', r.text);
  ok('текст: критерии 0–5, нечисло — null', JSON.stringify(r.body.criteria) === '{"topic_match":5,"argumentation":3,"composition":4,"logic":5,"spelling":4,"grammar":null}');
  ok('текст: ошибки без мусора', r.body.errors.length === 1 && r.body.errors[0].correction === 'листья — жёлтые и красные');
  ok('текст: токены и заголовки Groq в ответе', r.body.tokens_used.total === 1000 && r.body.cached === false &&
    r.body.groq.remaining_requests === 14399 && r.body.groq.remaining_tokens === 5000);
  const gq = groqSent[0];
  ok('текст: модель llama-3.1-8b-instant, 0.2, 1800 токенов, json_object',
    gq.body.model === 'llama-3.1-8b-instant' && gq.body.temperature === 0.2 && gq.body.max_tokens === 1800 && gq.body.response_format.type === 'json_object');
  ok('текст: ключ Groq только из секрета', gq.headers.Authorization === 'Bearer groq');
  const tsys = gq.body.messages[0].content;
  ok('текст: промт long — база и шесть критериев',
    /^Ты учитель русского языка и литературы\. Проверяешь сочинение ученика 5-11 класса\. Отвечай ТОЛЬКО валидным JSON, без markdown\./.test(tsys) &&
    ['topic_match — соответствие теме', 'argumentation — аргументация с примерами', 'composition — композиция: вступление, основная часть, вывод',
     'logic — логика и связность', 'spelling — орфография', 'grammar — грамматика и речь'].every(x => tsys.includes(x)) &&
    /Если ученик написал не по теме — topic_match: 0, остальные критерии не считай\./.test(tsys));
  ok('текст: сочинение в сообщении ученика, тема — из заголовка', gq.body.messages[1].content.endsWith('Сочинение:\n' + essay) && /Тема не указана/.test(gq.body.messages[1].content));
  const tlog = textLog[0] || {};
  ok('текст: история — хэш SHA-256, предмет, длина, токены', /^[0-9a-f]{64}$/.test(tlog.p_text_hash) && tlog.p_subject === 'russian' && tlog.p_length === 'long' && tlog.p_tokens === 1000 && tlog.p_ip === '10.0.0.1');
  ok('текст: в историю — полный разбор, без служебных полей и текста', tlog.p_result && tlog.p_result.assessment === 4 && !('rate' in tlog.p_result) && !('plan' in tlog.p_result) && !JSON.stringify(tlog.p_result).includes('Мы с друзьями'));
  ok('текст: окно лимита — scope text, фото не тронуто', windows.has('ip:10.0.0.1|text') && !windows.has('ip:10.0.0.1|check'));

  r = await postText({ text: essay });
  ok('текст: Бесплатный — второй запрос за 5 минут — 429', r.status === 429 && r.body.code === 'rate_limit' && r.body.retry_after > 290 && r.body.retry_after <= 300, r.text);
  r = await call('/api/limits');
  ok('/api/limits: лимит текста 1 / 300 с, текст исчерпан, фото свободно',
    r.body.text && r.body.text.requests === 1 && r.body.text.window_seconds === 300 && r.body.text.rate.allowed === false && r.body.rate.allowed === true, r.text);

  r = await postText({ text: '  ' + essay.replace(/\n/g, '\r\n') + '\n' }, { ip: '10.0.0.3' });
  ok('текст: тот же текст — из кэша, 0 токенов, без Groq', r.status === 200 && r.body.cached === true && r.body.tokens_used.total === 0 && groqSent.length === 1, r.text);
  ok('текст: из кэша — те же критерии и ошибки', r.body.criteria.logic === 5 && r.body.errors.length === 1 && !('groq' in r.body));
  ok('текст: попадание в кэш тоже в истории, с 0 токенов', textLog.length === 2 && textLog[1].p_tokens === 0 && textLog[1].p_result.cached === true);
  groqQueue.push(groqOk(longRes));
  r = await postText({ text: essay, length: 'short' }, { ip: '10.0.0.4' });
  ok('текст: другие настройки — другой хэш, идём в Groq', r.body.cached === false && groqSent.length === 2 && textLog[2].p_text_hash !== textLog[0].p_text_hash);

  groqQueue.push(groqOk({ errors: [{ type: 'grammar', fragment: 'He go', correction: 'He goes' }], assessment: '4', comment: 'Неплохо.' }));
  r = await call('/api/check-text?text=' + q('He go to school.') + '&subject=' + q('английский') + '&length=short&grade=true&grade_text=true', { ip: '10.0.0.5' });
  ok('текст: GET, английский, коротко, оценка числом и словами', r.status === 200 && r.body.subject === 'english' && r.body.assessment === 4 &&
    r.body.assessment_text === '4 (хорошо)' && !('criteria' in r.body) && r.body.errors[0].correction === 'He goes', r.text);
  const ssys = groqSent[2].body.messages[0].content;
  ok('текст: промт short — 800 токенов, ошибки и оценка', groqSent[2].body.max_tokens === 800 && /^Ты учитель английского языка\./.test(ssys) &&
    /Найди ошибки: орфография, пунктуация, грамматика\./.test(ssys) && /Поставь оценку 1-5\./.test(ssys) && !/topic_match/.test(ssys));

  groqQueue.push(groqOk({ criteria: { topic_match: 0, argumentation: 4, composition: 5, logic: 4, spelling: 5, grammar: 5 }, errors: [], assessment: 2, comment: 'Не по теме.' }));
  r = await postText({ text: 'Про футбол.', subject: 'литература', topic: 'Образ Татьяны в «Евгении Онегине»', criteria: false, grade: true }, { ip: '10.0.0.6' });
  ok('текст: литература, тема передана модели', /^Тема сочинения: Образ Татьяны/.test(groqSent[3].body.messages[1].content) && /Предмет — литература/.test(groqSent[3].body.messages[0].content));
  ok('текст: criteria=false — без таблицы критериев', r.status === 200 && !('criteria' in r.body) && r.body.assessment === 2, r.text);
  ok('текст: не по теме — остальные критерии не считаются', textLog[textLog.length - 1].p_result.criteria.topic_match === 0 &&
    textLog[textLog.length - 1].p_result.criteria.composition === null);

  groqQueue.push(groqOk('Оценка 3. Ошибок немного, но мало примеров.'));
  r = await postText({ text: 'Текст без JSON в ответе.', grade: true }, { ip: '10.0.0.7' });
  ok('текст: Groq вернул не JSON — весь текст в comment', r.status === 200 && r.body.comment === 'Оценка 3. Ошибок немного, но мало примеров.' && r.body.errors.length === 0 && r.body.assessment === 'N/A', r.text);
  ok('текст: такой ответ в кэш не идёт', textLog[textLog.length - 1].p_text_hash === null);

  groqQueue.push(groqErr(400, {}, { message: 'Failed to generate JSON', type: 'invalid_request_error', code: 'json_validate_failed',
    failed_generation: '{"errors": [], "assessment": 5, "comment": "Отлично"}' }));
  r = await postText({ text: 'Почти JSON.', length: 'short', grade: true }, { ip: '10.0.0.8' });
  ok('текст: json_validate_failed — берём failed_generation', r.status === 200 && r.body.assessment === 5 && r.body.comment === 'Отлично', r.text);

  groqQueue.push(groqOk(longRes, null, 'length'));
  r = await postText({ text: 'Обрезанный ответ.' }, { ip: '10.0.0.9' });
  ok('текст: ответ обрезан по max_tokens — truncated, без кэша', r.body.truncated === true && textLog[textLog.length - 1].p_text_hash === null);

  groqQueue.push(groqOk(longRes));
  const big = ('Слово ' + 'а'.repeat(20) + ' ').repeat(400);          // ~11 200 символов
  r = await postText({ text: big }, { ip: '10.0.1.1' });
  const sentText = groqSent[groqSent.length - 1].body.messages[1].content.split('Сочинение:\n')[1];
  ok('текст: больше 8000 — проверены первые 8000, предупреждение', r.status === 200 && r.body.truncated_input === true && /8000/.test(r.body.warning) &&
    sentText.length <= 8000 && sentText.length > 7800 && big.startsWith(sentText), r.text);

  const sentBefore = groqSent.length;
  r = await postText({ text: 'а'.repeat(15001) }, { ip: '10.0.1.2' });
  ok('текст: больше 15 000 — 400 «разбейте на части»', r.status === 400 && r.body.error === 'Текст слишком длинный, разбейте на части' && r.body.code === 'too_long');
  r = await postText({ text: '   ' }, { ip: '10.0.1.2' });
  ok('текст: пустой — 400', r.status === 400 && r.body.code === 'no_text');
  r = await call('/api/check-text', { ip: '10.0.1.2' });
  ok('текст: без text — 400 как раньше', r.status === 400 && r.body.error === 'text param required');
  for (const bad of [{ subject: 'химия' }, { length: 'medium' }, { grade: 'maybe' }, { criteria: 'да' }]) {
    r = await postText(Object.assign({ text: 'x' }, bad), { ip: '10.0.1.2' });
    ok('текст: 400 на ' + JSON.stringify(bad), r.status === 400 && r.body.code === 'bad_param', r.text);
  }
  r = await call('/api/check-text', { method: 'POST', body: 'text=x', ip: '10.0.1.2' });
  ok('текст: POST не JSON — 400', r.status === 400 && r.body.code === 'bad_param');
  r = await call('/api/check-text', { method: 'PUT', body: '{}', ip: '10.0.1.2' });
  ok('текст: PUT — 405', r.status === 405);
  ok('текст: отказы 400 не зовут Groq и не тратят лимит', groqSent.length === sentBefore && !windows.has('ip:10.0.1.2|text'));
  r = await postText({ text: 'x' }, { jwt: 'expired' });
  ok('текст: просроченный вход — 401 session', r.status === 401 && r.body.code === 'session');

  for (const [st, code, http] of [[401, 'groq_key', 401], [413, 'too_long', 400], [500, 'groq_down', 502], [503, 'groq_down', 502]]) {
    groqQueue.push(groqErr(st));
    r = await postText({ text: 'Ошибка ' + st }, { ip: '10.0.2.' + st % 250 });
    ok(`текст: Groq ${st} → ${http} ${code}, лимит возвращён`, r.status === http && r.body.code === code && windows.get('ip:10.0.2.' + st % 250 + '|text').count === 0, r.text);
  }

  reset();
  for (let i = 0; i < 5; i++) groqQueue.push(groqOk(longRes));
  const prem = [];
  for (let i = 0; i < 6; i++) prem.push((await postText({ text: 'Сочинение ' + i }, { jwt: 'jwt-premium' })).status);
  ok('текст: Премиум — 5 запросов в минуту, 6-й — 429', prem.join() === '200,200,200,200,200,429', prem.join());
  ok('текст: Премиум — лимит по пользователю', windows.has('u-premium|text'));
  groqQueue.push(groqOk(longRes), groqOk(longRes));
  const paid = [];
  for (let i = 0; i < 3; i++) paid.push((await postText({ text: 'Платный ' + i }, { jwt: 'jwt-paid' })).status);
  ok('текст: Платный — 2 запроса в минуту', paid.join() === '200,200,429', paid.join());
  PLANS.paid.text_requests_per_window = 4; PLANS.paid.text_window_seconds = 120;
  r = await call('/api/limits', { jwt: 'jwt-paid' });
  ok('текст: лимиты из plan_limits важнее запасных', r.body.text.requests === 4 && r.body.text.window_seconds === 120, r.text);
  delete PLANS.paid.text_requests_per_window; delete PLANS.paid.text_window_seconds;
  ok('текст: только llama-3.1-8b-instant, никакой 70B', groqSent.length > 0 && groqSent.every(g => g.body.model === 'llama-3.1-8b-instant'));

  reset();
  groqQueue.push(groqOk(longRes));
  r = await postText({ text: 'Без базы.' }, { env: { GROQ_API_KEY: 'groq' }, ip: '10.0.3.1' });
  const r2 = await postText({ text: 'Без базы 2.' }, { env: { GROQ_API_KEY: 'groq' }, ip: '10.0.3.1' });
  ok('текст без Supabase: проверка как бесплатная, лимит в памяти', r.status === 200 && r.body.plan === 'free' && r2.status === 429 && sbCalls.length === 0, r.text);

  /* 429 от Groq — в конце: пауза после него держится в Worker */
  reset();
  groqQueue.push(groqErr(429, { 'retry-after': '1' }), groqOk(longRes));
  r = await postText({ text: 'Упёрлись в 30 в минуту.' }, { ip: '10.0.4.1' });
  ok('текст: Groq 429 — пауза 2 с и повтор', r.status === 200 && groqSent.length === 2 && groqSent[1].at - groqSent[0].at >= 1900, r.text);
  groqQueue.push(groqErr(429, { 'retry-after': '2' }), groqErr(429, { 'retry-after': '2' }));
  r = await postText({ text: 'Снова упёрлись.' }, { ip: '10.0.4.2' });
  ok('текст: 429 и после паузы — 429 «Лимит Groq, подождите»', r.status === 429 && r.body.error === 'Лимит Groq, подождите' && r.body.code === 'groq_limit' &&
    r.body.retry_after === 2 && r.headers.get('Retry-After') === '2' && windows.get('ip:10.0.4.2|text').count === 0, r.text);
  groqQueue.push(groqErr(429, { 'retry-after': '40' }));
  const before429 = groqSent.length;
  r = await postText({ text: 'Дневной лимит.' }, { ip: '10.0.4.3' });
  ok('текст: долгий retry-after — без повтора, сразу 429', r.status === 429 && r.body.retry_after === 40 && groqSent.length === before429 + 1);
  groqQueue.push(groqOk(longRes));
  const t0 = Date.now();
  r = await postText({ text: 'После лимита.' }, { ip: '10.0.4.4' });
  ok('текст: следующий вызов после 429 ждёт не дольше 2 с', r.status === 200 && Date.now() - t0 >= 1900 && Date.now() - t0 < 3500);

  /* ---------- прежние адреса: код worker/worker.js внутри ---------- */
  reset();
  const embed = require('./embed-legacy-worker.js');
  ok('копия worker/worker.js в news92-orders.js не отстала', embed.current().text === embed.block());
  r = await call('/health');
  ok('/health: в списке и новые, и прежние адреса', ['/api/check-photo', '/api/check-text', '/explain', '/check-photo', '/check-homework', '/chess-explain', '/grade-essay']
    .every(p => r.body.endpoints.includes(p)), r.text);
  const SITE = { Origin: 'https://news92-tg.github.io', 'Content-Type': 'application/json' };
  groqQueue.push(groqOk('Потому что 2+2=4.'));
  r = await call('/explain', { method: 'POST', headers: SITE, body: JSON.stringify({ task: '2+2=?', userAnswer: '5', correctAnswer: '4', lang: 'ru' }) });
  ok('POST /explain — прежний код: объяснение от Groq', r.status === 200 && r.body.explanation === 'Потому что 2+2=4.' &&
    r.headers.get('Access-Control-Allow-Origin') === 'https://news92-tg.github.io', r.text);
  groqQueue.push(groqOk({ grade: 4, criteria: [{ name: 'тема', score: 5, comment: 'ок' }], strengths: [], issues: [], overall_feedback: 'Хорошо', next_step: '' }));
  r = await call('/grade-essay', { method: 'POST', headers: SITE, body: JSON.stringify({ text: 'Сочинение', lang: 'ru' }) });
  ok('POST /grade-essay — прежний код: оценка и критерии', r.status === 200 && r.body.grade === 4 && r.body.criteria[0].score === 5, r.text);
  r = await call('/grade-essay', { method: 'OPTIONS', headers: { Origin: 'https://news92-tg.github.io' } });
  ok('OPTIONS прежних адресов — их собственный CORS', r.status === 204 && r.headers.get('Access-Control-Allow-Headers') === 'Content-Type');
  r = await call('/check-photo');
  ok('GET /check-photo — как в прежнем коде: 405 use POST', r.status === 405 && r.body.error === 'use POST');
  r = await call('/explain', { method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: '{"task":"x"}' });
  ok('чужой сайт — 403, как в прежнем коде', r.status === 403);
  ok('прежние адреса не трогают тарифы и Supabase', !sbCalls.length && !windows.size);

  /* ---------- без Supabase ---------- */
  reset();
  const bare = { ZAI_API_KEY: 'zai' };
  zaiQueue.push(zaiOk(full));
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=grade', { env: bare, ip: '10.7.7.7' });
  ok('без Supabase: проверка работает как бесплатная', r.status === 200 && r.body.plan === 'free' && r.body.assessment === 3 && sbCalls.length === 0);
  r = await call('/api/check-photo?img=' + q(IMG) + '&mode=grade', { env: bare, ip: '10.7.7.7' });
  ok('без Supabase: лимит в памяти тоже держит', r.status === 429);
  r = await call('/api/submit-homework?student_name=X', { method: 'POST', body: jpeg, headers: { 'Content-Type': 'image/jpeg' }, env: bare });
  ok('без Supabase: отправка работ — 503', r.status === 503);

  console.log(`\nПрошло: ${passed}, провалено: ${failed}`);
  if (failed) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
