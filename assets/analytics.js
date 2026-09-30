/* ============================================================
   SkyySchool — аналитика учителя (analytics.html)

   Всё одним запросом teacher_analytics(дней) — sql/schema-teacher-tools.sql:
     • проверки по дням (столбцы; при наведении — сколько по фото,
       тестов и подборок), таблица тех же чисел;
     • средний балл по предметам;
     • топ-5 ошибок класса;
     • ученики с самой низкой успеваемостью (+ все по кнопке);
     • «Экспорт CSV» — сводка по каждому ученику за период.
   Период — 7 / 30 / 90 дней, запоминается.
   ============================================================ */
'use strict';

(function () {

  Sky.init({
    anH1:{ru:'Аналитика класса',en:'Class analytics'},
    anLead:{ru:'Что получается и что нет — по проверкам фото, тестам и подборкам.',en:'What works and what does not — from photo checks, tests and task sets.'},
    anPeriod:{ru:'Период',en:'Period'},
    anDays:{ru:'%1 дней',en:'%1 days'},
    anCsv:{ru:'Экспорт CSV',en:'Export CSV'},
    anWorks:{ru:'Работ проверено',en:'Works checked'},
    anAvg:{ru:'Средний балл',en:'Average mark'},
    anAvgOf:{ru:'из %1 оценок',en:'from %1 marks'},
    anStudents:{ru:'Учеников',en:'Students'},
    anPending:{ru:'Ждут проверки',en:'Awaiting review'},
    anPendingGo:{ru:'открыть',en:'open'},
    anChartH:{ru:'Проверки за %1 дней',en:'Checks over %1 days'},
    anChartNone:{ru:'За этот период проверок не было',en:'No checks in this period'},
    anTable:{ru:'Таблица',en:'Table'},
    anChart:{ru:'График',en:'Chart'},
    anDay:{ru:'День',en:'Day'},
    anTotal:{ru:'Всего',en:'Total'},
    anPhoto:{ru:'по фото',en:'photo'},
    anTest:{ru:'тесты',en:'tests'},
    anColl:{ru:'подборки',en:'sets'},
    anWorksN:{ru:'%1 работ',en:'%1 works'},
    anSubjH:{ru:'Средний балл по предметам',en:'Average mark by subject'},
    anSubjNone:{ru:'Оценок пока нет',en:'No marks yet'},
    anErrH:{ru:'Топ-5 ошибок класса',en:'Top 5 class mistakes'},
    anErrNone:{ru:'Ошибок не найдено — или проверок пока мало',en:'No mistakes found — or too few checks so far'},
    anErrTest:{ru:'Тест %1 (%2): вопрос №%3',en:'Test %1 (%2): question %3'},
    anErrTestNoSubj:{ru:'Тест %1: вопрос №%2',en:'Test %1: question %2'},
    anErrTask:{ru:'«%1», задание %2',en:'“%1”, task %2'},
    anTimes:{ru:'%1 раз',en:'%1 times'},
    anWeakH:{ru:'Ученики с самой низкой успеваемостью',en:'Students who struggle most'},
    anWeakNone:{ru:'Пока нет учеников с оценками за период',en:'No graded students in this period yet'},
    anAll:{ru:'Все ученики (%1)',en:'All students (%1)'},
    anLess:{ru:'Свернуть',en:'Collapse'},
    anColName:{ru:'Ученик',en:'Student'},
    anColWorks:{ru:'Работ',en:'Works'},
    anColAvg:{ru:'Ср. балл',en:'Avg mark'},
    anColPct:{ru:'Ср. %',en:'Avg %'},
    anColLast:{ru:'Последняя',en:'Last'},
    anEmptyH:{ru:'Данных пока нет',en:'No data yet'},
    anEmptyD:{ru:'Проверьте работы по фото, проведите тест или раздайте подборку — аналитика появится сама.',en:'Check photos, run a test or share a task set — analytics will appear on its own.'},
    anGoColl:{ru:'Подборки',en:'Task sets'},
    anGoPhoto:{ru:'Проверка по фото',en:'Photo check'},
    anOnlyTeacher:{ru:'Аналитика — для учителей',en:'Analytics is for teachers'},
    anOnlyTeacherD:{ru:'Ваш аккаунт — «%1».',en:'Your account is “%1”.'},
    anNeedCloud:{ru:'Аналитике нужно облако (Supabase) — заполните assets/config.js.',en:'Analytics needs the cloud (Supabase) — fill in assets/config.js.'},
    anErr:{ru:'Аналитика не загрузилась',en:'Analytics did not load'},
    anOther:{ru:'Другое',en:'Other'}
  });

  const $ = s => document.querySelector(s);
  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const loc = () => Sky.lang === 'en' ? 'en-GB' : 'ru-RU';
  const num = v => v == null ? '—' : (Sky.lang === 'en' ? String(v) : String(v).replace('.', ','));
  const fmt1 = v => v == null ? '—' : num(Number(v).toFixed(1));

  const SUBJ = {
    math:{ru:'Математика',en:'Maths'}, algebra:{ru:'Алгебра',en:'Algebra'}, geometry:{ru:'Геометрия',en:'Geometry'},
    physics:{ru:'Физика',en:'Physics'}, chemistry:{ru:'Химия',en:'Chemistry'}, biology:{ru:'Биология',en:'Biology'},
    history:{ru:'История',en:'History'}, russian:{ru:'Русский язык',en:'Russian'}, english:{ru:'Английский',en:'English'},
    informatics:{ru:'Информатика',en:'Computer science'}, geography:{ru:'География',en:'Geography'}, social:{ru:'Обществознание',en:'Social studies'},
    german:{ru:'Немецкий',en:'German'}, spanish:{ru:'Испанский',en:'Spanish'}, polish:{ru:'Польский',en:'Polish'}
  };
  const subjName = k => SUBJ[k] ? Sky.L(SUBJ[k]) : (!k || k === 'other' ? t('anOther') : k);
  const PERIODS = [7, 30, 90];

  let days = PERIODS.includes(Sky.get('anDays', 30)) ? Sky.get('anDays', 30) : 30;
  let data = null, showTable = false, allStudents = false, loading = false;

  /* ---------- загрузка ---------- */
  async function load() {
    if (loading) return;
    loading = true;
    $('#anBody').classList.add('refetch');
    try {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || 'Europe/Moscow';
      data = await Sky.db.rpc('teacher_analytics', { p_days: days, p_tz: tz });
    } catch (e) {
      loading = false;
      $('#anBody').classList.remove('refetch');
      if (!data) $('#anBody').innerHTML = `<div class="panel"><div class="empty"><div class="big">📉</div><b>${esc(t('anErr'))}</b></div></div>`;
      if (window.SkyErrors) SkyErrors.show(e, { retry: load, context: 'analytics' });
      return;
    }
    loading = false;
    $('#anBody').classList.remove('refetch');
    render();
  }

  /* ---------- отрисовка ---------- */
  function render() {
    renderFilters();
    if (!data) return;
    const tot = data.totals || {};
    if (!tot.works && !tot.pending) {
      $('#anBody').innerHTML = `<div class="panel"><div class="empty"><div class="big">📊</div><b>${esc(t('anEmptyH'))}</b><p>${esc(t('anEmptyD'))}</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><a class="btn" href="collections.html">${esc(t('anGoColl'))}</a><a class="btn ghost" href="photo.html">${esc(t('anGoPhoto'))}</a></div></div></div>`;
      $('#anCsv').disabled = true;
      return;
    }
    $('#anCsv').disabled = !(data.students || []).length;
    $('#anBody').innerHTML = `
      <div class="an-kpis">
        ${kpi('works', tot.works || 0, t('anWorks'))}
        ${kpi('avg', fmt1(tot.avg_grade), t('anAvg'), tot.graded ? t('anAvgOf').replace('%1', tot.graded) : '')}
        ${kpi('students', tot.students || 0, t('anStudents'))}
        ${kpi('pending', tot.pending || 0, t('anPending'), tot.pending ? `<a href="profile.html#inbox">${esc(t('anPendingGo'))} →</a>` : '', true)}
      </div>
      <section class="panel an-card" aria-labelledby="anChartH">
        <div class="an-card-h">
          <h2 id="anChartH">${esc(t('anChartH').replace('%1', data.days))}</h2>
          <button type="button" class="btn ghost small" id="anToggle" aria-pressed="${showTable}">${esc(t(showTable ? 'anChart' : 'anTable'))}</button>
        </div>
        <div id="anChart" class="an-chart"${showTable ? ' hidden' : ''}></div>
        <div id="anDaysTable" class="an-table-wrap"${showTable ? '' : ' hidden'}>${daysTable()}</div>
      </section>
      <div class="an-grid">
        <section class="panel an-card" aria-labelledby="anSubjH"><h2 id="anSubjH">${esc(t('anSubjH'))}</h2>${subjects()}</section>
        <section class="panel an-card" aria-labelledby="anErrH"><h2 id="anErrH">${esc(t('anErrH'))}</h2>${errors()}</section>
      </div>
      <section class="panel an-card" aria-labelledby="anWeakH"><h2 id="anWeakH">${esc(t('anWeakH'))}</h2>${students()}</section>`;
    $('#anToggle').addEventListener('click', () => { showTable = !showTable; render(); });
    const more = $('#anMore');
    if (more) more.addEventListener('click', () => { allStudents = !allStudents; render(); });
    if (!showTable) drawChart();
  }

  function kpi(key, value, label, sub, raw) {
    return `<div class="stat an-kpi" data-kpi="${key}"><b>${esc(value)}</b><span>${esc(label)}</span>${sub ? `<small>${raw ? sub : esc(sub)}</small>` : ''}</div>`;
  }

  function renderFilters() {
    $('#anPeriod').innerHTML = PERIODS.map(d =>
      `<button type="button" data-days="${d}" aria-pressed="${d === days}">${esc(t('anDays').replace('%1', d))}</button>`).join('');
  }

  const dayLabel = (d, long) => new Date(d + 'T12:00:00').toLocaleDateString(loc(), long ? { day: 'numeric', month: 'long', weekday: 'short' } : { day: 'numeric', month: 'short' });
  const dayTotal = d => (d.photo || 0) + (d.test || 0) + (d.collection || 0);

  function daysTable() {
    const rows = (data.series || []).filter(d => dayTotal(d)).slice().reverse();
    if (!rows.length) return `<p class="an-none">${esc(t('anChartNone'))}</p>`;
    return `<table class="ctable"><thead><tr><th>${esc(t('anDay'))}</th><th class="num">${esc(t('anTotal'))}</th>
      <th class="num">${esc(t('anPhoto'))}</th><th class="num">${esc(t('anTest'))}</th><th class="num">${esc(t('anColl'))}</th></tr></thead>
      <tbody>${rows.map(d => `<tr><td>${esc(dayLabel(d.day, true))}</td><td class="num"><b>${dayTotal(d)}</b></td>
        <td class="num">${d.photo || 0}</td><td class="num">${d.test || 0}</td><td class="num">${d.collection || 0}</td></tr>`).join('')}</tbody></table>`;
  }

  /* Столбцы по дням: одна серия, поэтому без легенды — что показано,
     говорит заголовок. Столбец не толще 24 px, скругление только
     сверху, между столбцами — воздух. Наведение и фокус — на всю
     высоту дня, не только на закрашенную часть. */
  function nice(max) {
    if (max <= 4) return { top: Math.max(max, 1), step: 1 };
    const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
    return { top: Math.ceil(max / step) * step, step };
  }

  function drawChart() {
    const box = $('#anChart');
    if (!box) return;
    const series = data.series || [];
    const max = Math.max(0, ...series.map(dayTotal));
    if (!max) { box.innerHTML = `<p class="an-none">${esc(t('anChartNone'))}</p>`; return; }
    const W = Math.max(280, box.clientWidth), H = 220;
    const pad = { l: 30, r: 6, t: 12, b: 26 };
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const { top, step } = nice(max);
    const slot = pw / series.length;
    const bw = Math.max(3, Math.min(24, slot * 0.64));
    const y = v => pad.t + ph - v / top * ph;
    const ticks = [];
    for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
    const every = Math.ceil(series.length / Math.max(2, Math.floor(pw / 80)));   /* подпись — не чаще, чем раз в 80 px */
    const bar = (x, h) => {
      const r = Math.min(4, bw / 2, h);
      const yb = pad.t + ph, yt = yb - h;
      return `M${x},${yb}V${yt + r}Q${x},${yt} ${x + r},${yt}H${x + bw - r}Q${x + bw},${yt} ${x + bw},${yt + r}V${yb}Z`;
    };
    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(t('anChartH').replace('%1', data.days))}">
        <g class="an-grid-l">${ticks.map(v => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
        <g class="an-ytick">${ticks.map(v => `<text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`).join('')}</g>
        <g class="an-bars">${series.map((d, i) => {
          const v = dayTotal(d), x = pad.l + i * slot + (slot - bw) / 2;
          return v ? `<path d="${bar(x, Math.max(2, v / top * ph))}"/>` : '';
        }).join('')}</g>
        <g class="an-xtick">${series.map((d, i) => (series.length - 1 - i) % every === 0
          ? `<text x="${pad.l + i * slot + slot / 2}" y="${H - 8}" text-anchor="${i === series.length - 1 ? 'end' : 'middle'}"${i === series.length - 1 ? ` dx="${slot / 2}"` : ''}>${esc(dayLabel(d.day))}</text>` : '').join('')}</g>
        <g class="an-hits">${series.map((d, i) => `<rect x="${pad.l + i * slot}" y="${pad.t}" width="${slot}" height="${ph}" tabindex="0" data-i="${i}"
          aria-label="${esc(dayLabel(d.day, true) + ': ' + t('anWorksN').replace('%1', dayTotal(d)))}"/>`).join('')}</g>
      </svg>
      <div class="an-tip" role="tooltip" hidden></div>`;
    const tip = box.querySelector('.an-tip');
    const show = (rect) => {
      const i = +rect.dataset.i, d = series[i];
      box.querySelectorAll('.an-hits rect').forEach(r => r.classList.toggle('on', r === rect));
      tip.replaceChildren();
      const head = document.createElement('div'); head.className = 'an-tip-h'; head.textContent = dayLabel(d.day, true);
      const val = document.createElement('b'); val.textContent = t('anWorksN').replace('%1', dayTotal(d));
      tip.append(head, val);
      [['photo', 'anPhoto'], ['test', 'anTest'], ['collection', 'anColl']].forEach(([k, lab]) => {
        if (!d[k]) return;
        const r = document.createElement('div'); r.className = 'an-tip-r';
        const n = document.createElement('span'); n.textContent = d[k];
        const l = document.createElement('span'); l.textContent = t(lab);
        r.append(n, l); tip.append(r);
      });
      tip.hidden = false;
      const cx = (pad.l + i * slot + slot / 2) / W * box.clientWidth;
      const tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(box.clientWidth - tw, cx - tw / 2)) + 'px';
      tip.style.top = Math.max(0, y(dayTotal(d)) / H * box.clientHeight - tip.offsetHeight - 8) + 'px';
    };
    const hide = () => { tip.hidden = true; box.querySelectorAll('.an-hits rect.on').forEach(r => r.classList.remove('on')); };
    box.querySelectorAll('.an-hits rect').forEach(r => {
      r.addEventListener('pointerenter', () => show(r));
      r.addEventListener('focus', () => show(r));
      r.addEventListener('blur', hide);
    });
    box.querySelector('svg').addEventListener('pointerleave', hide);
  }

  function subjects() {
    const list = (data.subjects || []).filter(s => s.avg_grade != null).sort((a, b) => b.avg_grade - a.avg_grade || b.works - a.works);
    if (!list.length) return `<p class="an-none">${esc(t('anSubjNone'))}</p>`;
    return `<ul class="an-bars-h">${list.map(s => `
      <li><span class="an-lab">${esc(subjName(s.subject))}</span>
        <span class="an-track" title="${esc(t('anWorksN').replace('%1', s.works))}"><i style="width:${Math.max(2, s.avg_grade / 5 * 100)}%"></i></span>
        <b class="an-val">${esc(fmt1(s.avg_grade))}</b></li>`).join('')}</ul>`;
  }

  function errLabel(e) {
    if (e.kind === 'type') { const l = String(e.label || '').trim(); return l.charAt(0).toUpperCase() + l.slice(1); }
    if (e.kind === 'test') {
      const d = e.day ? new Date(e.day + 'T12:00:00').toLocaleDateString(loc(), { day: '2-digit', month: '2-digit' }) : '';
      return e.subject ? t('anErrTest').replace('%1', d).replace('%2', subjName(e.subject)).replace('%3', e.n) : t('anErrTestNoSubj').replace('%1', d).replace('%2', e.n);
    }
    return t('anErrTask').replace('%1', e.title || '').replace('%2', e.n);
  }

  function errors() {
    const list = data.errors || [];
    if (!list.length) return `<p class="an-none">${esc(t('anErrNone'))}</p>`;
    const max = Math.max(...list.map(e => e.cnt));
    return `<ol class="an-errs">${list.map((e, i) => `
      <li><span class="an-rank">${i + 1}</span>
        <div class="an-err-txt"><b>${esc(errLabel(e))}</b>${e.kind === 'task' && e.label ? `<span>${esc(e.label)}</span>` : ''}
          <span class="an-track thin"><i style="width:${e.cnt / max * 100}%"></i></span></div>
        <span class="an-cnt">${esc(t('anTimes').replace('%1', e.cnt))}</span></li>`).join('')}</ol>`;
  }

  function gradeChip(g) {
    if (g == null) return '—';
    const tone = g < 3 ? 'no' : g < 3.5 ? 'warn' : g < 4.5 ? 'gray' : 'ok';
    return `<span class="tag ${tone}">${esc(fmt1(g))}</span>`;
  }

  function students() {
    const all = (data.students || []).filter(s => s.avg_grade != null);
    if (!all.length) return `<p class="an-none">${esc(t('anWeakNone'))}</p>`;
    const list = allStudents ? all : all.slice(0, 5);
    return `<div class="an-table-wrap"><table class="ctable"><thead><tr><th>${esc(t('anColName'))}</th><th class="num">${esc(t('anColWorks'))}</th>
        <th class="num">${esc(t('anColAvg'))}</th><th class="num">${esc(t('anColPct'))}</th><th>${esc(t('anColLast'))}</th></tr></thead>
      <tbody>${list.map(s => `<tr><td><b>${esc(s.name)}</b></td><td class="num">${s.works}</td><td class="num">${gradeChip(s.avg_grade)}</td>
        <td class="num">${s.avg_percent != null ? esc(s.avg_percent) + '%' : '—'}</td>
        <td>${esc(new Date(s.last_at).toLocaleDateString(loc(), { day: 'numeric', month: 'short' }))}</td></tr>`).join('')}</tbody></table></div>` +
      (all.length > 5 ? `<button type="button" class="an-more" id="anMore">${esc(allStudents ? t('anLess') : t('anAll').replace('%1', all.length))}</button>` : '');
  }

  /* ---------- CSV: сводка по каждому ученику ---------- */
  function exportCsv() {
    const list = (data && data.students) || [];
    if (!list.length) return;
    const cell = v => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // Excel не должен принять ячейку за формулу
      return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = Sky.lang === 'en'
      ? ['Student', 'Works', 'Graded', 'Average mark', 'Average %', 'Last work']
      : ['Ученик', 'Работ', 'С оценкой', 'Средний балл', 'Средний %', 'Последняя работа'];
    const rows = list.map(s => [s.name, s.works, s.graded, s.avg_grade != null ? num(s.avg_grade) : '', s.avg_percent != null ? s.avg_percent : '',
      new Date(s.last_at).toLocaleDateString(loc())]);
    const text = [head].concat(rows).map(r => r.map(cell).join(Sky.lang === 'en' ? ',' : ';')).join('\r\n');
    /* data:-ссылка, как на остальных страницах: blob-ссылка со страницы
       file:// теряет имя файла. ﻿ (BOM) — чтобы Excel прочёл кириллицу. */
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + text);
    a.download = 'skyschool-students-' + days + 'd.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- запуск ---------- */
  $('#anPeriod').addEventListener('click', e => {
    const b = e.target.closest('[data-days]');
    if (!b || +b.dataset.days === days) return;
    days = +b.dataset.days;
    Sky.set('anDays', days);
    allStudents = false;
    renderFilters();
    load();
  });
  $('#anCsv').addEventListener('click', exportCsv);

  let resizeTimer = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (data && !showTable) drawChart(); }, 120); });
  document.addEventListener('langchange', () => { if (data) render(); else renderFilters(); });

  (async function boot() {
    await Sky.db.ready;
    const me = Sky.db.me();
    renderFilters();
    if (!Sky.db.isCloud()) { $('#anBody').innerHTML = `<p class="note">${esc(t('anNeedCloud'))}</p>`; $('#anTools').hidden = true; return; }
    if (!me) { location.replace('auth.html?next=analytics.html'); return; }
    if (me.role !== 'teacher') {
      $('#anTools').hidden = true;
      $('#anBody').innerHTML = `<div class="panel"><div class="empty"><div class="big">📊</div><b>${esc(t('anOnlyTeacher'))}</b>
        <p>${esc(t('anOnlyTeacherD').replace('%1', Sky.t(me.role || 'student')))}</p></div></div>`;
      return;
    }
    load();
  })();

  window.SkyAnalytics = { reload: load, get data() { return data; } };
})();
