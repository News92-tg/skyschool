/* ============================================================
   SkyySchool — проверка ДЗ по фото: общее для photo.html

   Здесь то, чем пользуются оба режима страницы (ученик и учитель):
     запросы к Worker (AI_BASE_ORDERS) с входом ученика и потоком прогресса,
     тариф и лимит запросов с обратным отсчётом,
     окно «Тарифы» и заявка на оплату,
     счётчик потраченных токенов,
     сжатие фото перед загрузкой.
   Режим учителя — assets/photo-teacher.js.
   Ключей моделей здесь нет и быть не должно: они только в Worker.
   ============================================================ */
'use strict';

window.SkyCheck = (function () {

  Sky.extendDict({
    tariffsBtn:{ru:'Тарифы',en:'Plans'},
    tariffsH:{ru:'Тарифы',en:'Plans'},
    tariffsNow:{ru:'Ваш тариф: %1',en:'Your plan: %1'},
    planFree:{ru:'Бесплатный',en:'Free'},
    planPaid:{ru:'Платный',en:'Paid'},
    planPremium:{ru:'Премиум',en:'Premium'},
    planLine:{ru:'%1 · до %2 фото',en:'%1 · up to %2 photos'},
    perWindow:{ru:'%1 запрос / %2',en:'%1 request / %2'},
    perWindowN:{ru:'%1 запроса / %2',en:'%1 requests / %2'},
    minN:{ru:'%1 мин',en:'%1 min'},
    minOne:{ru:'мин',en:'min'},
    tfFree1:{ru:'1 запрос / 10 мин',en:'1 request / 10 min'},
    tfFree2:{ru:'до 5 фото за раз',en:'up to 5 photos at once'},
    tfFree3:{ru:'проверка, оценка, коротко или подробно',en:'check, mark, short or detailed'},
    tfPaid1:{ru:'1 запрос / мин',en:'1 request / min'},
    tfPaid2:{ru:'до 10 фото за раз',en:'up to 10 photos at once'},
    tfPaid3:{ru:'сверка с решением ИИ',en:'comparison with the AI solution'},
    tfPrem1:{ru:'3 запроса / мин',en:'3 requests / min'},
    tfPrem2:{ru:'до 20 фото за раз',en:'up to 20 photos at once'},
    tfPrem3:{ru:'режим учителя: класс, тесты, ДЗ по ссылкам',en:'teacher mode: class, tests, homework by link'},
    tfPrem4:{ru:'проверка на списывание',en:'cheating check'},
    tfPrem5:{ru:'отчёты CSV',en:'CSV reports'},
    tfAddon:{ru:'Проверка на списывание — разово',en:'Cheating check — one-off'},
    tfCurrent:{ru:'Ваш тариф',en:'Current'},
    buyBtn:{ru:'Купить',en:'Buy'},
    rub:{ru:'%1 ₽',en:'%1 ₽'},
    paySoon:{ru:'Оплата скоро. Заявку запомнили — подключим оплату и напишем.',en:'Payments are coming soon. Your request is saved.'},
    buyLogin:{ru:'Войдите, чтобы оформить тариф.',en:'Sign in to get a plan.'},
    closeBtn:{ru:'Закрыть',en:'Close'},
    waitNext:{ru:'Лимит тарифа: следующая проверка через %1',en:'Plan limit: next check in %1'},
    tokLine:{ru:'Потрачено: %1 токенов (~%2 ₽)',en:'Spent: %1 tokens (~%2 ₽)'},
    errSession:{ru:'Сессия истекла. Войдите заново.',en:'Your session has expired. Please sign in again.'},
    errLogin:{ru:'Войдите в аккаунт.',en:'Please sign in.'},
    errTariff:{ru:'Это доступно в другом тарифе.',en:'This needs another plan.'},
    errZaiLimit:{ru:'Слишком много запросов к модели (лимит Z.AI), попробуйте через минуту',en:'Too many requests to the model (Z.AI limit), try again in a minute'},
    errBadImg:{ru:'Модель не смогла открыть фото. Попробуйте ещё раз или выберите другое.',en:'The model could not open the photo. Try again or pick another one.'},
    errStorage:{ru:'Хранилище не настроено. Сообщите администратору.',en:'Storage is not configured. Tell the administrator.'},
    errGroqLimit:{ru:'Лимит Groq, подождите',en:'Groq limit reached, please wait'},
    errTooLong:{ru:'Текст слишком длинный, разбейте на части',en:'The text is too long, split it into parts'},
    errNoText:{ru:'Вставьте текст сочинения',en:'Paste the essay text'}
  });

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const base = () => (Sky.cfg.AI_BASE_ORDERS || Sky.cfg.AI_BASE || '').trim().replace(/\/+$/, '');
  const hasWorker = () => /^https?:\/\//i.test(base());

  /* Ключи совпадают с Worker; русские названия он тоже понимает. */
  const SUBJECTS = [
    ['physics',   { ru: 'Физика',     en: 'Physics' }],
    ['algebra',   { ru: 'Алгебра',    en: 'Algebra' }],
    ['geometry',  { ru: 'Геометрия',  en: 'Geometry' }],
    ['russian',   { ru: 'Русский',    en: 'Russian' }],
    ['chemistry', { ru: 'Химия',      en: 'Chemistry' }],
    ['biology',   { ru: 'Биология',   en: 'Biology' }],
    ['history',   { ru: 'История',    en: 'History' }],
    ['english',   { ru: 'Английский', en: 'English' }],
    ['other',     { ru: 'Другое',     en: 'Other' }]
  ];
  const subjName = k => { const s = SUBJECTS.find(x => x[0] === k); return s ? Sky.L(s[1]) : ''; };
  const planName = p => Sky.t(p === 'premium' ? 'planPremium' : p === 'paid' ? 'planPaid' : 'planFree');


  /* ---------- сжатие ----------

     Параметры из задания: длинная сторона до 1600 px, JPEG 0.8, не
     больше 1,5 МБ. Если на 0.8 файл тяжелее — снижаем качество, если и
     на 0.5 не влезает — уменьшаем стороны. canvas.toBlob, а не
     toDataURL: base64 на треть длиннее и держит копию в памяти.

     Поворот: снимки с телефона часто лежат «боком» и поворачиваются
     меткой EXIF. createImageBitmap по умолчанию эту метку в части
     браузеров игнорирует, поэтому просим учитывать её явно. */
  const MAX_SIDE = 1600;
  const MAX_BYTES = 1.5 * 1024 * 1024;

  async function loadBitmap(blob) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) {}
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally { URL.revokeObjectURL(url); }
  }

  async function compress(blob) {
    const src = await loadBitmap(blob);
    const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
    let scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale));
        c.height = Math.max(1, Math.round(h * scale));
        const g = c.getContext('2d');
        /* У png бывает прозрачный фон; в JPEG он стал бы чёрным, и
           чёрная ручка на нём пропала бы. */
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(src, 0, 0, c.width, c.height);
        for (const q of [0.8, 0.7, 0.6, 0.5]) {
          const out = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
          if (out && out.size <= MAX_BYTES) { c.width = c.height = 0; return out; }
        }
        c.width = c.height = 0;          /* отдать память до следующей попытки */
        scale *= 0.8;
      }
    } finally {
      if (src.close) src.close();
    }
    throw new Error('too_big');
  }


  /* ---------- запросы к Worker ----------

     Возвращает { ok, status, data } и никогда не бросает: сеть,
     таймаут и ошибки сервера приходят тем же объектом (timeout /
     network), чтобы на страницах был один путь обработки.

     onProgress — для долгих проверок учителя: Worker шлёт строки
     NDJSON, последняя — итог. timeout тогда считается от последней
     строки, а не от начала: класс из 30 работ идёт минуты. */
  async function authHeaders() {
    try {
      await Sky.db.ready;
      const t = await Sky.db.token();
      return t ? { Authorization: 'Bearer ' + t } : {};
    } catch (e) { return {}; }
  }

  async function request(path, o) {
    o = o || {};
    const ctl = new AbortController();
    let timer = null;
    const arm = () => { clearTimeout(timer); if (o.timeout) timer = setTimeout(() => ctl.abort(), o.timeout); };
    arm();
    const headers = Object.assign(await authHeaders(), o.headers || {});
    let body = o.body;
    if (o.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
    if (o.onProgress) headers.Accept = 'application/x-ndjson';
    try {
      const r = await fetch(base() + path, { method: o.method || 'GET', headers, body, signal: ctl.signal });
      const ctype = r.headers.get('Content-Type') || '';
      if (o.onProgress && r.ok && ctype.includes('ndjson') && r.body && r.body.getReader) {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = '', final = null;
        for (;;) {
          arm();
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let msg = null;
            try { msg = JSON.parse(line); } catch (e) { continue; }
            if (msg.type === 'progress') { try { o.onProgress(msg); } catch (e) {} }
            else if (msg.type === 'result') final = msg;
          }
        }
        clearTimeout(timer);
        if (!final) return { ok: false, status: 502, data: null };
        const status = final.status || 200;
        delete final.type; delete final.status;
        return { ok: status < 300, status, data: final };
      }
      const text = await r.text();
      clearTimeout(timer);
      let data = null;
      try { data = JSON.parse(text); } catch (e) {}
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      clearTimeout(timer);
      const timeout = !!(e && e.name === 'AbortError');
      return { ok: false, status: 0, data: null, timeout, network: !timeout };
    }
  }

  /* Текст ошибки для человека. Сначала по коду из ответа Worker —
     401 бывает и «сессия истекла», и «ключ модели неверен», по одному
     статусу их не различить. */
  function errorText(res) {
    const d = (res && res.data) || {};
    if (res.timeout) return Sky.t('errTimeout');
    if (res.network) return Sky.t('aiNoNet');
    switch (d.code) {
      case 'session':         return Sky.t('errSession');
      case 'login':           return Sky.t('errLogin');
      case 'tariff':          return d.error || Sky.t('errTariff');
      case 'rate_limit':      return Sky.t('waitNext').replace('%1', clock(d.retry_after || 60));
      case 'zai_limit':       return Sky.t('errZaiLimit');
      case 'zai_key':         return Sky.t('errKey');
      case 'zai_timeout':     return Sky.t('errTimeout');
      case 'zai_bad_request': case 'bad_img': return Sky.t('errBadImg');
      case 'zai_down':        return Sky.t('errDown');
      case 'no_photo':        return Sky.t('errNoPhoto');
      case 'storage':         return Sky.t('errStorage');
      case 'bad_param':       return d.error || Sky.t('errDown');
      case 'groq_limit':      return Sky.t('errGroqLimit');
      case 'groq_key':        return Sky.t('errKey');
      case 'groq_timeout':    return Sky.t('errTimeout');
      case 'groq_down':       return Sky.t('errDown');
      case 'too_long':        return Sky.t('errTooLong');
      case 'no_text':         return Sky.t('errNoText');
    }
    if (res.status === 400) return Sky.t('errNoPhoto');
    if (res.status === 401) return Sky.t('errKey');
    if (res.status === 402) return d.error || Sky.t('errTariff');
    if (res.status === 429) return Sky.t('errRate');
    if (res.status >= 500 || !res.status) return Sky.t('errDown');
    return d.error || (Sky.lang === 'en' ? 'Error ' : 'Ошибка ') + res.status;
  }

  /* Проверка одной работы (одно или несколько фото).
     Если Worker ещё старый и прислал ответ Z.AI как есть, приводим его
     к тому же виду: текст разбора — в legacy_text. */
  async function checkPhoto(p) {
    const qs = new URLSearchParams();
    p.imgs.forEach(u => qs.append('img', u));
    qs.set('mode', p.mode || 'check');
    if (p.subject) qs.set('subject', p.subject);
    if (p.task) qs.set('task', p.task);
    if (p.grade) qs.set('grade', 'true');
    if (p.gradeText) qs.set('grade_text', 'true');
    if (p.accuracy) qs.set('accuracy', 'true');
    qs.set('length', p.length === 'short' ? 'short' : 'long');
    const res = await request('/api/check-photo?' + qs, { timeout: p.timeout });

    const d = res.data;
    if (res.ok && d && !('recognized_text' in d) && !('errors' in d) && (d.choices || d.error)) {
      if (d.error) {
        const code = String(d.error.code || '');
        const status = /^100[0-4]$/.test(code) ? 401 : /^130[2-5]$/.test(code) ? 429 : 502;
        return { ok: false, status, data: { code: status === 401 ? 'zai_key' : status === 429 ? 'zai_limit' : 'zai_down' } };
      }
      const msg = d.choices && d.choices[0] && d.choices[0].message;
      const text = String((msg && msg.content) || '').replace(/<\|(?:begin|end)_of_box\|>/g, '').trim();
      return text ? { ok: true, status: 200, data: { legacy_text: text, tokens_used: usageOf(d.usage) } }
                  : { ok: false, status: 502, data: { code: 'zai_down' } };
    }
    return res;
  }
  const usageOf = u => u ? { prompt: u.prompt_tokens | 0, completion: u.completion_tokens | 0, total: u.total_tokens | 0 } : null;


  /* ---------- тариф и лимит ---------- */
  let limits = null;            // ответ /api/limits; null — неизвестно (Worker старый или недоступен)
  let nextAt = 0;               // когда можно следующий запрос, мс
  let ticker = null;
  const listeners = [];

  const clock = sec => {
    sec = Math.max(0, Math.ceil(sec));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  };
  const waitLeft = () => Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
  const canRequest = () => waitLeft() === 0;

  function notify() {
    listeners.forEach(cb => { try { cb(); } catch (e) { console.warn(e); } });
    renderWait();
  }

  function runTicker() {
    clearInterval(ticker);
    if (!waitLeft()) return;
    ticker = setInterval(() => {
      if (!waitLeft()) {
        clearInterval(ticker);
        loadLimits();           /* окно кончилось — спросим у сервера, что теперь */
        return;
      }
      notify();
    }, 1000);
  }

  function setWait(sec) {
    nextAt = sec > 0 ? Date.now() + sec * 1000 : 0;
    runTicker();
    notify();
  }

  /* Одновременные вызовы (вход, окончание окна, старт страницы)
     склеиваются в один запрос. */
  let inflight = null;
  function loadLimits() {
    if (inflight) return inflight;
    inflight = (async () => {
      if (!hasWorker()) { limits = null; notify(); return null; }
      const res = await request('/api/limits', { timeout: 10000 });
      if (res.ok && res.data && res.data.plan) {
        limits = res.data;
        setWait(res.data.rate && !res.data.rate.allowed ? res.data.rate.retry_after : 0);
      } else {
        limits = null;
        notify();
      }
      return limits;
    })().finally(() => { inflight = null; });
    return inflight;
  }

  /* После ответа проверки: сколько осталось в окне. */
  function applyRate(rate) {
    if (!rate) return;
    if (limits) limits.rate = Object.assign({}, limits.rate, rate);
    setWait(rate.remaining === 0 ? (rate.retry_after || rate.reset_in || 0) : 0);
  }

  const feature = name => !!(limits && limits.features && limits.features[name]);
  const photoCap = () => (limits && limits.limits && limits.limits.photos) || 5;
  const planId = () => limits ? limits.plan : null;

  function windowText(l) {
    const n = l.requests, sec = l.window_seconds;
    const per = sec === 60 ? Sky.t('minOne') : Sky.t('minN').replace('%1', Math.round(sec / 60));
    return Sky.t(n === 1 ? 'perWindow' : 'perWindowN').replace('%1', n).replace('%2', per);
  }
  function planSummary() {
    if (!limits) return '';
    return Sky.t('planLine').replace('%1', windowText(limits.limits)).replace('%2', limits.limits.photos);
  }

  /* Все элементы .js-wait показывают обратный отсчёт. */
  function renderWait() {
    const left = waitLeft();
    document.querySelectorAll('.js-wait').forEach(el => {
      el.classList.toggle('hidden', !left);
      if (left) el.textContent = Sky.t('waitNext').replace('%1', clock(left));
    });
  }


  /* ---------- окно «Тарифы» ---------- */
  const TARIFFS = [
    { id: 'free',    price: 0,   lines: ['tfFree1', 'tfFree2', 'tfFree3'] },
    { id: 'paid',    price: 59,  lines: ['tfPaid1', 'tfPaid2', 'tfPaid3'], purpose: 'paid_tariff' },
    { id: 'premium', price: 209, lines: ['tfPrem1', 'tfPrem2', 'tfPrem3', 'tfPrem4', 'tfPrem5'], purpose: 'premium_tariff' }
  ];
  const PLAGIARISM_PRICE = 40;

  function openTariffs(focus) {
    const cur = planId() || 'free';
    const card = t => `
      <div class="tf-card${t.id === cur ? ' current' : ''}${t.id === focus ? ' focus' : ''}">
        <div class="tf-head">
          <b>${esc(planName(t.id))}</b>
          <span class="tf-price">${esc(Sky.t('rub').replace('%1', t.price))}</span>
        </div>
        <ul>${t.lines.map(k => `<li>${esc(Sky.t(k))}</li>`).join('')}</ul>
        ${t.id === cur ? `<span class="tag ok">${esc(Sky.t('tfCurrent'))}</span>`
          : t.purpose ? `<button type="button" class="btn small" data-buy="${t.purpose}">${esc(Sky.t('buyBtn'))}</button>` : ''}
      </div>`;
    Sky.modal(`
      <div class="pw tariffs">
        <h2>${esc(Sky.t('tariffsH'))}</h2>
        <p class="pw-lead">${esc(Sky.t('tariffsNow').replace('%1', planName(cur)))}</p>
        <div class="tf-list">${TARIFFS.map(card).join('')}</div>
        <div class="tf-card addon${focus === 'plagiarism' ? ' focus' : ''}">
          <div class="tf-head">
            <b>${esc(Sky.t('tfAddon'))}</b>
            <span class="tf-price">+${esc(Sky.t('rub').replace('%1', PLAGIARISM_PRICE))}</span>
          </div>
          ${feature('plagiarism') ? `<span class="tag ok">${esc(Sky.t('tfCurrent'))}</span>`
            : `<button type="button" class="btn small" data-buy="plagiarism">${esc(Sky.t('buyBtn'))}</button>`}
        </div>
        <div class="pw-actions"><button type="button" class="btn ghost" data-close>${esc(Sky.t('closeBtn'))}</button></div>
      </div>`,
      (box, close) => {
        box.querySelector('[data-close]').addEventListener('click', close);
        box.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => buy(b.dataset.buy, b, close)));
        const f = box.querySelector('.focus');
        if (f) f.scrollIntoView({ block: 'nearest' });
      });
  }

  /* Оплата не подключена: оставляем заявку (pending) и честно говорим
     «скоро». Сумму ставит Worker по справочнику тарифов. */
  async function buy(purpose, btn, close) {
    if (!(Sky.db && Sky.db.me && Sky.db.me())) {
      Sky.toast(Sky.t('buyLogin'), 5000);
      close();
      if (Sky.auth && Sky.auth.openAuth) Sky.auth.openAuth();
      return;
    }
    btn.disabled = true;
    const res = hasWorker() ? await request('/api/payments', { method: 'POST', json: { purpose }, timeout: 15000 }) : null;
    if (res && !res.ok && res.data && res.data.code === 'session') { Sky.toast(Sky.t('errSession'), 5000); btn.disabled = false; return; }
    Sky.toast(Sky.t('paySoon'), 6000);
  }

  /* Кнопка «Тарифы» в шапке. Шапку core.js перерисовывает при смене
     языка, поэтому вставляем заново на каждый headerready. */
  function mountHeaderButton() {
    const slot = document.getElementById('accountSlot');
    if (!slot || document.getElementById('tariffsHdr')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'tariffsHdr';
    b.className = 'btn ghost small tariffs-hdr';
    b.textContent = Sky.t('tariffsBtn');
    b.addEventListener('click', () => openTariffs());
    slot.parentNode.insertBefore(b, slot);
  }
  document.addEventListener('headerready', mountHeaderButton);
  if (document.readyState !== 'loading') mountHeaderButton();
  else document.addEventListener('DOMContentLoaded', mountHeaderButton);


  /* ---------- счётчик токенов за сессию ----------
     Цена — в assets/config.js (TOKEN_PRICE_RUB, ₽ за 1 млн токенов). */
  const TOK_KEY = 'skyCheckTokens';
  let tokMem = { prompt: 0, completion: 0, total: 0 };
  function tokens() {
    try {
      const v = JSON.parse(sessionStorage.getItem(TOK_KEY));
      if (v && typeof v.total === 'number') return v;
    } catch (e) {}
    return tokMem;
  }
  function addTokens(u) {
    if (!u || !u.total) return;
    const t = tokens();
    tokMem = { prompt: t.prompt + (u.prompt | 0), completion: t.completion + (u.completion | 0), total: t.total + (u.total | 0) };
    try { sessionStorage.setItem(TOK_KEY, JSON.stringify(tokMem)); } catch (e) {}
    renderTokens();
  }
  function rubOf(t) {
    const price = Sky.cfg.TOKEN_PRICE_RUB || {};
    return (t.prompt * (price.input || 0) + t.completion * (price.output || 0)) / 1e6;
  }
  function renderTokens() {
    const el = document.getElementById('tokenLine');
    if (!el) return;
    const t = tokens();
    const rub = rubOf(t);
    el.textContent = Sky.t('tokLine')
      .replace('%1', t.total.toLocaleString(Sky.lang === 'en' ? 'en-US' : 'ru-RU'))
      .replace('%2', rub < 0.01 ? '0' : rub.toFixed(2).replace('.', Sky.lang === 'en' ? '.' : ','));
  }


  /* ---------- CSV в браузере (для таблиц, собранных на странице) ---------- */
  function csvDataUrl(header, rows) {
    const cell = v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const text = [header].concat(rows).map(r => r.map(cell).join(',')).join('\r\n');
    return 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + text);
  }
  function download(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  document.addEventListener('langchange', () => { renderWait(); renderTokens(); });
  /* Вошёл, вышел, сменил аккаунт — тариф и лимит другие. */
  document.addEventListener('authchange', () => { loadLimits(); });
  if (Sky.db && Sky.db.ready) Sky.db.ready.then(() => loadLimits());

  return {
    esc, hasWorker, SUBJECTS, subjName, planName,
    compress,
    request, errorText, checkPhoto,
    loadLimits, applyRate, setWait, canRequest, waitLeft, clock,
    feature, photoCap, planId, planSummary, get limits() { return limits; },
    onChange: cb => listeners.push(cb),
    openTariffs,
    addTokens, renderTokens,
    csvDataUrl, download
  };
})();
