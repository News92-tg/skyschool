/* Надёжный обработчик «Новая партия».
   Не зависит от скрытой legacy-кнопки #gNew. */
'use strict';
(function () {
  const BOUND = '__skyNewGameFixBound';

  function bind() {
    const panel = document.getElementById('gameModePanel');
    if (!panel || panel[BOUND]) return;
    const button = panel.querySelector('#gNewProxy');
    if (!button) return;

    panel[BOUND] = true;
    panel.addEventListener('click', function (event) {
      const target = event.target.closest('#gNewProxy');
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        if (typeof window.newGame === 'function') {
          window.newGame();
          window.dispatchEvent(new Event('chess:new-game'));
          return;
        }

        const legacy = document.getElementById('gNew');
        if (legacy) legacy.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } catch (error) {
        console.error('[Chess] new game failed:', error);
      }
    }, true);
  }

  function init() {
    bind();
    setTimeout(bind, 0);
    setTimeout(bind, 100);
    setTimeout(bind, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('langchange', init);
})();
