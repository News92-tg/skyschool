/* ============================================================
   Проверка оценщика ходов (assets/chess-review.js).

   Зачем эти тесты. Ярлыки «ошибка» и «грубая ошибка» ученик принимает
   на веру — он для того и учится, что сам оценить позицию не может.
   Значит, ошибиться тут нельзя: зевок ферзя обязан называться зевком,
   а нормальный ход не должен получать красный крест.

   Запуск:  node scripts/test-chess-review.js
   ============================================================ */
'use strict';

const path = require('path');
const A = p => path.join(__dirname, '..', 'assets', p);

require(A('chess-engine.js'));
require(A('chess-ai.js'));
const R = require(A('chess-review.js'));

let pass = 0, fail = 0;

function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '  → ' + detail : '')); }
}

function review(fen, move) {
  const r = R.review(fen, move);
  if (!r) throw new Error('ход ' + move + ' не разобран в позиции ' + fen);
  return r;
}

console.log('\nОценка ходов\n');

/* ---------- 1. Зевок ферзя под бой короля ----------
   Белый ферзь идёт на поле рядом с чёрным королём, где его просто
   забирают. После этого на доске голые короли — ничья вместо выигрыша.
   Это обязано быть грубой ошибкой. */
{
  const fen = '4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1';
  const r = review(fen, 'Qd7+');
  check('зевок ферзя королю → blunder', r.quality === 'blunder', 'получено: ' + r.quality);
  check('потеря материала замечена', r.material <= -800, 'material=' + r.material);
  check('предложен ход лучше', !!r.betterMove, 'betterMove=' + r.betterMove);
}

/* ---------- 2. Отказ забрать висящего ферзя ----------
   Ладья может взять ферзя бесплатно. Вместо этого король делает
   тихий ход, и ферзь остаётся на доске. */
{
  const fen = '4k3/8/8/8/3q4/8/3R4/4K3 w - - 0 1';
  const best = review(fen, 'Rxd4');
  check('взятие висящего ферзя → good', best.quality === 'good', 'получено: ' + best.quality);
  check('взятие опознано как лучший ход', best.wasBest === true);

  const lazy = review(fen, 'Ke2');
  check('отказ от взятия ферзя → mistake или blunder',
        lazy.quality === 'mistake' || lazy.quality === 'blunder', 'получено: ' + lazy.quality);
  check('в качестве лучшего предложено взятие', lazy.betterMove === 'Rxd4', 'betterMove=' + lazy.betterMove);
}

/* ---------- 3. Нормальный ход в начальной позиции ----------
   1.e4 — не лучший по вкусу движка, может быть, но объявлять его
   ошибкой нельзя ни при каких порогах. */
{
  const r = review(R.__START || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4');
  check('1.e4 не считается ошибкой',
        r.quality === 'good' || r.quality === 'inaccuracy' || r.quality === 'brilliant',
        'получено: ' + r.quality);
}

/* ---------- 3б. Книжная партия целиком ----------
   Главная проверка на ложные обвинения. Итальянская партия — дебют,
   который играют двести лет; ни один её ход не является ошибкой.
   Именно здесь оценщик ломался: на малой глубине движок называл 3.c3
   ошибкой, и ученик, играющий строго по книге, получал красный крест.
   Появление здесь ярлыка «mistake» или «blunder» означает, что пороги
   снова затянуты. */
{
  const E = require(A('chess-engine.js'));
  const line = ['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d4','exd4',
                'cxd4','Bb4+','Bd2','Bxd2+','Nbxd2','d5','exd5','Nxd5'];
  const st = E.create();
  E.loadFen(st, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  const accused = [];
  let slowest = 0;
  for (const san of line) {
    const fen = E.fen(st);
    const t0 = Date.now();
    const r = R.review(fen, san);
    slowest = Math.max(slowest, Date.now() - t0);
    if (!r) { accused.push(san + ' (не разобран)'); break; }
    if (r.quality === 'mistake' || r.quality === 'blunder') {
      accused.push(`${san}→${r.quality} (loss=${Math.round(r.loss)})`);
    }
    E.make(st, E.findMove(st, san));
  }
  check('ни один ход итальянской партии не назван ошибкой',
        accused.length === 0, accused.join(', '));

  /* Разбор считается на главном потоке сразу после хода. Если он
     занимает секунды, интерфейс подвисает после каждого хода, и это
     заметнее любой пользы от ярлыка. */
  check('разбор хода укладывается в 400 мс', slowest < 400, slowest + ' мс');
}

/* ---------- 4. Мат в один ход ----------
   Ладья на восьмую горизонталь — мат. Ярлык должен быть
   положительным, а не «ошибка», и партия помечена как законченная. */
{
  const fen = '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1';
  const r = review(fen, 'Ra8#');
  check('мат в один → положительный ярлык',
        r.quality === 'good' || r.quality === 'brilliant', 'получено: ' + r.quality);
  check('мат распознан как конец партии', r.terminal === 'checkmate', 'terminal=' + r.terminal);
}

/* ---------- 5. В безнадёжной позиции не добивают ярлыками ----------
   У чёрных нет ничего, у белых ферзь и ладья. Любой ход чёрных плох,
   но объявлять каждый из них «грубой ошибкой» бессмысленно: партия
   проиграна до этого хода, а не из-за него. Ради этого ярлык и
   считается по падению вероятности выигрыша, а не по сотым долям
   пешки. */
{
  const fen = '4k3/8/8/8/8/8/4QR2/4K3 b - - 0 1';
  const r = review(fen, 'Kd8');
  check('в проигранной позиции обычный ход не становится blunder',
        r.quality !== 'blunder', 'получено: ' + r.quality + ', loss=' + Math.round(r.loss));
}

/* ---------- 6. Невозможный ход ----------
   Разбор обязан вернуть null, а не выдумать оценку. */
{
  const r = R.review('4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1', 'Qa8');
  check('невозможный ход → null', r === null, 'получено: ' + JSON.stringify(r));
}

/* ---------- 7. Короткое пояснение есть всегда ----------
   Без интернета и без ИИ ученик всё равно должен получать разбор. */
{
  const r = review('4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1', 'Qd7+');
  const ru = R.shortNote(r, 'ru');
  const en = R.shortNote(r, 'en');
  check('пояснение по-русски непустое', typeof ru === 'string' && ru.length > 10, ru);
  check('пояснение по-английски непустое', typeof en === 'string' && en.length > 10, en);
  check('в пояснении назван лучший ход', ru.includes(r.betterMove), ru);
}

console.log('\n' + '='.repeat(50));
console.log(`Пройдено: ${pass}, провалено: ${fail}`);
if (fail) { console.log('ОЦЕНЩИК ХОДОВ РАБОТАЕТ НЕВЕРНО.'); process.exit(1); }
console.log('Оценщик ходов работает верно.');
