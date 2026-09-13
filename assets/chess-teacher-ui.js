/*
  Stable chess loader.
  The page contains the core chess application inline, so we only load the
  trainer core and one consolidated UX layer. No rescue/hotfix chain.
*/
document.write('<link rel="stylesheet" href="assets/chess-layout.css?v=8">');
document.write('<script src="assets/chess-teacher-ui-core.js?v=12"><\/script>');
document.write('<script src="assets/chess-final-ui.js?v=5"><\/script>');
