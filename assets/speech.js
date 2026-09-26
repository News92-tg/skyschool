/* ============================================================
   SkyySchool — общая обёртка над Web Speech API.

   Нужна двум местам сразу: странице «Russian for English speakers»
   и тренажёру (задания на аудирование в английском и польском
   банках). Поэтому живёт отдельно, а не внутри одной из страниц —
   иначе те же грабли пришлось бы обходить дважды.

   Внешних сервисов нет и не будет: только то, что умеет сам браузер.

   ЧЕТЫРЕ ГРАБЛИ, РАДИ КОТОРЫХ ЭТОТ ФАЙЛ И НАПИСАН:

   1. Голос нужного языка может отсутствовать. speechSynthesis
      послушно прочитает ЛЮБОЙ текст любым голосом: без русского
      голоса «Здравствуйте» будет прочитано английским, и ученик
      выучит неправильное произношение, будучи уверен, что слышит
      русское. Поэтому speak() отказывается работать, если голоса
      нужного языка нет, и возвращает причину отказа.

   2. Список голосов приезжает асинхронно. Первый getVoices() почти
      всегда пуст — настоящий список приходит событием voiceschanged.
      Отсюда onReady().

   3. Очередь. Два быстрых клика по «прослушать» ставят две фразы в
      очередь, и вторая звучит после первой. Поэтому перед каждой
      фразой — cancel().

   4. Распознавание есть не везде: Chrome и Edge умеют, Firefox нет,
      Safari по-разному. canListen() говорит правду, а не надежду.
   ============================================================ */

window.Speech = (function () {
  'use strict';

  const SYNTH = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;

  let readyCbs = [];
  let voicesSeen = false;

  function voices() {
    if (!SYNTH) return [];
    try { return SYNTH.getVoices() || []; } catch (e) { return []; }
  }

  /* Ищем точное совпадение языка, потом по первой части: для 'en-US'
     сойдёт 'en-GB' — акцент другой, но язык тот же и смысл сохранён. */
  function voiceFor(lang) {
    const want = String(lang || '').toLowerCase().replace('_', '-');
    const pre = want.split('-')[0];
    const all = voices();
    return all.find(v => (v.lang || '').toLowerCase().replace('_', '-') === want)
        || all.find(v => (v.lang || '').toLowerCase().replace('_', '-').split('-')[0] === pre)
        || null;
  }
  const hasVoice = lang => !!voiceFor(lang);
  const canSpeak = () => !!SYNTH;

  function onReady(cb) {
    if (typeof cb !== 'function') return;
    if (!SYNTH) { cb(); return; }
    if (voicesSeen || voices().length) { voicesSeen = true; cb(); return; }
    readyCbs.push(cb);
  }
  if (SYNTH && typeof SYNTH.addEventListener === 'function') {
    SYNTH.addEventListener('voiceschanged', () => {
      voicesSeen = true;
      const cbs = readyCbs; readyCbs = [];
      cbs.forEach(cb => { try { cb(); } catch (e) {} });
    });
  }

  /* {ok:true} либо {ok:false, reason}:
       'no-api'   — браузер не умеет синтез вообще,
       'no-voice' — нет голоса нужного языка (см. грабли №1),
       'error'    — синтез упал. */
  function speak(text, lang, opts) {
    const o = opts || {};
    if (!SYNTH) return { ok:false, reason:'no-api' };
    const v = voiceFor(lang);
    if (!v && !o.force) return { ok:false, reason:'no-voice' };
    try {
      SYNTH.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = lang;
      if (v) u.voice = v;
      /* Медленнее обычного: это учебная речь, её разбирают по словам. */
      u.rate = o.rate != null ? o.rate : 0.85;
      u.pitch = o.pitch != null ? o.pitch : 1;
      if (o.onend) u.onend = o.onend;
      SYNTH.speak(u);
      return { ok:true };
    } catch (e) {
      return { ok:false, reason:'error' };
    }
  }
  function stop() { if (SYNTH) { try { SYNTH.cancel(); } catch (e) {} } }

  const canListen = () => !!SR;

  /* Промис с распознанным текстом. Отклоняется КОДОМ ошибки
     ('no-api' | 'no-speech' | 'not-allowed' | 'busy' | …), а понятный
     человеку текст собирает страница — на своём языке. */
  function listen(lang, ms) {
    return new Promise((resolve, reject) => {
      if (!SR) { reject(new Error('no-api')); return; }
      let done = false, rec;
      try { rec = new SR(); } catch (e) { reject(new Error('no-api')); return; }
      rec.lang = lang || 'ru-RU';
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      rec.continuous = false;

      const timer = setTimeout(() => {
        if (!done) { try { rec.stop(); } catch (e) {} }
      }, ms || 6000);

      rec.onresult = ev => {
        done = true; clearTimeout(timer);
        const res = ev.results && ev.results[0];
        if (!res || !res[0]) { reject(new Error('no-speech')); return; }
        /* Все альтернативы, а не только первую: браузер нередко ставит
           верный вариант вторым, и засчитать его честнее, чем завалить. */
        const alts = [];
        for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
        resolve({ transcript: res[0].transcript, alternatives: alts, confidence: res[0].confidence });
      };
      rec.onerror = ev => {
        if (done) return;
        done = true; clearTimeout(timer);
        reject(new Error((ev && ev.error) || 'error'));
      };
      rec.onend = () => {
        if (done) return;
        done = true; clearTimeout(timer);
        reject(new Error('no-speech'));
      };
      try { rec.start(); }
      catch (e) { done = true; clearTimeout(timer); reject(new Error('busy')); }
    });
  }

  return { canSpeak, hasVoice, voiceFor, voices, onReady, speak, stop, canListen, listen };
})();
