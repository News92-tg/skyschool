/* SkyySchool — chess puzzle dataset loader. */
document.write('<script src="data/chess-puzzles-base.js"><\/script>');
document.write('<script src="data/chess-puzzles-batch01.js"><\/script>');
document.write('<script src="data/chess-puzzles-batch02.js"><\/script>');

/* Сохраняем полный каталог до запуска UI-фильтрации. */
if (Array.isArray(window.CHESS_PUZZLES)) {
  window.__CHESS_PUZZLES_RAW_BACKUP__ = window.CHESS_PUZZLES.slice();
}

document.write('<script src="assets/chess-puzzle-filters.js"><\/script>');
