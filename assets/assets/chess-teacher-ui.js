/* ============================================================
   Реплики и аватар учителя в шахматах.
   Привязка к существующему ChessReview: он считает ярлык, здесь —
   лицо и фраза в стиле выбранного учителя.
   Работает без интернета, без AI-ключа.
   ============================================================ */
'use strict';

window.ChessTeacherUI = (function () {

  /* ---------- SVG-лица (работают офлайн) ---------- */
  const FACES = {
    'strict-petr': `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#4a6fa5"/><circle cx="32" cy="26" r="12" fill="#f0c9a0"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#3a2818"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#2a3360"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><path d="M26 35 L38 35" stroke="#222" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    'kind-max': `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#4a9e6a"/><circle cx="32" cy="26" r="12" fill="#f5d5b5"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#8b5a2b"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#2a6a3a"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><path d="M27 34 Q32 38 37 34" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
    'coach-anya': `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#c48a3a"/><circle cx="32" cy="26" r="12" fill="#f5d5b5"/><path d="M20 24 Q22 10 32 10 Q42 10 44 24 Q42 16 32 16 Q22 16 20 24 Z" fill="#2a1a0a"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#a56a1a"/><circle cx="26" cy="27" r="2" fill="#222"/><circle cx="38" cy="27" r="2" fill="#222"/><path d="M26 35 Q32 39 38 35" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
    'prof-lomonosov': `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#6d5cff"/><circle cx="32" cy="26" r="12" fill="#f0c9a0"/><path d="M20 22 Q22 11 32 11 Q42 11 44 22 Q42 17 32 17 Q22 17 20 22 Z" fill="#c0c0c0"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#3a3060"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><circle cx="26" cy="27" r="6" fill="none" stroke="#222" stroke-width="1.2"/><circle cx="38" cy="27" r="6" fill="none" stroke="#222" stroke-width="1.2"/><path d="M28 35 Q32 37 36 35" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`,
    'little-teacher': `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#e07a9a"/><circle cx="32" cy="26" r="12" fill="#f8e0c8"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#8b5a2b"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#c05a7a"/><circle cx="26" cy="27" r="2.2" fill="#222"/><circle cx="38" cy="27" r="2.2" fill="#222"/><circle cx="23" cy="32" r="2.5" fill="#f5a0a0" opacity=".7"/><circle cx="41" cy="32" r="2.5" fill="#f5a0a0" opacity=".7"/><path d="M28 36 Q32 39 36 36" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`
  };

  /* Что учитель говорит при каждом ярлыке хода */
  const PHRASES = {
    'strict-petr': {
      brilliant: 'Достойно экзамена. Запомни этот ход.',
      good: 'Принимается. Но поищи вариант сильнее.',
      inaccuracy: 'Неточность. Есть ход точнее.',
      mistake: 'Ошибка. Разбери дома.',
      blunder: 'Провал. Отмени ход и посчитай заново.'
    },
    'kind-max': {
      brilliant: 'Ого! Красиво сыграно!',
      good: 'Отличный ход. Просто и понятно.',
      inaccuracy: 'Мелочь, не переживай.',
      mistake: 'Бывает. Разберём после партии.',
      blunder: 'Ой. Ну ладно, продолжаем!'
    },
    'coach-anya': {
      brilliant: 'Вау! Ты гений! 🎉',
      good: 'Супер! Ты растёшь с каждым ходом 💪',
      inaccuracy: 'Ничего, все ошибаются. Пробуй ещё ✨',
      mistake: 'Не расстраивайся! Ошибка — шаг к мастерству.',
      blunder: 'Держись! Даже гроссмейстеры проигрывают.'
    },
    'prof-lomonosov': {
      brilliant: 'Великолепно! Сие достойно трактата.',
      good: 'Разумно. Продолжай, юный коллега.',
      inaccuracy: 'Здесь упущена возможность. Наука требует точности.',
      mistake: 'Сие — ошибка. Занеси в тетрадь наблюдений.',
      blunder: 'Увы, сие недостойно. Разберём позже.'
    },
    'little-teacher': {
      brilliant: 'Ура! Ты волшебник! 🪄',
      good: 'Здорово! Молодец! 🎈',
      inaccuracy: 'Хитрюля! Попробуй ещё! 🌈',
      mistake: 'Ой-ой! Ничего, поиграем ещё! 🐣',
      blunder: 'Не плачь! Дядя научит! 🍭'
    }
  };

  function teacherName(id) {
    if (!window.SkyTeachers || !SkyTeachers.get) return 'Учитель';
    const t = SkyTeachers.get(id);
    if (!t) return 'Учитель';
    return (t.name && (t.name[Sky.lang] || t.name.ru)) || 'Учитель';
  }

  /* Главная функция: показать учителя с фразой под качество хода */
  function reactToMove(quality, opts) {
    const o = opts || {};
    const teacherId = (window.SkyTeachers && window.SkyTeachers.selectedId)
      ? window.SkyTeachers.selectedId()
      : 'kind-max';
    const face = FACES[teacherId] || FACES['kind-max'];
    const line = (PHRASES[teacherId] || PHRASES['kind-max'])[quality] || '';

    const host = o.host || document.getElementById('teacherBubble');
    if (!host) return;
    host.innerHTML =
      '<div class="tui-bubble">' +
        '<div class="tui-face">' + face + '</div>' +
        '<div class="tui-text">' +
          '<div class="tui-name">' + teacherName(teacherId) + '</div>' +
          '<div class="tui-line">' + line + '</div>' +
          (o.note ? '<div class="tui-note">' + o.note + '</div>' : '') +
        '</div>' +
      '</div>';
    host.classList.remove('hidden');
  }

  return { reactToMove, FACES, PHRASES };
})();
