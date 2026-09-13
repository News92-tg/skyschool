/* Первый вход в обновлённый интерфейс: режим «С тренером» по умолчанию. */
'use strict';
(function () {
  const MODE_KEY = 'sky_chess_game_mode';
  const INIT_KEY = 'sky_chess_game_mode_ui_v1';
  if (!localStorage.getItem(INIT_KEY)) {
    localStorage.setItem(MODE_KEY, 'coach');
    localStorage.setItem(INIT_KEY, '1');
  }

  /* Сложность является настройкой только режима без тренера. */
  const style = document.createElement('style');
  style.textContent = `
    #tab-game.game-with-coach .difficulty-panel{display:none!important}
    #tab-game.game-no-coach .difficulty-panel{display:block!important}
  `;
  document.head.appendChild(style);
})();
