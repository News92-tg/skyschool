/* ============================================================
   SkyySchool — первое знакомство учителя (onboarding.html)

   Четыре шага:
     1. «Добро пожаловать» — что здесь можно делать;
     2. предметы — в profiles.subjects;
     3. первая подборка — название и одно задание, как на
        collections.html (та же таблица task_collections, код ставит
        база);
     4. «Готово» — код и ссылка для учеников, «Перейти в подборки».

   Показывается, только пока у учителя нет ни одной подборки. Пройден
   или пропущен — profiles.onboarding_done = true. Шаг и черновик
   живут в браузере: перезагрузка страницы не отбрасывает назад.
   ============================================================ */
'use strict';

(function () {

  Sky.init({
    obSkip:{ru:'Пропустить',en:'Skip'},
    obStepOf:{ru:'Шаг %1 из %2',en:'Step %1 of %2'},
    obBack:{ru:'Назад',en:'Back'},
    obNext:{ru:'Дальше',en:'Next'},
    obH1:{ru:'Добро пожаловать в SkyySchool!',en:'Welcome to SkyySchool!'},
    obP1:{ru:'Здесь вы собираете задания в подборки и раздаёте ученикам одной ссылкой — без регистрации с их стороны. Ответы проверяются сами, а вы видите результаты всего класса на одном экране. Тетради можно проверять по фото — оценку и разбор ошибок готовит ИИ.',
          en:'Here you collect tasks into sets and hand them out with one link — students do not need an account. Answers are checked automatically and you see the whole class on one screen. Notebooks can be checked from a photo — the AI suggests a mark and explains mistakes.'},
    obF1:{ru:'Подборки по ссылке',en:'Sets by link'},
    obF2:{ru:'Проверка по фото',en:'Photo checking'},
    obF3:{ru:'Аналитика класса',en:'Class analytics'},
    obStart:{ru:'Начать — 2 минуты',en:'Start — 2 minutes'},
    obH2:{ru:'Что вы преподаёте?',en:'What do you teach?'},
    obP2:{ru:'Выберите один или несколько предметов — под них подберём задания и шаблоны.',en:'Pick one or more subjects — we will tailor tasks and templates to them.'},
    obNeedSubj:{ru:'Выберите хотя бы один предмет',en:'Pick at least one subject'},
    obH3:{ru:'Создайте первую подборку',en:'Create your first set'},
    obP3:{ru:'Одно задание для начала — остальные добавите потом.',en:'One task to start with — add the rest later.'},
    obTitle:{ru:'Название',en:'Title'},
    obTitleDef:{ru:'Проверочная: %1',en:'Quiz: %1'},
    obSubject:{ru:'Предмет',en:'Subject'},
    obQ:{ru:'Задание',en:'Task'},
    obQPh:{ru:'Например: Сколько будет 7 × 8?',en:'For example: What is 7 × 8?'},
    obKindChoice:{ru:'Варианты ответа',en:'Multiple choice'},
    obKindText:{ru:'Ответ словом',en:'Short answer'},
    obOpt:{ru:'Вариант %1',en:'Option %1'},
    obRight:{ru:'Верный',en:'Correct'},
    obAnswer:{ru:'Правильный ответ',en:'Correct answer'},
    obAnswerPh:{ru:'56',en:'56'},
    obAnswerHelp:{ru:'Несколько верных — через точку с запятой',en:'Several correct answers — separate with a semicolon'},
    obCreate:{ru:'Создать подборку',en:'Create the set'},
    obLater:{ru:'Сделаю позже',en:'I will do it later'},
    obNeedTitle:{ru:'Напишите название',en:'Enter a title'},
    obNeedQ:{ru:'Напишите задание',en:'Enter the task'},
    obNeedOpts:{ru:'Нужно хотя бы два варианта',en:'At least two options are needed'},
    obNeedRight:{ru:'Отметьте верный вариант',en:'Mark the correct option'},
    obNeedAnswer:{ru:'Напишите правильный ответ',en:'Enter the correct answer'},
    obH4:{ru:'Готово!',en:'All set!'},
    obP4:{ru:'Подборка создана. Отправьте ученикам ссылку или код — ответы появятся в «Подборках».',en:'Your set is ready. Send students the link or code — answers will show up in Sets.'},
    obP4skip:{ru:'Первую подборку создадите, когда будет удобно, — всё под рукой в «Подборках».',en:'Create your first set whenever you like — it is all in Sets.'},
    obCode:{ru:'Код',en:'Code'},
    obCopy:{ru:'Скопировать ссылку',en:'Copy link'},
    obCopied:{ru:'Ссылка скопирована',en:'Link copied'},
    obGo:{ru:'Перейти в подборки',en:'Go to sets'},
    obProfile:{ru:'Открыть профиль',en:'Open profile'},
    obNextUp:{ru:'Что дальше',en:'What next'},
    obTip1:{ru:'Привяжите Telegram — пришлём, когда ученик сдаст работу',en:'Link Telegram — we will ping you when a student submits'},
    obTip2:{ru:'Проверьте тетради по фото',en:'Check notebooks from a photo'},
    obTip3:{ru:'Смотрите аналитику класса',en:'Watch class analytics'},
    obOnlyTeacher:{ru:'Это знакомство для учителей',en:'This tour is for teachers'},
    obOnlyTeacherD:{ru:'Ваш аккаунт — «%1». Всё нужное — в профиле.',en:'Your account is “%1”. Everything you need is in your profile.'},
    obNeedCloud:{ru:'Подборки работают с облаком (Supabase) — заполните assets/config.js.',en:'Sets need the cloud (Supabase) — fill in assets/config.js.'}
  });

  const $ = s => document.querySelector(s);
  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* Ключи — как у банков заданий и подборок (assets/collections.js). */
  const SUBJECTS = [
    ['math',        '📐', { ru: 'Математика',   en: 'Maths' }],
    ['russian',     '📝', { ru: 'Русский язык', en: 'Russian' }],
    ['english',     '🇬🇧', { ru: 'Английский',   en: 'English' }],
    ['physics',     '⚛️', { ru: 'Физика',       en: 'Physics' }],
    ['chemistry',   '🧪', { ru: 'Химия',        en: 'Chemistry' }],
    ['biology',     '🌿', { ru: 'Биология',     en: 'Biology' }],
    ['history',     '🏛️', { ru: 'История',      en: 'History' }],
    ['informatics', '💻', { ru: 'Информатика',  en: 'Computer science' }]
  ];
  const subjName = k => { const s = SUBJECTS.find(x => x[0] === k); return s ? Sky.L(s[2]) : k; };
  const TOTAL = 4;

  let me = null;
  let S = { step: 1, subjects: [], kind: 'choice', draft: {}, saved: null };
  const key = () => 'onboarding:' + (me ? me.id : 'anon');
  const persist = () => Sky.set(key(), S);

  /* ---------- шаги ---------- */
  function progress() {
    $('#obBar').innerHTML = Array.from({ length: TOTAL }, (_, i) =>
      `<span class="${i + 1 < S.step ? 'done' : i + 1 === S.step ? 'now' : ''}"></span>`).join('');
    $('#obCount').textContent = t('obStepOf').replace('%1', S.step).replace('%2', TOTAL);
    $('#obSkip').hidden = S.step === TOTAL;
  }

  const body = {
    1: () => `
      <div class="ob-hero" aria-hidden="true">${Sky.logoSvg('logo')}</div>
      <h1 id="obH">${esc(t('obH1'))}</h1>
      <p class="lead">${esc(t('obP1'))}</p>
      <ul class="ob-feats">
        <li><span>🔗</span>${esc(t('obF1'))}</li>
        <li><span>📷</span>${esc(t('obF2'))}</li>
        <li><span>📊</span>${esc(t('obF3'))}</li>
      </ul>
      <div class="ob-acts"><button type="button" class="btn big" data-to="2">${esc(t('obStart'))}</button></div>`,

    2: () => `
      <h1 id="obH">${esc(t('obH2'))}</h1>
      <p class="lead">${esc(t('obP2'))}</p>
      <div class="ob-subjects" role="group" aria-labelledby="obH">
        ${SUBJECTS.map(([id, ico, name]) => `
          <button type="button" class="ob-subj" data-subj="${id}" aria-pressed="${S.subjects.includes(id)}">
            <span class="ico" aria-hidden="true">${ico}</span><span>${esc(Sky.L(name))}</span><span class="tick" aria-hidden="true">✓</span>
          </button>`).join('')}
      </div>
      <p class="ob-err" role="alert" hidden></p>
      <div class="ob-acts">
        <button type="button" class="btn ghost" data-to="1">${esc(t('obBack'))}</button>
        <button type="button" class="btn" data-act="subjects">${esc(t('obNext'))}</button>
      </div>`,

    3: () => {
      const d = S.draft;
      const subj = d.subject && S.subjects.includes(d.subject) ? d.subject : S.subjects[0] || 'math';
      const opts = d.options || ['', '', '', ''];
      return `
      <h1 id="obH">${esc(t('obH3'))}</h1>
      <p class="lead">${esc(t('obP3'))}</p>
      <form class="ob-form" novalidate>
        <div class="ob-pair">
          <div class="field"><label for="obTitle">${esc(t('obTitle'))}</label>
            <input id="obTitle" type="text" maxlength="120" value="${esc(d.title != null ? d.title : t('obTitleDef').replace('%1', subjName(subj)))}"></div>
          <div class="field"><label for="obSubj">${esc(t('obSubject'))}</label>
            <select id="obSubj">${(S.subjects.length ? S.subjects : SUBJECTS.map(s => s[0])).map(k => `<option value="${k}" ${k === subj ? 'selected' : ''}>${esc(subjName(k))}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="obQ">${esc(t('obQ'))}</label>
          <textarea id="obQ" rows="2" maxlength="2000" placeholder="${esc(t('obQPh'))}">${esc(d.q || '')}</textarea></div>
        <div class="ob-kind" role="group">
          <button type="button" data-kind="choice" aria-pressed="${S.kind === 'choice'}">${esc(t('obKindChoice'))}</button>
          <button type="button" data-kind="text" aria-pressed="${S.kind === 'text'}">${esc(t('obKindText'))}</button>
        </div>
        <div class="ob-opts" ${S.kind === 'choice' ? '' : 'hidden'}>
          ${opts.map((v, i) => `
            <div class="ob-opt">
              <input type="text" maxlength="300" data-opt="${i}" placeholder="${esc(t('obOpt').replace('%1', i + 1))}" value="${esc(v)}" aria-label="${esc(t('obOpt').replace('%1', i + 1))}">
              <label class="ob-right"><input type="radio" name="obRight" value="${i}" ${d.right === i ? 'checked' : ''}><span>✓ ${esc(t('obRight'))}</span></label>
            </div>`).join('')}
        </div>
        <div class="field" ${S.kind === 'text' ? '' : 'hidden'} id="obAnsBox"><label for="obAns">${esc(t('obAnswer'))}</label>
          <input id="obAns" type="text" maxlength="300" placeholder="${esc(t('obAnswerPh'))}" value="${esc(d.answer || '')}">
          <span class="help">${esc(t('obAnswerHelp'))}</span></div>
        <p class="ob-err" role="alert" hidden></p>
        <div class="ob-acts">
          <button type="button" class="btn ghost" data-to="2">${esc(t('obBack'))}</button>
          <button type="button" class="ob-later" data-act="later">${esc(t('obLater'))}</button>
          <button type="submit" class="btn">${esc(t('obCreate'))}</button>
        </div>
      </form>`;
    },

    4: () => {
      const c = S.saved;
      const link = c && window.SkyCollections ? SkyCollections.url(c.share_code) : '';
      return `
      <div class="ob-hero done" aria-hidden="true">🎉</div>
      <h1 id="obH">${esc(t('obH4'))}</h1>
      <p class="lead">${esc(t(c ? 'obP4' : 'obP4skip'))}</p>
      ${c ? `
        <div class="ob-share">
          <div><span>${esc(t('obCode'))}</span><b class="ob-code">${esc(c.share_code)}</b></div>
          <div class="ob-link"><input type="text" readonly value="${esc(link)}" aria-label="URL"><button type="button" class="btn ghost small" data-act="copy">${esc(t('obCopy'))}</button></div>
        </div>` : ''}
      <div class="ob-next">
        <b>${esc(t('obNextUp'))}</b>
        <a href="profile.html#telegram">✈️ ${esc(t('obTip1'))}</a>
        <a href="photo.html">📷 ${esc(t('obTip2'))}</a>
        <a href="analytics.html">📊 ${esc(t('obTip3'))}</a>
      </div>
      <div class="ob-acts">
        <a class="btn ghost" href="profile.html">${esc(t('obProfile'))}</a>
        <a class="btn big" href="collections.html" id="obGo">${esc(t('obGo'))}</a>
      </div>`;
    }
  };

  function render(focus) {
    progress();
    $('#obBody').innerHTML = body[S.step]();
    $('#obBody').dataset.step = S.step;
    wire();
    if (focus !== false) {
      const h = $('#obH');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    window.scrollTo({ top: 0 });
  }

  function go(step) {
    saveDraft();
    S.step = step;
    persist();
    render();
    if (step === TOTAL) markDone();
  }

  function err(msg, focusSel) {
    const p = $('#obBody .ob-err');
    if (!p) return;
    p.hidden = !msg;
    p.textContent = msg || '';
    if (focusSel && $(focusSel)) $(focusSel).focus();
  }

  function saveDraft() {
    if (S.step !== 3 || !$('#obQ')) return;
    const right = document.querySelector('input[name=obRight]:checked');
    S.draft = {
      title: $('#obTitle').value,
      subject: $('#obSubj').value,
      q: $('#obQ').value,
      options: [...document.querySelectorAll('[data-opt]')].map(i => i.value),
      right: right ? +right.value : null,
      answer: $('#obAns').value
    };
  }

  async function markDone() {
    if (!me || me.onboarding_done) return;
    const r = await Sky.db.update('profiles', me.id, { onboarding_done: true });
    if (r) me.onboarding_done = true;
  }

  async function saveSubjects() {
    if (!S.subjects.length) return err(t('obNeedSubj'));
    const btn = $('[data-act=subjects]');
    btn.disabled = true;
    await Sky.db.update('profiles', me.id, { subjects: S.subjects });
    btn.disabled = false;
    go(3);
  }

  async function create(e) {
    e.preventDefault();
    saveDraft();
    const d = S.draft;
    const title = d.title.trim(), q = d.q.trim();
    if (!title) return err(t('obNeedTitle'), '#obTitle');
    if (!q) return err(t('obNeedQ'), '#obQ');
    let task;
    if (S.kind === 'choice') {
      const rows = d.options.map((v, i) => ({ v: v.trim(), i })).filter(r => r.v);
      if (rows.length < 2) return err(t('obNeedOpts'), '[data-opt="0"]');
      const right = rows.findIndex(r => r.i === d.right);
      if (right < 0) return err(t('obNeedRight'));
      task = { id: 't1', type: 'choice', text: q, options: rows.map(r => r.v), answer: right, source: 'own' };
    } else {
      const accept = d.answer.split(';').map(s => s.trim()).filter(Boolean).slice(0, 20);
      if (!accept.length) return err(t('obNeedAnswer'), '#obAns');
      task = { id: 't1', type: 'text', text: q, accept, source: 'own' };
    }
    const btn = $('#obBody [type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>';
    const saved = await Sky.db.insert('task_collections', {
      id: (crypto.randomUUID && crypto.randomUUID()) || undefined,
      title, subject: d.subject || null, is_public: true, tasks: [task]
    });
    if (!saved) { btn.disabled = false; btn.textContent = t('obCreate'); return; }
    S.saved = { id: saved.id, share_code: saved.share_code, title: saved.title };
    S.draft = {};
    go(4);
  }

  function wire() {
    const b = $('#obBody');
    b.querySelectorAll('[data-to]').forEach(x => x.addEventListener('click', () => go(+x.dataset.to)));
    b.querySelectorAll('[data-subj]').forEach(x => x.addEventListener('click', () => {
      const id = x.dataset.subj;
      S.subjects = S.subjects.includes(id) ? S.subjects.filter(s => s !== id) : S.subjects.concat(id);
      x.setAttribute('aria-pressed', String(S.subjects.includes(id)));
      err('');
      persist();
    }));
    const subjBtn = b.querySelector('[data-act=subjects]');
    if (subjBtn) subjBtn.addEventListener('click', saveSubjects);
    b.querySelectorAll('[data-kind]').forEach(x => x.addEventListener('click', () => {
      saveDraft();
      S.kind = x.dataset.kind;
      persist();
      render(false);
    }));
    const form = b.querySelector('form');
    if (form) form.addEventListener('submit', create);
    const later = b.querySelector('[data-act=later]');
    if (later) later.addEventListener('click', () => { S.saved = null; go(4); });
    const copy = b.querySelector('[data-act=copy]');
    if (copy) copy.addEventListener('click', async () => {
      const ok = await SkyCollections.copy(b.querySelector('.ob-link input').value);
      Sky.toast(ok ? t('obCopied') : b.querySelector('.ob-link input').value, 3000);
    });
  }

  function gate(html) {
    $('#obCard').hidden = true;
    $('#obGate').innerHTML = html;
  }

  /* ---------- запуск ---------- */
  $('#obSkip').addEventListener('click', async () => {
    await markDone();
    location.href = 'profile.html';
  });

  (async function boot() {
    await Sky.db.ready;
    me = Sky.db.me();
    if (!Sky.db.isCloud()) return gate(`<p class="note">${esc(t('obNeedCloud'))}</p>`);
    if (!me) { location.replace('auth.html?mode=signup&role=teacher&next=onboarding.html'); return; }
    if (me.role !== 'teacher') {
      return gate(`<div class="panel"><div class="empty"><div class="big">🧭</div><b>${esc(t('obOnlyTeacher'))}</b>
        <p>${esc(t('obOnlyTeacherD').replace('%1', Sky.t(me.role || 'student')))}</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><a class="btn" href="profile.html">${esc(t('obProfile'))}</a></div></div></div>`);
    }
    const saved = Sky.get(key(), null);
    if (saved && saved.step) S = Object.assign(S, saved);
    if (!saved && Array.isArray(me.subjects) && me.subjects.length) S.subjects = me.subjects.filter(s => SUBJECTS.some(x => x[0] === s));
    /* Подборки уже есть — знакомство не нужно (кроме финального экрана
       сразу после создания первой). */
    if (S.step !== TOTAL) {
      const colls = await Sky.db.list('task_collections', { teacher_id: me.id });
      if (colls && colls.length) { await markDone(); location.replace('collections.html'); return; }
    }
    $('#obCard').hidden = false;
    render(false);
    if (S.step === TOTAL) markDone();
  })();

  document.addEventListener('langchange', () => { if (!$('#obCard').hidden) { saveDraft(); render(false); } });
})();
