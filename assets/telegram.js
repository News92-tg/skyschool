/* ============================================================
   SkyySchool — Telegram в профиле (profile.html#telegram)

   «Привязать Telegram»: база выдаёт одноразовый код (telegram_link_start),
   кнопка открывает t.me/<бот>?start=<код>; бот (Worker /telegram/webhook)
   сохраняет chat_id — страница это замечает сама и показывает
   «Подключено». Дальше — «Проверить» (тестовое сообщение через
   /notify) и «Отключить».

   Имя бота и готовность — GET /api/telegram/bot у Worker. Прежний
   Worker его не знает — тогда честно пишем, что бот ещё не подключён.
   ============================================================ */
'use strict';

(function () {

  Sky.extendDict({
    tgH:{ru:'Уведомления в Telegram',en:'Telegram notifications'},
    tgLead:{ru:'Напишем, когда ученик сдаст работу, когда подтвердится оплата и когда закончится лимит проверок.',
            en:'We will message you when a student submits work, when a payment is confirmed and when you run out of checks.'},
    tgOn:{ru:'Подключено',en:'Connected'},
    tgOnD:{ru:'Сообщения приходят в ваш Telegram.',en:'Messages go to your Telegram.'},
    tgLink:{ru:'Привязать Telegram',en:'Link Telegram'},
    tgOpen:{ru:'Открыть Telegram',en:'Open Telegram'},
    tgWait:{ru:'Нажмите «Запустить» в чате с ботом — страница увидит это сама.',en:'Press “Start” in the bot chat — this page will notice.'},
    tgExpires:{ru:'Ссылка одноразовая и действует 15 минут.',en:'The link works once, for 15 minutes.'},
    tgExpired:{ru:'Ссылка устарела — получите новую.',en:'The link has expired — get a new one.'},
    tgNew:{ru:'Новая ссылка',en:'New link'},
    tgDone:{ru:'Telegram подключён',en:'Telegram connected'},
    tgTest:{ru:'Проверить',en:'Send a test'},
    tgTestMsg:{ru:'Уведомления SkyySchool работают.',en:'SkyySchool notifications work.'},
    tgTestSent:{ru:'Тестовое сообщение отправлено',en:'Test message sent'},
    tgTestFail:{ru:'Telegram не принял сообщение. Напишите боту /start и попробуйте снова.',en:'Telegram did not accept the message. Send /start to the bot and retry.'},
    tgOff:{ru:'Отключить',en:'Disconnect'},
    tgOffAsk:{ru:'Отключить уведомления в Telegram?',en:'Turn off Telegram notifications?'},
    tgOffDone:{ru:'Уведомления отключены',en:'Notifications turned off'},
    tgNoBot:{ru:'Бот ещё не подключён к сайту. Когда администратор его подключит, здесь появится кнопка.',en:'The bot is not connected yet. Once the administrator connects it, a button will appear here.'},
    tgAdminHow:{ru:'Администратору: в Cloudflare → Worker news92-orders задайте секреты TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET, затем нажмите «Подключить вебхук».',
                en:'Admin: set the TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET secrets on the news92-orders Worker, then press “Connect webhook”.'},
    tgSetup:{ru:'Подключить вебхук',en:'Connect webhook'},
    tgSetupOk:{ru:'Вебхук подключён: @%1',en:'Webhook connected: @%1'},
    tgNeedCloud:{ru:'Нужно облако (Supabase).',en:'The cloud (Supabase) is required.'}
  });

  const t = k => Sky.t(k);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
  const ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#29a9eb"/><path fill="#fff" d="M5.4 11.7l11.1-4.3c.5-.2 1 .1.8.9l-1.9 8.9c-.1.6-.5.8-1 .5l-2.9-2.1-1.4 1.3c-.2.2-.3.3-.6.3l.2-3 5.4-4.9c.2-.2 0-.3-.3-.1l-6.7 4.2-2.9-.9c-.6-.2-.6-.6.2-.9z"/></svg>';

  let me = null, section = null;
  let linked = false, bot = null, isAdmin = false;
  let pollTimer = null, pollUntil = 0, link = null;

  async function readLinked() {
    const rows = await Sky.db.list('user_telegram', { user_id: me.id });
    return !!(rows && rows.length);
  }

  async function loadBot() {
    if (!window.SkyCheck || await SkyCheck.mode() !== 'orders') return { ready: false };
    const res = await SkyCheck.request('/api/telegram/bot', { timeout: 10000 });
    return res.ok && res.data ? res.data : { ready: false };
  }

  function render() {
    let body;
    if (!Sky.db.isCloud()) body = `<p class="tg-note">${esc(t('tgNeedCloud'))}</p>`;
    else if (linked) {
      body = `
        <div class="tg-state on"><span class="dot" aria-hidden="true"></span><div><b>${esc(t('tgOn'))}</b><span>${esc(t('tgOnD'))}</span></div></div>
        <div class="tg-acts">
          <button type="button" class="btn ghost small" data-tg="test">${esc(t('tgTest'))}</button>
          <button type="button" class="btn ghost small tg-off" data-tg="off">${esc(t('tgOff'))}</button>
        </div>`;
    } else if (link) {
      const left = Math.max(0, Math.round((link.until - Date.now()) / 1000));
      body = left > 0 ? `
        <div class="tg-acts">
          <a class="btn tg-btn" href="${esc(link.url)}" target="_blank" rel="noopener" data-tg="open">${ICON}<span>${esc(t('tgOpen'))}</span></a>
        </div>
        <p class="tg-wait"><span class="spin" aria-hidden="true"></span>${esc(t('tgWait'))}</p>
        <p class="tg-note">${esc(t('tgExpires'))}</p>` : `
        <p class="tg-note">${esc(t('tgExpired'))}</p>
        <div class="tg-acts"><button type="button" class="btn" data-tg="link">${esc(t('tgNew'))}</button></div>`;
    } else if (bot && bot.ready) {
      body = `<div class="tg-acts"><button type="button" class="btn tg-btn" data-tg="link">${ICON}<span>${esc(t('tgLink'))}</span></button></div>`;
    } else {
      body = `<p class="tg-note">${esc(t('tgNoBot'))}</p>` +
        (isAdmin ? `<p class="tg-note admin">${esc(t('tgAdminHow'))}</p><div class="tg-acts"><button type="button" class="btn ghost small" data-tg="setup">${esc(t('tgSetup'))}</button></div>` : '');
    }
    const el = section('telegram', `<h2>${ICON}<span>${esc(t('tgH'))}</span></h2><p>${esc(t('tgLead'))}</p>${body}`);
    el.querySelectorAll('[data-tg]').forEach(b => b.addEventListener('click', e => act(b.dataset.tg, b, e)));
  }

  async function act(what, btn, e) {
    if (what === 'open') { startPoll(); return; }
    if (what === 'link') {
      btn.disabled = true;
      let res;
      try { res = await Sky.db.rpc('telegram_link_start'); }
      catch (err) { btn.disabled = false; if (window.SkyErrors) SkyErrors.show(err, { retry: () => act('link', btn) }); return; }
      link = { url: `https://t.me/${encodeURIComponent(bot.username)}?start=${encodeURIComponent(res.code)}`,
               until: new Date(res.expires_at).getTime() || Date.now() + 15 * 60e3 };
      render();
      startPoll();
      return;
    }
    if (what === 'test') {
      btn.disabled = true;
      const res = await SkyCheck.request('/notify', { method: 'POST', json: { user_id: me.id, type: 'test', message: t('tgTestMsg') }, timeout: 15000 });
      btn.disabled = false;
      if (res.ok && res.data && res.data.sent) { if (window.SkyErrors) SkyErrors.success(t('tgTestSent')); return; }
      if (!res.ok && window.SkyErrors) { SkyErrors.show(res, { retry: () => act('test', btn) }); return; }
      Sky.toast(t('tgTestFail'), 6000);
      return;
    }
    if (what === 'off') {
      if (!confirm(t('tgOffAsk'))) return;
      btn.disabled = true;
      const ok = await Sky.db.removeWhere('user_telegram', { user_id: me.id }) && !(await readLinked());
      if (ok) { linked = false; link = null; if (window.SkyErrors) SkyErrors.success(t('tgOffDone')); }
      render();
      return;
    }
    if (what === 'setup') {
      btn.disabled = true;
      const res = await SkyCheck.request('/api/telegram/setup', { method: 'POST', timeout: 20000 });
      btn.disabled = false;
      if (!res.ok) { if (window.SkyErrors) SkyErrors.show(res, { retry: () => act('setup', btn) }); return; }
      if (window.SkyErrors) SkyErrors.success(t('tgSetupOk').replace('%1', res.data.username || ''));
      bot = await loadBot();
      render();
    }
  }

  /* Ждём, пока бот сохранит chat_id: раз в 3 с, пока жива ссылка. */
  function startPoll() {
    clearInterval(pollTimer);
    pollUntil = link ? link.until : Date.now() + 15 * 60e3;
    pollTimer = setInterval(async () => {
      if (document.hidden) return;
      if (Date.now() > pollUntil) { clearInterval(pollTimer); render(); return; }
      let now = false;
      try { now = await readLinked(); } catch (e) { return; }
      if (now) {
        clearInterval(pollTimer);
        linked = true; link = null;
        render();
        if (window.SkyErrors) SkyErrors.success(t('tgDone'));
      }
    }, 3000);
  }
  /* Вернулись во вкладку из Telegram — проверим сразу, не ждём таймера. */
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden || linked || !link || !me) return;
    try { if (await readLinked()) { clearInterval(pollTimer); linked = true; link = null; render(); if (window.SkyErrors) SkyErrors.success(t('tgDone')); } } catch (e) {}
  });

  if (!window.SkyProfile) return;
  SkyProfile.ready.then(async p => {
    me = p.me; section = p.section;
    if (!Sky.db.isCloud()) return;
    render();
    const [l, b, a] = await Promise.all([
      readLinked().catch(() => false),
      loadBot().catch(() => ({ ready: false })),
      Sky.db.rpc('is_admin').catch(() => false)
    ]);
    linked = l; bot = b; isAdmin = a === true;
    render();
  });
  document.addEventListener('langchange', () => { if (section && me) render(); });

  window.SkyTelegram = { get linked() { return linked; } };
})();
