/* ============================================================
   Оценка хода ученика: brilliant / good / inaccuracy / mistake / blunder.

   Кто что делает — это главное в этом файле.

   Считает ЗДЕСЬ, движком. Ярлык хода, величину потери и лучший ход
   даёт минимакс из assets/chess-ai.js. Мгновенно, офлайн, бесплатно,
   и — что важнее — правильно.

   Языковая модель в этом НЕ участвует. Она не умеет оценивать позицию:
   выдаст уверенный ярлык, регулярно неверный, и предложит «лучшие
   ходы», часть которых в данной позиции просто невозможна. Ученик не
   сможет отличить такую подсказку от настоящей — он же учится. Роль
   модели — только перевести готовый вердикт в человеческую фразу, и
   этим занимается explainWords() в самом низу файла: слой
   необязательный, без него раздел работает, просто без слов.

   ---------------------------------------------------------------
   Как считается потеря.

   Наивно было бы взять разницу оценок в сотых долях пешки. Но пешка
   пешке рознь: потерять 300 сотых при равной позиции — катастрофа, а
   при оценке «минус ферзь» уже ничего не меняет, партия и так
   проиграна. Поэтому оценка сначала переводится в вероятность
   выигрыша по логистической кривой, и ярлык ставится по падению
   ВЕРОЯТНОСТИ. Так же считают современные шахматные сайты, и так
   ученику не выносят приговор «грубая ошибка» за ход в уже
   безнадёжной позиции.
   ============================================================ */
(function (root) {
'use strict';

const E = root.ChessEngine;
const AI = root.ChessAI;

/* Две глубины, и разница между ними принципиальна.

   Наивно считать «до» и «после» одинаково глубоко — и это первое, что
   тут было сделано неправильно. Если позицию ДО хода просчитать на 4
   полухода и позицию ПОСЛЕ хода тоже на 4, то второй расчёт заглянет
   на полуход дальше первого: ход ученика уже сделан, и к нему
   добавляются ещё четыре. Числа оказываются с разных горизонтов и
   несравнимы. Хуже того, ошибка не случайная: на нечётной глубине
   сторона, которая ходит, получает лишний темп, поэтому оценка
   регулярно скачет туда-сюда от полухода к полуходу. На практике это
   выглядело так, что ход 1.e4 получал ярлык «ошибка».

   Поэтому «после» считается на полуход мельче: ход ученика плюс три
   полухода — это ровно те же четыре полухода от исходной позиции, что
   и в расчёте «до». Так сравниваются два числа об одном горизонте.

   Почему глубина 3, а не 4. Замеры на реальной партии: 3/2 считает в
   среднем 80 мс на ход, 4/3 — 540 мс со всплесками до 2,2 секунды. На
   телефоне вторые цифры превращаются в заметное подвисание после
   каждого хода. При этом числа, ради которых всё затевалось, у обеих
   глубин практически одинаковые: зевки и висящие фигуры ловит
   форсированный досчёт взятий, а он работает на любой глубине.
   Платить секундами за третий знак после запятой не за что.

   Третий уровень выбран ещё и потому, что у него нет случайности в
   выборе хода: на первых двух бот намеренно иногда играет не лучший
   ход, и для разбора это не годится. */
const LEVEL_BEFORE = 3;
const LEVEL_AFTER  = 2;
const REVIEW_LEVEL = LEVEL_BEFORE;   /* для совместимости со старым именем */

const VALUE = { 1:100, 2:320, 3:330, 4:500, 5:900, 6:0 };  /* король в счёт материала не идёт */

/* Оценка в сотых долях пешки → вероятность выигрыша (0..1). */
function winProb(cp) {
  return 1 / (1 + Math.pow(10, -cp / 400));
}

/* Пороги по падению вероятности выигрыша.

   Таблицы две, и это не перестраховка. Движок на глубине 3 знает две
   разные по надёжности вещи. Материал он считает ТОЧНО: если после
   лучшего ответа соперника фигуры не стало, она действительно
   потеряна, тут спорить не о чем. А позиционную разницу в полпешки на
   такой глубине он различает плохо — это шум его собственной
   близорукости, а не ошибка ученика.

   Когда пороги были общие, движок называл ошибкой ход 3.c3 в
   итальянской партии — книжный ход, который играют двести лет. Ученик,
   которому платформа говорит «ошибка» за нормальный ход, перестаёт ей
   верить, и правильно делает.

   Поэтому: потерял материал — меряем строго, ход разбирается по
   существу. Материал цел, разница только в оценке — планка втрое выше,
   и «ошибкой» называется лишь то, что видно и близорукому движку. */
const STEPS_MATERIAL = [           /* материал реально потерян */
  { max: 0.035, quality: 'good' },
  { max: 0.080, quality: 'inaccuracy' },
  { max: 0.180, quality: 'mistake' },
  { max: Infinity, quality: 'blunder' }
];

const STEPS_POSITION = [           /* материал цел, разница позиционная */
  { max: 0.140, quality: 'good' },        /* около пешки при равной позиции */
  { max: 0.260, quality: 'inaccuracy' },
  { max: 0.420, quality: 'mistake' },
  { max: Infinity, quality: 'blunder' }
];

/* Материал стороны, которая ходит, минус материал соперника. */
function materialBalance(st, color) {
  let mine = 0, theirs = 0;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = st.board[E.sq(f, r)];
    if (!p) continue;
    const v = VALUE[p & 7] || 0;
    if ((p & 24) === color) mine += v; else theirs += v;
  }
  return mine - theirs;
}

/* Лучший ход и оценка позиции глазами того, кто ходит. */
function bestFor(st, level) {
  const res = AI.bestMove(st, level);
  if (res) return { score: res.score, move: res.move };

  /* Ходов нет: либо мат, либо пат. */
  const s = E.status(st);
  return { score: s === 'checkmate' ? -AI.MATE : 0, move: null, terminal: s };
}

/* ---------- главная функция ----------
   fenBefore — позиция ДО хода ученика;
   notation  — ход в SAN ('Nf3') или UCI ('g1f3');
   возвращает объект разбора или null, если ход невозможен. */
function review(fenBefore, notation) {
  const st = E.create();
  E.loadFen(st, fenBefore);

  const mover = st.turn;

  /* 1. что было доступно лучшего */
  const before = bestFor(st, LEVEL_BEFORE);
  if (!before.move) return null;           /* ходить было нечем */
  const evalBefore = before.score;
  const bestSan = E.toSAN(st, before.move);

  /* 2. ход ученика */
  const played = E.findMove(st, notation);
  if (!played) return null;                /* такого хода в позиции нет */
  const playedSan = E.toSAN(st, played);
  const matBefore = materialBalance(st, mover);

  E.make(st, played);

  /* 3. что получилось. bestFor считает глазами СОПЕРНИКА (теперь его
        очередь), поэтому знак переворачиваем — нам нужна оценка
        глазами ученика. Глубина на полуход меньше: см. комментарий
        к LEVEL_BEFORE/LEVEL_AFTER наверху файла. */
  const after = bestFor(st, LEVEL_AFTER);
  const evalAfter = -after.score;
  const terminal = after.terminal || null;
  const matAfterOwnMove = materialBalance(st, mover);

  /* Материал после лучшего ответа соперника: именно он показывает,
     была ли это жертва, а не просто взятие. */
  let matAfterReply = matAfterOwnMove;
  if (after.move) {
    E.make(st, after.move);
    matAfterReply = materialBalance(st, mover);
    E.unmake(st);
  }

  E.unmake(st);

  /* 4. ярлык */
  const drop = Math.max(0, winProb(evalBefore) - winProb(evalAfter));

  /* Материал считается ПОСЛЕ лучшего ответа соперника, а не сразу
     после хода ученика. Иначе любое взятие выглядело бы выигрышем
     материала, а размен — потерей: «съел пешку» и «съел пешку, но
     тут же отдал коня» различаются только ответом соперника. */
  const lostMaterial = matAfterReply < matBefore - 50;
  const steps = lostMaterial ? STEPS_MATERIAL : STEPS_POSITION;
  let quality = steps.find(s => drop <= s.max).quality;

  const wasBest = playedSan === bestSan;

  /* «Блестящий» — осознанное упрощение, и об этом честнее сказать
     прямо. Настоящая жертва отличается от зевка только тем, что после
     неё позиция остаётся хорошей. Поэтому требуем три вещи сразу:
     ход лучший, материал после ответа соперника упал, а оценка при
     этом не просела. Красивые тихие ходы такой признак не поймает —
     он ловит именно жертвы. */
  if (wasBest && drop <= 0.02 && matAfterReply < matBefore - 50 && evalAfter > 50) {
    quality = 'brilliant';
  }

  /* Мат ставит точку в разговоре: это всегда лучший исход. */
  if (terminal === 'checkmate') quality = wasBest ? (quality === 'brilliant' ? 'brilliant' : 'good') : 'good';

  return {
    quality,
    move: playedSan,
    betterMove: wasBest ? null : bestSan,
    wasBest,
    evalBefore,
    evalAfter,
    /* потеря в сотых долях пешки — для показа человеку; ярлык ставится
       не по ней, см. шапку файла */
    loss: Math.max(0, evalBefore - evalAfter),
    probDrop: drop,
    material: matAfterReply - matBefore,
    terminal,
    fen: fenBefore
  };
}

/* ---------- оформление ---------- */
const MARKS = {
  brilliant:  { icon: '★', cls: 'q-brilliant' },
  good:       { icon: '✓', cls: 'q-good' },
  inaccuracy: { icon: '▲', cls: 'q-inaccuracy' },
  mistake:    { icon: '●', cls: 'q-mistake' },
  blunder:    { icon: '✕', cls: 'q-blunder' }
};

/* Короткое пояснение без всякой модели: оно должно быть всегда, даже
   когда интернета нет и ИИ не подключён. Модель потом добавляет к
   этому живую фразу, но не заменяет его. */
function shortNote(r, lang) {
  const ru = lang !== 'en';
  const pawns = (r.loss / 100).toFixed(1);
  const mat = r.material;

  if (r.terminal === 'checkmate') return ru ? 'Мат. Партия закончена.' : 'Checkmate. Game over.';
  if (r.terminal === 'stalemate') return ru ? 'Пат: ходов у соперника нет, ничья.' : 'Stalemate: no legal moves, a draw.';

  if (r.quality === 'brilliant') {
    return ru ? `Жертва, которая работает: материал отдан, но позиция только лучше.`
              : `A sacrifice that works: material given up, position still better.`;
  }
  if (r.quality === 'good') {
    return r.wasBest
      ? (ru ? 'Лучший ход в позиции.' : 'The best move in the position.')
      : (ru ? 'Хороший ход, почти не уступает лучшему.' : 'A good move, nearly as strong as the best one.');
  }

  const lead = r.quality === 'inaccuracy' ? (ru ? 'Неточность' : 'Inaccuracy')
             : r.quality === 'mistake'    ? (ru ? 'Ошибка' : 'Mistake')
             :                              (ru ? 'Грубая ошибка' : 'Blunder');

  const tail = mat <= -100
    ? (ru ? `теряется материал примерно на ${(Math.abs(mat) / 100).toFixed(1)} пешки`
          : `loses about ${(Math.abs(mat) / 100).toFixed(1)} pawns of material`)
    : (ru ? `позиция ухудшается примерно на ${pawns} пешки`
          : `the position worsens by about ${pawns} pawns`);

  const better = r.betterMove
    ? (ru ? `. Сильнее было ${r.betterMove}.` : `. ${r.betterMove} was stronger.`)
    : '.';

  return `${lead}: ${tail}${better}`;
}

/* ---------- слова от учителя (необязательный слой) ----------
   Сюда уходит уже ГОТОВЫЙ вердикт, и модель не может его изменить:
   она получает ярлык и лучший ход как факт и только объясняет их.
   Работает лишь через Worker: свой ключ в браузере тут не при чём,
   потому что эндпоинт /chess-explain живёт на сервере. Если ИИ не
   подключён или недоступен — возвращаем null, и раздел показывает
   короткое пояснение движка. */
async function explainWords(r, opts) {
  const o = opts || {};
  const base = ((root.Sky && root.Sky.cfg && root.Sky.cfg.AI_BASE) || '').trim();
  if (!/^https?:\/\//i.test(base)) return null;
  if (r.quality === 'good' && r.wasBest) return null;   /* хвалить словами каждый верный ход — лишний расход */

  try {
    const resp = await fetch(base.replace(/\/+$/, '') + '/chess-explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: o.lang || (root.Sky ? root.Sky.lang : 'ru'),
        quality: r.quality,
        move: r.move,
        betterMove: r.betterMove,
        fen: r.fen,
        loss: Math.round(r.loss),
        material: r.material,
        teacher: o.teacher || (root.SkyTeachers ? root.SkyTeachers.selectedId() : null)
      })
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.explanation) return null;
    return data.explanation;
  } catch (e) {
    return null;
  }
}

root.ChessReview = { review, shortNote, explainWords, MARKS, winProb, REVIEW_LEVEL };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).ChessReview;
}
