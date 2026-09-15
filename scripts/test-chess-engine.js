'use strict';
/* Lightweight regression tests for the in-repo chess engine. Run: node scripts/test-chess-engine.js */
const E = require('../assets/chess-engine.js');

function assert(ok, message) { if (!ok) throw new Error(message); }
function legal(fen, uci) {
  const st = E.create(fen);
  return !!E.findMove(st, uci);
}
function illegal(fen, uci) {
  const st = E.create(fen);
  return !E.findMove(st, uci);
}

const START = E.START_FEN;

// Pawn, knight, bishop, rook, queen and king movement.
assert(legal(START, 'e2e4'), 'pawn double-step');
assert(legal(START, 'g1f3'), 'knight jump');
assert(illegal(START, 'f1h3'), 'blocked bishop');
assert(illegal(START, 'a1a3'), 'blocked rook');
assert(illegal(START, 'd1h5'), 'blocked queen');
assert(illegal(START, 'e1e2'), 'blocked king');

// En passant.
assert(legal('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'e5d6'), 'en passant');
assert(illegal('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1', 'e5d6'), 'en passant without ep square');

// Promotion.
assert(legal('7k/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q'), 'queen promotion');
assert(legal('7k/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8n'), 'underpromotion');

// Castling: legal with real rooks, illegal when FEN rights exist but rook is missing.
assert(legal('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1'), 'white king-side castling');
assert(legal('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1c1'), 'white queen-side castling');
assert(illegal('4k2r/8/8/8/8/8/8/4K3 w KQ - 0 1', 'e1g1'), 'castling without rook');
assert(illegal('4k2r/8/8/8/8/8/8/4K3 w KQ - 0 1', 'e1c1'), 'queen-side castling without rook');

// King safety: a pinned piece cannot expose its own king.
assert(illegal('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e2f2'), 'pinned rook cannot expose king');

// Checkmate and stalemate.
assert(E.status(E.create('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1')) === 'play', 'mate position starts playable');
const mate = E.create('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1');
E.make(mate, E.findMove(mate, 'e1e8'));
assert(E.status(mate) === 'checkmate', 'back-rank mate');
assert(E.status(E.create('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')) === 'stalemate', 'stalemate');

console.log('Chess engine regression tests: OK');
