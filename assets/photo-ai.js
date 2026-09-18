/* ============================================================
   SkyySchool — фотография задания: сжатие, отправка, сохранение.

   Подключается после assets/core.js и assets/db.js.

   ПОЧЕМУ ЭТОТ ФАЙЛ ВООБЩЕ ПОЯВИЛСЯ. Всё это уже работало — внутри
   photo.html, одним куском вместе с разметкой той страницы. Пока
   место было одно, так было нормально. Теперь фото нужно и в
   тренажёре, и скопировать туда сжатие с лимитами означало бы завести
   вторую копию, которая разойдётся с первой на первой же правке:
   поменяли потолок размера в одном месте, забыли в другом — и половина
   снимков начинает отлетать с 413.

   Поэтому здесь ровно то, что общее у обеих страниц:
     сжатие до 1024 px → вызов Worker → бакет → строка в photo_checks.
   Разметку и тексты каждая страница рисует сама.

   КЛЮЧЕЙ ЗДЕСЬ НЕТ И БЫТЬ НЕ МОЖЕТ. Браузер ходит только на адрес
   своего Worker (SKY_CONFIG.AI_BASE); ключ Gemini лежит в переменных
   окружения Worker и наружу не выходит. Ключ в файлах сайта — это
   ключ, опубликованный на GitHub Pages: его читают боты, и деньги
   кончаются за ночь.
   ============================================================ */

'use strict';

window.PhotoAI = (function () {

  const CFG = window.SKY_CONFIG || {};

  /* Свои сообщения модуль регистрирует сам, а не ждёт, что каждая
     страница их перепишет к себе: тексты про «нет интернета» и «ключ
     не настроен» одинаковы везде, где есть фото. */
  if (window.Sky && Sky.extendDict) Sky.extendDict({
    paNoPhoto:{ru:'Сначала сделайте или выберите фото.',en:'Take or choose a photo first.'},
    paNoWorker:{ru:'Разбор фото не подключён: в assets/config.js пустое поле AI_BASE. Туда идёт адрес вашего Worker — ключ Gemini в файлы сайта класть нельзя, его увидит любой посетитель.',
                en:'Photo analysis is not connected: AI_BASE is empty in assets/config.js. It needs your Worker address — the Gemini key must never go into site files, any visitor could read it.'},
    paCooldown:{ru:'Следующий разбор фото можно запросить через %1 сек.',en:'The next photo can be sent in %1 seconds.'},
    paOffline:{ru:'Не удалось связаться с сервером разбора. Проверьте интернет и что адрес Worker открывается в браузере.',
               en:'Could not reach the analysis server. Check your connection and that the Worker address opens in a browser.'},
    paHttp:{ru:'Сервер разбора ответил ошибкой %1.',en:'The analysis server returned error %1.'},
    paTooBig:{ru:'Не удалось ужать фото до нужного размера. Снимите ближе, без лишнего фона.',
              en:'The photo could not be compressed enough. Shoot closer, with less background.'},
    paNotImage:{ru:'Это не изображение. Нужен файл JPEG, PNG или WebP.',en:'That is not an image. A JPEG, PNG or WebP file is needed.'},
    paUnreadable:{ru:'Браузер не смог открыть этот файл. Если снимок с айфона в формате HEIC, сохраните его как JPEG.',
                  en:'The browser could not open this file. If it is an iPhone HEIC photo, save it as JPEG first.'}
  });

  /* ---------- размеры ----------
     1024 px по длинной стороне — это компромисс, проверенный на
     тетрадях: рукопись ещё читается, а снимок с телефона (3–6 МБ)
     худеет до сотен килобайт. Потолок 1200 КБ совпадает с MAX_IMAGE_KB
     в Worker: если поднять здесь и забыть там, пользователь получит
     413 вместо разбора. */
  const MAX_SIDE = 1024;
  const MAX_KB = 1200;
  const BUCKET = 'homework';

  /* Промежуток между разборами. Держится и на сервере
     (RATE_PHOTO_SECONDS), и здесь — но по разным причинам: там это
     защита кошелька, здесь вежливость. Показать «осталось 12 секунд»
     честнее, чем отправить запрос и вернуть 429. */
  const COOLDOWN_SEC = 30;
  const LAST_KEY = 'photoAiLast';

  function cooldownLeft() {
    const last = Sky.get(LAST_KEY, 0);
    const passed = (Date.now() - last) / 1000;
    return passed >= COOLDOWN_SEC ? 0 : Math.ceil(COOLDOWN_SEC - passed);
  }
  function markSent() { Sky.set(LAST_KEY, Date.now()); }

  /* ---------- сжатие ----------
     Качество подбираем лесенкой вниз, пока не влезем в потолок: у
     страницы учебника и у тетради в клетку очень разная сжимаемость,
     и одно фиксированное значение либо раздувает файл, либо зря
     портит текст. */
  const QUALITY_STEPS = [0.82, 0.7, 0.58, 0.45, 0.35];

  function draw(source, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(source, 0, 0, w, h);
    return c;
  }

  function fit(w, h) {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
  }

  const b64Bytes = dataUrl => (dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75;

  /* Возвращает data:image/jpeg;base64,… или null, если ужать не вышло. */
  function compressImage(img) {
    const [w, h] = fit(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const c = draw(img, w, h);
    for (const q of QUALITY_STEPS) {
      const url = c.toDataURL('image/jpeg', q);
      if (b64Bytes(url) <= MAX_KB * 1024) return url;
    }
    return null;
  }

  function compressVideoFrame(video) {
    const [w, h] = fit(video.videoWidth, video.videoHeight);
    return draw(video, w, h).toDataURL('image/jpeg', 0.82);
  }

  /* Файл из <input type="file"> — и с камеры, и из галереи.
     HEIC с айфона браузер в canvas не нарисует: Safari умеет, Chrome
     на Android — нет. Поэтому отказ здесь внятный, а не «ошибка». */
  function compressFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('nofile')); return; }
      if (!/^image\//.test(file.type || '')) { reject(new Error('notimage')); return; }

      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const small = compressImage(img);
        if (!small) { reject(new Error('toobig')); return; }
        resolve(small);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('unreadable'));
      };
      img.src = url;
    });
  }

  /* ---------- разбор через Worker ----------
     Возвращает { ok:true, data } либо { ok:false, code, message }.
     code нужен странице, чтобы отличить «нет интернета» от «модель
     отказалась»: в первом случае уместно предложить повтор, во
     втором — переснять фото. */
  const base = () => String(CFG.AI_BASE || '').replace(/\/+$/, '');

  async function analyze(opts) {
    const o = opts || {};
    if (!o.dataUrl) return { ok: false, code: 'nophoto', message: Sky.t('paNoPhoto') };
    if (!base()) return { ok: false, code: 'noworker', message: Sky.t('paNoWorker') };

    const wait = cooldownLeft();
    if (wait) return { ok: false, code: 'cooldown', wait, message: Sky.t('paCooldown').replace('%1', wait) };

    let r;
    try {
      r = await fetch(base() + '/photo-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang: Sky.lang,
          imageBase64: o.dataUrl,
          subject: o.subject || '',
          taskText: (o.taskText || '').slice(0, 800)
        })
      });
    } catch (e) {
      /* fetch падает и без сети, и когда Worker не отвечает вовсе —
         различить их из браузера нельзя, поэтому текст покрывает оба.
         Паузу в этом случае НЕ включаем: запрос никуда не ушёл, денег
         не стоил, и запирать кнопку на полминуты не за что. */
      return { ok: false, code: 'offline', message: Sky.t('paOffline') };
    }

    /* Ответ получен — значит вызов сервера состоялся и стоил денег
       (даже если это была ошибка). С этого момента считаем паузу. */
    markSent();

    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }

    if (r.status === 429) {
      const sec = (data && data.retryAfter) || COOLDOWN_SEC;
      return { ok: false, code: 'cooldown', wait: sec, message: (data && data.error) || Sky.t('paCooldown').replace('%1', sec) };
    }
    if (!r.ok || !data) {
      return {
        ok: false,
        code: r.status >= 500 ? 'server' : 'bad',
        message: (data && data.error) || Sky.t('paHttp').replace('%1', r.status)
      };
    }
    /* Worker отвечает 200 и с полем error, когда разобрать удалось
       частично: текст есть, разбора нет. Это не отказ — показываем
       что есть и предупреждение сверху. */
    if (data.error && !data.text) return { ok: false, code: 'model', message: data.error };

    return { ok: true, data, warning: data.error || '' };
  }

  /* ---------- сохранение снимка ----------
     Бакет закрытый, путь — <id ученика>/<дата>.jpg. Папка по ученику
     не для порядка, а для правил доступа: политика в
     sql/schema-storage.sql разрешает читать только свою папку, и без
     такого пути её не написать.

     Сохранение НЕ обязательно: если не вошли или облака нет, разбор
     всё равно показывается. Молча терять снимок нельзя, поэтому
     возвращаем причину, а страница решает, говорить о ней или нет. */
  async function uploadShot(dataUrl, userId) {
    if (!Sky.db || !Sky.db.isCloud || !Sky.db.isCloud()) return { skipped: 'local' };
    if (!userId) return { skipped: 'anon' };

    let blob;
    try { blob = await (await fetch(dataUrl)).blob(); }
    catch (e) { return { error: 'blob' }; }

    const name = new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
    const res = await Sky.db.upload(BUCKET, userId + '/' + name, blob, { contentType: 'image/jpeg' });
    if (res.error) return { error: res.error };
    return { path: res.path };
  }

  const shotUrl = path => Sky.db.signedUrl(BUCKET, path, 3600);

  /* ---------- строка в photo_checks ----------
     Таблица одна и та же и для проверки домашки (photo.html), и для
     разбора условия (тренажёр). Разводит их поле kind: без него в
     истории ученика «решено за тебя» и «проверено у тебя» слиплись бы
     в одну кучу, а это разные вещи.

     Оценку здесь не ставим никогда: /photo-analyze её и не считает. */
  async function saveCheck(row) {
    if (!Sky.db) return null;
    const me = Sky.db.me && Sky.db.me();
    if (Sky.db.isCloud() && !me) return null;   /* RLS не примет чужой student_id */
    try {
      return await Sky.db.insert('photo_checks', Object.assign({
        student_id: me ? me.id : 'local',
        status: 'ok',
        ocr_flagged: false
      }, row));
    } catch (e) {
      return null;
    }
  }

  return {
    MAX_SIDE, MAX_KB, BUCKET, COOLDOWN_SEC,
    cooldownLeft,
    compressImage, compressVideoFrame, compressFile,
    analyze,
    uploadShot, shotUrl, saveCheck
  };
})();
