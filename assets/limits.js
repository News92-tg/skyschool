/* ============================================================
   SkyySchool — лимиты проверок на странице

   Worker и так не пропустит лишнюю проверку, но человек должен знать
   об этом ДО нажатия, а не после:

     • в шапке — «Осталось: 2/3 проверок» (на телефоне — в строке
       тарифа на странице), по нажатию — окно «Тарифы»;
     • лимит кончился — кнопки «Проверить» ([data-needs-limit])
       неактивны, рядом живой отсчёт «Следующая через 04:12»;
     • 429 от Worker — отсчёт по retry_after;
     • 402 от Worker — окно «Оформите тариф» с причиной.

   Данные — SkyCheck (assets/photo-api.js): /api/limits при загрузке
   и после входа; у прежнего Worker — его правило (1 фото раз в 30 с)
   без запроса. Подключается после photo-api.js.
   ============================================================ */
'use strict';

(function () {
  if (!window.SkyCheck || window.SkyLimits) return;

  Sky.extendDict({
    lmLeft:{ru:'Осталось: %1/%2 проверок',en:'Left: %1/%2 checks'},
    lmLeftShort:{ru:'%1/%2',en:'%1/%2'},
    lmNext:{ru:'Следующая через %1',en:'Next in %1'},
    lmReset:{ru:'Лимит обновится через %1',en:'Resets in %1'},
    lmWindow:{ru:'Лимит тарифа «%1»: %2',en:'“%1” plan limit: %2'},
    lmOut:{ru:'Проверки на это время закончились',en:'No checks left for now'},
    lmUpgrade:{ru:'Больше проверок',en:'More checks'}
  });

  const t = k => Sky.t(k);
  const esc = SkyCheck.esc;

  /* Сколько проверок осталось в окне тарифа. Пока идёт отсчёт — ноль,
     даже если сервер ещё не сказал: отсчёт и значит «лимит исчерпан». */
  function state() {
    const lim = SkyCheck.limits;
    if (!lim || !lim.limits) return null;
    const total = Math.max(1, +lim.limits.requests || 1);
    const wait = SkyCheck.waitLeft();
    const r = lim.rate || {};
    let left = typeof r.remaining === 'number' ? r.remaining : total;
    if (wait > 0) left = 0;
    left = Math.max(0, Math.min(total, left));
    return { total, left, wait, reset: +r.reset_in || 0, plan: SkyCheck.planName(lim.plan), window: SkyCheck.planSummary() };
  }

  const tone = s => !s ? '' : s.left === 0 ? 'out' : s.left / s.total <= 0.34 ? 'low' : 'ok';

  function meterHtml(s, compact) {
    const pct = Math.round(s.left / s.total * 100);
    const label = s.left === 0 && s.wait > 0
      ? t('lmNext').replace('%1', SkyCheck.clock(s.wait))
      : t(compact ? 'lmLeftShort' : 'lmLeft').replace('%1', s.left).replace('%2', s.total);
    return `<span class="lm-ring" style="--p:${pct}" aria-hidden="true"></span><span class="lm-text">${esc(label)}</span>`;
  }

  function title(s) {
    const parts = [t('lmWindow').replace('%1', s.plan).replace('%2', s.window)];
    if (s.left === 0 && s.wait > 0) parts.push(t('lmNext').replace('%1', SkyCheck.clock(s.wait)));
    else if (s.left < s.total && s.reset > 0) parts.push(t('lmReset').replace('%1', SkyCheck.clock(s.reset)));
    return parts.join(' · ');
  }

  /* ---------- шапка ----------
     Кнопку «Тарифы» ставит photo-api.js; мы превращаем её в счётчик. */
  function renderHeader(s) {
    const b = document.getElementById('tariffsHdr');
    if (!b) return;
    if (!s) { b.classList.remove('lm-chip', 'ok', 'low', 'out'); b.textContent = t('tariffsBtn'); b.removeAttribute('title'); return; }
    b.className = 'btn ghost small tariffs-hdr lm-chip ' + tone(s);
    b.innerHTML = meterHtml(s, false);
    b.title = title(s);
    b.setAttribute('aria-label', b.title);
  }

  /* ---------- на странице ([data-limit-meter]) — видно и на телефоне ---------- */
  function renderMeters(s) {
    document.querySelectorAll('[data-limit-meter]').forEach(el => {
      el.hidden = !s;
      if (!s) return;
      el.className = 'lm-meter ' + tone(s);
      el.innerHTML = meterHtml(s, false) + (s.left === 0
        ? `<button type="button" class="lm-more" data-lm-plans>${esc(t('lmUpgrade'))}</button>` : '');
      el.title = title(s);
    });
  }

  /* ---------- кнопки «Проверить» ----------
     Включать их — дело страницы (она знает, выбраны ли фото). Здесь
     только выключаем, когда проверок нет, и объясняем почему. */
  function guard(s) {
    const out = !!s && s.left === 0;
    document.querySelectorAll('[data-needs-limit]').forEach(btn => {
      if (out) {
        btn.disabled = true;
        btn.dataset.lmLocked = '1';
        btn.title = s.wait > 0 ? t('lmNext').replace('%1', SkyCheck.clock(s.wait)) : t('lmOut');
      } else if (btn.dataset.lmLocked) {
        delete btn.dataset.lmLocked;
        btn.removeAttribute('title');
      }
    });
  }

  function render() {
    const s = state();
    renderHeader(s);
    renderMeters(s);
    guard(s);
  }

  /* ---------- ответы Worker ---------- */
  SkyCheck.onResponse((res, path) => {
    if (!res || res.ok || /\/api\/limits$/.test(path)) return;
    const d = res.data || {};
    if (res.status === 429 && (d.retry_after || d.waitSec)) {
      SkyCheck.setWait(+(d.retry_after || d.waitSec));
    }
    if (res.status === 402) {
      SkyCheck.openTariffs(d.need || 'paid', d.error || true);
    }
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-lm-plans]')) SkyCheck.openTariffs('paid');
  });

  SkyCheck.onChange(render);
  document.addEventListener('headerready', () => setTimeout(render, 0));
  document.addEventListener('langchange', () => setTimeout(render, 0));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
  else render();

  window.SkyLimits = { state, render };
})();
