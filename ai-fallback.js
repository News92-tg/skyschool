/* ============================================================
   SkyySchool — разбор ответа без сети и без ключей.

   Подключается после assets/core.js. Ни от чего больше не зависит:
   ни от Worker, ни от Supabase, ни от data/ai-teachers.js.

   ЗАЧЕМ
   -----
   Sky.explain() ходит в Worker, и когда тот недоступен — нет ключа,
   нет сети, кончился лимит — ученик не видит ничего. Хуже всего это
   на ошибке: человек ошибся, нажал «разобрать» и получил пустоту.
   Здесь лежат заготовленные фразы, из которых разбор собирается
   на месте. Это не замена модели: модель объясняет КОНКРЕТНУЮ задачу,
   а тут — разумный разбор общего вида, который всё же лучше пустоты.

   ПРО ИДЕНТИФИКАТОРЫ УЧИТЕЛЕЙ
   ---------------------------
   В постановке задачи они были такими: kind-max, strict-petr,
   coach-anya, prof-lomonosov, little-teacher, romantic-attack.
   В репозитории они другие — сверено по data/ai-teachers.js:

       socrates, strict-peter, kind-max, lomonosov, coach-anya, malysh

   Совпадают только два. Если бы модуль был написан по постановке,
   у четырёх учителей из шести молча включались бы общие фразы, то
   есть заявленная зависимость тона от учителя не работала бы — и
   заметить это по внешнему виду почти невозможно.

   Поэтому: ключи — настоящие, а написанные в задании поддержаны как
   синонимы (ALIASES ниже), чтобы ничего не проваливалось молча, если
   где-то уже написан вызов со старым именем.

   Сократа в постановке не было. Он добавлен, потому что он есть в
   проекте, и у него единственного разбор устроен иначе: он не
   сообщает правильный ответ, а задаёт вопрос, ведущий к нему.
   Выдать от его лица «правильный ответ — 4» означало бы сломать
   ровно то, ради чего этого учителя выбирают.

   ПРО ШАХМАТЫ
   -----------
   У шахмат СВОИ тренеры (coach-fire, coach-calm, coach-prof,
   coach-friend, coach-strict, coach-romantic — см.
   assets/chess-teacher-ui-core.js) и уже есть собственные офлайн-фразы
   в assets/chess-review-ui.js. Здесь шахматная часть нужна для двух
   случаев: когда та страница не подключена, и для уровня «объясни
   проще», которого там нет. Если chess-review-ui.js загружен, он
   главнее — два источника одних и тех же фраз неизбежно разъезжаются.
   ============================================================ */
'use strict';

window.AIFallback = (function () {

  const L = obj => (window.Sky && Sky.L) ? Sky.L(obj) : (obj.ru || '');
  const lang = () => (window.Sky && Sky.lang === 'en') ? 'en' : 'ru';

  /* Выбор из набора — детерминированный по тексту задания, а не
     случайный. Иначе при повторном открытии того же разбора фраза
     менялась бы, и ученику казалось бы, что изменилась оценка. */
  function pick(arr, seedStr) {
    if (!arr || !arr.length) return null;
    const s = String(seedStr || '');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return arr[h % arr.length];
  }

  const ALIASES = {
    'strict-petr': 'strict-peter',
    'prof-lomonosov': 'lomonosov',
    'little-teacher': 'malysh',
    'romantic-attack': 'coach-romantic',
    'kind_max': 'kind-max'
  };
  const normalizeTeacher = id => ALIASES[id] || id || 'kind-max';


  /* ============================================================
     УЧИТЕЛЯ ТРЕНАЖЁРА

     Каждый набор — это голос, а не украшение. Отличаются длина фраз,
     наличие эмодзи, наличие похвалы и то, называется ли правильный
     ответ прямо.

     Поля:
       ok / no      — короткий разбор (2–4 предложения)
       okOpen/noOpen, why, close — детали для «объясни проще»
       tellsAnswer  — можно ли называть верный ответ прямо
                      (у Сократа нельзя — он ведёт вопросом)
     ============================================================ */
  const TEACHERS = {

    /* ---------- Сократ: только вопросы ---------- */
    'socrates': {
      tellsAnswer: false,
      ok: [
        { ru:'Верно. А теперь объясни сам себе: почему именно так, а не иначе? Если ответ находится сразу — значит, ты действительно понял.',
          en:'Correct. Now explain to yourself: why this way and not another? If the answer comes at once, you have truly understood.' },
        { ru:'Сходится. Проверь себя одним вопросом: какой шаг здесь был решающим? Тот, кто может его назвать, решит и следующую такую задачу.',
          en:'It holds. Check yourself with one question: which step was decisive here? Whoever can name it will solve the next one too.' }
      ],
      no: [
        { ru:'Не сходится. Не спеши смотреть верный ответ — сначала найди место, где рассуждение свернуло не туда. Спроси себя: что я считал известным, хотя это ещё нужно было доказать?',
          en:'It does not hold. Do not rush to the right answer — first find where the reasoning turned aside. Ask yourself: what did I treat as known when it still had to be shown?' },
        { ru:'Здесь ошибка. Вернись на шаг назад: с какого места ты перестал проверять себя? Обычно ломается именно там, где кажется очевидным.',
          en:'There is a mistake here. Step back: from what point did you stop checking yourself? It usually breaks exactly where things seem obvious.' }
      ],
      okOpen: { ru:'Ты ответил верно, и это хороший момент, чтобы разобраться до конца.',
                en:'You answered correctly, and this is a good moment to understand it fully.' },
      noOpen: { ru:'Ответ не сошёлся — и это не беда, а место, где можно что-то понять.',
                en:'The answer did not work out — and that is not a problem but a place to understand something.' },
      close: { ru:'Я не назову верный ответ: если ты дойдёшь до него сам, он останется с тобой надолго. Попробуй ответить на вопросы выше по порядку — и посмотри, на каком из них рассуждение начнёт сходиться.',
               en:'I will not state the right answer: if you reach it yourself, it stays with you. Try answering the questions above in order, and see at which one the reasoning starts to hold.' }
    },

    /* ---------- Строгий Пётр: сухо, без похвалы ---------- */
    'strict-peter': {
      tellsAnswer: true,
      ok: [
        { ru:'Верно. Решение засчитано. В следующий раз попробуй прийти к тому же короче.',
          en:'Correct. Accepted. Next time try to get there in fewer steps.' },
        { ru:'Правильно. Замечаний нет. Но правильный ответ и уверенное решение — не одно и то же: проверь, сможешь ли повторить без подсказок.',
          en:'Correct. No remarks. But a right answer and a confident solution are not the same: check whether you can repeat it without hints.' }
      ],
      no: [
        { ru:'Неверно. Правильный ответ: %right. Ошибка не в невнимательности, а в пропущенном шаге — найди его и разбери отдельно.',
          en:'Incorrect. The right answer is %right. The error is not carelessness but a skipped step — find it and work through it separately.' },
        { ru:'Не засчитано. Верно: %right. Разбирать надо не ответ, а место, где рассуждение разошлось с условием.',
          en:'Not accepted. The correct answer is %right. What needs review is not the answer but the point where the reasoning parted from the statement.' }
      ],
      okOpen: { ru:'Ответ верный.', en:'The answer is correct.' },
      noOpen: { ru:'Ответ неверный — разбираем по порядку.', en:'The answer is wrong — let us go through it in order.' },
      close: { ru:'Повтори эту тему сегодня же, пока разбор свежий. Отложенное повторение стоит вдвое дороже.',
               en:'Revisit this topic today, while the review is fresh. Postponed revision costs twice as much.' }
    },

    /* ---------- Добрый Макс: тепло, с поддержкой ---------- */
    'kind-max': {
      tellsAnswer: true,
      ok: [
        { ru:'Отлично, ты справился! Это правильный ответ. Мне нравится, что ты дошёл до него сам.',
          en:'Excellent, you did it! That is the right answer. I like that you got there yourself.' },
        { ru:'Верно! Хорошая работа. Такие задачи как раз и набивают руку — чем дальше, тем легче.',
          en:'Correct! Good work. Tasks like this are exactly what builds the skill — it gets easier from here.' }
      ],
      no: [
        { ru:'Здесь не сошлось, но ничего страшного. Правильный ответ: %right. Давай посмотрим, где рассуждение свернуло — обычно это одно маленькое место.',
          en:'This one did not work out, and that is fine. The right answer is %right. Let us see where the reasoning turned — usually it is one small spot.' },
        { ru:'Пока не то, но ты был близко. Верный ответ: %right. Ошибиться здесь нормально, на этой теме спотыкаются почти все.',
          en:'Not quite yet, but you were close. The correct answer is %right. Getting this wrong is normal — almost everyone stumbles here.' }
      ],
      okOpen: { ru:'Ты ответил правильно — и вот почему это сработало.',
                en:'You answered correctly — and here is why it worked.' },
      noOpen: { ru:'Давай разберёмся спокойно, шаг за шагом.',
                en:'Let us work through it calmly, step by step.' },
      close: { ru:'Не переживай из-за ошибки: она уже сделала свою работу — показала, что стоит повторить. Попробуй похожую задачу прямо сейчас, пока всё свежо.',
               en:'Do not worry about the mistake: it has already done its job by showing what to revisit. Try a similar task right now, while it is fresh.' }
    },

    /* ---------- Профессор Ломоносов: академично ---------- */
    'lomonosov': {
      tellsAnswer: true,
      /* Единственный, кто обращается на «вы». Без этого флага общие
         вставки говорили бы «ты ответил» вперемешку с его же
         «продолжайте, юный коллега» — в одном абзаце это режет слух. */
      formal: true,
      ok: [
        { ru:'Разумно. Ответ верен, и ход рассуждения выбран правильно. Продолжайте, юный коллега.',
          en:'Sound. The answer is correct and the line of reasoning was well chosen. Carry on, young colleague.' },
        { ru:'Верно. Отмечу, что важен здесь не сам ответ, а метод, которым вы к нему пришли: именно он переносится на другие задачи.',
          en:'Correct. Note that what matters is not the answer but the method by which you reached it: that is what transfers to other problems.' }
      ],
      no: [
        { ru:'Ответ ошибочен. Верным будет %right. Ошибка такого рода обыкновенно происходит от того, что правило применено без проверки условий его применимости.',
          en:'The answer is mistaken. The correct one is %right. An error of this kind usually arises from applying a rule without checking the conditions for its applicability.' },
        { ru:'Неверно; правильный ответ — %right. Рекомендую разобрать не результат, а основание: на каком именно утверждении держалось ваше рассуждение.',
          en:'Incorrect; the right answer is %right. I recommend examining not the result but the ground: on which statement exactly did your reasoning rest.' }
      ],
      okOpen: { ru:'Ответ верен. Разберём основание, на котором он держится.',
                en:'The answer is correct. Let us examine the ground on which it rests.' },
      noOpen: { ru:'Ответ ошибочен. Разберём последовательно, где рассуждение утратило строгость.',
                en:'The answer is mistaken. Let us examine step by step where the reasoning lost its rigour.' },
      close: { ru:'Запишите вывод своими словами: то, что изложено собственной формулировкой, удерживается памятью существенно надёжнее заученного.',
               en:'Write the conclusion in your own words: what is stated in one’s own formulation is retained far more reliably than what is memorised.' }
    },

    /* ---------- Коуч Аня: эмодзи и мотивация ---------- */
    'coach-anya': {
      tellsAnswer: true,
      ok: [
        { ru:'Супер! 💪 Правильно. Ты растёшь с каждым разом — это видно по тому, как быстро ты стал справляться.',
          en:'Awesome! 💪 Correct. You are growing every time — you can see it in how quickly you handle these now.' },
        { ru:'Есть! 🔥 Верный ответ. Не останавливайся на этом — сейчас как раз тот момент, когда идёт лучше всего.',
          en:'Got it! 🔥 Right answer. Do not stop here — this is exactly the moment when it flows best.' }
      ],
      no: [
        { ru:'Пока мимо, но это часть работы 💪 Правильный ответ: %right. Ошибки — это не провал, это данные о том, что тренировать дальше.',
          en:'Missed this time, but that is part of the work 💪 The right answer is %right. Mistakes are not failure, they are data on what to train next.' },
        { ru:'Не в этот раз! Верно: %right. Знаешь, что отличает тех, кто дойдёт? Они возвращаются к задаче, которую завалили, а не обходят её 🔥',
          en:'Not this time! The answer is %right. Know what sets apart those who make it? They come back to the task they failed instead of avoiding it 🔥' }
      ],
      okOpen: { ru:'Отличный ответ! 💪 Разбираем, почему он сработал.',
                en:'Great answer! 💪 Let us break down why it worked.' },
      noOpen: { ru:'Разбираем спокойно — ошибка сейчас работает на тебя.',
                en:'Let us break it down calmly — this mistake is working for you.' },
      close: { ru:'Сделай ещё две такие же прямо сейчас, пока разбор в голове 🔥 Через неделю они будут даваться в два раза быстрее — проверено на всех, кто так делал.',
               en:'Do two more like this right now, while the review is in your head 🔥 In a week they will come twice as fast — proven by everyone who did it.' }
    },

    /* ---------- Малыш: детским языком ---------- */
    'malysh': {
      tellsAnswer: true,
      ok: [
        { ru:'Здорово! Молодец! 🎈 Ты ответил правильно.',
          en:'Great! Well done! 🎈 You answered correctly.' },
        { ru:'Ура, верно! 🌟 У тебя получилось. Давай ещё одну?',
          en:'Hooray, correct! 🌟 You did it. Shall we do one more?' }
      ],
      no: [
        { ru:'Ой, тут не так 🙂 Правильный ответ вот какой: %right. Ничего страшного — сейчас посмотрим вместе.',
          en:'Oops, not quite 🙂 The right answer is this: %right. No worries — let us look together.' },
        { ru:'Почти! 🎈 Надо было так: %right. Давай разберём, это совсем просто.',
          en:'Almost! 🎈 It should have been: %right. Let us go through it, it is quite simple.' }
      ],
      okOpen: { ru:'Ты ответил правильно! 🌟 Смотри, почему так получилось.',
                en:'You answered correctly! 🌟 Look why it worked out.' },
      noOpen: { ru:'Смотри, сейчас всё объясню по шагам 🙂',
                en:'Look, I will explain it step by step 🙂' },
      close: { ru:'Вот и всё! Правда не страшно? 🎈 Попробуй ещё одну такую же — теперь получится.',
               en:'That is all! Not scary, right? 🎈 Try one more like it — now it will work.' }
    }
  };


  /* ============================================================
     ПОЧЕМУ ошиблись — по предметам

     Общие, но не пустые: каждая фраза называет типичную причину
     ошибки именно этого предмета, а не «будь внимательнее».
     ============================================================ */
  const SUBJECT_WHY = {
    math: {
      ru:'В математике ответ чаще всего рушится не в вычислении, а на переходе: где-то знак, порядок действий или потерянное условие. Решение стоит пройти с конца, проверяя каждый переход по отдельности.',
      en:'In maths the answer usually breaks not at the arithmetic but at a transition: a sign, the order of operations, a dropped condition. Walk the solution backwards and check each step on its own.' },
    russian: {
      ru:'В русском почти всегда решает правило, а не чутьё: если определить часть речи и форму слова, нужное правило останется одно, а не три на выбор.',
      en:'In Russian it is the rule that decides, not intuition: identify the part of speech and the form, and the right rule becomes one rather than three to choose from.' },
    english: {
      ru:'В английском ошибка обычно во времени или в предлоге: сначала важно понять, КОГДА происходит действие и закончено ли оно — тогда форма подбирается сама.',
      en:'In English the error is usually the tense or the preposition: first work out WHEN the action happens and whether it is finished, and the form follows.' },
    polish: {
      ru:'В польском чаще всего подводит падеж после предлога: предлог почти всегда диктует форму, и запоминать надо именно пару «предлог + падеж».',
      en:'In Polish the case after a preposition is the usual trap: the preposition almost always dictates the form, so learn the pair "preposition + case".' },
    history: {
      ru:'В истории проще запоминается не дата сама по себе, а её связь: что было причиной и что стало следствием. Если привязать событие к соседнему, дата перестаёт теряться.',
      en:'In history it is not the date itself that sticks but its link: what caused it and what followed. Tie the event to its neighbour and the date stops slipping away.' },
    social: {
      ru:'В обществознании выручает точность термина: стоит проверить по определению, подходит ли понятие целиком, а не наполовину — на этом строится большинство заданий.',
      en:'In social studies precision of the term saves you: check against the definition whether the concept fits fully, not halfway — most tasks rest on that.' },
    informatics: {
      ru:'В информатике почти все ошибки — в порядке и в границах: на единицу больше, на единицу меньше, не та система счисления. Пример стоит прогнать вручную на маленьких числах.',
      en:'In computer science nearly all errors are about order and boundaries: off by one, or the wrong number base. Run the example by hand on small numbers.' },
    _default: {
      ru:'Сначала стоит перечитать условие и назвать, что именно спрашивают — очень часто ответ расходится с вопросом, а не с темой.',
      en:'First reread the statement and name what is actually being asked — very often the answer misses the question rather than the topic.' }
  };


  /* ============================================================
     ШАХМАТЫ

     Ключи — настоящие тренеры из chess-teacher-ui-core.js.
     Напоминание: assets/chess-review-ui.js уже даёт такие фразы и
     главнее этого набора; здесь — на случай его отсутствия и ради
     уровня «объясни проще».
     ============================================================ */
  const CHESS_QUALITY = {
    brilliant: { ru:'блестящий ход', en:'a brilliant move' },
    good:      { ru:'хороший ход',   en:'a good move' },
    inaccuracy:{ ru:'неточность',    en:'an inaccuracy' },
    mistake:   { ru:'ошибка',        en:'a mistake' },
    blunder:   { ru:'грубая ошибка', en:'a blunder' }
  };

  const CHESS = {
    'coach-fire': {
      brilliant:{ru:'Вот это удар! Такой ход и ищут — он решает партию сразу.',en:'What a strike! This is the move you look for — it settles the game at once.'},
      good:{ru:'Хорошо, давление растёт. Не отпускай инициативу.',en:'Good, the pressure builds. Do not let the initiative go.'},
      inaccuracy:{ru:'Неточно. Атака сбавила темп — а темп в атаке дороже пешки.',en:'Inaccurate. The attack lost tempo — and in an attack tempo is worth more than a pawn.'},
      mistake:{ru:'Ошибка. Ты дал сопернику вдохнуть, а этого делать было нельзя.',en:'A mistake. You let the opponent breathe, and that was not allowed here.'},
      blunder:{ru:'Тяжёлый промах. Атака оборвалась, теперь придётся защищаться.',en:'A heavy miss. The attack broke off; now you will have to defend.'}
    },
    'coach-calm': {
      brilliant:{ru:'Точный и лучший ход. Улучшать нечего — запомни идею.',en:'Precise and best. Nothing to improve — remember the idea.'},
      good:{ru:'Надёжно. Позиция под контролем, спешить незачем.',en:'Solid. The position is under control, no need to hurry.'},
      inaccuracy:{ru:'Небольшая неточность. Позиция держится, но план стал менее ясным.',en:'A small inaccuracy. The position holds, but the plan became less clear.'},
      mistake:{ru:'Ошибка. Спокойно оцени, что изменилось, и перестрой план.',en:'A mistake. Calmly assess what changed and rebuild the plan.'},
      blunder:{ru:'Серьёзная ошибка. Не торопись отыгрываться — сначала укрепись.',en:'A serious error. Do not rush to win it back — consolidate first.'}
    },
    'coach-prof': {
      brilliant:{ru:'Верно. Лучший ход найден, движку нечего возразить.',en:'Correct. The best move found; the engine has no objection.'},
      good:{ru:'Ход хорош и соответствует требованиям позиции.',en:'The move is good and meets the demands of the position.'},
      inaccuracy:{ru:'Неточность. Оценка ухудшилась незначительно, но направление выбрано не лучшее.',en:'An inaccuracy. The evaluation worsened slightly, but the direction was not the best.'},
      mistake:{ru:'Ошибка. Оценка позиции изменилась заметно не в вашу пользу.',en:'A mistake. The evaluation shifted noticeably against you.'},
      blunder:{ru:'Грубая ошибка: позиция изменилась принципиально.',en:'A blunder: the position changed fundamentally.'}
    },
    'coach-friend': {
      brilliant:{ru:'Отлично! Ты нашёл лучший ход. Запомни эту идею 🔥',en:'Excellent! You found the best move. Remember this idea 🔥'},
      good:{ru:'Хороший ход, так держать!',en:'Good move, keep it up!'},
      inaccuracy:{ru:'Чуть-чуть неточно, но не страшно. Бывает у всех.',en:'A little inaccurate, but no big deal. Happens to everyone.'},
      mistake:{ru:'Тут ошибка — давай посмотрим, что было лучше.',en:'A mistake here — let us look at what was better.'},
      blunder:{ru:'Ох, серьёзный промах. Ничего, разберём и пойдём дальше.',en:'Oh, a serious miss. It is fine, we will review it and move on.'}
    },
    'coach-strict': {
      brilliant:{ru:'Принято. Лучший ход позиции.',en:'Accepted. The best move in the position.'},
      good:{ru:'Приемлемо. Но лучший ход был сильнее.',en:'Acceptable. But the best move was stronger.'},
      inaccuracy:{ru:'Неточность. На таком уровне это уже стоит очков.',en:'An inaccuracy. At this level that already costs points.'},
      mistake:{ru:'Ошибка. Позиция была лучше, и вы её ухудшили.',en:'A mistake. The position was better and you worsened it.'},
      blunder:{ru:'Грубая ошибка. Разбирайте её отдельно, а не между делом.',en:'A blunder. Review it separately, not in passing.'}
    },
    'coach-romantic': {
      brilliant:{ru:'Красиво и точно! Именно ради таких ходов и играют в шахматы.',en:'Beautiful and precise! Moves like this are why chess is played.'},
      good:{ru:'Хорошо. Но можно было рискнуть и выиграть красивее.',en:'Good. But you could have risked it and won more beautifully.'},
      inaccuracy:{ru:'Неточность. Идея была смелой, исполнение — не до конца.',en:'An inaccuracy. The idea was bold, the execution not quite complete.'},
      mistake:{ru:'Ошибка. Смелость хороша, когда подкреплена расчётом.',en:'A mistake. Boldness is good when backed by calculation.'},
      blunder:{ru:'Жаль — замысел был красивый, но позиция его не выдержала.',en:'A pity — the idea was beautiful, but the position could not carry it.'}
    }
  };


  /* ============================================================
     СБОРКА РАЗБОРА
     ============================================================ */

  function fill(text, payload) {
    return String(text || '')
      .replace(/%right/g, payload.correctAnswer || (lang() === 'en' ? 'the correct option' : 'верный вариант'))
      .replace(/%your/g, payload.userAnswer || (lang() === 'en' ? 'your answer' : 'твой ответ'));
  }

  /* Короткий разбор: 2–4 предложения. */
  function explain(payload) {
    payload = payload || {};
    const id = normalizeTeacher(payload.teacherId);

    if (payload.context === 'chess') {
      const set = CHESS[id] || CHESS['coach-calm'];
      const q = payload.quality || 'good';
      const line = set[q] || set.good;
      return { text: L(line), source: 'fallback', teacherId: id };
    }

    const t = TEACHERS[id] || TEACHERS['kind-max'];
    const arr = payload.correct ? t.ok : t.no;
    const seed = (payload.taskText || '') + (payload.userAnswer || '');
    const line = pick(arr, seed);
    return { text: fill(L(line), payload), source: 'fallback', teacherId: id };
  }

  /* Развёрнутый разбор: 5–8 предложений, по шагам.
     Собирается из четырёх частей, чтобы голос учителя сохранялся и в
     длинном варианте, а не растворялся в общем тексте. */
  function explainSimple(payload) {
    payload = payload || {};
    const id = normalizeTeacher(payload.teacherId);
    const en = lang() === 'en';

    if (payload.context === 'chess') {
      const set = CHESS[id] || CHESS['coach-calm'];
      const q = payload.quality || 'good';
      const qName = L(CHESS_QUALITY[q] || CHESS_QUALITY.good);
      const parts = [
        L(set[q] || set.good),
        en ? `In short: the engine rates this as ${qName}.`
           : `Если коротко: движок оценил этот ход как ${qName}.`,
        en ? 'Look at the position again and ask three questions: what was my opponent threatening, what did my move change, and what did it leave undefended.'
           : 'Посмотри на позицию ещё раз и задай три вопроса: чем угрожал соперник, что изменил твой ход и что он оставил без защиты.',
        en ? 'Then set the pieces back and play the suggested move instead — the difference is usually visible within two moves.'
           : 'Потом верни фигуры назад и сыграй предложенный ход вместо своего — разница обычно видна уже через два хода.',
        en ? 'Understanding that difference is worth more than remembering the move itself.'
           : 'Понять эту разницу важнее, чем запомнить сам ход.'
      ];
      return { text: parts.join(' '), source: 'fallback', teacherId: id };
    }

    const t = TEACHERS[id] || TEACHERS['kind-max'];
    const why = SUBJECT_WHY[payload.subject] || SUBJECT_WHY._default;
    const parts = [];

    parts.push(L(payload.correct ? t.okOpen : t.noOpen));

    if (payload.correct) {
      parts.push(en
        ? 'Your answer matches the expected one, so the reasoning held all the way through.'
        : (t.formal
            ? 'Ваш ответ совпал с ожидаемым, значит рассуждение выдержало до конца.'
            : 'Твой ответ совпал с ожидаемым, значит рассуждение выдержало до конца.'));
      parts.push(en
        ? 'The useful part now is not the result but the path: name to yourself which step was the key one.'
        : (t.formal
            ? 'Полезно сейчас не само совпадение, а путь: назовите себе, какой шаг здесь был главным.'
            : 'Полезно сейчас не само совпадение, а путь: назови себе, какой шаг здесь был главным.'));
    } else {
      /* Ответ ученика называем всегда, верный — только если учителю
         это позволено (у Сократа нет). */
      if (payload.userAnswer) {
        parts.push(en
          ? `You answered "${payload.userAnswer}".`
          : (t.formal ? `Вы ответили «${payload.userAnswer}».`
                      : `Ты ответил «${payload.userAnswer}».`));
      }
      if (t.tellsAnswer && payload.correctAnswer) {
        parts.push(en
          ? `The expected answer is "${payload.correctAnswer}".`
          : `Ожидался ответ «${payload.correctAnswer}».`);
      }
      parts.push(L(why));
      parts.push(en
        ? 'Do not just reread the right answer — redo the task from the beginning and stop at the step where your version and this one part ways.'
        : (t.formal
            ? 'Не перечитывайте верный ответ — прорешайте задание заново и остановитесь на том шаге, где ваш вариант и этот расходятся.'
            : 'Не перечитывай верный ответ — прорешай задание заново и остановись на том шаге, где твой вариант и этот расходятся.'));
    }

    parts.push(L(t.close));
    return { text: parts.join(' '), source: 'fallback', teacherId: id };
  }

  /* Чей это набор фраз — пригодится интерфейсу, чтобы честно
     подписать «разбор без сети», а не выдавать его за ответ модели. */
  function has(teacherId) {
    const id = normalizeTeacher(teacherId);
    return !!(TEACHERS[id] || CHESS[id]);
  }

  return {
    explain, explainSimple, has,
    normalizeTeacher, ALIASES,
    TEACHER_IDS: Object.keys(TEACHERS),
    CHESS_IDS: Object.keys(CHESS)
  };
})();


/* ============================================================
   Встраивание в Sky.explain()

   Делаем это здесь, а не правкой каждой страницы: Sky.explain зовут
   trainer.html и другие места, и точка отказа у них общая. Обёртка
   сохраняет прежнее поведение полностью — она вступает в дело только
   тогда, когда настоящий разбор вернул ошибку.

   Признак source:'fallback' в ответе остаётся, чтобы интерфейс мог
   честно подписать, что это заготовленный разбор, а не ответ модели.
   ============================================================ */
(function () {
  if (!window.Sky || typeof Sky.explain !== 'function') return;
  if (Sky.__fallbackWrapped) return;         /* защита от двойного подключения */
  Sky.__fallbackWrapped = true;

  const original = Sky.explain.bind(Sky);

  Sky.explain = async function (payload) {
    let res;
    try {
      res = await original(payload);
    } catch (e) {
      res = { error: String(e && e.message || e) };
    }
    if (res && res.text) return res;

    /* Модель недоступна — собираем разбор на месте. */
    const teacherId = (window.SkyTeachers && SkyTeachers.selectedId)
      ? SkyTeachers.selectedId() : null;

    const fb = AIFallback.explain(Object.assign({}, payload, {
      teacherId: payload && payload.teacherId || teacherId,
      context: (payload && payload.context) || 'trainer'
    }));
    return { text: fb.text, source: 'fallback', offlineReason: res && res.error };
  };

  /* Развёрнутый разбор отдельной функцией: у Sky его не было. */
  Sky.explainSimple = function (payload) {
    const teacherId = (window.SkyTeachers && SkyTeachers.selectedId)
      ? SkyTeachers.selectedId() : null;
    return AIFallback.explainSimple(Object.assign({}, payload, {
      teacherId: (payload && payload.teacherId) || teacherId,
      context: (payload && payload.context) || 'trainer'
    }));
  };
})();
