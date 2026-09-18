/* ============================================================
   SkyySchool — вкладка «Тело»: данные, потребности, рекомендации.

   Подключается после assets/core.js и assets/trackers.js (чек-лист
   базовых потребностей читает сон, еду и воду из того же хранилища
   'life', что и трекеры — иначе ученику пришлось бы отмечать одно и
   то же дважды).

   ГРАНИЦА, КОТОРУЮ ЗДЕСЬ НЕ ПЕРЕХОДЯТ
   -----------------------------------
   Страница хранит то, что ученик сам о себе записал, и ничего с этим
   не делает. Она не ставит диагнозов, не оценивает вес, не советует
   лекарства и не отменяет назначенные. Рекомендации ниже — только про
   режим: во сколько лечь, сколько выпить воды, не забыть поесть,
   выйти погулять. Всё, что дальше режима, адресуется живому взрослому
   или врачу.

   ПОЧЕМУ ЗДЕСЬ НЕТ ИМТ И ВООБЩЕ ОЦЕНКИ ВЕСА
   -----------------------------------------
   Рост и вес записать можно — это личная карточка, как страница в
   блокноте. Но ни индекса массы тела, ни «нормы», ни зелёно-красной
   шкалы здесь нет и быть не должно.

   Две причины. Первая: у подростков ИМТ не читается так, как у
   взрослых, — его смотрят по центильным таблицам с учётом возраста и
   пола, и одно число без этого просто неверно. Вторая, важнее:
   показать растущему человеку цифру с ярлыком «избыточный вес» —
   один из самых надёжных способов запустить расстройство пищевого
   поведения. Польза от такого ярлыка нулевая (ребёнок не может и не
   должен ничего с ним делать в одиночку), вред — реальный.

   Поэтому вес показывается как след во времени: точки на графике,
   без нормы, без линии, без вердикта. Что это значит — вопрос к
   педиатру на осмотре, а не к веб-странице.
   ============================================================ */
'use strict';

window.SkyBody = (function () {

  const KEYS = {
    profile: 'bodyProfile',   /* рост, болезни, аллергии, лекарства, заметки */
    weights: 'bodyWeights',   /* история веса: [{date, kg}] */
    needs:   'bodyNeeds'      /* ручные отметки по потребностям: {дата:{move:bool,...}} */
  };

  /* ============================================================
     ЛИЧНАЯ КАРТОЧКА
     ============================================================ */
  function profile() {
    return Sky.get(KEYS.profile, {
      height: null,        /* см */
      conditions: '',      /* хронические болезни — свободный текст */
      allergies: '',
      meds: '',            /* что принимает — просто список, без интерпретации */
      notes: ''
    });
  }
  function saveProfile(p) { Sky.set(KEYS.profile, p); return p; }

  function weights() { return Sky.get(KEYS.weights, []); }
  function addWeight(date, kg) {
    const list = weights().filter(w => w.date !== date);
    const v = +kg;
    if (!isNaN(v) && v > 0) list.push({ date, kg: Math.round(v * 10) / 10 });
    list.sort((a, b) => a.date.localeCompare(b.date));
    Sky.set(KEYS.weights, list.slice(-200));
    return list;
  }
  function removeWeight(date) {
    Sky.set(KEYS.weights, weights().filter(w => w.date !== date));
    return weights();
  }
  const lastWeight = () => { const w = weights(); return w.length ? w[w.length - 1] : null; };


  /* ============================================================
     БАЗОВЫЕ ПОТРЕБНОСТИ

     Четыре пункта из задания. Три из них уже отмечаются в трекерах и
     на life.html — сон, еда, вода. Спрашивать их здесь ещё раз
     означало бы заставить ученика вести один и тот же дневник дважды,
     поэтому они считаются автоматически из общего хранилища 'life'.
     Вручную отмечается только движение: его пока нигде не трекают.
     ============================================================ */
  const TARGETS = {
    sleepHours: 8,
    meals: 3,
    water: 6,
    moveMinutes: 30
  };

  const NEEDS = [
    { id:'sleep', ico:'😴', auto:true,
      label:{ru:'Поспал(а) 8 часов',en:'Slept 8 hours'} },
    { id:'meals', ico:'🍽', auto:true,
      label:{ru:'Поел(а) 3 раза',en:'Ate 3 times'} },
    { id:'water', ico:'💧', auto:true,
      label:{ru:'Выпил(а) 6 стаканов воды',en:'Drank 6 glasses of water'} },
    { id:'move',  ico:'🚶', auto:false,
      label:{ru:'Погулял(а) 30 минут',en:'Walked for 30 minutes'} }
  ];

  function manualNeeds() { return Sky.get(KEYS.needs, {}); }
  function setMove(date, on) {
    const m = manualNeeds();
    m[date] = m[date] || {};
    m[date].move = !!on;
    Sky.set(KEYS.needs, m);
    return m;
  }

  /* Состояние всех четырёх потребностей за конкретный день.
     Возвращает и факт (выполнено/нет), и сырое значение — чтобы в
     интерфейсе можно было написать «6 ч из 8», а не просто крестик:
     крестик без числа выглядит как приговор, а число — как факт. */
  function needsOf(date) {
    const T = window.SkyTrack;
    const sleep = T ? T.sleepOf(date) : null;
    const meals = T ? T.mealsOf(date) : {};
    const water = T ? T.waterOf(date) : 0;
    const move  = !!(manualNeeds()[date] || {}).move;

    const mealCount = Object.values(meals).filter(Boolean).length;
    const hours = sleep && sleep.hours ? sleep.hours : 0;

    return {
      sleep: { ok: hours >= TARGETS.sleepHours, value: hours, target: TARGETS.sleepHours },
      meals: { ok: mealCount >= TARGETS.meals,  value: mealCount, target: TARGETS.meals },
      water: { ok: water >= TARGETS.water,      value: water, target: TARGETS.water },
      move:  { ok: move, value: move ? TARGETS.moveMinutes : 0, target: TARGETS.moveMinutes }
    };
  }

  /* Доля удовлетворённых потребностей. Считаем частично: 6 часов сна
     из 8 — это 75%, а не ноль. Полоса, которая стоит на нуле, пока не
     выполнено всё целиком, не мотивирует, а обесценивает. */
  function satisfaction(date) {
    const n = needsOf(date);
    const parts = [
      Math.min(1, n.sleep.value / n.sleep.target),
      Math.min(1, n.meals.value / n.meals.target),
      Math.min(1, n.water.value / n.water.target),
      n.move.ok ? 1 : 0
    ];
    return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length * 100);
  }


  /* ============================================================
     РЕКОМЕНДАЦИИ

     Только про режим. Никаких лекарств, добавок, диет и трактовок
     симптомов — ни при каких данных. Каждая проверка требует
     несколько дней подряд: совет по одному плохому дню — это шум, и
     доверие к странице он тратит зря.

     Формулировки конкретные и выполнимые сегодня («лечь в 23:00»),
     потому что «высыпайся» — не совет, а пожелание.
     ============================================================ */
  const MIN_DAYS = 3;

  function recommendations() {
    const T = window.SkyTrack;
    if (!T) return { enough:false, need:MIN_DAYS, items:[] };

    const days = T.lastDays(14);
    const A = T.all();
    const out = [];

    /* дни, где вообще что-то отмечено */
    const active = days.filter(d =>
      A.sleep[d.key] || Object.keys(A.meals[d.key] || {}).length || A.water[d.key]);
    if (active.length < MIN_DAYS) {
      return { enough:false, need: MIN_DAYS - active.length, items: [] };
    }

    /* --- сон: несколько коротких ночей подряд --- */
    const recent = days.slice(-5).map(d => A.sleep[d.key]).filter(s => s && s.hours);
    const shortRun = (() => {
      let run = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        const s = A.sleep[days[i].key];
        if (!s || !s.hours) continue;
        if (s.hours < 7) run++; else break;
      }
      return run;
    })();

    if (shortRun >= 3) {
      /* Считаем, во сколько лечь, чтобы выспаться к обычному подъёму. */
      const wakes = recent.filter(s => s.out).map(s => s.out);
      let advice = '23:00';
      if (wakes.length) {
        const mins = wakes.map(w => { const [h, m] = w.split(':').map(Number); return h * 60 + m; });
        const wake = mins.reduce((a, b) => a + b, 0) / mins.length;
        let bed = wake - TARGETS.sleepHours * 60;
        if (bed < 0) bed += 24 * 60;
        const bh = Math.floor(bed / 60) % 24, bm = Math.round(bed % 60 / 5) * 5;
        advice = String(bh).padStart(2, '0') + ':' + String(bm % 60).padStart(2, '0');
      }
      out.push({ ico:'😴', tone:'warn', text:{
        ru:`Ты плохо спишь ${Sky.plural(shortRun, 'день', 'дня', 'дней')} подряд. Чтобы высыпаться к своему обычному подъёму, ложиться нужно около ${advice} — попробуй хотя бы сегодня.`,
        en:`You have slept poorly ${shortRun} days in a row. To get enough sleep before your usual wake-up you would need to go to bed around ${advice} — try it at least tonight.` } });
    }

    /* --- нерегулярная еда --- */
    const mealDays = active.slice(-7).filter(d => Object.keys(A.meals[d.key] || {}).length);
    if (mealDays.length >= MIN_DAYS) {
      const skipped = mealDays.filter(d => !(A.meals[d.key] || {}).breakfast).length;
      if (skipped >= Math.ceil(mealDays.length / 2)) {
        out.push({ ico:'🥣', tone:'warn', text:{
          ru:'Завтрак пропускается чаще, чем случается. Если утром не лезет — возьми что-нибудь с собой и съешь на первой перемене, это работает лучше, чем ничего.',
          en:'Breakfast gets skipped more often than not. If you cannot eat in the morning, take something with you and eat it at the first break — that works better than nothing.' } });
      }
      const low = mealDays.filter(d => Object.values(A.meals[d.key] || {}).filter(Boolean).length < 3).length;
      if (low >= Math.ceil(mealDays.length * 0.6)) {
        out.push({ ico:'🍽', tone:'warn', text:{
          ru:'Чаще всего выходит меньше трёх приёмов пищи в день. Проще всего добавить не «правильный обед», а один предсказуемый перекус в одно и то же время.',
          en:'Most days come out below three meals. The easiest fix is not a "proper lunch" but one predictable snack at the same time each day.' } });
      }
    }

    /* --- вода --- */
    const waterDays = active.slice(-7).filter(d => typeof A.water[d.key] === 'number');
    if (waterDays.length >= MIN_DAYS) {
      const m = waterDays.reduce((s, d) => s + A.water[d.key], 0) / waterDays.length;
      if (m < TARGETS.water - 1.5) {
        out.push({ ico:'💧', tone:'info', text:{
          ru:`Воды выходит около ${m.toFixed(1)} стакана в день. Поставь бутылку туда, где делаешь уроки, — это надёжнее, чем напоминания.`,
          en:`Water comes to about ${m.toFixed(1)} glasses a day. Put a bottle where you do your homework — that beats reminders.` } });
      }
    }

    /* --- движение --- */
    const manual = manualNeeds();
    const moveDays = days.slice(-7).filter(d => (manual[d.key] || {}).move).length;
    if (moveDays <= 2) {
      out.push({ ico:'🚶', tone:'info', text:{
        ru:`За неделю отмечено ${Sky.plural(moveDays, 'день', 'дня', 'дней')} с прогулкой. Полчаса на улице между уроками и домашкой разгружают голову лучше, чем полчаса лежания в телефоне.`,
        en:`Only ${moveDays} days with a walk this week. Half an hour outside between lessons and homework clears your head better than half an hour on your phone.` } });
    }

    /* --- всё хорошо --- */
    if (!out.length) {
      out.push({ ico:'👌', tone:'ok', text:{
        ru:'По режиму сейчас всё ровно: сон, еда и вода держатся в норме. Отдельно это незаметно, но именно на этом держится всё остальное.',
        en:'Your routine is steady right now: sleep, food and water are all holding. It goes unnoticed, but everything else rests on it.' } });
    }

    return { enough:true, need:0, items:out };
  }

  /* Ссылка на страницу психолога показывается, только если дело не в
     режиме: режим ровный, а самочувствие всё равно низкое. Иначе это
     навязчиво. */
  function suggestPsychologist() {
    const T = window.SkyTrack;
    if (!T) return false;
    const st = T.sleepStats(14);
    return st.count >= 5 && st.avgQuality != null && st.avgQuality <= 2.2 &&
           st.avgHours != null && st.avgHours >= 7;
  }

  function wipe() { Object.keys(KEYS).forEach(k => Sky.del(KEYS[k])); }

  return {
    KEYS, TARGETS, NEEDS,
    profile, saveProfile,
    weights, addWeight, removeWeight, lastWeight,
    manualNeeds, setMove, needsOf, satisfaction,
    recommendations, suggestPsychologist, MIN_DAYS, wipe
  };
})();
