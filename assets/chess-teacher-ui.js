/* ============================================================
   Шахматные AI-учителя. Отдельный набор — не пересекается
   с учителями по предметам (ai-teachers.js).
   Тон, лицо и фразы зависят от выбранного тренера.
   ============================================================ */
'use strict';

window.ChessTeacherUI = (function () {

  const STORE = 'sky_chess_teacher';
  const DEFAULT = 'coach-fire';

  /* ---------- Лица (SVG, офлайн) ---------- */
  const FACES = {
    'coach-fire': '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#c0392b"/><circle cx="32" cy="26" r="12" fill="#f0c9a0"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#3a1010"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#7a1a10"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><path d="M26 36 Q32 40 38 36" stroke="#222" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M10 8 L14 16 L18 8" stroke="#f5a623" stroke-width="2" fill="none"/></svg>',
    'coach-calm': '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#2e6f95"/><circle cx="32" cy="26" r="12" fill="#f0c9a0"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#1a3a5a"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#1a3f5a"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><path d="M27 34 Q32 37 37 34" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    'coach-prof': '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#4a3a7a"/><circle cx="32" cy="26" r="12" fill="#f0c9a0"/><path d="M20 22 Q22 11 32 11 Q42 11 44 22 Q42 17 32 17 Q22 17 20 22 Z" fill="#c0c0c0"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#2a1f4a"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><circle cx="26" cy="27" r="6" fill="none" stroke="#222" stroke-width="1.2"/><circle cx="38" cy="27" r="6" fill="none" stroke="#222" stroke-width="1.2"/><path d="M28 35 Q32 37 36 35" stroke="#222" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
    'coach-friend': '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#2e8b57"/><circle cx="32" cy="26" r="12" fill="#f5d5b5"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#8b5a2b"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#1a5a3a"/><circle cx="26" cy="27" r="2" fill="#222"/><circle cx="38" cy="27" r="2" fill="#222"/><path d="M26 35 Q32 39 38 35" stroke="#222" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
    'coach-strict': '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#2b2b2b"/><circle cx="32" cy="26" r="12" fill="#e8d5b5"/><path d="M20 22 Q22 12 32 12 Q42 12 44 22 Q42 18 32 18 Q22 18 20 22 Z" fill="#1a1a1a"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#3a3a3a"/><circle cx="26" cy="27" r="1.8" fill="#222"/><circle cx="38" cy="27" r="1.8" fill="#222"/><path d="M24 36 L40 36" stroke="#222" stroke-width="2" stroke-linecap="round"/></svg>',
    'coach-romantic': '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="31" fill="#8b3a8b"/><circle cx="32" cy="26" r="12" fill="#f5d5b5"/><path d="M20 22 Q22 10 32 10 Q42 10 44 22 Q42 16 32 16 Q22 16 20 22 Z" fill="#4a1a4a"/><path d="M14 62 Q14 42 32 42 Q50 42 50 62 Z" fill="#5a2050"/><circle cx="26" cy="27" r="2" fill="#222"/><circle cx="38" cy="27" r="2" fill="#222"/><path d="M26 36 Q32 40 38 36" stroke="#222" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>'
  };

  /* ---------- Учителя и их фразы ---------- */
  const TEACHERS = {
    'coach-fire': {
      name: { ru: 'Атакующий Огонь', en: 'Coach Fire' },
      role: { ru: 'Атака и инициатива', en: 'Attack & initiative' },
      strictness: 3,
      phrases: {
        brilliant: 'Вот это по-нашему! Смело, красиво, в духе Таля!',
        good: 'Неплохо. Но где атака? Ищи инициативу!',
        inaccuracy: 'Слишком тихо. В атаку, атаку!',
        mistake: 'Потерял темп — и всё, атака захлебнулась.',
        blunder: 'Катастрофа. Всё, инициатива ушла сопернику.'
      }
    },
    'coach-calm': {
      name: { ru: 'Спокойный Стратег', en: 'Calm Strategist' },
      role: { ru: 'Позиция и структура', en: 'Position & structure' },
      strictness: 3,
      phrases: {
        brilliant: 'Прекрасный позиционный ход. Так играл Карпов.',
        good: 'Хорошо, спокойно, по позиции.',
        inaccuracy: 'Не спеши. Смотри на структуру, а не на эффекты.',
        mistake: 'Ты ослабил пешки. Это останется до эндшпиля.',
        blunder: 'Слишком много слабостей. Позиция разваливается.'
      }
    },
    'coach-prof': {
      name: { ru: 'Профессор Расчёт', en: 'Professor Calculation' },
      role: { ru: 'Точный счёт вариантов', en: 'Exact calculation' },
      strictness: 5,
      phrases: {
        brilliant: 'Идеальный расчёт. Проверено до конца.',
        good: 'Верно. Но проверь все ответы соперника.',
        inaccuracy: 'Не все линии просчитаны. Пересчитай.',
        mistake: 'Ты не посчитал взятие на предыдущем ходу.',
        blunder: 'Ошибка в расчёте. Разберись с вариантами.'
      }
    },
    'coach-friend': {
      name: { ru: 'Добрый Тренер', en: 'Friendly Coach' },
      role: { ru: 'Поддержка и разбор', en: 'Support & review' },
      strictness: 2,
      phrases: {
        brilliant: 'Молодец! Так держать!',
        good: 'Отличный ход. Идём дальше.',
        inaccuracy: 'Ничего страшного, бывает. Пробуй ещё.',
        mistake: 'Не переживай — на ошибках и учимся.',
        blunder: 'Ой. Ну ладно, разберём, станет понятно.'
      }
    },
    'coach-strict': {
      name: { ru: 'Строгий Гроссмейстер', en: 'Strict Grandmaster' },
      role: { ru: 'Экзаменационная строгость', en: 'Exam-level strictness' },
      strictness: 5,
      phrases: {
        brilliant: 'Достойно. Единственный правильный ход.',
        good: 'Допустимо. Но не лучшее.',
        inaccuracy: 'Неточность. В турнире это стоило бы пол-очка.',
        mistake: 'Ошибка. Учись рассчитывать до конца.',
        blunder: 'Провал. Разбери эту позицию дома.'
      }
    },
    'coach-romantic': {
      name: { ru: 'Романтик Атаки', en: 'Romantic Attacker' },
      role: { ru: 'Жертвы и комбинации', en: 'Sacrifices & combos' },
      strictness: 3,
      phrases: {
        brilliant: 'Блестяще! Настоящая жертва, как у Морфи!',
        good: 'Хорошо. Но можно было рискнуть и выиграть красивее.',
        inaccuracy: 'Слишком солидно. Где романтика?',
        mistake: 'Ты не решился на жертву — и упустил победу.',
        blunder: 'Увы, комбинация не сложилась. Считай точнее.'
      }
    }
  };

  /* ---------- Состояние ---------- */
  function getSelected() {
    const id = localStorage.getItem(STORE);
    return TEACHERS[id] ? id : DEFAULT;
  }
  function setSelected(id) {
    if (TEACHERS[id]) localStorage.setItem(STORE, id);
  }
  function getTeacher() {
    return TEACHERS[getSelected()];
  }

  /* ---------- HTML учителя для вставки в блок разбора ---------- */
  function renderFor(quality) {
    const id = getSelected();
    const t = TEACHERS[id];
    if (!t) return '';
    const face = FACES[id] || FACES[DEFAULT];
    const line = t.phrases[quality] || t.phrases.good;
    const lang = (window.Sky && Sky.lang) || 'ru';
    const name = t.name[lang] || t.name.ru;

    const colorByQuality = {
      brilliant: '#8b5cf6',
      good: '#16a34a',
      inaccuracy: '#d97706',
      mistake: '#e07a3f',
      blunder: '#e11d48'
    }[quality] || '#666';

    return '<div class="tui-inline" data-quality="' + quality + '">' +
      '<div class="tui-face">' + face + '</div>' +
      '<div class="tui-text">' +
        '<div class="tui-name">' + name +
          '<span class="tui-role" style="color:' + colorByQuality + '">' + (t.role[lang] || t.role.ru) + '</span>' +
        '</div>' +
        '<div class="tui-line">' + line + '</div>' +
      '</div>' +
    '</div>';
  }

  /* ---------- Выбор учителя ---------- */
  function renderPicker(hostSel) {
    const host = typeof hostSel === 'string' ? document.querySelector(hostSel) : hostSel;
    if (!host) return;
    const lang = (window.Sky && Sky.lang) || 'ru';
    const selected = getSelected();

    host.innerHTML = '<div class="tui-picker">' +
      Object.keys(TEACHERS).map(function(id) {
        const t = TEACHERS[id];
        const face = FACES[id];
        const active = id === selected ? ' active' : '';
        const name = t.name[lang] || t.name.ru;
        const role = t.role[lang] || t.role.ru;
        return '<button type="button" class="tui-card' + active + '" data-id="' + id + '">' +
          '<div class="tui-face">' + face + '</div>' +
          '<div class="tui-card-info">' +
            '<b>' + name + '</b>' +
            '<span>' + role + '</span>' +
            '<small>' + '●'.repeat(t.strictness) + '○'.repeat(5 - t.strictness) + '</small>' +
          '</div>' +
        '</button>';
      }).join('') +
    '</div>';

    host.querySelector('.tui-picker').addEventListener('click', function(e) {
      const b = e.target.closest('.tui-card');
      if (!b) return;
      setSelected(b.dataset.id);
      host.querySelectorAll('.tui-card').forEach(function(x) { x.classList.remove('active'); });
      b.classList.add('active');
    });
  }

  return { renderFor, renderPicker, getSelected, setSelected, getTeacher, TEACHERS, FACES };
})();
