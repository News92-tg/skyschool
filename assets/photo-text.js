/* ============================================================
   SkyySchool — проверка сочинения текстом на «Домашке по фото»

   Вкладка «Текст» в режиме ученика: текст → POST /grade-essay
   (Worker news92-orders, AI_BASE_ORDERS) с телом
     { text, topic, subject, kind, criteria, lang, teacher, strictness }.
   Ответ: { grade, criteria:[{name, score, comment}], strengths,
   issues:[{quote, problem, why}], overall_feedback, next_step }.
   Критерии шлём свои — те же шесть, что в таблице разбора.
   Входить не обязательно. Ключей здесь нет — они только в Worker.
   Общее (запросы, ошибки, тарифы, токены) — assets/photo-api.js.
   ============================================================ */
'use strict';

(function () {
  Sky.extendDict({
    kindPhoto:{ru:'Фото',en:'Photo'},
    kindText:{ru:'Текст',en:'Text'},
    kindAria:{ru:'Что проверяем',en:'What to check'},
    xTextLabel:{ru:'Текст сочинения',en:'Essay text'},
    xTextPh:{ru:'Вставьте или напечатайте сочинение — до 8000 символов',en:'Paste or type the essay — up to 8000 characters'},
    xTopicLabel:{ru:'Тема (необязательно)',en:'Topic (optional)'},
    xTopicPh:{ru:'Например: Образ Татьяны в романе «Евгений Онегин»',en:'For example: My favourite book'},
    xSubjRussian:{ru:'Русский',en:'Russian'},
    xSubjEnglish:{ru:'Английский',en:'English'},
    xSubjLiterature:{ru:'Литература',en:'Literature'},
    xCriteria:{ru:'Показать критерии',en:'Show criteria'},
    xCriteriaShort:{ru:'Критерии — только в подробном разборе',en:'Criteria come with the detailed review only'},
    xCheckBtn:{ru:'Проверить',en:'Check'},
    xPg:{ru:'Идёт проверка, это займёт 5-15 секунд...',en:'Checking, this takes 5-15 seconds...'},
    xCritH:{ru:'Критерии',en:'Criteria'},
    cr_topic_match:{ru:'Соответствие теме',en:'Relevance to the topic'},
    cr_argumentation:{ru:'Аргументация с примерами',en:'Arguments and examples'},
    cr_composition:{ru:'Композиция',en:'Structure'},
    cr_logic:{ru:'Логика и связность',en:'Logic and coherence'},
    cr_spelling:{ru:'Орфография',en:'Spelling'},
    cr_grammar:{ru:'Грамматика и речь',en:'Grammar and style'},
    xWhy:{ru:'Почему: ',en:'Why: '}
  });

  const $ = s => document.querySelector(s);
  const esc = SkyCheck.esc;
  const MAX = 8000;
  const TIMEOUT_MS = 45000;
  const SUBJECTS = [['russian', 'xSubjRussian'], ['english', 'xSubjEnglish'], ['literature', 'xSubjLiterature']];
  /* Worker вставляет предмет в промпт как есть: «по предмету «…»». */
  const SUBJ_FOR_WORKER = {
    russian: { ru: 'русский язык', en: 'Russian' },
    english: { ru: 'английский язык', en: 'English' },
    literature: { ru: 'литература', en: 'literature' }
  };
  const CRITERIA = ['topic_match', 'argumentation', 'composition', 'logic', 'spelling', 'grammar'];

  const saved = Object.assign({ subject: 'russian', length: 'long', criteria: true, grade: true }, Sky.get('hwTextOpts', {}) || {});
  let subject = SUBJECTS.some(s => s[0] === saved.subject) ? saved.subject : 'russian';
  let length = saved.length === 'short' ? 'short' : 'long';
  let busy = false;
  let last = null;                   // последний показанный разбор — перерисовать при смене языка

  function saveOpts() {
    Sky.set('hwTextOpts', { subject, length, criteria: $('#xCriteria').checked, grade: $('#xGrade').checked });
  }

  /* ---------- Фото / Текст ---------- */
  function setKind(k) {
    const kind = k === 'text' ? 'text' : 'photo';
    $('#photoTab').classList.toggle('hidden', kind !== 'photo');
    $('#textTab').classList.toggle('hidden', kind !== 'text');
    $('#kindSeg').querySelectorAll('button').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.kind === kind));
      b.setAttribute('aria-selected', String(b.dataset.kind === kind));
    });
    /* камера во вкладке «Текст» не нужна, а огонёк горел бы */
    if (kind === 'text' && typeof window.closeCamera === 'function') window.closeCamera();
    Sky.set('hwKind', kind);
  }

  /* ---------- форма ---------- */
  function renderSubjects() {
    $('#xSubjRow').innerHTML = SUBJECTS.map(([id, key]) =>
      `<button type="button" class="subj-btn${id === subject ? ' active' : ''}" data-subject="${id}"${busy ? ' disabled' : ''}>${esc(Sky.t(key))}</button>`).join('');
  }

  function renderLength() {
    $('#xLengthSeg').querySelectorAll('button').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.len === length)); b.disabled = busy; });
    /* критерии модель ставит только в подробном разборе */
    const crit = $('#xCriteria');
    crit.disabled = busy || length === 'short';
    crit.closest('.opt-check').title = length === 'short' ? Sky.t('xCriteriaShort') : '';
    $('#xTopicField').classList.toggle('hidden', length === 'short');
  }

  function renderCount() {
    const n = $('#xText').value.length;
    const el = $('#xCount');
    el.textContent = n.toLocaleString(Sky.lang === 'en' ? 'en-US' : 'ru-RU') + ' / ' + MAX.toLocaleString(Sky.lang === 'en' ? 'en-US' : 'ru-RU');
    el.classList.toggle('full', n >= MAX);
  }

  function updateBtn() {
    $('#xCheck').disabled = busy || !SkyCheck.hasWorker() || !$('#xText').value.trim();
  }

  function setBusy(on) {
    busy = on;
    $('#xText').readOnly = on;
    $('#xTopic').readOnly = on;
    $('#xGrade').disabled = on;
    $('#xCheck').innerHTML = on ? `<span class="spin"></span> ${esc(Sky.t('checking'))}` : esc(Sky.t('xCheckBtn'));
    $('#xProgress').classList.toggle('hidden', !on);
    if (on) $('#xProgress .progress-text').textContent = Sky.t('xPg');
    renderSubjects(); renderLength(); updateBtn();
  }

  /* ---------- проверка ---------- */
  async function check() {
    if (busy) return;
    const text = $('#xText').value.trim();
    if (!text) { Sky.toast(Sky.t('errNoText'), 4000); $('#xText').focus(); return; }

    const body = {
      text,
      topic: length === 'long' ? $('#xTopic').value.trim().slice(0, 300) : '',
      subject: Sky.L(SUBJ_FOR_WORKER[subject]),
      kind: Sky.lang === 'en' ? 'essay' : 'сочинение',
      criteria: CRITERIA.map(k => Sky.t('cr_' + k)),
      lang: Sky.lang,
      teacher: window.SkyTeachers && SkyTeachers.selectedId ? SkyTeachers.selectedId() : null,
      strictness: 3
    };
    const opts = { length, criteria: $('#xCriteria').checked, grade: $('#xGrade').checked };

    setBusy(true);
    $('#xResultSec').classList.add('hidden');
    const res = await SkyCheck.request('/grade-essay', { method: 'POST', json: body, timeout: TIMEOUT_MS });
    setBusy(false);

    if (!res.ok) {
      render(null, SkyCheck.errorText(res), opts);
      return;
    }
    render(res.data, null, opts);
  }

  /* ---------- разбор ---------- */
  /* «Коротко» — оценка, замечания и общий вывод; «Подробно» — ещё
     критерии (если отмечено), сильные стороны и следующий шаг. */
  function render(data, fail, opts) {
    last = { data, fail, opts };
    const long = opts.length === 'long';
    const block = (key, inner) => `<div class="res-block"><h3>${esc(Sky.t(key))}</h3>${inner}</div>`;
    let html = '';
    if (data) {
      const g = Number(data.grade);
      if (opts.grade && g >= 1 && g <= 5) {
        html += `<div class="gradebox"><div class="grade g${g}">${g}</div>
          <div class="said"><b>${esc(Sky.t('gradeL'))}</b></div></div>`;
      }
      const crit = Array.isArray(data.criteria) ? data.criteria.filter(c => c && typeof c === 'object') : [];
      if (long && opts.criteria && crit.length) {
        html += block('xCritH', `<table class="crit"><tbody>${crit.map(c => {
          const v = Number(c.score) >= 1 && Number(c.score) <= 5 ? Number(c.score) : null;
          return `<tr><th scope="row">${esc(c.name || '')}${c.comment ? `<span class="crit-c">${esc(c.comment)}</span>` : ''}</th>` +
            `<td class="crit-bar"><span><i style="width:${v == null ? 0 : v * 20}%"></i></span></td>` +
            `<td class="crit-v">${v == null ? '—' : v + '/5'}</td></tr>`;
        }).join('')}</tbody></table>`);
      }
      const good = Array.isArray(data.strengths) ? data.strengths : [];
      if (long && good.length) html += block('goodH', good.map(x => `<div class="good-item">${esc(x)}</div>`).join(''));
      const issues = Array.isArray(data.issues) ? data.issues.filter(e => e && typeof e === 'object') : [];
      html += block('errH', issues.length
        ? issues.map(e => `<div class="err-item">
            ${e.quote ? `<div class="frag">${esc(e.quote)}</div>` : ''}
            ${e.problem ? `<div class="why">${esc(e.problem)}</div>` : ''}
            ${e.why ? `<div class="why"><b>${esc(Sky.t('xWhy'))}</b>${esc(e.why)}</div>` : ''}
          </div>`).join('')
        : `<p class="lead" style="font-size:13px">${esc(Sky.t('noErrors'))}</p>`);
      if (data.overall_feedback) html += block('resComment', `<div class="res-text">${esc(data.overall_feedback)}</div>`);
      if (long && data.next_step) html += block('nextH', `<div class="res-text">${esc(data.next_step)}</div>`);
    }
    if (fail) html += `<div class="limit-note">${esc(fail)}</div>`;
    html += `<div class="res-actions"><button type="button" class="btn ghost" id="xAgain">${esc(Sky.t('againBtn'))}</button></div>`;

    $('#xResultSec').classList.remove('hidden');
    $('#xResult').innerHTML = html;
    $('#xAgain').addEventListener('click', again);
    $('#xResultSec').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* «Проверить ещё раз»: убрать разбор, текст оставить — поправить и отправить снова. */
  function again() {
    last = null;
    $('#xResultSec').classList.add('hidden');
    $('#xResult').innerHTML = '';
    const t = $('#xText');
    t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    t.focus({ preventScroll: true });
  }

  /* ---------- события ---------- */
  $('#kindSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-kind]');
    if (b) setKind(b.dataset.kind);
  });
  $('#xSubjRow').addEventListener('click', e => {
    const b = e.target.closest('.subj-btn');
    if (!b || busy) return;
    subject = b.dataset.subject;
    renderSubjects(); saveOpts();
  });
  $('#xLengthSeg').addEventListener('click', e => {
    const b = e.target.closest('button[data-len]');
    if (!b || busy) return;
    length = b.dataset.len;
    renderLength(); saveOpts();
  });
  $('#xCriteria').addEventListener('change', saveOpts);
  $('#xGrade').addEventListener('change', saveOpts);
  $('#xText').addEventListener('input', () => { renderCount(); updateBtn(); });
  $('#xCheck').addEventListener('click', check);
  document.addEventListener('langchange', () => {
    renderSubjects(); renderLength(); renderCount();
    if (!busy) $('#xCheck').textContent = Sky.t('xCheckBtn');
    $('#kindSeg').setAttribute('aria-label', Sky.t('kindAria'));
    if (last) render(last.data, last.fail, last.opts);
  });

  /* ---------- запуск ---------- */
  Sky.applyI18n(document.getElementById('studentMode'));
  $('#kindSeg').setAttribute('aria-label', Sky.t('kindAria'));
  $('#xCriteria').checked = saved.criteria !== false;
  $('#xGrade').checked = saved.grade !== false;
  const params = new URLSearchParams(location.search);
  setKind(params.get('task') ? 'photo' : params.get('kind') || Sky.get('hwKind', 'photo'));
  renderSubjects(); renderLength(); renderCount(); updateBtn();
})();
