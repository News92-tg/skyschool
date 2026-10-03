/* ============================================================
   SkyySchool — разбор работ учеников (teacher-review.html)

   Учитель видит, как ученики решали его подборки:
     1. подборки — task_collections (RLS отдаёт только свои);
     2. подборка → ученики: ФИО, класс, дата, верно, %, оценка;
        «Экспорт CSV»: ФИО, класс, верно, всего, процент, оценка;
     3. ученик → разбор: № | задание | ответ ученика | правильный | ✓/✗,
        у ошибки — «Объяснить» (Worker /explain через Sky.explain).
   Адрес отражает место: ?c=<подборка>&s=<работа> — ссылку можно
   открыть в новой вкладке, «назад» в браузере работает.

   Ответ ученика и «верно» — из task_details отправки: их собирает база
   в submit_collection из своей же проверки. Правильный ответ — из tasks
   подборки: его видит только учитель, в отправку он нарочно не попадает
   (её может прочитать и сам ученик). У отправок без task_details разбор
   собирается здесь же из answers.
   ============================================================ */
'use strict';

(function () {
  Sky.extendDict({
    trH1:{ru:'Разбор работ',en:'Student work'},
    trLead:{ru:'Как ученики решали ваши подборки: ответ по каждому заданию и объяснение ошибок.',en:'How students solved your task sets: every answer, task by task, with mistakes explained.'},
    trTasks:{ru:'Заданий: %1',en:'Tasks: %1'},
    trCode:{ru:'Код',en:'Code'},
    trWorksN:{ru:'работ',en:'works'},
    trAvg:{ru:'в среднем %1%',en:'%1% on average'},
    trPendingN:{ru:'ждут проверки: %1',en:'awaiting review: %1'},
    trLast:{ru:'последняя %1',en:'last %1'},
    trNoWorks:{ru:'ответов пока нет',en:'no answers yet'},
    trNoColls:{ru:'Подборок пока нет',en:'No task sets yet'},
    trNoCollsD:{ru:'Соберите подборку и отправьте ученикам ссылку — их ответы появятся здесь.',en:'Build a task set and send students the link — their answers will appear here.'},
    trCreate:{ru:'Создать подборку',en:'Create a task set'},
    trAll:{ru:'Все подборки',en:'All task sets'},
    trNoSubs:{ru:'Ответов пока нет',en:'No answers yet'},
    trNoSubsD:{ru:'Отправьте ученикам ссылку на подборку — как только кто-то решит, он появится в этом списке.',en:'Send students the link — as soon as someone solves it, they appear in this list.'},
    trCopy:{ru:'Скопировать ссылку',en:'Copy link'},
    trCopied:{ru:'Ссылка скопирована',en:'Link copied'},
    trCsv:{ru:'Экспорт CSV',en:'Export CSV'},
    trSortDate:{ru:'Новые',en:'Newest'},
    trSortName:{ru:'По имени',en:'By name'},
    trSortScore:{ru:'По результату',en:'By score'},
    trSortL:{ru:'Порядок',en:'Order'},
    trWorks:{ru:'Работ',en:'Works'},
    trAvgPct:{ru:'Средний результат',en:'Average'},
    trMarks:{ru:'Оценки',en:'Marks'},
    trColName:{ru:'Ученик',en:'Student'},
    trColClass:{ru:'Класс',en:'Class'},
    trColDate:{ru:'Дата',en:'Date'},
    trColRight:{ru:'Верно',en:'Correct'},
    trColPct:{ru:'%',en:'%'},
    trColGrade:{ru:'Оценка',en:'Mark'},
    trPending:{ru:'ждёт проверки',en:'awaiting review'},
    trSummary:{ru:'Верно %1 из %2 (%3%), оценка %4',en:'Correct %1 of %2 (%3%), mark %4'},
    trSubmitted:{ru:'Сдано %1',en:'Submitted %1'},
    trOpenLeft:{ru:'Ещё %1 — ответы без правильного варианта, их оцениваете вы. Оценка пока предварительная.',en:'%1 more are open answers you mark yourself. The mark is preliminary.'},
    trCheckNow:{ru:'Проверить',en:'Review'},
    trComment:{ru:'Ваш комментарий',en:'Your comment'},
    trColN:{ru:'№',en:'#'},
    trColTask:{ru:'Задание',en:'Task'},
    trColAnswer:{ru:'Ответ ученика',en:'Student answer'},
    trColCorrect:{ru:'Правильный',en:'Correct answer'},
    trNoAnswer:{ru:'нет ответа',en:'no answer'},
    trByTeacher:{ru:'оцениваете вы',en:'marked by you'},
    trMarkOk:{ru:'верно',en:'correct'},
    trMarkNo:{ru:'неверно',en:'wrong'},
    trMarkWait:{ru:'ждёт вашей проверки',en:'awaiting your review'},
    trExplain:{ru:'Объяснить',en:'Explain'},
    trExH:{ru:'Задание %1',en:'Task %1'},
    trExWait:{ru:'Готовлю объяснение…',en:'Preparing an explanation…'},
    trExRetry:{ru:'Повторить',en:'Try again'},
    trExMine:{ru:'Ваше объяснение',en:'Your explanation'},
    trExAskAi:{ru:'Объяснение от ИИ',en:'Explanation from AI'},
    trExSrc:{ru:'Объяснение написал ИИ — проверьте его, прежде чем отправлять ученику.',en:'Written by AI — check it before passing it on to the student.'},
    trClose:{ru:'Закрыть',en:'Close'},
    trPrev:{ru:'← Предыдущий ученик',en:'← Previous student'},
    trNext:{ru:'Следующий ученик →',en:'Next student →'},
    trNotFound:{ru:'Не нашлось',en:'Not found'},
    trNotFoundD:{ru:'Подборка или работа удалена — или она не ваша.',en:'The task set or the work was deleted — or it is not yours.'},
    trOnlyTeacher:{ru:'Разбор работ — для учителей',en:'Student work is for teachers'},
    trOnlyTeacherD:{ru:'Ваш аккаунт — «%1». Свои результаты подборки ученик видит сразу после отправки.',en:'Your account is “%1”. Students see their result right after sending.'},
    trNeedCloud:{ru:'Разбору работ нужно облако (Supabase) — заполните assets/config.js.',en:'Student work needs the cloud (Supabase) — fill in assets/config.js.'},
    trLoadErr:{ru:'Не удалось загрузить работы',en:'Could not load the work'},
    trOther:{ru:'Другое',en:'Other'}
  });

  const $ = s => document.querySelector(s);
  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const loc = () => Sky.lang === 'en' ? 'en-GB' : 'ru-RU';
  const num = v => Sky.lang === 'en' ? String(v) : String(v).replace('.', ',');
  const pctOf = s => { const p = Number(s.percent); return Number.isFinite(p) ? Math.round(p * 10) / 10 : 0; };
  const day = iso => iso ? new Date(iso).toLocaleDateString(loc(), { day: 'numeric', month: 'short' }) : '—';
  const dayTime = iso => iso ? new Date(iso).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  const SUBJ = {
    math:{ru:'Математика',en:'Maths'}, algebra:{ru:'Алгебра',en:'Algebra'}, geometry:{ru:'Геометрия',en:'Geometry'},
    physics:{ru:'Физика',en:'Physics'}, chemistry:{ru:'Химия',en:'Chemistry'}, biology:{ru:'Биология',en:'Biology'},
    history:{ru:'История',en:'History'}, russian:{ru:'Русский язык',en:'Russian'}, english:{ru:'Английский',en:'English'},
    informatics:{ru:'Информатика',en:'Computer science'}, geography:{ru:'География',en:'Geography'}, social:{ru:'Обществознание',en:'Social studies'},
    german:{ru:'Немецкий',en:'German'}, spanish:{ru:'Испанский',en:'Spanish'}, polish:{ru:'Польский',en:'Polish'}
  };
  const subjName = k => SUBJ[k] ? Sky.L(SUBJ[k]) : (!k || k === 'other' ? '' : k);

  /* Варианты — буквами, как в тетради: А, Б, В… (A, B, C… по-английски). */
  const letter = i => ((Sky.lang === 'en' ? 'ABCDEFGHIJ' : 'АБВГДЕЖЗИК')[i]) || String(i + 1);

  /* Оценка по проценту — та же шкала, что в быстрой проверке теста и
     статистике профиля: 90 % — 5, 75 % — 4, 60 % — 3, ниже — 2. */
  const grade = p => p >= 90 ? 5 : p >= 75 ? 4 : p >= 60 ? 3 : 2;
  const gradeChip = g => `<span class="tr-grade g${g}">${g}</span>`;

  const SORTS = ['date', 'name', 'score'];
  let sortBy = SORTS.includes(Sky.get('trSort', 'date')) ? Sky.get('trSort', 'date') : 'date';
  let me = null, colls = [], subs = [], loaded = false, loading = false;
  const explained = new Map();     // `${работа}:${задание}` → текст: второй раз не тратим запрос

  /* ---------- адрес ---------- */
  const where = () => { const q = new URLSearchParams(location.search); return { c: q.get('c'), s: q.get('s') }; };
  function href(c, s) {
    const q = new URLSearchParams();
    if (c) q.set('c', c);
    if (s) q.set('s', s);
    const qs = q.toString();
    return 'teacher-review.html' + (qs ? '?' + qs : '');
  }
  function go(c, s) {
    history.pushState(null, '', href(c, s));
    render();
    window.scrollTo(0, 0);
    const h = $('#trView h1');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }

  /* ---------- данные ---------- */
  async function load() {
    if (loading) return;
    loading = true;
    $('#trView').innerHTML = '<div class="panel"><span class="spin"></span></div>';
    try {
      const [c, s] = await Promise.all([
        Sky.db.list('task_collections', { teacher_id: me.id }, { strict: true }),
        Sky.db.list('collection_submissions', null, { strict: true })
      ]);
      const newest = (a, b) => String(b.created_at).localeCompare(String(a.created_at));
      colls = (c || []).sort(newest);
      const mine = new Set(colls.map(x => x.id));
      subs = (s || []).filter(x => mine.has(x.collection_id)).sort(newest);
      loaded = true;
    } catch (e) {
      loading = false;
      $('#trView').innerHTML = `<div class="panel"><div class="empty"><div class="big">📭</div><b>${esc(t('trLoadErr'))}</b></div></div>`;
      if (window.SkyErrors) SkyErrors.show(e, { retry: load, context: 'teacher-review' });
      return;
    }
    loading = false;
    render();
  }

  const subsOf = id => subs.filter(s => s.collection_id === id);
  const tasksOf = c => Array.isArray(c && c.tasks) ? c.tasks : [];

  /* Разбор одной работы по заданиям. Основа — task_details (что ученик
     видел и ответил на момент сдачи); правильный ответ — из подборки. */
  function rowsOf(sub, coll) {
    const tasks = tasksOf(coll);
    const det = Array.isArray(sub.task_details) && sub.task_details.length ? sub.task_details : null;
    const answers = Array.isArray(sub.answers) ? sub.answers : [];
    const base = det || tasks.map(x => ({ task_id: x.id }));
    return base.map((d, i) => {
      const task = tasks.find(x => x.id === d.task_id) || {};
      const a = answers.find(x => x.task_id === d.task_id) || {};
      const type = d.type || task.type || 'text';
      const options = Array.isArray(d.options) && d.options.length ? d.options : (Array.isArray(task.options) ? task.options : []);
      const choice = det ? (Number.isInteger(d.student_choice) ? d.student_choice : null)
        : (type === 'choice' && /^\d{1,4}$/.test(String(a.answer)) ? Number(a.answer) : null);
      const given = det ? (d.student_answer == null ? '' : String(d.student_answer))
        : (type === 'choice' ? (choice != null && options[choice] != null ? String(options[choice]) : '') : String(a.answer || ''));
      /* «верно»: answers — то, что поправил учитель вручную, там всегда свежее */
      const ok = Object.prototype.hasOwnProperty.call(a, 'correct') ? a.correct : (d.is_correct === undefined ? null : d.is_correct);
      const rightChoice = type === 'choice' && /^\d{1,4}$/.test(String(task.answer)) ? Number(task.answer) : null;
      const accept = Array.isArray(task.accept) ? task.accept.filter(x => String(x).trim()) : [];
      const right = rightChoice != null ? String(options[rightChoice] == null ? '' : options[rightChoice]) : accept.join(' / ');
      return {
        n: i + 1, id: d.task_id, type, options, question: d.question || task.text || '',
        explanation: String(task.explanation || '').trim(),
        given, choice, ok: ok === true ? true : ok === false ? false : null,
        right, rightChoice,
        shownGiven: given && choice != null && type === 'choice' ? letter(choice) + '. ' + given : given,
        shownRight: right && rightChoice != null ? letter(rightChoice) + '. ' + right : right
      };
    });
  }

  function totals(sub, coll) {
    const total = tasksOf(coll).length || (Array.isArray(sub.task_details) ? sub.task_details.length : 0);
    const pct = pctOf(sub);
    return { total, correct: Number(sub.score) || 0, pct, grade: grade(pct) };
  }

  /* ---------- 1. подборки ---------- */
  function renderColls() {
    document.title = t('trH1') + ' — SkyySchool';
    const head = `<div class="tr-head"><div><h1>${esc(t('trH1'))}</h1><p class="lead">${esc(t('trLead'))}</p></div></div>`;
    if (!colls.length) {
      return head + `<div class="panel"><div class="empty"><div class="big">🗂️</div><b>${esc(t('trNoColls'))}</b><p>${esc(t('trNoCollsD'))}</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><a class="btn" href="collections.html">${esc(t('trCreate'))}</a></div></div></div>`;
    }
    const last = c => { const s = subsOf(c.id)[0]; return s ? s.created_at : c.created_at; };
    const list = colls.slice().sort((a, b) => String(last(b)).localeCompare(String(last(a))));
    return head + `<div class="tr-colls">${list.map(c => {
      const ss = subsOf(c.id);
      const avg = ss.length ? Math.round(ss.reduce((n, s) => n + pctOf(s), 0) / ss.length) : null;
      const pend = ss.filter(s => s.status === 'pending').length;
      return `<a class="tr-coll" href="${esc(href(c.id))}" data-nav>
        <h3>${esc(c.title)}</h3>
        <div class="tr-meta">
          ${subjName(c.subject) ? `<span>${esc(subjName(c.subject))}</span>` : ''}
          <span>${esc(t('trTasks').replace('%1', tasksOf(c).length))}</span>
          <span>${esc(t('trCode'))}: <span class="mono">${esc(c.share_code)}</span></span>
        </div>
        <div class="stat">${ss.length
          ? `<b>${ss.length}</b> <span>${esc(t('trWorksN'))}</span> <span>· ${esc(t('trAvg').replace('%1', avg))}</span> ` +
            (pend ? `<span class="tag warn">${esc(t('trPendingN').replace('%1', pend))}</span> ` : '') +
            `<span style="color:var(--muted)">${esc(t('trLast').replace('%1', day(ss[0].created_at)))}</span>`
          : `<span style="color:var(--muted)">${esc(t('trNoWorks'))}</span>`}</div>
      </a>`;
    }).join('')}</div>`;
  }

  /* ---------- 2. ученики одной подборки ---------- */
  function sorted(list) {
    const out = list.slice();
    if (sortBy === 'name') out.sort((a, b) => String(a.student_name || '').localeCompare(String(b.student_name || ''), loc()));
    else if (sortBy === 'score') out.sort((a, b) => pctOf(b) - pctOf(a) || String(a.student_name || '').localeCompare(String(b.student_name || ''), loc()));
    else out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return out;
  }

  function collHead(c, extra) {
    return `<div><a class="back-link tr-back" href="${esc(href())}" data-nav>${esc(t('trAll'))}</a>
      <div class="tr-head"><div><h1>${esc(c.title)}</h1>
        <div class="tr-meta">
          ${subjName(c.subject) ? `<span>${esc(subjName(c.subject))}</span>` : ''}
          <span>${esc(t('trTasks').replace('%1', tasksOf(c).length))}</span>
          <span>${esc(t('trCode'))}: <span class="mono">${esc(c.share_code)}</span></span>
        </div></div>${extra || ''}</div></div>`;
  }

  function renderStudents(c) {
    document.title = c.title + ' — ' + t('trH1') + ' — SkyySchool';
    const list = sorted(subsOf(c.id));
    if (!list.length) {
      return collHead(c) + `<div class="panel"><div class="empty"><div class="big">📭</div><b>${esc(t('trNoSubs'))}</b><p>${esc(t('trNoSubsD'))}</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><button type="button" class="btn" data-copy="${esc(c.share_code)}">${esc(t('trCopy'))}</button></div></div></div>`;
    }
    const total = tasksOf(c).length;
    const avg = Math.round(list.reduce((n, s) => n + pctOf(s), 0) / list.length);
    const dist = [5, 4, 3, 2].map(g => [g, list.filter(s => grade(pctOf(s)) === g).length]).filter(x => x[1]);
    const sortBtn = k => `<button type="button" data-sort="${k}" aria-pressed="${sortBy === k}">${esc(t('trSort' + k[0].toUpperCase() + k.slice(1)))}</button>`;
    return collHead(c) + `<section class="panel" style="padding:16px 18px;display:grid;gap:14px">
      <div class="tr-bar">
        <div class="tr-sum">
          <span>${esc(t('trWorks'))}: <b>${list.length}</b></span>
          <span>${esc(t('trAvgPct'))}: <b>${avg}%</b></span>
          <span>${esc(t('trMarks'))}: ${dist.map(([g, n]) => `${gradeChip(g)} <b>×${n}</b>`).join(' ')}</span>
        </div>
        <div class="tr-acts grow">
          <div class="tr-sort" role="group" aria-label="${esc(t('trSortL'))}">${SORTS.map(sortBtn).join('')}</div>
          <button type="button" class="btn ghost small" id="trCsv">${esc(t('trCsv'))}</button>
        </div>
      </div>
      <div class="tr-table-wrap"><table class="ctable tr-students">
        <thead><tr><th>${esc(t('trColName'))}</th><th>${esc(t('trColClass'))}</th><th>${esc(t('trColDate'))}</th>
          <th class="num">${esc(t('trColRight'))}</th><th class="num">${esc(t('trColPct'))}</th><th class="num">${esc(t('trColGrade'))}</th></tr></thead>
        <tbody>${list.map(s => {
          const g = grade(pctOf(s));
          return `<tr data-sub="${esc(s.id)}">
            <td><a href="${esc(href(c.id, s.id))}" data-nav>${esc(s.student_name || '—')}</a>${s.status === 'pending' ? ` <span class="tag warn">${esc(t('trPending'))}</span>` : ''}</td>
            <td>${s.student_class ? `<span class="tr-cls">${esc(s.student_class)}</span>` : '<span style="color:var(--muted)">—</span>'}</td>
            <td style="white-space:nowrap">${esc(dayTime(s.created_at))}</td>
            <td class="num">${Number(s.score) || 0} / ${total}</td>
            <td class="num">${esc(num(pctOf(s)))}%</td>
            <td class="num">${gradeChip(g)}</td>
          </tr>`;
        }).join('')}</tbody></table></div>
    </section>`;
  }

  /* ---------- 3. разбор одной работы ---------- */
  function renderWork(c, s) {
    document.title = (s.student_name || '—') + ' — ' + c.title + ' — SkyySchool';
    const rows = rowsOf(s, c);
    const tot = totals(s, c);
    const open = rows.filter(r => r.ok === null).length;
    const order = sorted(subsOf(c.id));
    const at = order.findIndex(x => x.id === s.id);
    const prev = at > 0 ? order[at - 1] : null, next = at >= 0 && at < order.length - 1 ? order[at + 1] : null;
    const mark = r => r.ok === true ? `<span class="tr-mark ok" role="img" aria-label="${esc(t('trMarkOk'))}">✓</span>`
      : r.ok === false ? `<span class="tr-mark no" role="img" aria-label="${esc(t('trMarkNo'))}">✗</span>`
      : `<span class="tr-mark wait" role="img" aria-label="${esc(t('trMarkWait'))}" title="${esc(t('trMarkWait'))}">?</span>`;
    return `<div><a class="back-link tr-back" href="${esc(href(c.id))}" data-nav>${esc(c.title)}</a>
      <div class="tr-head"><div><h1>${esc(s.student_name || '—')}</h1>
        <div class="tr-meta">
          ${s.student_class ? `<span>${esc(t('trColClass'))}: <b style="color:var(--ink)">${esc(s.student_class)}</b></span>` : ''}
          <span>${esc(t('trSubmitted').replace('%1', dayTime(s.created_at)))}</span>
        </div></div></div></div>
    <section class="panel tr-score" aria-label="${esc(t('trSummary').replace('%1', tot.correct).replace('%2', tot.total).replace('%3', num(tot.pct)).replace('%4', tot.grade))}">
      <div class="big">${tot.correct}<small> / ${tot.total}</small></div>
      <div class="txt"><b id="trSummary">${esc(t('trSummary').replace('%1', tot.correct).replace('%2', tot.total).replace('%3', num(tot.pct)).replace('%4', tot.grade))}</b>
        <span>${esc(c.title)}</span></div>
      <div style="margin-left:auto">${gradeChip(tot.grade)}</div>
    </section>
    ${open ? `<div class="tr-note">⏳ <span>${esc(t('trOpenLeft').replace('%1', open))}</span>
      <a class="btn small" href="collections.html?review=${encodeURIComponent(s.id)}">${esc(t('trCheckNow'))}</a></div>` : ''}
    ${s.teacher_comment ? `<div class="tr-comment"><b>${esc(t('trComment'))}</b>${esc(s.teacher_comment)}</div>` : ''}
    <section class="panel" style="padding:6px 10px">
      <div class="tr-table-wrap"><table class="ctable tr-tasks review-table">
        <thead><tr><th>${esc(t('trColN'))}</th><th>${esc(t('trColTask'))}</th><th>${esc(t('trColAnswer'))}</th><th>${esc(t('trColCorrect'))}</th><th></th><th></th></tr></thead>
        <tbody>${rows.map(r => `<tr class="${r.ok === false ? 'is-wrong' : ''}" data-task="${esc(r.id)}">
          <td>${r.n}</td>
          <td class="q-cell"><div class="q">${esc(r.question)}</div></td>
          <td data-l="${esc(t('trColAnswer'))}"><div class="a ${!r.given ? 'none' : r.ok === false ? 'wrong review-wrong' : ''}">${esc(r.shownGiven || t('trNoAnswer'))}</div></td>
          <td data-l="${esc(t('trColCorrect'))}"><div class="a ${r.right ? 'right review-correct' : 'none'}">${esc(r.shownRight || t('trByTeacher'))}</div></td>
          <td class="mk">${mark(r)}</td>
          <td class="act">${r.ok === false ? `<button type="button" class="btn small ghost" data-explain="${esc(r.id)}">${esc(t('trExplain'))}</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>
    </section>
    ${prev || next ? `<div class="tr-pn">
      ${prev ? `<a class="btn ghost small" href="${esc(href(c.id, prev.id))}" data-nav>${esc(t('trPrev'))}</a>` : '<span></span>'}
      ${next ? `<a class="btn ghost small" href="${esc(href(c.id, next.id))}" data-nav>${esc(t('trNext'))}</a>` : ''}</div>` : ''}`;
  }

  function notFound() {
    return `<div><a class="back-link tr-back" href="${esc(href())}" data-nav>${esc(t('trAll'))}</a></div>
      <div class="panel"><div class="empty"><div class="big">🔎</div><b>${esc(t('trNotFound'))}</b><p>${esc(t('trNotFoundD'))}</p></div></div>`;
  }

  function render() {
    if (!loaded) return;
    const w = where();
    const c = w.c ? colls.find(x => x.id === w.c) : null;
    const s = c && w.s ? subs.find(x => x.id === w.s && x.collection_id === c.id) : null;
    let html;
    if (!w.c) html = renderColls();
    else if (!c || (w.s && !s)) html = notFound();
    else html = s ? renderWork(c, s) : renderStudents(c);
    $('#trView').innerHTML = html;
  }

  /* ---------- «Объяснить» ---------- */
  function explain(subId, taskId) {
    const w = where();
    const c = colls.find(x => x.id === w.c);
    const s = c && subs.find(x => x.id === subId);
    const r = s && rowsOf(s, c).find(x => x.id === taskId);
    if (!r) return;
    const key = subId + ':' + taskId;

    Sky.modal(`<div class="tr-ex review-modal">
      <h2>${esc(t('trExH').replace('%1', r.n))}</h2>
      <p class="q">${esc(r.question)}</p>
      <div class="pair">
        <div><small>${esc(t('trColAnswer'))}</small><span class="no">${esc(r.shownGiven || t('trNoAnswer'))}</span></div>
        <div><small>${esc(t('trColCorrect'))}</small><span class="ok">${esc(r.shownRight || t('trByTeacher'))}</span></div>
      </div>
      ${r.explanation ? `<div class="tr-ex-mine"><b>${esc(t('trExMine'))}</b><div>${esc(r.explanation)}</div></div>` : ''}
      <div class="tr-ex-body" id="trExBody" aria-live="polite"></div>
      <div class="actions" style="justify-content:flex-end;margin-top:14px">
        <button type="button" class="btn ghost" data-x>${esc(t('trClose'))}</button>
      </div>
    </div>`, (box, close) => {
      box.querySelector('[data-x]').addEventListener('click', close);
      const body = box.querySelector('#trExBody');
      const show = text => {
        body.innerHTML = String(text).split(/\n{2,}|\r\n\r\n/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('') +
          `<div class="tr-ex-src">${esc(t('trExSrc'))}</div>`;
      };
      async function ask() {
        body.innerHTML = `<span class="spin"></span> <span style="color:var(--muted);font-weight:700">${esc(t('trExWait'))}</span>`;
        /* Тело запроса — как у тренажёра: {task, options, userAnswer,
           correctAnswer, subject}; язык добавляет Sky.explain. Варианты —
           с буквами, чтобы объяснение могло на них ссылаться. */
        const res = await Sky.explain({
          task: r.question,
          options: r.type === 'choice' && r.options.length ? r.options.map((o, i) => letter(i) + '. ' + o) : undefined,
          userAnswer: r.shownGiven || '',
          correctAnswer: r.shownRight || '',
          subject: subjName(c.subject)
        });
        if (!body.isConnected) return;
        if (res && res.text) { explained.set(key, res.text); show(res.text); return; }
        body.innerHTML = `<p class="err">${esc((res && res.error) || t('trLoadErr'))}</p>
          <button type="button" class="btn small" id="trExAgain">${esc(t('trExRetry'))}</button>`;
        body.querySelector('#trExAgain').addEventListener('click', ask);
      }
      /* своё объяснение учителя уже есть — ИИ спрашиваем только по кнопке */
      if (explained.has(key)) show(explained.get(key));
      else if (r.explanation) {
        body.innerHTML = `<button type="button" class="btn ghost small" id="trExAi">${esc(t('trExAskAi'))}</button>`;
        body.querySelector('#trExAi').addEventListener('click', ask);
      } else ask();
    });
  }

  /* ---------- CSV: ФИО, класс, верно, всего, процент, оценка ---------- */
  function exportCsv(c) {
    const list = sorted(subsOf(c.id));
    if (!list.length) return;
    const sep = Sky.lang === 'en' ? ',' : ';';
    const cell = v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // Excel не должен принять ячейку за формулу
      /* в кавычки — только если внутри разделитель, кавычка или перенос:
         десятичная запятая «66,7» при разделителе «;» остаётся числом */
      return (s.includes(sep) || /["\n\r]/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = Sky.lang === 'en'
      ? ['Student', 'Class', 'Correct', 'Total', 'Percent', 'Mark']
      : ['ФИО', 'Класс', 'Верно', 'Всего', 'Процент', 'Оценка'];
    const total = tasksOf(c).length;
    const rows = list.map(s => [s.student_name || '', s.student_class || '', Number(s.score) || 0, total, num(pctOf(s)), grade(pctOf(s))]);
    const text = [head].concat(rows).map(r => r.map(cell).join(sep)).join('\r\n');
    /* data:-ссылка, как в аналитике: blob-ссылка со страницы file://
       теряет имя файла. ﻿ (BOM) — чтобы Excel прочёл кириллицу. */
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + text);
    a.download = 'skyschool-' + String(c.share_code || 'results').replace(/[^A-Za-z0-9]/g, '') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- события ---------- */
  $('#trView').addEventListener('click', e => {
    const nav = e.target.closest('a[data-nav]');
    if (nav) {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;   // новая вкладка — пусть браузер
      e.preventDefault();
      const u = new URL(nav.getAttribute('href'), location.href);
      go(u.searchParams.get('c'), u.searchParams.get('s'));
      return;
    }
    const ex = e.target.closest('[data-explain]');
    if (ex) { explain(where().s, ex.dataset.explain); return; }
    const so = e.target.closest('[data-sort]');
    if (so) { sortBy = so.dataset.sort; Sky.set('trSort', sortBy); render(); return; }
    if (e.target.closest('#trCsv')) { const c = colls.find(x => x.id === where().c); if (c) exportCsv(c); return; }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const link = new URL('collection.html?code=' + encodeURIComponent(cp.dataset.copy), location.href).href;
      const done = () => Sky.toast(t('trCopied'));
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, () => prompt(t('trCopy'), link));
      else prompt(t('trCopy'), link);
      return;
    }
    /* строка ученика целиком — как ссылка на его разбор */
    const tr = e.target.closest('tr[data-sub]');
    if (tr && !e.target.closest('a,button')) go(where().c, tr.dataset.sub);
  });

  window.addEventListener('popstate', render);
  document.addEventListener('langchange', render);

  (async function boot() {
    await Sky.db.ready;
    me = Sky.db.me();
    if (!Sky.db.isCloud()) { $('#trView').innerHTML = `<p class="note">${esc(t('trNeedCloud'))}</p>`; return; }
    if (!me) { location.replace('auth.html?next=' + encodeURIComponent('teacher-review.html' + location.search)); return; }
    if (me.role !== 'teacher') {
      $('#trView').innerHTML = `<div class="panel"><div class="empty"><div class="big">🎓</div><b>${esc(t('trOnlyTeacher'))}</b>
        <p>${esc(t('trOnlyTeacherD').replace('%1', Sky.t(me.role || 'student')))}</p></div></div>`;
      return;
    }
    load();
  })();

  window.SkyReview = { reload: load, get loaded() { return loaded; } };
})();
