/* Robust sequential loader for the chess experience layers. */
(function () {
  'use strict';

  const head = document.head;
  const scripts = [
    'assets/chess-teacher-ui-core.js?v=10',
    'assets/chess-game-mode-default.js?v=6',
    'assets/chess-game-modes.js?v=10',
    'assets/chess-puzzle-coach.js?v=12',
    'assets/chess-layout.js?v=7',
    'assets/chess-review-ui.js?v=5',
    'assets/chess-game-visibility.js?v=5',
    'assets/chess-boot-repair.js?v=5',
    'assets/chess-trainer-access.js?v=4',
    'assets/chess-lesson-ui.js?v=3',
    'assets/chess-lesson-fix.js?v=2',
    'assets/chess-new-game-fix.js?v=2',
    'assets/chess-lesson-outcomes.js?v=2',
    'assets/chess-puzzle-bootstrap-fix.js?v=2',
    'assets/chess-final-ui.js?v=4',
    'assets/chess-runtime-hotfix.js?v=2',
    'assets/chess-interaction-rescue.js?v=2',
    'assets/chess-deadsite-rescue.js?v=1'
  ];

  function loadSequentially(index) {
    if (index >= scripts.length) return;
    const src = scripts[index];
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = function () { loadSequentially(index + 1); };
    script.onerror = function () {
      console.error('[ChessLoader] Failed to load', src);
      loadSequentially(index + 1);
    };
    head.appendChild(script);
  }

  if (!head.querySelector('link[data-chess-layout="1"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/chess-layout.css?v=7';
    link.dataset.chessLayout = '1';
    head.appendChild(link);
  }

  loadSequentially(0);
})();
