/* Sync AI core + SkyySchool chess platform.
   Note: chess-rebuild-v2.js and chess-lessons-v3.js used to load here too.
   Both were superseded, self-contained lesson/board renderers left over from
   an earlier redesign attempt. They ran on a deferred timer (setTimeout 0)
   *after* the page's own board renderer and after the current lessons UI
   (assets/chess-lessons-system.js etc.), so they silently overwrote #gBoard
   and #lessonList with an older, differently-styled board (wrong square
   colors, wrong piece font, no coordinate labels) whenever their timing won
   the race — this was the cause of the board/pieces sometimes rendering
   incorrectly. Nothing else in the codebase references their classes
   (cv2-*) or calls into them, so they were removed rather than patched. */
(function(){
  document.write('<script src="assets/chess-ai-core.js"><\/script><script src="assets/chess-platform.js"><\/script><script src="assets/chess-platform-fixes.js"><\/script><script src="assets/chess-platform-plus.js"><\/script>');
})();

/* ============================================================
   ChessAIAsync — ход бота без подвисания страницы.

   Считает в фоновом потоке (assets/chess-ai-worker.js). Если поток
   недоступен (страница открыта как file://, старый браузер, поток
   упал или завис), тот же перебор с тем же лимитом времени идёт в
   основном потоке — медленнее для страницы, но партия не ломается.

   Глубина зависит от устройства и уровня:
     компьютер — «Клубный» 3, «Сильный» 3–4;
     телефон   — «Клубный» и «Сильный» 2–3.
   Где внутри диапазона — решают часы: цель 1–2 секунды на ход,
   потолок 3 секунды, после него — лучший ход последней законченной
   глубины (см. bestMoveTimed в assets/chess-ai-core.js).
   ============================================================ */
(function (root) {
  'use strict';
  var nav = root.navigator || {};
  var TOUCH = ('ontouchstart' in root) || nav.maxTouchPoints > 0;
  var screenMin = root.screen ? Math.min(root.screen.width || 0, root.screen.height || 0) : 0;
  var MOBILE = TOUCH && screenMin > 0 && screenMin < 768;
  var SOFT_MS = 1500, HARD_MS = 3000;
  var WORKER_URL = 'assets/chess-ai-worker.js';

  var worker = null, broken = false, seq = 0, pending = {};

  /* «Умный» уровень (99) выбирает силу по последним ходам ученика —
     так же, как обёртка ChessAI.bestMove в chess-teacher-ui-core.js. */
  function resolveLevel(level) {
    if (String(level) === '99') {
      var ui = root.ChessTeacherUI;
      return ui && ui.adaptiveLevel ? ui.adaptiveLevel() : 2;
    }
    var n = Number(level);
    return n >= 1 && n <= 4 ? n : 2;
  }

  function plan(level) {
    var L = resolveLevel(level);
    var base = { 1: 1, 2: 2, 3: 3, 4: 4 }[L];
    if (MOBILE) return { level: L, maxDepth: Math.min(base, 3), minDepth: Math.min(base, 2) };
    return { level: L, maxDepth: base, minDepth: Math.min(base, 3) };
  }

  function failAll(reason) {
    Object.keys(pending).forEach(function (id) {
      var p = pending[id];
      delete pending[id];
      clearTimeout(p.timer);
      p.fallback(reason);
    });
  }

  function kill() {
    if (worker) { try { worker.terminate(); } catch (e) {} }
    worker = null;
  }

  function spawn() {
    if (worker || broken) return worker;
    if (typeof root.Worker !== 'function') { broken = true; return null; }
    try {
      worker = new root.Worker(WORKER_URL);
    } catch (e) {
      /* file:// и строгие настройки браузера запрещают потоки */
      broken = true;
      return null;
    }
    worker.onmessage = function (e) {
      var d = e.data || {}, p = pending[d.id];
      if (!p) return;
      delete pending[d.id];
      clearTimeout(p.timer);
      if (d.ok) p.done(d); else p.fallback('error');
    };
    worker.onerror = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      broken = true;
      kill();
      failAll('error');
    };
    return worker;
  }

  function findLegal(E, st, from, to, promotion) {
    var list = E.generate(st);
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.from === from && m.to === to && (m.promotion || 0) === (promotion || 0)) return m;
    }
    return null;
  }

  /* Тот же перебор в основном потоке — запасной путь. */
  function syncMove(st, cfg) {
    var AI = root.ChessAI;
    if (!AI) return null;
    if (!AI.bestMoveTimed) return AI.bestMove(st, cfg.level);
    return AI.bestMoveTimed(st, { level: cfg.level, maxDepth: cfg.maxDepth, minDepth: cfg.minDepth, softMs: SOFT_MS, hardMs: HARD_MS });
  }

  /* Ход бота для позиции st. Промис даёт { move, score, depth, ms,
     timedOut, via } или null (ходов нет). Позицию можно менять сразу
     после вызова: считается по снимку FEN, а ход ищется среди
     законных ходов снимка. */
  function bestMove(st, level, opts) {
    var E = root.ChessEngine;
    var cfg = plan(level);
    if (opts && opts.level) cfg = plan(opts.level);
    var fen = E.fen(st);
    var snapshot = E.create(fen);
    var t0 = Date.now();

    return new Promise(function (resolve) {
      var settled = false;
      function finish(res, via) {
        if (settled) return;
        settled = true;
        api.lastVia = via;
        if (res) { res.via = via; res.fen = fen; }
        resolve(res || null);
      }
      function fallback() {
        /* кадр на отрисовку «Бот думает…», потом считаем здесь */
        setTimeout(function () {
          var r = null;
          try { r = syncMove(snapshot, cfg); } catch (e) { r = null; }
          if (r && r.move) r.move = findLegal(E, snapshot, r.move.from, r.move.to, r.move.promotion) || r.move;
          finish(r, 'main');
        }, 30);
      }

      var w = spawn();
      if (!w) return fallback();
      var id = ++seq;
      pending[id] = {
        done: function (d) {
          if (d.none) return finish(null, 'worker');
          var move = findLegal(E, snapshot, d.from, d.to, d.promotion);
          if (!move) return fallback();
          finish({ move: move, score: d.score, depth: d.depth, nodes: d.nodes, ms: Date.now() - t0, timedOut: !!d.timedOut }, 'worker');
        },
        fallback: fallback,
        /* поток не ответил сильно позже потолка — считаем, что он
           завис: убиваем и доигрываем ход здесь */
        timer: setTimeout(function () {
          if (!pending[id]) return;
          delete pending[id];
          kill();
          fallback();
        }, HARD_MS + 2500)
      };
      w.postMessage({ id: id, fen: fen, level: cfg.level, maxDepth: cfg.maxDepth, minDepth: cfg.minDepth, softMs: SOFT_MS, hardMs: HARD_MS });
    });
  }

  /* Бросить текущий расчёт (новая партия): поток перезапускается,
     чтобы следующий ход не ждал в очереди за ненужным. */
  function cancel() {
    if (!Object.keys(pending).length) return;
    Object.keys(pending).forEach(function (id) { clearTimeout(pending[id].timer); delete pending[id]; });
    kill();
  }

  var api = {
    bestMove: bestMove,
    cancel: cancel,
    plan: plan,
    resolveLevel: resolveLevel,
    isTouch: TOUCH,
    isMobile: MOBILE,
    SOFT_MS: SOFT_MS,
    HARD_MS: HARD_MS,
    lastVia: null
  };
  root.ChessAIAsync = api;
})(window);
