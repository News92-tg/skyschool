/* ============================================================
   Шахматный бот в фоновом потоке (Web Worker).

   Зачем. Перебор на «Сильном» уровне занимает от долей секунды до
   нескольких секунд, а на телефоне — ещё в 3–5 раз дольше. В
   основном потоке всё это время страница «замерзала»: не крутился
   индикатор, не нажимались кнопки, не прокручивалась страница. Здесь
   тот же движок и тот же перебор (assets/chess-ai-core.js) считают
   в отдельном потоке, а страница остаётся живой.

   Протокол. Страница (assets/chess-ai.js → ChessAIAsync) присылает
     { id, fen, level, maxDepth, minDepth, softMs, hardMs }
   и получает обратно
     { id, ok:true, from, to, promotion, score, depth, nodes, ms, timedOut }
   или { id, ok:true, none:true }, если ходов нет, или
   { id, ok:false, error }.

   Ход передаётся клетками, а не объектом: страница сама находит
   его среди законных ходов своей позиции — так ход из потока не
   может оказаться «чужим» или незаконным.
   ============================================================ */
'use strict';

importScripts('chess-engine.js', 'chess-ai-core.js');

self.onmessage = function (event) {
  const q = event.data || {};
  const reply = { id: q.id };
  try {
    const st = self.ChessEngine.create(q.fen);
    const res = self.ChessAI.bestMoveTimed(st, {
      level: q.level,
      maxDepth: q.maxDepth,
      minDepth: q.minDepth,
      softMs: q.softMs,
      hardMs: q.hardMs
    });
    reply.ok = true;
    if (!res) {
      reply.none = true;
    } else {
      reply.from = res.move.from;
      reply.to = res.move.to;
      reply.promotion = res.move.promotion || 0;
      reply.score = res.score;
      reply.depth = res.depth;
      reply.nodes = res.nodes;
      reply.ms = res.ms;
      reply.timedOut = res.timedOut;
    }
  } catch (err) {
    reply.ok = false;
    reply.error = String((err && err.message) || err);
  }
  self.postMessage(reply);
};
