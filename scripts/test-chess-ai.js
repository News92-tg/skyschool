/* ============================================================
   Бот с лимитом времени и фоновый поток шахмат.

   Запуск:  node scripts/test-chess-ai.js

   Проверяем:
     1. bestMoveTimed даёт законный ход и не портит позицию, которую
        ему передали (считает на копии);
     2. находит мат в один ход и не отдаёт ферзя;
     3. глубина растёт до maxDepth, если время есть, и упирается в
        потолок hardMs, если его нет — и всё равно возвращает ход;
     4. assets/chess-ai-worker.js отвечает по протоколу: клетки хода,
        глубина, время; «ходов нет» и ошибки — отдельными ответами.
   ============================================================ */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const E = require('../assets/chess-engine.js');
const AI = require('../assets/chess-ai-core.js');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; }
  catch (e) { console.error('✗ ' + name + '\n  ' + (e && e.message)); process.exitCode = 1; }
}
const legal = (fen, m) => E.generate(E.create(fen)).some(x => x.from === m.from && x.to === m.to && (x.promotion || 0) === (m.promotion || 0));
const san = (fen, m) => E.toSAN(E.create(fen), m);

const MIDGAME = 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7';

check('ход законный, позиция не тронута', () => {
  const st = E.create(MIDGAME);
  const before = E.fen(st), hist = st.history.length;
  const r = AI.bestMoveTimed(st, { level: 3 });
  assert(r && r.move, 'нет хода');
  assert(legal(MIDGAME, r.move), 'незаконный ход');
  assert.strictEqual(E.fen(st), before);
  assert.strictEqual(st.history.length, hist);
});

check('мат в один ход', () => {
  const fen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
  const r = AI.bestMoveTimed(E.create(fen), { level: 3 });
  assert.strictEqual(san(fen, r.move), 'Re8#');
});

check('не отдаёт ферзя под пешку', () => {
  /* ферзь на d4 атакован пешкой e5 — нужно уводить */
  const fen = 'rnb1kbnr/pppp1ppp/8/4p3/3Q4/8/PPP1PPPP/RNB1KBNR w KQkq - 0 3';
  const r = AI.bestMoveTimed(E.create(fen), { level: 3 });
  const st = E.create(fen); E.make(st, r.move);
  const qAlive = st.board.some((p, i) => p === (E.QUEEN | E.WHITE) && !E.attacked(st, i, E.BLACK));
  assert(qAlive, 'ферзь остался под боем: ' + san(fen, r.move));
});

check('есть время — доходит до maxDepth', () => {
  const r = AI.bestMoveTimed(E.create(E.START_FEN), { level: 3, maxDepth: 3, minDepth: 1, softMs: 5000, hardMs: 8000 });
  assert.strictEqual(r.depth, 3);
  assert.strictEqual(r.timedOut, false);
});

check('потолок времени: прерывается и всё равно отдаёт ход', () => {
  const t0 = Date.now();
  const r = AI.bestMoveTimed(E.create(MIDGAME), { level: 4, maxDepth: 8, minDepth: 8, softMs: 50, hardMs: 120 });
  const ms = Date.now() - t0;
  assert(r && r.move && legal(MIDGAME, r.move), 'нет законного хода');
  assert(r.timedOut, 'не отметил прерывание');
  assert(r.depth >= 1 && r.depth < 8, 'глубина ' + r.depth);
  assert(ms < 600, 'считал ' + ms + ' мс при потолке 120');
});

check('мягкий лимит: следующая глубина не начинается, если не успеть', () => {
  /* Часы подменяем: на быстрой машине первая глубина укладывается в ту
     же миллисекунду, Date.now() даёт 0 мс, и бот вправе считать дальше.
     Так тест зависел от скорости раннера. Здесь каждый взгляд на часы —
     плюс 2 мс: первая глубина «стоит» несколько мс, прогноз на вторую
     больше softMs, до hardMs далеко. */
  const realNow = Date.now;
  let fake = 0;
  Date.now = () => (fake += 2);
  try {
    const r = AI.bestMoveTimed(E.create(MIDGAME), { level: 4, maxDepth: 8, minDepth: 1, softMs: 1, hardMs: 5000 });
    assert.strictEqual(r.depth, 1);
    assert.strictEqual(r.timedOut, false);
  } finally {
    Date.now = realNow;
  }
});

check('ходов нет — null', () => {
  assert.strictEqual(AI.bestMoveTimed(E.create('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1'), { level: 3 }), null);
});

check('старый bestMove работает как раньше', () => {
  const r = AI.bestMove(E.create(MIDGAME), 3);
  assert(r && r.move && legal(MIDGAME, r.move));
});

/* ---------- поток: запускаем файл потока в песочнице ---------- */

function loadWorker() {
  const dir = path.join(__dirname, '..', 'assets');
  const replies = [];
  const self = { postMessage: (m) => replies.push(m) };
  self.self = self;
  self.importScripts = (...files) => {
    for (const f of files) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  };
  const ctx = vm.createContext(self);
  vm.runInContext(fs.readFileSync(path.join(dir, 'chess-ai-worker.js'), 'utf8'), ctx, { filename: 'chess-ai-worker.js' });
  return { post: (data) => { self.onmessage({ data }); return replies.pop(); } };
}

check('поток: ход по протоколу', () => {
  const w = loadWorker();
  const r = w.post({ id: 7, fen: MIDGAME, level: 3, maxDepth: 3, minDepth: 2, softMs: 1500, hardMs: 3000 });
  assert.strictEqual(r.id, 7);
  assert.strictEqual(r.ok, true);
  assert(legal(MIDGAME, { from: r.from, to: r.to, promotion: r.promotion }), 'незаконный ход');
  assert(r.depth >= 2 && r.depth <= 3, 'глубина ' + r.depth);
  assert(typeof r.ms === 'number');
});

check('поток: превращение пешки передаётся', () => {
  const w = loadWorker();
  const fen = '7k/P7/8/8/8/8/8/K7 w - - 0 1';
  const r = w.post({ id: 1, fen, level: 3 });
  assert.strictEqual(E.toAlg(r.from) + E.toAlg(r.to), 'a7a8');
  assert.strictEqual(r.promotion, E.QUEEN);
});

check('поток: мат на доске — none', () => {
  const w = loadWorker();
  const r = w.post({ id: 2, fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', level: 2 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.none, true);
});

check('поток: битый FEN — ошибка, а не падение', () => {
  const w = loadWorker();
  const r = w.post({ id: 3, fen: 'это не позиция', level: 2 });
  assert.strictEqual(r.id, 3);
  assert.strictEqual(r.ok, false);
});

if (process.exitCode) console.error('Бот и фоновый поток: есть ошибки');
else console.log('Бот с лимитом времени и фоновый поток: ' + passed + ' проверок пройдено');
