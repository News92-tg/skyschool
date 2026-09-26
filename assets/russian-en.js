/* ============================================================
   SkyySchool — движок страницы «Russian for English speakers».

   Здесь только логика урока: сборка упражнений и проверка ответов.
   Разметку рисует сама страница — так же, как у трекеров: модуль
   отвечает за «что правильно», страница — за «как выглядит».

   Речь (озвучка и микрофон) вынесена в assets/speech.js: те же
   задания на слух есть в английском и польском банках тренажёра, и
   обходить особенности Web Speech API в двух местах незачем. Здесь
   оставлены только ссылки на неё, чтобы страница звала один модуль.

   Что до распознавания: оно шумит. «Привет» легко слышится как
   «привёт» или «превед», поэтому сравниваем не побуквенно, а по
   схожести — и всегда показываем, ЧТО именно услышал браузер, иначе
   ученик не понимает, ошибся он сам или его не расслышали.
   ============================================================ */

window.RUEN = (function () {
  'use strict';

  const S = window.Speech;

  /* ---------- сравнение ответов ----------
     norm() убирает всё, что не меняет смысла для начинающего:
     регистр, ё/е, знаки препинания, двойные пробелы.
     ё→е именно здесь важно: распознавание почти всегда отдаёт «е»,
     а в учебнике написано «ё», и это не ошибка ученика. */
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[.,!?;:…"'«»()\-–—]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const same = (a, b) => norm(a) === norm(b);

  /* Расстояние Левенштейна — для «почти правильно» в произношении. */
  function distance(a, b) {
    a = norm(a); b = norm(b);
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }
  function similarity(a, b) {
    const len = Math.max(norm(a).length, norm(b).length);
    if (!len) return 1;
    return 1 - distance(a, b) / len;
  }

  /* Порог для произношения. 0.75 подобран по живым ошибкам
     распознавания: «здравствуйте» → «здрасте» даёт 0.58 (это правда
     другое слово, и засчитывать нельзя), «привет» → «привёт» даёт 1
     после нормализации, «как дела» → «какделa» — 0.87. */
  const SAY_OK = 0.75;

  function checkSpoken(said, target) {
    const list = Array.isArray(said) ? said : [said];
    let best = 0, bestText = list[0] || '';
    for (const s of list) {
      const sim = similarity(s, target);
      if (sim > best) { best = sim; bestText = s; }
    }
    return { ok: best >= SAY_OK, score: best, heard: bestText };
  }

  /* ---------- сборка упражнений ----------
     Из данных урока делаем очередь заданий. Типы:
       read   — вижу кириллицу, выбираю значение
       listen — слышу фразу (текста НЕТ), выбираю написание
       gap    — вписываю пропущенное слово (выбор из вариантов)
       match  — сопоставляю 4 слова и 4 перевода
       write  — вижу английское, набираю русское
       say    — произношу вслух, проверяет микрофон

     Почему listen даёт выбрать НАПИСАНИЕ, а не значение: выбор
     значения — это то же самое задание, что read, только со звуком.
     А связка «звук → буквы» отрабатывается только так. */
  const KINDS = ['read', 'listen', 'gap', 'match', 'write', 'say'];

  function pick(arr, n, rnd) {
    const copy = arr.slice();
    const out = [];
    while (copy.length && out.length < n) {
      const i = Math.floor((rnd ? rnd() : Math.random()) * copy.length);
      out.push(copy.splice(i, 1)[0]);
    }
    return out;
  }

  /* Отвлекающие варианты берём из того же урока: они похожи по длине
     и теме, поэтому угадать по форме нельзя. Если в уроке мало фраз,
     добираем из общего запаса. */
  function distractors(field, right, lessonPhrases, allPhrases, n) {
    const seen = new Set([norm(right)]);
    const out = [];
    const take = list => {
      for (const p of list) {
        const val = p[field];
        if (!val || seen.has(norm(val))) continue;
        seen.add(norm(val));
        out.push(val);
        if (out.length >= n) return true;
      }
      return false;
    };
    if (!take(pick(lessonPhrases, lessonPhrases.length))) {
      take(pick(allPhrases, allPhrases.length));
    }
    return out.slice(0, n);
  }

  /* kinds — какие типы включить (фильтр на странице).
     limit — сколько заданий в подходе. */
  function buildQueue(lesson, allPhrases, opts) {
    const o = opts || {};
    const kinds = (o.kinds && o.kinds.length) ? o.kinds : KINDS;
    const phrases = (lesson.phrases || []).filter(p => p.ru && p.en);
    const pool = (allPhrases && allPhrases.length) ? allPhrases : phrases;
    const items = [];

    const add = (kind, make, count) => {
      if (kinds.indexOf(kind) < 0) return;
      pick(phrases, count).forEach((p, i) => {
        const it = make(p, i);
        if (it) items.push(it);
      });
    };

    /* чтение: кириллица → значение */
    add('read', p => ({
      kind:'read', id:lesson.id + ':read:' + p.ru,
      ru:p.ru, tl:p.tl, en:p.en,
      options: shuffleWithAnswer(p.en, distractors('en', p.en, phrases, pool, 3))
    }), 3);

    /* аудирование: звук → написание */
    add('listen', p => ({
      kind:'listen', id:lesson.id + ':listen:' + p.ru,
      ru:p.ru, tl:p.tl, en:p.en,
      options: shuffleWithAnswer(p.ru, distractors('ru', p.ru, phrases, pool, 3))
    }), 3);

    /* письмо: английское → набрать русское */
    add('write', p => ({
      kind:'write', id:lesson.id + ':write:' + p.ru,
      ru:p.ru, tl:p.tl, en:p.en
    }), 2);

    /* произношение: сказать вслух */
    add('say', p => ({
      kind:'say', id:lesson.id + ':say:' + p.ru,
      ru:p.ru, tl:p.tl, en:p.en
    }), 2);

    /* пропуски — берём как есть из урока, они написаны вручную */
    if (kinds.indexOf('gap') >= 0) {
      (lesson.gaps || []).forEach(g => {
        items.push({
          kind:'gap', id:lesson.id + ':gap:' + g.answer + ':' + g.ru,
          ru:g.ru, en:g.en, tl:g.tl, why:g.why,
          options: shuffleWithAnswer(g.answer, (g.wrong || []).slice(0, 3))
        });
      });
    }

    /* сопоставление — один блок на подход, 4 пары */
    if (kinds.indexOf('match') >= 0 && phrases.length >= 4) {
      const pairs = pick(phrases, 4).map(p => ({ ru:p.ru, en:p.en, tl:p.tl }));
      items.push({ kind:'match', id:lesson.id + ':match', pairs });
    }

    const out = pick(items, o.limit || items.length);
    return out;
  }

  /* Верный ответ всегда кладём первым, а порядок перемешиваем при
     показе — тот же приём, что в банках трениров: так задания удобно
     читать и проверять глазами в исходнике. */
  function shuffleWithAnswer(right, wrong) {
    return [right].concat(wrong || []);
  }

  /* ---------- проверка ----------
     value: для read/listen/gap — индекс выбранного варианта,
            для write — строка, для say — транскрипт(ы). */
  function check(item, value) {
    if (!item) return { ok:false };
    if (item.kind === 'read' || item.kind === 'listen' || item.kind === 'gap') {
      return { ok: value === 0, right: item.options[0] };
    }
    if (item.kind === 'write') {
      return { ok: same(value, item.ru), right: item.ru };
    }
    if (item.kind === 'say') {
      const r = checkSpoken(value, item.ru);
      return { ok:r.ok, right:item.ru, heard:r.heard, score:r.score };
    }
    return { ok:false };
  }

  /* ---------- экранная кириллица ----------
     Американская клавиатура физически не может набрать «Привет», а
     задание «напиши по-русски» без клавиатуры — издевательство.
     Порядок букв алфавитный, а не ЙЦУКЕН: ученик ищет букву глазами,
     и алфавит он уже выучил в первом разделе. */
  const KEYS = [
    'абвгдеёжзий',
    'клмнопрсту',
    'фхцчшщъыьэ',
    'юя'
  ];

  return {
    /* речь — проброс в общий модуль, чтобы страница знала один адрес */
    canSpeak: () => S.canSpeak(),
    hasVoice: lang => S.hasVoice(lang),
    voiceFor: lang => S.voiceFor(lang),
    onReady: cb => S.onReady(cb),
    speak: (text, lang, opts) => S.speak(text, lang, opts),
    stopSpeaking: () => S.stop(),
    canListen: () => S.canListen(),
    listen: (lang, ms) => S.listen(lang, ms),
    /* сравнение */
    norm, same, distance, similarity, checkSpoken, SAY_OK,
    /* упражнения */
    KINDS, KEYS, buildQueue, check, pick
  };
})();
