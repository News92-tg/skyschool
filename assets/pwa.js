/* ============================================================
   SkyySchool — «Доступно обновление»

   Сайт выложили заново — у человека, который держит вкладку открытой
   или поставил сайт на телефон, работает прежняя версия. Service worker
   (sw.js) замечает новую и ставит её «в ожидание», а здесь:

     • registration.onupdatefound → новая версия установилась, а
       страницей управляет прежняя → баннер «Доступно обновление»;
     • «Обновить» → SKIP_WAITING новой версии → controllerchange →
       страница перезагружается уже с новой;
     • «Позже» — в этой вкладке час не спрашиваем;
     • проверяем обновления при возвращении во вкладку и раз в 30 минут.

   Подключается сам на каждой странице (assets/core.js).
   ============================================================ */
'use strict';

(function () {
  if (window.SkyPWA || !('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  Sky.extendDict({
    pwaTitle:{ru:'Доступно обновление',en:'Update available'},
    pwaText:{ru:'Вышла новая версия SkyySchool. Обновить страницу?',en:'A new version of SkyySchool is out. Reload the page?'},
    pwaReload:{ru:'Обновить',en:'Update'},
    pwaLater:{ru:'Позже',en:'Later'}
  });

  const t = k => Sky.t(k);
  const CHECK_EVERY = 30 * 60e3;
  let reg = null, bar = null, reloading = false, lastCheck = 0;

  /* «Позже» — в этой вкладке час не спрашиваем. Номера версии у
     service worker нет, поэтому просто по времени. */
  const laterKey = 'sky_pwa_later';
  const LATER_MS = 60 * 60e3;
  const isLater = () => { try { return Date.now() - (+sessionStorage.getItem(laterKey) || 0) < LATER_MS; } catch (e) { return false; } };
  const setLater = () => { try { sessionStorage.setItem(laterKey, String(Date.now())); } catch (e) {} };

  function show(worker) {
    if (!worker || isLater()) return;
    if (bar && document.body.contains(bar)) return;
    bar = document.createElement('div');
    bar.className = 'pwa-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `
      <span class="pwa-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg></span>
      <div class="pwa-txt"><b></b><span></span></div>
      <div class="pwa-acts"><button type="button" class="pwa-later"></button><button type="button" class="pwa-go"></button></div>`;
    bar.querySelector('b').textContent = t('pwaTitle');
    bar.querySelector('.pwa-txt span').textContent = t('pwaText');
    bar.querySelector('.pwa-go').textContent = t('pwaReload');
    bar.querySelector('.pwa-later').textContent = t('pwaLater');
    bar.querySelector('.pwa-go').addEventListener('click', () => apply(worker));
    bar.querySelector('.pwa-later').addEventListener('click', () => { setLater(); hide(); });
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('in'));
  }

  function hide() {
    if (!bar) return;
    const b = bar; bar = null;
    b.classList.remove('in');
    setTimeout(() => b.remove(), 250);
  }

  function apply(worker) {
    const btn = bar && bar.querySelector('.pwa-go');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    const w = (reg && reg.waiting) || worker;
    if (w && w.state === 'installed') w.postMessage({ type: 'SKIP_WAITING' });
    else reload();   /* уже включилась (прежняя версия sw.js включала сразу) */
  }

  function reload() {
    if (reloading) return;
    reloading = true;
    location.reload();
  }

  function track(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      /* установилась, а страницей управляет прежняя — это и есть обновление */
      if (worker.state === 'installed' && navigator.serviceWorker.controller) show(worker);
    });
  }

  function check() {
    if (!reg || Date.now() - lastCheck < 60e3) return;
    lastCheck = Date.now();
    reg.update().catch(() => {});
  }

  async function init() {
    try { reg = await navigator.serviceWorker.getRegistration(); } catch (e) { reg = null; }
    if (!reg) {
      /* core.js регистрирует sw.js чуть позже — подождём готовности */
      try { reg = await navigator.serviceWorker.ready; } catch (e) { return; }
    }
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    if (reg.installing) track(reg.installing);
    reg.addEventListener('updatefound', () => track(reg.installing));
    lastCheck = Date.now();
    setInterval(check, CHECK_EVERY);
  }

  /* Новая версия взяла управление — перезагрузиться, но только если
     человек сам нажал «Обновить» (или страницей до этого вообще никто
     не управлял — тогда перезагрузка не нужна). */
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && document.querySelector('.pwa-bar .pwa-go:disabled')) reload();
    hadController = true;
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  document.addEventListener('langchange', () => {
    if (!bar) return;
    bar.querySelector('b').textContent = t('pwaTitle');
    bar.querySelector('.pwa-txt span').textContent = t('pwaText');
    bar.querySelector('.pwa-go').textContent = t('pwaReload');
    bar.querySelector('.pwa-later').textContent = t('pwaLater');
  });

  if (document.readyState === 'complete') init();
  else window.addEventListener('load', init);

  window.SkyPWA = { check: () => { lastCheck = 0; check(); }, get registration() { return reg; } };
})();
