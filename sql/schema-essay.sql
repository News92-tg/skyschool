<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Проверка сочинения — SkyySchool</title>
<meta name="theme-color" content="#f6faff">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="assets/icon-512.png">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/sky.css">
<style>
.ecount{font-size:12px;color:var(--muted);text-align:right;margin-top:4px}
.ecount.warn{color:var(--warn);font-weight:700}

.scorewrap{display:grid;gap:10px;margin-bottom:18px}
.scorerow{display:flex;align-items:center;gap:10px}
.scorerow .lbl{width:150px;flex:none;font-size:12.5px;color:var(--muted);font-weight:700}
.scorerow .bar{flex:1;height:9px;border-radius:5px;background:var(--panel-2);overflow:hidden}
.scorerow .bar i{display:block;height:100%;border-radius:5px;background:var(--accent,#3a7bd5)}
.scorerow .bar i.s5{background:var(--ok)} .scorerow .bar i.s4{background:#4c9f4c}
.scorerow .bar i.s3{background:var(--warn)} .scorerow .bar i.s2{background:#e07a3f} .scorerow .bar i.s1{background:var(--no)}
.scorerow .num{width:22px;flex:none;text-align:right;font-weight:900;font-size:14px}

.good-item{
  border-left:3px solid var(--ok);background:var(--panel-2);border-radius:0 var(--r) var(--r) 0;
  padding:9px 14px;margin-bottom:7px;font-size:13px;line-height:1.55;
}
.err-item{
  border-left:3px solid var(--no);background:var(--panel-2);border-radius:0 var(--r) var(--r) 0;
  padding:11px 14px;margin-bottom:9px;
}
.err-item .frag{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--no);font-weight:700}
.err-item .why{font-size:13px;line-height:1.6;margin-top:5px}
.err-item .fix{font-size:13px;line-height:1.6;margin-top:5px;color:var(--ok);font-weight:700}

.hist-row{display:flex;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line)}
.hist-row:last-child{border-bottom:none}
.hist-row .g{
  width:34px;height:34px;border-radius:11px;flex:none;display:grid;place-items:center;
  font-weight:900;color:#fff;font-size:15px;background:var(--accent,#3a7bd5);
}
.hist-row .txt{flex:1;min-width:0}
.hist-row .txt b{font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hist-row .txt span{font-size:11.5px;color:var(--muted);display:block;margin-top:2px}

.working{display:flex;align-items:center;gap:11px;font-size:13.5px;color:var(--muted);font-weight:700}
.working .dot{width:9px;height:9px;border-radius:50%;background:var(--warn);animation:esPulse 1s infinite;flex:none}
@keyframes esPulse{0%,100%{opacity:1}50%{opacity:.3}}
</style>
</head>
<body>
<header id="appHeader"></header>

<main class="wrap">
  <h1 data-i18n="h1"></h1>
  <p class="lead" data-i18n="lead"></p>

  <!-- кто проверяет / состояние ИИ -->
  <div class="section">
    <div class="panel">
      <div class="spread teacher-bar">
        <span class="who"><span class="ava" id="tchAva"></span><span id="tchName"></span></span>
        <a class="btn ghost small" href="teachers.html" data-i18n="tchChange"></a>
      </div>
      <div class="spread" style="margin-top:14px">
        <span class="tag gray" id="aiState"></span>
        <button class="btn ghost small" id="aiSetupBtn"></button>
      </div>
    </div>
  </div>

  <!-- ввод -->
  <div class="section">
    <div class="panel">
      <div class="field">
        <label data-i18n="subjLabel"></label>
        <select id="eSubj">
          <option value="russian" data-i18n="subjRu"></option>
          <option value="english" data-i18n="subjEn"></option>
        </select>
      </div>

      <div class="field">
        <label data-i18n="promptLabel"></label>
        <textarea id="ePrompt" rows="2" placeholder=""></textarea>
      </div>

      <div class="field">
        <label data-i18n="textLabel"></label>
        <textarea id="eText" rows="14" placeholder=""></textarea>
        <div class="ecount" id="eCount">0</div>
      </div>

      <button class="btn full big" id="checkBtn" disabled data-i18n="checkBtn"></button>
      <div class="working hidden" id="working"><span class="dot"></span><span data-i18n="working"></span></div>
    </div>
  </div>

  <!-- результат -->
  <div class="section hidden" id="resultSection">
    <div class="section-head"><h2 data-i18n="resultH"></h2></div>
    <div class="panel" id="result"></div>
  </div>

  <!-- история -->
  <div class="section hidden" id="histSection">
    <div class="section-head"><h2 data-i18n="histH"></h2></div>
    <div class="panel" id="hist"></div>
  </div>
</main>

<footer id="appFooter"></footer>

<script src="assets/config.js"></script>
<script src="assets/core.js"></script><script src="assets/streaks.js"></script>
<script src="assets/db.js"></script>
<script src="assets/auth.js"></script>
<script src="data/ai-teachers.js"></script>
<script src="assets/ai-teachers.js"></script>
<script>
'use strict';
Sky.init({
  h1:{ru:'Проверка сочинения',en:'Essay review'},
  lead:{ru:'Вставьте текст сочинения — учитель оценит его по пяти сторонам (раскрытие темы, структура, аргументация, язык, общее впечатление), укажет сильные места и разберёт ошибки. Это не официальный балл по критериям К1–К12 ФИПИ: такую точность без доступа к их методике не даёт ни одна модель, и притворяться иначе было бы нечестно по отношению к ученику. Разбор — тренировка перед экзаменом, а не его замена.',
        en:'Paste the essay text — the teacher rates it on five aspects (topic coverage, structure, argumentation, language, overall impression), points out what works, and goes through the mistakes. This is not an official FIPI К1–К12 exam score: no model can match that exact methodology, and pretending otherwise would be unfair to the student. Think of it as exam practice, not a replacement for it.'},

  tchChange:{ru:'Сменить',en:'Change'},
  tchGrades:{ru:'Проверяет: %1',en:'Marked by: %1'},

  off:{ru:'не подключён',en:'not connected'},
  change:{ru:'Изменить',en:'Change'},
  aiOnKey:{ru:'Работает по вашему ключу',en:'Running on your key'},
  aiOnWorker:{ru:'Работает через Worker',en:'Running through the Worker'},

  subjLabel:{ru:'Предмет',en:'Subject'},
  subjRu:{ru:'Русский язык',en:'Russian'},
  subjEn:{ru:'Английский язык',en:'English'},

  promptLabel:{ru:'Тема или задание сочинения (необязательно, но с этим проверка точнее)',
               en:'The essay topic or prompt (optional, but it makes marking more accurate)'},
  textLabel:{ru:'Текст сочинения',en:'Essay text'},
  tooShort:{ru:'Слишком коротко: минимум 50 символов, иначе оценивать нечего.',
            en:'Too short: at least 50 characters, otherwise there is nothing to mark.'},
  tooLong:{ru:'Символов: %1 (максимум 6000 — длиннее модель не примет)',
           en:'Characters: %1 (max 6000 — the model will not accept more)'},

  checkBtn:{ru:'Проверить сочинение',en:'Check the essay'},
  working:{ru:'Читаю и разбираю сочинение…',en:'Reading and marking the essay…'},

  resultH:{ru:'Разбор',en:'Review'},
  scoreRelevance:{ru:'Раскрытие темы',en:'Topic coverage'},
  scoreStructure:{ru:'Структура',en:'Structure'},
  scoreArgumentation:{ru:'Аргументация',en:'Argumentation'},
  scoreLanguage:{ru:'Язык и грамотность',en:'Language'},
  scoreOverall:{ru:'Общее впечатление',en:'Overall impression'},
  goodH:{ru:'Что удалось',en:'What works'},
  errH:{ru:'Замечания',en:'Issues'},
  fixL:{ru:'Как лучше: ',en:'Better: '},
  nextH:{ru:'Что дальше',en:'What next'},
  noIssues:{ru:'Серьёзных замечаний не нашлось.',en:'No serious issues found.'},

  histH:{ru:'Ваши сочинения',en:'Your essays'},
  histEmpty:{ru:'Пока пусто.',en:'Nothing yet.'},
  saveFail:{ru:'Разбор показан, но не сохранён: для истории нужно войти в аккаунт.',
            en:'The review is shown but not saved: sign in to keep a history.'}
});

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

let lastSaved = null;
const MAX_CHARS = 6000;

/* ---------- учитель ---------- */
function renderTeacher() {
  const t = window.SkyTeachers && SkyTeachers.selected();
  if (!t) return;
  $('#tchAva').textContent = t.emoji;
  $('#tchName').textContent = Sky.t('tchGrades').replace('%1', Sky.L(t.name));
}

/* ---------- состояние ИИ ----------
   Проверка сочинения, в отличие от разбора фото, работает и на своём
   ключе DeepSeek: рукопись тут читать не нужно, вход — обычный текст.
   Поэтому статус ровно такой же, как у ИИ-разбора в тренажёре. */
function renderAiState() {
  const mode = Sky.aiMode();
  const tag = $('#aiState'), btn = $('#aiSetupBtn');
  tag.textContent = mode === 'key' ? Sky.t('aiOnKey')
    : mode === 'worker' ? Sky.t('aiOnWorker') : Sky.t('aiTitle') + ' — ' + Sky.t('off');
  tag.className = 'tag ' + (mode === 'off' ? 'gray' : 'ok');
  btn.textContent = Sky.t(mode === 'off' ? 'aiSetup' : 'change');
  $('#checkBtn').disabled = mode === 'off' || $('#eText').value.trim().length < 50;
}

function openAiSetup() {
  Sky.modal(
    `<h2>${Sky.t('aiKeyTitle')}</h2>
     <p class="lead" style="font-size:13px;margin-top:8px">${Sky.t('aiKeyWhy')}</p>
     <div class="note" style="border-left-color:var(--warn)">${Sky.t('aiKeyPublic')}</div>
     <div class="field" style="margin-top:16px">
       <label>DeepSeek API key</label>
       <input type="password" id="akKey" placeholder="${Sky.t('aiKeyPh')}"
              style="font-family:'JetBrains Mono',monospace;font-size:12.5px" autocomplete="off">
       <span class="help">platform.deepseek.com → API keys</span>
     </div>
     <button class="btn full big" id="akSave" style="margin-top:16px">${Sky.t('aiKeySave')}</button>
     <button class="btn ghost full" id="akDrop" style="margin-top:9px">${Sky.t('aiKeyForget')}</button>`,
    (box, close) => {
      const input = box.querySelector('#akKey');
      if (Sky.aiKey()) input.value = Sky.aiKey();
      box.querySelector('#akDrop').style.display = Sky.aiKey() ? '' : 'none';

      box.querySelector('#akSave').addEventListener('click', () => {
        const v = input.value.trim();
        if (!v) return;
        if (!v.startsWith('sk-')) return Sky.toast(Sky.t('aiKeyOdd'));
        Sky.setAiKey(v);
        Sky.toast(Sky.t('aiKeySaved'));
        close();
        renderAiState();
      });
      box.querySelector('#akDrop').addEventListener('click', () => {
        Sky.setAiKey('');
        Sky.toast(Sky.t('aiKeyGone'));
        close();
        renderAiState();
      });
    }
  );
}

/* ---------- счётчик символов ---------- */
function updateCount() {
  const n = $('#eText').value.length;
  const c = $('#eCount');
  c.textContent = Sky.t('tooLong').replace('%1', n);
  c.classList.toggle('warn', n > MAX_CHARS);
  renderAiState();
}

/* ---------- проверка ---------- */
async function check() {
  const essay = $('#eText').value.trim();
  if (essay.length < 50) { Sky.toast(Sky.t('tooShort'), 4000); return; }

  const t = window.SkyTeachers && SkyTeachers.selected();
  $('#checkBtn').disabled = true;
  $('#working').classList.remove('hidden');

  const res = await Sky.gradeEssay({
    subject: $('#eSubj').value,
    prompt: $('#ePrompt').value.trim().slice(0, 800),
    essay: essay.slice(0, MAX_CHARS),
    teacher: t ? t.id : null
  });

  $('#working').classList.add('hidden');
  renderAiState();

  if (res.error) { Sky.toast(res.error, 6000); return; }

  renderResult(res.result);
  await save(res.result);
  await renderHistory();
}

/* ---------- сохранение ---------- */
async function save(result) {
  const me = Sky.db && Sky.db.me && Sky.db.me();
  if (Sky.db && Sky.db.isCloud && Sky.db.isCloud() && !me) {
    lastSaved = null;
    Sky.toast(Sky.t('saveFail'), 5000);
    return;
  }
  try {
    lastSaved = await Sky.db.insert('essay_checks', {
      student_id: me ? me.id : 'local',
      subject: $('#eSubj').value,
      prompt_text: $('#ePrompt').value.trim().slice(0, 800) || null,
      essay_text: $('#eText').value.trim().slice(0, MAX_CHARS),
      scores: result.scores,
      strengths: result.strengths,
      issues: result.issues,
      feedback: result.overall_feedback || null,
      next_step: result.next_step || null
    });
  } catch (e) { lastSaved = null; }
}

/* ---------- показ разбора ---------- */
function scoreBar(key, labelKey, v) {
  return `<div class="scorerow">
    <span class="lbl">${Sky.t(labelKey)}</span>
    <span class="bar"><i class="s${v}" style="width:${v * 20}%"></i></span>
    <span class="num">${v}</span>
  </div>`;
}

function renderResult(r) {
  $('#resultSection').classList.remove('hidden');
  const s = r.scores || {};
  const strengths = Array.isArray(r.strengths) ? r.strengths : [];
  const issues = Array.isArray(r.issues) ? r.issues : [];

  $('#result').innerHTML =
    `<div class="scorewrap">
       ${scoreBar('relevance','scoreRelevance', s.relevance || 3)}
       ${scoreBar('structure','scoreStructure', s.structure || 3)}
       ${scoreBar('argumentation','scoreArgumentation', s.argumentation || 3)}
       ${scoreBar('language','scoreLanguage', s.language || 3)}
       ${scoreBar('overall_impression','scoreOverall', s.overall_impression || 3)}
     </div>` +
    (r.overall_feedback ? `<p style="font-size:13.5px;line-height:1.65;margin-bottom:16px">${esc(r.overall_feedback)}</p>` : '') +

    (strengths.length ? `<h3 style="margin:18px 0 9px;font-size:14px">${Sky.t('goodH')}</h3>` +
      strengths.map(x => `<div class="good-item">${esc(x)}</div>`).join('') : '') +

    `<h3 style="margin:18px 0 9px;font-size:14px">${Sky.t('errH')}</h3>` +
    (issues.length
      ? issues.map(e => `
          <div class="err-item">
            ${e.quote ? `<div class="frag">${esc(e.quote)}</div>` : ''}
            <div class="why">${esc(e.problem || '')}</div>
            ${e.fix ? `<div class="fix">${Sky.t('fixL')}${esc(e.fix)}</div>` : ''}
          </div>`).join('')
      : `<p class="lead" style="font-size:13px">${Sky.t('noIssues')}</p>`) +

    (r.next_step
      ? `<h3 style="margin:18px 0 9px;font-size:14px">${Sky.t('nextH')}</h3>
         <p style="font-size:13.5px;line-height:1.65">${esc(r.next_step)}</p>` : '');
}

/* ---------- история ---------- */
function avgScore(scores) {
  const s = scores || {};
  const vals = ['relevance','structure','argumentation','language','overall_impression'].map(k => Number(s[k]) || 0);
  const n = vals.filter(Boolean).length || 1;
  return Math.round(vals.reduce((a, b) => a + b, 0) / n * 10) / 10;
}

async function renderHistory() {
  const me = Sky.db && Sky.db.me && Sky.db.me();
  let rows = [];
  try {
    rows = await Sky.db.list('essay_checks', me ? { student_id: me.id } : undefined);
  } catch (e) { rows = []; }

  rows = (rows || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!rows.length) { $('#histSection').classList.add('hidden'); return; }

  $('#histSection').classList.remove('hidden');
  $('#hist').innerHTML = rows.slice(0, 20).map(r => `
    <div class="hist-row">
      <div class="g">${avgScore(r.scores)}</div>
      <div class="txt">
        <b>${esc((r.essay_text || '').slice(0, 70))}</b>
        <span>${esc(new Date(r.created_at).toLocaleString())}</span>
      </div>
    </div>`).join('');
}

/* ---------- события ---------- */
$('#eText').addEventListener('input', updateCount);
$('#checkBtn').addEventListener('click', check);
$('#aiSetupBtn').addEventListener('click', openAiSetup);
document.addEventListener('teacherchange', renderTeacher);
document.addEventListener('langchange', () => { renderTeacher(); renderAiState(); updateCount(); renderHistory(); });

/* ---------- запуск ---------- */
(function start() {
  renderTeacher();
  renderAiState();
  updateCount();
  renderHistory();
})();
</script>
</body>
</html>
