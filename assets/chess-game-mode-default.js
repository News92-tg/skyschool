/* Первый вход в обновлённый интерфейс: режим «С тренером» по умолчанию. */
'use strict';
(function () {
  const MODE_KEY = 'sky_chess_game_mode';
  const INIT_KEY = 'sky_chess_game_mode_ui_v1';
  if (!localStorage.getItem(INIT_KEY)) {
    localStorage.setItem(MODE_KEY, 'coach');
    localStorage.setItem(INIT_KEY, '1');
  }
})();
