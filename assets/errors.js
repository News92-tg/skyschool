/* ============================================================
   SkyySchool — понятные ошибки

   Один обработчик на весь сайт. Что бы ни сломалось — Worker, база,
   сеть, — человек видит не «Failed to fetch» и не «PGRST301», а
   сообщение с иконкой и делом, которое можно сделать:

     401 — «Войдите в аккаунт»            → кнопка «Войти»
     402 — «Оформите тариф»               → кнопка «Тарифы»
     403 — «Нет доступа»
     429 — «Подождите N с»                → «Повторить», когда время выйдет
     5xx — «Сервис временно недоступен»   → «Повторить»
     время вышло — «Превышено время ожидания» → «Повторить»
     нет сети — «Нет соединения»          → «Повторить»

   Использование:
     const res = await SkyErrors.fetch(url, { json, timeout, retry });
     if (!res.ok) SkyErrors.show(res, { retry: () => load() });

     try { await Sky.db.rpc(...) } catch (e) { SkyErrors.show(e, { retry }) }

   SkyErrors.fetch никогда не бросает: и сеть, и таймаут, и ответ
   сервера с ошибкой приходят одним объектом { ok, status, data,
   timeout, network, retryAfter }.

   Подключается сам на каждой странице (assets/core.js), а страницы,
   которым он нужен сразу при загрузке, подключают его <script>.
   ============================================================ */
'use strict';

(function () {
  if (window.SkyErrors) return;

  Sky.extendDict({
    er401:{ru:'Войдите в аккаунт',en:'Please sign in'},
    er401d:{ru:'Сессия закончилась или вход не выполнен.',en:'Your session has ended or you are not signed in.'},
    er402:{ru:'Оформите тариф',en:'Choose a plan'},
    er402d:{ru:'Эта возможность есть в платном тарифе.',en:'This is part of a paid plan.'},
    er403:{ru:'Нет доступа',en:'Access denied'},
    er403d:{ru:'У вашего аккаунта нет прав на это действие.',en:'Your account is not allowed to do this.'},
    er404:{ru:'Не найдено',en:'Not found'},
    er404d:{ru:'Такой записи нет или её удалили.',en:'It does not exist or was deleted.'},
    er429:{ru:'Подождите %1 с',en:'Wait %1 s'},
    er429d:{ru:'Слишком много запросов подряд. Повторить можно, когда отсчёт закончится.',en:'Too many requests in a row. You can retry when the countdown ends.'},
    er5xx:{ru:'Сервис временно недоступен',en:'Service temporarily unavailable'},
    er5xxd:{ru:'Мы уже знаем. Попробуйте ещё раз через минуту.',en:'Please try again in a minute.'},
    erTimeout:{ru:'Превышено время ожидания',en:'The request timed out'},
    erTimeoutd:{ru:'Сервер отвечает слишком долго. Проверьте интернет и повторите.',en:'The server is taking too long. Check your connection and retry.'},
    erNet:{ru:'Нет соединения',en:'No connection'},
    erNetd:{ru:'Проверьте интернет. Сохранённое на устройстве доступно и без сети.',en:'Check your internet. Saved content is available offline.'},
    erOnline:{ru:'Связь восстановлена',en:'Back online'},
    erBad:{ru:'Проверьте данные',en:'Check the input'},
    erOther:{ru:'Что-то пошло не так',en:'Something went wrong'},
    erRetry:{ru:'Повторить',en:'Retry'},
    erSignIn:{ru:'Войти',en:'Sign in'},
    erPlans:{ru:'Тарифы',en:'Plans'},
    erClose:{ru:'Закрыть',en:'Close'}
  });

  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* Иконки — линией, цветом текста: в тёмной теме перекрашиваются сами. */
  const ICON = {
    lock:  '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2.5"/>',
    card:  '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 15h4"/>',
    stop:  '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tool:  '<path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L21 12l-9 9-3-3 9-9-1.6-1.6a4 4 0 0 1-4.9-4.9l2.5 2.5 2-2z"/>',
    wifi:  '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0"/><circle cx="12" cy="19" r="1.2"/><path d="M3 3l18 18"/>',
    ok:    '<path d="M20 6L9 17l-5-5"/>',
    warn:  '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'
  };
  const svg = name => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ICON.warn}</svg>`;

  /* ---------- что случилось ----------
     На вход — что угодно: ответ SkyErrors.fetch / SkyCheck.request
     ({ status, data, timeout, network }), ошибка Supabase ({ code,
     message, status }), обычный Error или просто число — статус. */
  function classify(x) {
    if (x == null) return { kind: 'other' };
    if (typeof x === 'number') x = { status: x };
    const d = x.data || {};
    const msg = String(x.message || x.error_description || d.error || '');
    if (x.timeout || x.name === 'AbortError' || x.name === 'TimeoutError') return { kind: 'timeout' };
    if (x.network || /Failed to fetch|NetworkError|Load failed|ERR_INTERNET|network/i.test(msg) && !x.status) return { kind: 'network' };

    /* Коды Worker: session / login / tariff / rate_limit / *_limit… */
    const code = String(d.code || x.code || '');
    let status = +x.status || +d.status || 0;
    if (code === 'session' || code === 'login' || code === 'PGRST301' || code === 'PGRST303' || /JWT|jwt expired/i.test(msg)) status = 401;
    else if (code === 'tariff') status = 402;
    else if (code === '42501' || code === 'forbidden' || /permission denied|row-level security/i.test(msg)) status = status || 403;
    else if (code === 'rate_limit' || /_limit$/.test(code)) status = 429;
    else if (code === 'PGRST116') status = 404;

    const wait = Math.ceil(+(x.retryAfter || d.retry_after || d.waitSec || 0)) || 0;
    if (status === 401) return { kind: 'auth' };
    if (status === 402) return { kind: 'plan', need: d.need };
    if (status === 403) return { kind: 'forbidden' };
    if (status === 404) return { kind: 'notfound' };
    if (status === 429) return { kind: 'rate', wait: wait || 30 };
    if (status >= 500) return { kind: 'server' };
    if (status === 400 || status === 422 || code === 'bad_param' || code === '22P02' || code === '23514' || code === 'P0001') {
      return { kind: 'bad', text: d.error || msg };
    }
    if (!status && !msg) return { kind: 'network' };
    return { kind: 'other', text: d.error || msg };
  }

  const KINDS = {
    auth:     { icon: 'lock',  title: 'er401',     text: 'er401d',     tone: 'warn' },
    plan:     { icon: 'card',  title: 'er402',     text: 'er402d',     tone: 'accent' },
    forbidden:{ icon: 'stop',  title: 'er403',     text: 'er403d',     tone: 'no' },
    notfound: { icon: 'search',title: 'er404',     text: 'er404d',     tone: 'muted' },
    rate:     { icon: 'clock', title: 'er429',     text: 'er429d',     tone: 'warn' },
    server:   { icon: 'tool',  title: 'er5xx',     text: 'er5xxd',     tone: 'no' },
    timeout:  { icon: 'clock', title: 'erTimeout', text: 'erTimeoutd', tone: 'warn' },
    network:  { icon: 'wifi',  title: 'erNet',     text: 'erNetd',     tone: 'no' },
    bad:      { icon: 'warn',  title: 'erBad',     text: null,         tone: 'warn' },
    other:    { icon: 'warn',  title: 'erOther',   text: null,         tone: 'no' }
  };

  /* Короткий текст — для мест, где ошибку показывают строкой в форме. */
  function message(x) {
    const c = classify(x), k = KINDS[c.kind];
    if (c.kind === 'rate') return t('er429').replace('%1', c.wait);
    if ((c.kind === 'bad' || c.kind === 'other') && c.text) return c.text;
    return t(k.title);
  }

  /* ---------- уведомления ----------
     Стопка в правом нижнем углу (на телефоне — внизу во всю ширину).
     Одинаковые подряд не множим: повторная ошибка обновляет прежнюю. */
  let stack = null;
  function host() {
    if (stack && document.body.contains(stack)) return stack;
    stack = document.createElement('div');
    stack.className = 'sx-stack';
    stack.setAttribute('aria-live', 'assertive');
    document.body.appendChild(stack);
    return stack;
  }

  function signInUrl() {
    const here = location.pathname.split('/').pop() || 'index.html';
    return 'auth.html?next=' + encodeURIComponent(here + location.search);
  }

  function show(x, o) {
    o = o || {};
    const c = classify(x);
    const k = KINDS[c.kind];
    const key = o.key || c.kind + ':' + (o.context || '');
    const box = host();
    let el = box.querySelector(`[data-key="${CSS.escape(key)}"]`);
    if (el) el._dismiss(true);

    el = document.createElement('div');
    el.className = 'sx sx-' + k.tone;
    el.dataset.key = key;
    el.setAttribute('role', 'alert');
    const text = o.text || (k.text ? t(k.text) : (c.text || ''));
    const title = o.title || (c.kind === 'rate' ? t('er429').replace('%1', c.wait) : t(k.title));
    el.innerHTML = `
      <span class="sx-ico">${svg(k.icon)}</span>
      <div class="sx-body"><b class="sx-title">${esc(title)}</b>${text && text !== title ? `<span class="sx-text">${esc(text)}</span>` : ''}</div>
      <div class="sx-acts"></div>
      <button type="button" class="sx-x" aria-label="${esc(t('erClose'))}">×</button>`;
    const acts = el.querySelector('.sx-acts');
    /* fn — строка: это ссылка (переход), функция — действие на месте. */
    const addBtn = (label, fn, primary) => {
      const b = document.createElement(typeof fn === 'string' ? 'a' : 'button');
      if (typeof fn === 'string') b.href = fn; else b.type = 'button';
      b.className = 'sx-btn' + (primary ? ' primary' : '');
      b.textContent = label;
      b.addEventListener('click', () => { dismiss(); if (typeof fn === 'function') fn(); });
      acts.appendChild(b);
      return b;
    };

    let timer = null, tick = null;
    function dismiss(now) {
      clearTimeout(timer); clearInterval(tick);
      if (now) { el.remove(); return; }
      el.classList.remove('in');
      setTimeout(() => el.remove(), 220);
    }
    el._dismiss = dismiss;
    el.querySelector('.sx-x').addEventListener('click', () => dismiss());

    if (c.kind === 'auth' && o.signIn !== false) {
      addBtn(t('erSignIn'), o.modal && Sky.auth && Sky.auth.openAuth ? () => Sky.auth.openAuth() : signInUrl(), true);
    }
    if (c.kind === 'plan') {
      addBtn(t('erPlans'), () => {
        if (window.SkyCheck && SkyCheck.openTariffs) SkyCheck.openTariffs(c.need);
        else location.href = 'profile.html#plan';
      }, true);
    }
    let retryBtn = null;
    if (typeof o.retry === 'function' && ['rate', 'server', 'timeout', 'network', 'other', 'notfound'].includes(c.kind)) {
      retryBtn = addBtn(t('erRetry'), o.retry, true);
    }

    /* 429: заголовок считает секунды, «Повторить» ждёт конца отсчёта. */
    if (c.kind === 'rate') {
      let left = c.wait;
      const titleEl = el.querySelector('.sx-title');
      if (retryBtn) retryBtn.disabled = true;
      tick = setInterval(() => {
        left--;
        if (left > 0) { titleEl.textContent = t('er429').replace('%1', left); return; }
        clearInterval(tick);
        titleEl.textContent = t('erRetry') + '?';
        if (retryBtn) retryBtn.disabled = false; else dismiss();
      }, 1000);
    }

    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    /* С кнопкой — висит, пока не нажмут или не закроют (но не вечно);
       без кнопок — уходит сама. */
    const ttl = o.ttl || (acts.children.length ? 20000 : 7000);
    if (c.kind !== 'rate') timer = setTimeout(() => dismiss(), ttl);
    else timer = setTimeout(() => dismiss(), Math.max(ttl, (c.wait + 15) * 1000));
    return { kind: c.kind, close: dismiss };
  }

  /* Хорошая новость в том же стиле — «Сохранено», «Связь восстановлена». */
  function success(title, text) {
    const box = host();
    const el = document.createElement('div');
    el.className = 'sx sx-ok';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="sx-ico">${svg('ok')}</span><div class="sx-body"><b class="sx-title">${esc(title)}</b>${text ? `<span class="sx-text">${esc(text)}</span>` : ''}</div>`;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 220); }, 3500);
  }

  /* ---------- запрос с таймаутом ---------- */
  async function request(url, o) {
    o = o || {};
    const ctl = new AbortController();
    const ms = o.timeout == null ? 20000 : o.timeout;
    const timer = ms ? setTimeout(() => ctl.abort(), ms) : null;
    const headers = Object.assign({}, o.headers || {});
    let body = o.body;
    if (o.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
    if (o.auth && Sky.db && Sky.db.token) {
      try { const tok = await Sky.db.token(); if (tok) headers.Authorization = 'Bearer ' + tok; } catch (e) {}
    }
    try {
      const r = await fetch(url, { method: o.method || (body ? 'POST' : 'GET'), headers, body, signal: ctl.signal });
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = { error: text.slice(0, 300) }; }
      const retryAfter = +(r.headers.get('Retry-After') || (data && (data.retry_after || data.waitSec)) || 0) || 0;
      const res = { ok: r.ok, status: r.status, data, retryAfter };
      if (!r.ok && o.toast) show(res, { retry: o.retry, context: o.context });
      return res;
    } catch (e) {
      const timeout = e && e.name === 'AbortError';
      const res = { ok: false, status: 0, data: null, timeout, network: !timeout };
      if (o.toast) show(res, { retry: o.retry, context: o.context });
      return res;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- сеть пропала / вернулась ---------- */
  let offlineNote = null;
  window.addEventListener('offline', () => { offlineNote = show({ network: true }, { key: 'net', ttl: 60000 }); });
  window.addEventListener('online', () => {
    if (offlineNote) { offlineNote.close(); offlineNote = null; success(t('erOnline')); }
  });

  /* Необработанный сбой сети где-то в коде страницы — не молчим. Всё
     остальное оставляем консоли: чужие ошибки пугать людей не должны. */
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason;
    if (r && (r.name === 'TypeError' && /fetch|network|Load failed/i.test(String(r.message)))) {
      show({ network: true }, { key: 'net' });
    }
  });

  window.SkyErrors = { classify, message, show, success, fetch: request, icon: svg };
  Sky.errors = window.SkyErrors;
})();
