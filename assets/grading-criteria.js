/* ============================================================
   SkyySchool — критерии оценивания (window.SkyCriteria)

   Учитель задаёт критерии [{name, weight}], модель ставит балл 1–5 по
   каждому, итог считается по формуле, а не «на глаз» модели:
       итог   = Σ(вес × балл) / Σ(веса), до десятых      — 4.2
       оценка = округление итога                        — 4.2 → 4, 4.5 → 5
   Критерий без балла в итог не входит.

   Кто считает баллы:
     новый Worker (news92-orders.js) — сам, в /api/check-photo и в
       отчёте по классу: параметр criteria, ответ { criteria, score,
       assessment };
     прежний Worker (worker.js) критериев при проверке фото не знает —
       тогда распознанный текст работы отправляется в его же
       POST /grade-essay со списком критериев (он ставит балл по
       каждому), а итог и оценку считаем здесь по той же формуле.

   Набор критериев хранится в браузере учителя (Sky.set), ключей и
   запросов к базе здесь нет.
   ============================================================ */
'use strict';

window.SkyCriteria = (function () {
  Sky.extendDict({
    critOpt:{ru:'Оценивать по критериям',en:'Grade by criteria'},
    critHint:{ru:'Каждый критерий модель оценит от 1 до 5. Итог — среднее с учётом веса: вес 2 значит «вдвое важнее».',
              en:'The model scores each criterion from 1 to 5. The total is the weighted average: weight 2 means "twice as important".'},
    critName:{ru:'Критерий',en:'Criterion'},
    critWeight:{ru:'Вес',en:'Weight'},
    critScore:{ru:'Балл',en:'Score'},
    critComment:{ru:'Комментарий',en:'Comment'},
    critAdd:{ru:'+ Критерий',en:'+ Criterion'},
    critPreset:{ru:'Шаблон…',en:'Template…'},
    critRemove:{ru:'Убрать критерий',en:'Remove criterion'},
    critNamePh:{ru:'Например: ход решения',en:'For example: working'},
    critTotal:{ru:'Итог по критериям',en:'Total by criteria'},
    critGrade:{ru:'Оценка',en:'Mark'},
    critFormula:{ru:'Σ(вес × балл) / Σ(весов) = %1 → оценка %2',en:'Σ(weight × score) / Σ(weights) = %1 → mark %2'},
    critNone:{ru:'модель не смогла оценить',en:'the model could not score it'},
    critNeed:{ru:'Добавьте хотя бы один критерий с названием',en:'Add at least one criterion with a name'},
    critLegacyFail:{ru:'Оценить по критериям не удалось: %1',en:'Could not score by criteria: %1'},
    critPg:{ru:'Оцениваю по критериям…',en:'Scoring by criteria…'},
    critNoText:{ru:'на фото не распознан текст',en:'no text was recognised on the photo'}
  });

  const MAX = 10;
  const KEY = 'gradeCriteria';

  const PRESETS = [
    { id: 'solve', ru: 'Задачи (математика, физика)', en: 'Problems (maths, physics)', items: [
      { ru: 'Верный ответ', en: 'Correct answer', weight: 1 },
      { ru: 'Ход решения', en: 'Working', weight: 1 },
      { ru: 'Оформление', en: 'Presentation', weight: 0.5 }] },
    { id: 'essay', ru: 'Сочинение', en: 'Essay', items: [
      { ru: 'Соответствие теме', en: 'Relevance to the topic', weight: 1 },
      { ru: 'Аргументация', en: 'Argument', weight: 1 },
      { ru: 'Композиция и логика', en: 'Structure and logic', weight: 1 },
      { ru: 'Грамотность', en: 'Accuracy', weight: 1.5 }] },
    { id: 'dictation', ru: 'Диктант, упражнение', en: 'Dictation, exercise', items: [
      { ru: 'Орфография', en: 'Spelling', weight: 2 },
      { ru: 'Пунктуация', en: 'Punctuation', weight: 1 },
      { ru: 'Аккуратность', en: 'Neatness', weight: 0.5 }] }
  ];

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = v => Sky.lang === 'en' ? String(v) : String(v).replace('.', ',');

  /* То же, что parseCriteria в worker/news92-orders.js: до 10 штук,
     без пустых и повторов, вес от 0.01 до 10, плохой вес → 1. */
  function normalize(list) {
    const out = [], seen = new Set();
    for (const c of Array.isArray(list) ? list : []) {
      const name = String(c && c.name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      let weight = Number(String(c.weight).replace(',', '.'));
      if (!(weight > 0)) weight = 1;
      weight = Math.min(10, Math.round(weight * 100) / 100);
      seen.add(key);
      out.push({ name, weight });
      if (out.length >= MAX) break;
    }
    return out;
  }

  function weighted(items) {
    let sum = 0, weights = 0;
    for (const c of items || []) {
      if (typeof c.score !== 'number') continue;
      sum += c.weight * c.score;
      weights += c.weight;
    }
    return weights ? Math.round(sum / weights * 10) / 10 : null;
  }

  const gradeOf = score => score == null ? null : Math.min(5, Math.max(1, Math.floor(score + 0.5)));

  function presetItems(id) {
    const p = PRESETS.find(x => x.id === id) || PRESETS[0];
    return p.items.map(i => ({ name: Sky.lang === 'en' ? i.en : i.ru, weight: i.weight }));
  }

  function load() {
    const saved = normalize(Sky.get(KEY, null));
    return saved.length ? saved : presetItems('solve');
  }
  function save(list) { Sky.set(KEY, list); }

  /* ---------- редактор ---------- */
  /* host — контейнер; toggle — чекбокс «Оценивать по критериям».
     Возвращает { get() — нормализованный список или null, если
     выключено }. */
  function editor(host, toggle) {
    let rows = load();

    function draw() {
      host.innerHTML =
        `<p class="crit-hint">${esc(Sky.t('critHint'))}</p>
         <div class="crit-rows">${rows.map((c, i) => `
           <div class="crit-row" data-i="${i}">
             <input type="text" class="crit-name" maxlength="60" value="${esc(c.name)}" placeholder="${esc(Sky.t('critNamePh'))}" aria-label="${esc(Sky.t('critName'))}">
             <input type="text" class="crit-weight" inputmode="decimal" maxlength="5" value="${esc(c.weight)}" aria-label="${esc(Sky.t('critWeight'))}">
             <button type="button" class="crit-del" aria-label="${esc(Sky.t('critRemove'))}" title="${esc(Sky.t('critRemove'))}">×</button>
           </div>`).join('')}</div>
         <div class="crit-tools">
           <button type="button" class="btn ghost small crit-add"${rows.length >= MAX ? ' disabled' : ''}>${esc(Sky.t('critAdd'))}</button>
           <select class="crit-preset" aria-label="${esc(Sky.t('critPreset'))}">
             <option value="">${esc(Sky.t('critPreset'))}</option>
             ${PRESETS.map(p => `<option value="${p.id}">${esc(Sky.lang === 'en' ? p.en : p.ru)}</option>`).join('')}
           </select>
         </div>`;
    }

    function readRows() {
      rows = [...host.querySelectorAll('.crit-row')].map(r => ({
        name: r.querySelector('.crit-name').value,
        weight: r.querySelector('.crit-weight').value
      }));
    }

    host.addEventListener('input', () => { readRows(); save(normalize(rows)); });
    host.addEventListener('click', e => {
      if (e.target.closest('.crit-del')) {
        readRows();
        rows.splice(+e.target.closest('.crit-row').dataset.i, 1);
        if (!rows.length) rows.push({ name: '', weight: 1 });
        save(normalize(rows)); draw();
      } else if (e.target.closest('.crit-add')) {
        readRows();
        if (rows.length < MAX) rows.push({ name: '', weight: 1 });
        draw();
        const last = host.querySelector('.crit-row:last-child .crit-name');
        if (last) last.focus();
      }
    });
    host.addEventListener('change', e => {
      if (!e.target.classList.contains('crit-preset') || !e.target.value) return;
      rows = presetItems(e.target.value);
      save(rows); draw();
    });

    const sync = () => host.classList.toggle('hidden', !toggle.checked);
    /* набор один на весь браузер: включили галочку — берём последний
       сохранённый (его могли поменять в другом редакторе на странице) */
    toggle.addEventListener('change', () => { if (toggle.checked) { rows = load(); draw(); } sync(); });
    document.addEventListener('langchange', () => { readRows(); draw(); });
    draw(); sync();

    return {
      get() {
        if (!toggle.checked) return null;
        readRows();
        return normalize(rows);
      }
    };
  }

  /* ---------- таблица результата ---------- */
  function table(items, score, grade) {
    if (!Array.isArray(items) || !items.length) return '';
    const g = typeof grade === 'number' ? grade : gradeOf(score);
    const rows = items.map(c => `<tr>
        <td>${esc(c.name)}</td>
        <td class="num">${esc(num(c.weight))}</td>
        <td class="num">${typeof c.score === 'number' ? `<b class="crit-sc s${c.score}">${c.score}</b>` : '—'}</td>
        <td>${c.score == null && !c.comment ? `<i>${esc(Sky.t('critNone'))}</i>` : esc(c.comment || '')}</td>
      </tr>`).join('');
    return `<div class="crit-result">
      <div class="crit-total">
        <div class="crit-big"><b>${score == null ? '—' : esc(num(score.toFixed(1)))}</b><span>/5</span></div>
        <div class="crit-grade"><span>${esc(Sky.t('critGrade'))}</span><b class="grade g${g || 'x'}">${g || '—'}</b></div>
        <div class="crit-label"><b>${esc(Sky.t('critTotal'))}</b>${score == null ? '' : `<br><small>${esc(Sky.t('critFormula').replace('%1', num(score.toFixed(1))).replace('%2', g))}</small>`}</div>
      </div>
      <div class="table-wrap"><table class="crit-table">
        <thead><tr><th>${esc(Sky.t('critName'))}</th><th class="num">${esc(Sky.t('critWeight'))}</th><th class="num">${esc(Sky.t('critScore'))}</th><th>${esc(Sky.t('critComment'))}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  /* ---------- прежний Worker: баллы через /grade-essay ---------- */
  const key = s => String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, '');

  /* Ответ /grade-essay → ровно наши критерии в нашем порядке. */
  function mapScores(got, want) {
    const list = (Array.isArray(got) ? got : []).filter(x => x && typeof x === 'object');
    return want.map((c, i) => {
      const hit = list.find(g => key(g.name) === key(c.name)) ||
        (list[i] && !want.some(w => key(w.name) === key(list[i].name)) ? list[i] : null);
      const s = hit ? parseInt(hit.score, 10) : NaN;
      return { name: c.name, weight: c.weight, score: s >= 1 && s <= 5 ? s : null, comment: hit ? String(hit.comment || '').slice(0, 400) : '' };
    });
  }

  async function scoreLegacy(text, criteria, opts) {
    opts = opts || {};
    if (!String(text || '').trim()) return { ok: false, error: Sky.t('critNoText') };
    const res = await SkyCheck.request('/grade-essay', {
      method: 'POST',
      json: {
        text: String(text).slice(0, 8000),
        topic: opts.task || '',
        subject: opts.subjectName || '',
        kind: Sky.lang === 'en' ? 'homework' : 'домашняя работа',
        criteria: criteria.map(c => c.name),
        lang: Sky.lang === 'en' ? 'en' : 'ru'
      },
      timeout: opts.timeout || 45000
    });
    if (!res.ok) return { ok: false, error: SkyCheck.errorText(res) };
    const items = mapScores(res.data && res.data.criteria, criteria);
    const score = weighted(items);
    return { ok: true, criteria: items, score, grade: gradeOf(score) };
  }

  return { PRESETS, MAX, normalize, weighted, gradeOf, mapScores, load, save, editor, table, scoreLegacy };
})();
