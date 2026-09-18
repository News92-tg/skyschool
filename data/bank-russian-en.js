/* Русский язык для англоговорящих (Russian for English speakers).
   Курс от «Привет» до «Как дела? Что делаешь?».

   ВАЖНО ПРО ЯЗЫК ДАННЫХ. У всех остальных банков проекта поля
   двуязычные ({ru, en}), потому что там ученик — русскоязычный, а
   английский интерфейс просто перевод. Здесь наоборот: ученик
   англоговорящий, русский — это ИЗУЧАЕМЫЙ материал. Поэтому:
     ru  — материал (кириллица, его нельзя «перевести»),
     tl  — транслитерация с ударением (privét, а не privet),
     en  — значение по-английски,
     lit — дословный перевод, когда он что-то объясняет,
     note— короткое пояснение по-английски.
   Комментарии в коде остаются русскими — как во всём проекте.

   Структура:
     RU_EN.ALPHABET   — буквы с транслитерацией и подсказкой по звуку
     RU_EN.translit() — живая транслитерация любой строки (не таблица!)
     RU_EN.lessons[]  — уроки: phrases[] (материал) и gaps[] (пропуски)
     RU_EN.dialogue   — итоговый диалог 7-го урока

   Ударение в tl отмечено острым ударением на гласной (privét).
   Это не «украшение»: без ударения английский читатель ставит его
   по английским правилам (PRI-vet вместо pri-VÉT) и его не понимают. */

window.RU_EN = (function () {

  /* ---------- алфавит ----------
     hint — как звучит буква для англоговорящего.
     trap: true — буква, которая выглядит как латинская, но читается иначе.
     Это главная ловушка первых недель: «Ресторан» читают как "Pectopah". */
  const ALPHABET = [
    { ru:'А а', tl:'a',    hint:'like a in father' },
    { ru:'Б б', tl:'b',    hint:'like b in bed' },
    { ru:'В в', tl:'v',    hint:'like v in van',            trap:true },
    { ru:'Г г', tl:'g',    hint:'like g in go' },
    { ru:'Д д', tl:'d',    hint:'like d in dog' },
    { ru:'Е е', tl:'ye',   hint:'like ye in yes' },
    { ru:'Ё ё', tl:'yo',   hint:'like yo in yolk; always stressed' },
    { ru:'Ж ж', tl:'zh',   hint:'like s in pleasure' },
    { ru:'З з', tl:'z',    hint:'like z in zoo' },
    { ru:'И и', tl:'i',    hint:'like ee in see' },
    { ru:'Й й', tl:'y',    hint:'like y in boy' },
    { ru:'К к', tl:'k',    hint:'like k in kite' },
    { ru:'Л л', tl:'l',    hint:'like l in low' },
    { ru:'М м', tl:'m',    hint:'like m in map' },
    { ru:'Н н', tl:'n',    hint:'like n in note',            trap:true },
    { ru:'О о', tl:'o',    hint:'like o in more when stressed; like a when not' },
    { ru:'П п', tl:'p',    hint:'like p in pen' },
    { ru:'Р р', tl:'r',    hint:'rolled r, as in Spanish pero', trap:true },
    { ru:'С с', tl:'s',    hint:'like s in sun',             trap:true },
    { ru:'Т т', tl:'t',    hint:'like t in top' },
    { ru:'У у', tl:'u',    hint:'like oo in boot',           trap:true },
    { ru:'Ф ф', tl:'f',    hint:'like f in fan' },
    { ru:'Х х', tl:'kh',   hint:'like ch in Scottish loch',  trap:true },
    { ru:'Ц ц', tl:'ts',   hint:'like ts in cats' },
    { ru:'Ч ч', tl:'ch',   hint:'like ch in chair' },
    { ru:'Ш ш', tl:'sh',   hint:'like sh in shop' },
    { ru:'Щ щ', tl:'shch', hint:'a longer, softer sh — as in fresh cheese' },
    { ru:'Ъ ъ', tl:'"',    hint:'hard sign: silent, it only separates sounds' },
    { ru:'Ы ы', tl:'y',    hint:'no English match: say ee with your tongue pulled back' },
    { ru:'Ь ь', tl:'\'',   hint:'soft sign: silent, it softens the letter before it' },
    { ru:'Э э', tl:'e',    hint:'like e in bed' },
    { ru:'Ю ю', tl:'yu',   hint:'like u in universe' },
    { ru:'Я я', tl:'ya',   hint:'like ya in yard' }
  ];

  /* ---------- транслитерация ----------
     Работает на любой строке, а не только на словах из курса: на
     странице есть поле, куда можно вставить своё слово. */
  const MAP = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh',
    'щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };

  /* Буква «е» — единственная, где одной таблицы мало. Она читается
     как «йэ» в начале слова, после гласной и после ь/ъ (Елена →
     Yelena, поезд → poyezd), а после согласной — просто «э»
     (привет → privet, а не privyet). Отдать её как «ye» всегда —
     самая частая ошибка самодельных транслитераторов: получается
     «privyet», и англоговорящий честно так и читает.
     Сравнивать не с чем, кроме предыдущей буквы, — её и смотрим. */
  const VOWELS = 'аеёиоуыэюя';
  const SOFT = 'ъь';

  function translit(str) {
    if (!str) return '';
    let out = '';
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const low = ch.toLowerCase();
      let rep = MAP[low];
      if (rep === undefined) { out += ch; continue; }   /* пробелы, знаки, латиница — как есть */
      if (rep === '') continue;                          /* ъ и ь звука не имеют */

      if (low === 'е') {
        const prev = i > 0 ? s[i - 1].toLowerCase() : '';
        const start = !prev || (VOWELS.indexOf(prev) < 0 && SOFT.indexOf(prev) < 0 && !/[а-яё]/.test(prev));
        if (start || VOWELS.indexOf(prev) >= 0 || SOFT.indexOf(prev) >= 0) rep = 'ye';
      }

      /* Заглавную кириллицу передаём заглавной латиницей: Ш → Sh, а не SH */
      out += (ch === low) ? rep : rep[0].toUpperCase() + rep.slice(1);
    }
    return out;
  }

  /* ---------- уроки ----------
     phrases: ru — кириллица, tl — транслитерация с ударением,
              en — значение, lit — дословно (если полезно),
              note — пояснение по-английски,
              you — 'ty' | 'vy' | null: к кому обращение.
     gaps:    предложение с пропуском; wrong — правдоподобные,
              но неверные варианты (не случайный мусор). */
  const lessons = [

    /* ===== Урок 1. Приветствия ===== */
    { id:'l1', icon:'👋',
      title:'Hello and goodbye',
      intro:'Russian splits “you” into informal ты (ty) and formal вы (vy). The greeting you pick shows which one you mean, so start here.',
      phrases:[
        { ru:'Привет', tl:'privét', en:'Hi', you:'ty',
          note:'Informal. Friends, classmates, anyone your age or younger.' },
        { ru:'Здравствуйте', tl:'zdrávstvuyte', en:'Hello', you:'vy',
          note:'Formal and always safe with strangers. The first в is silent: say “ZDRAST-vuy-tye”.' },
        { ru:'Доброе утро', tl:'dóbroye útro', en:'Good morning', lit:'kind morning',
          note:'Used until about noon.' },
        { ru:'Добрый день', tl:'dóbryy den’', en:'Good afternoon', lit:'kind day',
          note:'The default daytime greeting; works with anyone.' },
        { ru:'Добрый вечер', tl:'dóbryy vécher', en:'Good evening', lit:'kind evening' },
        { ru:'Пока', tl:'paká', en:'Bye', you:'ty',
          note:'Informal. Note the first о sounds like a — unstressed о always does.' },
        { ru:'До свидания', tl:'da svidániya', en:'Goodbye', lit:'until the meeting', you:'vy',
          note:'Formal farewell, the pair to Здравствуйте.' }
      ],
      gaps:[
        { ru:'___, меня зовут Анна.', answer:'Привет', tl:'privét',
          en:'___, my name is Anna.', wrong:['Пока','До свидания'],
          why:'A greeting opens the sentence; Пока and До свидания are for leaving.' },
        { ru:'Добрый ___! Как дела?', answer:'день', tl:'den’',
          en:'Good ___! How are you?', wrong:['утро','вечер'],
          why:'Добрый is masculine, so it needs the masculine день. Утро is neuter — that one takes Доброе.' },
        { ru:'___, увидимся завтра.', answer:'Пока', tl:'paká',
          en:'___, see you tomorrow.', wrong:['Привет','Здравствуйте'],
          why:'You are leaving, so you need a farewell, not a greeting.' }
      ] },

    /* ===== Урок 2. Чтение кириллицы ===== */
    { id:'l2', icon:'🔤',
      title:'Reading Cyrillic',
      intro:'Six letters look Latin but sound different: В=V, Н=N, Р=R, С=S, У=U, Х=KH. Until those click, “Ресторан” reads as “Pectopah”. These words are all near-cognates, so you can check yourself.',
      phrases:[
        { ru:'Ресторан', tl:'restorán', en:'restaurant',
          note:'Р=R, С=S, Н=N. Same word you already know.' },
        { ru:'Метро', tl:'metró', en:'metro, subway' },
        { ru:'Кофе', tl:'kófe', en:'coffee',
          note:'Indeclinable and masculine — an exception worth remembering early.' },
        { ru:'Спорт', tl:'sport', en:'sport' },
        { ru:'Студент', tl:'studént', en:'student (male)',
          note:'Female student is студентка (studéntka).' },
        { ru:'Америка', tl:'amérika', en:'America' },
        { ru:'Хорошо', tl:'kharashó', en:'good, fine',
          note:'Х is the KH sound; both unstressed о sound like a.' }
      ],
      gaps:[
        { ru:'Я живу в ___.', answer:'Америке', tl:'amérike',
          en:'I live in ___.', wrong:['Америка','Америку'],
          why:'After в meaning “in a place”, Russian uses the prepositional case: Америка → в Америке.' },
        { ru:'Это ___ — здесь можно поесть.', answer:'ресторан', tl:'restorán',
          en:'This is a ___ — you can eat here.', wrong:['метро','спорт'],
          why:'The second half of the sentence says you can eat there.' }
      ] },

    /* ===== Урок 3. Вежливость ===== */
    { id:'l3', icon:'🙏',
      title:'Please and thank you',
      intro:'Пожалуйста does double duty: “please” when you ask, “you’re welcome” when you answer. Извините and Простите both mean sorry — the difference is small and either is fine.',
      phrases:[
        { ru:'Спасибо', tl:'spasíba', en:'Thank you', lit:'God save (you)',
          note:'The final о is unstressed, so it sounds like a: spa-SEE-ba.' },
        { ru:'Большое спасибо', tl:'bal’shóye spasíba', en:'Thank you very much', lit:'big thank you' },
        { ru:'Пожалуйста', tl:'pazhálusta', en:'Please / You’re welcome',
          note:'Four syllables when written, three when spoken: pa-ZHAL-sta.' },
        { ru:'Извините', tl:'izvinítye', en:'Excuse me / Sorry', you:'vy',
          note:'Use this to get someone’s attention as well.' },
        { ru:'Простите', tl:'prastítye', en:'Sorry / Forgive me', you:'vy',
          note:'Slightly stronger than Извините when you actually did something.' },
        { ru:'Ничего страшного', tl:'nichevó stráshnava', en:'No problem', lit:'nothing scary',
          note:'In ничего the г sounds like v — a fixed irregularity, not a typo.' },
        { ru:'Да', tl:'da', en:'Yes' },
        { ru:'Нет', tl:'nyet', en:'No' }
      ],
      gaps:[
        { ru:'— Спасибо! — ___.', answer:'Пожалуйста', tl:'pazhálusta',
          en:'— Thank you! — ___.', wrong:['Спасибо','Извините'],
          why:'Пожалуйста is the standard reply to thanks.' },
        { ru:'___, где метро?', answer:'Извините', tl:'izvinítye',
          en:'___, where is the metro?', wrong:['Спасибо','Пока'],
          why:'You are stopping a stranger, and Извините is how Russian starts that.' }
      ] },

    /* ===== Урок 4. Знакомство ===== */
    { id:'l4', icon:'🤝',
      title:'Saying your name',
      intro:'Russian has no verb “to be” in the present, so “I am John” is literally “I — John”. Names work through зовут: literally “they call me”.',
      phrases:[
        { ru:'Меня зовут Джон', tl:'minyá zavút Dzhon', en:'My name is John', lit:'me they-call John',
          note:'Nothing changes except the name: Меня зовут + your name.' },
        { ru:'Как тебя зовут?', tl:'kak tibyá zavút', en:'What’s your name?', lit:'how you they-call', you:'ty' },
        { ru:'Как вас зовут?', tl:'kak vas zavút', en:'What’s your name? (formal)', you:'vy' },
        { ru:'Очень приятно', tl:'óchin’ priyátna', en:'Nice to meet you', lit:'very pleasant' },
        { ru:'Я из Америки', tl:'ya iz amériki', en:'I’m from America',
          note:'After из the country changes: Америка → из Америки.' },
        { ru:'Я американец', tl:'ya amerikánits', en:'I’m American (man speaking)' },
        { ru:'Я американка', tl:'ya amerikánka', en:'I’m American (woman speaking)',
          note:'Russian marks the speaker’s gender here — pick the one that fits you.' },
        { ru:'Я не говорю по-русски', tl:'ya ni gavaryú pa-rússki', en:'I don’t speak Russian',
          note:'The single most useful sentence in your first week.' }
      ],
      gaps:[
        { ru:'Меня ___ Анна.', answer:'зовут', tl:'zavút',
          en:'My name is Anna.', wrong:['зову','звать'],
          why:'The fixed phrase is Меня зовут — third person plural, literally “they call me”.' },
        { ru:'Я из ___.', answer:'Америки', tl:'amériki',
          en:'I’m from ___.', wrong:['Америка','Америке'],
          why:'из always takes the genitive: Америка → из Америки.' },
        { ru:'Как ___ зовут? (to a stranger)', answer:'вас', tl:'vas',
          en:'What’s your name? (formal)', wrong:['тебя','ты'],
          why:'A stranger gets the formal вы, and after зовут it becomes вас.' }
      ] },

    /* ===== Урок 5. Как дела ===== */
    { id:'l5', icon:'💬',
      title:'How are you?',
      intro:'Ask Как дела? and you get a real answer, not a reflex “fine”. Нормально is the honest middle — neither good nor bad — and it is the most common reply of all.',
      phrases:[
        { ru:'Как дела?', tl:'kak dilá', en:'How are you?', lit:'how (are the) affairs', you:'ty' },
        { ru:'Как у вас дела?', tl:'kak u vas dilá', en:'How are you? (formal)', you:'vy' },
        { ru:'Хорошо', tl:'kharashó', en:'Good' },
        { ru:'Отлично', tl:'atlíchna', en:'Great' },
        { ru:'Нормально', tl:'narmál’na', en:'OK, not bad', lit:'normally',
          note:'Neutral, not negative. The default honest answer.' },
        { ru:'Не очень', tl:'ni óchin’', en:'Not great', lit:'not very' },
        { ru:'Плохо', tl:'plókha', en:'Bad' },
        { ru:'А у тебя?', tl:'a u tibyá', en:'And you?', you:'ty',
          note:'Always bounce the question back — leaving it out sounds cold.' }
      ],
      gaps:[
        { ru:'— Как дела? — ___, спасибо.', answer:'Хорошо', tl:'kharashó',
          en:'— How are you? — ___, thanks.', wrong:['Пожалуйста','Здравствуйте'],
          why:'The slot needs an answer about your state, not a politeness formula.' },
        { ru:'Всё ___, не волнуйся.', answer:'нормально', tl:'narmál’na',
          en:'Everything is ___, don’t worry.', wrong:['нормальный','нормальная'],
          why:'Всё is neuter and this is an adverb slot, so the -о form is the one that fits.' },
        { ru:'— Хорошо. А у ___?', answer:'тебя', tl:'tibyá',
          en:'— Good. And you?', wrong:['ты','тебе'],
          why:'After у Russian uses the genitive: ты → тебя.' }
      ] },

    /* ===== Урок 6. Что делаешь ===== */
    { id:'l6', icon:'📖',
      title:'What are you doing?',
      intro:'One present tense covers both “I read” and “I am reading”. Verbs ending in -ю are “I”, in -ешь/-ишь are “you”.',
      phrases:[
        { ru:'Что делаешь?', tl:'shto délayesh’', en:'What are you doing?', you:'ty',
          note:'In что the ч sounds like sh — another fixed irregularity.' },
        { ru:'Что ты делаешь?', tl:'shto ty délayesh’', en:'What are you doing?', you:'ty',
          note:'Adding ты is optional; the verb ending already says who.' },
        { ru:'Что вы делаете?', tl:'shto vy délayetye', en:'What are you doing? (formal)', you:'vy' },
        { ru:'Я читаю', tl:'ya chitáyu', en:'I’m reading', note:'Also means “I read” — Russian has one present tense.' },
        { ru:'Я работаю', tl:'ya rabótayu', en:'I’m working' },
        { ru:'Я отдыхаю', tl:'ya atdykháyu', en:'I’m resting' },
        { ru:'Я учу русский', tl:'ya uchú rússkiy', en:'I’m learning Russian' },
        { ru:'Ничего особенного', tl:'nichevó asóbennava', en:'Nothing special' }
      ],
      gaps:[
        { ru:'Я ___ русский язык.', answer:'учу', tl:'uchú',
          en:'I’m learning the Russian language.', wrong:['учишь','учит'],
          why:'The subject is я, so the verb needs the -у ending.' },
        { ru:'Что ты ___?', answer:'делаешь', tl:'délayesh’',
          en:'What are you doing?', wrong:['делаю','делает'],
          why:'ты takes the -ешь ending; -ю belongs to я.' },
        { ru:'— Что делаешь? — ___ особенного.', answer:'Ничего', tl:'nichevó',
          en:'— What are you doing? — Nothing special.', wrong:['Никто','Нигде'],
          why:'Ничего is “nothing”; никто is “nobody” and нигде is “nowhere”.' }
      ] }
  ];

  /* ---------- итоговый диалог ----------
     Собирает всё, что было в шести уроках: приветствие, знакомство,
     «как дела», «что делаешь», прощание. Ничего нового здесь нет
     специально — это проверка, а не новый материал. */
  const dialogue = {
    title:'Putting it together',
    intro:'Every line below uses only words from lessons 1–6.',
    lines:[
      { who:'A', ru:'Привет! Меня зовут Анна. Как тебя зовут?',
        tl:'privét! minyá zavút Ánna. kak tibyá zavút?',
        en:'Hi! My name is Anna. What’s your name?' },
      { who:'B', ru:'Привет, Анна! Меня зовут Джон. Очень приятно.',
        tl:'privét, Ánna! minyá zavút Dzhon. óchin’ priyátna.',
        en:'Hi, Anna! My name is John. Nice to meet you.' },
      { who:'A', ru:'Очень приятно! Как дела?',
        tl:'óchin’ priyátna! kak dilá?',
        en:'Nice to meet you! How are you?' },
      { who:'B', ru:'Нормально, спасибо. А у тебя?',
        tl:'narmál’na, spasíba. a u tibyá?',
        en:'OK, thanks. And you?' },
      { who:'A', ru:'Хорошо! Что делаешь?',
        tl:'kharashó! shto délayesh’?',
        en:'Good! What are you doing?' },
      { who:'B', ru:'Я учу русский. Ничего особенного.',
        tl:'ya uchú rússkiy. nichevó asóbennava.',
        en:'I’m learning Russian. Nothing special.' },
      { who:'A', ru:'Отлично! Пока!',
        tl:'atlíchna! paká!',
        en:'Great! Bye!' },
      { who:'B', ru:'Пока!', tl:'paká!', en:'Bye!' }
    ]
  };

  return { ALPHABET, translit, lessons, dialogue };
})();
