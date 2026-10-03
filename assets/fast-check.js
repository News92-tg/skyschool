/* ============================================================
   SkyySchool — быстрая проверка теста (fast-check.html)

   Учитель загружает фото эталона (1-А, 2-Б, …) и до 30 фото работ,
   жмёт «Проверить» — и получает таблицу: ученик, верно/всего, %,
   оценка, плюс CSV «ФИО, класс, верно, всего, %, оценка».

   Как устроено:
     1. фото сжимаются и по одному загружаются в личное хранилище
        учителя (Supabase Storage, бакет homework), на каждое — временная
        ссылка на час;
     2. POST /fast-check { reference_img, student_imgs:[{img, name,
        class}], total, subject } в Worker news92-orders; Worker
        сверяет работы с эталоном (по 5 работ на запрос к модели) и
        ставит оценку по доле верных: ≥90% → 5, 75–89% → 4,
        60–74% → 3, <60% → 2; ход проверки приходит строками NDJSON;
     3. после ответа фото из хранилища удаляются.

   Одно плохое фото не ломает остальные: каждое сжимается и
   загружается отдельно — не открылось или не загрузилось, работа
   помечается «Не проверено» и в запрос не идёт, остальные проверяются.
   Worker тоже помечает по одной работе («модель не разобрала»).
   «Перепроверить непроверенные» шлёт только их и вписывает ответ в ту
   же таблицу; сводка и CSV считаются здесь по итоговой таблице.

   Нужен новый Worker (worker/news92-orders.js): у прежнего адреса
   /fast-check нет, и страница честно об этом говорит. Проверка
   тестов — в тарифе Премиум (решает Worker). Ключей здесь нет.
   Общее (запросы, сжатие, тарифы) — assets/photo-api.js.
   ============================================================ */
'use strict';

(function () {
  Sky.init({
    fcH1:{ru:'Быстрая проверка теста',en:'Quick test check'},
    fcLead:{ru:'Фото эталона с ответами и фото работ — до 30 штук. Модель сверит каждую работу с эталоном, посчитает верные ответы и поставит оценку.',
            en:'A photo of the answer key and photos of the work — up to 30. The model compares each work with the key, counts correct answers and gives a mark.'},
    fcRefH:{ru:'Эталон',en:'Answer key'},
    fcRefP:{ru:'Фото листа с правильными ответами: 1 — А, 2 — Б, …',en:'A photo of the sheet with the correct answers: 1 — A, 2 — B, …'},
    fcRefPick:{ru:'Выбрать фото эталона',en:'Pick the answer key photo'},
    fcRef:{ru:'Эталон',en:'Answer key'},
    fcSubject:{ru:'Предмет',en:'Subject'},
    fcTotal:{ru:'Вопросов',en:'Questions'},
    fcClass:{ru:'Класс',en:'Class'},
    fcWorksH:{ru:'Работы учеников',en:'Students\' work'},
    fcWorksP:{ru:'До 30 фото, по одному на ученика. ФИО можно не вписывать, если оно подписано на работе.',
              en:'Up to 30 photos, one per student. Names are optional if they are written on the work.'},
    fcPick:{ru:'Выбрать фото работ',en:'Pick work photos'},
    fcClear:{ru:'Очистить',en:'Clear'},
    fcCount:{ru:'%1 из 30',en:'%1 of 30'},
    fcRun:{ru:'Проверить',en:'Check'},
    fcResults:{ru:'Результаты',en:'Results'},
    fcCsv:{ru:'Скачать CSV',en:'Download CSV'},
    fcScale:{ru:'Оценка по доле верных: <b>90% и выше — 5</b>, 75–89% — 4, 60–74% — 3, меньше 60% — 2.',
             en:'Mark by share of correct answers: <b>90% and up — 5</b>, 75–89% — 4, 60–74% — 3, below 60% — 2.'},
    fcNeedRef:{ru:'Добавьте фото эталона',en:'Add the answer key photo'},
    fcNeedWorks:{ru:'Добавьте фото работ',en:'Add photos of the work'},
    fcTooMany:{ru:'Не больше 30 фото — лишние не добавлены.',en:'At most 30 photos — the rest were not added.'},
    fcBadType:{ru:'Подходят только фото JPG, PNG или WebP.',en:'Only JPG, PNG or WebP photos.'},
    fcNeedLogin:{ru:'Войдите: фото загружаются в ваше хранилище и удаляются после проверки.',en:'Sign in: photos go to your storage and are deleted after the check.'},
    fcLegacy:{ru:'Быстрая проверка работает с новым Worker (worker/news92-orders.js). Сейчас по адресу из assets/config.js стоит прежний — у него нет /fast-check. Разверните news92-orders.js в Cloudflare, и страница заработает без изменений.',
              en:'Quick check needs the new Worker (worker/news92-orders.js). The address in assets/config.js still runs the old one, which has no /fast-check. Deploy news92-orders.js to Cloudflare and this page will work as is.'},
    fcNoWorker:{ru:'Не задан адрес Worker (assets/config.js → AI_BASE).',en:'The Worker address is not set (assets/config.js → AI_BASE).'},
    fcPgUpload:{ru:'Загружаю фото %1 из %2',en:'Uploading photo %1 of %2'},
    fcPgStart:{ru:'Сверяю с эталоном: по 5 работ за раз, 10–30 секунд на каждые 5…',en:'Comparing with the key: 5 works at a time, 10–30 seconds per batch…'},
    fcPgCheck:{ru:'Проверено %1 из %2',en:'Checked %1 of %2'},
    fcUpFail:{ru:'Не удалось загрузить фото. Проверьте интернет и попробуйте ещё раз.',en:'Could not upload the photos. Check your connection and try again.'},
    fcRefBad:{ru:'Фото эталона не открылось — выберите другое.',en:'The answer key photo could not be opened — choose another one.'},
    fcBadPhoto:{ru:'фото не открылось — снимите заново',en:'the photo could not be opened — retake it'},
    fcUpOne:{ru:'фото не загрузилось',en:'the photo was not uploaded'},
    fcAllFailed:{ru:'Проверка не прошла: %1',en:'The check did not go through: %1'},
    fcRetryFailed:{ru:'Перепроверить непроверенные (%1)',en:'Re-check the unchecked (%1)'},
    fcRetryAll:{ru:'Проверить ещё раз',en:'Check again'},
    fcFailedHint:{ru:'Не проверено: %1 — перепроверьте их или замените фото.',en:'Not checked: %1 — re-check them or replace the photos.'},
    colN:{ru:'№',en:'#'},
    colName:{ru:'Ученик',en:'Student'},
    colClass:{ru:'Класс',en:'Class'},
    colRight:{ru:'Верно',en:'Correct'},
    colPct:{ru:'%',en:'%'},
    colGrade:{ru:'Оценка',en:'Mark'},
    colWrong:{ru:'Ошибки',en:'Mistakes'},
    wrongN:{ru:'№%1: %2 → %3',en:'#%1: %2 → %3'},
    wrongList:{ru:'Ошибок: %1',en:'Mistakes: %1'},
    failedRow:{ru:'Не проверено: %1',en:'Not checked: %1'},
    sumPct:{ru:'средний результат',en:'average score'},
    sumGrade:{ru:'средняя оценка',en:'average mark'},
    sumChecked:{ru:'проверено',en:'checked'},
    namePh:{ru:'ФИО',en:'Name'},
    classPh:{ru:'Класс',en:'Class'},
    rmRow:{ru:'Убрать',en:'Remove'}
  });

  const $ = s => document.querySelector(s);
  const esc = SkyCheck.esc;
  const MAX = 30;
  const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_INPUT_MB = 25;
  let busy = false;
  let csvUrl = null;
  /* последняя проверка: работы (с фото) и результат по каждой — для
     «Перепроверить непроверенные» и для сводки/CSV */
  let last = null;

  /* ---------- выбор фото ---------- */
  function goodFiles(list) {
    const good = list.filter(f => OK_TYPES.includes(f.type) && f.size <= MAX_INPUT_MB * 1024 * 1024);
    if (good.length < list.length) Sky.toast(Sky.t('fcBadType'), 5000);
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
      if (dropped && opts.max > 1) Sky.toast(Sky.t('fcTooMany'), 5000);
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
             <div class="who-line">${esc(Sky.t('fcRef'))}</div>
             <button type="button" class="rm" data-rm="${i}" aria-label="${esc(Sky.t('rmRow'))}">×</button>
           </div>`).join('');
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

  const ref = roster($('#fcRef'), { max: 1, meta: false });
  const works = roster($('#fcRoster'), { max: MAX, meta: true });

  function bindPicker(btn, input, target, single) {
    $(btn).addEventListener('click', () => $(input).click());
    $(input).addEventListener('change', e => {
      const files = goodFiles(Array.from(e.target.files || []));
      e.target.value = '';
      if (single) target.clear();
      if (files.length) target.add(single ? files.slice(0, 1) : files);
    });
  }
  bindPicker('#fcRefPick', '#fcRefFile', ref, true);
  bindPicker('#fcPick', '#fcFiles', works, false);
  $('#fcClear').addEventListener('click', () => { if (!busy) works.clear(); });

  /* ---------- состояние ---------- */
  let workerMode = null;      // 'orders' | 'legacy'

  function renderButtons() {
    $('#fcRun').disabled = busy || workerMode !== 'orders' || !ref.items.length || !works.items.length || !SkyCheck.canRequest();
    const again = $('#fcRetry');
    if (again) again.disabled = busy || workerMode !== 'orders' || !last || !last.ref || !SkyCheck.canRequest();
    ['#fcPick', '#fcRefPick'].forEach(s => { $(s).disabled = busy; });
    $('#fcClear').classList.toggle('hidden', !works.items.length);
    $('#fcCount').textContent = works.items.length ? Sky.t('fcCount').replace('%1', works.items.length) : '';
    document.querySelectorAll('.roster input').forEach(i => { i.disabled = busy; });
  }
  function setBusy(on) { busy = on; renderButtons(); }

  function prog(text, share) {
    const box = $('#fcProgress');
    box.classList.remove('hidden');
    box.querySelector('.progress-text').textContent = text;
    const bar = box.querySelector('.progress-bar');
    bar.classList.toggle('indef', share == null);
    bar.querySelector('i').style.width = share == null ? '' : Math.round(share * 100) + '%';
  }
  const progDone = () => $('#fcProgress').classList.add('hidden');

  function renderSubjects() {
    const sel = $('#fcSubject');
    const keep = sel.value || 'other';
    sel.innerHTML = SkyCheck.SUBJECTS.map(([k, name]) => `<option value="${k}">${esc(Sky.L(name))}</option>`).join('');
    sel.value = keep;
  }
  function renderStatic() {
    $('#fcScale').innerHTML = Sky.t('fcScale');   /* текст из словаря выше, с <b> */
    renderSubjects();
    renderButtons();
  }

  async function detectWorker() {
    const note = $('#fcNote');
    if (!SkyCheck.hasWorker()) {
      workerMode = 'none';
      note.textContent = Sky.t('fcNoWorker');
      note.classList.remove('hidden');
    } else {
      workerMode = await SkyCheck.mode();
      note.textContent = Sky.t('fcLegacy');
      note.classList.toggle('hidden', workerMode === 'orders');
      if (workerMode === 'orders') SkyCheck.loadLimits();
    }
    renderButtons();
  }

  /* ---------- проверка ----------
     Эталон — 1.jpg, работы — 2.jpg, 3.jpg, … в папке сеанса. Каждое фото
     отдельно: не открылось или не загрузилось — в ответе { ok:false } с
     причиной, остальные идут дальше. Эталон обязателен. */
  async function uploadEach(refBlob, blobs) {
    const me = Sky.db.me();
    const session = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const n = blobs.length + 1;
    const out = { ref: null, works: [], paths: [] };
    async function one(blob, i) {
      let small;
      try { small = await SkyCheck.compress(blob); } catch (e) { return { ok: false, error: Sky.t('fcBadPhoto') }; }
      const path = `${me.id}/${session}/${i + 1}.jpg`;
      try {
        await Sky.db.upload('homework', path, small, 'image/jpeg');
        out.paths.push(path);
        return { ok: true, path, url: await Sky.db.signedUrl('homework', path, 3600) };
      } catch (e) { return { ok: false, error: Sky.t('fcUpOne') }; }
    }
    prog(Sky.t('fcPgUpload').replace('%1', 1).replace('%2', n), 0);
    out.ref = await one(refBlob, 0);
    if (!out.ref.ok) return out;
    for (let i = 0; i < blobs.length; i++) {
      prog(Sky.t('fcPgUpload').replace('%1', i + 2).replace('%2', n), (i + 1) / n);
      out.works.push(await one(blobs[i], i + 1));
    }
    return out;
  }

  /* only — номера работ (с нуля) из прошлой проверки, которые
     перепроверить; без него — все работы из списка заново. */
  async function run(only) {
    if (busy || workerMode !== 'orders') return;
    const retry = Array.isArray(only) && last;
    if (!retry) {
      if (!ref.items.length) { Sky.toast(Sky.t('fcNeedRef'), 4000); return; }
      if (!works.items.length) { Sky.toast(Sky.t('fcNeedWorks'), 4000); return; }
    }
    if (!(Sky.db && Sky.db.me && Sky.db.me())) {
      Sky.toast(Sky.t('fcNeedLogin'), 5000);
      if (Sky.auth && Sky.auth.openAuth) Sky.auth.openAuth();
      return;
    }
    if (SkyCheck.limits && !SkyCheck.feature('teacher')) { SkyCheck.openTariffs('premium'); return; }

    const items = retry ? last.items : works.items.map(it => Object.assign({}, it));
    const refBlob = retry ? last.ref : ref.items[0].blob;
    const idx = retry ? only : items.map((_, i) => i);
    const defClass = retry ? last.defClass : $('#fcClass').value.trim();
    const total = retry ? last.total : parseInt($('#fcTotal').value, 10);
    const subject = retry ? last.subject : $('#fcSubject').value;
    if (!retry) last = { items, ref: refBlob, defClass, total, subject, results: items.map(() => null) };

    setBusy(true);
    if (!retry) $('#fcResultSec').classList.add('hidden');
    let up;
    try { up = await uploadEach(refBlob, idx.map(i => items[i].blob)); }
    catch (e) { up = null; }
    if (!up || !up.ref || !up.ref.ok) {
      if (up) await Sky.db.removeFiles('homework', up.paths);
      progDone(); setBusy(false);
      Sky.toast(Sky.t(up && up.ref && up.ref.error === Sky.t('fcBadPhoto') ? 'fcRefBad' : 'fcUpFail'), 6000);
      return;
    }

    const who = i => ({ index: i + 1, name: items[i].name.trim(), class: items[i].cls.trim() || defClass });
    /* фото, которые не открылись или не загрузились, — сразу «Не проверено» */
    const send = [];
    idx.forEach((i, k) => {
      if (up.works[k].ok) send.push({ i, url: up.works[k].url });
      else last.results[i] = Object.assign(who(i), { status: 'failed', error: up.works[k].error });
    });

    let res = null;
    if (send.length) {
      prog(Sky.t('fcPgStart'), null);
      res = await SkyCheck.request('/fast-check', {
        method: 'POST',
        json: {
          reference_img: up.ref.url,
          student_imgs: send.map(x => { const w = who(x.i); return { img: x.url, name: w.name, class: w.class }; }),
          total: total >= 1 && total <= 200 ? total : undefined,
          subject
        },
        timeout: 240000,
        onProgress: m => prog(Sky.t('fcPgCheck').replace('%1', m.done).replace('%2', m.total), m.done / m.total)
      });
    }
    await Sky.db.removeFiles('homework', up.paths);
    progDone();
    setBusy(false);

    if (res) {
      const d = res.data || {};
      if (d.code === 'rate_limit' && d.retry_after) SkyCheck.setWait(d.retry_after);
      else SkyCheck.loadLimits();
      if (res.status === 402 && d.code === 'tariff') { SkyCheck.openTariffs(d.need); showError(SkyCheck.errorText(res)); return; }
      /* новый Worker, но развёрнут до появления /fast-check */
      if (res.status === 404) { showError(Sky.t('fcLegacy')); return; }
      if (res.ok) {
        SkyCheck.addTokens(d.tokens_used);
        (d.students || []).forEach((st, j) => {
          const at = send[clampIdx(st.index, j, send.length)];
          if (at) last.results[at.i] = Object.assign({}, st, { index: at.i + 1 });
        });
        /* Worker не вернул строку — «не разобрал» */
        send.forEach(x => { if (!last.results[x.i]) last.results[x.i] = Object.assign(who(x.i), { status: 'failed', error: '' }); });
      } else {
        /* весь запрос не прошёл (сеть, таймаут, сбой) — отправленные
           помечаем с причиной, их можно перепроверить */
        const why = SkyCheck.errorText(res);
        send.forEach(x => { last.results[x.i] = Object.assign(who(x.i), { status: 'failed', error: why }); });
        last.note = Sky.t('fcAllFailed').replace('%1', why);
      }
    }
    if (res && res.ok) last.note = '';
    render();
  }
  /* номер строки в ответе Worker: index (с 1) или порядок */
  const clampIdx = (index, j, n) => { const k = Number(index) - 1; return Number.isInteger(k) && k >= 0 && k < n ? k : j; };

  /* ---------- результат ---------- */
  const badge = g => typeof g === 'number' ? `<span class="gr g${g}">${g}</span>` : '<span class="gr gx">—</span>';
  const num = v => Sky.lang === 'en' ? String(v) : String(v).replace('.', ',');

  function showError(text) {
    $('#fcResultSec').classList.remove('hidden');
    $('#fcCsv').classList.add('hidden');
    $('#fcRetry').classList.add('hidden');
    $('#fcResult').innerHTML = `<div class="limit-note">${esc(text)}</div>`;
    $('#fcResultSec').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* сводка — здесь, по итоговой таблице: после перепроверки в ней
     ответы из нескольких запросов */
  function summarize(list) {
    const ok = list.filter(st => st && st.status === 'ok');
    const grades = { 5: 0, 4: 0, 3: 0, 2: 0 };
    ok.forEach(st => { if (grades[st.grade] != null) grades[st.grade]++; });
    return {
      students: list.length, checked: ok.length, failed: list.length - ok.length, grades,
      avg_percent: ok.length ? Math.round(ok.reduce((a, st) => a + (Number(st.percent) || 0), 0) / ok.length) : null,
      avg_grade: ok.length ? Math.round(ok.reduce((a, st) => a + (Number(st.grade) || 0), 0) / ok.length * 10) / 10 : null
    };
  }

  function render() {
    const students = last.results.map((st, i) => st || { index: i + 1, name: last.items[i].name, class: last.items[i].cls || last.defClass, status: 'failed', error: '' });
    const s = summarize(students);
    const failedIdx = students.map((st, i) => st.status === 'ok' ? -1 : i).filter(i => i >= 0);
    const failText = st => Sky.t('failedRow').replace('%1', st.error || (Sky.lang === 'en' ? 'the model could not read this work' : 'модель не разобрала эту работу'));
    const rows = students.map(st => st.status !== 'ok'
      ? `<tr class="failed"><td class="c-n">${st.index}</td><td>${esc(st.name || '—')}</td><td class="c-cls">${esc(st.class || '')}</td>
           <td class="num">—</td><td class="num">—</td><td><span class="gr gx">—</span></td><td><span class="fc-fail">${esc(failText(st))}</span></td></tr>`
      : `<tr><td class="c-n">${st.index}</td><td>${esc(st.name || '—')}</td><td class="c-cls">${esc(st.class || '')}</td>
           <td class="num"><b>${st.correct}/${st.total}</b></td><td class="num">${st.percent}%</td><td>${badge(st.grade)}</td>
           <td>${(st.errors || []).length ? `<details><summary>${esc(Sky.t('wrongList').replace('%1', st.errors.length))}</summary><ul>${st.errors.map(e =>
             `<li>${esc(Sky.t('wrongN').replace('%1', e.n).replace('%2', e.student).replace('%3', e.correct))}</li>`).join('')}</ul></details>` : '—'}</td></tr>`
    ).join('');
    $('#fcResult').innerHTML =
      (last.note ? `<div class="limit-note" style="margin:0 0 12px">${esc(last.note)}</div>` : '') +
      `<div class="stats">
         <div class="stat accent"><b>${s.avg_percent == null ? '—' : s.avg_percent + '%'}</b><span>${esc(Sky.t('sumPct'))}</span></div>
         <div class="stat"><b>${s.avg_grade == null ? '—' : esc(num(s.avg_grade))}</b><span>${esc(Sky.t('sumGrade'))}</span></div>
         <div class="stat ok"><b>${s.checked}/${s.students}</b><span>${esc(Sky.t('sumChecked'))}</span></div>
       </div>
       <div class="fc-dist">${[5, 4, 3, 2].map(g => `<span>${badge(g)} × ${s.grades[g] || 0}</span>`).join('')}</div>
       ${failedIdx.length ? `<div class="fc-failnote">${esc(Sky.t('fcFailedHint').replace('%1', failedIdx.length))}</div>` : ''}
       <div class="table-wrap"><table class="rtable">
         <thead><tr><th class="c-n">${esc(Sky.t('colN'))}</th><th>${esc(Sky.t('colName'))}</th><th class="c-cls">${esc(Sky.t('colClass'))}</th>
           <th class="num">${esc(Sky.t('colRight'))}</th><th class="num">${esc(Sky.t('colPct'))}</th><th>${esc(Sky.t('colGrade'))}</th><th>${esc(Sky.t('colWrong'))}</th></tr></thead>
         <tbody>${rows}</tbody></table></div>`;
    /* CSV «ФИО, класс, верно, всего, %, оценка» — по итоговой таблице */
    csvUrl = SkyCheck.csvDataUrl(['ФИО', 'Класс', 'Верно', 'Всего', '%', 'Оценка'],
      students.map(st => st.status === 'ok'
        ? [st.name, st.class, st.correct, st.total, st.percent, st.grade]
        : [st.name, st.class, '', '', '', failText(st)]));
    const again = $('#fcRetry');
    again.textContent = failedIdx.length ? Sky.t('fcRetryFailed').replace('%1', failedIdx.length) : Sky.t('fcRetryAll');
    again.dataset.mode = failedIdx.length ? 'failed' : 'all';
    again.classList.toggle('ghost', !failedIdx.length);
    $('#fcCsv').classList.remove('hidden');
    again.classList.remove('hidden');
    renderButtons();
    $('#fcResultSec').classList.remove('hidden');
    $('#fcResultSec').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  $('#fcRetry').addEventListener('click', () => {
    if (!last) return;
    if ($('#fcRetry').dataset.mode === 'failed') {
      run(last.results.map((st, i) => st && st.status === 'ok' ? -1 : i).filter(i => i >= 0));
    } else {
      /* всё заново — по тем же фото, что в таблице */
      run(last.items.map((_, i) => i));
    }
  });
  $('#fcCsv').addEventListener('click', () => { if (csvUrl) SkyCheck.download(csvUrl, 'skyschool-fast-check.csv'); });
  $('#fcRun').addEventListener('click', run);
  SkyCheck.onChange(renderButtons);
  document.addEventListener('langchange', () => { renderStatic(); ref.render(); works.render(); });

  renderStatic();
  detectWorker();
})();
