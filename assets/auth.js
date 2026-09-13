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
    needName:{ru:'Введите имя',en:'Enter your name'},
    needEmail:{ru:'Введите почту',en:'Enter your email'},
    needPass:{ru:'Пароль не короче 6 символов',en:'Password must be at least 6 characters'},
    checkMail:{ru:'Профиль создан. Подтвердите почту, потом войдите.',en:'Profile created. Confirm your email, then sign in.'},
    welcome:{ru:'Здравствуйте, %1',en:'Welcome, %1'},
    emojiPick:{ru:'Значок профиля',en:'Profile badge'},
    googleBtn:{ru:'Войти через Google',en:'Sign in with Google'},
    googleSoon:{ru:'Google-вход доступен только после подключения Supabase и Google OAuth.',en:'Google sign-in requires Supabase and Google OAuth to be configured.'}
  });

  const EMOJI = ['🙂','🎓','👩‍🏫','👨‍🏫','📚','♞','🔭','🧪','✏️','🚀','🌟','🐣'];

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
      `<button class="me" id="btnMe"><span class="who"><b>${esc(me.name || '')}</b><span>${Sky.t(me.role || 'student')}</span></span>${Sky.avatar(me.name, '', me.emoji)}</button>`;
    slot.querySelector('#btnMe').addEventListener('click', openProfile);
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[c]));

  function openAuth(startMode) {
    let signup = startMode === 'signup';

    Sky.modal('', (box, close) => {
      const draw = () => {
        box.innerHTML = `
          <h2>${Sky.t(signup ? 'signUpT' : 'signInT')}</h2>
          <div class="field" style="margin-top:16px;margin-bottom:12px${signup ? '' : ';display:none'}"><label>${Sky.t('yourName')}</label><input type="text" id="aName" autocomplete="name"></div>
          <div class="field" style="margin-bottom:12px${signup ? '' : ';display:none'}"><label>${Sky.t('iAm')}</label><select id="aRole"><option value="student">${Sky.t('student')}</option><option value="teacher">${Sky.t('teacher')}</option><option value="parent">${Sky.t('parent')}</option></select></div>
          <div id="emojiRow" style="margin-bottom:14px${signup ? '' : ';display:none'}"><label style="font-size:11px;font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);display:block;margin-bottom:7px">${Sky.t('emojiPick')}</label><div style="display:flex;gap:6px;flex-wrap:wrap" id="emojiPick"></div></div>
          <div class="field" style="margin-bottom:12px"><label>${Sky.t('email')}</label><input type="email" id="aMail" autocomplete="email"></div>
          <div class="field" style="margin-bottom:18px${Sky.db.isCloud() ? '' : ';display:none'}"><label>${Sky.t('pass')}</label><input type="password" id="aPass" autocomplete="current-password"></div>
          <button class="btn full big" id="aGo">${Sky.t(signup ? 'createAcc' : 'signIn')}</button>
          <button class="btn ghost full" id="aGoogle" style="margin-top:9px;gap:9px"><svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>${Sky.t('googleBtn')}</button>
          <button class="btn ghost full" id="aSwap" style="margin-top:9px">${Sky.t(signup ? 'haveAcc' : 'noAcc')}</button>`;

        let picked = '🙂';
        const pickRow = box.querySelector('#emojiPick');
        if (pickRow) {
          EMOJI.forEach(e => {
            const b = document.createElement('button');
            b.type = 'button'; b.textContent = e;
            b.style.cssText = 'width:38px;height:38px;font-size:19px;border:2px solid var(--line);border-radius:11px;background:var(--panel)';
            b.addEventListener('click', () => { picked = e; pickRow.querySelectorAll('button').forEach(x => x.style.borderColor = 'var(--line)'); b.style.borderColor = 'var(--accent)'; });
            pickRow.appendChild(b);
          });
          if (pickRow.firstChild) pickRow.firstChild.style.borderColor = 'var(--accent)';
        }

        box.querySelector('#aSwap').addEventListener('click', () => { signup = !signup; draw(); });

        box.querySelector('#aGoogle').addEventListener('click', async () => {
          const res = await Sky.db.signInGoogle();
          if (res?.error) return Sky.toast(res.error);
        });

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

  function openProfile() {
    const me = Sky.db.me();
    if (!me) return openAuth();
    Sky.modal(`<div style="display:flex;gap:16px;align-items:center;margin-bottom:20px">${Sky.avatar(me.name, 'lg', me.emoji)}<div><h2 style="margin:0">${esc(me.name)}</h2><span class="tag ${me.role === 'teacher' ? 'teach' : ''}">${Sky.t(me.role)}</span></div></div><a class="btn ghost full" href="homework.html" style="margin-bottom:9px">${Sky.t('navHomework')}</a><button class="btn danger full" id="pOut">${Sky.t('signOut')}</button>`, (box, close) => { box.querySelector('#pOut').addEventListener('click', async () => { await Sky.db.signOut(); close(); }); });
  }

  document.addEventListener('authchange', () => Sky.renderHeader());
  document.addEventListener('headerready', renderSlot);
  document.addEventListener('langchange', renderSlot);
  Sky.db.ready.then(renderSlot);

  return { openAuth, openProfile, renderSlot, esc };
})();
