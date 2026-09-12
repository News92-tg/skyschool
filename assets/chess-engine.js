/* ============================================================
   Шахматные правила с нуля. Без библиотек.

   Доска — массив 0x88: индекс = (ряд << 4) | столбец, где ряд 0
   это первая горизонталь. Приём старый и очень удобный: клетка
   лежит за доской ровно тогда, когда (индекс & 0x88) != 0 —
   одна побитовая операция вместо двух проверок границ.

   Фигуры — числа: 1..6 это белые пешка, конь, слон, ладья, ферзь,
   король; у чёрных к тем же номерам добавлена восьмёрка. Поэтому
   цвет = (код & 8), а тип = (код & 7).

   Ходы делаются через make/unmake с историей: так перебор в боте
   не копирует доску на каждом узле.
   ============================================================ */
(function (root) {
'use strict';

const WHITE = 0, BLACK = 8;
const EMPTY = 0;
const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;

const OFFSETS = {
  [KNIGHT]: [33, 31, 18, 14, -33, -31, -18, -14],
  [BISHOP]: [17, 15, -17, -15],
  [ROOK]:   [16, 1, -16, -1],
  [QUEEN]:  [17, 16, 15, 1, -17, -16, -15, -1],
  [KING]:   [17, 16, 15, 1, -17, -16, -15, -1]
};
const SLIDING = { [BISHOP]: 1, [ROOK]: 1, [QUEEN]: 1 };

/* права на рокировку */
const CW_K = 1, CW_Q = 2, CB_K = 4, CB_Q = 8;

const PIECE_CHAR = { 1:'P', 2:'N', 3:'B', 4:'R', 5:'Q', 6:'K' };
const CHAR_PIECE = { p:PAWN, n:KNIGHT, b:BISHOP, r:ROOK, q:QUEEN, k:KING };

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* ---------- клетки ---------- */
function sq(file, rank) { return (rank << 4) | file; }
function fileOf(s) { return s & 15; }
function rankOf(s) { return s >> 4; }
function offBoard(s) { return (s & 0x88) !== 0; }
function toAlg(s) { return 'abcdefgh'[fileOf(s)] + (rankOf(s) + 1); }
function fromAlg(a) {
  const f = 'abcdefgh'.indexOf(a[0]), r = parseInt(a[1], 10) - 1;
  return (f < 0 || r < 0 || r > 7) ? -1 : sq(f, r);
}

/* ---------- состояние ---------- */
function create(fen) {
  const st = {
    board: new Uint8Array(128),
    turn: WHITE,
    castling: 0,
    ep: -1,
    half: 0,
    full: 1,
    kings: { [WHITE]: -1, [BLACK]: -1 },
    history: []
  };
  loadFen(st, fen || START_FEN);
  return st;
}

function loadFen(st, fen) {
  const parts = fen.trim().split(/\s+/);
  st.board.fill(0);
  let rank = 7, file = 0;
  for (const ch of parts[0]) {
    if (ch === '/') { rank--; file = 0; continue; }
    if (ch >= '1' && ch <= '8') { file += +ch; continue; }
    const type = CHAR_PIECE[ch.toLowerCase()];
    const color = ch === ch.toUpperCase() ? WHITE : BLACK;
    const s = sq(file, rank);
    st.board[s] = type | color;
    if (type === KING) st.kings[color] = s;
    file++;
  }
  st.turn = (parts[1] === 'b') ? BLACK : WHITE;
  st.castling = 0;
  if (parts[2] && parts[2] !== '-') {
    if (parts[2].includes('K')) st.castling |= CW_K;
    if (parts[2].includes('Q')) st.castling |= CW_Q;
    if (parts[2].includes('k')) st.castling |= CB_K;
    if (parts[2].includes('q')) st.castling |= CB_Q;
  }
  st.ep = (parts[3] && parts[3] !== '-') ? fromAlg(parts[3]) : -1;
  st.half = parts[4] ? +parts[4] : 0;
  st.full = parts[5] ? +parts[5] : 1;
  st.history.length = 0;
  return st;
}

function fen(st) {
  let out = '';
  for (let rank = 7; rank >= 0; rank--) {
    let gap = 0;
    for (let file = 0; file < 8; file++) {
      const p = st.board[sq(file, rank)];
      if (!p) { gap++; continue; }
      if (gap) { out += gap; gap = 0; }
      const ch = PIECE_CHAR[p & 7];
      out += (p & 8) ? ch.toLowerCase() : ch;
    }
    if (gap) out += gap;
    if (rank) out += '/';
  }
  let c = '';
  if (st.castling & CW_K) c += 'K';
  if (st.castling & CW_Q) c += 'Q';
  if (st.castling & CB_K) c += 'k';
  if (st.castling & CB_Q) c += 'q';
  return [out, st.turn === WHITE ? 'w' : 'b', c || '-',
          st.ep >= 0 ? toAlg(st.ep) : '-', st.half, st.full].join(' ');
}

/* ---------- атаки ----------
   Бьёт ли сторона `by` клетку `target`. Используется и для шаха,
   и для проверки, что король не проходит через битое поле при рокировке. */
function attacked(st, target, by) {
  const b = st.board;

  /* пешки: смотрим назад от цели */
  const pawnDir = (by === WHITE) ? -1 : 1;
  for (const d of [-1, 1]) {
    const s = target + pawnDir * 16 + d;
    if (!offBoard(s) && b[s] === (PAWN | by)) return true;
  }
  /* кони */
  for (const o of OFFSETS[KNIGHT]) {
    const s = target + o;
    if (!offBoard(s) && b[s] === (KNIGHT | by)) return true;
  }
  /* король */
  for (const o of OFFSETS[KING]) {
    const s = target + o;
    if (!offBoard(s) && b[s] === (KING | by)) return true;
  }
  /* дальнобойные: слон/ферзь по диагоналям, ладья/ферзь по линиям */
  for (const [dirs, type] of [[OFFSETS[BISHOP], BISHOP], [OFFSETS[ROOK], ROOK]]) {
    for (const o of dirs) {
      let s = target + o;
      while (!offBoard(s)) {
        const p = b[s];
        if (p) {
          if ((p & 8) === by && ((p & 7) === type || (p & 7) === QUEEN)) return true;
          break;
        }
        s += o;
      }
    }
  }
  return false;
}

function inCheck(st, color) {
  const c = (color === undefined) ? st.turn : color;
  return attacked(st, st.kings[c], c ^ 8);
}

/* ---------- генерация ходов ---------- */
function addPawnMoves(st, from, to, flags, out) {
  const rank = rankOf(to);
  if (rank === 7 || rank === 0) {
    for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
      out.push(mk(st, from, to, flags + 'p', promo));
    }
  } else {
    out.push(mk(st, from, to, flags, 0));
  }
}

function mk(st, from, to, flags, promotion) {
  const piece = st.board[from];
  let captured = st.board[to];
  if (flags.includes('e')) captured = PAWN | (st.turn ^ 8);
  return { from, to, piece, captured: captured || 0, promotion: promotion || 0, flags };
}

/* legal:true — вернуть только ходы, после которых свой король не под боем */
function generate(st, opts) {
  opts = opts || {};
  const legal = opts.legal !== false;
  const only = (opts.square !== undefined && opts.square !== null)
    ? (typeof opts.square === 'string' ? fromAlg(opts.square) : opts.square)
    : -1;

  const us = st.turn, them = us ^ 8, b = st.board;
  const out = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const from = sq(file, rank);
      const p = b[from];
      if (!p || (p & 8) !== us) continue;
      if (only >= 0 && from !== only) continue;
      const type = p & 7;

      if (type === PAWN) {
        const dir = (us === WHITE) ? 16 : -16;
        const startRank = (us === WHITE) ? 1 : 6;
        const one = from + dir;
        if (!offBoard(one) && !b[one]) {
          addPawnMoves(st, from, one, '', out);
          const two = from + dir * 2;
          if (rank === startRank && !b[two]) out.push(mk(st, from, two, 'b', 0));
        }
        for (const d of [-1, 1]) {
          const t = from + dir + d;
          if (offBoard(t)) continue;
          if (b[t] && (b[t] & 8) === them) addPawnMoves(st, from, t, 'c', out);
          else if (t === st.ep) out.push(mk(st, from, t, 'ec', 0));
        }
        continue;
      }

      for (const o of OFFSETS[type]) {
        let t = from + o;
        while (!offBoard(t)) {
          const q = b[t];
          if (!q) out.push(mk(st, from, t, '', 0));
          else {
            if ((q & 8) === them) out.push(mk(st, from, t, 'c', 0));
            break;
          }
          if (!SLIDING[type]) break;
          t += o;
        }
      }
    }
  }

  /* рокировка */
  const kingSq = st.kings[us];
  if (only < 0 || only === kingSq) {
    const kSide = (us === WHITE) ? CW_K : CB_K;
    const qSide = (us === WHITE) ? CW_Q : CB_Q;
    if ((st.castling & kSide) && !b[kingSq + 1] && !b[kingSq + 2] &&
        !attacked(st, kingSq, them) && !attacked(st, kingSq + 1, them) && !attacked(st, kingSq + 2, them)) {
      out.push(mk(st, kingSq, kingSq + 2, 'k', 0));
    }
    if ((st.castling & qSide) && !b[kingSq - 1] && !b[kingSq - 2] && !b[kingSq - 3] &&
        !attacked(st, kingSq, them) && !attacked(st, kingSq - 1, them) && !attacked(st, kingSq - 2, them)) {
      out.push(mk(st, kingSq, kingSq - 2, 'q', 0));
    }
  }

  if (!legal) return out;

  const res = [];
  for (const m of out) {
    make(st, m);
    if (!attacked(st, st.kings[us], them)) res.push(m);
    unmake(st);
  }
  return res;
}

/* ---------- ход ---------- */
const CASTLING_MASK = new Uint8Array(128).fill(15);
CASTLING_MASK[sq(4, 0)] = 15 & ~(CW_K | CW_Q);   // e1
CASTLING_MASK[sq(0, 0)] = 15 & ~CW_Q;            // a1
CASTLING_MASK[sq(7, 0)] = 15 & ~CW_K;            // h1
CASTLING_MASK[sq(4, 7)] = 15 & ~(CB_K | CB_Q);   // e8
CASTLING_MASK[sq(0, 7)] = 15 & ~CB_Q;            // a8
CASTLING_MASK[sq(7, 7)] = 15 & ~CB_K;            // h8

function make(st, m) {
  const b = st.board, us = st.turn, them = us ^ 8;
  st.history.push({ move: m, castling: st.castling, ep: st.ep, half: st.half,
                    full: st.full, king: st.kings[us] });

  b[m.to] = m.piece;
  b[m.from] = EMPTY;

  if (m.flags.includes('e')) b[m.to + (us === WHITE ? -16 : 16)] = EMPTY;
  if (m.promotion) b[m.to] = m.promotion | us;

  if ((m.piece & 7) === KING) {
    st.kings[us] = m.to;
    if (m.flags.includes('k')) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = EMPTY; }
    if (m.flags.includes('q')) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = EMPTY; }
  }

  st.castling &= CASTLING_MASK[m.from] & CASTLING_MASK[m.to];
  st.ep = m.flags.includes('b') ? (m.from + (us === WHITE ? 16 : -16)) : -1;
  st.half = (m.captured || (m.piece & 7) === PAWN) ? 0 : st.half + 1;
  if (us === BLACK) st.full++;
  st.turn = them;
}

function unmake(st) {
  const h = st.history.pop();
  if (!h) return null;
  const m = h.move, b = st.board;
  const us = st.turn ^ 8;

  st.turn = us;
  st.castling = h.castling;
  st.ep = h.ep;
  st.half = h.half;
  st.full = h.full;
  st.kings[us] = h.king;

  b[m.from] = m.piece;
  b[m.to] = EMPTY;

  if (m.flags.includes('e')) {
    b[m.to + (us === WHITE ? -16 : 16)] = m.captured;
  } else if (m.captured) {
    b[m.to] = m.captured;
  }

  if (m.flags.includes('k')) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = EMPTY; }
  if (m.flags.includes('q')) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = EMPTY; }

  return m;
}

/* ---------- состояние партии ---------- */
function status(st) {
  const moves = generate(st);
  const check = inCheck(st);
  if (!moves.length) return check ? 'checkmate' : 'stalemate';
  if (st.half >= 100) return 'fifty';
  if (insufficient(st)) return 'material';
  return check ? 'check' : 'play';
}

function insufficient(st) {
  const list = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = st.board[sq(f, r)];
    if (p && (p & 7) !== KING) list.push(p & 7);
  }
  if (!list.length) return true;                                   // K vs K
  if (list.length === 1 && (list[0] === BISHOP || list[0] === KNIGHT)) return true;
  if (list.length === 2 && list[0] === BISHOP && list[1] === BISHOP) return true;
  return false;
}

/* ---------- запись хода ---------- */
function toSAN(st, m) {
  if (m.flags.includes('k')) return decorate(st, m, 'O-O');
  if (m.flags.includes('q')) return decorate(st, m, 'O-O-O');

  const type = m.piece & 7;
  let s = '';
  if (type === PAWN) {
    if (m.captured) s += 'abcdefgh'[fileOf(m.from)] + 'x';
    s += toAlg(m.to);
    if (m.promotion) s += '=' + PIECE_CHAR[m.promotion];
  } else {
    s += PIECE_CHAR[type];
    /* уточнение, если тот же ход может сделать другая такая же фигура */
    const same = generate(st).filter(o =>
      o.to === m.to && o.from !== m.from && (o.piece & 7) === type);
    if (same.length) {
      const sameFile = same.some(o => fileOf(o.from) === fileOf(m.from));
      const sameRank = same.some(o => rankOf(o.from) === rankOf(m.from));
      if (!sameFile) s += 'abcdefgh'[fileOf(m.from)];
      else if (!sameRank) s += (rankOf(m.from) + 1);
      else s += toAlg(m.from);
    }
    if (m.captured) s += 'x';
    s += toAlg(m.to);
  }
  return decorate(st, m, s);
}

function decorate(st, m, s) {
  make(st, m);
  const st2 = status(st);
  unmake(st);
  if (st2 === 'checkmate') return s + '#';
  if (st2 === 'check') return s + '+';
  return s;
}

/* Найти ход по строке: 'e2e4', 'e7e8q' или SAN ('Nf3', 'O-O', 'exd5'). */
function findMove(st, notation) {
  const list = generate(st);
  const n = String(notation).trim();
  const uci = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(n.toLowerCase());
  if (uci) {
    const from = fromAlg(uci[1]), to = fromAlg(uci[2]);
    const promo = uci[3] ? CHAR_PIECE[uci[3]] : 0;
    return list.find(m => m.from === from && m.to === to &&
                          (!promo || m.promotion === promo)) || null;
  }
  const clean = s => s.replace(/[+#]/g, '');
  return list.find(m => clean(toSAN(st, m)) === clean(n)) || null;
}

function clone(st) {
  const c = create(fen(st));
  return c;
}

root.ChessEngine = {
  WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING, START_FEN,
  create, loadFen, fen, clone,
  generate, make, unmake, findMove,
  attacked, inCheck, status, insufficient, toSAN,
  toAlg, fromAlg, fileOf, rankOf, sq, offBoard
};

})(typeof window !== 'undefined' ? window : globalThis);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).ChessEngine;
}
