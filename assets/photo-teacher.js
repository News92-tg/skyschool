/* ============================================================
   SkyySchool — режим учителя на странице «Домашка по фото»

   Три вкладки:
     Проверка класса  — по фото на ученика → POST /api/check-teacher-report
     Проверка теста   — эталон + работы     → POST /api/check-test
     ДЗ по ссылкам    — ученик отправляет работу (POST /api/submit-homework)
                        и получает ссылку; учитель вставляет ссылки,
                        работы открываются (GET /api/homework/:id) и
                        проверяются тем же отчётом по классу.
   Класс, тест и проверка по ссылкам — тариф Премиум (решает Worker,
   здесь только подсказка). Отправить работу по ссылке может каждый.
   Общее (запросы, тарифы, сжатие) — assets/photo-api.js.
   ============================================================ */
'use strict';

(function () {
  Sky.extendDict({
    tTabClass:{ru:'Проверка класса',en:'Class check'},
    tTabTest:{ru:'Проверка теста',en:'Test check'},
    tTabLinks:{ru:'ДЗ по ссылкам',en:'Homework by link'},
    tLock:{ru:'Проверка класса, тестов и работ по ссылкам — в тарифе Премиум. Отправить работу учителю по ссылке может каждый.',
           en:'Class, test and link checks are in the Premium plan. Anyone can send their work to a teacher by link.'},
    tSubject:{ru:'Предмет',en:'Subject'},
    tClassAll:{ru:'Класс (для всех)',en:'Class (for everyone)'},
    tClassPh:{ru:'9А',en:'9A'},
    tPickMany:{ru:'Выбрать фото (до 30)',en:'Pick photos (up to 30)'},
    tNameHint:{ru:'ФИО можно не вписывать, если оно подписано на работе, — модель прочитает.',
               en:'Names are optional if they are written on the work — the model will read them.'},
    tRunClass:{ru:'Проверить класс',en:'Check the class'},
    tRunTest:{ru:'Проверить тест',en:'Check the test'},
    tResults:{ru:'Результаты',en:'Results'},
    tCsv:{ru:'Скачать CSV',en:'Download CSV'},
    tRefLabel:{ru:'Эталон — фото с правильными ответами',en:'Answer key — a photo with the correct answers'},
    tRefPick:{ru:'Выбрать фото эталона',en:'Pick the answer key photo'},
    tRef:{ru:'Эталон',en:'Answer key'},
    tTotal:{ru:'Всего вопросов',en:'Questions in total'},
    tWorksLabel:{ru:'Работы учеников',en:'Students\' work'},
    namePh:{ru:'ФИО',en:'Name'},
    classPh:{ru:'Класс',en:'Class'},
    rmRow:{ru:'Убрать',en:'Remove'},
    tPgUpload:{ru:'Загружаю фото %1 из %2',en:'Uploading photo %1 of %2'},
    tPgStart:{ru:'Проверяю работы: это займёт по 5–15 секунд на каждую...',en:'Checking the work: 5–15 seconds each...'},
    tPgCheck:{ru:'Проверено %1 из %2',en:'Checked %1 of %2'},
    tNeedPhotos:{ru:'Добавьте фото работ',en:'Add photos of the work'},
    tNeedRef:{ru:'Добавьте фото эталона',en:'Add the answer key photo'},
    tTooMany:{ru:'Не больше 30 фото — лишние не добавлены.',en:'At most 30 photos — the rest were not added.'},
    needLoginT:{ru:'Войдите: фото работ загружаются в ваше хранилище.',en:'Sign in: photos are uploaded to your storage.'},
    colN:{ru:'№',en:'#'},
    colName:{ru:'ФИО',en:'Name'},
    colClass:{ru:'Класс',en:'Class'},
    colGrade:{ru:'Оценка',en:'Mark'},
    colErrors:{ru:'Ошибок',en:'Mistakes'},
    colComment:{ru:'Комментарий',en:'Comment'},
    colScore:{ru:'Верно',en:'Correct'},
    colMistakes:{ru:'Ошибки',en:'Mistakes'},
    sumAvg:{ru:'средний балл',en:'average mark'},
    sumAvgPct:{ru:'средний результат',en:'average score'},
    sumChecked:{ru:'проверено',en:'checked'},
    sumFailed:{ru:'не удалось',en:'failed'},
    failedRow:{ru:'Не проверено: %1',en:'Not checked: %1'},
    errList:{ru:'Ошибки (%1)',en:'Mistakes (%1)'},
    lSendH:{ru:'Ученику: отправить работу учителю',en:'Student: send your work to the teacher'},
    lSendLead:{ru:'Входить не обязательно. Получите ссылку и отправьте её учителю.',en:'No sign-in needed. Get a link and send it to your teacher.'},
    lName:{ru:'ФИО',en:'Full name'},
    lClass:{ru:'Класс',en:'Class'},
    lSendBtn:{ru:'Отправить',en:'Send'},
    lSending:{ru:'Отправляю...',en:'Sending...'},
    lCopy:{ru:'Скопировать ссылку',en:'Copy link'},
    lCopied:{ru:'Ссылка скопирована',en:'Link copied'},
    lSent:{ru:'Работа отправлена. Отправьте ссылку учителю.',en:'Sent. Now send the link to your teacher.'},
    lNeedName:{ru:'Впишите ФИО',en:'Enter your name'},
    lNeedPhoto:{ru:'Выберите фото работы',en:'Pick a photo of your work'},
    lCheckH:{ru:'Учителю: проверить работы по ссылкам',en:'Teacher: check work by links'},
    lCheckLead:{ru:'Вставьте ссылки от учеников — по одной в строке, до 30.',en:'Paste the links from students — one per line, up to 30.'},
    lLinks:{ru:'Ссылки',en:'Links'},
    lLinksPh:{ru:'https://…/photo.html?hw=…',en:'https://…/photo.html?hw=…'},
    lResolve:{ru:'Открыть работы',en:'Open the work'},
    lRun:{ru:'Проверить все',en:'Check all'},
    lNoLinks:{ru:'Не нашёл ссылок на работы',en:'No work links found'},
    lNotFound:{ru:'работа не найдена',en:'not found'},
    stPending:{ru:'ждёт проверки',en:'waiting'},
    stChecked:{ru:'проверена',en:'checked'},
    stFailed:{ru:'не удалось',en:'failed'}
  });

  const $ = s => document.querySelector(s);
  const esc = SkyCheck.esc;
  /* Страница применила переводы раньше, чем загрузился этот файл, —
     свои строки проставляем сами. Дальше, при смене языка, их
     подхватывает общий applyI18n из core.js. */
  Sky.applyI18n($('#teacherMode'));
  const MAX = 30;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_INPUT_MB = 20;
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  let busy = false;
  const csv = {};

  /* ---------- вкладки ---------- */
  let tab = Sky.get('teacherTab', 'class');
  function setTab(t) {
    tab = ['class', 'test', 'links'].includes(t) ? t : 'class';
    ['class', 'test', 'links'].forEach(n => $('#tab-' + n).classList.toggle('hidden', n !== tab));
    $('#tTabs').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    Sky.set('teacherTab', tab);
  }
  $('#tTabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]');
    if (b) setTab(b.dataset.tab);
  });

  function renderLock() {
    $('#tLock').classList.toggle('hidden', SkyCheck.feature('teacher'));
    renderButtons();
  }
  $('#tLockBtn').addEventListener('click', () => SkyCheck.openTariffs('premium'));

  /* ---------- предметы в выпадающих списках ---------- */
  function renderSubjects() {
    document.querySelectorAll('select.js-subjects').forEach(sel => {
      const cur = sel.value || Sky.get('hwSubject', 'physics');
      sel.innerHTML = SkyCheck.SUBJECTS.map(([id]) =>
        `<option value="${id}"${id === cur ? ' selected' : ''}>${esc(SkyCheck.subjName(id))}</option>`).join('');
    });
  }

  /* ---------- список фото с ФИО и классом ---------- */
  function goodFiles(list) {
    const good = [];
    let bad = 0, heavy = 0;
    for (const f of list) {
      if (!OK_TYPES.includes(f.type)) { bad++; continue; }
      if (f.size > MAX_INPUT_MB * 1024 * 1024) { heavy++; continue; }
      good.push(f);
    }
    if (bad) Sky.toast(Sky.t('badType'), 5000);
    else if (heavy) Sky.toast(Sky.t('tooHeavy'), 5000);
    return good;
  }

  function roster(el, opts) {
    const r = { items: [] };
    r.add = files => {
      let dropped = 0;
      for (const f of files) {
        if (r.items.length >= opts.max) { dropped++; continue; }
        r.items.push({ blob: f, url: URL.createObjectURL(f), name: '', cls: '' });
      }
      if (dropped && opts.max > 1) Sky.toast(Sky.t('tTooMany'), 5000);
      r.render();
    };
    r.clear = () => { r.items.forEach(it => URL.revokeObjectURL(it.url)); r.items = []; r.render(); };
    r.render = () => {
      el.innerHTML = r.items.map((it, i) => opts.meta
        ? `<div class="roster-row">
             <img src="${it.url}" alt="">
             <input type="text" data-i="${i}" data-k="name" maxlength="100" value="${esc(it.name)}" placeholder="${esc(Sky.t('namePh'))}" aria-label="${esc(Sky.t('namePh'))} ${i + 1}">
             <input type="text" data-i="${i}" data-k="cls" maxlength="20" value="${esc(it.cls)}" placeholder="${esc(Sky.t('classPh'))}" aria-label="${esc(Sky.t('classPh'))} ${i + 1}">
             <button type="button" class="rm" data-rm="${i}" aria-label="${esc(Sky.t('rmRow'))}">×</button>
           </div>`
        : `<div class="roster-row ref">
             <img src="${it.url}" alt="">
             <div class="who-line">${esc(opts.label ? Sky.t(opts.label) : '')}</div>
             <button type="button" class="rm" data-rm="${i}" aria-label="${esc(Sky.t('rmRow'))}">×</button>
           </div>`).join('');
      if (opts.onChange) opts.onChange();
      renderButtons();
    };
    el.addEventListener('input', e => {
      const inp = e.target.closest('input[data-i]');
      if (inp) r.items[Number(inp.dataset.i)][inp.dataset.k] = inp.value;
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-rm]');
      if (!b || busy) return;
      const [it] = r.items.splice(Number(b.dataset.rm), 1);
      if (it) URL.revokeObjectURL(it.url);
      r.render();
    });
    return r;
  }

  function bindPicker(btn, input, target) {
    $(btn).addEventListener('click', () => $(input).click());
    $(input).addEventListener('change', e => {
      const files = goodFiles(Array.from(e.target.files || []));
      e.target.value = '';
      if (target.single) target.clear();
      if (files.length) target.add(target.single ? files.slice(0, 1) : files);
    });
  }

  const classList = roster($('#cRoster'), { max: MAX, meta: true, onChange: () => $('#cClear').classList.toggle('hidden', !classList.items.length) });
  const refList = Object.assign(roster($('#tRef'), { max: 1, meta: false, label: 'tRef' }), { single: true });
  const testList = roster($('#tRoster'), { max: MAX, meta: true, onChange: () => $('#tClear').classList.toggle('hidden', !testList.items.length) });
  const sendList = Object.assign(roster($('#lPhoto'), { max: 1, meta: false }), { single: true });
  bindPicker('#cPick', '#cFiles', classList);
  bindPicker('#tRefPick', '#tRefFile', refList);
  bindPicker('#tPick', '#tFiles', testList);
  bindPicker('#lPick', '#lFile', sendList);
  $('#cClear').addEventListener('click', () => { if (!busy) classList.clear(); });
  $('#tClear').addEventListener('click', () => { if (!busy) testList.clear(); });

  /* ---------- состояние кнопок ---------- */
  let resolved = [];          // работы по ссылкам, открытые для проверки
  function renderButtons() {
    const wait = !SkyCheck.canRequest();
    $('#cRun').disabled = busy || wait || !classList.items.length;
    $('#tRun').disabled = busy || wait || !testList.items.length || !refList.items.length;
    $('#lRun').disabled = busy || wait || !resolved.some(r => r.ok);
    $('#lSend').disabled = busy || !sendList.items.length;
    ['#cPick', '#tPick', '#tRefPick', '#lPick', '#lResolve'].forEach(s => { $(s).disabled = busy; });
  }
  function setBusy(on) {
    busy = on;
    document.querySelectorAll('#teacherMode .roster input').forEach(i => { i.disabled = on; });
    renderButtons();
  }

  /* ---------- прогресс ---------- */
  function prog(box, text, share) {
    box.classList.remove('hidden');
    box.querySelector('.progress-text').textContent = text;
    const bar = box.querySelector('.progress-bar');
    bar.classList.toggle('indef', share == null);
    bar.querySelector('i').style.width = share == null ? '' : Math.round(share * 100) + '%';
  }
  const progDone = box => box.classList.add('hidden');

  /* ---------- перед учительской проверкой ---------- */
  function ready() {
    if (!SkyCheck.hasWorker()) { Sky.toast(Sky.t('needWorker'), 6000); return false; }
    if (!(Sky.db && Sky.db.me && Sky.db.me())) {
      Sky.toast(Sky.t('needLoginT'), 5000);
      if (Sky.auth && Sky.auth.openAuth) Sky.auth.openAuth();
      return false;
    }
    if (!SkyCheck.feature('teacher')) { SkyCheck.openTariffs('premium'); return false; }
    if (!SkyCheck.canRequest()) {
      Sky.toast(Sky.t('waitNext').replace('%1', SkyCheck.clock(SkyCheck.waitLeft())), 4000);
      return false;
    }
    return true;
  }

  /* Фото по одному: сжать → в своё хранилище → временная ссылка на час
     (класс из 30 работ проверяется минуты). */
  async function uploadAll(blobs, box) {
    const me = Sky.db.me();
    const session = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const paths = [], urls = [];
    try {
      for (let i = 0; i < blobs.length; i++) {
        prog(box, Sky.t('tPgUpload').replace('%1', i + 1).replace('%2', blobs.length), i / blobs.length);
        const small = await SkyCheck.compress(blobs[i]);
        const path = `${me.id}/${session}/${i + 1}.jpg`;
        await Sky.db.upload('homework', path, small, 'image/jpeg');
        paths.push(path);
      }
      for (const p of paths) urls.push(await Sky.db.signedUrl('homework', p, 3600));
    } catch (e) {
      await Sky.db.removeFiles('homework', paths);
      throw e;
    }
    return { paths, urls };
  }

  /* Ответ Worker: лимит, тариф, ошибка. */
  function afterRequest(res) {
    const d = res.data || {};
    if (d.code === 'rate_limit' && d.retry_after) SkyCheck.setWait(d.retry_after);
    else SkyCheck.loadLimits();
    if (res.status === 402 && d.code === 'tariff') SkyCheck.openTariffs(d.need);
    if (res.ok) SkyCheck.addTokens(d.tokens_used);
  }

  function showError(sec, box, text) {
    $(sec).classList.remove('hidden');
    $(box).innerHTML = `<div class="limit-note">${esc(text)}</div>`;
    $(sec).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const gradeBadge = g => typeof g === 'number'
    ? `<span class="gr g${g}">${g}</span>`
    : `<span class="gr gx">${esc(g == null || g === '' ? '—' : g)}</span>`;

  /* ---------- отчёт по классу (и по ссылкам) ---------- */
  function renderReport(sec, box, data) {
    const s = data.summary || {};
    const rows = (data.reports || []).map(r => {
      if (r.status !== 'ok') {
        return `<tr class="failed"><td>${r.index}</td><td>${esc(r.name || '—')}</td><td>${esc(r.class || '')}</td>
          <td>—</td><td>—</td><td>${esc(Sky.t('failedRow').replace('%1', r.error || ''))}</td></tr>`;
      }
      const errs = r.errors || [];
      return `<tr><td>${r.index}</td><td>${esc(r.name || '—')}</td><td>${esc(r.class || '')}</td>
        <td>${r.assessment === undefined ? '—' : gradeBadge(r.assessment)}</td><td>${r.errors_count}</td>
        <td>${esc(r.comment || '')}${errs.length ? `<details><summary>${esc(Sky.t('errList').replace('%1', errs.length))}</summary><ul>${errs.map(e =>
          `<li>${esc(e.fragment)}${e.correction ? ' → ' + esc(e.correction) : ''}${e.type ? ` <i>(${esc(e.type)})</i>` : ''}</li>`).join('')}</ul></details>` : ''}</td></tr>`;
    }).join('');
    $(box).innerHTML =
      `<div class="stats">
         <div class="stat accent"><b>${s.avg == null ? '—' : String(s.avg).replace('.', Sky.lang === 'en' ? '.' : ',')}</b><span>${esc(Sky.t('sumAvg'))}</span></div>
         <div class="stat ok"><b>${s.checked || 0}/${s.total || 0}</b><span>${esc(Sky.t('sumChecked'))}</span></div>
         <div class="stat"><b>${s.failed || 0}</b><span>${esc(Sky.t('sumFailed'))}</span></div>
       </div>
       <div class="table-wrap"><table class="rtable">
         <thead><tr><th>${esc(Sky.t('colN'))}</th><th>${esc(Sky.t('colName'))}</th><th>${esc(Sky.t('colClass'))}</th>
           <th>${esc(Sky.t('colGrade'))}</th><th>${esc(Sky.t('colErrors'))}</th><th>${esc(Sky.t('colComment'))}</th></tr></thead>
         <tbody>${rows}</tbody></table></div>`;
    $(sec).classList.remove('hidden');
    $(sec).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderTest(sec, box, data) {
    const s = data.summary || {};
    const rows = (data.students || []).map(st => st.status !== 'ok'
      ? `<tr class="failed"><td>${st.index}</td><td>${esc(st.name || '—')}</td><td>${esc(st.class || '')}</td>
           <td>—</td><td>—</td><td>${esc(Sky.t('failedRow').replace('%1', st.error || ''))}</td></tr>`
      : `<tr><td>${st.index}</td><td>${esc(st.name || '—')}</td><td>${esc(st.class || '')}</td>
           <td><b>${st.correct}/${st.total}</b></td><td>${st.percent}%</td>
           <td>${(st.errors || []).map(e => esc(Sky.t('resWrongQ').replace('%1', e.n).replace('%2', e.student).replace('%3', e.correct))).join('<br>') || '—'}</td></tr>`
    ).join('');
    $(box).innerHTML =
      `<div class="stats">
         <div class="stat accent"><b>${s.avg_percent == null ? '—' : s.avg_percent + '%'}</b><span>${esc(Sky.t('sumAvgPct'))}</span></div>
         <div class="stat ok"><b>${s.checked || 0}/${s.students || 0}</b><span>${esc(Sky.t('sumChecked'))}</span></div>
         <div class="stat"><b>${s.failed || 0}</b><span>${esc(Sky.t('sumFailed'))}</span></div>
       </div>
       <div class="table-wrap"><table class="rtable">
         <thead><tr><th>${esc(Sky.t('colN'))}</th><th>${esc(Sky.t('colName'))}</th><th>${esc(Sky.t('colClass'))}</th>
           <th>${esc(Sky.t('colScore'))}</th><th>%</th><th>${esc(Sky.t('colMistakes'))}</th></tr></thead>
         <tbody>${rows}</tbody></table></div>`;
    $(sec).classList.remove('hidden');
    $(sec).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- А) проверка класса ---------- */
  async function runClass() {
    if (busy || !ready()) return;
    const items = classList.items.slice();
    if (!items.length) { Sky.toast(Sky.t('tNeedPhotos'), 4000); return; }
    const box = $('#cProgress');
    setBusy(true);
    $('#cResultSec').classList.add('hidden');
    let up;
    try { up = await uploadAll(items.map(i => i.blob), box); }
    catch (e) { progDone(box); setBusy(false); Sky.toast(Sky.t('upFail'), 6000); return; }

    const defClass = $('#cClass').value.trim();
    prog(box, Sky.t('tPgStart'), null);
    const res = await SkyCheck.request('/api/check-teacher-report', {
      method: 'POST',
      json: {
        photos: items.map((it, i) => ({ img: up.urls[i], name: it.name.trim(), class: it.cls.trim() || defClass })),
        subject: $('#cSubject').value,
        grade: $('#cGrade').checked,
        task: $('#cTask').value.trim().slice(0, 800)
      },
      timeout: 180000,
      onProgress: m => prog(box, Sky.t('tPgCheck').replace('%1', m.done).replace('%2', m.total) + (m.name ? ' — ' + m.name : ''), m.done / m.total)
    });
    await Sky.db.removeFiles('homework', up.paths);
    progDone(box);
    setBusy(false);
    afterRequest(res);
    if (!res.ok) { showError('#cResultSec', '#cResult', SkyCheck.errorText(res)); return; }
    csv.class = res.data.csv_url;
    renderReport('#cResultSec', '#cResult', res.data);
  }

  /* ---------- Б) проверка теста ---------- */
  async function runTest() {
    if (busy || !ready()) return;
    if (!refList.items.length) { Sky.toast(Sky.t('tNeedRef'), 4000); return; }
    const items = testList.items.slice();
    if (!items.length) { Sky.toast(Sky.t('tNeedPhotos'), 4000); return; }
    const box = $('#tProgress');
    setBusy(true);
    $('#tResultSec').classList.add('hidden');
    let up;
    try { up = await uploadAll([refList.items[0].blob].concat(items.map(i => i.blob)), box); }
    catch (e) { progDone(box); setBusy(false); Sky.toast(Sky.t('upFail'), 6000); return; }

    const defClass = $('#tClass').value.trim();
    const total = parseInt($('#tTotal').value, 10);
    prog(box, Sky.t('tPgStart'), null);
    const res = await SkyCheck.request('/api/check-test', {
      method: 'POST',
      json: {
        reference_img: up.urls[0],
        student_imgs: items.map((it, i) => ({ img: up.urls[i + 1], name: it.name.trim(), class: it.cls.trim() || defClass })),
        subject: $('#tSubject').value,
        total: total >= 1 && total <= 200 ? total : null
      },
      timeout: 180000,
      onProgress: m => prog(box, Sky.t('tPgCheck').replace('%1', m.done).replace('%2', m.total), m.done / m.total)
    });
    await Sky.db.removeFiles('homework', up.paths);
    progDone(box);
    setBusy(false);
    afterRequest(res);
    if (!res.ok) { showError('#tResultSec', '#tResult', SkyCheck.errorText(res)); return; }
    csv.test = res.data.csv_url;
    renderTest('#tResultSec', '#tResult', res.data);
  }

  /* ---------- В) ученик отправляет работу ---------- */
  async function sendWork() {
    if (busy) return;
    const name = $('#lName').value.trim();
    if (!name) { Sky.toast(Sky.t('lNeedName'), 4000); $('#lName').focus(); return; }
    if (!sendList.items.length) { Sky.toast(Sky.t('lNeedPhoto'), 4000); return; }
    if (!SkyCheck.hasWorker()) { Sky.toast(Sky.t('needWorker'), 6000); return; }
    setBusy(true);
    $('#lSend').innerHTML = `<span class="spin"></span> ${esc(Sky.t('lSending'))}`;
    let res;
    try {
      const small = await SkyCheck.compress(sendList.items[0].blob);
      const qs = new URLSearchParams({ student_name: name, class: $('#lClass').value.trim(), subject: $('#lSubject').value });
      /* Картинка уходит как есть, без base64: так Worker не тратит
         процессор на раскодирование. */
      res = await SkyCheck.request('/api/submit-homework?' + qs, {
        method: 'POST', body: small, headers: { 'Content-Type': 'image/jpeg' }, timeout: 60000
      });
    } catch (e) {
      res = { ok: false, status: 0, data: null, failText: Sky.t('tooBig') };
    }
    setBusy(false);
    $('#lSend').textContent = Sky.t('lSendBtn');
    if (!res.ok) {
      Sky.toast(res.failText || SkyCheck.errorText(res), 6000);
      return;
    }
    $('#lUrl').value = res.data.url;
    $('#lOut').classList.remove('hidden');
    sendList.clear();
    Sky.toast(Sky.t('lSent'), 5000);
  }

  async function copyLink() {
    const inp = $('#lUrl');
    try {
      await navigator.clipboard.writeText(inp.value);
    } catch (e) {
      inp.select();
      try { document.execCommand('copy'); } catch (err) {}
    }
    Sky.toast(Sky.t('lCopied'), 3000);
  }

  /* ---------- В) учитель: работы по ссылкам ---------- */
  function linkIds() {
    const ids = ($('#lLinks').value.match(UUID_RE) || []).map(s => s.toLowerCase());
    return Array.from(new Set(ids)).slice(0, MAX);
  }

  async function resolveLinks() {
    if (busy) return;
    const ids = linkIds();
    if (!ids.length) { Sky.toast(Sky.t('lNoLinks'), 4000); resolved = []; renderResolved(); return; }
    setBusy(true);
    const box = $('#lProgress');
    resolved = [];
    for (let i = 0; i < ids.length; i++) {
      prog(box, Sky.t('tPgCheck').replace('%1', i).replace('%2', ids.length), i / ids.length);
      const res = await SkyCheck.request('/api/homework/' + ids[i], { timeout: 15000 });
      resolved.push(res.ok && res.data ? Object.assign({ ok: true }, res.data) : { ok: false, id: ids[i], error: res.status === 404 ? Sky.t('lNotFound') : SkyCheck.errorText(res) });
    }
    progDone(box);
    setBusy(false);
    /* Предмет для проверки — самый частый среди присланных работ. */
    const counts = {};
    resolved.filter(r => r.ok && r.subject).forEach(r => { counts[r.subject] = (counts[r.subject] || 0) + 1; });
    const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    if (top) $('#lCheckSubject').value = top;
    renderResolved();
  }

  function renderResolved() {
    const st = s => Sky.t(s === 'checked' ? 'stChecked' : s === 'failed' ? 'stFailed' : 'stPending');
    $('#lList').innerHTML = resolved.map(r => r.ok
      ? `<div class="roster-row ref">
           <img src="${esc(r.img_url)}" alt="" loading="lazy">
           <div class="who-line">${esc(r.student_name || '—')}${r.class ? ', ' + esc(r.class) : ''}
             <span>${esc(SkyCheck.subjName(r.subject) || '')}${r.subject ? ' · ' : ''}${esc(st(r.status))}</span></div>
           <span></span>
         </div>`
      : `<div class="roster-row ref"><span class="gr gx">?</span><div class="who-line">${esc(r.id)}<span>${esc(r.error)}</span></div><span></span></div>`
    ).join('');
    renderButtons();
  }

  async function runLinks() {
    if (busy || !ready()) return;
    const works = resolved.filter(r => r.ok);
    if (!works.length) return;
    const box = $('#lProgress');
    setBusy(true);
    $('#lResultSec').classList.add('hidden');
    prog(box, Sky.t('tPgStart'), null);
    const res = await SkyCheck.request('/api/check-teacher-report', {
      method: 'POST',
      json: {
        photos: works.map(w => ({ img: w.img_url, name: w.student_name || '', class: w.class || '', submission_id: w.id })),
        subject: $('#lCheckSubject').value,
        grade: $('#lGrade').checked
      },
      timeout: 180000,
      onProgress: m => prog(box, Sky.t('tPgCheck').replace('%1', m.done).replace('%2', m.total) + (m.name ? ' — ' + m.name : ''), m.done / m.total)
    });
    progDone(box);
    setBusy(false);
    afterRequest(res);
    if (!res.ok) { showError('#lResultSec', '#lResult', SkyCheck.errorText(res)); return; }
    csv.links = res.data.csv_url;
    renderReport('#lResultSec', '#lResult', res.data);
    /* статусы работ поменялись — показать их в списке */
    (res.data.reports || []).forEach(r => {
      const w = resolved.find(x => x.id === r.submission_id);
      if (w) w.status = r.status === 'ok' ? 'checked' : 'failed';
    });
    renderResolved();
  }

  /* ---------- события ---------- */
  $('#cRun').addEventListener('click', runClass);
  $('#tRun').addEventListener('click', runTest);
  $('#lSend').addEventListener('click', sendWork);
  $('#lCopy').addEventListener('click', copyLink);
  $('#lResolve').addEventListener('click', resolveLinks);
  $('#lRun').addEventListener('click', runLinks);
  $('#cCsv').addEventListener('click', () => csv.class && SkyCheck.download(csv.class, 'skyschool-class.csv'));
  $('#tCsv').addEventListener('click', () => csv.test && SkyCheck.download(csv.test, 'skyschool-test.csv'));
  $('#lCsv').addEventListener('click', () => csv.links && SkyCheck.download(csv.links, 'skyschool-links.csv'));
  $('#lSend').disabled = true;

  SkyCheck.onChange(renderLock);
  document.addEventListener('langchange', () => {
    renderSubjects(); classList.render(); testList.render(); refList.render(); sendList.render(); renderResolved();
  });

  /* ---------- запуск ---------- */
  renderSubjects();
  setTab(tab);
  renderLock();

  /* Ссылка на работу: photo.html?hw=<id> — сразу вкладка ссылок и
     предпросмотр работы. Проверка — по кнопке, она тратит лимит. */
  const hw = new URLSearchParams(location.search).get('hw');
  if (hw && UUID_RE.test(hw)) {
    UUID_RE.lastIndex = 0;
    setTab('links');
    $('#lLinks').value = location.href;
    resolveLinks();
  }
  UUID_RE.lastIndex = 0;
})();
