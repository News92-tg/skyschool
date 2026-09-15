'use strict';
/* Comprehensive regression suite. Run: node scripts/test-chess-engine.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const E = require('../assets/chess-engine.js');

function runBrowserScript(file) {
  const sandbox = { window: { ChessEngine: E }, console, setTimeout: () => {}, MutationObserver: function () {}, document: { getElementById: () => null } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  return sandbox.window;
}
runBrowserScript('assets/chess-platform-fixes.js');
const AI = require('../assets/chess-ai-core.js');
function legal(fen, uci) { const st = E.create(fen); return !!E.findMove(st, uci); }
function illegal(fen, uci) { return !legal(fen, uci); }
const START = E.START_FEN;

// 1. Initial position and geometry.
{
  const st = E.create();
  assert.strictEqual(E.generate(st).length, 20);
  assert.strictEqual(E.status(st), 'play');
  assert(legal(START, 'e2e4'));
  assert(legal(START, 'g1f3'));
  assert(illegal(START, 'f1h3'));
  assert(illegal(START, 'a1a3'));
  assert(illegal(START, 'd1h5'));
  assert(illegal(START, 'e1e2'));
}

// 2. En passant.
{
  const st = E.create('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
  const m = E.findMove(st, 'e5d6');
  assert(m && String(m.flags).includes('e'));
  E.make(st, m);
  assert.strictEqual(st.board[E.fromAlg('d6')] & 7, E.PAWN);
  assert.strictEqual(st.board[E.fromAlg('d5')], 0);
  assert(illegal('4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1', 'e5d6'));
}

// 3. Promotion, including underpromotion.
{
  const st = E.create('7k/P7/8/8/8/8/8/4K3 w - - 0 1');
  const ms = E.generate(st).filter(m => m.from === E.fromAlg('a7') && m.to === E.fromAlg('a8'));
  assert.strictEqual(ms.length, 4);
  assert(legal('7k/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8q'));
  assert(legal('7k/P7/8/8/8/8/8/4K3 w - - 0 1', 'a7a8n'));
}

// 4. Castling must require the actual rook and safe transit squares.
{
  const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  assert(legal(fen, 'e1g1'));
  assert(legal(fen, 'e1c1'));
  assert(illegal('4k3/8/8/8/8/8/8/R3K3 w KQ - 0 1', 'e1g1'));
  assert(illegal('4k3/8/8/8/8/8/8/4K2R w KQ - 0 1', 'e1c1'));
  assert(illegal('4k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'e1g1'));
}

// 5. King safety / pinned piece.
assert(illegal('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1', 'e2f2'));

// 6. Mate and stalemate.
{
  const mate = E.create('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1');
  const m = E.findMove(mate, 'e1e8'); assert(m); E.make(mate, m);
  assert.strictEqual(E.status(mate), 'checkmate');
  assert.strictEqual(E.status(E.create('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), 'stalemate');
}

// 7. Dead-position material accuracy.
{
  const same = E.create('7k/1B6/8/8/8/8/1B6/4K3 w - - 0 1');
  assert.strictEqual(E.status(same), 'material');
  const opposite = E.create('7k/1B6/8/8/8/8/2B5/4K3 w - - 0 1');
  assert.notStrictEqual(E.status(opposite), 'material');
  assert.notStrictEqual(E.status(E.create('7k/8/8/8/8/8/1N6/4K3 w - - 0 1')), 'material');
}

// 8. Threefold repetition must survive make/unmake/search probes correctly.
{
  const st = E.create();
  for (const uci of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']) {
    const m = E.findMove(st, uci); assert(m, uci); E.make(st, m);
  }
  assert.strictEqual(E.status(st), 'repetition');
  const fresh = E.create();
  const m = E.findMove(fresh, 'g1f3'); E.make(fresh, m); E.unmake(fresh);
  assert.strictEqual(E.status(fresh), 'play');
}

// 9. Every stored lesson demonstration is legal.
{
  const sandbox = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data/chess-lessons.js'), 'utf8'), sandbox);
  const lessons = sandbox.window.CHESS_LESSONS;
  assert(Array.isArray(lessons) && lessons.length >= 10);
  for (const lesson of lessons) {
    const st = E.create(lesson.fen || E.START_FEN);
    for (const notation of lesson.moves || []) {
      const m = E.findMove(st, notation);
      assert(m, `${lesson.id}: illegal lesson move ${notation}`);
      E.make(st, m);
    }
  }
}

// 10. Every stored puzzle solution resolves legally.
{
  const sandbox = { window: {}, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'data/chess-puzzles.js'), 'utf8'), sandbox);
  const puzzles = sandbox.window.CHESS_PUZZLES;
  assert(Array.isArray(puzzles) && puzzles.length);
  for (const puzzle of puzzles) {
    const st = E.create(puzzle.fen);
    for (const solution of puzzle.solutions || []) assert(E.findMove(st, solution), `${puzzle.id}: illegal solution ${solution}`);
  }
}

// 11. AI returns a legal move at every shipped difficulty.
for (const level of [1, 2, 3, 4]) {
  const st = E.create();
  const r = AI.bestMove(st, level);
  assert(r && r.move);
  assert(E.generate(st).some(m => m.from === r.move.from && m.to === r.move.to && m.promotion === r.move.promotion));
}

// 12. Inline chess.html JavaScript parses, and all src scripts exist.
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'chess.html'), 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert(blocks.length >= 1);
  blocks.forEach((m, i) => { try { new Function(m[1]); } catch (e) { throw new Error(`inline script #${i + 1}: ${e.message}`); } });
  const refs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  for (const ref of refs) if (!/^https?:\/\//.test(ref)) assert(fs.existsSync(path.join(__dirname, '..', ref)), `missing script ${ref}`);
}

console.log('Chess regression suite passed: 12 groups.');
