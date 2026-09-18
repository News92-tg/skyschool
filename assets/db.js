/* ============================================================
   SkyySchool — данные и аккаунты

   Работает в двух режимах и сам выбирает нужный:

   • «облако» — если в config.js заполнены SUPABASE_URL и ANON_KEY.
     Настоящие аккаунты, данные видны с любого устройства.

   • «локально» — пока ключи не заполнены. Всё лежит в этом браузере.
     Сайт полностью рабочий, просто учитель и ученик должны быть
     за одним устройством.

   Вызовы одинаковые в обоих режимах, поэтому страницы про режим ничего
   не знают: заполнили ключи — сайт стал сетевым, ничего не переписывая.
   ============================================================ */
'use strict';

Sky.db = (function () {

  const CFG = window.SKY_CONFIG || {};
  const hasCloud = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  let sb = null;
  let profile = null;
  let mode = hasCloud ? 'cloud' : 'local';
  let readyResolve;
  const ready = new Promise(r => { readyResolve = r; });

  const TABLES = ['profiles','links','homework','submissions','messages','chess_tasks','chess_games',
                  'teachers_ai','teacher_reviews','photo_checks','chess_sessions','task_attempts','chess_custom_tasks'];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('script'));
      document.head.appendChild(s);
    });
  }

  async function initCloud() {
    try {
      if (!window.supabase) {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js');
      }
      sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
      const { data } = await sb.auth.getSession();
      if (data && data.session) await loadProfile(data.session.user);
      sb.auth.onAuthStateChange(async (_e, session) => {
        if (session) await loadProfile(session.user); else profile = null;
        document.dispatchEvent(new CustomEvent('authchange'));
      });
    } catch (e) {
      console.warn('[SkyySchool] Supabase недоступен, работаю локально:', e.message);
      mode = 'local';
      sb = null;
    }
  }

  async function loadProfile(user) {
    if (!sb || !user) { profile = null; return; }
    const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    profile = data || { id: user.id, email: user.email, name: (user.user_metadata && user.user_metadata.full_name) || user.email.split('@')[0], role: 'student' };
  }

  function localTable(name) { return Sky.get('tbl_' + name, []); }
  function saveTable(name, rows) {
    Sky.set('tbl_' + name, rows);
    document.dispatchEvent(new CustomEvent('dbchange', { detail: { table: name } }));
  }

  function seedLocal() { return; }
  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  async function list(table, filter) {
    if (mode === 'cloud' && sb) {
      let q = sb.from(table).select('*');
      for (const [k, v] of Object.entries(filter || {})) q = q.eq(k, v);
      const { data, error } = await q;
      if (error) { console.warn('[SkyySchool] чтение', table, error.message); return []; }
      return data || [];
    }
    let rows = localTable(table);
    for (const [k, v] of Object.entries(filter || {})) rows = rows.filter(r => r[k] === v);
    return rows;
  }

  async function insert(table, row) {
    const rec = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row);
    if (mode === 'cloud' && sb) {
      const { data, error } = await sb.from(table).insert(rec).select().maybeSingle();
      if (error) { Sky.toast(error.message); return null; }
      return data;
    }
    const rows = localTable(table);
    rows.push(rec);
    saveTable(table, rows);
    return rec;
  }

  async function update(table, id, patch) {
    if (mode === 'cloud' && sb) {
      const { data, error } = await sb.from(table).update(patch).eq('id', id).select().maybeSingle();
      if (error) { Sky.toast(error.message); return null; }
      return data;
    }
    const rows = localTable(table);
    const i = rows.findIndex(r => r.id === id);
    if (i < 0) return null;
    rows[i] = Object.assign({}, rows[i], patch);
    saveTable(table, rows);
    return rows[i];
  }

  async function remove(table, id) {
    if (mode === 'cloud' && sb) {
      const { error } = await sb.from(table).delete().eq('id', id);
      if (error) { Sky.toast(error.message); return false; }
      return true;
    }
    saveTable(table, localTable(table).filter(r => r.id !== id));
    return true;
  }

  /* ---------- файлы (Supabase Storage) ----------
     Нужны для фотографий домашки: строка разбора живёт в таблице, а
     сам снимок — в бакете.

     ПОЧЕМУ БАКЕТ ЗАКРЫТЫЙ И ССЫЛКИ ВРЕМЕННЫЕ. На фото детская тетрадь:
     имя на обложке, почерк, иногда фамилия класса. Публичный бакет
     отдаёт такой файл любому, кто знает или подберёт адрес, — а адрес
     угадывается легче, чем кажется. Поэтому бакет private, читаем
     через signedUrl на час, а правила доступа лежат в
     sql/schema-storage.sql: ученик видит только свою папку.

     Без облака (Supabase не настроен) сохранять некуда — возвращаем
     понятный отказ, а вызывающий код продолжает работать: разбор
     фотографии от этого не зависит. */
  async function upload(bucket, path, blob, opts) {
    if (mode !== 'cloud' || !sb) return { error: 'local' };
    const { data, error } = await sb.storage.from(bucket).upload(path, blob, {
      contentType: (opts && opts.contentType) || 'image/jpeg',
      upsert: false,
      cacheControl: '3600'
    });
    if (error) return { error: error.message };
    return { path: (data && data.path) || path };
  }

  async function signedUrl(bucket, path, seconds) {
    if (mode !== 'cloud' || !sb) return { error: 'local' };
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, seconds || 3600);
    if (error) return { error: error.message };
    return { url: data && data.signedUrl };
  }

  async function signUp(email, password, meta) {
    if (mode === 'cloud' && sb) {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: meta?.name || '',
            role: meta?.role || 'student',
            emoji: meta?.emoji || null
          }
        }
      });
      if (error) return { error: error.message };

      /* Профиль создаёт server-side trigger из auth metadata.
         Не делаем upsert из браузера: при включённом подтверждении почты
         у нового пользователя ещё нет JWT, поэтому RLS корректно
         запрещает клиентскую запись. */
      if (data.user && data.session) await loadProfile(data.user);
      return { ok: true, needsConfirm: !data.session };
    }

    const rec = { id: uid(), email, name: meta.name, role: meta.role, emoji: meta.emoji || null };
    const rows = localTable('profiles');
    rows.push(rec);
    saveTable('profiles', rows);
    profile = rec;
    Sky.set('me', rec.id);
    document.dispatchEvent(new CustomEvent('authchange'));
    return { ok: true };
  }

  async function signIn(email, password) {
    if (mode === 'cloud' && sb) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      await loadProfile(data.user);
      document.dispatchEvent(new CustomEvent('authchange'));
      return { ok: true };
    }
    const found = localTable('profiles').find(p => p.email === email);
    if (!found) return { error: Sky.lang === 'ru' ? 'Такого профиля нет на этом устройстве' : 'No such profile on this device' };
    profile = found;
    Sky.set('me', found.id);
    document.dispatchEvent(new CustomEvent('authchange'));
    return { ok: true };
  }

  async function signInGoogle() {
    if (mode !== 'cloud' || !sb) return { error: Sky.lang === 'ru' ? 'Сначала подключите Supabase в assets/config.js' : 'Connect Supabase in assets/config.js first' };
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
    if (error) return { error: error.message };
    return { ok: true, url: data?.url || null };
  }

  async function signOut() {
    if (mode === 'cloud' && sb) await sb.auth.signOut();
    profile = null;
    Sky.del('me');
    document.dispatchEvent(new CustomEvent('authchange'));
  }

  function becomeLocal(id) {
    const found = localTable('profiles').find(p => p.id === id);
    if (!found) return false;
    profile = found;
    Sky.set('me', id);
    document.dispatchEvent(new CustomEvent('authchange'));
    return true;
  }

  const me = () => profile;
  const isTeacher = () => !!profile && profile.role === 'teacher';
  const isStudent = () => !!profile && profile.role === 'student';

  function subscribe(table, cb) {
    if (mode === 'cloud' && sb) {
      const ch = sb.channel('rt-' + table + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table }, payload => cb(payload))
        .subscribe();
      return () => sb.removeChannel(ch);
    }
    const onStorage = e => { if (e.key === 'sky_tbl_' + table) cb({ table, local: true }); };
    const onLocal = e => { if (e.detail && e.detail.table === table) cb({ table, local: true }); };
    window.addEventListener('storage', onStorage);
    document.addEventListener('dbchange', onLocal);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('dbchange', onLocal);
    };
  }

  (async function boot() {
    if (hasCloud) await initCloud();
    if (mode === 'local') {
      seedLocal();
      const savedId = Sky.get('me');
      if (savedId) {
        const found = localTable('profiles').find(p => p.id === savedId);
        if (found) profile = found;
      }
    }
    readyResolve(mode);
    document.dispatchEvent(new CustomEvent('authchange'));
    document.dispatchEvent(new CustomEvent('dbready', { detail: { mode } }));
  })();

  return {
    ready, TABLES,
    get mode() { return mode; },
    isCloud: () => mode === 'cloud',
    list, insert, update, remove, subscribe,
    upload, signedUrl,
    signUp, signIn, signInGoogle, signOut, becomeLocal,
    me, isTeacher, isStudent,
    allProfiles: () => list('profiles'),
    uid
  };
})();
