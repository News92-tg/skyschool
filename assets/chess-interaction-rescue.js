/* Надёжный слой интеракций: перехватывает клики независимо от старых UI-слоёв. */
'use strict';
(function () {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

  function showTab(name, button) {
    const names = ['lessons', 'puzzles', 'game', 'teacher', 'live', 'builder'];
    $$('.tabs button[data-tab]').forEach(b => b.setAttribute('aria-selected', String(b === button)));
    names.forEach(n => {
      const sec = $('#tab-' + n);
      if (!sec) return;
      const active = n === name;
      sec.classList.toggle('hidden', !active);
      sec.classList.toggle('active', active);
    });
    if (name === 'puzzles') {
      try {
        if (Array.isArray(window.CHESS_PUZZLES) && typeof window.loadPuzzle === 'function') {
          const i = Math.max(0, Math.min(window.__skyFinalPuzzleIndex || 0, window.CHESS_PUZZLES.length - 1));
          window.__skyFinalPuzzleIndex = i;
          window.loadPuzzle(i);
        }
        if (typeof window.refreshPuzzleUI === 'function') window.refreshPuzzleUI();
      } catch (_) {}
    }
    if (name === 'game') {
      try { if (typeof window.renderGame === 'function') window.renderGame(); } catch (_) {}
    }
    if (name === 'teacher') {
      try { if (typeof window.loadTeacherTasks === 'function') window.loadTeacherTasks(); } catch (_) {}
    }
    if (name === 'live') {
      try { if (typeof window.renderLiveNote === 'function') window.renderLiveNote(); } catch (_) {}
      try { if (window.liveGame && window.liveBoard && typeof window.liveBoard.render === 'function') window.liveBoard.render(); } catch (_) {}
    }
    if (name === 'builder') {
      try { if (typeof window.renderBuilder === 'function') window.renderBuilder(); } catch (_) {}
    }
  }

  function toggleLesson(button) {
    const card = button.closest('.lesson-modern, .lesson');
    if (!card) return;
    const body = card.querySelector('.lesson-modern-body, .body');
    if (!body) return;
    const open = !card.classList.contains('open');
    card.classList.toggle('open', open);
    body.classList.toggle('hidden', !open);
    button.setAttribute('aria-expanded', String(open));
  }

  function callGlobal(name, ...args) {
    try {
      const fn = window[name];
      if (typeof fn === 'function') return fn(...args);
    } catch (_) {}
    return undefined;
  }

  function install() {
    document.addEventListener('click', function (event) {
      const tab = event.target.closest('.tabs button[data-tab]');
      if (tab) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showTab(tab.dataset.tab, tab);
        return;
      }

      const lesson = event.target.closest('#lessonList .lesson-modern > button, #lessonList .lesson > button');
      if (lesson) {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleLesson(lesson);
        return;
      }

      if (event.target.closest('#gNewProxy')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        callGlobal('newGame');
        return;
      }

      if (event.target.closest('#gSurrender')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        callGlobal('resign');
        return;
      }

      if (event.target.closest('#gFlip')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        callGlobal('flipGame');
        return;
      }

      if (event.target.closest('#gUndo')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        callGlobal('undoGame');
        return;
      }

      if (event.target.closest('#pNext')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const list = window.CHESS_PUZZLES;
        if (Array.isArray(list) && list.length && typeof window.loadPuzzle === 'function') {
          const current = Number.isInteger(window.__skyFinalPuzzleIndex) ? window.__skyFinalPuzzleIndex : 0;
          window.__skyFinalPuzzleIndex = (current + 1) % list.length;
          window.loadPuzzle(window.__skyFinalPuzzleIndex);
          if (typeof window.refreshPuzzleUI === 'function') window.refreshPuzzleUI();
        }
        return;
      }

      if (event.target.closest('#pRetry')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const i = Number.isInteger(window.__skyFinalPuzzleIndex) ? window.__skyFinalPuzzleIndex : 0;
        callGlobal('loadPuzzle', i);
        return;
      }

      if (event.target.closest('#pHint')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const idea = $('#pIdea');
        if (idea) idea.classList.toggle('hidden');
        return;
      }

      const mode = event.target.closest('[data-game-mode]');
      if (mode && $('#tab-game')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const name = mode.dataset.gameMode;
        if (name) localStorage.setItem('sky_chess_game_mode', name === 'solo' ? 'solo' : 'coach');
        $$('#gameModePanel [data-game-mode]').forEach(x => {
          const active = x === mode;
          x.classList.toggle('is-active', active);
          x.setAttribute('aria-pressed', String(active));
        });
        const game = $('#tab-game');
        if (game) {
          game.classList.toggle('game-no-coach', name === 'solo');
          game.classList.toggle('game-with-coach', name !== 'solo');
        }
        return;
      }

      if (event.target.closest('#builderSave')) return;
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
