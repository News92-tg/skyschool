/* ============================================================
   SkyySchool — ядро
   Язык, тема, хранилище, шапка, статистика, интервальное повторение.
   Подключается на каждой странице первым (после config.js).
   ============================================================ */
'use strict';

window.Sky = (function () {

  const CFG = window.SKY_CONFIG || {};
  const NS = 'sky_';

  /* ---------- хранилище ----------
     localStorage может быть недоступен (приватный режим, запрет на
     сайт-данные). Тогда работаем в памяти: страница не падает,
     просто прогресс живёт до перезагрузки. */
  let memory = {};
  let storageOk = (() => {
    try { localStorage.setItem(NS + 't', '1'); localStorage.removeItem(NS + 't'); return true; }
    catch (e) { return false; }
  })();

  function get(key, def) {
    try {
      const raw = storageOk ? localStorage.getItem(NS + key) : memory[key];
      return raw == null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }
  function set(key, val) {
    const raw = JSON.stringify(val);
    try { if (storageOk) localStorage.setItem(NS + key, raw); else memory[key] = raw; }
    catch (e) { memory[key] = raw; }
    return val;
  }
  function del(key) {
    try { if (storageOk) localStorage.removeItem(NS + key); } catch (e) {}
    delete memory[key];
  }

  /* ---------- язык ---------- */
  const DICT = {
    /* навигация */
    navHome:{ru:'Обзор',en:'Overview'},
    navLearn:{ru:'Тренажёр',en:'Trainer'},
    navTest:{ru:'Тест',en:'Test'},
    navExam:{ru:'Пробник',en:'Mock exam'},
    navEssay:{ru:'Сочинение',en:'Essay'},
    navParent:{ru:'Родителям',en:'For parents'},
    navKids:{ru:'Детям',en:'Kids'},
    navChess:{ru:'Шахматы',en:'Chess'},
    navTeachers:{ru:'Учителя',en:'Teachers'},
    navClassroom:{ru:'Класс',en:'Homeroom'},
    navDean:{ru:'Завуч',en:'Dean'},
    navPe:{ru:'Физрук',en:'P.E.'},
    navPsy:{ru:'Психолог',en:'Psychologist'},
    navLife:{ru:'Режим дня',en:'Daily life'},
    navTrack:{ru:'Трекеры',en:'Trackers'},
    navBody:{ru:'Тело',en:'Body'},
    navPlan:{ru:'План',en:'Plan'},
    navTools:{ru:'Инструменты',en:'Tools'},
    navPhoto:{ru:'Домашка по фото',en:'Photo homework'},
    navHomework:{ru:'Задания',en:'Homework'},

    /* общее */
    save:{ru:'Сохранить',en:'Save'},
    saved:{ru:'Сохранено',en:'Saved'},
    cancel:{ru:'Отмена',en:'Cancel'},
    close:{ru:'Закрыть',en:'Close'},
    add:{ru:'Добавить',en:'Add'},
    del:{ru:'Удалить',en:'Delete'},
    edit:{ru:'Изменить',en:'Edit'},
    send:{ru:'Отправить',en:'Send'},
    back:{ru:'Назад',en:'Back'},
    next:{ru:'Дальше',en:'Next'},
    open:{ru:'Открыть',en:'Open'},
    done:{ru:'Готово',en:'Done'},
    loading:{ru:'Загружаю…',en:'Loading…'},
    today:{ru:'сегодня',en:'today'},
    right:{ru:'Верно',en:'Correct'},
    wrong:{ru:'Неверно',en:'Not quite'},
    correctIs:{ru:'Правильный ответ: ',en:'The correct answer is: '},
    easy:{ru:'Лёгкая',en:'Easy'},
    medium:{ru:'Средняя',en:'Medium'},
    hard:{ru:'Сложная',en:'Hard'},

    /* ИИ */
    aiTitle:{ru:'Разбор от ИИ',en:'AI explanation'},
    aiLoading:{ru:'ИИ разбирает задание…',en:'The AI is working through it…'},
    aiOff:{ru:'ИИ-разбор не подключён: в assets/config.js пустое поле AI_BASE. Разбор из базы заданий выше доступен всегда — без ключей и без интернета.',
           en:'The AI explanation is not connected: AI_BASE is empty in assets/config.js. The walkthrough from the task bank above always works — no keys, no internet needed.'},
    aiBadUrl:{ru:'В AI_BASE лежит не адрес, а что-то другое. Туда идёт адрес вашего Worker вида https://имя.workers.dev — ключ DeepSeek в файлы сайта класть нельзя, его увидит любой посетитель.',
               en:'AI_BASE does not contain a URL. It needs your Worker address like https://name.workers.dev — never put the DeepSeek key in site files, any visitor can read it.'},
    aiNoNet:{ru:'Не удалось связаться с сервером разбора. Проверьте, что Worker развёрнут и адрес в AI_BASE открывается в браузере.',
             en:'Could not reach the explanation server. Check that the Worker is deployed and that the AI_BASE address opens in a browser.'},
    aiHttp:{ru:'Сервер разбора ответил ошибкой %1.',en:'The explanation server returned error %1.'},
    aiKeyBad:{ru:'DeepSeek не принял ключ: он неверный или отозван. Проверьте его на platform.deepseek.com.',
              en:'DeepSeek rejected the key: it is wrong or revoked. Check it at platform.deepseek.com.'},
    aiNoMoney:{ru:'На счету DeepSeek закончились средства.',en:'The DeepSeek account is out of credit.'},
    aiTooFast:{ru:'DeepSeek ограничил частоту запросов. Попробуйте через минуту.',
               en:'DeepSeek is rate-limiting requests. Try again in a minute.'},
    aiKeyBlocked:{ru:'Запрос из браузера не прошёл. Либо нет интернета, либо DeepSeek не разрешает обращаться к себе напрямую со страницы. Во втором случае поможет только Worker — он ходит в DeepSeek со своего сервера. Как его развернуть, написано в README.',
                  en:'The request from the browser did not go through. Either there is no internet, or DeepSeek does not allow direct calls from a web page. In the second case only the Worker helps — it calls DeepSeek from its own server. The README explains how to deploy it.'},

    /* подключение своего ключа */
    aiSetup:{ru:'Подключить разбор от ИИ',en:'Connect AI explanations'},
    aiKeyTitle:{ru:'Свой ключ DeepSeek',en:'Your own DeepSeek key'},
    aiKeyWhy:{ru:'Ключ сохранится только в этом браузере: он не попадёт ни в файлы сайта, ни на GitHub, и другие посетители его не увидят. Тратиться будет ваш баланс DeepSeek.',
              en:'The key is saved in this browser only: it never reaches the site files or GitHub, and other visitors cannot see it. It spends your own DeepSeek balance.'},
    aiKeyPublic:{ru:'Если сайтом пользуетесь не только вы, ключ лучше не вводить, а развернуть Worker — тогда разбор будет работать у всех, а ключ останется на сервере. Инструкция в README.',
                 en:'If other people use this site, do not enter a key here — deploy the Worker instead: explanations will work for everyone and the key stays on the server. See the README.'},
    aiKeyPh:{ru:'sk-…',en:'sk-…'},
    aiKeySave:{ru:'Сохранить ключ',en:'Save the key'},
    aiKeyForget:{ru:'Удалить ключ из браузера',en:'Remove the key from this browser'},
    aiKeySaved:{ru:'Ключ сохранён в этом браузере',en:'Key saved in this browser'},
    aiKeyGone:{ru:'Ключ удалён',en:'Key removed'},
    aiKeyOdd:{ru:'Ключи DeepSeek начинаются с «sk-». Проверьте, что скопировали целиком.',
              en:'DeepSeek keys start with "sk-". Check that you copied the whole thing.'},
    aiOnKey:{ru:'Работает по вашему ключу',en:'Running on your key'},
    aiOnWorker:{ru:'Работает через Worker',en:'Running through the Worker'},

    /* подвал */
    footNote:{ru:'Учебная платформа',en:'A learning platform'},
    footStudio:{ru:'Студия',en:'Studio'},

    /* роли */
    student:{ru:'Ученик',en:'Student'},
    teacher:{ru:'Учитель',en:'Teacher'},
    parent:{ru:'Родитель',en:'Parent'},
    guest:{ru:'Гость',en:'Guest'},
    signIn:{ru:'Войти',en:'Sign in'},

    /* только-русские материалы */
    ruOnlyNote:{ru:'',en:'This subject follows the Russian school curriculum, so the problems stay in Russian — translating an exam about Russian spelling would defeat the point. The interface stays in English.'}
  };

  let dict = Object.assign({}, DICT);
  let lang = get('lang') || ((navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en');

  function t(key, def) {
    const e = dict[key];
    if (!e) return def !== undefined ? def : key;
    return e[lang] || e.ru || e.en || key;
  }
  /* L({ru:'…', en:'…'}) — берёт нужный язык, а если перевода нет,
     честно показывает русский вместо пустоты */
  function L(obj) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.ru || obj.en || '';
  }
  function extendDict(extra) { Object.assign(dict, extra || {}); }

  function applyI18n(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    document.documentElement.lang = lang;
  }

  function setLang(next) {
    lang = (next === 'en') ? 'en' : 'ru';
    set('lang', lang);
    Sky.lang = lang;
    applyI18n();
    renderHeader();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  /* ---------- тема ---------- */
  let theme = get('theme') ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#080f1c' : '#f6faff';
  }
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    set('theme', theme);
    applyTheme();
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }
  applyTheme();

  /* ---------- логотип: облачко с улыбкой ---------- */
  function logoSvg(cls) {
    const id = 'cg' + Math.random().toString(36).slice(2, 7);
    return `<svg class="${cls || 'logo'}" viewBox="0 0 72 52" role="img" aria-label="SkyySchool">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#2f8dfa"/>
      </linearGradient></defs>
      <g fill="url(#${id})">
        <circle cx="24" cy="27" r="13"/><circle cx="42" cy="23" r="16"/>
        <circle cx="56" cy="31" r="11"/><rect x="13" y="30" width="50" height="14" rx="7"/>
      </g>
      <g fill="#0e2540">
        <circle cx="35" cy="24" r="2.7"/><circle cx="49" cy="24" r="2.7"/>
      </g>
      <path d="M34.5 31.5 Q42 38.5 49.5 31.5" stroke="#0e2540" stroke-width="2.8"
            fill="none" stroke-linecap="round"/>
    </svg>`;
  }

  /* ---------- шапка и подвал ---------- */
  const NAV = [
    { href:'index.html',    key:'navHome' },
    { href:'trainer.html',  key:'navLearn' },
    { href:'test.html',     key:'navTest' },
    { href:'exam.html',     key:'navExam' },
    { href:'kids.html',     key:'navKids' },
    { href:'chess.html',    key:'navChess' },
    { href:'teachers.html', key:'navTeachers' },
    { href:'classroom.html',   key:'navClassroom' },
    { href:'headteacher.html', key:'navDean' },
    { href:'pe.html',          key:'navPe' },
    { href:'psychologist.html', key:'navPsy' },
    { href:'life.html',     key:'navLife' },
    { href:'trackers.html',   key:'navTrack' },
    { href:'body.html',       key:'navBody' },
    { href:'plan.html',     key:'navPlan' },
    { href:'photo.html',    key:'navPhoto' },
    { href:'essay.html',    key:'navEssay' },
    { href:'parent.html',   key:'navParent' },
    { href:'tools.html',    key:'navTools' }
  ];

  /* «Задания» показываем только тем, кто вошёл: гостю этот раздел
     нечего показать, а меню и без того длинное. */
  function navItems() {
    const signedIn = !!(window.Sky && Sky.db && Sky.db.me && Sky.db.me());
    if (!signedIn) return NAV;
    /* вставляем «Задания» сразу после «Учителей» — ищем позицию по
       ключу, а не по номеру: так пункты меню можно свободно
       добавлять и переставлять, не боясь сломать вставку. */
    const idx = NAV.findIndex(n => n.key === 'navTeachers') + 1;
    return NAV.slice(0, idx).concat([{ href:'homework.html', key:'navHomework' }], NAV.slice(idx));
  }

  function renderHeader() {
    const host = document.getElementById('appHeader');
    if (!host) return;
    const here = (location.pathname.split('/').pop() || 'index.html');
    host.className = 'appbar';
    host.innerHTML =
      '<div class="inner">' +
        '<a class="brand" href="index.html">' + logoSvg('logo') +
          '<span>Skyy<b>School</b></span></a>' +
        '<nav class="appnav">' +
          navItems().map(n => `<a href="${n.href}"${n.href === here ? ' aria-current="page"' : ''}>${t(n.key)}</a>`).join('') +
        '</nav>' +
        '<div class="tools">' +
          '<div class="seg" id="langSeg">' +
            `<button type="button" data-lang="ru" aria-pressed="${lang === 'ru'}">RU</button>` +
            `<button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button>` +
          '</div>' +
          '<button class="icon-btn" id="themeBtn" title="' +
            (lang === 'ru' ? 'Светлая или тёмная тема' : 'Light or dark theme') + '">◐</button>' +
          '<span id="accountSlot"></span>' +
        '</div>' +
      '</div>';

    host.querySelector('#langSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-lang]');
      if (b) setLang(b.dataset.lang);
    });
    host.querySelector('#themeBtn').addEventListener('click', toggleTheme);
    document.dispatchEvent(new CustomEvent('headerready'));
  }

  function renderFooter() {
    const host = document.getElementById('appFooter');
    if (!host) return;
    host.className = 'appfoot';
    host.innerHTML =
      '<div class="inner">' +
        '<span>' + (CFG.BRAND || 'SkyySchool') + ' — ' + t('footNote') + '</span>' +
        (CFG.STUDIO_URL ? `<a href="${CFG.STUDIO_URL}">${t('footStudio')} →</a>` : '') +
        (CFG.CONTACT ? `<a href="${CFG.CONTACT}">Telegram</a>` : '') +
      '</div>';
  }

  /* ---------- всплывающее сообщение ---------- */
  let toastEl = null, toastTimer = null;
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 3200);
  }

  /* ---------- модальное окно ---------- */
  function modal(html, onReady) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal"></div>';
    bg.firstChild.innerHTML = html;
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';

    const close = () => {
      bg.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', esc);
    };
    const esc = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    bg.addEventListener('click', e => { if (e.target === bg) close(); });

    if (onReady) onReady(bg.firstChild, close);
    return close;
  }

  /* ---------- мелкие помощники ---------- */
  const pct = (part, total) => total ? Math.round(part / total * 100) : 0;

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return n + ' ' + many;
    if (b > 1 && b < 5) return n + ' ' + few;
    if (b === 1) return n + ' ' + one;
    return n + ' ' + many;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function dayKey(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  function daysLeft(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr + 'T00:00:00');
    if (isNaN(target)) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 864e5);
  }

  /* цвет аватара стабилен: одно имя — всегда один цвет */
  function avaClass(name) {
    let h = 0;
    for (const ch of String(name || '?')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return 'c' + (h % 8);
  }
  function initials(name) {
    const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
    return parts.map(p => (p[0] || '').toUpperCase()).join('') || '?';
  }
  function avatar(name, size, emoji) {
    const cls = 'ava ' + avaClass(name) + (size ? ' ' + size : '');
    return `<span class="${cls}">${emoji || initials(name)}</span>`;
  }

  /* ---------- статистика ---------- */
  function stats() {
    return get('stats', { solved:0, right:0, streak:0, best:0, byDay:{}, bySubject:{} });
  }
  function bumpStats(subject, correct) {
    const s = stats();
    s.solved++;
    if (correct) { s.right++; s.streak++; if (s.streak > s.best) s.best = s.streak; }
    else s.streak = 0;

    const k = dayKey();
    s.byDay[k] = s.byDay[k] || { n:0, right:0 };
    s.byDay[k].n++; if (correct) s.byDay[k].right++;

    s.bySubject[subject] = s.bySubject[subject] || { n:0, right:0 };
    s.bySubject[subject].n++; if (correct) s.bySubject[subject].right++;

    set('stats', s);
    document.dispatchEvent(new CustomEvent('statschange'));
    return s;
  }
  const todayCount = () => (stats().byDay[dayKey()] || {}).n || 0;

  /* ---------- интервальное повторение (метод Лейтнера) ----------
     Коробки 0…5. Верный ответ поднимает на ступень, ошибка роняет в 0.
     Интервалы подобраны так, чтобы задание возвращалось незадолго до
     того, как оно обычно забывается. */
  const INTERVALS = [1, 1, 3, 7, 16, 35];

  const srs = () => get('srs', {});
  function boxOf(subject, id) {
    const r = srs()[subject + ':' + id];
    return r ? r.box : -1;
  }
  function record(subject, taskId, correct) {
    const all = srs(), key = subject + ':' + taskId;
    const rec = all[key] || { box:0, due:0, last:0, fails:0 };
    if (correct) rec.box = Math.min(5, rec.box + 1);
    else { rec.box = 0; rec.fails++; }
    rec.last = Date.now();
    rec.due = Date.now() + INTERVALS[rec.box] * 864e5;
    all[key] = rec;
    set('srs', all);
    bumpStats(subject, correct);
    return rec;
  }
  function dueIds(subject, ids) {
    const all = srs(), now = Date.now();
    return ids.filter(id => {
      const r = all[subject + ':' + id];
      return !r || r.due <= now;
    });
  }
  function weakIds(subject, ids) {
    const all = srs();
    return ids.filter(id => {
      const r = all[subject + ':' + id];
      return r && r.fails > 0;
    });
  }

  /* ---------- разбор от ИИ ----------

     Два способа подключить, и они решают разные задачи.

     1. Свой ключ (aiKey). Ключ лежит в localStorage ЭТОГО браузера и
        никуда больше не попадает — ни в файлы сайта, ни в репозиторий.
        Запрос уходит из браузера прямо в DeepSeek. Подходит, когда вы
        пользуетесь платформой сами: ключ ваш, тратите вы.

     2. Worker (AI_BASE). Ключ живёт на сервере, посетителям он не
        виден. Единственный правильный вариант для публичного сайта:
        иначе либо каждый вводит свой ключ, либо ключ утекает.

     Чего делать НЕЛЬЗЯ: писать ключ в config.js. GitHub Pages отдаёт
     файлы как есть, и ключ увидит любой, кто откроет исходник.

     Ошибки различаем по типу — пользователю нужно знать, что чинить. */

  const AI_KEY_STORE = 'aiKey';
  const aiKey = () => (get(AI_KEY_STORE, '') || '').trim();
  const setAiKey = v => { const k = (v || '').trim(); if (k) set(AI_KEY_STORE, k); else del(AI_KEY_STORE); };
  const aiMode = () => aiKey() ? 'key' : ((CFG.AI_BASE || '').trim() ? 'worker' : 'off');

  function aiPrompt(payload) {
    /* Если выбран AI-учитель, объясняет он — в этом весь смысл выбора.
       Промпт берётся из data/ai-teachers.js и уже содержит указание
       про строгость. Учителя может не быть: страница, которая не
       подключила ai-teachers.js, работает по общему промпту ниже. */
    const teacherSystem = (window.SkyTeachers && window.SkyTeachers.systemPrompt)
      ? window.SkyTeachers.systemPrompt(null, lang)
      : '';

    const system = teacherSystem || (lang === 'ru'
      ? 'Ты помогаешь школьнику разобраться в задании. Объясняй по шагам, простым языком. Если ученик ошибся — сначала скажи, почему его вариант выглядел правдоподобно, потом покажи верный ход мысли. Не выдумывай фактов. Уложись в 200 слов, пиши связным текстом без списков и заголовков.'
      : 'You help a school student understand a problem. Explain step by step in plain language. If the student got it wrong, first say why their answer looked plausible, then show the correct reasoning. Do not invent facts. Keep it under 200 words, flowing prose, no lists or headings.');
    const user = (lang === 'ru'
      ? `Предмет: ${payload.subject || '—'}\nЗадание: ${payload.task}\n` +
        (payload.options ? `Варианты: ${payload.options.join(' | ')}\n` : '') +
        `Ученик ответил: ${payload.userAnswer || '—'}\nПравильный ответ: ${payload.correctAnswer || '—'}\n\nОбъясни, почему правильный ответ именно такой.`
      : `Subject: ${payload.subject || '—'}\nProblem: ${payload.task}\n` +
        (payload.options ? `Options: ${payload.options.join(' | ')}\n` : '') +
        `The student answered: ${payload.userAnswer || '—'}\nCorrect answer: ${payload.correctAnswer || '—'}\n\nExplain why the correct answer is what it is.`);
    return { system, user };
  }

  async function explainWithKey(payload) {
    const { system, user } = aiPrompt(payload);
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiKey() },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role:'system', content: system }, { role:'user', content: user }],
          temperature: 0.3, max_tokens: 500
        })
      });
      if (r.status === 401) return { error: t('aiKeyBad') };
      if (r.status === 402) return { error: t('aiNoMoney') };
      if (r.status === 429) return { error: t('aiTooFast') };
      if (!r.ok) return { error: t('aiHttp').replace('%1', r.status) };
      const data = await r.json();
      const text = data && data.choices && data.choices[0] && data.choices[0].message.content;
      return text ? { text: text.trim() } : { error: t('aiNoNet') };
    } catch (e) {
      /* Браузер не различает «сети нет» и «CORS запретил», поэтому
         честно называем обе причины вместо догадки. */
      return { error: t('aiKeyBlocked') };
    }
  }

  async function explainWithWorker(payload) {
    const base = (CFG.AI_BASE || '').trim();
    if (!/^https?:\/\//i.test(base)) return { error: t('aiBadUrl') };
    try {
      /* На сервер уходит ИДЕНТИФИКАТОР учителя, а не текст его промпта.
         Разница принципиальная: приняв произвольный системный промпт
         от клиента, Worker превратился бы в бесплатный доступ к вашему
         ключу DeepSeek для любых задач — от чужих курсовых до обхода
         ограничений модели. Список промптов держит сам Worker. */
      const teacherId = (window.SkyTeachers && window.SkyTeachers.selectedId)
        ? window.SkyTeachers.selectedId() : null;

      const r = await fetch(base.replace(/\/+$/, '') + '/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ lang, teacher: teacherId }, payload))
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) return { error: (data && data.error) || t('aiHttp').replace('%1', r.status) };
      if (data && data.explanation) return { text: data.explanation };
      return { error: (data && data.error) ? String(data.error) : t('aiNoNet') };
    } catch (e) {
      return { error: t('aiNoNet') };
    }
  }

  async function explain(payload) {
    const mode = aiMode();
    if (mode === 'key') return explainWithKey(payload);
    if (mode === 'worker') return explainWithWorker(payload);
    return { error: t('aiOff') };
  }

  /* ---------- проверка сочинений ----------
     Тот же дуальный режим, что и у explain(): свой ключ DeepSeek — идёт
     прямо из браузера, Worker — идёт через /grade-essay. В отличие от
     проверки фото (там без Worker никак: рукопись читает Gemini,
     а её ключ в браузере не спрячешь), для текста своего ключа
     достаточно — фото не требуется. */
  function essayPrompt(payload) {
    const subjName = payload.subject === 'english'
      ? (lang === 'ru' ? 'английскому языку' : 'English')
      : (lang === 'ru' ? 'русскому языку' : 'Russian');
    const system = lang === 'ru'
      ? `Ты проверяешь сочинение школьника по предмету «${subjName}» в формате, близком к ЕГЭ.\n` +
        'ВАЖНО: ты не выставляешь официальные баллы по критериям К1–К12 ФИПИ — у тебя нет доступа к их точной методике. ' +
        'Вместо этого оцени пять сторон работы по шкале 1–5 и дай развёрнутый словесный разбор. Не выдумывай фактов. ' +
        'Верни СТРОГО JSON без markdown и без пояснений вокруг.'
      : `You are marking a student's essay for "${subjName}", in a format close to the Russian state exam (ЕГЭ).\n` +
        'IMPORTANT: you do not assign official scores against the FIPI К1–К12 criteria — you do not have that exact methodology. ' +
        'Instead rate five aspects of the work on a 1–5 scale and give a detailed written review. Do not invent facts. ' +
        'Return STRICT JSON, no markdown, no commentary around it.';
    const shape = '{"scores":{"relevance":1-5,"structure":1-5,"argumentation":1-5,"language":1-5,"overall_impression":1-5},' +
      '"strengths":["..."],"issues":[{"quote":"...","problem":"...","fix":"..."}],"overall_feedback":"...","next_step":"..."}';
    const user = lang === 'ru'
      ? (payload.prompt ? `Тема/задание сочинения:\n"""\n${payload.prompt}\n"""\n\n` : '') +
        `Текст сочинения:\n"""\n${payload.essay}\n"""\n\nОцени работу. Формат ответа: ${shape}`
      : (payload.prompt ? `The essay prompt:\n"""\n${payload.prompt}\n"""\n\n` : '') +
        `Essay text:\n"""\n${payload.essay}\n"""\n\nReview the work. Reply shape: ${shape}`;
    return { system, user };
  }

  function parseJsonLoose(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function shapeEssayResult(parsed) {
    const clamp = v => Math.min(5, Math.max(1, Number(v) || 3));
    const s = (parsed && parsed.scores) || {};
    return {
      scores: {
        relevance: clamp(s.relevance), structure: clamp(s.structure), argumentation: clamp(s.argumentation),
        language: clamp(s.language), overall_impression: clamp(s.overall_impression)
      },
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 8) : [],
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 15) : [],
      overall_feedback: String(parsed.overall_feedback || ''),
      next_step: String(parsed.next_step || '')
    };
  }

  async function gradeEssayWithKey(payload) {
    const { system, user } = essayPrompt(payload);
    try {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + aiKey() },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role:'system', content: system }, { role:'user', content: user }],
          temperature: 0.3, max_tokens: 900,
          response_format: { type: 'json_object' }
        })
      });
      if (r.status === 401) return { error: t('aiKeyBad') };
      if (r.status === 402) return { error: t('aiNoMoney') };
      if (r.status === 429) return { error: t('aiTooFast') };
      if (!r.ok) return { error: t('aiHttp').replace('%1', r.status) };
      const data = await r.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message.content;
      const parsed = content && parseJsonLoose(content);
      return parsed ? { result: shapeEssayResult(parsed) } : { error: t('aiNoNet') };
    } catch (e) {
      return { error: t('aiKeyBlocked') };
    }
  }

  async function gradeEssayWithWorker(payload) {
    const base = (CFG.AI_BASE || '').trim();
    if (!/^https?:\/\//i.test(base)) return { error: t('aiBadUrl') };
    try {
      const teacherId = (window.SkyTeachers && window.SkyTeachers.selectedId) ? window.SkyTeachers.selectedId() : null;
      const r = await fetch(base.replace(/\/+$/, '') + '/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ lang, teacher: teacherId }, payload))
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) return { error: (data && data.error) || t('aiHttp').replace('%1', r.status) };
      if (data && data.scores) return { result: data };
      return { error: (data && data.error) ? String(data.error) : t('aiNoNet') };
    } catch (e) {
      return { error: t('aiNoNet') };
    }
  }

  async function gradeEssay(payload) {
    const mode = aiMode();
    if (mode === 'key') return gradeEssayWithKey(payload);
    if (mode === 'worker') return gradeEssayWithWorker(payload);
    return { error: t('aiOff') };
  }

  /* ---------- уведомления ---------- */
  async function askNotify() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try { return await Notification.requestPermission(); }
    catch (e) { return 'denied'; }
  }
  function notify(title, body) {
    try { if (Notification.permission === 'granted') new Notification(title, { body }); }
    catch (e) {}
  }

  /* ---------- запуск ---------- */
  /* ---------- офлайн-режим ---------- */
  function registerOffline() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return; // file:// — нечего регистрировать
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* sw.js не найден рядом (например, это отдельно скачанный single.html) — не страшно, просто без офлайн-кэша */
    });
  }

  function init(extra) {
    extendDict(extra);
    renderHeader();
    renderFooter();
    applyI18n();
    registerOffline();
    document.addEventListener('langchange', () => { applyI18n(); renderFooter(); });
  }

  return {
    cfg: CFG, get, set, del, storageOk,
    get lang() { return lang; }, set lang(v) { lang = v; },
    t, L, setLang, extendDict, applyI18n, init,
    theme: () => theme, toggleTheme,
    logoSvg, renderHeader, renderFooter,
    toast, modal,
    pct, plural, shuffle, dayKey, daysLeft, avatar, avaClass, initials,
    stats, bumpStats, todayCount,
    srs, record, dueIds, weakIds, boxOf, INTERVALS,
    explain, gradeEssay, aiKey, setAiKey, aiMode, askNotify, notify,
    resetProgress() { ['stats','srs','puzzlesSolved','kids','life'].forEach(del); document.dispatchEvent(new CustomEvent('statschange')); }
  };
})();
 
