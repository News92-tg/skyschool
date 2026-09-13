/* ============================================================
   SkyySchool — chess puzzle dataset loader
   The legacy set stays unchanged in chess-puzzles-base.js;
   batches are loaded in order so the public entrypoint remains
   data/chess-puzzles.js for existing chess.html code.
   ============================================================ */
document.write('<script src="data/chess-puzzles-base.js"><\/script>');
document.write('<script src="data/chess-puzzles-batch01.js"><\/script>');

/* Защита от стороннего очистителя набора задач.
   Создаём независимую копию после загрузки всех партий и
   восстанавливаем исходный массив, если другой модуль случайно
   обнулил его при инициализации. */
setTimeout(() => {
  if (!Array.isArray(window.CHESS_PUZZLES)) return;
  const backup = window.CHESS_PUZZLES.slice();
  setTimeout(() => {
    if (!Array.isArray(window.CHESS_PUZZLES)) window.CHESS_PUZZLES = [];
    if (window.CHESS_PUZZLES.length !== backup.length) {
      window.CHESS_PUZZLES.length = 0;
      window.CHESS_PUZZLES.push(...backup);
    }
  }, 0);
}, 0);
