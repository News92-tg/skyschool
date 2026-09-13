/* ============================================================
   SkyySchool — chess puzzle dataset loader
   The legacy set stays unchanged in chess-puzzles-base.js;
   batches are loaded in order so the public entrypoint remains
   data/chess-puzzles.js for existing chess.html code.
   ============================================================ */
document.write('<script src="data/chess-puzzles-base.js"><\/script>');
document.write('<script src="data/chess-puzzles-batch01.js"><\/script>');

/* Критично: сохраняем исходный набор СРАЗУ после загрузки data-файлов.
   Некоторые UI-модули могут валидировать/фильтровать массив позднее.
   Восстановление должно иметь неизменяемый источник, иначе после
   destructive filter восстановить задачи уже невозможно. */
if (Array.isArray(window.CHESS_PUZZLES)) {
  window.__CHESS_PUZZLES_RAW_BACKUP__ = window.CHESS_PUZZLES.slice();
}

/* На случай изменения набора сторонним модулем после bootstrap. */
setTimeout(() => {
  const backup = window.__CHESS_PUZZLES_RAW_BACKUP__;
  if (!Array.isArray(backup) || !backup.length) return;
  if (!Array.isArray(window.CHESS_PUZZLES) || !window.CHESS_PUZZLES.length) {
    window.CHESS_PUZZLES = backup.slice();
  }
}, 0);
