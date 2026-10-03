/* ============================================================
   SkyySchool — свои задания учителя («Мои задания» в collections.html)

   Банк заданий учителя — таблица teacher_tasks (sql/schema-teacher-
   tasks.sql; RLS — только свои). Здесь:
     • вкладка «Мои задания»: фильтр по предмету и поиск, у задания —
       «Добавить в подборку», «Изменить», «Удалить»;
     • «Создать задание»: вручную (текст, варианты или ответ,
       объяснение) или с фото — Worker /check-photo распознаёт текст,
       учитель правит и сохраняет. Строки вида «А) …», «1. …» сами
       становятся вариантами ответа;
     • «Добавить в подборку» — в существующую (задание дописывается в
       её tasks) или в новую (открывается окно новой подборки).
   Окно новой подборки (collections.js) берёт отсюда список для
   вкладки «Мои задания»: SkyTeacherTasks.items(), .toCollectionTask().

   Формат teacher_tasks → задание подборки:
     варианты + номер верного  → { type:'choice', options, answer }
     ответы через «;»          → { type:'text', accept:[…] }
     без ответа                → { type:'text' } — проверит учитель
   explanation переходит в задание подборки: ученику его не отдаёт
   get_collection_by_code, а учитель видит в разборе работ.
   ============================================================ */
'use strict';

(function () {
  Sky.extendDict({
    ttViewColls:{ru:'Подборки',en:'Collections'},
    ttViewTasks:{ru:'Мои задания',en:'My tasks'},
    ttCreate:{ru:'Создать задание',en:'New task'},
    ttAllSubj:{ru:'Все предметы',en:'All subjects'},
    ttSearch:{ru:'Поиск по тексту',en:'Search the text'},
    ttEmpty:{ru:'Своих заданий пока нет',en:'No tasks of your own yet'},
    ttEmptyD:{ru:'Напишите задание или сфотографируйте его из учебника — оно сохранится здесь, и его можно добавить в любую подборку.',
              en:'Write a task or photograph it from a textbook — it is kept here and can be added to any collection.'},
    ttNoMatch:{ru:'Ничего не нашлось — смените предмет или поиск',en:'Nothing found — change the subject or the search'},
    ttLoadErr:{ru:'Не удалось загрузить задания',en:'Could not load your tasks'},
    ttKindChoice:{ru:'варианты: %1',en:'options: %1'},
    ttKindText:{ru:'ответ словом',en:'text answer'},
    ttKindOpen:{ru:'открытое',en:'open'},
    ttFromPhoto:{ru:'с фото',en:'from photo'},
    ttAdd:{ru:'В подборку',en:'Add to collection'},
    ttEdit:{ru:'Изменить',en:'Edit'},
    ttDel:{ru:'Удалить',en:'Delete'},
    ttDelQ:{ru:'Удалить задание? В подборках, куда оно уже добавлено, оно останется.',en:'Delete this task? Collections it was already added to keep it.'},
    ttDeleted:{ru:'Задание удалено',en:'Task deleted'},
    ttH:{ru:'Новое задание',en:'New task'},
    ttHEdit:{ru:'Изменить задание',en:'Edit task'},
    ttManual:{ru:'Вручную',en:'Type it'},
    ttPhoto:{ru:'С фото',en:'From a photo'},
    ttSubject:{ru:'Предмет',en:'Subject'},
    ttText:{ru:'Текст задания',en:'Task text'},
    ttTextPh:{ru:'Например: Найдите 25% от 80',en:'For example: Find 25% of 80'},
    ttKind:{ru:'Ответ',en:'Answer'},
    ttKChoice:{ru:'Варианты',en:'Options'},
    ttKText:{ru:'Словом или числом',en:'Word or number'},
    ttKOpen:{ru:'Проверю сам',en:'I will check it'},
    ttOption:{ru:'Вариант %1',en:'Option %1'},
    ttMarkRight:{ru:'Отметьте верный вариант кружком слева',en:'Mark the correct option with the circle on the left'},
    ttAddOpt:{ru:'+ вариант',en:'+ option'},
    ttAccept:{ru:'Правильный ответ',en:'Correct answer'},
    ttAcceptHelp:{ru:'Несколько верных — через «;». Регистр, ё/е и пробелы не важны.',en:'Several correct answers — separate with “;”. Case and spaces do not matter.'},
    ttExplain:{ru:'Объяснение решения (необязательно)',en:'How to solve it (optional)'},
    ttExplainHelp:{ru:'Увидите его в разборе работ рядом с ошибкой. Ученику не показывается.',en:'You will see it next to the mistake when reviewing work. Students do not see it.'},
    ttSave:{ru:'Сохранить',en:'Save'},
    ttSaved:{ru:'Задание сохранено',en:'Task saved'},
    ttCancel:{ru:'Отмена',en:'Cancel'},
    ttNeedText:{ru:'Впишите текст задания',en:'Enter the task text'},
    ttNeedOpts:{ru:'Нужно хотя бы два варианта',en:'At least two options are needed'},
    ttNeedRight:{ru:'Отметьте верный вариант',en:'Mark the correct option'},
    ttNeedAccept:{ru:'Впишите правильный ответ — или выберите «Проверю сам»',en:'Enter the correct answer — or choose “I will check it”'},
    ttPhotoHelp:{ru:'Сфотографируйте задание из учебника или с доски — текст распознается, вы поправите и сохраните. Распознавание тратит одну проверку по фото.',
                 en:'Take a photo of a task from a textbook or the board — the text is recognised, you fix it and save. Recognition uses one photo check.'},
    ttPick:{ru:'Выбрать фото',en:'Choose a photo'},
    ttRecognize:{ru:'Распознать',en:'Recognise'},
    ttRecognizing:{ru:'Распознаю текст…',en:'Recognising the text…'},
    ttRecognized:{ru:'Текст распознан — проверьте и поправьте его',en:'Text recognised — check and correct it'},
    ttOptsFound:{ru:'Нашлись варианты ответа: %1 — отметьте верный',en:'Found %1 answer options — mark the correct one'},
    ttNoText:{ru:'На фото не нашлось текста. Снимите поближе и при хорошем свете.',en:'No text found in the photo. Take it closer and in good light.'},
    ttPhotoErr:{ru:'Не удалось распознать: %1',en:'Could not recognise: %1'},
    ttTooBig:{ru:'Фото слишком большое — выберите другое',en:'The photo is too large — choose another one'},
    ttNoWorker:{ru:'Распознавание недоступно: в assets/config.js не задан адрес Worker (AI_BASE).',en:'Recognition is unavailable: the Worker address (AI_BASE) is not set in assets/config.js.'},
    ttAddH:{ru:'Добавить в подборку',en:'Add to a collection'},
    ttAddNew:{ru:'+ Новая подборка с этим заданием',en:'+ New collection with this task'},
    ttAddNone:{ru:'Подборок пока нет — создайте первую с этим заданием.',en:'No collections yet — create the first one with this task.'},
    ttAddDo:{ru:'Добавить',en:'Add'},
    ttAdded:{ru:'Добавлено в «%1»',en:'Added to “%1”'},
    ttAlready:{ru:'Это задание уже есть в «%1»',en:'This task is already in “%1”'},
    ttFull:{ru:'В подборке уже 100 заданий — больше нельзя',en:'The collection already has 100 tasks'},
    ttTasksN:{ru:'заданий: %1',en:'tasks: %1'},
    ttRetry:{ru:'Повторить',en:'Try again'}
  });

  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const $ = s => document.querySelector(s);
  const loc = () => Sky.lang === 'en' ? 'en-GB' : 'ru-RU';

  const SUBJECTS = [
    ['math', { ru: 'Математика', en: 'Mathematics' }], ['informatics', { ru: 'Информатика', en: 'Computer science' }],
    ['russian', { ru: 'Русский язык', en: 'Russian' }], ['physics', { ru: 'Физика', en: 'Physics' }],
    ['chemistry', { ru: 'Химия', en: 'Chemistry' }], ['biology', { ru: 'Биология', en: 'Biology' }],
    ['geography', { ru: 'География', en: 'Geography' }], ['history', { ru: 'История', en: 'History' }],
    ['social', { ru: 'Обществознание', en: 'Social studies' }], ['english', { ru: 'Английский', en: 'English' }],
    ['german', { ru: 'Немецкий', en: 'German' }], ['spanish', { ru: 'Испанский', en: 'Spanish' }],
    ['polish', { ru: 'Польский', en: 'Polish' }], ['other', { ru: 'Другое', en: 'Other' }]
  ];
  const subjName = k => { const s = SUBJECTS.find(x => x[0] === k); return s ? Sky.L(s[1]) : (k || ''); };
  const subjOptions = sel => SUBJECTS.map(([id, n]) => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(Sky.L(n))}</option>`).join('');
  const letter = i => ((Sky.lang === 'en' ? 'ABCDEFGHIJ' : 'АБВГДЕЖЗИК')[i]) || String(i + 1);

  let items = null;           // null — ещё не загружены; [] — пусто
  let loadErr = false, loading = null;
  let filter = { subject: Sky.get('ttSubj', '') || '', q: '' };
  let me = null;

  /* ---------- данные ---------- */
  function load() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const rows = await Sky.db.list('teacher_tasks', { teacher_id: me.id }, { strict: true });
        items = (rows || []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
        loadErr = false;
      } catch (e) {
        loadErr = true;
        if (window.SkyErrors) SkyErrors.show(e, { retry: () => { loading = null; load().then(render); }, context: 'teacher-tasks' });
      }
      loading = null;
      render();
      document.dispatchEvent(new CustomEvent('teachertaskschange'));
    })();
    return loading;
  }

  const kindOf = tt => {
    const opts = Array.isArray(tt.options) ? tt.options : [];
    if (opts.length >= 2 && /^\d{1,2}$/.test(String(tt.correct_answer || ''))) return 'choice';
    return String(tt.correct_answer || '').trim() ? 'text' : 'open';
  };

  /* teacher_tasks → задание подборки (формат collections.js) */
  function toCollectionTask(tt) {
    const base = { text: tt.task_text, source: 'teacher:' + tt.id };
    if (tt.explanation) base.explanation = tt.explanation;
    const kind = kindOf(tt);
    if (kind === 'choice') return Object.assign(base, { type: 'choice', options: tt.options.map(String), answer: Number(tt.correct_answer) });
    const accept = String(tt.correct_answer || '').split(';').map(s => s.trim()).filter(Boolean).slice(0, 20);
    return Object.assign(base, { type: 'text' }, accept.length ? { accept } : {});
  }

  /* ---------- вкладки «Подборки | Мои задания» ---------- */
  function setView(v, push) {
    const tasks = v === 'tasks';
    const seg = $('#clViews');
    if (!seg) return;
    seg.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === v)));
    $('#viewColls').classList.toggle('hidden', tasks);
    $('#viewTasks').classList.toggle('hidden', !tasks);
    if (push !== false) history.replaceState(null, '', tasks ? '#tasks' : location.pathname + location.search);
    if (tasks && items === null && !loading) load();
    render();
  }

  /* ---------- список «Мои задания» ---------- */
  function render() {
    const box = $('#viewTasks');
    if (!box || box.classList.contains('hidden')) { count(); return; }
    count();
    if (items === null) {
      box.innerHTML = loadErr
        ? `<div class="panel"><div class="empty"><div class="big">📭</div><b>${esc(t('ttLoadErr'))}</b>
            <div class="actions" style="justify-content:center;margin-top:12px"><button type="button" class="btn" data-tt="retry">${esc(t('ttRetry'))}</button></div></div></div>`
        : '<div class="panel"><span class="spin"></span></div>';
      return;
    }
    const subjects = [...new Set(items.map(x => x.subject))];
    if (filter.subject && !subjects.includes(filter.subject)) filter.subject = '';
    const needle = filter.q.trim().toLowerCase();
    const list = items.filter(x => (!filter.subject || x.subject === filter.subject) &&
      (!needle || String(x.task_text).toLowerCase().includes(needle)));
    const bar = `<div class="tt-bar">
        <div class="field tt-f"><label for="ttSubj" class="sr-only">${esc(t('ttSubject'))}</label>
          <select id="ttSubj"><option value="">${esc(t('ttAllSubj'))}</option>${subjects.map(s => `<option value="${esc(s)}"${s === filter.subject ? ' selected' : ''}>${esc(subjName(s))}</option>`).join('')}</select></div>
        <div class="field tt-f grow"><label for="ttQ" class="sr-only">${esc(t('ttSearch'))}</label>
          <input type="search" id="ttQ" placeholder="${esc(t('ttSearch'))}" value="${esc(filter.q)}" autocomplete="off"></div>
        <button type="button" class="btn" data-tt="new">${esc(t('ttCreate'))}</button>
      </div>`;
    if (!items.length) {
      box.innerHTML = `<div class="panel"><div class="empty"><div class="big">✏️</div><b>${esc(t('ttEmpty'))}</b><p>${esc(t('ttEmptyD'))}</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><button type="button" class="btn" data-tt="new">${esc(t('ttCreate'))}</button>
        <button type="button" class="btn ghost" data-tt="new-photo">📷 ${esc(t('ttPhoto'))}</button></div></div></div>`;
      return;
    }
    const focus = document.activeElement && document.activeElement.id === 'ttQ';
    box.innerHTML = bar + (list.length ? `<div class="tt-list">${list.map(card).join('')}</div>`
      : `<p class="tt-none">${esc(t('ttNoMatch'))}</p>`);
    if (focus) { const q = $('#ttQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  function card(tt) {
    const kind = kindOf(tt);
    const opts = Array.isArray(tt.options) ? tt.options : [];
    const right = kind === 'choice' ? Number(tt.correct_answer) : -1;
    return `<article class="tt-card" data-id="${esc(tt.id)}">
      <div class="tt-q">${esc(tt.task_text)}</div>
      ${opts.length ? `<ol class="tt-opts">${opts.map((o, i) => `<li class="${i === right ? 'ok' : ''}"><b>${esc(letter(i))}.</b> ${esc(o)}${i === right ? ' ✓' : ''}</li>`).join('')}</ol>` : ''}
      ${kind === 'text' ? `<div class="tt-ans">✓ ${esc(String(tt.correct_answer).split(';').map(s => s.trim()).filter(Boolean).join(' / '))}</div>` : ''}
      <div class="tt-meta">
        <span class="tag">${esc(subjName(tt.subject))}</span>
        <span class="tag gray">${esc(kind === 'choice' ? t('ttKindChoice').replace('%1', opts.length) : kind === 'text' ? t('ttKindText') : t('ttKindOpen'))}</span>
        ${tt.source === 'photo' ? `<span class="tag gray">📷 ${esc(t('ttFromPhoto'))}</span>` : ''}
        <span class="tt-date">${esc(new Date(tt.created_at).toLocaleDateString(loc(), { day: 'numeric', month: 'short' }))}</span>
      </div>
      <div class="tt-acts">
        <button type="button" class="btn small" data-tt="add">${esc(t('ttAdd'))}</button>
        <button type="button" class="btn small ghost" data-tt="edit">${esc(t('ttEdit'))}</button>
        <button type="button" class="btn small ghost danger tt-del" data-tt="del">${esc(t('ttDel'))}</button>
      </div>
    </article>`;
  }

  function count() {
    const n = $('#ttN');
    if (n) n.textContent = items && items.length ? String(items.length) : '';
  }

  /* ---------- «Создать задание» / «Изменить» ---------- */
  function openForm(tt, startWithPhoto) {
    const edit = !!tt;
    tt = tt || { subject: filter.subject || Sky.get('ttLastSubj', 'math'), task_text: '', options: null, correct_answer: '', explanation: '', source: 'manual' };
    let kind = edit ? kindOf(tt) : 'choice';
    let source = tt.source || 'manual';
    const opts0 = Array.isArray(tt.options) && tt.options.length ? tt.options : ['', '', '', ''];
    /* у нового задания верный не отмечен: Number('') — это 0, и первый
       вариант молча стал бы «верным» */
    const right0 = edit && kind === 'choice' ? Number(tt.correct_answer) : -1;

    Sky.modal(`<form class="tt-form" novalidate>
      <h2>${esc(t(edit ? 'ttHEdit' : 'ttH'))}</h2>
      ${edit ? '' : `<div class="seg" id="ttSrc">
        <button type="button" data-src="manual" aria-pressed="${!startWithPhoto}">${esc(t('ttManual'))}</button>
        <button type="button" data-src="photo" aria-pressed="${!!startWithPhoto}">📷 ${esc(t('ttPhoto'))}</button></div>`}
      <div class="tt-photo${startWithPhoto && !edit ? '' : ' hidden'}" id="ttPhotoPane">
        <p class="help" style="margin:0">${esc(t('ttPhotoHelp'))}</p>
        <div class="tt-photo-row">
          <label class="btn ghost" for="ttFile">${esc(t('ttPick'))}</label>
          <input type="file" id="ttFile" accept="image/*" capture="environment" class="sr-only">
          <img id="ttPrev" alt="" hidden>
          <button type="button" class="btn" id="ttOcr" disabled>${esc(t('ttRecognize'))}</button>
        </div>
        <div id="ttOcrMsg" class="tt-msg" aria-live="polite"></div>
      </div>
      <div class="field"><label for="ttSubjIn">${esc(t('ttSubject'))}</label><select id="ttSubjIn">${subjOptions(tt.subject)}</select></div>
      <div class="field"><label for="ttTextIn">${esc(t('ttText'))}</label>
        <textarea id="ttTextIn" rows="4" maxlength="4000" placeholder="${esc(t('ttTextPh'))}">${esc(tt.task_text)}</textarea>
        <span class="field-err" id="ttTextErr"></span></div>
      <div class="field"><span class="label">${esc(t('ttKind'))}</span>
        <div class="seg" id="ttKind">
          <button type="button" data-kind="choice" aria-pressed="${kind === 'choice'}">${esc(t('ttKChoice'))}</button>
          <button type="button" data-kind="text" aria-pressed="${kind === 'text'}">${esc(t('ttKText'))}</button>
          <button type="button" data-kind="open" aria-pressed="${kind === 'open'}">${esc(t('ttKOpen'))}</button>
        </div></div>
      <div id="ttChoice" class="tt-opts-edit${kind === 'choice' ? '' : ' hidden'}">
        <span class="help">${esc(t('ttMarkRight'))}</span>
        <div id="ttOptRows"></div>
        <button type="button" class="btn ghost small" id="ttAddOpt" style="justify-self:start">${esc(t('ttAddOpt'))}</button>
        <span class="field-err" id="ttOptErr"></span>
      </div>
      <div id="ttTextKind" class="field${kind === 'text' ? '' : ' hidden'}"><label for="ttAcceptIn">${esc(t('ttAccept'))}</label>
        <input type="text" id="ttAcceptIn" maxlength="500" value="${esc(kind === 'text' ? tt.correct_answer : '')}">
        <span class="help">${esc(t('ttAcceptHelp'))}</span><span class="field-err" id="ttAcceptErr"></span></div>
      <div class="field"><label for="ttExplIn">${esc(t('ttExplain'))}</label>
        <textarea id="ttExplIn" rows="2" maxlength="4000">${esc(tt.explanation || '')}</textarea>
        <span class="help">${esc(t('ttExplainHelp'))}</span></div>
      <div class="tt-end"><button type="button" class="btn ghost" data-x>${esc(t('ttCancel'))}</button>
        <button type="submit" class="btn" id="ttSave">${esc(t('ttSave'))}</button></div>
    </form>`, (box, close) => {
      const q = s => box.querySelector(s);
      q('[data-x]').addEventListener('click', close);

      const optRow = (i, v, on) => `<div class="tt-opt"><input type="radio" name="ttRight" value="${i}"${on ? ' checked' : ''} aria-label="${esc(t('ttNeedRight'))} ${i + 1}">
        <span class="tt-l">${esc(letter(i))}</span><input type="text" maxlength="300" placeholder="${esc(t('ttOption').replace('%1', i + 1))}" value="${esc(v || '')}"></div>`;
      const setOpts = (list, right) => { q('#ttOptRows').innerHTML = list.map((v, i) => optRow(i, v, i === right)).join(''); };
      setOpts(opts0, right0);
      q('#ttAddOpt').addEventListener('click', () => {
        const n = q('#ttOptRows').children.length;
        if (n < 10) q('#ttOptRows').insertAdjacentHTML('beforeend', optRow(n, '', false));
      });
      const setKind = k => {
        kind = k;
        q('#ttKind').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === k)));
        q('#ttChoice').classList.toggle('hidden', k !== 'choice');
        q('#ttTextKind').classList.toggle('hidden', k !== 'text');
      };
      q('#ttKind').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (b) setKind(b.dataset.kind); });

      /* ошибки — красным под полем, сами пропадают, когда поле поправили */
      const err = (id, msg) => { const el = q('#' + id); el.textContent = msg || ''; const f = el.closest('.field, .tt-opts-edit'); if (f) f.classList.toggle('invalid', !!msg); };
      q('#ttTextIn').addEventListener('input', () => err('ttTextErr'));
      q('#ttAcceptIn').addEventListener('input', () => err('ttAcceptErr'));
      q('#ttOptRows').addEventListener('input', () => err('ttOptErr'));
      q('#ttOptRows').addEventListener('change', () => err('ttOptErr'));

      /* --- с фото --- */
      const src = q('#ttSrc');
      if (src) src.addEventListener('click', e => {
        const b = e.target.closest('[data-src]');
        if (!b) return;
        src.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        q('#ttPhotoPane').classList.toggle('hidden', b.dataset.src !== 'photo');
      });
      let file = null;
      q('#ttFile').addEventListener('change', () => {
        file = q('#ttFile').files && q('#ttFile').files[0] || null;
        const img = q('#ttPrev');
        if (img.src) URL.revokeObjectURL(img.src);
        img.hidden = !file;
        if (file) img.src = URL.createObjectURL(file);
        q('#ttOcr').disabled = !file;
        q('#ttOcrMsg').textContent = '';
      });
      q('#ttOcr').addEventListener('click', async () => {
        if (!file) return;
        const btn = q('#ttOcr'), msg = q('#ttOcrMsg');
        btn.disabled = true;
        btn.innerHTML = `<span class="spin"></span> ${esc(t('ttRecognizing'))}`;
        msg.className = 'tt-msg';
        msg.textContent = '';
        const res = await recognize(file, q('#ttSubjIn').value);
        btn.disabled = false;
        btn.textContent = t('ttRecognize');
        if (!box.isConnected) return;
        if (res.error) { msg.className = 'tt-msg bad'; msg.textContent = res.error; return; }
        const parsed = parseTask(res.text);
        q('#ttTextIn').value = parsed.question;
        err('ttTextErr');
        source = 'photo';
        if (parsed.options.length >= 2) { setKind('choice'); setOpts(parsed.options.concat(parsed.options.length < 4 ? [''] : []), -1); }
        msg.className = 'tt-msg ok';
        msg.textContent = parsed.options.length >= 2 ? t('ttOptsFound').replace('%1', parsed.options.length) : t('ttRecognized');
        q('#ttTextIn').focus();
      });

      /* --- сохранить --- */
      box.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const text = q('#ttTextIn').value.trim();
        let bad = false;
        if (!text) { err('ttTextErr', t('ttNeedText')); bad = true; }
        const row = { subject: q('#ttSubjIn').value, task_text: text, explanation: q('#ttExplIn').value.trim() || null, source,
          options: null, correct_answer: null };
        if (kind === 'choice') {
          const rows = [...q('#ttOptRows').children].map(r => ({ v: r.querySelector('input[type=text]').value.trim(), on: r.querySelector('input[type=radio]').checked }));
          const filled = rows.filter(r => r.v);
          const right = filled.findIndex(r => r.on);
          if (filled.length < 2) { err('ttOptErr', t('ttNeedOpts')); bad = true; }
          else if (right < 0) { err('ttOptErr', t('ttNeedRight')); bad = true; }
          row.options = filled.map(r => r.v);
          row.correct_answer = String(right);
        } else if (kind === 'text') {
          const acc = q('#ttAcceptIn').value.split(';').map(s => s.trim()).filter(Boolean).join('; ');
          if (!acc) { err('ttAcceptErr', t('ttNeedAccept')); bad = true; }
          row.correct_answer = acc;
        }
        if (bad) { const first = box.querySelector('.invalid input, .invalid textarea'); if (first) first.focus(); return; }
        const btn = q('#ttSave');
        btn.disabled = true;
        btn.innerHTML = `<span class="spin"></span> ${esc(t('ttSave'))}`;
        const saved = edit ? await Sky.db.update('teacher_tasks', tt.id, row) : await Sky.db.insert('teacher_tasks', Object.assign({ teacher_id: me.id }, row));
        btn.disabled = false;
        btn.textContent = t('ttSave');
        if (!saved) return;                              // db.js уже показал ошибку
        Sky.set('ttLastSubj', row.subject);
        if (edit) items = items.map(x => x.id === saved.id ? saved : x);
        else items = [saved].concat(items || []);
        close();
        Sky.toast(t('ttSaved'));
        if ($('#viewTasks').classList.contains('hidden')) setView('tasks');
        render();
        document.dispatchEvent(new CustomEvent('teachertaskschange'));
      });
      (startWithPhoto && !edit ? q('#ttFile').closest('.tt-photo').querySelector('label') : q('#ttTextIn')).focus();
    });
  }

  /* Варианты в распознанном тексте: строки «А) …», «б. …», «1) …», «a) …». */
  function parseTask(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
    const re = /^(?:[АБВГДЕабвгдеA-Fa-f]|[1-6])\s*[).]\s+(.+)$/;
    const firstOpt = lines.findIndex(l => re.test(l));
    if (firstOpt < 0) return { question: lines.join('\n'), options: [] };
    const options = [];
    for (const l of lines.slice(firstOpt)) {
      const m = l.match(re);
      if (m) options.push(m[1].trim());
      else if (options.length) options[options.length - 1] += ' ' + l;
    }
    const question = lines.slice(0, firstOpt).join('\n');
    return options.length >= 2 && question ? { question, options: options.slice(0, 10) } : { question: lines.join('\n'), options: [] };
  }

  /* Сжать фото (Worker принимает до ~1,1 МБ) и отправить на /check-photo.
     Берём только recognized_text: оценка работы здесь не нужна. */
  async function recognize(file, subject) {
    const base = String(Sky.cfg.AI_BASE || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(base)) return { error: t('ttNoWorker') };
    let dataUrl;
    try { dataUrl = await shrink(file); } catch (e) { return { error: t('ttTooBig') }; }
    const res = window.SkyErrors
      ? await SkyErrors.fetch(base + '/check-photo', { method: 'POST', json: { imageBase64: dataUrl, mime: 'image/jpeg', subject: subjName(subject), taskText: '', lang: Sky.lang }, timeout: 90000 })
      : await fetch(base + '/check-photo', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: dataUrl, mime: 'image/jpeg', subject: subjName(subject), taskText: '', lang: Sky.lang }) })
          .then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => null) }), () => ({ ok: false, status: 0, data: null }));
    const d = res.data || {};
    /* Worker отдаёт recognized_text и тогда, когда разбор работы не
       удался (502) — текст нам и нужен. */
    const text = String(d.recognized_text || '').trim();
    if (text) return { text };
    if (res.ok) return { error: t('ttNoText') };
    const why = d.error || (window.SkyErrors ? SkyErrors.message(res) : '') || ('HTTP ' + res.status);
    return { error: t('ttPhotoErr').replace('%1', why) };
  }

  async function shrink(file) {
    const MAX_SIDE = 1600, CAP = 1100 * 1024;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
      let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      for (let a = 0; a < 5; a++) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        for (const q of [0.82, 0.7, 0.58]) {
          const out = c.toDataURL('image/jpeg', q);
          if (out.length * 0.75 <= CAP) return out;
        }
        scale *= 0.75;
      }
      throw new Error('too_big');
    } finally { URL.revokeObjectURL(url); }
  }

  /* ---------- «Добавить в подборку» ---------- */
  async function addToCollection(tt) {
    const colls = (await Sky.db.list('task_collections', { teacher_id: me.id }, { strict: true }).catch(e => {
      if (window.SkyErrors) SkyErrors.show(e, { retry: () => addToCollection(tt) });
      return null;
    }));
    if (!colls) return;
    colls.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const task = toCollectionTask(tt);
    Sky.modal(`<div class="tt-add">
      <h2>${esc(t('ttAddH'))}</h2>
      <p class="tt-add-q">${esc(tt.task_text)}</p>
      ${colls.length ? `<div class="tt-add-list" role="radiogroup">${colls.map((c, i) => {
        const has = (c.tasks || []).some(x => x.source === task.source);
        return `<label class="tt-add-item${has ? ' has' : ''}"><input type="radio" name="ttColl" value="${esc(c.id)}"${i === 0 && !has ? ' checked' : ''}${has ? ' disabled' : ''}>
          <span><b>${esc(c.title)}</b><small>${esc(t('ttTasksN').replace('%1', (c.tasks || []).length))} · ${esc(c.share_code)}${has ? ' · ✓' : ''}</small></span></label>`;
      }).join('')}</div>` : `<p class="help">${esc(t('ttAddNone'))}</p>`}
      <button type="button" class="btn ghost" data-new style="justify-self:start">${esc(t('ttAddNew'))}</button>
      <div class="tt-end"><button type="button" class="btn ghost" data-x>${esc(t('ttCancel'))}</button>
        ${colls.length ? `<button type="button" class="btn" data-go>${esc(t('ttAddDo'))}</button>` : ''}</div>
    </div>`, (box, close) => {
      box.querySelector('[data-x]').addEventListener('click', close);
      box.querySelector('[data-new]').addEventListener('click', () => {
        close();
        if (window.SkyCollectionsPage) SkyCollectionsPage.newCollection([task], tt.subject);
      });
      const go = box.querySelector('[data-go]');
      if (go) go.addEventListener('click', async () => {
        const sel = box.querySelector('input[name=ttColl]:checked');
        const c = sel && colls.find(x => x.id === sel.value);
        if (!c) return;
        const tasks = Array.isArray(c.tasks) ? c.tasks.slice() : [];
        if (tasks.some(x => x.source === task.source)) { Sky.toast(t('ttAlready').replace('%1', c.title)); return; }
        if (tasks.length >= 100) { Sky.toast(t('ttFull')); return; }
        /* id задания в подборке — свой, не совпадающий с уже выданными */
        let id = 'tt-' + String(tt.id).slice(0, 8), k = 2;
        while (tasks.some(x => x.id === id)) id = 'tt-' + String(tt.id).slice(0, 8) + '-' + (k++);
        tasks.push(Object.assign({ id }, task));
        go.disabled = true;
        go.innerHTML = `<span class="spin"></span> ${esc(t('ttAddDo'))}`;
        const saved = await Sky.db.update('task_collections', c.id, { tasks });
        go.disabled = false;
        go.textContent = t('ttAddDo');
        if (!saved) return;
        close();
        Sky.toast(t('ttAdded').replace('%1', c.title));
        document.dispatchEvent(new CustomEvent('collectionschange'));
      });
    });
  }

  /* ---------- события ---------- */
  document.addEventListener('click', e => {
    const v = e.target.closest('#clViews [data-view]');
    if (v) { setView(v.dataset.view); return; }
    const b = e.target.closest('[data-tt]');
    if (!b || !b.closest('#viewTasks')) return;
    const act = b.dataset.tt;
    if (act === 'retry') { loadErr = false; render(); load(); return; }
    if (act === 'new') { openForm(null, false); return; }
    if (act === 'new-photo') { openForm(null, true); return; }
    const cardEl = b.closest('.tt-card');
    const tt = cardEl && items && items.find(x => x.id === cardEl.dataset.id);
    if (!tt) return;
    if (act === 'edit') openForm(tt, false);
    else if (act === 'add') addToCollection(tt);
    else if (act === 'del') {
      if (!confirm(t('ttDelQ'))) return;
      Sky.db.remove('teacher_tasks', tt.id).then(ok => {
        if (!ok) return;
        items = items.filter(x => x.id !== tt.id);
        Sky.toast(t('ttDeleted'));
        render();
        document.dispatchEvent(new CustomEvent('teachertaskschange'));
      });
    }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'ttSubj') { filter.subject = e.target.value; Sky.set('ttSubj', filter.subject); render(); }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'ttQ') { filter.q = e.target.value; render(); }
  });
  document.addEventListener('langchange', render);

  async function boot() {
    await Sky.db.ready;
    const who = Sky.db.me();
    if (!who || !Sky.db.isCloud()) { me = null; items = null; return; }
    if (me && me.id === who.id) return;
    me = who;
    items = null;
    if (location.hash === '#tasks') setView('tasks', false);
    else load();
  }
  document.addEventListener('authchange', boot);
  boot();

  window.SkyTeacherTasks = {
    items: () => items || [],
    ready: () => loading || Promise.resolve(),
    toCollectionTask, parseTask, open: openForm, reload: () => { items = null; return load(); },
    subjName
  };
})();
