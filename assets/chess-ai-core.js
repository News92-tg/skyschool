/* ============================================================
   Шахматный бот: минимакс с альфа-бета отсечением.

   Как он думает:
     1. перебирает свои ходы, за них — ответы соперника, и так
        на заданную глубину;
     2. альфа-бета отбрасывает ветки, которые уже заведомо хуже
        найденного — без этого глубина 3 считалась бы секундами;
     3. сортировка ходов (сначала взятия дорогих фигур дешёвыми)
        резко увеличивает число отсечений;
     4. в конце перебора досчитываются только взятия (quiescence),
        иначе бот «не видит», что его ферзя срубят следующим ходом.

   Это не Stockfish, но на уровне «клуб» он уже наказывает
   за зевки и ставит несложные маты.
   ============================================================ */
(function (root) {
'use strict';

const E = root.ChessEngine;
const { PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, WHITE } = E;

const VALUE = { [PAWN]:100, [KNIGHT]:320, [BISHOP]:330, [ROOK]:500, [QUEEN]:900, [KING]:20000 };
const MATE = 100000;

/* Таблицы полей: насколько фигуре хорошо стоять на этой клетке.
   Записаны с точки зрения белых, для чёрных отражаются по вертикали.
   Индексы 0..63 идут с a1 (левый нижний). */
const PST = {
  [PAWN]: [
      0,  0,  0,  0,  0,  0,  0,  0,
      5, 10, 10,-20,-20, 10, 10,  5,
      5, -5,-10,  0,  0,-10, -5,  5,
      0,  0,  0, 20, 20,  0,  0,  0,
      5,  5, 10, 25, 25, 10,  5,  5,
     10, 10, 20, 30, 30, 20, 10, 10,
     50, 50, 50, 50, 50, 50, 50, 50,
      0,  0,  0,  0,  0,  0,  0,  0],
  [KNIGHT]: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50],
  [BISHOP]: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10,-10,-10,-10,-10,-20],
  [ROOK]: [
      0,  0,  5, 10, 10,  5,  0,  0,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
     -5,  0,  0,  0,  0,  0,  0, -5,
      5, 10, 10, 10, 10, 10, 10,  5,
      0,  0,  0,  0,  0,  0,  0,  0],
  [QUEEN]: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -10,  5,  5,  5,  5,  5,  0,-10,
      0,  0,  5,  5,  5,  5,  0, -5,
     -5,  0,  5,  5,  5,  5,  0, -5,
    -10,  0,  5,  5,  5,  5,  0,-10,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20],
  [KING]: [
     20, 30, 10,  0,  0, 10, 30, 20,
     20, 20,  0,  0,  0,  0, 20, 20,
    -10,-20,-20,-20,-20,-20,-20,-10,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30]
};
/* В эндшпиле королю наоборот надо в центр, а не в угол. */
const KING_END = [
  -50,-30,-30,-30,-30,-30,-30,-50,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -50,-40,-30,-20,-20,-30,-40,-50];

function idx64(s) { return E.rankOf(s) * 8 + E.fileOf(s); }
function mirror(i) { return (7 - (i >> 3)) * 8 + (i & 7); }

/* Оценка позиции в сотых долях пешки, всегда с точки зрения белых. */
function evaluate(st) {
  const b = st.board;
  let score = 0, material = 0;

  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const s = E.sq(f, r), p = b[s];
    if (!p) continue;
    const type = p & 7;
    if (type !== KING) material += VALUE[type];
  }
  const endgame = material < 2400;   // примерно «ферзей нет, фигур мало»

  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const s = E.sq(f, r), p = b[s];
    if (!p) continue;
    const type = p & 7, white = (p & 8) === WHITE;
    const table = (type === KING && endgame) ? KING_END : PST[type];
    const i = white ? idx64(s) : mirror(idx64(s));
    const v = VALUE[type] + table[i];
    score += white ? v : -v;
  }
  return score;
}

/* Сортировка: сначала взятия дорогих фигур дешёвыми, потом превращения. */
function order(st, moves) {
  for (const m of moves) {
    let s = 0;
    if (m.captured) s += 10 * VALUE[m.captured & 7] - VALUE[m.piece & 7];
    if (m.promotion) s += VALUE[m.promotion];
    m._s = s;
  }
  moves.sort((a, b) => b._s - a._s);
  return moves;
}

/* Досчёт только взятий — чтобы бот не остановился ровно перед
   тем, как у него заберут ферзя. */
function quiesce(st, alpha, beta, side, depth) {
  const stand = evaluate(st) * side;
  if (depth <= 0) return stand;
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;

  const caps = order(st, E.generate(st).filter(m => m.captured || m.promotion));
  for (const m of caps) {
    E.make(st, m);
    const v = -quiesce(st, -beta, -alpha, -side, depth - 1);
    E.unmake(st);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function search(st, depth, alpha, beta, side, nodes) {
  const moves = E.generate(st);
  if (!moves.length) {
    return E.inCheck(st) ? -MATE - depth : 0;   // мат тем ценнее, чем быстрее
  }
  if (depth === 0) return quiesce(st, alpha, beta, side, 4);

  order(st, moves);
  for (const m of moves) {
    nodes.n++;
    /* Перебор с лимитом времени (bestMoveTimed) прерывается здесь.
       Проверяем часы раз в 256 узлов: Date.now() на каждом узле
       заметно тормозит перебор. */
    if (nodes.deadline && (nodes.n & 255) === 0 && Date.now() > nodes.deadline) throw ABORT;
    E.make(st, m);
    const v = -search(st, depth - 1, -beta, -alpha, -side, nodes);
    E.unmake(st);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/* Сигнал «время вышло»: бросается из глубины перебора и ловится
   в bestMoveTimed. */
const ABORT = { aborted: true };

const LEVELS = {
  1: { depth: 1, blunder: 0.35 },   // новичок: часто выбирает не лучший ход
  2: { depth: 2, blunder: 0.12 },
  3: { depth: 3, blunder: 0    },
  4: { depth: 4, blunder: 0    }
};

/* Выбор хода. Возвращает {move, score, nodes, ms}. */
function bestMove(st, level) {
  const cfg = LEVELS[level] || LEVELS[2];
  const side = (st.turn === WHITE) ? 1 : -1;
  const moves = order(st, E.generate(st));
  if (!moves.length) return null;

  const t0 = Date.now();
  const nodes = { n: 0 };
  const scored = [];
  let alpha = -Infinity;

  for (const m of moves) {
    nodes.n++;
    E.make(st, m);
    const v = -search(st, cfg.depth - 1, -Infinity, -alpha, -side, nodes);
    E.unmake(st);
    scored.push({ move: m, score: v });
    if (v > alpha) alpha = v;
  }

  scored.sort((a, b) => b.score - a.score);

  /* На лёгких уровнях иногда берём не лучший, а один из близких ходов —
     иначе бот играет одинаково и обыгрывает новичка всегда. */
  let pick = scored[0];
  if (cfg.blunder && Math.random() < cfg.blunder) {
    const near = scored.filter(x => x.score > scored[0].score - 150);
    pick = near[Math.floor(Math.random() * near.length)] || pick;
  }
  return { move: pick.move, score: pick.score, nodes: nodes.n, ms: Date.now() - t0 };
}

/* Выбор хода с ограничением по времени — для фонового потока
   (assets/chess-ai-worker.js) и для телефона.

   Итеративное углубление: считаем на глубину 1, потом 2, 3… и после
   каждой законченной глубины запоминаем лучший ход. Дальше решают часы:
     • minDepth досчитывается всегда (если не упёрлись в hardMs);
     • следующая глубина начинается, только если по прогнозу успеем
       в softMs: каждая глубина обычно в 4–6 раз дольше предыдущей;
     • hardMs — жёсткий потолок: перебор прерывается, и возвращается
       лучший ход последней законченной глубины.

   Ходы корня на новой глубине идут в порядке прошлой, поэтому
   прошлый лучший считается первым. Если время кончилось посреди
   глубины, а какой-то ход уже обогнал его, — этот ход и правда
   лучше (сравнение на одной глубине), и берём его.

   Считает на копии позиции: при прерывании перебор бросает
   исключение из глубины, и незакрытые make() испортили бы партию.

   opts: { level, maxDepth, minDepth, softMs, hardMs }
   Возвращает { move, score, depth, nodes, ms, timedOut } или null. */
function bestMoveTimed(st, opts) {
  opts = opts || {};
  const cfg = LEVELS[opts.level] || LEVELS[2];
  const maxDepth = Math.max(1, opts.maxDepth || cfg.depth);
  const minDepth = Math.min(maxDepth, Math.max(1, opts.minDepth || 1));
  const softMs = opts.softMs || 1500;
  const hardMs = opts.hardMs || 3000;
  const GROWTH = 5;

  const work = E.clone(st);
  const side = (work.turn === WHITE) ? 1 : -1;
  let moves = order(work, E.generate(work));
  if (!moves.length) return null;

  const t0 = Date.now();
  const nodes = { n: 0, deadline: t0 + hardMs };
  let done = null, timedOut = false, lastMs = 0;

  for (let d = 1; d <= maxDepth; d++) {
    const spent = Date.now() - t0;
    if (d > minDepth && spent + lastMs * GROWTH > softMs) break;
    const it0 = Date.now();
    const scored = [];
    let alpha = -Infinity;
    try {
      for (const m of moves) {
        nodes.n++;
        E.make(work, m);
        const v = -search(work, d - 1, -Infinity, -alpha, -side, nodes);
        E.unmake(work);
        scored.push({ move: m, score: v });
        if (v > alpha) alpha = v;
      }
    } catch (e) {
      if (e !== ABORT) throw e;
      timedOut = true;
      if (scored.length) {
        const top = scored.reduce((a, b) => (b.score > a.score ? b : a));
        if (!done || top.move !== done.scored[0].move) {
          done = { scored: [top], depth: done ? done.depth : d };
        }
      }
      break;
    }
    scored.sort((a, b) => b.score - a.score);
    done = { scored, depth: d };
    moves = scored.map(x => x.move);
    lastMs = Date.now() - it0;
  }

  /* Упёрлись в потолок даже на первой глубине (очень медленное
     устройство) — берём первый по сортировке ход: взятия впереди. */
  if (!done) done = { scored: [{ move: moves[0], score: 0 }], depth: 0 };

  const scored = done.scored;
  let pick = scored[0];
  if (cfg.blunder && scored.length > 1 && Math.random() < cfg.blunder) {
    const near = scored.filter(x => x.score > scored[0].score - 150);
    pick = near[Math.floor(Math.random() * near.length)] || pick;
  }
  return { move: pick.move, score: pick.score, depth: done.depth,
           nodes: nodes.n, ms: Date.now() - t0, timedOut };
}

root.ChessAI = { bestMove, bestMoveTimed, evaluate, VALUE, LEVELS, MATE };

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).ChessAI;
}
