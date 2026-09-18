/* ============================================================
   SkyySchool — трекеры: сон, расписание, питание, курсы.

   Подключается после assets/core.js и до скрипта страницы.

   ГЛАВНОЕ РЕШЕНИЕ: ОДНО ХРАНИЛИЩЕ, А НЕ ВТОРОЕ
   --------------------------------------------
   Сон, расписание, еда и вода уже есть на life.html, и лежат они в
   ключе 'life'. Соблазн сделать trackers.html «с нуля» со своим
   ключом очень велик и очень плох: ученик отметит сон в «Режиме дня»,
   откроет «Трекеры» — и увидит пустой график. Два хранилища одного и
   того же расходятся в первый же день.

   Поэтому здесь нет своего ключа. Есть надстройка над тем же 'life':

     life.sleep[дата]  = { in, out, hours, quality? }   ← quality добавили мы
     life.meals[дата]  = { breakfast:bool, lunch:bool, dinner:bool, snack:bool }
     life.mealNotes[дата] = { breakfast:'овсянка', ... }  ← новое, отдельно
     life.water[дата]  = число стаканов
     life.slots[]      = { id, time, what, done, cat? }  ← cat добавили мы
     life.courses[]    = { id, name, done, total, deadline, note }  ← новое

   Всё добавленное — необязательные поля. life.html читает `!!meals[id]`
   и `slots[].what`, и от появления quality, cat, mealNotes и courses
   ему ни горячо ни холодно. Проверено в браузере: обе страницы видят
   записи друг друга.

   Почему заметки о еде лежат ОТДЕЛЬНО от meals. Логично было бы
   заменить `meals[дата].breakfast = true` на объект с текстом. Но
   life.html переключает этот флаг как `!cur.meals[key][m.id]` — и
   первое же нажатие на life.html затёрло бы текст. Отдельный
   mealNotes развязывает это: галочку владеет life.html, текст — мы.
   ============================================================ */
'use strict';

window.SkyTrack = (function () {

  const KEY = 'life';

  /* Значения по умолчанию совпадают с life.html плюс наши поля. */
  function all() {
    const v = Sky.get(KEY, {});
    return {
      sleep: v.sleep || {},
      meals: v.meals || {},
      mealNotes: v.mealNotes || {},
      water: v.water || {},
      screen: v.screen || {},
      slots: v.slots || [],
      courses: v.courses || [],
      limit: v.limit || 90
    };
  }
  /* Пишем поверх текущего значения, а не вместо него: если life.html
     в другой вкладке что-то добавил, мы это не сотрём. */
  function save(patch) {
    const cur = Sky.get(KEY, {});
    Sky.set(KEY, Object.assign({}, cur, patch));
    document.dispatchEvent(new CustomEvent('lifechange'));
  }

  const dayKey = ts => Sky.dayKey(ts);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

  /* Последние n дней подряд, включая пустые — график без разрывов врёт. */
  function lastDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      out.push({ key: dayKey(d.getTime()), date: d, today: i === 0 });
    }
    return out;
  }


  /* ============================================================
     СОН
     ============================================================ */

  /* Та же формула, что в life.html: лёг вечером, встал утром —
     переход через полночь. Дублируем осознанно: тащить функцию из
     инлайн-скрипта life.html нечем, а две строки арифметики проще
     продублировать, чем выносить ради них общий модуль. */
  function hoursBetween(inT, outT) {
    const [h1, m1] = String(inT).split(':').map(Number);
    const [h2, m2] = String(outT).split(':').map(Number);
    let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (mins <= 0) mins += 24 * 60;
    return mins / 60;
  }

  function fmtHours(h) {
    if (h == null) return '—';
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return Sky.lang === 'en' ? `${hh}h ${mm}m` : `${hh} ч ${mm} мин`;
  }

  const SLEEP_QUALITY = [
    { v:1, ico:'😵', label:{ru:'Разбитый',en:'Wrecked'} },
    { v:2, ico:'🥱', label:{ru:'Не выспался',en:'Under-slept'} },
    { v:3, ico:'😐', label:{ru:'Нормально',en:'Okay'} },
    { v:4, ico:'🙂', label:{ru:'Хорошо',en:'Good'} },
    { v:5, ico:'😃', label:{ru:'Отлично',en:'Great'} }
  ];

  function saveSleep(date, inT, outT, quality) {
    const A = all();
    const prev = A.sleep[date] || {};
    A.sleep[date] = {
      in: inT || prev.in,
      out: outT || prev.out,
      hours: (inT && outT) ? hoursBetween(inT, outT) : prev.hours,
      quality: quality == null ? prev.quality : quality
    };
    save({ sleep: A.sleep });
    return A.sleep[date];
  }
  function sleepOf(date) { return all().sleep[date] || null; }

  function sleepStats(n) {
    const A = all();
    const days = lastDays(n || 30).map(d => {
      const s = A.sleep[d.key];
      return { key:d.key, today:d.today, hours: s && s.hours ? s.hours : 0, quality: s ? s.quality : null };
    });
    const got = days.filter(d => d.hours > 0);
    const q = days.map(d => d.quality).filter(x => typeof x === 'number');
    return {
      days,
      count: got.length,
      avgHours: avg(got.map(d => d.hours)),
      avgQuality: avg(q),
      shortNights: got.filter(d => d.hours < 7).length
    };
  }


  /* ============================================================
     РАСПИСАНИЕ ДНЯ
     ============================================================ */

  /* Категории с цветом. Ключ 'other' — для старых записей из
     life.html, у которых поля cat нет вовсе: без него они бы
     отрисовались бесцветными и выглядели как поломка. */
  const CATEGORIES = [
    { id:'school', ico:'🏫', color:'#2f8dfa', name:{ru:'Школа',en:'School'} },
    { id:'study',  ico:'📚', color:'#8b5cf6', name:{ru:'Учёба',en:'Study'} },
    { id:'sport',  ico:'🏃', color:'#65a30d', name:{ru:'Спорт',en:'Sport'} },
    { id:'rest',   ico:'🎧', color:'#0ea5b7', name:{ru:'Отдых',en:'Rest'} },
    { id:'food',   ico:'🍽', color:'#f59e0b', name:{ru:'Еда',en:'Food'} },
    { id:'other',  ico:'•',  color:'#94a3b8', name:{ru:'Другое',en:'Other'} }
  ];
  const categoryById = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  function slots() {
    return all().slots.slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }
  function addSlot(time, what, cat, mins) {
    const A = all();
    A.slots.push({
      id: 's' + Date.now() + Math.random().toString(36).slice(2, 6),
      time, what: String(what).slice(0, 120), cat: cat || 'other',
      mins: mins || 60, done: false
    });
    save({ slots: A.slots });
    return A.slots;
  }
  function updateSlot(id, patch) {
    const A = all();
    const i = A.slots.findIndex(s => s.id === id);
    if (i < 0) return A.slots;
    A.slots[i] = Object.assign({}, A.slots[i], patch);
    save({ slots: A.slots });
    return A.slots;
  }
  function removeSlot(id) {
    const A = all();
    save({ slots: A.slots.filter(s => s.id !== id) });
  }

  /* Сколько часов в неделю уходит на каждую категорию — для сводки
     под расписанием. Считаем по одному дню и множим на 7 только в
     интерфейсе; здесь отдаём честные минуты за день. */
  function categoryMinutes() {
    const out = {};
    slots().forEach(s => {
      const c = categoryById(s.cat).id;
      out[c] = (out[c] || 0) + (s.mins || 60);
    });
    return out;
  }


  /* ============================================================
     ПИТАНИЕ

     Осознанно НЕ считаем калории и не выносим вердикт «съел больше
     нормы». Причина простая: это подростковая платформа, а сообщение
     «ты сегодня перебрал» — прямая дорога к тому, чтобы ребёнок начал
     считать и бояться еды. Пользы от такого вердикта нет (без веса
     порций любая цифра выдумана), а вреда достаточно.

     Вместо этого считаем РЕГУЛЯРНОСТЬ: сколько приёмов пищи было,
     не пропущен ли завтрак, сколько воды. Именно это и просили в
     разделе «паттерны» («ты часто пропускаешь завтрак») — и именно
     это реально помогает, потому что подсказывает действие.
     ============================================================ */

  const MEALS = [
    { id:'breakfast', ico:'🥣', name:{ru:'Завтрак',en:'Breakfast'} },
    { id:'lunch',     ico:'🍲', name:{ru:'Обед',en:'Lunch'} },
    { id:'dinner',    ico:'🍝', name:{ru:'Ужин',en:'Dinner'} },
    { id:'snack',     ico:'🍎', name:{ru:'Перекус',en:'Snack'} }
  ];

  const WATER_TARGET = 6;   /* стаканов — ориентир из задания */
  const WATER_MAX = 8;      /* столько кнопок рисует life.html; не расходимся */

  function mealsOf(date) { return all().meals[date] || {}; }
  function mealNotesOf(date) { return all().mealNotes[date] || {}; }

  function toggleMeal(date, mealId) {
    const A = all();
    A.meals[date] = A.meals[date] || {};
    A.meals[date][mealId] = !A.meals[date][mealId];
    save({ meals: A.meals });
    return A.meals[date];
  }
  /* Текст «что ел» живёт отдельно и сам по себе ставит галочку:
     если ученик написал, что ел на завтрак, значит завтрак был. */
  function setMealNote(date, mealId, text) {
    const A = all();
    A.mealNotes[date] = A.mealNotes[date] || {};
    const t = String(text || '').trim().slice(0, 200);
    if (t) {
      A.mealNotes[date][mealId] = t;
      A.meals[date] = A.meals[date] || {};
      A.meals[date][mealId] = true;
    } else {
      delete A.mealNotes[date][mealId];
    }
    save({ mealNotes: A.mealNotes, meals: A.meals });
  }

  function waterOf(date) { return all().water[date] || 0; }
  function setWater(date, n) {
    const A = all();
    A.water[date] = Math.max(0, Math.min(WATER_MAX, n));
    save({ water: A.water });
    return A.water[date];
  }


  /* ============================================================
     ЗАКОНОМЕРНОСТИ

     Тот же принцип, что на странице психолога: лучше не сказать
     ничего, чем выдумать. У каждой проверки — минимум дней, у
     сравнений — порог заметности. «Ты часто пропускаешь завтрак» по
     двум дням это не наблюдение, а совпадение.
     ============================================================ */
  const MIN_DAYS = 7;

  function patterns() {
    const A = all();
    const days = lastDays(30);
    /* «День с данными» — тот, где хоть что-то отмечено. Считать
       пропущенным завтрак в день, когда ученик вообще не заходил, —
       нечестно: это пропуск записи, а не пропуск еды. */
    const active = days.filter(d =>
      A.sleep[d.key] || Object.keys(A.meals[d.key] || {}).length || A.water[d.key]);

    const found = [];
    if (active.length < MIN_DAYS) {
      return { enough:false, need: MIN_DAYS - active.length, items: [] };
    }

    /* 1. Пропущенные завтраки */
    const mealDays = active.filter(d => Object.keys(A.meals[d.key] || {}).length);
    if (mealDays.length >= MIN_DAYS) {
      const skipped = mealDays.filter(d => !(A.meals[d.key] || {}).breakfast).length;
      const share = skipped / mealDays.length;
      if (share >= 0.4) {
        found.push({ ico:'🥣', tone:'warn', text:{
          ru:`Ты пропустил(а) завтрак в ${skipped} из ${mealDays.length} дней. Завтрак сильнее всего влияет на то, как идёт первая половина дня в школе — попробуй хотя бы что-то простое.`,
          en:`You skipped breakfast on ${skipped} of ${mealDays.length} days. Breakfast affects the first half of the school day more than anything else — try at least something simple.` } });
      } else if (share === 0 && mealDays.length >= 10) {
        found.push({ ico:'✅', tone:'ok', text:{
          ru:`Завтрак ни разу не пропущен за ${mealDays.length} дней. Это заметно больше, чем кажется.`,
          en:`Not a single breakfast skipped in ${mealDays.length} days. That matters more than it looks.` } });
      }
    }

    /* 2. Мало приёмов пищи */
    if (mealDays.length >= MIN_DAYS) {
      const counts = mealDays.map(d => Object.values(A.meals[d.key] || {}).filter(Boolean).length);
      const m = avg(counts);
      if (m < 2.5) {
        found.push({ ico:'🍽', tone:'warn', text:{
          ru:`В среднем выходит ${m.toFixed(1)} приёма пищи в день. Это мало для растущего организма и для учёбы — от этого и внимание проседает, и настроение.`,
          en:`That averages ${m.toFixed(1)} meals a day. That is low while you are growing and studying — it drags down both attention and mood.` } });
      }
    }

    /* 3. Вода */
    const waterDays = active.filter(d => typeof A.water[d.key] === 'number');
    if (waterDays.length >= MIN_DAYS) {
      const m = avg(waterDays.map(d => A.water[d.key]));
      if (m < WATER_TARGET - 1.5) {
        found.push({ ico:'💧', tone:'warn', text:{
          ru:`Воды в среднем ${m.toFixed(1)} стакана в день при ориентире ${WATER_TARGET}. Самое простое — держать бутылку на столе, где занимаешься.`,
          en:`Water averages ${m.toFixed(1)} glasses a day against a ${WATER_TARGET}-glass guide. The simplest fix is a bottle on the desk where you study.` } });
      }
    }

    /* 4. Сон: недосып */
    const sleepDays = active.filter(d => A.sleep[d.key] && A.sleep[d.key].hours);
    if (sleepDays.length >= MIN_DAYS) {
      const hrs = sleepDays.map(d => A.sleep[d.key].hours);
      const m = avg(hrs);
      if (m < 7) {
        found.push({ ico:'😴', tone:'warn', text:{
          ru:`Средний сон — ${fmtHours(m)}. Для школьника это мало: недосып бьёт по памяти и по вниманию сильнее, чем кажется.`,
          en:`Average sleep is ${fmtHours(m)}. That is low for a student: lack of sleep hits memory and concentration harder than it seems.` } });
      }
      /* 5. Разброс времени отхода ко сну — режим важнее длительности */
      const bedMins = sleepDays.map(d => {
        const [h, mm] = String(A.sleep[d.key].in).split(':').map(Number);
        /* приводим к «минутам от полудня», чтобы 23:30 и 00:30 были рядом */
        let v = h * 60 + mm;
        if (v < 12 * 60) v += 24 * 60;
        return v;
      });
      const bedAvg = avg(bedMins);
      const spread = Math.sqrt(avg(bedMins.map(v => (v - bedAvg) ** 2)));
      if (spread > 75) {
        found.push({ ico:'🕰', tone:'warn', text:{
          ru:`Ты ложишься очень по-разному — разброс больше полутора часов. Организму это тяжелее, чем стабильно поздний отбой: он не успевает подстроиться.`,
          en:`Your bedtime jumps around by more than an hour and a half. That is harder on the body than a consistently late bedtime — it never gets to adjust.` } });
      }
    }

    /* 6. Связь сна и качества */
    const q = active.filter(d => A.sleep[d.key] && A.sleep[d.key].hours && typeof A.sleep[d.key].quality === 'number');
    if (q.length >= MIN_DAYS) {
      const short = q.filter(d => A.sleep[d.key].hours < 7).map(d => A.sleep[d.key].quality);
      const long  = q.filter(d => A.sleep[d.key].hours >= 7).map(d => A.sleep[d.key].quality);
      if (short.length >= 3 && long.length >= 3) {
        const s = avg(short), l = avg(long);
        if (l - s >= 0.6) {
          found.push({ ico:'📊', tone:'info', text:{
            ru:`Когда спишь меньше 7 часов, самочувствие в среднем ${s.toFixed(1)} из 5, когда больше — ${l.toFixed(1)}. Связь видна на твоих же данных.`,
            en:`Under 7 hours you rate your state ${s.toFixed(1)} out of 5; over 7 hours, ${l.toFixed(1)}. The link shows up in your own data.` } });
        }
      }
    }

    return { enough:true, need:0, items:found };
  }


  /* ============================================================
     ПРОГРАММЫ И КУРСЫ
     ============================================================ */

  function courses() { return all().courses.slice(); }

  function addCourse(c) {
    const A = all();
    A.courses.push({
      id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: String(c.name || '').slice(0, 120),
      where: String(c.where || '').slice(0, 80),
      done: Math.max(0, +c.done || 0),
      total: Math.max(1, +c.total || 1),
      deadline: c.deadline || '',
      note: String(c.note || '').slice(0, 300),
      archived: false
    });
    save({ courses: A.courses });
    return A.courses;
  }
  function updateCourse(id, patch) {
    const A = all();
    const i = A.courses.findIndex(c => c.id === id);
    if (i < 0) return A.courses;
    const c = Object.assign({}, A.courses[i], patch);
    c.total = Math.max(1, +c.total || 1);
    c.done = Math.max(0, Math.min(c.total, +c.done || 0));
    A.courses[i] = c;
    save({ courses: A.courses });
    return A.courses;
  }
  function removeCourse(id) {
    const A = all();
    save({ courses: A.courses.filter(c => c.id !== id) });
  }

  const coursePct = c => Sky.pct(c.done, c.total);

  /* Ближайшие дедлайны — для напоминаний. Просроченные не прячем:
     исчезнувший дедлайн выглядит как «успел», а это неправда. */
  function deadlines() {
    return courses()
      .filter(c => c.deadline && !c.archived && c.done < c.total)
      .map(c => Object.assign({ left: Sky.daysLeft(c.deadline) }, c))
      .sort((a, b) => (a.left ?? 9e9) - (b.left ?? 9e9));
  }


  return {
    KEY, all, save, lastDays, fmtHours, hoursBetween,
    /* сон */      SLEEP_QUALITY, saveSleep, sleepOf, sleepStats,
    /* день */     CATEGORIES, categoryById, slots, addSlot, updateSlot, removeSlot, categoryMinutes,
    /* еда */      MEALS, WATER_TARGET, WATER_MAX, mealsOf, mealNotesOf, toggleMeal, setMealNote,
                   waterOf, setWater,
    /* паттерны */ patterns, MIN_DAYS,
    /* курсы */    courses, addCourse, updateCourse, removeCourse, coursePct, deadlines
  };
})();
