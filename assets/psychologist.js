/* ============================================================
   SkyySchool — вкладка «Психолог»: данные и логика.

   Подключается после assets/core.js (нужны Sky.get/set, Sky.L,
   Sky.dayKey, Sky.plural) и до собственного скрипта страницы.

   ЧТО ЭТО ТАКОЕ И ЧЕМ НЕ ЯВЛЯЕТСЯ
   -------------------------------
   Это инструмент самонаблюдения, а не диагностики. Здесь нет и не
   должно быть ни одного слова вида «у тебя депрессия» или «у тебя
   тревожное расстройство». Опросники ниже сделаны на основе реальных
   скрининговых шкал (GAD-7, PHQ-8, шкала воспринимаемого стресса),
   но переписаны подростковым языком — а значит, перестали быть теми
   самыми валидированными инструментами. Результат называется
   «уровень» и означает ровно одно: сколько похожих переживаний
   человек отметил за две недели. Дальше — предложение поговорить с
   живым человеком, и ничего больше.

   ПОЧЕМУ ЗДЕСЬ PHQ-8, А НЕ PHQ-9
   ------------------------------
   В классическом PHQ-9 девятый пункт спрашивает про мысли о смерти и
   самоповреждении. PHQ-8 — это официальная восьмипунктовая версия
   той же шкалы, где этот пункт убран; её специально используют в
   исследованиях и скринингах вне клиники, потому что «посчитать»
   такой ответ и выдать число — худшее, что можно сделать.

   Поэтому здесь так: восемь пунктов считаются и дают уровень, а про
   тяжёлые мысли спрашивается ОТДЕЛЬНО, в самом конце, и этот ответ
   НЕ входит в подсчёт. Если подросток отвечает «да» — он не получает
   балл, он получает телефон доверия и тёплый текст. Число в такой
   момент не помогает ничем.

   ПРО ПРИВАТНОСТЬ
   ---------------
   Весь дневник состояния, результаты тестов и записи мыслей лежат
   ТОЛЬКО в localStorage этого браузера. В отличие от roles.js, здесь
   намеренно нет pushRole() и вообще никакой отправки в Supabase:
   дневник настроения несовершеннолетнего не должен уезжать на сервер
   без отдельного осознанного разговора об этом. Если такая синхронизация
   когда-нибудь понадобится — это отдельная задача с отдельным согласием,
   а не флажок в этом файле.
   ============================================================ */
'use strict';

window.SkyPsy = (function () {

  /* ---------- ключи хранения (localStorage, префикс sky_) ---------- */
  const KEYS = {
    results: 'psyResults',    /* история прохождения тестов */
    diary:   'psyDiary',      /* дневник состояния по дням */
    thoughts:'psyThoughts',   /* записи мыслей (КПТ) */
    seen:    'psySeenIntro'   /* показывали ли вводную плашку */
  };

  /* ============================================================
     ЧАСТЬ D (объявлена первой — на неё ссылаются все остальные части)
     КОНТАКТЫ ЭКСТРЕННОЙ ПОМОЩИ

     Номера проверены по официальным источникам: childhelpline.ru
     (Фонд поддержки детей / МГППУ) и psi.mchs.gov.ru.
     Если что-то из этого изменится — править надо ЗДЕСЬ, в одном
     месте: все плашки, модалки и экраны результатов берут номера
     отсюда и больше нигде их не дублируют.
     ============================================================ */
  const HELPLINES = [
    {
      id: 'child',
      phone: '8-800-2000-122',
      tel: '88002000122',
      name: { ru: 'Детский телефон доверия', en: 'Children’s helpline' },
      note: { ru: 'Бесплатно, анонимно, круглосуточно. Для детей, подростков и родителей. С мобильного по России также работает короткий номер 124.',
              en: 'Free, anonymous, 24/7. For children, teenagers and parents. Short number 124 also works from mobiles in Russia.' },
      primary: true
    },
    {
      id: 'mchs',
      phone: '+7 (495) 989-50-50',
      tel: '+74959895050',
      name: { ru: 'Экстренная психологическая помощь МЧС России', en: 'Emergency psychological help, EMERCOM of Russia' },
      note: { ru: 'Круглосуточная линия психологов Центра экстренной психологической помощи МЧС.',
              en: 'Round-the-clock line of the EMERCOM emergency psychological help centre.' }
    },
    {
      id: 'child2',
      phone: '8 (495) 624-60-01',
      tel: '+74956246001',
      name: { ru: 'Телефон доверия (Москва)', en: 'Helpline (Moscow)' },
      note: { ru: 'Второй номер детского телефона доверия — если основной занят.',
              en: 'The children’s helpline second number — if the main one is busy.' }
    }
  ];

  /* Текст дисклеймера. Держим строкой здесь, чтобы он был дословно
     одинаковым на всех экранах — и в шапке, и в результатах теста. */
  const DISCLAIMER = {
    ru: 'Это не медицинский диагноз. Если тебе тяжело — позвони 8-800-2000-122',
    en: 'This is not a medical diagnosis. If you are struggling, call 8-800-2000-122'
  };


  /* ============================================================
     ЧАСТЬ A. ТЕСТЫ СОСТОЯНИЯ
     ============================================================ */

  /* Варианты ответа для GAD-7 и PHQ-8 — стандартная четвёрка
     «как часто за последние 2 недели», 0–3 балла. */
  const FREQ_2W = [
    { v: 0, label: { ru: 'Ни разу',              en: 'Not at all' } },
    { v: 1, label: { ru: 'Несколько дней',       en: 'Several days' } },
    { v: 2, label: { ru: 'Больше половины дней', en: 'More than half the days' } },
    { v: 3, label: { ru: 'Почти каждый день',    en: 'Nearly every day' } }
  ];

  /* Шкала для теста на стресс — про частоту за последний месяц, 0–4. */
  const FREQ_1M = [
    { v: 0, label: { ru: 'Никогда',      en: 'Never' } },
    { v: 1, label: { ru: 'Почти никогда', en: 'Almost never' } },
    { v: 2, label: { ru: 'Иногда',       en: 'Sometimes' } },
    { v: 3, label: { ru: 'Часто',        en: 'Fairly often' } },
    { v: 4, label: { ru: 'Очень часто',  en: 'Very often' } }
  ];

  const TESTS = {

    /* ---------- Тревожность: на основе GAD-7 ----------
       7 пунктов × 0–3 = 0–21. Порог 10 — тот самый, на котором в
       клинической практике обычно предлагают обратиться к
       специалисту; поэтому «высокий» начинается именно с него, а не
       с произвольного числа. */
    anxiety: {
      id: 'anxiety',
      icon: '😰',
      name: { ru: 'Тревожность', en: 'Anxiety' },
      basedOn: { ru: 'на основе шкалы GAD-7, переписанной подростковым языком',
                 en: 'based on the GAD-7 scale, rewritten in teen-friendly language' },
      intro: { ru: 'Вспомни последние две недели. Как часто это про тебя?',
               en: 'Think of the last two weeks. How often was this you?' },
      options: FREQ_2W,
      max: 21,
      questions: [
        { id:'a1', text:{ ru:'Ты нервничал(а), тревожился(ась) или было «на взводе»', en:'Feeling nervous, anxious or on edge' } },
        { id:'a2', text:{ ru:'Не получалось перестать волноваться или взять волнение под контроль', en:'Not being able to stop or control worrying' } },
        { id:'a3', text:{ ru:'Слишком много волновался(ась) о самых разных вещах', en:'Worrying too much about different things' } },
        { id:'a4', text:{ ru:'Было трудно расслабиться', en:'Trouble relaxing' } },
        { id:'a5', text:{ ru:'Беспокойство было такое, что трудно усидеть на месте', en:'Being so restless that it is hard to sit still' } },
        { id:'a6', text:{ ru:'Легко раздражался(ась) или злился(ась)', en:'Becoming easily annoyed or irritable' } },
        { id:'a7', text:{ ru:'Было чувство, будто вот-вот случится что-то плохое', en:'Feeling afraid as if something awful might happen' } }
      ],
      bands: [
        { max: 4,  level: 'low',  title:{ ru:'Низкий уровень', en:'Low level' },
          text:{ ru:'За эти две недели тревоги было немного. Это не значит, что всё обязано быть идеально — просто сейчас тревога не мешает тебе жить.',
                 en:'There was not much anxiety over these two weeks. It does not mean everything has to be perfect — anxiety simply is not getting in your way right now.' } },
        { max: 9,  level: 'mid',  title:{ ru:'Средний уровень', en:'Medium level' },
          text:{ ru:'Тревога заметна и, похоже, иногда мешает. Это очень частая история перед контрольными и экзаменами. Дыхательные упражнения и дневник состояния на этой странице как раз про такие периоды.',
                 en:'Anxiety is noticeable and sometimes gets in the way. This is very common around tests and exams. The breathing exercises and the diary on this page are made for exactly such periods.' } },
        { max: 21, level: 'high', title:{ ru:'Высокий уровень', en:'High level' },
          text:{ ru:'Ты отметил(а) много тревожных переживаний. Это не диагноз и не приговор — но с таким фоном тяжело и в школе, и дома, и справляться с этим в одиночку не нужно. Поговори с тем взрослым, которому доверяешь, или позвони на телефон доверия: там не будут ругать и не сообщат в школу.',
                 en:'You marked a lot of anxious experiences. This is not a diagnosis and not a verdict — but living with this background is hard, and you do not have to handle it alone. Talk to an adult you trust, or call the helpline: they will not tell you off and will not report to your school.' } }
      ]
    },

    /* ---------- Настроение: на основе PHQ-8 ----------
       Ровно восемь пунктов. Девятый (мысли о смерти и
       самоповреждении) сознательно вынесен из подсчёта — см. большой
       комментарий в шапке файла и safetyCheck ниже. */
    mood: {
      id: 'mood',
      icon: '🌧',
      name: { ru: 'Настроение', en: 'Mood' },
      basedOn: { ru: 'на основе шкалы PHQ-8 (версия PHQ-9 без пункта о самоповреждении)',
                 en: 'based on the PHQ-8 scale (the PHQ-9 without the self-harm item)' },
      intro: { ru: 'Снова про последние две недели. Отвечай как есть — правильных ответов тут нет.',
               en: 'About the last two weeks again. Answer honestly — there are no right answers here.' },
      options: FREQ_2W,
      max: 24,
      questions: [
        { id:'m1', text:{ ru:'Мало что радовало, пропал интерес к тому, что обычно нравится', en:'Little interest or pleasure in doing things' } },
        { id:'m2', text:{ ru:'Было грустно, подавленно или безнадёжно', en:'Feeling down, depressed or hopeless' } },
        { id:'m3', text:{ ru:'Плохо спал(а): трудно заснуть, просыпался(ась) ночью или спал(а) слишком много', en:'Trouble falling or staying asleep, or sleeping too much' } },
        { id:'m4', text:{ ru:'Чувствовал(а) усталость, сил почти не было', en:'Feeling tired or having little energy' } },
        { id:'m5', text:{ ru:'Плохой аппетит или, наоборот, ел(а) слишком много', en:'Poor appetite or overeating' } },
        { id:'m6', text:{ ru:'Думал(а) о себе плохо: что ты неудачник или подвёл(а) близких', en:'Feeling bad about yourself, or that you are a failure or have let people down' } },
        { id:'m7', text:{ ru:'Трудно было сосредоточиться — на уроках, чтении, видео', en:'Trouble concentrating on things such as schoolwork, reading or watching videos' } },
        { id:'m8', text:{ ru:'Двигался(ась) и говорил(а) заметно медленнее обычного — или наоборот не мог(ла) усидеть', en:'Moving or speaking noticeably slowly — or the opposite, being fidgety and restless' } }
      ],
      bands: [
        { max: 4,  level: 'low',  title:{ ru:'Низкий уровень', en:'Low level' },
          text:{ ru:'Судя по ответам, последние две недели были в целом нормальными. Плохие дни бывают у всех — это не то же самое, что тяжёлый период.',
                 en:'Judging by your answers, the last two weeks were broadly okay. Everyone has bad days — that is not the same as a hard period.' } },
        { max: 9,  level: 'mid',  title:{ ru:'Средний уровень', en:'Medium level' },
          text:{ ru:'Похоже, было довольно тяжело. Часто помогает самое простое: сон в одно и то же время, прогулка, разговор с кем-то близким. Попробуй вести дневник состояния хотя бы неделю — иногда сразу видно, от чего именно проседает настроение.',
                 en:'It looks like things have been fairly hard. The simplest things often help: sleeping at consistent hours, walking, talking to someone close. Try keeping the diary for at least a week — sometimes it immediately shows what is pulling your mood down.' } },
        { max: 24, level: 'high', title:{ ru:'Высокий уровень', en:'High level' },
          text:{ ru:'Ты отметил(а) много тяжёлого. Так бывает, и это точно не значит, что с тобой что-то не так. Но такой период почти невозможно вытащить в одиночку — и не нужно. Расскажи взрослому, которому доверяешь, или позвони 8-800-2000-122: звонок бесплатный и анонимный.',
                 en:'You marked a lot of difficult experiences. This happens, and it certainly does not mean something is wrong with you. But a period like this is almost impossible to pull yourself out of alone — and you do not have to. Tell an adult you trust, or call 8-800-2000-122: the call is free and anonymous.' } }
      ],

      /* ---------- Отдельная проверка безопасности ----------
         Это НЕ вопрос теста. Он задаётся после всех восьми, показан
         отдельно и визуально иначе, его ответ не складывается ни с
         чем и не превращается в балл. Единственное, на что он
         влияет, — покажем ли мы экран с поддержкой и телефонами
         вместо сухого «ваш уровень такой-то».

         Формулировка намеренно мягкая и без слова «суицид»: цель —
         чтобы подросток честно ответил, а не испугался вопроса. */
      safetyCheck: {
        id: 'safety',
        text: { ru: 'И последнее, отдельно от теста. Бывали ли за эти две недели мысли, что тебе не хочется жить или что хочется сделать себе больно?',
                en: 'One last thing, separate from the test. Over these two weeks, have you had thoughts that you do not want to live, or of hurting yourself?' },
        note: { ru: 'Этот ответ не входит в подсчёт и никуда не отправляется. Он нужен только для того, чтобы показать тебе нужную страницу.',
                en: 'This answer is not scored and is not sent anywhere. It only decides which page we show you.' },
        options: [
          { v: 0, label: { ru: 'Нет, таких мыслей не было', en: 'No, I have not had such thoughts' } },
          { v: 1, label: { ru: 'Да, бывали', en: 'Yes, I have' } },
          { v: 2, label: { ru: 'Не хочу отвечать', en: 'I would rather not answer' } }
        ]
      }
    },

    /* ---------- Стресс ----------
       Вдохновлено шкалой воспринимаемого стресса (PSS), но это
       АДАПТАЦИЯ: пункты переписаны под школьную жизнь и их восемь, а
       не десять. Считать это «настоящим PSS-10» нельзя, и в
       интерфейсе так и написано.

       Пункты 4, 5, 7 сформулированы «в плюс» (чем чаще — тем лучше),
       поэтому считаются в обратную сторону — reverse: true. */
    stress: {
      id: 'stress',
      icon: '🌪',
      name: { ru: 'Стресс', en: 'Stress' },
      basedOn: { ru: 'адаптация шкалы воспринимаемого стресса под школьную жизнь',
                 en: 'an adaptation of the perceived stress scale for school life' },
      intro: { ru: 'Тут — про последний месяц. Как часто так было?',
               en: 'This one is about the last month. How often was it like this?' },
      options: FREQ_1M,
      max: 32,
      questions: [
        { id:'s1', text:{ ru:'Ты расстраивался(ась) из-за того, что случилось неожиданно', en:'Being upset because of something that happened unexpectedly' } },
        { id:'s2', text:{ ru:'Казалось, что ты не управляешь тем, что происходит в твоей жизни', en:'Feeling unable to control the important things in your life' } },
        { id:'s3', text:{ ru:'Ты чувствовал(а) себя нервно и напряжённо', en:'Feeling nervous and stressed' } },
        { id:'s4', reverse: true, text:{ ru:'Ты был(а) уверен(а), что справишься со своими делами и учёбой', en:'Feeling confident about handling your problems and schoolwork' } },
        { id:'s5', reverse: true, text:{ ru:'Казалось, что всё идёт так, как ты хочешь', en:'Feeling that things were going your way' } },
        { id:'s6', text:{ ru:'Ты понимал(а), что не успеваешь всё, что нужно сделать', en:'Finding that you could not cope with all the things you had to do' } },
        { id:'s7', reverse: true, text:{ ru:'У тебя получалось справляться с раздражением', en:'Being able to control irritations in your life' } },
        { id:'s8', text:{ ru:'Проблем и дел накапливалось столько, что было не разгрести', en:'Difficulties piling up so high that you could not overcome them' } }
      ],
      bands: [
        { max: 10, level: 'low',  title:{ ru:'Низкий уровень', en:'Low level' },
          text:{ ru:'Нагрузка сейчас в целом посильная. Полезно помнить, что именно помогает тебе держаться, — пригодится в более горячий период.',
                 en:'The load right now is broadly manageable. It is worth noticing what helps you keep steady — it will come in handy in a busier period.' } },
        { max: 20, level: 'mid',  title:{ ru:'Средний уровень', en:'Medium level' },
          text:{ ru:'Обычный уровень для учебного года, особенно ближе к экзаменам. Стоит следить за сном и делать перерывы — на этой же странице есть дыхательные практики на две-три минуты.',
                 en:'A typical level for the school year, especially closer to exams. Watch your sleep and take breaks — this page has breathing practices that take two or three minutes.' } },
        { max: 32, level: 'high', title:{ ru:'Высокий уровень', en:'High level' },
          text:{ ru:'Нагрузка сейчас явно больше, чем ты можешь спокойно нести. Часто дело не в том, что ты мало стараешься, а в том, что задач действительно слишком много. Стоит обсудить расписание со взрослым — иногда достаточно снять одну нагрузку, чтобы стало легче дышать.',
                 en:'The load right now is clearly more than you can carry comfortably. Often it is not that you try too little, but that there genuinely are too many demands. It is worth discussing your schedule with an adult — sometimes dropping one commitment is enough to breathe again.' } }
      ]
    }
  };

  const testList = () => [TESTS.anxiety, TESTS.mood, TESTS.stress];

  /* Подсчёт: обычные пункты складываем как есть, reverse-пункты
     переворачиваем относительно максимума шкалы. */
  function scoreTest(testId, answers) {
    const test = TESTS[testId];
    if (!test) return null;
    const topOption = test.options[test.options.length - 1].v;
    let total = 0;
    test.questions.forEach(q => {
      const v = +answers[q.id] || 0;
      total += q.reverse ? (topOption - v) : v;
    });
    const band = test.bands.find(b => total <= b.max) || test.bands[test.bands.length - 1];
    return { testId, total, max: test.max, level: band.level, band };
  }

  /* Сохраняем только итог и дату — не сами ответы. Ответы на такие
     вопросы хранить незачем, а их отсутствие — ещё один слой
     приватности. Держим последние 30 прохождений. */
  function saveResult(res) {
    const all = Sky.get(KEYS.results, []);
    all.push({ testId: res.testId, total: res.total, max: res.max, level: res.level, date: Sky.dayKey(), ts: Date.now() });
    Sky.set(KEYS.results, all.slice(-30));
    return all;
  }
  function results() { return Sky.get(KEYS.results, []); }
  function lastResult(testId) {
    const mine = results().filter(r => r.testId === testId);
    return mine.length ? mine[mine.length - 1] : null;
  }


  /* ============================================================
     ЧАСТЬ B. ДНЕВНИК СОСТОЯНИЯ
     ============================================================ */

  const MOOD_FACES = ['😞', '🙁', '😐', '🙂', '😄'];
  const MOOD_LABELS = [
    { ru:'Плохо',        en:'Bad' },
    { ru:'Так себе',     en:'Meh' },
    { ru:'Нормально',    en:'Okay' },
    { ru:'Хорошо',       en:'Good' },
    { ru:'Отлично',      en:'Great' }
  ];

  function diary() { return Sky.get(KEYS.diary, []); }

  /* Одна запись на день: повторное сохранение за ту же дату заменяет
     предыдущую, а не плодит дубликаты. */
  function saveDay(entry) {
    const all = diary().filter(d => d.date !== entry.date);
    all.push(entry);
    all.sort((a, b) => a.date.localeCompare(b.date));
    Sky.set(KEYS.diary, all.slice(-400));
    return all;
  }
  function removeDay(date) {
    Sky.set(KEYS.diary, diary().filter(d => d.date !== date));
    return diary();
  }
  function dayEntry(date) { return diary().find(d => d.date === date) || null; }

  /* Последние N дней подряд, включая дни без записи (они нужны
     графику как разрывы — иначе он врёт, склеивая далёкие даты). */
  function lastDays(n) {
    const out = [];
    const map = {};
    diary().forEach(d => { map[d.date] = d; });
    for (let i = n - 1; i >= 0; i--) {
      const key = Sky.dayKey(Date.now() - i * 864e5);
      out.push(map[key] ? Object.assign({ empty: false }, map[key]) : { date: key, empty: true });
    }
    return out;
  }

  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  /* ---------- Поиск закономерностей ----------
     Главное правило: лучше не сказать ничего, чем сказать
     выдуманное. Поэтому у каждой проверки есть минимум записей, а у
     сравнений — порог заметности. На трёх записях «ты чаще
     тревожишься по понедельникам» — это не закономерность, это шум,
     и подростку такое показывать нечестно. */
  const MIN_ENTRIES = 7;   /* меньше — вообще не ищем закономерностей */
  const MIN_GROUP  = 3;    /* минимум записей в каждой сравниваемой группе */

  function patterns() {
    const all = diary();
    const found = [];
    if (all.length < MIN_ENTRIES) {
      return { enough: false, need: MIN_ENTRIES - all.length, items: [] };
    }

    const withMood  = all.filter(d => typeof d.mood === 'number');
    const withAnx   = all.filter(d => typeof d.anxiety === 'number');
    const withSleep = all.filter(d => typeof d.sleep === 'number' && d.sleep > 0);

    /* 1. Сон и настроение. Сравниваем дни с коротким сном (<7 ч) и
          с нормальным. Разница от 0.5 балла по пятибалльной шкале —
          уже заметная. */
    const shortSleep = withSleep.filter(d => d.sleep < 7 && typeof d.mood === 'number').map(d => d.mood);
    const longSleep  = withSleep.filter(d => d.sleep >= 7 && typeof d.mood === 'number').map(d => d.mood);
    if (shortSleep.length >= MIN_GROUP && longSleep.length >= MIN_GROUP) {
      const dShort = avg(shortSleep), dLong = avg(longSleep);
      if (dLong - dShort >= 0.5) {
        found.push({
          icon: '😴',
          text: { ru: `В дни, когда ты спал(а) меньше 7 часов, настроение в среднем ниже — ${dShort.toFixed(1)} против ${dLong.toFixed(1)} из 5. Сон тут влияет сильнее, чем кажется.`,
                  en: `On days when you slept under 7 hours your mood averaged ${dShort.toFixed(1)} versus ${dLong.toFixed(1)} out of 5. Sleep matters more here than it seems.` }
        });
      }
    }

    /* 2. День недели. Ищем самый тяжёлый день, но только если он
          заметно отличается от остальных и записей по нему хватает. */
    if (withMood.length >= MIN_ENTRIES + 3) {
      const byDow = {};
      withMood.forEach(d => {
        const dow = (new Date(d.date + 'T00:00:00').getDay() + 6) % 7;
        (byDow[dow] = byDow[dow] || []).push(d.mood);
      });
      const dowNames = [
        {ru:'понедельникам',en:'Mondays'}, {ru:'вторникам',en:'Tuesdays'}, {ru:'средам',en:'Wednesdays'},
        {ru:'четвергам',en:'Thursdays'}, {ru:'пятницам',en:'Fridays'}, {ru:'субботам',en:'Saturdays'}, {ru:'воскресеньям',en:'Sundays'}
      ];
      let worst = null;
      Object.keys(byDow).forEach(k => {
        if (byDow[k].length < MIN_GROUP) return;
        const m = avg(byDow[k]);
        if (!worst || m < worst.m) worst = { dow: +k, m, n: byDow[k].length };
      });
      if (worst) {
        const others = withMood.filter(d => ((new Date(d.date + 'T00:00:00').getDay() + 6) % 7) !== worst.dow).map(d => d.mood);
        const restAvg = avg(others);
        if (others.length >= MIN_GROUP && restAvg - worst.m >= 0.6) {
          found.push({
            icon: '📅',
            text: { ru: `По ${Sky.L(dowNames[worst.dow])} настроение обычно ниже, чем в остальные дни (${worst.m.toFixed(1)} против ${restAvg.toFixed(1)}). Может, стоит посмотреть на расписание этого дня.`,
                    en: `On ${Sky.L(dowNames[worst.dow])} your mood is usually lower than on other days (${worst.m.toFixed(1)} versus ${restAvg.toFixed(1)}). It might be worth looking at that day’s timetable.` }
          });
        }
      }
    }

    /* 3. Тревога перед экзаменом. Дату экзамена берём из плана
          подготовки (plan.html) — если она есть, сравниваем тревогу в
          последние две недели перед ней с остальными днями. Ровно тот
          случай из задания: «ты чаще тревожишься перед экзаменами». */
    const plan = Sky.get('plan', null);
    if (plan && plan.exam && withAnx.length >= MIN_ENTRIES) {
      const examTs = new Date(plan.exam + 'T00:00:00').getTime();
      if (!isNaN(examTs)) {
        const near = [], far = [];
        withAnx.forEach(d => {
          const days = (examTs - new Date(d.date + 'T00:00:00').getTime()) / 864e5;
          if (days >= 0 && days <= 14) near.push(d.anxiety); else far.push(d.anxiety);
        });
        if (near.length >= MIN_GROUP && far.length >= MIN_GROUP) {
          const nAvg = avg(near), fAvg = avg(far);
          if (nAvg - fAvg >= 0.5) {
            found.push({
              icon: '📝',
              text: { ru: `Ты чаще тревожишься перед экзаменом: в две недели до него тревога в среднем ${nAvg.toFixed(1)} из 5, в остальные дни — ${fAvg.toFixed(1)}. Это нормальная реакция, и её можно заранее закладывать в план.`,
                      en: `You get more anxious before the exam: in the two weeks before it your anxiety averages ${nAvg.toFixed(1)} out of 5, versus ${fAvg.toFixed(1)} on other days. That is a normal reaction, and you can plan around it.` }
            });
          }
        }
      }
    }

    /* 4. Тренд: последние 7 дней против предыдущих 7. */
    if (withMood.length >= 10) {
      const recent = withMood.slice(-7).map(d => d.mood);
      const before = withMood.slice(-14, -7).map(d => d.mood);
      if (before.length >= MIN_GROUP) {
        const r = avg(recent), b = avg(before);
        if (r - b >= 0.6) {
          found.push({ icon:'📈', text:{ ru:`За последнюю неделю настроение в среднем выше, чем неделей раньше (${r.toFixed(1)} против ${b.toFixed(1)}). Хороший знак — заметь, что изменилось.`,
                                          en:`Over the last week your mood averaged higher than the week before (${r.toFixed(1)} versus ${b.toFixed(1)}). A good sign — notice what changed.` } });
        } else if (b - r >= 0.6) {
          found.push({ icon:'📉', text:{ ru:`За последнюю неделю настроение в среднем ниже, чем неделей раньше (${r.toFixed(1)} против ${b.toFixed(1)}). Если так продолжится — стоит с кем-нибудь поговорить.`,
                                          en:`Over the last week your mood averaged lower than the week before (${r.toFixed(1)} versus ${b.toFixed(1)}). If it keeps going — it is worth talking to someone.` } });
        }
      }
    }

    /* 5. Тревога и сон в обратную сторону — короткий сон в тревожные дни. */
    if (withAnx.length >= MIN_ENTRIES && withSleep.length >= MIN_ENTRIES) {
      const anxDays = all.filter(d => typeof d.anxiety === 'number' && typeof d.sleep === 'number' && d.sleep > 0);
      const high = anxDays.filter(d => d.anxiety >= 4).map(d => d.sleep);
      const low  = anxDays.filter(d => d.anxiety <= 2).map(d => d.sleep);
      if (high.length >= MIN_GROUP && low.length >= MIN_GROUP) {
        const h = avg(high), l = avg(low);
        if (l - h >= 0.7) {
          found.push({ icon:'🌙', text:{ ru:`В самые тревожные дни ты спишь меньше — в среднем ${h.toFixed(1)} ч против ${l.toFixed(1)} ч в спокойные. Тревога и недосып обычно разгоняют друг друга по кругу.`,
                                          en:`On your most anxious days you sleep less — ${h.toFixed(1)} h on average versus ${l.toFixed(1)} h on calm ones. Anxiety and lack of sleep usually feed each other.` } });
        }
      }
    }

    return { enough: true, need: 0, items: found };
  }


  /* ============================================================
     ЧАСТЬ C. УПРАЖНЕНИЯ
     ============================================================ */

  /* ---------- 5 дыхательных практик ----------
     phases — последовательность фаз: [ключ, секунды]. Ключ влияет на
     подпись и на то, расширяется круг, держится или сжимается.
     Подобраны так, чтобы выдох был не короче вдоха: именно
     удлинённый выдох связан с успокоением, а не «глубокое дыхание»
     само по себе. */
  const BREATHING = [
    {
      id: 'square',
      name: { ru: 'Квадратное дыхание', en: 'Box breathing' },
      desc: { ru: 'Вдох, пауза, выдох, пауза — все по 4 секунды. Простое и незаметное: можно делать прямо за партой.',
              en: 'Inhale, hold, exhale, hold — four seconds each. Simple and invisible: you can do it right at your desk.' },
      rounds: 6,
      phases: [['in',4], ['hold',4], ['out',4], ['hold',4]]
    },
    {
      id: '478',
      name: { ru: 'Дыхание 4–7–8', en: '4–7–8 breathing' },
      desc: { ru: 'Вдох на 4, задержка на 7, длинный выдох на 8. Сильно замедляет — хорошо перед сном.',
              en: 'Inhale for 4, hold for 7, long exhale for 8. Slows you down a lot — good before sleep.' },
      rounds: 4,
      phases: [['in',4], ['hold',7], ['out',8]]
    },
    {
      id: 'long-out',
      name: { ru: 'Удлинённый выдох', en: 'Extended exhale' },
      desc: { ru: 'Вдох на 4, выдох на 6, без задержек. Самое незаметное и самое универсальное упражнение.',
              en: 'Inhale for 4, exhale for 6, no holding. The least noticeable and the most universal exercise.' },
      rounds: 8,
      phases: [['in',4], ['out',6]]
    },
    {
      id: 'belly',
      name: { ru: 'Дыхание животом', en: 'Belly breathing' },
      desc: { ru: 'Ладонь на живот. Вдох на 4 — ладонь поднимается, выдох на 6 — опускается. Грудь почти не двигается.',
              en: 'Hand on your belly. Inhale for 4 — the hand rises, exhale for 6 — it falls. Your chest barely moves.' },
      rounds: 6,
      phases: [['in',4], ['hold',2], ['out',6]]
    },
    {
      id: 'sigh',
      name: { ru: 'Физиологический вздох', en: 'Physiological sigh' },
      desc: { ru: 'Два вдоха носом подряд — второй короткий, сверху — и длинный выдох ртом. Самый быстрый способ сбросить накат: хватает трёх повторов.',
              en: 'Two inhales through the nose in a row — the second short, on top — then a long exhale through the mouth. The fastest way to take the edge off: three rounds is enough.' },
      rounds: 5,
      phases: [['in',2], ['in2',1], ['out',6]]
    }
  ];

  const PHASE_LABELS = {
    in:   { ru: 'Вдох',           en: 'Breathe in' },
    in2:  { ru: 'Ещё вдох',       en: 'Top up the breath' },
    hold: { ru: 'Задержи',        en: 'Hold' },
    out:  { ru: 'Выдох',          en: 'Breathe out' }
  };

  /* Предупреждение к дыхательным практикам. Показываем всегда: при
     задержках дыхания и гипервентиляции реально может закружиться
     голова, и подросток должен знать, что это повод остановиться, а
     не «потерпеть подольше». */
  const BREATH_WARNING = {
    ru: 'Если закружилась голова, потемнело в глазах или стало неприятно — просто перестань и подыши как обычно. Это не соревнование, и «дотерпеть» тут незачем.',
    en: 'If you feel dizzy or unwell — just stop and breathe normally. This is not a competition, there is nothing to push through.'
  };

  /* ---------- 3 упражнения на заземление ---------- */
  const GROUNDING = [
    {
      id: '54321',
      name: { ru: '5–4–3–2–1', en: '5–4–3–2–1' },
      desc: { ru: 'Классика. Возвращает внимание из тревожных мыслей в комнату, где ты находишься.',
              en: 'The classic. Brings attention out of anxious thoughts and back into the room you are in.' },
      steps: [
        { n: 5, text:{ ru:'Найди глазами и назови 5 вещей, которые ты видишь', en:'Find and name 5 things you can see' } },
        { n: 4, text:{ ru:'Найди 4 вещи, которых можешь коснуться. Коснись их', en:'Find 4 things you can touch. Touch them' } },
        { n: 3, text:{ ru:'Прислушайся и назови 3 звука', en:'Listen and name 3 sounds' } },
        { n: 2, text:{ ru:'Назови 2 запаха — или два запаха, которые тебе нравятся', en:'Name 2 smells — or two smells you like' } },
        { n: 1, text:{ ru:'Назови 1 вкус во рту — или то, что хотел(а) бы попробовать', en:'Name 1 taste in your mouth — or one you would like' } }
      ]
    },
    {
      id: 'body',
      name: { ru: 'Опора и тело', en: 'Ground and body' },
      desc: { ru: 'Когда мысли несутся, помогает вернуть ощущение опоры — буквально почувствовать, что тебя что-то держит.',
              en: 'When thoughts race, it helps to feel supported — literally to notice that something is holding you up.' },
      steps: [
        { n: 1, text:{ ru:'Поставь обе стопы на пол. Почувствуй пол под пятками и пальцами', en:'Put both feet on the floor. Feel it under your heels and toes' } },
        { n: 2, text:{ ru:'Прижмись спиной к спинке стула. Заметь, где именно ты её касаешься', en:'Press your back into the chair. Notice exactly where you touch it' } },
        { n: 3, text:{ ru:'Сожми кулаки на 5 секунд и отпусти. Заметь разницу', en:'Clench your fists for 5 seconds and release. Notice the difference' } },
        { n: 4, text:{ ru:'Разожми плечи и опусти их вниз. Сделай один спокойный выдох', en:'Unclench your shoulders and drop them. Take one calm exhale' } },
        { n: 5, text:{ ru:'Скажи про себя: «Сейчас я здесь, и прямо сейчас я в безопасности»', en:'Say to yourself: "Right now I am here, and right now I am safe"' } }
      ]
    },
    {
      id: 'categories',
      name: { ru: 'Категории', en: 'Categories' },
      desc: { ru: 'Занимает голову ровно настолько, чтобы тревожная мысль перестала крутиться по кругу. Хорошо работает ночью.',
              en: 'Occupies your head just enough for an anxious thought to stop looping. Works well at night.' },
      steps: [
        { n: 1, text:{ ru:'Назови про себя 5 городов', en:'Name 5 cities to yourself' } },
        { n: 2, text:{ ru:'Назови 5 животных на букву «К»', en:'Name 5 animals starting with "B"' } },
        { n: 3, text:{ ru:'Назови 5 вещей синего цвета', en:'Name 5 blue things' } },
        { n: 4, text:{ ru:'Посчитай от 100 назад по 7: 100, 93, 86…', en:'Count back from 100 by 7: 100, 93, 86…' } },
        { n: 5, text:{ ru:'Назови 5 вещей, которые ты ждёшь на этой неделе', en:'Name 5 things you are looking forward to this week' } }
      ]
    }
  ];

  /* ---------- Мини-медитации (Web Speech API) ----------
     Текст разбит на фразы с паузами: [текст, пауза после него в мс].
     Пауза важнее самого текста — без неё это не медитация, а
     скороговорка. Если синтез речи недоступен, страница показывает
     те же фразы текстом по очереди, и упражнение работает. */
  const MEDITATIONS = [
    {
      id: 'calm3',
      name: { ru: 'Три минуты тишины', en: 'Three minutes of quiet' },
      mins: 3,
      desc: { ru: 'Короткая пауза посреди дня. Можно слушать с закрытыми глазами.',
              en: 'A short pause in the middle of the day. You can listen with your eyes closed.' },
      script: [
        [{ru:'Сядь удобно. Спина прямая, плечи опущены.',en:'Sit comfortably. Back straight, shoulders down.'}, 4000],
        [{ru:'Закрой глаза, если тебе так спокойнее.',en:'Close your eyes if that feels calmer.'}, 4000],
        [{ru:'Просто заметь, что ты дышишь. Ничего не меняй.',en:'Just notice that you are breathing. Change nothing.'}, 6000],
        [{ru:'Вдох… и медленный выдох.',en:'Inhale… and a slow exhale.'}, 6000],
        [{ru:'Если мысли уносят — это нормально. Просто вернись к дыханию.',en:'If thoughts carry you away — that is normal. Just come back to the breath.'}, 7000],
        [{ru:'Почувствуй, как воздух проходит через нос.',en:'Feel the air passing through your nose.'}, 7000],
        [{ru:'Ещё один вдох… и выдох длиннее вдоха.',en:'One more inhale… and an exhale longer than the inhale.'}, 7000],
        [{ru:'Заметь, что тебя держит: стул, пол, земля под ним.',en:'Notice what holds you: the chair, the floor, the ground beneath it.'}, 7000],
        [{ru:'Тебе сейчас не нужно ничего решать.',en:'You do not need to solve anything right now.'}, 7000],
        [{ru:'Сделай ещё один спокойный вдох и медленно открой глаза.',en:'Take one more calm breath and slowly open your eyes.'}, 5000]
      ]
    },
    {
      id: 'sleep',
      name: { ru: 'Перед сном', en: 'Before sleep' },
      mins: 4,
      desc: { ru: 'Помогает отпустить прокрутку дня, когда не получается заснуть.',
              en: 'Helps let go of replaying the day when you cannot fall asleep.' },
      script: [
        [{ru:'Ляг удобно. Свет лучше выключить.',en:'Lie down comfortably. Better with the lights off.'}, 5000],
        [{ru:'Сделай медленный вдох через нос и выдох через рот.',en:'Take a slow inhale through the nose and exhale through the mouth.'}, 6000],
        [{ru:'Расслабь лоб. Разожми челюсть.',en:'Relax your forehead. Unclench your jaw.'}, 6000],
        [{ru:'Опусти плечи. Отпусти руки.',en:'Drop your shoulders. Let your arms go.'}, 6000],
        [{ru:'Расслабь живот. Он может быть мягким.',en:'Relax your belly. It is allowed to be soft.'}, 6000],
        [{ru:'Отпусти ноги — от бёдер до кончиков пальцев.',en:'Let your legs go — from hips to toes.'}, 7000],
        [{ru:'Если в голове крутится сегодняшний день — это просто мысли. Они могут идти своим чередом.',en:'If today keeps replaying — those are just thoughts. They can run their course.'}, 8000],
        [{ru:'Завтрашние дела подождут до завтра. Сейчас твоя задача — только лежать и дышать.',en:'Tomorrow can wait until tomorrow. Right now your only job is to lie still and breathe.'}, 8000],
        [{ru:'Вдох… выдох… и ещё длиннее выдох.',en:'Inhale… exhale… and an even longer exhale.'}, 8000],
        [{ru:'Ты уже сделал(а) всё, что нужно на сегодня.',en:'You have already done everything today needed.'}, 8000]
      ]
    },
    {
      id: 'exam',
      name: { ru: 'Перед контрольной', en: 'Before a test' },
      mins: 2,
      desc: { ru: 'Две минуты прямо перед работой — чтобы руки перестали дрожать и вернулась голова.',
              en: 'Two minutes right before the paper — to steady your hands and get your head back.' },
      script: [
        [{ru:'Поставь обе стопы на пол. Выпрямись.',en:'Put both feet on the floor. Sit up.'}, 4000],
        [{ru:'Вдох на четыре счёта… и выдох на шесть.',en:'Inhale for four… and exhale for six.'}, 7000],
        [{ru:'Волноваться сейчас нормально. Это не значит, что ты не готов(а).',en:'Being nervous right now is normal. It does not mean you are unprepared.'}, 7000],
        [{ru:'Твоё тело просто собралось. Это его способ помочь.',en:'Your body has simply mobilised. That is its way of helping.'}, 7000],
        [{ru:'Ещё вдох… и длинный выдох.',en:'One more inhale… and a long exhale.'}, 7000],
        [{ru:'Начни с того задания, которое точно умеешь. Остальное подтянется.',en:'Start with the task you definitely know how to do. The rest will follow.'}, 7000],
        [{ru:'Одна работа — это одна работа. Она не решает, кто ты.',en:'One paper is one paper. It does not decide who you are.'}, 6000]
      ]
    }
  ];

  /* Проверка доступности синтеза речи. Голоса в браузере грузятся
     асинхронно, поэтому наличие ru-RU проверяем не здесь, а в момент
     запуска — см. psychologist.html. */
  function speechAvailable() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
  }

  /* ---------- Записывание мыслей (КПТ) ----------
     Урезанный дневник автоматических мыслей: ситуация — мысль —
     чувство — что за и что против — более спокойная формулировка —
     чувство снова. Смысл именно в последнем шаге: увидеть, что после
     разбора накал обычно падает, пусть и не до нуля. */
  const CBT_FIELDS = [
    { id:'situation', label:{ru:'Что случилось',en:'What happened'},
      hint:{ru:'Только факты, без оценок. «Получил(а) 3 за контрольную по алгебре»',en:'Facts only, no judgement. "Got a low mark on the algebra test"'} },
    { id:'thought',   label:{ru:'Какая мысль пришла в голову',en:'The thought that came up'},
      hint:{ru:'Дословно, как подумал(а). «Я тупой(ая), я ничего не сдам»',en:'Word for word, as you thought it. "I am stupid, I will fail everything"'} },
    { id:'feeling',   label:{ru:'Что почувствовал(а)',en:'What you felt'},
      hint:{ru:'Одно-два слова: страх, стыд, злость, отчаяние',en:'One or two words: fear, shame, anger, despair'} },
    { id:'for',       label:{ru:'Что говорит ЗА эту мысль',en:'Evidence FOR the thought'},
      hint:{ru:'Честно: какие факты её подтверждают',en:'Honestly: what facts support it'} },
    { id:'against',   label:{ru:'Что говорит ПРОТИВ',en:'Evidence AGAINST'},
      hint:{ru:'Тоже честно. Что эта мысль не учитывает? Что бы ты сказал(а) другу на своём месте?',en:'Honestly too. What does the thought ignore? What would you say to a friend in your place?'} },
    { id:'balanced',  label:{ru:'Более спокойная формулировка',en:'A calmer way to put it'},
      hint:{ru:'Не «всё прекрасно», а что-то более точное. «Я завалил(а) одну тему, её можно разобрать»',en:'Not "everything is great", but something more accurate. "I failed one topic, and that topic can be worked through"'} }
  ];

  function thoughts() { return Sky.get(KEYS.thoughts, []); }
  function saveThought(rec) {
    const all = thoughts();
    all.push(Object.assign({ ts: Date.now(), date: Sky.dayKey() }, rec));
    Sky.set(KEYS.thoughts, all.slice(-100));
    return all;
  }
  function removeThought(index) {
    const all = thoughts();
    all.splice(index, 1);
    Sky.set(KEYS.thoughts, all);
    return all;
  }


  /* ============================================================
     ЭКСПОРТ
     ============================================================ */
  return {
    KEYS, HELPLINES, DISCLAIMER,
    /* A */ TESTS, testList, scoreTest, saveResult, results, lastResult,
    /* B */ MOOD_FACES, MOOD_LABELS, diary, saveDay, removeDay, dayEntry, lastDays, patterns,
            MIN_ENTRIES,
    /* C */ BREATHING, PHASE_LABELS, BREATH_WARNING, GROUNDING, MEDITATIONS, speechAvailable,
            CBT_FIELDS, thoughts, saveThought, removeThought
  };
})();
