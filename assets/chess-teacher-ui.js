/* ============================================================
   SkyySchool — шахматные AI-учителя
   Выбранный тренер реально влияет на реплики разбора,
   отображается рядом с доской и переключается без перезагрузки.
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

  /* ---------- Профили тренеров ---------- */
  const TEACHERS = {
    'coach-fire': {
      name: { ru: 'Атакующий Огонь', en: 'Coach Fire' },
      role: { ru: 'Атака и инициатива', en: 'Attack & initiative' },
      strictness: 3,
      style: { ru: 'Энергично давит на инициативу и темп.', en: 'Pushes initiative and tempo hard.' },
      phrases: {
        brilliant: 'Вот это по-нашему! Смело. Ты забрал инициативу и не дал сопернику передышки.',
        good: 'Ход рабочий. Но ты отдал темп — ищи способ создавать угрозу сразу.',
        inaccuracy: 'Слишком тихо. У тебя была инициатива — зачем ты её отпустил?',
        mistake: 'Потерял темп. После такой ошибки атака захлебнётся, если не создать новую угрозу.',
        blunder: 'Катастрофа. Инициатива ушла сопернику. Теперь тебе приходится оправдываться, а не атаковать.'
      }
    },
    'coach-calm': {
      name: { ru: 'Спокойный Стратег', en: 'Calm Strategist' },
      role: { ru: 'Позиция и структура', en: 'Position & structure' },
      strictness: 3,
      style: { ru: 'Спокойно разбирает позицию и строит план.', en: 'Calmly reads the position and builds a plan.' },
      phrases: {
        brilliant: 'Прекрасный позиционный ход. Ты улучшил фигуры и сохранил структуру.',
        good: 'Хорошо. Без суеты: фигуры стоят лучше, а слабостей ты не создал.',
        inaccuracy: 'Не спеши. Сначала посмотри на пешечную структуру и слабые поля.',
        mistake: 'Ты ослабил позицию. Это не видно сразу, но в эндшпиле за это придётся платить.',
        blunder: 'Слишком много слабостей одновременно. Вернись к плану и оцени позицию заново.'
      }
    },
    'coach-prof': {
      name: { ru: 'Профессор Расчёт', en: 'Professor Calculation' },
      role: { ru: 'Точный счёт вариантов', en: 'Exact calculation' },
      strictness: 5,
      style: { ru: 'Сухо, точно, требует считать варианты до конца.', en: 'Precise, demanding, calculates every line.' },
      phrases: {
        brilliant: 'Идеальный расчёт. Проверен ответ соперника и следующий ресурс. Так и надо.',
        good: 'Верно, но недостаточно. Проверь все forcing-ходы соперника после своей комбинации.',
        inaccuracy: 'Не все линии просчитаны. Остановись и посчитай кандидатов до конца.',
        mistake: 'Ты пропустил конкретный ответ соперника. В расчёте нельзя оставлять такие дыры.',
        blunder: 'Ошибка в расчёте. Найди первый ход, где твой вариант перестал работать.'
      }
    },
    'coach-friend': {
      name: { ru: 'Добрый Тренер', en: 'Friendly Coach' },
      role: { ru: 'Поддержка и разбор', en: 'Support & review' },
      strictness: 2,
      style: { ru: 'Поддерживает, но всегда показывает одну точку роста.', en: 'Encouraging, with one clear improvement point.' },
      phrases: {
        brilliant: 'Молодец! Очень сильное решение. Запомни, почему оно сработало.',
        good: 'Отличный ход. Продолжай в том же духе — уже видно правильную идею.',
        inaccuracy: 'Ничего страшного. Идея была рядом — давай найдём ход точнее.',
        mistake: 'Не переживай. Ошибка полезна: теперь мы знаем, что нужно проверить в следующий раз.',
        blunder: 'Ой, здесь мы поторопились. Спокойно разберём момент и попробуем ещё раз.'
      }
    },
    'coach-strict': {
      name: { ru: 'Строгий Гроссмейстер', en: 'Strict Grandmaster' },
      role: { ru: 'Экзаменационная строгость', en: 'Exam-level strictness' },
      strictness: 5,
      style: { ru: 'Без скидок оценивает точность, дисциплину и результат.', en: 'No excuses: precision, discipline, result.' },
      phrases: {
        brilliant: 'Достойно. Это точный ход и именно тот уровень, который я ожидаю.',
        good: 'Допустимо. Но на серьёзной партии этого недостаточно — ищи лучшее продолжение.',
        inaccuracy: 'Неточность. На экзамене и в турнире за такие ходы платят очками.',
        mistake: 'Ошибка. Ты обязан был проверить продолжение соперника перед ходом.',
        blunder: 'Провал. Разбери эту позицию и назови конкретную причину ошибки.'
      }
    },
    'coach-romantic': {
      name: { ru: 'Романтик Атаки', en: 'Romantic Attacker' },
      role: { ru: 'Жертвы и комбинации', en: 'Sacrifices & combos' },
      strictness: 3,
      style: { ru: 'Ищет тактику, жертвы и красивую атаку.', en: 'Looks for tactics, sacrifices and attacks.' },
      phrases: {
        brilliant: 'Блестяще! Вот ради таких жертв и играют в шахматы — комбинация работает!',
        good: 'Хорошо. Но позиция просила большего риска и активного продолжения.',
        inaccuracy: 'Слишком солидно. Посмотри на жертвы, шахи и вскрытие линий.',
        mistake: 'Ты отказался от тактической возможности и упустил момент для атаки.',
        blunder: 'Комбинация не сложилась. Красиво — не значит правильно: сначала счёт, потом жертва.'
      }
    }
  };

  /* ---------- Состояние ---------- */
  function getSelected() {
    const id = localStorage.getItem(STORE);
    return TEACHERS[id] ? id : DEFAULT;
  }

  function getTeacher() {
    return TEACHERS[getSelected()];
  }

  function strictnessStars(value) {
    return '★'.repeat(value) + '☆'.repeat(5 - value);
  }

  function escapeHTML(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function currentLocalized(t, key, lang) {
    if (!t || !t[key]) return '';
    return t[key][lang] || t[key].ru || '';
  }

  /* ---------- CSS доп. элементов тренера ---------- */
  function ensureStyles() {
    if (document.getElementById('chess-teacher-ui-extra')) return;
    const style = document.createElement('style');
    style.id = 'chess-teacher-ui-extra';
    style.textContent = `
      .tui-card { position:relative; }
      .tui-card[aria-pressed="true"] { border-color:var(--m-chess); background:var(--m-chess-soft); box-shadow:0 4px 14px rgba(139,92,246,.12); }
      .tui-card[aria-pressed="true"]::after {
        content:'✓'; position:absolute; top:7px; right:8px; width:18px; height:18px;
        display:grid; place-items:center; border-radius:50%; background:var(--m-chess); color:#fff;
        font-size:11px; font-weight:900;
      }
      .tui-current {
        display:flex; align-items:center; gap:12px; padding:10px 12px; margin-bottom:12px;
        border:1px solid color-mix(in srgb,var(--m-chess) 24%,var(--line));
        background:var(--m-chess-soft); border-radius:var(--r);
        box-shadow:var(--shadow-sm);
      }
      .tui-current .tui-face { width:44px; height:44px; flex:0 0 44px; }
      .tui-current-copy { min-width:0; flex:1; }
      .tui-current-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .tui-current-name { font-size:13px; font-weight:900; line-height:1.2; }
      .tui-current-role { font-size:10px; color:var(--muted); }
      .tui-current-style { margin-top:3px; font-size:10.5px; line-height:1.35; color:var(--ink-2); }
      .tui-current-stars { margin-top:3px; font-size:10px; letter-spacing:1px; color:var(--warn); line-height:1; }
      .tui-current-badge {
        flex:0 0 auto; padding:4px 7px; border-radius:999px; background:var(--panel);
        border:1px solid var(--line); color:var(--m-chess); font-size:9px; font-weight:900; text-transform:uppercase; letter-spacing:.06em;
      }
      .tui-inline[data-teacher] .tui-face { flex:0 0 44px; width:44px; height:44px; }
      .tui-inline .tui-style-note { margin-top:5px; font-size:10.5px; color:var(--muted); line-height:1.35; }
      @media (max-width:600px) {
        .tui-current { gap:9px; padding:9px 10px; }
        .tui-current .tui-face { width:40px; height:40px; flex-basis:40px; }
        .tui-current-badge { display:none; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------- Текущий тренер рядом с доской ---------- */
  function renderCurrent() {
    const id = getSelected();
    const t = TEACHERS[id];
    const lang = (window.Sky && Sky.lang) || 'ru';
    if (!t) return '';

    return '<div class="tui-current" data-teacher="' + escapeHTML(id) + '" aria-live="polite">' +
      '<div class="tui-face">' + (FACES[id] || FACES[DEFAULT]) + '</div>' +
      '<div class="tui-current-copy">' +
        '<div class="tui-current-head">' +
          '<span class="tui-current-name">' + escapeHTML(currentLocalized(t, 'name', lang)) + '</span>' +
          '<span class="tui-current-role">' + escapeHTML(currentLocalized(t, 'role', lang)) + '</span>' +
        '</div>' +
        '<div class="tui-current-style">' + escapeHTML(currentLocalized(t, 'style', lang)) + '</div>' +
        '<div class="tui-current-stars">' + strictnessStars(t.strictness) + '</div>' +
      '</div>' +
      '<span class="tui-current-badge">Тренер</span>' +
    '</div>';
  }

  function refreshCurrentTeachers() {
    ensureStyles();
    document.querySelectorAll('.tui-current').forEach(function(node) {
      node.outerHTML = renderCurrent();
    });

    [
      '#tab-game .side',
      '#tab-puzzles .side'
    ].forEach(function(sideSelector) {
      const side = document.querySelector(sideSelector);
      if (!side) return;
      if (!side.querySelector('.tui-current')) {
        const holder = document.createElement('div');
        holder.innerHTML = renderCurrent();
        const node = holder.firstElementChild;
        const first = side.firstElementChild;
        if (first) side.insertBefore(node, first);
        else side.appendChild(node);
      }
    });
  }

  /* ---------- HTML комментария учителя ---------- */
  function renderFor(quality) {
    const id = getSelected();
    const t = TEACHERS[id];
    if (!t) return '';

    const face = FACES[id] || FACES[DEFAULT];
    const line = t.phrases[quality] || t.phrases.good;
    const lang = (window.Sky && Sky.lang) || 'ru';
    const name = currentLocalized(t, 'name', lang);
    const role = currentLocalized(t, 'role', lang);
    const style = currentLocalized(t, 'style', lang);

    const colorByQuality = {
      brilliant: '#8b5cf6',
      good: '#16a34a',
      inaccuracy: '#d97706',
      mistake: '#e07a3f',
      blunder: '#e11d48'
    }[quality] || '#666';

    return '<div class="tui-inline" data-quality="' + escapeHTML(quality) + '" data-teacher="' + escapeHTML(id) + '">' +
      '<div class="tui-face">' + face + '</div>' +
      '<div class="tui-text">' +
        '<div class="tui-name">' + escapeHTML(name) +
          '<span class="tui-role" style="color:' + colorByQuality + '">' + escapeHTML(role) + '</span>' +
        '</div>' +
        '<div class="tui-line">' + escapeHTML(line) + '</div>' +
        '<div class="tui-style-note">Манера: ' + escapeHTML(style) + '</div>' +
      '</div>' +
    '</div>';
  }

  function refreshInlineReviews() {
    document.querySelectorAll('.tui-inline[data-quality]').forEach(function(node) {
      const quality = node.getAttribute('data-quality');
      node.outerHTML = renderFor(quality);
    });
  }

  /* ---------- Выбор учителя ---------- */
  function setSelected(id) {
    if (!TEACHERS[id]) return false;
    const oldId = getSelected();
    localStorage.setItem(STORE, id);

    document.documentElement.dataset.chessTeacher = id;
    window.dispatchEvent(new CustomEvent('chessTeacherChanged', {
      detail: { id: id, teacher: TEACHERS[id], previousId: oldId }
    }));

    refreshCurrentTeachers();
    refreshInlineReviews();
    return true;
  }

  function updatePickerState(host) {
    const selected = getSelected();
    host.querySelectorAll('.tui-card').forEach(function(card) {
      const active = card.dataset.id === selected;
      card.classList.toggle('active', active);
      card.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function renderPicker(hostSel) {
    ensureStyles();
    const host = typeof hostSel === 'string' ? document.querySelector(hostSel) : hostSel;
    if (!host) return;

    const lang = (window.Sky && Sky.lang) || 'ru';
    const selected = getSelected();

    host.innerHTML = '<div class="tui-picker" role="group" aria-label="Выбор шахматного тренера">' +
      Object.keys(TEACHERS).map(function(id) {
        const t = TEACHERS[id];
        const face = FACES[id];
        const active = id === selected;
        const name = currentLocalized(t, 'name', lang);
        const role = currentLocalized(t, 'role', lang);
        const style = currentLocalized(t, 'style', lang);
        return '<button type="button" class="tui-card' + (active ? ' active' : '') + '" data-id="' + escapeHTML(id) + '" aria-pressed="' + (active ? 'true' : 'false') + '" title="' + escapeHTML(style) + '">' +
          '<div class="tui-face">' + face + '</div>' +
          '<div class="tui-card-info">' +
            '<b>' + escapeHTML(name) + '</b>' +
            '<span>' + escapeHTML(role) + '</span>' +
            '<small>' + strictnessStars(t.strictness) + '</small>' +
          '</div>' +
        '</button>';
      }).join('') +
    '</div>';

    const picker = host.querySelector('.tui-picker');
    if (!picker) return;

    picker.addEventListener('click', function(e) {
      const card = e.target.closest('.tui-card');
      if (!card || !picker.contains(card)) return;
      const id = card.dataset.id;
      if (!setSelected(id)) return;
      updatePickerState(host);
    });

    picker.addEventListener('keydown', function(e) {
      const cards = Array.from(picker.querySelectorAll('.tui-card'));
      const currentIndex = cards.indexOf(document.activeElement);
      if (currentIndex < 0) return;

      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight') nextIndex = Math.min(cards.length - 1, currentIndex + 1);
      else if (e.key === 'ArrowLeft') nextIndex = Math.max(0, currentIndex - 1);
      else if (e.key === 'ArrowDown') nextIndex = Math.min(cards.length - 1, currentIndex + 3);
      else if (e.key === 'ArrowUp') nextIndex = Math.max(0, currentIndex - 3);
      else return;

      e.preventDefault();
      cards[nextIndex].focus();
    });

    document.documentElement.dataset.chessTeacher = selected;
    refreshCurrentTeachers();
  }

  /* обновляем текущего тренера после смены языка, если Sky на странице перерисует UI */
  window.addEventListener('chessTeacherChanged', function() {
    document.documentElement.dataset.chessTeacher = getSelected();
  });

  return {
    renderFor,
    renderCurrent,
    renderPicker,
    refreshCurrentTeachers,
    getSelected,
    setSelected,
    getTeacher,
    TEACHERS,
    FACES
  };
})();
