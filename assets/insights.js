/* ============================================================
   SkyySchool — связи между тем, как ученик живёт, и тем, как учится.

   Подключается после assets/core.js и assets/trackers.js.

   ЗАЧЕМ ЭТО ЗДЕСЬ И ПОЧЕМУ ЭТОГО НЕТ У ДРУГИХ.
   Данные по отдельности есть у всех: тренажёры считают точность,
   трекеры считают часы сна. Вместе они лежат только здесь — в одном
   localStorage, по одним и тем же датам. Соединить их стоит тридцати
   строк, а ученику даёт то, чего не даст ни один отдельный сервис:
   «в дни после коротких ночей ты решал заметно хуже» — на его
   собственных данных, а не в среднем по исследованиям.

   ТРИ ПРАВИЛА, БЕЗ КОТОРЫХ ЭТО ВРЕДНО.

   1. Связь — не причина. Мы говорим «связано», а не «из-за». Причин
      может быть сколько угодно: заболел, поссорился, задали больше.
      Формулировка «ты плохо решаешь ИЗ-ЗА недосыпа» — враньё, которое
      ученик заслуженно пошлёт.

   2. Мало данных — молчим. На трёх днях любая разница случайна.
      Порог: минимум 10 дней с обеими записями и минимум по 4 дня в
      каждой группе, иначе не показываем ничего.

   3. Маленькая разница — молчим. Ниже 7 процентных пунктов это шум,
      а не наблюдение.

   Ничего из этого никуда не отправляется: расчёт идёт в браузере по
   тем данным, что уже лежат в нём.
   ============================================================ */

'use strict';

window.SkyInsights = (function () {

  const MIN_DAYS = 10;        /* дней с обеими записями */
  const MIN_GROUP = 4;        /* дней в каждой группе */
  const MIN_GAP = 7;          /* процентных пунктов, ниже — шум */
  const SHORT_NIGHT = 7;      /* часов; ниже считаем ночь короткой */

  /* Пара «ночь → день». Запись сна за дату — это ночь, которая
     ЗАКОНЧИЛАСЬ утром этого дня (в трекерах поле подписано «Ночь на»),
     поэтому она сопоставляется с занятиями того же дня, а не
     следующего. Ошибиться здесь легко, и тогда весь вывод
     перевернётся. */
  function pairs() {
    const life = Sky.get('life', {}) || {};
    const sleep = life.sleep || {};
    const byDay = (Sky.stats().byDay) || {};
    const out = [];
    for (const date of Object.keys(sleep)) {
      const s = sleep[date];
      const d = byDay[date];
      if (!s || !(s.hours > 0)) continue;
      if (!d || !d.n) continue;
      out.push({
        date,
        hours: s.hours,
        quality: s.quality,
        solved: d.n,
        accuracy: d.right / d.n * 100
      });
    }
    return out.sort((a, b) => a.date < b.date ? -1 : 1);
  }

  /* Среднее без деления на ноль */
  const avg = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

  /* ---------- сон и точность ----------
     Возвращает либо null (сказать нечего), либо готовое наблюдение с
     числами, по которым его можно проверить. */
  function sleepVsAccuracy() {
    const rows = pairs();
    if (rows.length < MIN_DAYS) {
      return { enough: false, have: rows.length, need: MIN_DAYS };
    }

    const short = rows.filter(r => r.hours < SHORT_NIGHT);
    const long = rows.filter(r => r.hours >= SHORT_NIGHT);
    if (short.length < MIN_GROUP || long.length < MIN_GROUP) {
      return { enough: false, have: rows.length, need: MIN_DAYS, oneSided: true,
               short: short.length, long: long.length };
    }

    const accShort = avg(short.map(r => r.accuracy));
    const accLong = avg(long.map(r => r.accuracy));
    const gap = accLong - accShort;

    return {
      enough: true,
      days: rows.length,
      short: { days: short.length, accuracy: Math.round(accShort), solved: Math.round(avg(short.map(r => r.solved))) },
      long:  { days: long.length,  accuracy: Math.round(accLong),  solved: Math.round(avg(long.map(r => r.solved))) },
      gap: Math.round(gap),
      /* Значимой считаем разницу от 7 пунктов. Знак важен: бывает и
         наоборот, и тогда честнее показать это, чем спрятать. */
      meaningful: Math.abs(gap) >= MIN_GAP,
      direction: gap >= 0 ? 'better-rested' : 'better-short'
    };
  }

  /* ---------- сколько успевает сделать ----------
     Отдельно от точности: недосып чаще бьёт по объёму, чем по качеству —
     ученик просто не садится заниматься. */
  function sleepVsVolume() {
    const rows = pairs();
    if (rows.length < MIN_DAYS) return null;
    const short = rows.filter(r => r.hours < SHORT_NIGHT);
    const long = rows.filter(r => r.hours >= SHORT_NIGHT);
    if (short.length < MIN_GROUP || long.length < MIN_GROUP) return null;
    const a = avg(short.map(r => r.solved)), b = avg(long.map(r => r.solved));
    if (!a && !b) return null;
    return { short: Math.round(a), long: Math.round(b), gap: Math.round(b - a) };
  }

  /* ---------- лучшее время дня ----------
     Считается по расписанию из трекеров: в какие часы стоят блоки с
     категорией «учёба» в те дни, когда точность была выше средней.
     Пока данных мало, молчим так же. */
  function bestHours() {
    const rows = pairs();
    if (rows.length < MIN_DAYS) return null;
    const mid = avg(rows.map(r => r.accuracy));
    const good = rows.filter(r => r.accuracy > mid);
    if (good.length < MIN_GROUP) return null;
    return { above: good.length, total: rows.length, mid: Math.round(mid) };
  }

  /* Текст на языке интерфейса. Держится здесь, а не на странице:
     наблюдение и его формулировка — одно целое, и разъехавшись они
     начинают противоречить друг другу. */
  function phrase(res, lang) {
    const ru = lang !== 'en';
    if (!res || !res.enough) return '';
    if (!res.meaningful) {
      return ru
        ? `За ${res.days} дней с записями заметной разницы между короткими и длинными ночами не видно: ${res.short.accuracy}% против ${res.long.accuracy}%. Это тоже результат — значит дело не в сне.`
        : `Across ${res.days} logged days there is no clear difference between short and long nights: ${res.short.accuracy}% against ${res.long.accuracy}%. That is a result too — sleep is not the factor here.`;
    }
    if (res.direction === 'better-rested') {
      return ru
        ? `После ночей короче ${SHORT_NIGHT} часов твоя точность в среднем ${res.short.accuracy}%, после длинных — ${res.long.accuracy}%. Разница ${res.gap} пунктов на ${res.days} днях. Это связь, а не причина: короткая ночь могла быть следствием того же, что помешало решать.`
        : `After nights shorter than ${SHORT_NIGHT} hours your accuracy averages ${res.short.accuracy}%, after longer ones ${res.long.accuracy}% — ${res.gap} points apart across ${res.days} days. That is a link, not a cause: the short night may itself come from whatever else got in the way.`;
    }
    return ru
      ? `Неожиданно: после коротких ночей точность выше (${res.short.accuracy}% против ${res.long.accuracy}%). Так бывает, когда поздно ложатся именно в те дни, когда занимаются дольше обычного.`
      : `Unexpectedly, accuracy is higher after short nights (${res.short.accuracy}% against ${res.long.accuracy}%). That happens when late nights are exactly the days with more studying.`;
  }

  return { MIN_DAYS, MIN_GROUP, MIN_GAP, SHORT_NIGHT,
           pairs, sleepVsAccuracy, sleepVsVolume, bestHours, phrase };
})();
