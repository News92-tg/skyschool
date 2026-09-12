/* ============================================================
   SkyySchool — движок «три в ряд»

   Правила обычные: меняем местами две соседние фишки, если после
   обмена получается ряд из трёх и более одинаковых — они исчезают,
   верхние падают вниз, сверху досыпаются новые. Если ряд не собрался,
   обмен отменяется.

   Две вещи, которые в таких играх обычно делают неправильно:

   1. Стартовое поле не должно содержать готовых рядов — иначе игра
      начинается с бесплатного каскада, которого игрок не заслужил.
   2. На поле всегда должен существовать хотя бы один возможный ход.
      Если ходов нет, поле надо пересобрать, иначе игрок застрянет.

   Оба случая здесь проверяются явно.
   ============================================================ */
'use strict';

window.Match3 = (function () {

  const EMPTY = -1;

  function make(cols, rows, types) {
    return { cols, rows, types, cells: new Array(cols * rows).fill(EMPTY) };
  }

  const idx = (g, x, y) => y * g.cols + x;
  const at  = (g, x, y) => (x < 0 || y < 0 || x >= g.cols || y >= g.rows) ? EMPTY : g.cells[idx(g, x, y)];

  /* ---------- поиск рядов ----------
     Возвращает множество индексов клеток, входящих в ряды длиной 3+.
     Горизонтали и вертикали ищем отдельно, а результат складываем в
     Set — тогда фишка на пересечении двух рядов посчитается один раз. */
  function findMatches(g) {
    const hits = new Set();

    for (let y = 0; y < g.rows; y++) {
      let run = 1;
      for (let x = 1; x <= g.cols; x++) {
        const same = x < g.cols && at(g, x, y) !== EMPTY && at(g, x, y) === at(g, x - 1, y);
        if (same) run++;
        else {
          if (run >= 3) for (let k = x - run; k < x; k++) hits.add(idx(g, k, y));
          run = 1;
        }
      }
    }
    for (let x = 0; x < g.cols; x++) {
      let run = 1;
      for (let y = 1; y <= g.rows; y++) {
        const same = y < g.rows && at(g, x, y) !== EMPTY && at(g, x, y) === at(g, x, y - 1);
        if (same) run++;
        else {
          if (run >= 3) for (let k = y - run; k < y; k++) hits.add(idx(g, x, k));
          run = 1;
        }
      }
    }
    return hits;
  }

  /* ---------- падение и досыпание ----------
     Идём снизу вверх и сдвигаем непустые клетки вниз, пустые места
     сверху заполняем новыми фишками. rnd передаётся снаружи, чтобы
     тесты могли работать с предсказуемым генератором. */
  function collapse(g, rnd) {
    const random = rnd || Math.random;
    for (let x = 0; x < g.cols; x++) {
      let write = g.rows - 1;
      for (let y = g.rows - 1; y >= 0; y--) {
        const v = at(g, x, y);
        if (v !== EMPTY) { g.cells[idx(g, x, write)] = v; write--; }
      }
      for (let y = write; y >= 0; y--) {
        g.cells[idx(g, x, y)] = Math.floor(random() * g.types);
      }
    }
  }

  function clear(g, hits) {
    for (const i of hits) g.cells[i] = EMPTY;
    return hits.size;
  }

  /* ---------- обмен ---------- */
  function areNeighbours(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }
  function swap(g, a, b) {
    const ia = idx(g, a.x, a.y), ib = idx(g, b.x, b.y);
    const t = g.cells[ia]; g.cells[ia] = g.cells[ib]; g.cells[ib] = t;
  }

  /* Ход допустим, только если после обмена появился ряд. */
  function trySwap(g, a, b) {
    if (!areNeighbours(a, b)) return false;
    swap(g, a, b);
    const hits = findMatches(g);
    if (hits.size) return true;
    swap(g, a, b);          // ряда нет — возвращаем как было
    return false;
  }

  /* ---------- есть ли вообще ход ----------
     Перебираем все обмены с правым и нижним соседом: этого достаточно,
     потому что обмен симметричен и каждая пара так проверяется ровно раз. */
  function hasMove(g) {
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx >= g.cols || ny >= g.rows) continue;
          swap(g, { x, y }, { x: nx, y: ny });
          const found = findMatches(g).size > 0;
          swap(g, { x, y }, { x: nx, y: ny });
          if (found) return true;
        }
      }
    }
    return false;
  }

  /* ---------- новое поле ----------
     Заполняем клетку за клеткой, но запрещаем ставить фишку, которая
     сразу достроит ряд из трёх. Так стартовое поле гарантированно без
     готовых совпадений — и не нужно потом «прокручивать» каскады. */
  function fill(g, rnd) {
    const random = rnd || Math.random;
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        const banned = new Set();
        if (at(g, x - 1, y) !== EMPTY && at(g, x - 1, y) === at(g, x - 2, y)) banned.add(at(g, x - 1, y));
        if (at(g, x, y - 1) !== EMPTY && at(g, x, y - 1) === at(g, x, y - 2)) banned.add(at(g, x, y - 1));

        const allowed = [];
        for (let t = 0; t < g.types; t++) if (!banned.has(t)) allowed.push(t);
        g.cells[idx(g, x, y)] = allowed[Math.floor(random() * allowed.length)];
      }
    }
  }

  function create(cols, rows, types, rnd) {
    const g = make(cols, rows, types);
    let guard = 0;
    do {
      fill(g, rnd);
      guard++;
    } while (!hasMove(g) && guard < 60);   // на всякий случай не зацикливаемся
    return g;
  }

  /* Пересборка, когда ходов не осталось. Прогресс игрока не трогаем —
     меняется только расположение фишек. */
  function reshuffle(g, rnd) {
    let guard = 0;
    do { fill(g, rnd); guard++; }
    while ((!hasMove(g) || findMatches(g).size) && guard < 60);
    return g;
  }

  /* ---------- полный цикл после хода ----------
     Возвращает список «волн»: сколько фишек убрано в каждом каскаде.
     Интерфейс по нему рисует анимацию и начисляет очки с множителем. */
  function resolve(g, rnd) {
    const waves = [];
    let hits = findMatches(g);
    while (hits.size) {
      waves.push(hits.size);
      clear(g, hits);
      collapse(g, rnd);
      hits = findMatches(g);
    }
    return waves;
  }

  return { EMPTY, create, make, fill, at, idx, findMatches, clear, collapse,
           swap, trySwap, hasMove, reshuffle, resolve, areNeighbours };
})();

if (typeof module !== 'undefined') module.exports = window.Match3;
