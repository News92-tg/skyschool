/* ============================================================
   SkyySchool — задачи, снятые на фото, попадают в повторение.

   Подключается после assets/core.js и до скрипта страницы.

   ЗАЧЕМ. Разбор фотографии сейчас — тупик: ученик сфотографировал
   задачу из учебника, прочитал решение по шагам, закрыл вкладку. Через
   три дня та же задача решается так же плохо, потому что понять и
   запомнить — разные вещи, и весь смысл интервального повторения,
   которое в платформе уже есть, к фотографиям не применялся.

   Здесь снятая задача становится обычной карточкой тренажёра: она
   встаёт в ту же очередь Лейтнера, что и задания из банков, и
   возвращается по тому же расписанию.

   ПОЧЕМУ ПРОВЕРЯЕТ СЕБЯ САМ УЧЕНИК. У задачи с фотографии нет
   вариантов ответа — там условие из учебника, а не тест. Городить
   автоматическую проверку произвольного ответа значит врать: модель
   не знает, что именно ученик написал у себя в тетради. Поэтому
   карточка работает как бумажная: вспомни → посмотри решение →
   честно скажи, справился или нет. Самооценка в интервальном
   повторении — не костыль, а штатный режим (так устроены все
   карточные системы), и работает она ровно настолько, насколько
   ученик честен с собой.

   Хранится в localStorage рядом с остальным прогрессом. Ключ свой, а
   не внутри 'life' или 'srs': это отдельная сущность со своим
   жизненным циклом, и подмешивать её к чужим данным — та самая
   ошибка, из-за которой потом ничего нельзя удалить по отдельности.
   ============================================================ */

'use strict';

window.PhotoTasks = (function () {

  const KEY = 'photoTasks';
  const MAX = 60;        /* больше — и список превращается в свалку */

  const all = () => Sky.get(KEY, []);
  const save = list => Sky.set(KEY, list.slice(0, MAX));

  /* Короткая подпись для списка и для тега темы: первая строка
     условия, обрезанная по границе слова. */
  function title(text) {
    const line = String(text || '').split('\n').find(s => s.trim()) || '';
    const short = line.trim().slice(0, 60);
    return short.length < line.trim().length ? short.replace(/\s+\S*$/, '') + '…' : short;
  }

  /* Добавляем то, что вернул разбор фото. Дубли по тексту не заводим:
     ученик легко жмёт кнопку дважды, а две одинаковые карточки в
     очереди выглядят как поломка. */
  function add(data, extra) {
    const text = String((data && data.text) || '').trim();
    if (!text) return null;
    const list = all();
    const same = list.find(t => t.text.trim() === text);
    if (same) return same;

    const item = {
      id: 'pt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text,
      steps: Array.isArray(data.solution) ? data.solution.slice(0, 15) : [],
      feedback: data.feedback || '',
      subject: (extra && extra.subject) || '',
      created: new Date().toISOString()
    };
    list.unshift(item);
    save(list);
    document.dispatchEvent(new CustomEvent('phototasks'));
    return item;
  }

  function remove(id) {
    save(all().filter(t => t.id !== id));
    document.dispatchEvent(new CustomEvent('phototasks'));
  }

  const has = text => all().some(t => t.text.trim() === String(text || '').trim());

  /* ---------- превращение в банк тренажёра ----------
     Тренажёр перебирает window.BANKS и ничего не знает про фотографии.
     Поэтому отдаём ему банк обычного вида — тогда фильтры, прогресс,
     статистика и расписание повторения работают сами, без единой
     правки в их коде.

     selfCheck:true — единственное отличие, которое странице всё же
     приходится знать: у такой карточки нет вариантов ответа. */
  function bank() {
    const list = all();
    if (!list.length) return null;
    return {
      id: 'photo',
      icon: '📷',
      name: { ru: 'Мои задачи с фото', en: 'My photo tasks' },
      ruOnly: false,
      tasks: list.map(t => ({
        id: t.id,
        exam: 'both',
        difficulty: 'medium',
        selfCheck: true,
        steps: t.steps,
        photoFeedback: t.feedback,
        topic: { ru: title(t.text), en: title(t.text) },
        text: { ru: t.text, en: t.text },
        options: [],
        answer: 0,
        hint: {
          ru: t.steps.length ? 'Первый шаг: ' + t.steps[0] : 'Вспомни, с чего начинается решение.',
          en: t.steps.length ? 'First step: ' + t.steps[0] : 'Recall how the solution starts.'
        },
        solution: {
          ru: t.steps.length ? t.steps.map((s, i) => (i + 1) + '. ' + s).join('\n') : (t.feedback || ''),
          en: t.steps.length ? t.steps.map((s, i) => (i + 1) + '. ' + s).join('\n') : (t.feedback || '')
        }
      }))
    };
  }

  /* Сколько карточек ждёт повторения прямо сейчас — для подписи на
     странице тренажёра. */
  function dueCount() {
    const list = all();
    if (!list.length) return 0;
    return Sky.dueIds('photo', list.map(t => t.id)).length;
  }

  return { KEY, MAX, all, add, remove, has, title, bank, dueCount };
})();
