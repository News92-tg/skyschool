/* ============================================================
   SkyySchool — chess puzzle dataset loader
   The legacy set stays unchanged in chess-puzzles-base.js;
   batches are loaded in order so the public entrypoint remains
   data/chess-puzzles.js for existing chess.html code.
   ============================================================ */
document.write('<script src="data/chess-puzzles-base.js"><\/script>');
document.write('<script src="data/chess-puzzles-batch01.js"><\/script>');

/* Критично: сохраняем исходный набор сразу после загрузки data-файлов.
   UI-модули могут позже фильтровать массив. Восстанавливаем именно
   ТОТ ЖЕ объект массива, чтобы const PUZZLES в chess.html тоже увидел
   восстановленные задачи. */
if (Array.isArray(window.CHESS_PUZZLES)) {
  window.__CHESS_PUZZLES_RAW_BACKUP__ = window.CHESS_PUZZLES.slice();
}

setTimeout(() => {
  const backup = window.__CHESS_PUZZLES_RAW_BACKUP__;
  if (!Array.isArray(backup) || !backup.length) return;

  if (Array.isArray(window.CHESS_PUZZLES)) {
    if (!window.CHESS_PUZZLES.length) {
      window.CHESS_PUZZLES.push(...backup);
    }
  } else {
    window.CHESS_PUZZLES = backup.slice();
  }
}, 0);
