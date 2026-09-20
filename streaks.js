/* ============================================================
   SkyySchool — ежедневный стрик и заморозки
 
   Отдельно от Sky.stats().streak: тот считает подряд идущие ВЕРНЫЕ
   ОТВЕТЫ (обнуляется одной ошибкой) — это разные вещи. Здесь — стрик
   ПОСЕЩЕНИЙ (дней с любой активностью подряд), как в Duolingo.
 
   Данные не дублируются: активность за день уже пишется в
   Sky.stats().byDay при каждом Sky.bumpStats(). Этот файл только
   читает byDay и считает по нему длину серии — ничего своего не
   пишет, кроме счётчика заморозок и даты последнего напоминания.
 
   Подключать после assets/core.js на любой странице, где нужен значок
   в шапке (сейчас — везде, через common-подключение в конце файла).
   ============================================================ */
'use strict';
 
(function () {
  if (!window.Sky) return;
 
  const FREEZE_KEY = 'streakFreezes';
  const FROZEN_KEY = 'streakFrozenDays';   // дни, «закрытые» заморозкой — не в счёт активности, но и не разрыв
  const LAST_AWARD_KEY = 'streakLastFreezeAward'; // на какой длине серии последний раз выдали заморозку
  const REMIND_KEY = 'streakLastRemind';
  const MAX_FREEZES = 2;
  const AWARD_EVERY = 7; // одна заморозка за каждые 7 дней серии подряд
 
  function dayBefore(key, n) {
    const d = new Date(key + 'T00:00:00');
    d.setDate(d.getDate() - n);
    return Sky.dayKey(d.getTime());
  }
 
  function hadActivity(byDay, key) {
    return !!(byDay[key] && byDay[key].n > 0);
  }
 
  /* Длина текущей серии. Сегодняшний день не обязан быть уже отмечен —
     иначе серия «сгорала» бы каждое утро ещё до того, как ученик успел
     что-то решить. Серия жива, если вчера (или сегодня) была
     активность, а дни без неё либо сегодняшний, либо закрыты
     заморозкой. */
  function computeStreak() {
    const byDay = Sky.stats().byDay || {};
    const frozen = new Set(Sky.get(FROZEN_KEY, []));
    const today = Sky.dayKey();
 
    let n = 0;
    let cursor = hadActivity(byDay, today) ? 0 : 1; // если сегодня ещё не решали — начинаем считать со вчера
    // если и вчера пусто, и сегодня пусто — серии нет (кроме случая, когда только что стартанули: n=0 это ок)
    for (;;) {
      const key = dayBefore(today, cursor);
      if (hadActivity(byDay, key) || frozen.has(key)) {
        n++;
        cursor++;
      } else break;
    }
    return n;
  }
 
  /* Проверяем «дыры» за последние несколько дней и закрываем их
     заморозкой, если она есть. Вызывается один раз при загрузке
     страницы — не мгновенно (замёрзший день не обязателен, пока не
     подтверждён следующим днём активности), а чтобы серия не
     обнулилась молча, стоит проверять при каждом визите. */
  function autoFreeze() {
    const byDay = Sky.stats().byDay || {};
    const frozen = new Set(Sky.get(FROZEN_KEY, []));
    let freezes = Sky.get(FREEZE_KEY, 0);
    const today = Sky.dayKey();
 
    // смотрим вчерашний день: если он пуст, не заморожен, а позавчера
    // была активность (то есть серия реально прерывается) — тратим заморозку
    const yesterday = dayBefore(today, 1);
    const dayBeforeYesterday = dayBefore(today, 2);
    const yesterdayEmpty = !hadActivity(byDay, yesterday) && !frozen.has(yesterday);
    const chainBeforeAlive = hadActivity(byDay, dayBeforeYesterday) || frozen.has(dayBeforeYesterday);
    const hasHistoryAtAll = Object.keys(byDay).some(k => byDay[k].n > 0);
 
    if (yesterdayEmpty && chainBeforeAlive && hasHistoryAtAll && freezes > 0) {
      frozen.add(yesterday);
      freezes--;
      Sky.set(FROZEN_KEY, Array.from(frozen));
      Sky.set(FREEZE_KEY, freezes);
      Sky.toast('🧊 ' + Sky.t('streakFrozeUsed'));
    }
 
    // подчищаем старые записи о заморозках (не нужны дальше 40 дней назад)
    if (frozen.size > 40) {
      const cutoff = dayBefore(today, 40);
      const kept = Array.from(frozen).filter(k => k >= cutoff);
      Sky.set(FROZEN_KEY, kept);
    }
  }
 
  function maybeAwardFreeze(streak) {
    const freezes = Sky.get(FREEZE_KEY, 0);
    const lastAward = Sky.get(LAST_AWARD_KEY, 0);
    if (freezes >= MAX_FREEZES) return;
    if (streak > 0 && streak % AWARD_EVERY === 0 && streak > lastAward) {
      Sky.set(FREEZE_KEY, Math.min(MAX_FREEZES, freezes + 1));
      Sky.set(LAST_AWARD_KEY, streak);
      Sky.toast('🧊 ' + Sky.t('streakFreezeEarned'));
    }
  }
 
  function bestStreak() {
    const byDay = Sky.stats().byDay || {};
    const frozen = new Set(Sky.get(FROZEN_KEY, []));
    const days = Object.keys(byDay).filter(k => byDay[k].n > 0).concat(Array.from(frozen));
    if (!days.length) return 0;
    const uniq = Array.from(new Set(days)).sort();
    let best = 1, cur = 1;
    for (let i = 1; i < uniq.length; i++) {
      const prev = new Date(uniq[i - 1] + 'T00:00:00');
      const now = new Date(uniq[i] + 'T00:00:00');
      const diff = Math.round((now - prev) / 864e5);
      cur = diff === 1 ? cur + 1 : 1;
      if (cur > best) best = cur;
    }
    return best;
  }
 
  /* ---------- значок в шапке ---------- */
  function renderBadge() {
    const slot = document.getElementById('accountSlot');
    if (!slot) return;
    let el = document.getElementById('streakBadge');
    const n = computeStreak();
    if (!el) {
      el = document.createElement('button');
      el.type = 'button';
      el.id = 'streakBadge';
      el.className = 'streak-badge';
      slot.parentNode.insertBefore(el, slot);
    }
    el.innerHTML = n > 0
      ? `<span class="fl">🔥</span><span class="n">${n}</span>`
      : `<span class="fl off">🔥</span>`;
    el.title = n > 0
      ? Sky.t('streakDaysTitle').replace('%1', n)
      : Sky.t('streakStartTitle');
    el.onclick = openStreakModal;
  }
 
  function openStreakModal() {
    const n = computeStreak();
    const best = bestStreak();
    const freezes = Sky.get(FREEZE_KEY, 0);
    const untilNext = AWARD_EVERY - (n % AWARD_EVERY || AWARD_EVERY);
    Sky.modal(`
      <div class="streak-modal">
        <div class="streak-big">🔥 ${n}</div>
        <div class="streak-sub">${n > 0 ? Sky.t('streakDaysLabel') : Sky.t('streakNoneLabel')}</div>
        <div class="streak-stats">
          <div><b>${best}</b><span>${Sky.t('streakBestLabel')}</span></div>
          <div><b>${'🧊'.repeat(freezes) || '—'}</b><span>${Sky.t('streakFreezesLabel')}</span></div>
        </div>
        <p class="streak-note">${n > 0 ? Sky.t('streakNextFreeze').replace('%1', untilNext) : Sky.t('streakHowTo')}</p>
      </div>`, () => {});
  }
 
  /* ---------- напоминание в конце дня ---------- */
  function maybeRemind() {
    const today = Sky.dayKey();
    if (Sky.get(REMIND_KEY, '') === today) return;
    const byDay = Sky.stats().byDay || {};
    if (hadActivity(byDay, today)) return;
    const streak = computeStreak();
    if (streak <= 0) return;
    const hour = new Date().getHours();
    if (hour < 19) return;
    Sky.set(REMIND_KEY, today);
    const msg = Sky.t('streakRiskMsg').replace('%1', streak);
    Sky.toast('🔥 ' + msg, 6000);
    Sky.notify(Sky.cfg.BRAND || 'SkyySchool', msg);
  }
 
  function init() {
    Sky.extendDict({
      streakDaysTitle: { ru: 'Серия: %1 дней подряд', en: 'Streak: %1 days in a row' },
      streakStartTitle: { ru: 'Начните серию — решите что-нибудь сегодня', en: 'Start a streak — solve something today' },
      streakDaysLabel: { ru: 'дней подряд', en: 'days in a row' },
      streakNoneLabel: { ru: 'Серия ещё не начата', en: 'No streak yet' },
      streakBestLabel: { ru: 'лучшая серия', en: 'best streak' },
      streakFreezesLabel: { ru: 'заморозки', en: 'freezes' },
      streakNextFreeze: { ru: 'Ещё %1 дн. до новой заморозки (максимум 2 про запас).', en: '%1 more day(s) to the next freeze (up to 2 in reserve).' },
      streakHowTo: { ru: 'Решайте задания в тренажёре каждый день — серия считается по дням с любой активностью. Пропустили день — если есть заморозка, она спишется сама и серия не прервётся.', en: 'Solve tasks in the trainer every day — the streak counts days with any activity. Miss a day and a freeze (if you have one) is used automatically so the streak survives.' },
      streakFreezeEarned: { ru: 'Заработана заморозка серии!', en: 'Streak freeze earned!' },
      streakFrozeUsed: { ru: 'Пропущенный день закрыт заморозкой — серия не прервалась.', en: 'A missed day was covered by a freeze — the streak lives on.' },
      streakRiskMsg: { ru: 'Серия %1 дней под угрозой — зайдите в тренажёр, пока день не кончился.', en: 'Your %1-day streak is at risk — open the trainer before the day ends.' }
    });
    autoFreeze();
    maybeAwardFreeze(computeStreak());
    renderBadge();
    maybeRemind();
    document.addEventListener('statschange', () => { maybeAwardFreeze(computeStreak()); renderBadge(); });
    document.addEventListener('langchange', renderBadge);
    document.addEventListener('headerready', renderBadge);
  }
 
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
 
  window.SkyStreaks = { computeStreak, bestStreak, freezes: () => Sky.get(FREEZE_KEY, 0) };
})();
 
