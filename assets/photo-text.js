/* ============================================================
   SkyySchool — проверка сочинения текстом на «Домашке по фото»

   Вкладка «Текст» в режиме ученика: текст → POST /api/check-text
   (Worker news92-orders, AI_BASE_ORDERS; модель Groq
   llama-3.1-8b-instant). POST, а не GET: 8000 символов кириллицы в
   адресе — около 48 КБ, а Cloudflare пропускает адрес до 16 КБ.
   Входить не обязательно: без входа лимит считается по адресу.
   Ключей здесь нет — они только в Worker.
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
    xPlan:{ru:'Текст по тарифу «%1»: %2',en:'Text on the %1 plan: %2'},
    xCritH:{ru:'Критерии',en:'Criteria'},
    cr_topic_match:{ru:'Соответствие теме',en:'Relevance to the topic'},
    cr_argumentation:{ru:'Аргументация с примерами',en:'Arguments and examples'},
    cr_composition:{ru:'Композиция',en:'Structure'},
    cr_logic:{ru:'Логика и связность',en:'Logic and coherence'},
    cr_spelling:{ru:'Орфография',en:'Spelling'},
    cr_grammar:{ru:'Грамматика и речь',en:'Grammar and style'},
    xOffTopic:{ru:'Сочинение не по теме — остальные критерии не оценивались.',en:'The essay is off topic, so the other criteria were not scored.'},
    xCached:{ru:'Этот текст уже проверяли за последние 7 дней — показан сохранённый разбор, токены не потрачены.',
             en:'This text was checked in the last 7 days — the saved review is shown, no tokens spent.'},
    xCut:{ru:'Текст длиннее 8000 символов — проверены первые 8000.',en:'The text is longer than 8000 characters — the first 8000 were checked.'},
    xTrunc:{ru:'Разбор оборвался: ответ модели вышел слишком длинным. Попробуйте «Коротко».',
            en:'The review was cut off: the answer was too long. Try “Short”.'}
  });

  const $ = s => document.querySelector(s);
  const esc = SkyCheck.esc;
  const MAX = 8000;
  const TIMEOUT_MS = 45000;          // Worker: до 30 с на Groq и пауза 2 с на его лимит
  const SUBJECTS = [['russian', 'xSubjRussian'], ['english', 'xSubjEnglish'], ['literature', 'xSubjLiterature']];
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
    $('#xCheck').disabled = busy || !SkyCheck.hasWorker() || !$('#xText').value.trim() || waitLeft() > 0;
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

  /* ---------- лимит текста ----------
     Отдельный от фото: у текста своё окно (Бесплатный 1 / 5 мин,
     Платный 2 / мин, Премиум 5 / мин). Что сейчас — из /api/limits
     (поле text) и из ответа каждой проверки. */
  let nextAt = 0, ticker = null, seenLimits = null;
  const waitLeft = () => Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));

  function setWait(sec) {
    nextAt = sec > 0 ? Date.now() + sec * 1000 : 0;
    clearInterval(ticker);
    if (nextAt) {
      ticker = setInterval(() => {
        renderWait();
        if (!waitLeft()) { clearInterval(ticker); SkyCheck.loadLimits(); }
      }, 1000);
    }
    renderWait();
  }

  function renderWait() {
    const left = waitLeft();
    const el = $('#xWait');
    el.classList.toggle('hidden', !left);
    if (left) el.textContent = Sky.t('waitNext').replace('%1', SkyCheck.clock(left));
    updateBtn();
  }

  function renderPlan() {
    const l = SkyCheck.limits;
    const el = $('#xPlanLine');
    const t = l && l.text;
    el.classList.toggle('hidden', !t);
    if (!t) return;
    const per = t.window_seconds === 60 ? Sky.t('minOne') : Sky.t('minN').replace('%1', Math.round(t.window_seconds / 60));
    const win = Sky.t(t.requests === 1 ? 'perWindow' : 'perWindowN').replace('%1', t.requests).replace('%2', per);
    el.textContent = Sky.t('xPlan').replace('%1', SkyCheck.planName(l.plan)).replace('%2', win);
  }

  /* onChange зовётся и каждую секунду отсчёта фото — окно текста
     берём только из нового ответа /api/limits. */
  function onLimits() {
    const l = SkyCheck.limits;
    if (l && l !== seenLimits) {
      seenLimits = l;
      const r = l.text && l.text.rate;
      if (r) setWait(r.allowed ? 0 : r.retry_after);
    }
    renderPlan();
  }

  /* ---------- проверка ---------- */
  async function check() {
    if (busy) return;
    const text = $('#xText').value.trim();
    if (!text) { Sky.toast(Sky.t('errNoText'), 4000); $('#xText').focus(); return; }
    if (waitLeft()) { Sky.toast(Sky.t('waitNext').replace('%1', SkyCheck.clock(waitLeft())), 4000); return; }

    const body = { text, subject, length, criteria: $('#xCriteria').checked, grade: $('#xGrade').checked };
    const topic = $('#xTopic').value.trim();
    if (topic && length === 'long') body.topic = topic;

    setBusy(true);
    $('#xResultSec').classList.add('hidden');
    const res = await SkyCheck.request('/api/check-text', { method: 'POST', json: body, timeout: TIMEOUT_MS });
    setBusy(false);

    if (!res.ok) {
      const d = res.data || {};
      if (d.code === 'rate_limit' && d.retry_after) setWait(d.retry_after);
      render(null, SkyCheck.errorText(res));
      return;
    }
    const r = res.data.rate;
    if (r) setWait(r.remaining === 0 ? (r.retry_after || r.reset_in || 0) : 0);
    SkyCheck.addTokens(res.data.tokens_used);
    render(res.data, null);
    if (typeof window.renderHistory === 'function') window.renderHistory();
  }

  /* ---------- разбор ---------- */
  function render(data, fail) {
    last = { data, fail };
    const block = (key, inner) => `<div class="res-block"><h3>${esc(Sky.t(key))}</h3>${inner}</div>`;
    let html = '';
    if (data) {
      if ('assessment' in data || data.assessment_text) {
        const g = typeof data.assessment === 'number' ? data.assessment : null;
        html += `<div class="gradebox"><div class="grade g${g || 'x'}">${g || '—'}</div>
          <div class="said"><b>${esc(data.assessment_text || Sky.t('gradeL'))}</b></div></div>`;
      }
      if (data.criteria) {
        const c = data.criteria;
        html += block('xCritH', `<table class="crit"><tbody>${CRITERIA.map(k => {
          const v = typeof c[k] === 'number' ? c[k] : null;
          return `<tr><th scope="row">${esc(Sky.t('cr_' + k))}</th>` +
            `<td class="crit-bar"><span><i style="width:${v == null ? 0 : v * 20}%"></i></span></td>` +
            `<td class="crit-v">${v == null ? '—' : v + '/5'}</td></tr>`;
        }).join('')}</tbody></table>` +
          (c.topic_match === 0 ? `<div class="flag warn">${esc(Sky.t('xOffTopic'))}</div>` : ''));
      }
      const errs = Array.isArray(data.errors) ? data.errors : [];
      html += block('errH', errs.length
        ? errs.map(e => `<div class="err-item">
            ${e.type ? `<div class="kind">${esc(e.type)}</div>` : ''}
            ${e.fragment ? `<div class="frag">${esc(e.fragment)}</div>` : ''}
            ${e.correction ? `<div class="fix">${esc(Sky.t('fixL'))}${esc(e.correction)}</div>` : ''}
          </div>`).join('')
        : `<p class="lead" style="font-size:13px">${esc(Sky.t('noErrors'))}</p>`);
      if (data.comment) html += block('resComment', `<div class="res-text">${esc(data.comment)}</div>`);
      if (data.truncated) html += `<div class="limit-note">${esc(Sky.t('xTrunc'))}</div>`;
      if (data.truncated_input) html += `<div class="limit-note">${esc(Sky.t('xCut'))}</div>`;
      if (data.cached) html += `<p class="tok-note">${esc(Sky.t('xCached'))}</p>`;
    }
    if (fail) html += `<div class="limit-note">${esc(fail)}</div>`;
    if (data && data.tokens_used && data.tokens_used.total) {
      html += `<div class="tok-note">${esc(Sky.t('resTokens').replace('%1', data.tokens_used.total))}</div>`;
    }
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
  SkyCheck.onChange(onLimits);
  document.addEventListener('langchange', () => {
    renderSubjects(); renderLength(); renderCount(); renderWait(); renderPlan();
    if (!busy) $('#xCheck').textContent = Sky.t('xCheckBtn');
    $('#kindSeg').setAttribute('aria-label', Sky.t('kindAria'));
    if (last) render(last.data, last.fail);
  });

  /* ---------- запуск ---------- */
  Sky.applyI18n(document.getElementById('studentMode'));
  $('#kindSeg').setAttribute('aria-label', Sky.t('kindAria'));
  $('#xCriteria').checked = saved.criteria !== false;
  $('#xGrade').checked = saved.grade !== false;
  const params = new URLSearchParams(location.search);
  setKind(params.get('task') ? 'photo' : params.get('kind') || Sky.get('hwKind', 'photo'));
  renderSubjects(); renderLength(); renderCount(); onLimits(); updateBtn();
})();
