/* ============================================================
   SkyySchool — подборки заданий: страница учителя (collections.html)

   Категории (вкладки сверху), подборки (карточки с кодом и ссылкой),
   создание подборки из банка заданий (data/bank-*.js) и своих заданий,
   ответы учеников и проверка открытых ответов.

   Таблицы и функции — sql/schema-collections.sql. Подборки читаются и
   пишутся напрямую (RLS пускает только к своим), ответы учеников —
   через функции: submit_collection пишет, review_collection_submission
   ставит «верно / неверно» открытым заданиям.

   Формат задания в подборке (tasks):
     { id, type: 'choice' | 'text', text, options: [..] (choice),
       answer: номер верного варианта (choice),
       accept: [верные ответы] (text; пусто — ответ проверит учитель),
       source: 'bank:<банк>:<id>' | 'own' }
   ============================================================ */
'use strict';

(function () {
  Sky.init({
    h1:{ru:'Подборки заданий',en:'Task collections'},
    lead:{ru:'Соберите задания из банка или свои — ученики откроют их по ссылке или коду, решат и отправят. Задания с ответом проверятся сами, остальные — вами.',
          en:'Collect tasks from the bank or write your own. Students open them by link or code, solve and send. Tasks with an answer are checked automatically, the rest by you.'},
    needAuth:{ru:'Войдите, чтобы собирать подборки',en:'Sign in to build collections'},
    needAuthD:{ru:'Подборки хранятся в вашем аккаунте: так ссылка работает у учеников на любом устройстве.',
               en:'Collections live in your account, so the link works for students on any device.'},
    needCloud:{ru:'Подборки работают только с облаком: заполните SUPABASE_URL и SUPABASE_ANON_KEY в assets/config.js.',
               en:'Collections need the cloud: fill in SUPABASE_URL and SUPABASE_ANON_KEY in assets/config.js.'},
    signIn:{ru:'Войти',en:'Sign in'},
    newColl:{ru:'Создать подборку',en:'New collection'},
    newCat:{ru:'+ Категория',en:'+ Category'},
    catAll:{ru:'Все',en:'All'},
    catNone:{ru:'Без категории',en:'No category'},
    catH:{ru:'Новая категория',en:'New category'},
    catName:{ru:'Название',en:'Name'},
    catNamePh:{ru:'Например: Дроби, 6 класс',en:'For example: Fractions, year 6'},
    catSubject:{ru:'Предмет',en:'Subject'},
    catCreate:{ru:'Создать',en:'Create'},
    catDel:{ru:'Удалить категорию',en:'Delete category'},
    catDelQ:{ru:'Удалить категорию «%1»? Подборки останутся — без категории.',en:'Delete the “%1” category? Its collections stay, without a category.'},
    catIn:{ru:'Категория: %1',en:'Category: %1'},
    empty:{ru:'Подборок пока нет',en:'No collections yet'},
    emptyD:{ru:'Нажмите «Создать подборку», добавьте задания — и отправьте ученикам ссылку.',en:'Press “New collection”, add tasks and send students the link.'},
    tasksN:{ru:'Заданий: %1',en:'Tasks: %1'},
    codeL:{ru:'Код',en:'Code'},
    until:{ru:'до %1',en:'until %1'},
    forever:{ru:'бессрочно',en:'no end date'},
    active:{ru:'активна',en:'active'},
    expired:{ru:'истекла',en:'expired'},
    pubYes:{ru:'без входа',en:'no sign-in'},
    pubNo:{ru:'только с аккаунтом',en:'accounts only'},
    answersN:{ru:'Ответов: %1',en:'Answers: %1'},
    toCheck:{ru:'ждут проверки: %1',en:'to check: %1'},
    copyLink:{ru:'Скопировать ссылку',en:'Copy link'},
    copied:{ru:'Ссылка скопирована',en:'Link copied'},
    copyFail:{ru:'Не удалось скопировать — выделите ссылку вручную: %1',en:'Could not copy — select the link manually: %1'},
    openIt:{ru:'Открыть',en:'Open'},
    results:{ru:'Результаты',en:'Results'},
    hide:{ru:'Скрыть',en:'Hide'},
    del:{ru:'Удалить',en:'Delete'},
    delQ:{ru:'Удалить подборку «%1»? Ссылка перестанет работать, ответы учеников удалятся.',en:'Delete “%1”? The link stops working and students’ answers are removed.'},
    cancel:{ru:'Отмена',en:'Cancel'},
    done:{ru:'Готово',en:'Done'},
    noAnswers:{ru:'Ответов пока нет. Отправьте ученикам ссылку.',en:'No answers yet. Send students the link.'},
    colStudent:{ru:'Ученик',en:'Student'},
    colDate:{ru:'Дата',en:'Date'},
    colRight:{ru:'Верно',en:'Correct'},
    colPct:{ru:'%',en:'%'},
    colStatus:{ru:'Статус',en:'Status'},
    stPending:{ru:'ждёт проверки',en:'to check'},
    stChecked:{ru:'проверено',en:'checked'},
    checkIt:{ru:'Проверить',en:'Check'},
    viewIt:{ru:'Смотреть',en:'View'},

    nH:{ru:'Новая подборка',en:'New collection'},
    nTitle:{ru:'Название',en:'Title'},
    nTitlePh:{ru:'Например: Дроби — разминка',en:'For example: Fractions warm-up'},
    nDesc:{ru:'Описание (что сделать, к какому сроку)',en:'Description (what to do, by when)'},
    nSubject:{ru:'Предмет',en:'Subject'},
    nCategory:{ru:'Категория',en:'Category'},
    nDays:{ru:'Ссылка работает',en:'The link works for'},
    nDaysN:{ru:'%1 дн.',en:'%1 days'},
    nForever:{ru:'бессрочно',en:'no end date'},
    nPublic:{ru:'Открывается без входа — достаточно ссылки',en:'Opens without signing in — the link is enough'},
    nTasks:{ru:'Задания',en:'Tasks'},
    nPickedEmpty:{ru:'Пока пусто — добавьте задания из банка или свои.',en:'Empty — add tasks from the bank or your own.'},
    nFromBank:{ru:'Из банка',en:'From the bank'},
    nOwn:{ru:'Своё задание',en:'Your own task'},
    nBank:{ru:'Банк',en:'Bank'},
    nSearch:{ru:'Поиск по тексту или теме',en:'Search text or topic'},
    nLoading:{ru:'Загружаю банк…',en:'Loading the bank…'},
    nShown:{ru:'Показано %1 из %2 — уточните поиск',en:'Showing %1 of %2 — narrow the search'},
    nNoMatch:{ru:'Ничего не нашлось',en:'Nothing found'},
    nText:{ru:'Текст задания',en:'Task text'},
    nKindChoice:{ru:'С вариантами',en:'Multiple choice'},
    nKindText:{ru:'Ответ текстом',en:'Text answer'},
    nOption:{ru:'Вариант %1',en:'Option %1'},
    nRightOpt:{ru:'Отметьте верный вариант',en:'Mark the correct option'},
    nAddOpt:{ru:'+ вариант',en:'+ option'},
    nAccept:{ru:'Правильный ответ (необязательно; несколько — через «;»)',en:'Correct answer (optional; several — separated by “;”)'},
    nAcceptHelp:{ru:'Пусто — ответ проверите вы. Регистр, ё/е, пробелы и запятая/точка в числе не важны.',
                 en:'Empty — you will check the answer. Case, spaces and comma/dot in numbers do not matter.'},
    nAddOwn:{ru:'Добавить задание',en:'Add task'},
    nNeedText:{ru:'Впишите текст задания',en:'Enter the task text'},
    nNeedOpts:{ru:'Нужно хотя бы два варианта',en:'At least two options are needed'},
    nNeedRight:{ru:'Отметьте верный вариант',en:'Mark the correct option'},
    nNeedTitle:{ru:'Впишите название',en:'Enter a title'},
    nNeedTasks:{ru:'Добавьте хотя бы одно задание',en:'Add at least one task'},
    nMax:{ru:'Не больше 100 заданий',en:'At most 100 tasks'},
    nCreate:{ru:'Создать',en:'Create'},
    nCreated:{ru:'Подборка создана. Код %1 — ссылка скопирована',en:'Collection created. Code %1 — link copied'},
    nOpenAnswer:{ru:'проверит учитель',en:'checked by teacher'},
    rm:{ru:'Убрать',en:'Remove'},

    rH:{ru:'Ответы: %1',en:'Answers: %1'},
    rAnswer:{ru:'Ответ ученика',en:'Student’s answer'},
    rNoAnswer:{ru:'нет ответа',en:'no answer'},
    rRight:{ru:'Верно',en:'Right'},
    rWrong:{ru:'Неверно',en:'Wrong'},
    rAuto:{ru:'автопроверка',en:'auto-checked'},
    rCorrectIs:{ru:'Верный ответ: %1',en:'Correct answer: %1'},
    rComment:{ru:'Комментарий ученику',en:'Comment for the student'},
    rSave:{ru:'Сохранить',en:'Save'},
    rSaved:{ru:'Проверено: %1 из %2',en:'Checked: %1 of %2'},
    other:{ru:'Другое',en:'Other'}
  });

  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const L = v => v == null ? '' : typeof v === 'string' ? v : Sky.L(v);
  const C = window.SkyCollections;
  const loc = () => Sky.lang === 'en' ? 'en-GB' : 'ru-RU';
  const day = v => v ? new Date(v).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  const when = v => v ? new Date(v).toLocaleString(loc(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

  /* Банки заданий (data/bank-<id>.js), грузятся по требованию. */
  const BANKS = [
    ['math',        { ru: 'Математика',     en: 'Mathematics' }],
    ['informatics', { ru: 'Информатика',    en: 'Computer science' }],
    ['russian',     { ru: 'Русский язык',   en: 'Russian' }],
    ['physics',     { ru: 'Физика',         en: 'Physics' }],
    ['chemistry',   { ru: 'Химия',          en: 'Chemistry' }],
    ['biology',     { ru: 'Биология',       en: 'Biology' }],
    ['geography',   { ru: 'География',      en: 'Geography' }],
    ['history',     { ru: 'История',        en: 'History' }],
    ['social',      { ru: 'Обществознание', en: 'Social studies' }],
    ['english',     { ru: 'Английский',     en: 'English' }],
    ['german',      { ru: 'Немецкий',       en: 'German' }],
    ['spanish',     { ru: 'Испанский',      en: 'Spanish' }],
    ['polish',      { ru: 'Польский',       en: 'Polish' }]
  ];
  const subjName = k => { const b = BANKS.find(x => x[0] === k); return b ? Sky.L(b[1]) : (k ? (k === 'other' ? Sky.t('other') : k) : ''); };
  const bankLoads = {};
  function loadBank(id) {
    if (window.BANKS && window.BANKS[id]) return Promise.resolve(window.BANKS[id]);
    if (!bankLoads[id]) {
      bankLoads[id] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'data/bank-' + id + '.js';
        s.onload = () => (window.BANKS && window.BANKS[id]) ? resolve(window.BANKS[id]) : reject(new Error('bank'));
        s.onerror = () => { delete bankLoads[id]; reject(new Error('bank')); };
        document.head.appendChild(s);
      });
    }
    return bankLoads[id];
  }
  /* В подборку идут только задания с вариантами и номером верного. */
  const usable = t => t && Array.isArray(t.options) && t.options.length >= 2 && Number.isInteger(t.answer);

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  const S = { cats: [], colls: [], subs: [], cat: Sky.get('clCat', 'all'), open: null };

  /* ---------- загрузка ---------- */
  async function load() {
    await Sky.db.ready;
    const me = Sky.db.me();
    const gate = $('#gate');
    $('#app').classList.add('hidden');
    if (!Sky.db.isCloud()) {
      gate.innerHTML = `<p class="note">${esc(Sky.t('needCloud'))}</p>`;
      return;
    }
    if (!me) {
      gate.innerHTML = `<div class="panel"><div class="empty"><div class="big">🔐</div>
        <b>${esc(Sky.t('needAuth'))}</b><p>${esc(Sky.t('needAuthD'))}</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><button class="btn" id="gIn">${esc(Sky.t('signIn'))}</button></div></div></div>`;
      $('#gIn').addEventListener('click', () => Sky.auth.openAuth());
      return;
    }
    gate.innerHTML = '';
    $('#app').classList.remove('hidden');
    const [cats, colls, subs] = await Promise.all([
      Sky.db.list('task_categories', { teacher_id: me.id }),
      Sky.db.list('task_collections', { teacher_id: me.id }),
      Sky.db.list('collection_submissions')
    ]);
    const newest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
    S.cats = (cats || []).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    S.colls = (colls || []).sort(newest);
    const mine = new Set(S.colls.map(c => c.id));
    S.subs = (subs || []).filter(s => mine.has(s.collection_id)).sort(newest);
    if (S.cat !== 'all' && S.cat !== 'none' && !S.cats.some(c => c.id === S.cat)) S.cat = 'all';
    render();
  }

  /* ---------- вкладки категорий и список ---------- */
  function render() {
    const count = id => S.colls.filter(c => id === 'all' ? true : id === 'none' ? !c.category_id : c.category_id === id).length;
    const tab = (id, label) => `<button type="button" class="cl-tab" data-cat="${esc(id)}" aria-pressed="${S.cat === id}">${esc(label)}<span class="n">${count(id)}</span></button>`;
    $('#catTabs').innerHTML = tab('all', Sky.t('catAll')) +
      S.cats.map(c => tab(c.id, c.name)).join('') +
      (S.colls.some(c => !c.category_id) && S.cats.length ? tab('none', Sky.t('catNone')) : '') +
      `<button type="button" class="cl-tab add" id="catAdd">${esc(Sky.t('newCat'))}</button>`;

    const cat = S.cats.find(c => c.id === S.cat);
    const line = $('#catLine');
    line.classList.toggle('hidden', !cat);
    if (cat) {
      line.innerHTML = `<span>${esc(Sky.t('catIn').replace('%1', cat.name))}${cat.subject ? ' · ' + esc(subjName(cat.subject)) : ''}</span>` +
        `<button type="button" id="catDel">${esc(Sky.t('catDel'))}</button>`;
    }

    const list = S.colls.filter(c => S.cat === 'all' ? true : S.cat === 'none' ? !c.category_id : c.category_id === S.cat);
    $('#colls').innerHTML = list.length ? list.map(card).join('') :
      `<div class="panel"><div class="empty"><div class="big">🗂️</div><b>${esc(Sky.t('empty'))}</b><p>${esc(Sky.t('emptyD'))}</p></div></div>`;
    if (S.open) renderResults(S.open);
  }

  const isExpired = c => c.expires_at && new Date(c.expires_at) <= new Date();

  function card(c) {
    const subs = S.subs.filter(s => s.collection_id === c.id);
    const pending = subs.filter(s => s.status === 'pending').length;
    const exp = isExpired(c);
    const n = Array.isArray(c.tasks) ? c.tasks.length : 0;
    return `<div class="cl-card${S.open === c.id ? ' open' : ''}" data-id="${esc(c.id)}">
      <div class="cl-head">
        <h3>${esc(c.title)}</h3>
        <span class="tag ${exp ? 'no' : 'ok'}">${esc(Sky.t(exp ? 'expired' : 'active'))}</span>
      </div>
      <div class="cl-meta">
        <span>${esc(Sky.t('tasksN').replace('%1', n))}</span>
        <span>${esc(Sky.t('codeL'))}: <span class="cl-code">${esc(c.share_code)}</span></span>
        <span>${esc(c.expires_at ? Sky.t('until').replace('%1', day(c.expires_at)) : Sky.t('forever'))}</span>
        <span>${esc(Sky.t(c.is_public ? 'pubYes' : 'pubNo'))}</span>
        ${c.subject ? `<span>${esc(subjName(c.subject))}</span>` : ''}
        <span>${esc(Sky.t('answersN').replace('%1', subs.length))}${pending ? ' · <b style="color:var(--warn)">' + esc(Sky.t('toCheck').replace('%1', pending)) + '</b>' : ''}</span>
      </div>
      ${c.description ? `<div style="font-size:13px;line-height:1.55;white-space:pre-wrap">${esc(c.description)}</div>` : ''}
      <div class="cl-acts">
        <button type="button" class="btn small" data-act="copy">${esc(Sky.t('copyLink'))}</button>
        <a class="btn ghost small" href="${esc(C.url(c.share_code))}" target="_blank" rel="noopener">${esc(Sky.t('openIt'))}</a>
        <button type="button" class="btn ghost small" data-act="results" aria-expanded="${S.open === c.id}">${esc(Sky.t(S.open === c.id ? 'hide' : 'results'))}</button>
        <button type="button" class="btn ghost small" data-act="del" style="color:var(--no)">${esc(Sky.t('del'))}</button>
      </div>
      <div class="cl-results ${S.open === c.id ? '' : 'hidden'}" id="res-${esc(c.id)}"></div>
    </div>`;
  }

  /* ---------- результаты ---------- */
  function renderResults(id) {
    const box = document.getElementById('res-' + id);
    const c = S.colls.find(x => x.id === id);
    if (!box || !c) return;
    const subs = S.subs.filter(s => s.collection_id === id);
    const total = Array.isArray(c.tasks) ? c.tasks.length : 0;
    box.innerHTML = !subs.length ? `<p style="margin:0;font-size:13px;color:var(--muted);font-weight:600">${esc(Sky.t('noAnswers'))}</p>` :
      `<div class="table-wrap"><table class="ctable"><thead><tr><th>${esc(Sky.t('colStudent'))}</th><th>${esc(Sky.t('colDate'))}</th>
        <th class="num">${esc(Sky.t('colRight'))}</th><th class="num">${esc(Sky.t('colPct'))}</th><th>${esc(Sky.t('colStatus'))}</th><th></th></tr></thead>
        <tbody>${subs.map(s => `<tr>
          <td><b>${esc(s.student_name || '—')}</b></td>
          <td>${esc(when(s.created_at))}</td>
          <td class="num">${Number(s.score) || 0} / ${total}</td>
          <td class="num">${Math.round(Number(s.percent) || 0)}%</td>
          <td><span class="tag ${s.status === 'pending' ? 'warn' : 'ok'}">${esc(Sky.t(s.status === 'pending' ? 'stPending' : 'stChecked'))}</span></td>
          <td><button type="button" class="btn small ${s.status === 'pending' ? '' : 'ghost'}" data-review="${esc(s.id)}">${esc(Sky.t(s.status === 'pending' ? 'checkIt' : 'viewIt'))}</button></td>
        </tr>`).join('')}</tbody></table></div>`;
  }

  /* ---------- проверка ответов ученика ---------- */
  function review(subId) {
    const s = S.subs.find(x => x.id === subId);
    const c = s && S.colls.find(x => x.id === s.collection_id);
    if (!s || !c) return;
    const answers = Array.isArray(s.answers) ? s.answers : [];
    const marks = {};
    const byTask = id => answers.find(a => a.task_id === id) || { answer: '', correct: null };
    const answerText = (t, a) => {
      if (t.type === 'choice') {
        const i = /^\d+$/.test(String(a.answer)) ? Number(a.answer) : -1;
        return t.options && t.options[i] != null ? t.options[i] : '';
      }
      return String(a.answer || '');
    };
    const rightText = t => t.type === 'choice' ? (t.options || [])[t.answer] : (Array.isArray(t.accept) ? t.accept.join(' / ') : '');

    Sky.modal(`<div class="cl-review">
      <h2>${esc(Sky.t('rH').replace('%1', s.student_name || '—'))}</h2>
      <div class="cl-rv">${c.tasks.map((t, i) => {
        const a = byTask(t.id);
        const ans = answerText(t, a);
        const auto = t.type === 'choice' || (Array.isArray(t.accept) && t.accept.length);
        const right = rightText(t);
        return `<div class="cl-rv-item" data-task="${esc(t.id)}">
          <div class="q">${i + 1}. ${esc(t.text)}</div>
          <div class="a${ans ? '' : ' empty'}">${esc(ans || Sky.t('rNoAnswer'))}</div>
          ${right ? `<div style="font-size:12.5px;color:var(--muted);font-weight:700">${esc(Sky.t('rCorrectIs').replace('%1', right))}</div>` : ''}
          <div class="cl-rv-marks">
            <button type="button" class="btn small ghost yes" data-mark="true" aria-pressed="${a.correct === true}">✓ ${esc(Sky.t('rRight'))}</button>
            <button type="button" class="btn small ghost no" data-mark="false" aria-pressed="${a.correct === false}">✗ ${esc(Sky.t('rWrong'))}</button>
            ${auto ? `<span style="font-size:11.5px;color:var(--muted);font-weight:700">${esc(Sky.t('rAuto'))}</span>` : ''}
          </div>
        </div>`;
      }).join('')}</div>
      <div class="field"><label for="rvComment">${esc(Sky.t('rComment'))}</label><textarea id="rvComment" rows="3" maxlength="2000">${esc(s.teacher_comment || '')}</textarea></div>
      <div class="cl-acts-end"><button type="button" class="btn ghost" data-x>${esc(Sky.t('cancel'))}</button><button type="button" class="btn" data-save>${esc(Sky.t('rSave'))}</button></div>
    </div>`, (box, close) => {
      box.querySelector('[data-x]').addEventListener('click', close);
      box.querySelectorAll('.cl-rv-item').forEach(item => item.addEventListener('click', e => {
        const b = e.target.closest('[data-mark]');
        if (!b) return;
        const v = b.dataset.mark === 'true';
        marks[item.dataset.task] = v;
        item.querySelectorAll('[data-mark]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.mark === String(v))));
      }));
      box.querySelector('[data-save]').addEventListener('click', async e => {
        e.currentTarget.disabled = true;
        let row;
        try {
          row = await Sky.db.rpc('review_collection_submission', { p_id: s.id, p_marks: marks, p_comment: box.querySelector('#rvComment').value });
        } catch (err) {
          Sky.toast(err && err.message || String(err), 6000);
          e.currentTarget.disabled = false;
          return;
        }
        Object.assign(s, row || {});
        close();
        Sky.toast(Sky.t('rSaved').replace('%1', s.score).replace('%2', c.tasks.length));
        render();
      });
    });
  }

  /* ---------- категория ---------- */
  function newCategory() {
    Sky.modal(`<div class="cl-new">
      <h2>${esc(Sky.t('catH'))}</h2>
      <div class="field"><label for="catName">${esc(Sky.t('catName'))}</label><input type="text" id="catName" maxlength="80" placeholder="${esc(Sky.t('catNamePh'))}"></div>
      <div class="field"><label for="catSubj">${esc(Sky.t('catSubject'))}</label><select id="catSubj">${subjectOptions('')}</select></div>
      <div class="cl-acts-end"><button type="button" class="btn ghost" data-x>${esc(Sky.t('cancel'))}</button><button type="button" class="btn" data-go>${esc(Sky.t('catCreate'))}</button></div>
    </div>`, (box, close) => {
      box.querySelector('[data-x]').addEventListener('click', close);
      box.querySelector('#catName').focus();
      box.querySelector('[data-go]').addEventListener('click', async e => {
        const name = box.querySelector('#catName').value.trim();
        if (!name) { Sky.toast(Sky.t('nNeedTitle')); return; }
        e.currentTarget.disabled = true;
        const row = await Sky.db.insert('task_categories', { id: uuid(), name, subject: box.querySelector('#catSubj').value || null });
        if (!row) { e.currentTarget.disabled = false; return; }
        close();
        S.cat = row.id;
        Sky.set('clCat', S.cat);
        await reload();
      });
    });
  }

  const subjectOptions = sel => `<option value="">—</option>` +
    BANKS.map(([id, n]) => `<option value="${id}"${id === sel ? ' selected' : ''}>${esc(Sky.L(n))}</option>`).join('') +
    `<option value="other"${sel === 'other' ? ' selected' : ''}>${esc(Sky.t('other'))}</option>`;

  /* ---------- новая подборка ---------- */
  function newCollection() {
    const picked = [];                                   // задания подборки по порядку
    const cat = S.cats.find(c => c.id === S.cat);
    const defSubject = (cat && cat.subject) || '';
    let kind = 'choice';

    Sky.modal(`<div class="cl-new">
      <h2>${esc(Sky.t('nH'))}</h2>
      <div class="field"><label for="nTitle">${esc(Sky.t('nTitle'))}</label><input type="text" id="nTitle" maxlength="200" placeholder="${esc(Sky.t('nTitlePh'))}"></div>
      <div class="field"><label for="nDesc">${esc(Sky.t('nDesc'))}</label><textarea id="nDesc" rows="2" maxlength="2000"></textarea></div>
      <div class="cl-pair">
        <div class="field"><label for="nSubj">${esc(Sky.t('nSubject'))}</label><select id="nSubj">${subjectOptions(defSubject)}</select></div>
        <div class="field"><label for="nCat">${esc(Sky.t('nCategory'))}</label><select id="nCat"><option value="">${esc(Sky.t('catNone'))}</option>${S.cats.map(c => `<option value="${esc(c.id)}"${cat && cat.id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      </div>
      <div class="cl-pair">
        <div class="field"><label for="nDays">${esc(Sky.t('nDays'))}</label><select id="nDays">${[1, 3, 7, 14, 30, 90].map(d => `<option value="${d}"${d === 7 ? ' selected' : ''}>${esc(Sky.t('nDaysN').replace('%1', d))}</option>`).join('')}<option value="">${esc(Sky.t('nForever'))}</option></select></div>
        <label class="cl-check" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="nPublic" checked>${esc(Sky.t('nPublic'))}</label>
      </div>

      <div class="cl-sec">
        <h3>${esc(Sky.t('nTasks'))} <span class="tag gray" id="nCount">0</span></h3>
        <div class="cl-picked" id="nPicked" data-empty="${esc(Sky.t('nPickedEmpty'))}"></div>
      </div>

      <div class="seg seg-lg" id="nSrc" role="tablist" style="width:max-content">
        <button type="button" data-src="bank" aria-pressed="true">${esc(Sky.t('nFromBank'))}</button>
        <button type="button" data-src="own" aria-pressed="false">${esc(Sky.t('nOwn'))}</button>
      </div>

      <div class="cl-sec" id="srcBank">
        <div class="cl-pair">
          <div class="field"><label for="bSubj">${esc(Sky.t('nBank'))}</label><select id="bSubj">${BANKS.map(([id, n]) => `<option value="${id}">${esc(Sky.L(n))}</option>`).join('')}</select></div>
          <div class="field"><label for="bSearch">${esc(Sky.t('nSearch'))}</label><input type="search" id="bSearch" autocomplete="off"></div>
        </div>
        <div class="cl-bank" id="bList"></div>
      </div>

      <div class="cl-sec hidden" id="srcOwn">
        <div class="field"><label for="oText">${esc(Sky.t('nText'))}</label><textarea id="oText" rows="3" maxlength="2000"></textarea></div>
        <div class="seg" id="oKind" style="width:max-content">
          <button type="button" data-kind="choice" aria-pressed="true">${esc(Sky.t('nKindChoice'))}</button>
          <button type="button" data-kind="text" aria-pressed="false">${esc(Sky.t('nKindText'))}</button>
        </div>
        <div id="oChoice" class="cl-opts">
          <span style="font-size:12px;color:var(--muted);font-weight:700">${esc(Sky.t('nRightOpt'))}</span>
          <div id="oOpts" class="cl-opts"></div>
          <button type="button" class="btn ghost small" id="oAddOpt" style="justify-self:start">${esc(Sky.t('nAddOpt'))}</button>
        </div>
        <div id="oTextKind" class="field hidden"><label for="oAccept">${esc(Sky.t('nAccept'))}</label><input type="text" id="oAccept" maxlength="500"><span class="help">${esc(Sky.t('nAcceptHelp'))}</span></div>
        <button type="button" class="btn small" id="oAdd" style="justify-self:start">${esc(Sky.t('nAddOwn'))}</button>
      </div>

      <div class="cl-acts-end"><button type="button" class="btn ghost" data-x>${esc(Sky.t('cancel'))}</button><button type="button" class="btn" data-go>${esc(Sky.t('nCreate'))}</button></div>
    </div>`, (box, close) => {
      const q = s => box.querySelector(s);
      q('[data-x]').addEventListener('click', close);
      q('#nTitle').focus();
      if (defSubject && BANKS.some(b => b[0] === defSubject)) q('#bSubj').value = defSubject;

      function renderPicked() {
        q('#nCount').textContent = picked.length;
        q('#nPicked').innerHTML = picked.map((t, i) => `<div class="cl-pk">
          <b>${i + 1}.</b><span class="t">${esc(t.text)}</span>
          <span class="k">${t.type === 'choice' ? esc((t.options || [])[t.answer] || '') : esc(Array.isArray(t.accept) && t.accept.length ? t.accept.join(' / ') : Sky.t('nOpenAnswer'))}</span>
          <button type="button" data-rm="${i}" aria-label="${esc(Sky.t('rm'))}">×</button></div>`).join('');
        renderBank();
      }
      q('#nPicked').addEventListener('click', e => {
        const b = e.target.closest('[data-rm]');
        if (b) { picked.splice(Number(b.dataset.rm), 1); renderPicked(); }
      });

      /* банк */
      let bank = null, bankId = null;
      async function openBank() {
        bankId = q('#bSubj').value;
        bank = null;
        q('#bList').innerHTML = `<span class="spin"></span> <span style="font-size:13px;color:var(--muted)">${esc(Sky.t('nLoading'))}</span>`;
        try { bank = await loadBank(bankId); } catch (e) { bank = { tasks: [] }; }
        if (q('#bSubj').value === bankId) renderBank();
      }
      function renderBank() {
        if (!bank) return;
        const needle = q('#bSearch').value.trim().toLowerCase();
        const all = (bank.tasks || []).filter(usable).filter(t => !needle ||
          (L(t.text) + ' ' + L(t.topic)).toLowerCase().includes(needle));
        const shown = all.slice(0, 60);
        const has = new Set(picked.map(t => t.source));
        q('#bList').innerHTML = !all.length ? `<span style="font-size:13px;color:var(--muted);font-weight:600">${esc(Sky.t('nNoMatch'))}</span>` :
          shown.map(t => {
            const src = 'bank:' + bankId + ':' + t.id;
            return `<button type="button" class="cl-bt${has.has(src) ? ' on' : ''}" data-bank="${esc(t.id)}">
              <span class="box">${has.has(src) ? '✓' : ''}</span>
              <span class="t">${esc(L(t.text))}<small>${esc(L(t.topic))}${t.exam ? ' · ' + esc(String(t.exam).toUpperCase()) : ''}</small></span></button>`;
          }).join('') + (all.length > shown.length ? `<span style="font-size:12px;color:var(--muted);font-weight:700">${esc(Sky.t('nShown').replace('%1', shown.length).replace('%2', all.length))}</span>` : '');
      }
      q('#bSubj').addEventListener('change', () => { q('#bSearch').value = ''; openBank(); });
      q('#bSearch').addEventListener('input', renderBank);
      q('#bList').addEventListener('click', e => {
        const b = e.target.closest('[data-bank]');
        if (!b || !bank) return;
        const t = bank.tasks.find(x => x.id === b.dataset.bank);
        const src = 'bank:' + bankId + ':' + t.id;
        const i = picked.findIndex(x => x.source === src);
        if (i >= 0) picked.splice(i, 1);
        else {
          if (picked.length >= 100) { Sky.toast(Sky.t('nMax')); return; }
          picked.push({ type: 'choice', text: L(t.text), options: t.options.map(L), answer: t.answer, source: src });
        }
        renderPicked();
      });

      /* своё задание */
      function optRow(i, val) {
        return `<div class="cl-opt"><input type="radio" name="oRight" value="${i}" aria-label="${esc(Sky.t('nRightOpt'))}">
          <input type="text" maxlength="300" placeholder="${esc(Sky.t('nOption').replace('%1', i + 1))}" value="${esc(val || '')}"></div>`;
      }
      q('#oOpts').innerHTML = [0, 1, 2, 3].map(i => optRow(i)).join('');
      q('#oAddOpt').addEventListener('click', () => {
        const n = q('#oOpts').children.length;
        if (n >= 8) return;
        q('#oOpts').insertAdjacentHTML('beforeend', optRow(n));
      });
      q('#oKind').addEventListener('click', e => {
        const b = e.target.closest('[data-kind]');
        if (!b) return;
        kind = b.dataset.kind;
        q('#oKind').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        q('#oChoice').classList.toggle('hidden', kind !== 'choice');
        q('#oTextKind').classList.toggle('hidden', kind !== 'text');
      });
      q('#oAdd').addEventListener('click', () => {
        const text = q('#oText').value.trim();
        if (!text) { Sky.toast(Sky.t('nNeedText')); q('#oText').focus(); return; }
        if (picked.length >= 100) { Sky.toast(Sky.t('nMax')); return; }
        if (kind === 'choice') {
          const rows = [...q('#oOpts').children].map(r => ({ v: r.querySelector('input[type=text]').value.trim(), on: r.querySelector('input[type=radio]').checked }));
          const opts = rows.filter(r => r.v);
          if (opts.length < 2) { Sky.toast(Sky.t('nNeedOpts')); return; }
          const right = opts.findIndex(r => r.on);
          if (right < 0) { Sky.toast(Sky.t('nNeedRight')); return; }
          picked.push({ type: 'choice', text, options: opts.map(r => r.v), answer: right, source: 'own' });
          q('#oOpts').innerHTML = [0, 1, 2, 3].map(i => optRow(i)).join('');
        } else {
          const accept = q('#oAccept').value.split(';').map(s => s.trim()).filter(Boolean).slice(0, 20);
          picked.push(Object.assign({ type: 'text', text, source: 'own' }, accept.length ? { accept } : {}));
          q('#oAccept').value = '';
        }
        q('#oText').value = '';
        renderPicked();
      });

      q('#nSrc').addEventListener('click', e => {
        const b = e.target.closest('[data-src]');
        if (!b) return;
        q('#nSrc').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        q('#srcBank').classList.toggle('hidden', b.dataset.src !== 'bank');
        q('#srcOwn').classList.toggle('hidden', b.dataset.src !== 'own');
      });

      q('[data-go]').addEventListener('click', async e => {
        const title = q('#nTitle').value.trim();
        if (!title) { Sky.toast(Sky.t('nNeedTitle')); q('#nTitle').focus(); return; }
        if (!picked.length) { Sky.toast(Sky.t('nNeedTasks')); return; }
        const days = q('#nDays').value;
        const row = {
          id: uuid(),
          title,
          description: q('#nDesc').value.trim() || null,
          subject: q('#nSubj').value || null,
          category_id: q('#nCat').value || null,
          is_public: q('#nPublic').checked,
          expires_at: days ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null,
          tasks: picked.map((t, i) => Object.assign({ id: 't' + (i + 1) }, t))
        };
        e.currentTarget.disabled = true;
        const saved = await Sky.db.insert('task_collections', row);
        if (!saved) { e.currentTarget.disabled = false; return; }
        close();
        const ok = await C.copy(C.url(saved.share_code));
        Sky.toast(ok ? Sky.t('nCreated').replace('%1', saved.share_code) : Sky.t('copyFail').replace('%1', C.url(saved.share_code)), 6000);
        await reload();
      });

      renderPicked();
      openBank();
    });
  }

  /* ---------- события ---------- */
  $('#catTabs').addEventListener('click', e => {
    if (e.target.closest('#catAdd')) { newCategory(); return; }
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    S.cat = b.dataset.cat;
    Sky.set('clCat', S.cat);
    render();
  });
  $('#catLine').addEventListener('click', async e => {
    if (!e.target.closest('#catDel')) return;
    const cat = S.cats.find(c => c.id === S.cat);
    if (!cat || !confirm(Sky.t('catDelQ').replace('%1', cat.name))) return;
    if (await Sky.db.remove('task_categories', cat.id)) { S.cat = 'all'; Sky.set('clCat', S.cat); await reload(); }
  });
  $('#newBtn').addEventListener('click', newCollection);
  $('#colls').addEventListener('click', async e => {
    const rv = e.target.closest('[data-review]');
    if (rv) { review(rv.dataset.review); return; }
    const b = e.target.closest('[data-act]');
    const cardEl = e.target.closest('.cl-card');
    if (!b || !cardEl) return;
    const c = S.colls.find(x => x.id === cardEl.dataset.id);
    if (!c) return;
    if (b.dataset.act === 'copy') {
      const ok = await C.copy(C.url(c.share_code));
      Sky.toast(ok ? Sky.t('copied') : Sky.t('copyFail').replace('%1', C.url(c.share_code)), ok ? 3000 : 8000);
    } else if (b.dataset.act === 'results') {
      S.open = S.open === c.id ? null : c.id;
      render();
    } else if (b.dataset.act === 'del') {
      if (!confirm(Sky.t('delQ').replace('%1', c.title))) return;
      if (await Sky.db.remove('task_collections', c.id)) { if (S.open === c.id) S.open = null; await reload(); }
    }
  });
  C.bindCodeForm($('#codeForm'), $('#codeIn'));
  /* db.js сам шлёт authchange после старта; одновременные загрузки склеиваются. */
  let loading = null;
  const reload = () => loading || (loading = load().finally(() => { loading = null; }));
  document.addEventListener('authchange', reload);
  document.addEventListener('langchange', () => { if (!$('#app').classList.contains('hidden')) render(); });
  reload();
})();
