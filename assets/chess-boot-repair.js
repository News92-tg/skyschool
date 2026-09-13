/* SkyySchool — безопасный bootstrap-repair для chess.html. */
'use strict';
(function () {
  const has = key => Object.prototype.hasOwnProperty.call(window, key) && window[key] != null;

  function loadOnce(src) {
    return new Promise(resolve => {
      const existing = document.querySelector('script[data-chess-repair="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', resolve, { once:true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.chessRepair = src;
      s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve(); }, { once:true });
      s.addEventListener('error', resolve, { once:true });
      document.head.appendChild(s);
    });
  }

  async function repair() {
    if (!Array.isArray(window.CHESS_LESSONS)) await loadOnce('data/chess-lessons.js?v=repair2');
    if (!Array.isArray(window.CHESS_PUZZLES)) await loadOnce('data/chess-puzzles.js?v=repair2');

    /* Уроки: если основной старт не успел отрисовать список, повторяем. */
    try {
      const lessonList = document.querySelector('#lessonList');
      if (Array.isArray(window.CHESS_LESSONS) && lessonList && !lessonList.children.length && typeof window.renderLessons === 'function') {
        window.renderLessons();
      }
    } catch (_) {}

    /* Задачи: наличие текста в pCount ещё не означает, что доска реально
       получила 64 клетки. После нескольких UI-обёрток именно это и
       происходило: метаданные были, а #pBoard оставался пустым. */
    try {
      const board = document.querySelector('#pBoard');
      if (Array.isArray(window.CHESS_PUZZLES) && board &&
          typeof window.loadPuzzle === 'function' &&
          board.querySelectorAll('.sqr').length !== 64) {
        window.loadPuzzle(0);
      }
    } catch (_) {}

    /* Если на вкладку задач переключились позже, принудительно
       перерисовываем текущую доску, но не сбрасываем номер задачи. */
    try {
      const board = document.querySelector('#pBoard');
      if (board && typeof window.puzzleBoard !== 'undefined' && board.closest('#tab-puzzles') && !board.__chessRepairBound) {
        board.__chessRepairBound = true;
        const tabs = document.querySelector('.tabs');
        tabs?.addEventListener('click', e => {
          const b = e.target.closest('button[data-tab="puzzles"]');
          if (!b) return;
          setTimeout(() => {
            try { window.puzzleBoard?.render(); } catch (_) {}
          }, 0);
        });
      }
    } catch (_) {}

    /* Тренер. */
    try {
      if (window.ChessTeacherUI && document.querySelector('#chessTeacherPicker')) {
        const host = document.querySelector('#chessTeacherPicker');
        if (!host.querySelector('.tui-picker')) window.ChessTeacherUI.renderPicker('#chessTeacherPicker');
      }
    } catch (_) {}

    /* Запасной вариант для вкладки тренера. */
    try {
      const tabs = document.querySelector('.tabs');
      const main = document.querySelector('.wrap');
      const host = document.querySelector('#chessTeacherPicker');
      if (tabs && main && host && !tabs.querySelector('button[data-tab="trainer"]')) {
        const trainerButton = document.createElement('button');
        trainerButton.type = 'button';
        trainerButton.dataset.tab = 'trainer';
        trainerButton.setAttribute('aria-selected', 'false');
        trainerButton.textContent = (window.Sky && Sky.lang === 'en') ? 'Coach' : 'Тренер';
        tabs.appendChild(trainerButton);
      }

      let trainerSection = document.querySelector('#tab-trainer');
      if (!trainerSection && host.closest('.section')) {
        const root = host.closest('.section');
        trainerSection = document.createElement('section');
        trainerSection.id = 'tab-trainer';
        trainerSection.className = 'trainer-section hidden';
        trainerSection.innerHTML = '<div class="section-head"><h2>Выберите своего тренера</h2><p class="lead" style="font-size:13px">Тренер будет комментировать ваши ходы после каждой партии — своим тоном и со своим характером.</p></div>';
        trainerSection.appendChild(root);
        main.appendChild(trainerSection);
      }
      if (tabs && !tabs.dataset.repairTabsBound) {
        tabs.dataset.repairTabsBound = '1';
        tabs.addEventListener('click', e => {
          const b = e.target.closest('button[data-tab]');
          if (!b) return;
          tabs.querySelectorAll('button[data-tab]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
          ['lessons','puzzles','game','teacher','live','trainer'].forEach(name => {
            const sec = document.querySelector('#tab-' + name);
            if (sec) sec.classList.toggle('hidden', name !== b.dataset.tab);
          });
        });
      }
    } catch (_) {}
  }

  function start() {
    let attempts = 0;
    const run = () => {
      attempts++;
      repair();
      if (attempts < 10) setTimeout(run, 180);
    };
    run();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();