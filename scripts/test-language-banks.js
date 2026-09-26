/* ============================================================
   Проверка языковых банков: английского, польского и курса
   «Russian for English speakers».

   Запуск:  node scripts/test-language-banks.js

   ЗАЧЕМ ЭТО НУЖНО, ЕСЛИ ЗАДАНИЯ ПИСАЛИСЬ ВРУЧНУЮ.
   Ручная вычитка ловит смысл, но не ловит то, что глазами не
   видно: невидимый гомоглиф (латинская "c" внутри русского слова),
   потерянную диакритику, совпадающие варианты ответа, задание на
   аудирование, в котором ответ написан в самом вопросе. Это ровно
   те ошибки, которые доживают до ученика. Поэтому смысл проверяют
   глаза, а форму — этот скрипт.

   ПРО «FEN-ПОДОБНЫЕ ОШИБКИ» ИЗ ЗАДАНИЯ. FEN — это шахматная запись
   позиции, в языковом банке её нет и быть не может; видимо, пункт
   переехал из шахматной задачи. Но смысл у него читается: «строки,
   которые выглядят правильно, а на деле сломаны». Здесь это
   гомоглифы, диакритика и дубли — они и проверяются.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const stats = {};

function fail(where, msg) { problems.push(where + ': ' + msg); }

/* Файлы банков написаны для браузера (window.BANKS = …), поэтому
   подсовываем им поддельный window вместо правки исходников. */
function load(file, globals) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sandbox = globals || {};
  const w = sandbox.window || (sandbox.window = {});
  new Function('window', 'speechSynthesis', code)(w, undefined);
  return w;
}

/* ---------- 1. Гомоглифы ----------
   Слово, в котором смешаны кириллица и латиница, — это почти всегда
   опечатка от копирования: «сhleb» с русской «с» выглядит как
   польское слово, но не найдётся ни одним поиском и не озвучится. */
const CYR = /[Ѐ-ӿ]/;
const LAT = /[A-Za-z]/;

function checkHomoglyphs(where, value) {
  if (typeof value !== 'string') return;
  const words = value.split(/[^\p{L}]+/u).filter(Boolean);
  for (const w of words) {
    if (CYR.test(w) && LAT.test(w)) {
      fail(where, 'смешаны алфавиты в слове "' + w + '"');
    }
  }
}

/* ---------- 2. Диакритика ----------
   Список намеренно короткий и только из слов, встречающихся в банке:
   проверяем не «польский язык вообще», а то, что мы сами написали.
   Двусмысленные пары (piec — печь, pięć — пять) не включены: там
   голая форма тоже настоящее слово, и автоматика только соврёт. */
const DIACRITICS = {
  'zlotych':'złotych', 'zloty':'złoty', 'zlote':'złote',
  'sniadanie':'śniadanie', 'jablko':'jabłko', 'jablka':'jabłka',
  'ksiazka':'książka', 'ksiazki':'książki', 'maz':'mąż',
  'dziewiec':'dziewięć', 'dziesiec':'dziesięć', 'szesc':'sześć',
  'miesa':'mięsa', 'mieso':'mięso', 'stol':'stół', 'corka':'córka',
  'zona':'żona', 'wies':'wieś', 'pociag':'pociąg', 'czwartek':'czwartek',
  'srода':'środa', 'sroda':'środa', 'piatek':'piątek',
  'zmeczony':'zmęczony', 'zmeczona':'zmęczona', 'opozniony':'opóźniony',
  'zamknac':'zamknąć', 'sprzatac':'sprzątać', 'zapomniec':'zapomnieć',
  'mozesz':'możesz', 'prosze':'proszę', 'dziekuje':'dziękuję',
  'wtorek':'wtorek', 'ktora':'która', 'godzina':'godzina'
};

function checkDiacritics(where, value) {
  if (typeof value !== 'string') return;
  const words = value.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
  for (const w of words) {
    const right = DIACRITICS[w];
    if (right && right !== w) {
      fail(where, 'потеряна диакритика: "' + w + '" вместо "' + right + '"');
    }
  }
}

/* ---------- 3. Двуязычное поле ---------- */
function checkPair(where, obj, name) {
  if (!obj || typeof obj !== 'object') { fail(where, 'нет поля ' + name); return; }
  for (const lang of ['ru', 'en']) {
    const v = obj[lang];
    if (typeof v !== 'string' || !v.trim()) {
      fail(where, name + '.' + lang + ' пустое');
      continue;
    }
    checkHomoglyphs(where + ' → ' + name + '.' + lang, v);
  }
}

/* ---------- 4. Проверка одного банка ---------- */
function checkBank(bank, opts) {
  const o = opts || {};
  const seen = new Set();
  const counts = { total:0, byLevel:{}, byCat:{}, byTheme:{}, audio:0, tr:0 };

  for (const t of bank.tasks) {
    const where = bank.id + '/' + t.id;
    counts.total++;

    if (seen.has(t.id)) fail(where, 'повторяющийся id');
    seen.add(t.id);

    /* обязательные поля */
    checkPair(where, t.topic, 'topic');
    checkPair(where, t.text, 'text');
    checkPair(where, t.hint, 'hint');
    checkPair(where, t.solution, 'solution');

    if (['oge','ege','both'].indexOf(t.exam) < 0) fail(where, 'неизвестный exam: ' + t.exam);
    if (['easy','medium','hard'].indexOf(t.difficulty) < 0) fail(where, 'неизвестная сложность: ' + t.difficulty);

    /* варианты ответа */
    if (!Array.isArray(t.options) || t.options.length !== 4) {
      fail(where, 'должно быть ровно 4 варианта, а не ' + (t.options || []).length);
    } else {
      const flat = [];
      t.options.forEach((opt, i) => {
        checkPair(where + ' opt' + i, opt, 'option');
        flat.push(String(opt.ru) + '|' + String(opt.en));
      });
      if (new Set(flat).size !== flat.length) fail(where, 'есть одинаковые варианты ответа');
    }
    /* Во всём проекте верный ответ стоит первым, а тренажёр
       перемешивает варианты при показе. Если где-то answer !== 0,
       значит задание писали в другом порядке — и после
       перемешивания разбор будет указывать не туда. */
    if (t.answer !== 0) fail(where, 'answer должен быть 0 (верный вариант пишется первым)');

    /* уровень и категория — только у новых языковых заданий */
    if (t.level) {
      if (['A1','A2','B1'].indexOf(t.level) < 0) fail(where, 'неизвестный уровень: ' + t.level);
      counts.byLevel[t.level] = (counts.byLevel[t.level] || 0) + 1;
    }
    if (t.cat) {
      if (['grammar','vocabulary','reading','listening'].indexOf(t.cat) < 0) {
        fail(where, 'неизвестная категория: ' + t.cat);
      }
      counts.byCat[t.cat] = (counts.byCat[t.cat] || 0) + 1;
    }
    if (t.theme) counts.byTheme[t.theme] = (counts.byTheme[t.theme] || 0) + 1;

    /* аудирование */
    if (t.audio) {
      counts.audio++;
      if (!t.audio.text || !t.audio.text.trim()) fail(where, 'audio.text пустой');
      if (o.audioLang && t.audio.lang !== o.audioLang) {
        fail(where, 'audio.lang должен быть ' + o.audioLang + ', а не ' + t.audio.lang);
      }
      if (t.cat && t.cat !== 'listening') fail(where, 'есть audio, но категория не listening');

      /* Главная проверка аудирования: если произносимая фраза видна
         в тексте задания, слушать незачем — это уже чтение. */
      const said = String(t.audio.text).toLowerCase().replace(/[^\p{L}\s]/gu, '').trim();
      const asked = String(t.text.en).toLowerCase();
      const chunk = said.split(/\s+/).slice(0, 4).join(' ');
      if (chunk.length > 8 && asked.indexOf(chunk) >= 0) {
        fail(where, 'фраза из audio видна в тексте задания — это уже не аудирование');
      }
      checkHomoglyphs(where + ' → audio', t.audio.text);
      if (o.diacritics) checkDiacritics(where + ' → audio', t.audio.text);
    } else if (t.cat === 'listening') {
      fail(where, 'категория listening, но нет audio');
    }

    /* перевод на русский и польский */
    if (t.tr) {
      counts.tr++;
      if (!t.tr.ru || !t.tr.ru.trim()) fail(where, 'tr.ru пустой');
      if (!t.tr.pl || !t.tr.pl.trim()) fail(where, 'tr.pl пустой');
      checkHomoglyphs(where + ' → tr.pl', t.tr.pl);
      checkDiacritics(where + ' → tr.pl', t.tr.pl);
      if (CYR.test(String(t.tr.pl))) fail(where, 'в польском переводе кириллица');
      if (!CYR.test(String(t.tr.ru))) fail(where, 'в русском переводе нет кириллицы');
    }

    /* Диакритика — только там, где текст обязан быть правильным.
       НЕ проверяем две вещи, и обе намеренно:
         • неверные варианты ответа: в заданиях на написание они как
           раз и есть искажённые формы ("sniadanie" вместо
           "śniadanie") — это задание, а не опечатка;
         • английскую сторону: по-английски валюта пишется "zloty"
           без диакритики, и это нормальная английская орфография. */
    if (o.diacritics) {
      checkDiacritics(where + ' opt0', t.options[0] && t.options[0].ru);
      checkDiacritics(where + ' → text', t.text.ru);
      checkDiacritics(where + ' → solution', t.solution.ru);
    }
  }

  stats[bank.id] = counts;
  return counts;
}

/* ================== АНГЛИЙСКИЙ ================== */
const enWin = load('data/bank-english.js');
checkBank(enWin.BANKS.english, { audioLang:'en-US' });

/* ================== ПОЛЬСКИЙ ================== */
const plWin = load('data/bank-polish.js', { window: enWin });
checkBank(plWin.BANKS.polish, { audioLang:'pl-PL', diacritics:true });

/* ================== РУССКИЙ ДЛЯ АНГЛОГОВОРЯЩИХ ================== */
const ruWin = load('data/bank-russian-en.js');
const RU = ruWin.RU_EN;

(function checkCourse() {
  const where = 'russian-en';
  if (!RU || !Array.isArray(RU.lessons)) { fail(where, 'нет уроков'); return; }

  /* алфавит */
  if (RU.ALPHABET.length !== 33) fail(where, 'в алфавите ' + RU.ALPHABET.length + ' букв вместо 33');
  RU.ALPHABET.forEach(a => {
    if (!a.ru || !a.hint) fail(where + '/' + a.ru, 'у буквы нет описания');
  });

  /* транслитерация: проверяем на словах самого курса */
  const cases = [
    ['привет', 'privet'],
    ['спасибо', 'spasibo'],
    ['здравствуйте', 'zdravstvuyte'],
    ['как дела', 'kak dela'],
    ['что делаешь', 'chto delayesh'],
    ['щука', 'shchuka'],
    ['Москва', 'Moskva']
  ];
  cases.forEach(([src, want]) => {
    const got = RU.translit(src);
    if (got !== want) fail(where + '/translit', '"' + src + '" → "' + got + '", ожидалось "' + want + '"');
  });
  /* мягкий и твёрдый знаки звука не имеют и должны исчезать */
  if (RU.translit('ь') !== '' || RU.translit('ъ') !== '') {
    fail(where + '/translit', 'ь и ъ должны пропадать при транслитерации');
  }

  let phrases = 0, gaps = 0;
  const ids = new Set();
  RU.lessons.forEach(l => {
    if (ids.has(l.id)) fail(where, 'повторяющийся id урока: ' + l.id);
    ids.add(l.id);
    if (!l.title || !l.intro) fail(where + '/' + l.id, 'нет названия или вступления');

    (l.phrases || []).forEach(p => {
      phrases++;
      const w = where + '/' + l.id + '/' + p.ru;
      if (!p.ru || !p.tl || !p.en) fail(w, 'не хватает ru, tl или en');
      if (!CYR.test(p.ru)) fail(w, 'в поле ru нет кириллицы');
      if (CYR.test(p.tl)) fail(w, 'в транслитерации осталась кириллица');
      if (p.you && ['ty','vy'].indexOf(p.you) < 0) fail(w, 'неизвестное значение you: ' + p.you);
      checkHomoglyphs(w + ' → en', p.en);
    });

    (l.gaps || []).forEach(g => {
      gaps++;
      const w = where + '/' + l.id + '/gap:' + g.answer;
      if (!g.ru || !g.answer || !g.en) fail(w, 'не хватает ru, answer или en');
      if (g.ru.indexOf('___') < 0) fail(w, 'в предложении нет пропуска ___');
      if (!Array.isArray(g.wrong) || g.wrong.length < 2) fail(w, 'нужно минимум два неверных варианта');
      if (g.wrong && g.wrong.indexOf(g.answer) >= 0) fail(w, 'верный ответ попал в список неверных');
      if (g.wrong && new Set(g.wrong).size !== g.wrong.length) fail(w, 'повторяющиеся неверные варианты');
      if (!g.why) fail(w, 'нет объяснения why');
    });
  });

  /* диалог собран только из пройденного — проверяем, что он вообще есть */
  const d = RU.dialogue;
  if (!d || !Array.isArray(d.lines) || d.lines.length < 4) fail(where, 'диалог слишком короткий');
  (d.lines || []).forEach(line => {
    if (!line.ru || !line.tl || !line.en) fail(where + '/dialogue', 'в реплике не хватает полей');
    if (['A','B'].indexOf(line.who) < 0) fail(where + '/dialogue', 'неизвестный говорящий: ' + line.who);
  });

  stats['russian-en'] = { lessons: RU.lessons.length, phrases, gaps, dialogue: d.lines.length };
})();

/* ================== ДВИЖОК УПРАЖНЕНИЙ ================== */
(function checkEngine() {
  const where = 'russian-en.js';
  const win = { Speech: { canSpeak:()=>false, hasVoice:()=>false, voiceFor:()=>null,
                          onReady:cb=>cb(), speak:()=>({ok:false}), stop:()=>{},
                          canListen:()=>false, listen:()=>Promise.reject(new Error('no-api')) } };
  load('assets/russian-en.js', { window: win });
  const R = win.RUEN;

  /* нормализация: ё=е, регистр и знаки не считаются */
  if (!R.same('Привет!', 'привет')) fail(where, 'нормализация не убирает знаки и регистр');
  if (!R.same('всё хорошо', 'все хорошо')) fail(where, 'ё и е должны считаться одинаковыми');
  if (R.same('привет', 'пока')) fail(where, 'разные фразы признаны одинаковыми');

  /* схожесть для произношения */
  const near = R.similarity('как дела', 'как дела');
  if (near !== 1) fail(where, 'одинаковые строки должны давать 1');
  if (R.similarity('привет', 'пока') > 0.5) fail(where, 'непохожие строки дают слишком высокую схожесть');

  /* распознавание: верный вариант может прийти вторым */
  const spoken = R.checkSpoken(['превет', 'привет'], 'привет');
  if (!spoken.ok) fail(where, 'верный вариант среди альтернатив не засчитан');

  /* сборка очереди */
  const all = RU.lessons.reduce((a, l) => a.concat(l.phrases || []), []);
  RU.lessons.forEach(l => {
    const q = R.buildQueue(l, all, {});
    if (!q.length) fail(where, 'пустая очередь для урока ' + l.id);
    q.forEach(item => {
      const w = where + '/' + item.id;
      if (R.KINDS.indexOf(item.kind) < 0) fail(w, 'неизвестный тип: ' + item.kind);
      if (item.options) {
        /* У read и listen отвлекающие берутся из общего запаса фраз,
           поэтому их всегда ровно четыре. У пропусков они написаны
           руками, и правдоподобных форм иногда всего две: «Меня ___
           Анна» — это «зовут» против «зову» и «звать», четвёртой осмысленной
           просто нет. Придумывать её ради круглого числа значит
           подсказывать ответ исключением, поэтому здесь допускаем три. */
        const least = item.kind === 'gap' ? 3 : 4;
        if (item.options.length < least || item.options.length > 4) {
          fail(w, 'вариантов должно быть ' + (least === 3 ? '3–4' : '4') + ', а не ' + item.options.length);
        }
        if (new Set(item.options).size !== item.options.length) fail(w, 'повторяющиеся варианты');
        /* верный ответ первый — как и в банках */
        if (R.check(item, 0).ok !== true) fail(w, 'первый вариант должен быть верным');
        if (R.check(item, 1).ok !== false) fail(w, 'второй вариант не должен засчитываться');
      }
      if (item.kind === 'match') {
        if (item.pairs.length !== 4) fail(w, 'в сопоставлении должно быть 4 пары');
        const rus = item.pairs.map(p => p.ru);
        if (new Set(rus).size !== rus.length) fail(w, 'повторяющиеся фразы в парах');
      }
      if (item.kind === 'write') {
        if (!R.check(item, item.ru).ok) fail(w, 'точный ответ не засчитан');
        if (!R.check(item, item.ru.toUpperCase()).ok) fail(w, 'регистр не должен влиять');
        if (R.check(item, 'ерунда').ok) fail(w, 'неверный ответ засчитан');
      }
    });
  });

  /* фильтр по типам заданий */
  const onlyRead = R.buildQueue(RU.lessons[0], all, { kinds:['read'] });
  if (onlyRead.some(i => i.kind !== 'read')) fail(where, 'фильтр типов не работает');
})();

/* ================== СТРАНИЦЫ ================== */
(function checkPages() {
  /* Проверяем не «красоту», а связность: что страница подключает то,
     чем пользуется, и что новые поля банков кто-то показывает. */
  const page = fs.readFileSync(path.join(ROOT, 'russian-for-en.html'), 'utf8');
  ['assets/speech.js', 'assets/russian-en.js', 'data/bank-russian-en.js', 'assets/russian-en.css']
    .forEach(src => {
      if (page.indexOf(src) < 0) fail('russian-for-en.html', 'не подключён ' + src);
    });

  const trainer = fs.readFileSync(path.join(ROOT, 'trainer.html'), 'utf8');
  if (trainer.indexOf('assets/speech.js') < 0) fail('trainer.html', 'не подключён assets/speech.js');
  ['qCefr', 'qCat', 'qAudioBox', 'qTr'].forEach(id => {
    if (trainer.indexOf(id) < 0) fail('trainer.html', 'нет элемента ' + id + ' — новые поля банка негде показать');
  });
  if (trainer.indexOf('data/bank-russian-en.js') >= 0) {
    fail('trainer.html', 'банк курса подключён к тренажёру, а он другой структуры (уроки, а не задания)');
  }

  const core = fs.readFileSync(path.join(ROOT, 'assets/core.js'), 'utf8');
  if (core.indexOf('russian-for-en.html') < 0) fail('core.js', 'страницы нет в навигации');
  if (core.indexOf('navRuEn') < 0) fail('core.js', 'нет перевода пункта меню');
})();

/* ================== ИТОГ ================== */
console.log('');
console.log('Английский:', JSON.stringify(stats.english));
console.log('Польский:  ', JSON.stringify(stats.polish));
console.log('Русский для англоговорящих:', JSON.stringify(stats['russian-en']));
console.log('');

if (problems.length) {
  console.log('НАЙДЕНО ПРОБЛЕМ: ' + problems.length);
  problems.forEach(p => console.log('  • ' + p));
  process.exit(1);
}
console.log('Все проверки пройдены.');
