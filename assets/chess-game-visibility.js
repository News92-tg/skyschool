/* SkyySchool — управление видимостью настроек режима игры. */
'use strict';
(function () {
  const MODE_KEY = 'sky_chess_game_mode';
  const INIT_KEY = 'sky_chess_game_mode_ui_v1';
  const TRAINER = 'coach';
  const SOLO = 'solo';

  const $ = (id) => document.getElementById(id);

  function ensureDefaultMode() {
    /* Первый вход после старой версии: по умолчанию — игра с тренером.
       После этого выбор пользователя не перезаписываем. */
    if (!localStorage.getItem(INIT_KEY)) {
      localStorage.setItem(MODE_KEY, TRAINER);
      localStorage.setItem(INIT_KEY, '1');
    }
  }

  function sync() {
    const game = $('tab-game');
    if (!game) return;

    const mode = localStorage.getItem(MODE_KEY) === SOLO ? SOLO : TRAINER;
    game.classList.toggle('game-with-coach', mode === TRAINER);
    game.classList.toggle('game-no-coach', mode === SOLO);

    const panel = game.querySelector('.difficulty-panel');
    if (panel) panel.hidden = mode !== SOLO;

    const buttons = game.querySelectorAll('[data-game-mode]');
    buttons.forEach(btn => {
      const active = btn.dataset.gameMode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function bind() {
    const game = $('tab-game');
    if (!game || game.__skyModeVisibilityBound) return;
    game.__skyModeVisibilityBound = true;

    game.addEventListener('click', (event) => {
      const button = event.target.closest('[data-game-mode]');
      if (!button) return;
      const mode = button.dataset.gameMode === SOLO ? SOLO : TRAINER;
      localStorage.setItem(MODE_KEY, mode);
      sync();
    });

    const observer = new MutationObserver(sync);
    observer.observe(game, { childList: true, subtree: true });
  }

  function init() {
    ensureDefaultMode();
    bind();
    sync();
  }

  window.addEventListener('chessModeChanged', sync);
  document.addEventListener('langchange', () => setTimeout(sync, 0));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0), { once: true });
  } else {
    setTimeout(init, 0);
  }
})();
