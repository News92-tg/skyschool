/* ============================================================
   SkyySchool — вход, роли и профиль в шапке
   ============================================================ */
'use strict';

Sky.auth = (function () {

  Sky.extendDict({
    signInT:{ru:'Вход в SkyySchool',en:'Sign in to SkyySchool'},
    signUpT:{ru:'Новый профиль',en:'New profile'},
    email:{ru:'Почта',en:'Email'},
    pass:{ru:'Пароль',en:'Password'},
    yourName:{ru:'Как вас зовут',en:'Your name'},
    iAm:{ru:'Я захожу как',en:'I am signing in as'},
    createAcc:{ru:'Создать профиль',en:'Create profile'},
    haveAcc:{ru:'У меня уже есть профиль',en:'I already have a profile'},
    noAcc:{ru:'Профиля ещё нет',en:'I do not have a profile yet'},
    signOut:{ru:'Выйти',en:'Sign out'},
    myProfile:{ru:'Мой профиль',en:'My profile'},
    quickIn:{ru:'Быстрый вход на этом устройстве',en:'Quick sign-in on this device'},
    localMode:{ru:'Устройство работает без общей базы: профили и задания хранятся только в этом браузере. Чтобы учитель и ученик видели друг друга с разных устройств, заполните ключи Supabase в assets/config.js.',
                en:'This device works without a shared database: profiles and assignments live in this browser only. To let a teacher and a student see each other from different devices, fill in the Supabase keys in assets/config.js.'},
    cloudMode:{ru:'Аккаунты общие: вы увидите свои задания с любого устройства.',
                en:'Accounts are shared: you will see your assignments from any device.'},
    needName:{ru:'Введите имя',en:'Enter your name'},
    needEmail:{ru:'Введите почту',en:'Enter your email'},
    needPass:{ru:'Пароль не короче 6 символов',en:'Password must be at least 6 characters'},
    checkMail:{ru:'Профиль создан. Подтвердите почту по письму от Supabase, потом войдите.',
                en:'Profile created. Confirm your email from the Supabase message, then sign in.'},
    welcome:{ru:'Здравствуйте, %1',en:'Welcome, %1'},
    emojiPick:{ru:'Значок профиля',en:'Profile badge'}
  });

  const EMOJI = ['🙂','🎓','👩‍🏫','👨‍🏫','📚','♞','🔭','🧪','✏️','🚀','🌟','🐣'];

  /* ---------- блок аккаунта в шапке ---------- */
  function renderSlot() {
    const slot = document.getElementById('accountSlot');
    if (!slot) return;
    const me = Sky.db.me();

    if (!me) {
      slot.innerHTML = `<button class="btn small" id="btnSignIn">${Sky.t('signIn')}</button>`;
      slot.querySelector('#btnSignIn').addEventListener('click', () => openAuth());
      return;
    }

    slot.innerHTML =
      `<button class="me" id="btnMe">
         <span class="who"><b>${esc(me.name || '')}</b><span>${Sky.t(me.role || 'student')}</span></span>
         ${Sky.avatar(me.name, '', me.emoji)}
       </button>`;
    slot.querySelector('#btnMe').addEventListener('click', openProfile);
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* ---------- окно входа ---------- */
  function openAuth(startMode) {
    let signup = startMode === 'signup';

    Sky.modal('', (box, close) => {
      const draw = () => {
        box.innerHTML = `
          <h2>${Sky.t(signup ? 'signUpT' : 'signInT')}</h2>
          <p class="lead" style="font-size:13px;margin-bottom:18px">
            ${Sky.t(Sky.db.isCloud() ? 'cloudMode' : 'localMode')}
          </p>
          <div class="list" id="quick"></div>
          <div class="field" style="margin-bottom:12px${signup ? '' : ';display:none'}">
            <label>${Sky.t('yourName')}</label>
            <input type="text" id="aName" autocomplete="name">
          </div>
          <div class="field" style="margin-bottom:12px${signup ? '' : ';display:none'}">
            <label>${Sky.t('iAm')}</label>
            <select id="aRole">
              <option value="student">${Sky.t('student')}</option>
              <option value="teacher">${Sky.t('teacher')}</option>
              <option value="parent">${Sky.t('parent')}</option>
            </select>
          </div>
          <div id="emojiRow" style="margin-bottom:14px${signup ? '' : ';display:none'}">
            <label style="font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:7px">${Sky.t('emojiPick')}</label>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="emojiPick"></div>
          </div>
          <div class="field" style="margin-bottom:12px">
            <label>${Sky.t('email')}</label>
            <input type="email" id="aMail" autocomplete="email">
          </div>
          <div class="field" style="margin-bottom:18px${Sky.db.isCloud() ? '' : ';display:none'}">
            <label>${Sky.t('pass')}</label>
            <input type="password" id="aPass" autocomplete="current-password">
          </div>
          <button class="btn full big" id="aGo">${Sky.t(signup ? 'createAcc' : 'signIn')}</button>
          <button class="btn ghost full" id="aSwap" style="margin-top:9px">
            ${Sky.t(signup ? 'haveAcc' : 'noAcc')}
          </button>`;

        /* значки на выбор */
        let picked = '🙂';
        const pickRow = box.querySelector('#emojiPick');
        if (pickRow) {
          EMOJI.forEach(e => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = e;
            b.style.cssText = 'width:38px;height:38px;font-size:19px;border:2px solid var(--line);border-radius:11px;background:var(--panel)';
            b.addEventListener('click', () => {
              picked = e;
              pickRow.querySelectorAll('button').forEach(x => x.style.borderColor = 'var(--line)');
              b.style.borderColor = 'var(--accent)';
            });
            pickRow.appendChild(b);
          });
          pickRow.firstChild.style.borderColor = 'var(--accent)';
        }

        /* быстрый вход по существующим профилям — только локально */
        if (!signup && !Sky.db.isCloud()) {
          Sky.db.list('profiles').then(rows => {
            const quick = box.querySelector('#quick');
            if (!quick || !rows.length) return;
            quick.innerHTML = `<div class="eyebrow" style="margin-bottom:4px">${Sky.t('quickIn')}</div>`;
            rows.forEach(p => {
              const el = document.createElement('button');
              el.className = 'item';
              el.style.cssText = 'width:100%;text-align:left;cursor:pointer';
              el.innerHTML = Sky.avatar(p.name, '', p.emoji) +
                `<div class="txt"><b>${esc(p.name)}</b><span>${Sky.t(p.role)}${p.demo ? ' · demo' : ''}</span></div>`;
              el.addEventListener('click', () => {
                Sky.db.becomeLocal(p.id);
                Sky.toast(Sky.t('welcome').replace('%1', p.name));
                close();
              });
              quick.appendChild(el);
            });
            quick.style.marginBottom = '18px';
          });
        }

        box.querySelector('#aSwap').addEventListener('click', () => { signup = !signup; draw(); });

        box.querySelector('#aGo').addEventListener('click', async () => {
          const name = (box.querySelector('#aName') || {}).value || '';
          const role = (box.querySelector('#aRole') || {}).value || 'student';
          const mail = box.querySelector('#aMail').value.trim();
          const pass = (box.querySelector('#aPass') || {}).value || '';

          if (signup && !name.trim()) return Sky.toast(Sky.t('needName'));
          if (!mail) return Sky.toast(Sky.t('needEmail'));
          if (Sky.db.isCloud() && pass.length < 6) return Sky.toast(Sky.t('needPass'));

          const btn = box.querySelector('#aGo');
          btn.disabled = true;
          btn.innerHTML = '<span class="spin"></span>';

          const res = signup
            ? await Sky.db.signUp(mail, pass, { name: name.trim(), role, emoji: picked })
            : await Sky.db.signIn(mail, pass);

          btn.disabled = false;
          if (res.error) { btn.textContent = Sky.t(signup ? 'createAcc' : 'signIn'); return Sky.toast(res.error); }
          if (res.needsConfirm) { close(); return Sky.toast(Sky.t('checkMail')); }
          close();
          Sky.toast(Sky.t('welcome').replace('%1', name || mail));
        });
      };
      draw();
    });
  }

  /* ---------- окно профиля ---------- */
  function openProfile() {
    const me = Sky.db.me();
    if (!me) return openAuth();
    Sky.modal(
      `<div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">
         ${Sky.avatar(me.name, 'lg', me.emoji)}
         <div>
           <h2 style="margin:0">${esc(me.name)}</h2>
           <span class="tag ${me.role === 'teacher' ? 'teach' : ''}">${Sky.t(me.role)}</span>
         </div>
       </div>
       <p class="lead" style="font-size:13px;margin-bottom:20px">
         ${Sky.t(Sky.db.isCloud() ? 'cloudMode' : 'localMode')}
       </p>
       <a class="btn ghost full" href="homework.html" style="margin-bottom:9px">${Sky.t('navHomework')}</a>
       <button class="btn danger full" id="pOut">${Sky.t('signOut')}</button>`,
      (box, close) => {
        box.querySelector('#pOut').addEventListener('click', async () => {
          await Sky.db.signOut();
          close();
        });
      }
    );
  }

  /* При смене входа перерисовываем всю шапку: вместе со слотом
     аккаунта меняется и состав меню. */
  document.addEventListener('authchange', () => Sky.renderHeader());
  document.addEventListener('headerready', renderSlot);
  document.addEventListener('langchange', renderSlot);
  Sky.db.ready.then(renderSlot);

  return { openAuth, openProfile, renderSlot, esc };
})();
