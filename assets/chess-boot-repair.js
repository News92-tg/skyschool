/* SkyySchool — безопасный bootstrap-repair для chess.html. */
'use strict';
(function () {
  function restoreRawPuzzles() {
    const backup = window.__CHESS_PUZZLES_RAW_BACKUP__;
    if (!Array.isArray(backup) || !backup.length) return false;

    /* Не заменяем объект массива: chess.html хранит на него ссылку
       в const PUZZLES. Восстанавливаем содержимое существующего массива. */
    if (Array.isArray(window.CHESS_PUZZLES)) {
      if (!window.CHESS_PUZZLES.length) {
        window.CHESS_PUZZLES.push(...backup);
        return true;
      }
      return false;
    }

    window.CHESS_PUZZLES = backup.slice();
    return true;
  }

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
    restoreRawPuzzles();

    if (!Array.isArray(window.CHESS_LESSONS)) {
      await loadOnce('data/chess-lessons.js?v=repair3');
    }
    if (!Array.isArray(window.CHESS_PUZZLES) || !window.CHESS_PUZZLES.length) {
      restoreRawPuzzles();
      if (!Array.isArray(window.CHESS_PUZZLES) || !window.CHESS_PUZZLES.length) {
        await loadOnce('data/chess-puzzles.js?v=repair3');
        restoreRawPuzzles();
      }
    }

    try {
      const lessonList = document.querySelector('#lessonList');
      if (Array.isArray(window.CHESS_LESSONS) && lessonList && !lessonList.children.length && typeof window.renderLessons === 'function') {
        window.renderLessons();
      }
    } catch (_) {}

    try {
      const board = document.querySelector('#pBoard');
      const count = document.querySelector('#pCount');
      if (Array.isArray(window.CHESS_PUZZLES) && window.CHESS_PUZZLES.length && board &&
          typeof window.loadPuzzle === 'function' &&
          (board.querySelectorAll('.sqr').length !== 64 || !String(count?.textContent || '').trim())) {
        window.loadPuzzle(0);
      }
    } catch (_) {}

    try {
      const board = document.querySelector('#gBoard');
      if (typeof window.newGame === 'function' && board && !board.children.length) {
        window.newGame();
      }
    } catch (_) {}

    try {
      if (window.ChessTeacherUI && document.querySelector('#chessTeacherPicker')) {
        const host = document.querySelector('#chessTeacherPicker');
        if (!host.querySelector('.tui-picker')) window.ChessTeacherUI.renderPicker('#chessTeacherPicker');
      }
    } catch (_) {}

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
