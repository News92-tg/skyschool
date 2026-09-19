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
