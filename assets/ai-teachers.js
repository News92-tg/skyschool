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
    if (!get(id)) return false;
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


  /* ---------- отзывы и рейтинг ----------
     Средняя оценка считается триггером в базе (см. миграцию), а не
     здесь: клиент видит не все отзывы, и считать среднее по видимой
     части — значит показывать неверное число. */
  async function rate(teacherId, stars, comment) {
    if (!Sky.db || !Sky.db.isCloud || !Sky.db.isCloud()) {
      return { error: Sky.t('teachRateLocal') };
    }
    const me = Sky.db.me && Sky.db.me();
    if (!me) return { error: Sky.t('teachRateAuth') };

    const stored = await Sky.db.list('teacher_reviews', { teacher_id: teacherId, user_id: me.id });
    if (stored && stored.length) {
      await Sky.db.update('teacher_reviews', stored[0].id, { rating: stars, comment: comment || null });
    } else {
      await Sky.db.insert('teacher_reviews', {
        teacher_id: teacherId, user_id: me.id, rating: stars, comment: comment || null
      });
    }
    cloudCache = null; /* рейтинг пересчитан триггером — перечитаем */
    return { ok: true };
  }

  async function ratings() {
    if (!Sky.db || !Sky.db.isCloud || !Sky.db.isCloud()) return {};
    try {
      const rows = await Sky.db.list('teachers_ai');
      const out = {};
      for (const r of rows || []) out[r.id] = { avg: r.rating_avg || 0, count: r.rating_count || 0 };
      return out;
    } catch (e) { return {}; }
  }

  return {
    local, all, get, selected, selectedId, select, syncFromProfile,
    systemPrompt, strictnessNote, strictnessLabel, rate, ratings,
    DEFAULT_ID
  };
})();
