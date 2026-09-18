/* ============================================================
   Выбор AI-учителя и сборка промпта.

   Vanilla-аналог хука useSelectedTeacher: выбор хранится в
   localStorage (работает всегда, в том числе офлайн и без аккаунта),
   а при подключённом Supabase дополнительно пишется в профиль —
   чтобы на другом устройстве встретил тот же учитель.

   Порядок именно такой: сначала локально, потом в облако. Наоборот
   было бы хуже — выбор учителя не должен ждать сети и не должен
   пропадать, если сети нет.
   ============================================================ */
window.SkyTeachers = (function () {
  'use strict';

  const KEY = 'aiTeacher';
  const DEFAULT_ID = 'kind-max';

  const LOCAL = window.AI_TEACHERS || [];

  /* Учителя из базы: пользовательские пресеты и рейтинги. В локальном
     режиме их просто нет, и это нормально — шесть базовых лежат в файле. */
  let cloudCache = null;

  function local() { return LOCAL.slice(); }

  async function all() {
    if (!Sky.db || !Sky.db.isCloud || !Sky.db.isCloud()) return local();
    if (cloudCache) return LOCAL.concat(cloudCache);
    try {
      const rows = await Sky.db.list('teachers_ai');
      /* Базовых шестерых миграция кладёт и в базу — чтобы отзывам было
         на что ссылаться. Из облака берём только то, чего нет локально,
         иначе каждый из них появится в каталоге дважды. */
      const localIds = new Set(LOCAL.map(t => t.id));
      cloudCache = (rows || [])
        .filter(r => !localIds.has(r.id))
        .map(fromRow);
      return LOCAL.concat(cloudCache);
    } catch (e) {
      return local();
    }
  }

  /* Строка базы → объект учителя того же вида, что в data/ai-teachers.js */
  function fromRow(r) {
    return {
      id: r.id,
      emoji: r.emoji || '🧑‍🏫',
      name: { ru: r.name, en: r.name },
      role: r.role || 'friend',
      subject: r.subject || null,
      strictness: r.strictness || 3,
      languages: r.languages || ['ru'],
      goals: r.goals || [],
      style: { ru: r.style_note || '', en: r.style_note || '' },
      prompt: { ru: r.style_prompt || '', en: r.style_prompt || '' },
      rating: { avg: r.rating_avg || 0, count: r.rating_count || 0 },
      premium: r.premium === true,
      custom: true
    };
  }

  function get(id) {
    return LOCAL.find(t => t.id === id)
        || (cloudCache || []).find(t => t.id === id)
        || null;
  }

  function selectedId() { return Sky.get(KEY, DEFAULT_ID); }

  function selected() { return get(selectedId()) || get(DEFAULT_ID) || LOCAL[0] || null; }

  async function select(id) {
    const t = get(id);
    if (!t) return false;
    /* Премиум-учителя ещё не открыты — выбор не проходит.
       Проверка именно здесь, а не только в интерфейсе: карточку можно
       нажать программно, а страница teachers.html не единственная,
       откуда вызывают select(). */
    if (!canUse(t)) return false;
    Sky.set(KEY, id);
    document.dispatchEvent(new CustomEvent('teacherchange', { detail: { id } }));

    /* В облаке — ещё и в профиль, чтобы выбор переехал на другое
       устройство. Молча: неудача синхронизации не должна мешать
       заниматься. */
    try {
      if (Sky.db && Sky.db.isCloud && Sky.db.isCloud()) {
        const me = Sky.db.me && Sky.db.me();
        if (me && me.id) await Sky.db.update('profiles', me.id, { ai_teacher: id });
      }
    } catch (e) { /* не мешаем занятию */ }
    return true;
  }

  /* Подтянуть выбор из профиля (при входе с другого устройства).
     Локальный выбор имеет приоритет только если в профиле пусто. */
  async function syncFromProfile() {
    try {
      if (!Sky.db || !Sky.db.isCloud || !Sky.db.isCloud()) return;
      const me = Sky.db.me && Sky.db.me();
      if (me && me.ai_teacher && get(me.ai_teacher)) {
        Sky.set(KEY, me.ai_teacher);
        document.dispatchEvent(new CustomEvent('teacherchange', { detail: { id: me.ai_teacher } }));
      }
    } catch (e) { /* не мешаем занятию */ }
  }


  /* ---------- строгость ----------
     Одно число управляет и тоном разбора, и будущей оценкой за
     домашку по фото. Держим формулировки здесь, чтобы у разбора и у
     оценки была одна шкала, а не две разные. */
  const STRICT = {
    1: { ru: 'Прощай мелкие ошибки и описки. Оценку занижай только за непонимание сути. Больше отмечай то, что получилось.',
         en: 'Forgive small slips and typos. Lower the mark only for misunderstanding the substance. Point out what worked.' },
    2: { ru: 'Мелкие неточности отмечай, но оценку за них не снижай. Главное — понял ли ученик суть.',
         en: 'Note small inaccuracies but do not lower the mark for them. What matters is whether the student got the idea.' },
    3: { ru: 'Обычная школьная мерка: считай и содержание, и оформление, без придирок и без поблажек.',
         en: 'Ordinary school standard: count both content and presentation, without nitpicking and without leniency.' },
    4: { ru: 'Снижай за неточные формулировки и пропущенные обоснования, даже если итоговый ответ верный.',
         en: 'Lower the mark for imprecise wording and missing justification, even when the final answer is right.' },
    5: { ru: 'Меряй по экзаменационной строгости: любая неточность формулировки, пропущенный шаг или необоснованный переход стоят балла.',
         en: 'Mark at exam strictness: any imprecise wording, skipped step or unjustified transition costs a mark.' }
  };

  function strictnessNote(n, lang) {
    const s = STRICT[Math.min(5, Math.max(1, n || 3))];
    return s ? s[lang === 'en' ? 'en' : 'ru'] : '';
  }

  function strictnessLabel(n) {
    return '●'.repeat(Math.min(5, Math.max(1, n || 3))) + '○'.repeat(5 - Math.min(5, Math.max(1, n || 3)));
  }

  /* ---------- системный промпт ----------
     Собирается из промпта учителя и указания про строгость.
     Используется в режиме «свой ключ», когда браузер ходит в DeepSeek
     напрямую. В режиме Worker на сервер уходит только ID учителя —
     см. комментарий в worker/worker.js, там объяснено почему. */
  function systemPrompt(teacher, lang) {
    const t = teacher || selected();
    if (!t) return '';
    const l = lang === 'en' ? 'en' : 'ru';
    const base = (t.prompt && (t.prompt[l] || t.prompt.ru)) || '';
    const note = strictnessNote(t.strictness, l);
    return note ? base + '\n\n' + note : base;
  }


  /* ============================================================
     ОТЗЫВЫ И РЕЙТИНГ

     Раньше оценка работала только при подключённом Supabase: без
     аккаунта кнопка «Оценить» отвечала «нужна база». Это противоречит
     первому правилу этого файла (см. шапку): сначала локально, потом
     в облако. Ученик, который занимается офлайн, тоже имеет право
     сказать, что разбор был бестолковый, — и увидеть свою оценку.

     Поэтому теперь так:
       • отзыв ВСЕГДА пишется в localStorage;
       • если есть облако и аккаунт — дополнительно уходит туда;
       • средняя по учителю считается из облака, если оно есть
         (там видно всех), иначе из локальных отзывов.

     Отзыв привязан к УРОКУ, а не только к учителю: один и тот же
     Сократ может блестяще объяснить теорему и бездарно — причастный
     оборот. Оценка «за всё сразу» такую разницу стирает, а оценка за
     конкретный разбор — нет.
     ============================================================ */

  const REVIEWS_KEY = 'teacherReviews';

  /* Один отзыв на пару (учитель, урок). Повторная оценка того же
     урока заменяет предыдущую, а не добавляет вторую: иначе один
     ученик, нажав пять раз, поднимет учителю рейтинг на ровном месте. */
  function reviews() { return Sky.get(REVIEWS_KEY, []); }

  function reviewKey(teacherId, lessonId) {
    return teacherId + '::' + (lessonId || 'general');
  }

  /* lesson — необязательный объект:
       { id, kind, subject, title }
     id      — идентификатор урока/разбора (например, id задания),
     kind    — 'task' | 'explain' | 'photo' | 'chess' | 'general',
     subject — предмет, чтобы потом можно было посмотреть, кто
               лучше объясняет математику, а кто историю. */
  async function rate(teacherId, stars, comment, lesson) {
    if (!get(teacherId)) return { error: 'unknown teacher' };
    const n = Math.max(1, Math.min(5, Math.round(+stars || 0)));
    if (!n) return { error: 'bad rating' };

    lesson = lesson || {};
    const key = reviewKey(teacherId, lesson.id);
    const rec = {
      key,
      teacherId,
      lessonId: lesson.id || null,
      lessonKind: lesson.kind || 'general',
      subject: lesson.subject || null,
      title: lesson.title || null,
      stars: n,
      comment: (comment || '').trim().slice(0, 500) || null,
      ts: Date.now(),
      date: Sky.dayKey()
    };

    /* 1. Локально — всегда и первым делом. */
    const all = reviews().filter(r => r.key !== key);
    all.push(rec);
    Sky.set(REVIEWS_KEY, all.slice(-300));
    document.dispatchEvent(new CustomEvent('teacherrated', { detail: rec }));

    /* 2. В облако — если получится. Неудача не отменяет отзыв. */
    try {
      if (Sky.db && Sky.db.isCloud && Sky.db.isCloud()) {
        const me = Sky.db.me && Sky.db.me();
        if (me && me.id) {
          const stored = await Sky.db.list('teacher_reviews', { teacher_id: teacherId, user_id: me.id });
          if (stored && stored.length) {
            await Sky.db.update('teacher_reviews', stored[0].id, { rating: n, comment: rec.comment });
          } else {
            await Sky.db.insert('teacher_reviews', {
              teacher_id: teacherId, user_id: me.id, rating: n, comment: rec.comment
            });
          }
          cloudCache = null; /* среднее пересчитал триггер — перечитаем */
        }
      }
    } catch (e) { /* остаёмся с локальным отзывом, это не ошибка для ученика */ }

    return { ok: true, local: true };
  }

  /* Мой отзыв на конкретный урок (чтобы показать уже выставленные
     звёзды, а не пустую форму). */
  function myReview(teacherId, lessonId) {
    return reviews().find(r => r.key === reviewKey(teacherId, lessonId)) || null;
  }
  function reviewsFor(teacherId) { return reviews().filter(r => r.teacherId === teacherId); }

  /* Средние по локальным отзывам. */
  function localRatings() {
    const acc = {};
    reviews().forEach(r => {
      const a = acc[r.teacherId] = acc[r.teacherId] || { sum: 0, count: 0 };
      a.sum += r.stars; a.count++;
    });
    const out = {};
    Object.keys(acc).forEach(id => {
      out[id] = { avg: acc[id].sum / acc[id].count, count: acc[id].count, local: true };
    });
    return out;
  }

  /* Облако видит отзывы всех учеников, localStorage — только свои.
     Поэтому если облако есть, оно главнее; локальные средние остаются
     как запасной вариант для тех, кого в облаке ещё нет. */
  async function ratings() {
    const localOnes = localRatings();
    if (!Sky.db || !Sky.db.isCloud || !Sky.db.isCloud()) return localOnes;
    try {
      const rows = await Sky.db.list('teachers_ai');
      const out = Object.assign({}, localOnes);
      for (const r of rows || []) {
        if (r.rating_count) out[r.id] = { avg: r.rating_avg || 0, count: r.rating_count || 0 };
      }
      return out;
    } catch (e) { return localOnes; }
  }

  /* ---------- топ учителей ----------
     Наивный «сортируем по средней» врёт: учитель с одной пятёркой
     обгонит учителя с 4,8 по полусотне отзывов.

     Здесь две защиты, и нужны обе.

     1. ПОРОГ ДОПУСКА. Учитель попадает в топ только начиная с
        MIN_REVIEWS отзывов. Без этого никакая математика не
        спасает: оценки учителей жмутся к верху шкалы (все в
        диапазоне 4,5–5,0), общее среднее выходит высоким, и
        сглаживание почти не наказывает единственную пятёрку —
        проверено, учитель с одним отзывом всё равно оказывался
        первым. Порог решает это честно: про учителя с одним
        отзывом мы просто ещё ничего не знаем.

     2. ВЗВЕШЕННАЯ ОЦЕНКА среди допущенных (приём из кинорейтингов):
          score = (v/(v+m))·R + (m/(v+m))·C
        v — число отзывов, R — средняя учителя, m — вес доверия,
        C — средняя по всем оценённым. Она разводит тех, кто порог
        уже прошёл: 4,9 по тридцати отзывам надёжнее, чем 5,0 по
        трём.

     Если допущенных меньше трёх — показываем сколько есть. Пустой
     топ честнее выдуманного. */
  const MIN_REVIEWS = 3;
  const TRUST_M = 3;

  function top(ratingsMap, n) {
    const map = ratingsMap || {};
    /* среднее по всем оценённым — считаем ДО отсева, иначе
       ориентир поедет вверх вместе с отсевом */
    const rated = Object.keys(map).filter(id => map[id] && map[id].count > 0 && get(id));
    if (!rated.length) return [];

    let sum = 0, cnt = 0;
    rated.forEach(id => { sum += map[id].avg * map[id].count; cnt += map[id].count; });
    const C = cnt ? sum / cnt : 0;

    return rated
      .filter(id => map[id].count >= MIN_REVIEWS)
      .map(id => {
        const { avg, count } = map[id];
        const score = (count / (count + TRUST_M)) * avg + (TRUST_M / (count + TRUST_M)) * C;
        return { id, teacher: get(id), avg, count, score };
      })
      .sort((a, b) => b.score - a.score || b.count - a.count)
      .slice(0, n || 3);
  }


  /* ============================================================
     ДОСТУП К ПРЕМИУМ-УЧИТЕЛЯМ

     Премиум-учитель — это тот, у кого стоит premium:true. Ни у
     одного из шести базовых учителей этого флага НЕТ и появиться
     он там не должен: отбирать у ученика то, чем он уже пользуется,
     — плохой способ что-либо мотивировать. Флаг предназначен для
     учителей из базы (fromRow читает колонку premium).

     Открывается доступ не деньгами, а занятиями: решёнными
     заданиями и оставленными отзывами. Отзывы здесь не для галочки
     — без них рейтинг не на чем строить, и логично, что доступ к
     «лучшим» открывает тот, кто сам в этот рейтинг вкладывается.
     ============================================================ */
  const PREMIUM_REQ = { solved: 50, reviews: 3 };

  function isPremium(teacher) {
    const t = typeof teacher === 'string' ? get(teacher) : teacher;
    return !!(t && t.premium);
  }

  function premiumState() {
    const solved = (Sky.stats() || {}).solved || 0;
    const revCount = reviews().length;
    const solvedLeft = Math.max(0, PREMIUM_REQ.solved - solved);
    const revLeft = Math.max(0, PREMIUM_REQ.reviews - revCount);
    /* Прогресс — среднее двух долей, чтобы полоса двигалась от
       любого из двух действий, а не стояла до самого конца. */
    const pct = Math.round((
      Math.min(1, solved / PREMIUM_REQ.solved) +
      Math.min(1, revCount / PREMIUM_REQ.reviews)
    ) / 2 * 100);
    return {
      unlocked: solvedLeft === 0 && revLeft === 0,
      solved, reviews: revCount,
      solvedNeed: PREMIUM_REQ.solved, reviewsNeed: PREMIUM_REQ.reviews,
      solvedLeft, revLeft, pct
    };
  }

  /* Можно ли ученику выбрать этого учителя прямо сейчас. */
  function canUse(teacher) {
    return !isPremium(teacher) || premiumState().unlocked;
  }


  return {
    local, all, get, selected, selectedId, select, syncFromProfile,
    systemPrompt, strictnessNote, strictnessLabel,
    rate, ratings, localRatings, reviews, reviewsFor, myReview, top,
    isPremium, premiumState, canUse, PREMIUM_REQ, MIN_REVIEWS,
    DEFAULT_ID
  };
})();
