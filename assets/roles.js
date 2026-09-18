/* ============================================================
   SkyySchool — общая логика для ролевых вкладок
   (classroom.html — классный руководитель,
    headteacher.html — завуч,
    pe.html — физрук)

   Подключается после assets/core.js (используется Sky.get/set,
   Sky.t/L, Sky.daysLeft, Sky.plural и т.д.) и до собственного
   скрипта каждой страницы.

   Про Supabase: сейчас все данные ролей лежат только в localStorage
   (через Sky.get/set — как и весь остальной прогресс на сайте).
   Функция pushRole() ниже — это точка расширения: как только в
   assets/db.js появится метод Sky.db.pushRole(), записи ролей
   начнут сами уходить в облако, и страницы classroom/headteacher/pe
   менять не придётся — они уже вызывают pushRole() при каждом
   сохранении. Пока Sky.db.pushRole нет, это просто no-op.
   ============================================================ */
'use strict';

window.SkyRoles = (function () {

  /* ---------- ключи в localStorage (через Sky.get/set, префикс sky_ добавляется автоматически) ---------- */
  const KEYS = {
    classroom: 'roleClassroom',   /* анкета классного руководителя */
    absences:  'roleAbsences',    /* список отметок о пропусках (завуч) */
    workouts:  'rolePeWorkouts',  /* журнал тренировок (физрук) */
    peProfile: 'rolePeProfile'    /* возраст и настройки страницы физрука */
  };

  /* ---------- предметы школьной программы ----------
     Те же id, что и в data/bank-*.js (совпадают с ключами window.BANKS),
     чтобы ссылки вида trainer.html?subject=<id> вели на нужный банк.
     Иконку и название дублируем как константы, а не грузим сами банки:
     это десятки и сотни килобайт JSON ради эмодзи и подписи в чекбоксе. */
  const SUBJECTS = [
    { id:'math',        icon:'∑',  name:{ru:'Математика',en:'Mathematics'} },
    { id:'informatics',  icon:'⌨',  name:{ru:'Информатика',en:'Computer science'} },
    { id:'russian',      icon:'Я',  name:{ru:'Русский язык',en:'Russian language'} },
    { id:'physics',      icon:'⚛',  name:{ru:'Физика',en:'Physics'} },
    { id:'biology',      icon:'🧬', name:{ru:'Биология',en:'Biology'} },
    { id:'chemistry',    icon:'⚗',  name:{ru:'Химия',en:'Chemistry'} },
    { id:'geography',    icon:'🌍', name:{ru:'География',en:'Geography'} },
    { id:'social',       icon:'🏛', name:{ru:'Обществознание',en:'Social studies'} },
    { id:'history',      icon:'📜', name:{ru:'История',en:'History'} },
    { id:'english',      icon:'🇬🇧', name:{ru:'Английский',en:'English'} },
    { id:'polish',       icon:'🇵🇱', name:{ru:'Польский',en:'Polish'} },
    { id:'spanish',      icon:'🇪🇸', name:{ru:'Испанский',en:'Spanish'} },
    { id:'german',       icon:'🇩🇪', name:{ru:'Немецкий',en:'German'} }
  ];
  const subjectById = id => SUBJECTS.find(s => s.id === id) || null;

  /* ---------- будущий Supabase ---------- */
  function pushRole(table, payload) {
    try {
      if (window.Sky && Sky.db && typeof Sky.db.pushRole === 'function') {
        Sky.db.pushRole(table, payload).catch(() => {});
      }
    } catch (e) { /* офлайн или Sky.db ещё не готов — не страшно, данные уже в localStorage */ }
  }

  /* ---------- анкета классного руководителя ---------- */
  function getClassroom() { return Sky.get(KEYS.classroom, null); }
  function saveClassroom(profile) {
    Sky.set(KEYS.classroom, profile);
    pushRole('classroom_profiles', profile);
    return profile;
  }

  /* Имя и класс ученика — читают headteacher.html и pe.html, чтобы не
     спрашивать их ещё раз, если анкета classroom.html уже заполнена. */
  function studentName() { const p = getClassroom(); return p && p.name ? p.name : null; }
  function studentClass() { const p = getClassroom(); return p && p.className ? p.className : null; }

  /* Возраст по классу — грубая, но обычная для российской школы
     оценка (1 класс ≈ 7-8 лет, поэтому +6 к номеру класса). Только
     чтобы заранее выставить разумное значение в форме pe.html —
     пользователь всегда может поправить. */
  function guessAgeFromClass(className) {
    const m = String(className || '').match(/\d+/);
    if (!m) return null;
    const n = +m[0];
    if (n < 1 || n > 11) return null;
    return n + 6;
  }

  /* ---------- пропуски уроков (завуч) ---------- */
  function getAbsences() { return Sky.get(KEYS.absences, []); }
  function addAbsence(rec) {
    const list = getAbsences();
    list.push(rec);
    Sky.set(KEYS.absences, list);
    pushRole('absences', rec);
    return list;
  }
  function removeAbsence(index) {
    const list = getAbsences();
    list.splice(index, 1);
    Sky.set(KEYS.absences, list);
    return list;
  }
  function absencesBySubject() {
    const out = {};
    getAbsences().forEach(a => { out[a.subject] = (out[a.subject] || 0) + 1; });
    return out;
  }

  /* Фразы, которыми завуч «ругает» за пропуски — по нарастающей
     строгости в зависимости от того, сколько уроков предмета уже
     пропущено. %1 — предмет, %2 — число пропусков. */
  const SCOLD_PHRASES = [
    { min:1, text:{ru:'Пропустил урок «%1». Бывает — главное не превращать это в привычку.',
                    en:'You missed a "%1" class. It happens — just do not make it a habit.'} },
    { min:2, text:{ru:'Уже %2 пропуска по предмету «%1». Стоит наверстать, пока разрыв небольшой.',
                    en:'That is %2 missed classes in "%1" already. Better catch up while the gap is still small.'} },
    { min:3, text:{ru:'Ты пропустил %2 урок(а/ов) «%1». Догони! Открой тренажёр и закрой пробел, пока он не вырос.',
                    en:'You have missed %2 classes of "%1". Catch up! Open the trainer and close the gap before it grows.'} }
  ];
  function scoldPhrase(subjectName, count) {
    let tier = SCOLD_PHRASES[0];
    SCOLD_PHRASES.forEach(t => { if (count >= t.min) tier = t; });
    return Sky.L(tier.text).replace('%1', subjectName).replace('%2', count);
  }

  /* ---------- журнал тренировок (физрук) ---------- */
  function getPeProfile() { return Sky.get(KEYS.peProfile, { age: null }); }
  function savePeProfile(p) { Sky.set(KEYS.peProfile, p); pushRole('pe_profiles', p); return p; }

  function getWorkouts() { return Sky.get(KEYS.workouts, []); }
  function addWorkout(rec) {
    const list = getWorkouts();
    list.push(rec);
    Sky.set(KEYS.workouts, list);
    pushRole('pe_workouts', rec);
    return list;
  }
  function removeWorkout(index) {
    const list = getWorkouts();
    list.splice(index, 1);
    Sky.set(KEYS.workouts, list);
    return list;
  }

  /* Нормативы по возрасту — ориентировочные средние показатели для
     мотивации и самопроверки, а не официальные нормативы ГТО или
     школьной программы (там разбивка ещё и по полу, и по ступеням
     подготовки). Отжимания и пресс — раз в минуту, бег — 60 метров
     (для группы 16–18 лет ориентир — бег на 1000 м, там спринт уже
     не так показателен). */
  const PE_STANDARDS = [
    { id:'7-10',  label:{ru:'7–10 лет',en:'Ages 7–10'},   pushups:8,  situps:20, run:{label:{ru:'бег 60 м',en:'60 m run'}, value:'12.0 с' } },
    { id:'11-13', label:{ru:'11–13 лет',en:'Ages 11–13'}, pushups:15, situps:30, run:{label:{ru:'бег 60 м',en:'60 m run'}, value:'10.5 с' } },
    { id:'14-15', label:{ru:'14–15 лет',en:'Ages 14–15'}, pushups:20, situps:40, run:{label:{ru:'бег 60 м',en:'60 m run'}, value:'9.8 с' } },
    { id:'16-18', label:{ru:'16–18 лет',en:'Ages 16–18'}, pushups:25, situps:45, run:{label:{ru:'бег 1000 м',en:'1000 m run'}, value:'4:30' } }
  ];
  function standardForAge(age) {
    if (age == null) return PE_STANDARDS[1];
    if (age <= 10) return PE_STANDARDS[0];
    if (age <= 13) return PE_STANDARDS[1];
    if (age <= 15) return PE_STANDARDS[2];
    return PE_STANDARDS[3];
  }

  /* «Советы физрука» — короткие мотивационные фразы, показываются по
     одной с кнопкой «Другой совет». */
  const PE_TIPS = [
    {ru:'Лучше 10 отжиманий каждый день, чем 100 раз в год.',en:'Ten push-ups every day beat a hundred once a year.'},
    {ru:'Разминка — не формальность, а страховка от травм.',en:'Warming up is not a formality — it is insurance against injury.'},
    {ru:'Сравнивай себя с собой месяц назад, а не с чемпионом по телевизору.',en:'Compare yourself to who you were a month ago, not to the champion on TV.'},
    {ru:'Дыхание при отжиманиях: вниз — вдох, вверх — выдох.',en:'Breathing on push-ups: down — inhale, up — exhale.'},
    {ru:'Пропустил тренировку — не беда. Пропустил две подряд — уже привычка. Не давай ей сложиться.',en:'Missing one workout is fine. Missing two in a row is a habit forming — do not let it.'},
    {ru:'Сила растёт не во время тренировки, а во время отдыха после неё. Высыпайся.',en:'Strength grows during rest, not during the workout itself. Sleep enough.'},
    {ru:'Стакан воды до тренировки и после — простое правило, которое почти никто не соблюдает.',en:'A glass of water before and after training — a simple rule almost nobody follows.'},
    {ru:'Результат в беге на 60 метров почти целиком решает техника низкого старта. Потренируй отдельно её.',en:'A 60 m sprint result comes mostly from start technique. Practise the start on its own.'}
  ];
  function randomTip() { return Sky.L(PE_TIPS[Math.floor(Math.random() * PE_TIPS.length)]); }

  /* ---------- достижения (медали) ----------
     Считаем по общему числу записанных тренировок — это самая
     честная метрика регулярности, которую физрук может видеть. */
  const MEDALS = [
    { count:5,  emoji:'🥉', label:{ru:'Бронза — 5 тренировок',en:'Bronze — 5 workouts'} },
    { count:15, emoji:'🥈', label:{ru:'Серебро — 15 тренировок',en:'Silver — 15 workouts'} },
    { count:30, emoji:'🥇', label:{ru:'Золото — 30 тренировок',en:'Gold — 30 workouts'} },
    { count:50, emoji:'🏆', label:{ru:'Кубок — 50 тренировок',en:'Trophy — 50 workouts'} }
  ];
  function medalsState(totalWorkouts) {
    return MEDALS.map(m => Object.assign({ unlocked: totalWorkouts >= m.count }, m));
  }
  function levelFor(totalWorkouts) { return Math.floor(totalWorkouts / 5) + 1; }

  /* ---------- мелкий общий помощник: полоса прогресса ---------- */
  function progressBarHtml(pct) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    return `<div class="progress"><i style="width:${p}%"></i></div>`;
  }

  return {
    KEYS, SUBJECTS, subjectById, pushRole,
    getClassroom, saveClassroom, studentName, studentClass, guessAgeFromClass,
    getAbsences, addAbsence, removeAbsence, absencesBySubject, scoldPhrase,
    getPeProfile, savePeProfile, getWorkouts, addWorkout, removeWorkout,
    PE_STANDARDS, standardForAge, randomTip, MEDALS, medalsState, levelFor,
    progressBarHtml
  };
})();
