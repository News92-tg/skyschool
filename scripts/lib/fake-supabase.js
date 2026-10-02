/* ============================================================
   Подменный Supabase для браузерных тестов страниц.

   В странице вместо supabase-js появляется клиент с тем же
   интерфейсом, который используют assets/db.js и страницы:
     auth: getSession, onAuthStateChange, signInWithPassword, signUp,
           signOut, resetPasswordForEmail, updateUser, signInWithOAuth
     from(table).select/insert/update/upsert/delete + eq, neq, in, gte,
           lte, gt, lt, is, order, limit, maybeSingle, single
     rpc(fn, args)
   Все вызовы уходят в Node (exposeBinding), где живут таблицы в
   памяти и обработчики RPC, заданные тестом. Так страница проходит
   настоящий путь через db.js, а тест видит каждый запрос.

   Использование:
     const fake = createBackend({ users: [...], tables: {...}, rpc: {...} });
     await fake.install(ctx, { session: 'u-teacher' });   // или null — не вошёл
     fake.calls  — все запросы; fake.tables — данные после действий.
   ============================================================ */
'use strict';

const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
let idSeq = 0;
const uuid = () => '00000000-0000-4000-8000-' + String(++idSeq).padStart(12, '0');

function createBackend(opts) {
  opts = opts || {};
  const users = (opts.users || []).map(u => Object.assign({ password: 'secret1' }, u));
  const tables = clone(opts.tables || {});
  const rpcs = opts.rpc || {};
  const calls = [];
  const state = { session: null, mail: [], passwordUpdates: [] };

  const table = name => (tables[name] = tables[name] || []);
  const userBy = id => users.find(u => u.id === id);

  function match(row, [op, k, v]) {
    const x = row[k];
    switch (op) {
      case 'eq': return x === v || (x != null && v != null && String(x) === String(v));
      case 'neq': return x !== v;
      case 'in': return v.includes(x);
      case 'gte': return x >= v;
      case 'lte': return x <= v;
      case 'gt': return x > v;
      case 'lt': return x < v;
      case 'is': return v === null ? x == null : x === v;
    }
    return true;
  }

  function query(m) {
    const rows = table(m.table);
    const where = r => m.filters.every(f => match(r, f));
    if (m.op === 'insert' || m.op === 'upsert') {
      /* guard — как RLS и триггеры базы: может отказать или дописать строку */
      if (opts.guard) { const err = opts.guard(m, state.session); if (err) return { data: null, error: err }; }
      const list = (Array.isArray(m.payload) ? m.payload : [m.payload]).map(r => Object.assign({ id: uuid(), created_at: new Date().toISOString() }, clone(r)));
      const out = [];
      for (const r of list) {
        const key = m.onConflict || 'id';
        const i = m.op === 'upsert' ? rows.findIndex(x => x[key] === r[key]) : -1;
        if (i >= 0) { rows[i] = Object.assign(rows[i], r); out.push(rows[i]); } else { rows.push(r); out.push(r); }
      }
      return { data: clone(out), error: null };
    }
    if (m.op === 'update') {
      if (opts.guard) { const err = opts.guard(m, state.session); if (err) return { data: null, error: err }; }
      const hit = rows.filter(where);
      hit.forEach(r => Object.assign(r, clone(m.payload)));
      return { data: clone(hit), error: null };
    }
    if (m.op === 'delete') {
      const keep = rows.filter(r => !where(r));
      const n = rows.length - keep.length;
      tables[m.table] = keep;
      return { data: null, error: null, count: n };
    }
    /* selectError — сбой чтения: вернуть ошибку, как Supabase при обрыве */
    if (opts.selectError) { const err = opts.selectError(m, state.session); if (err) return { data: null, error: err }; }
    let out = rows.filter(where);
    if (opts.visible) out = out.filter(r => opts.visible(m.table, r, state.session));
    if (m.order) {
      const [k, asc] = m.order;
      out = out.slice().sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1));
    }
    const count = out.length;
    if (m.limit != null) out = out.slice(0, m.limit);
    if (m.head) return { data: null, error: null, count };
    return { data: clone(out), error: null, count };
  }

  function auth(m) {
    const a = m.args || {};
    switch (m.op) {
      case 'getSession': {
        const u = state.session && userBy(state.session);
        return { data: { session: u ? { access_token: 'jwt-' + u.id, user: { id: u.id, email: u.email, user_metadata: {} } } : null } };
      }
      case 'signInWithPassword': {
        const u = users.find(x => x.email === a.email);
        if (!u || u.password !== a.password) return { data: {}, error: { message: 'Invalid login credentials', status: 400 } };
        if (u.unconfirmed) return { data: {}, error: { message: 'Email not confirmed', status: 400 } };
        state.session = u.id;
        return { data: { user: { id: u.id, email: u.email, user_metadata: {} }, session: { access_token: 'jwt-' + u.id } }, error: null };
      }
      case 'signUp': {
        if (users.some(x => x.email === a.email)) return { data: {}, error: { message: 'User already registered', status: 422 } };
        const meta = (a.options && a.options.data) || {};
        const u = { id: uuid(), email: a.email, password: a.password, unconfirmed: !!opts.confirmEmail };
        users.push(u);
        table('profiles').push({ id: u.id, email: u.email, name: meta.name || '', role: meta.role || 'student', emoji: meta.emoji || null, onboarding_done: false, subjects: null });
        if (opts.confirmEmail) return { data: { user: { id: u.id, email: u.email }, session: null }, error: null };
        state.session = u.id;
        return { data: { user: { id: u.id, email: u.email, user_metadata: {} }, session: { access_token: 'jwt-' + u.id } }, error: null };
      }
      case 'signOut': state.session = null; return { error: null };
      case 'resetPasswordForEmail':
        if (opts.mailWait) return { data: {}, error: { message: 'For security purposes, you can only request this after 42 seconds.', status: 429 } };
        state.mail.push({ email: a.email, redirectTo: a.options && a.options.redirectTo });
        return { data: {}, error: null };
      case 'updateUser': {
        if (!state.session) return { data: {}, error: { message: 'Auth session missing!', status: 401 } };
        state.passwordUpdates.push({ user: state.session, password: a.attrs && a.attrs.password });
        const u = userBy(state.session); if (u && a.attrs && a.attrs.password) u.password = a.attrs.password;
        return { data: { user: { id: state.session } }, error: null };
      }
      case 'signInWithOAuth': return { data: { url: 'https://accounts.google.test/?redirect=' + encodeURIComponent(a.options && a.options.redirectTo || '') }, error: null };
    }
    return { error: { message: 'unknown auth op ' + m.op } };
  }

  async function handle(src, m) {
    calls.push(m);
    if (m.kind === 'auth') return auth(m);
    if (m.kind === 'query') return query(m);
    if (m.kind === 'rpc') {
      const fn = rpcs[m.fn];
      if (!fn) return { data: null, error: { message: 'Could not find the function public.' + m.fn, code: 'PGRST202' } };
      try {
        const data = await fn(m.args || {}, state.session, { tables, table, users });
        return { data: clone(data), error: null };
      } catch (e) {
        return { data: null, error: { message: e.message, code: e.code || 'P0001' } };
      }
    }
    return { error: { message: 'unknown call' } };
  }

  async function install(ctx, o) {
    o = o || {};
    state.session = o.session === undefined ? null : o.session;
    await ctx.exposeBinding('__sb', handle);
    await ctx.addInitScript(pageClient, { recovery: !!o.recovery, providers: o.providers || {} });
  }

  return { install, calls, tables, users, state, handle };
}

/* ---------- то, что выполняется в странице ---------- */
function pageClient(cfg) {
  const call = m => window.__sb(m);
  const listeners = [];
  const emit = (event, session) => listeners.forEach(cb => { try { cb(event, session); } catch (e) {} });

  function Q(table, op, payload, extra) {
    const m = { kind: 'query', table, op, payload: payload === undefined ? null : payload, filters: [], order: null, limit: null, head: false, onConflict: extra && extra.onConflict };
    const run = () => call(m);
    const q = {
      select(cols, o) { if (o && o.head) m.head = true; return q; },
      eq(k, v) { m.filters.push(['eq', k, v]); return q; },
      neq(k, v) { m.filters.push(['neq', k, v]); return q; },
      in(k, v) { m.filters.push(['in', k, v]); return q; },
      gte(k, v) { m.filters.push(['gte', k, v]); return q; },
      lte(k, v) { m.filters.push(['lte', k, v]); return q; },
      gt(k, v) { m.filters.push(['gt', k, v]); return q; },
      lt(k, v) { m.filters.push(['lt', k, v]); return q; },
      is(k, v) { m.filters.push(['is', k, v]); return q; },
      order(k, o) { m.order = [k, !(o && o.ascending === false)]; return q; },
      limit(n) { m.limit = n; return q; },
      maybeSingle() { return run().then(r => ({ data: Array.isArray(r.data) ? (r.data[0] || null) : r.data, error: r.error })); },
      single() { return q.maybeSingle(); },
      then(res, rej) { return run().then(res, rej); }
    };
    return q;
  }

  /* /auth/v1/settings — какие входы включены */
  const realFetch = window.fetch;
  window.fetch = function (url, o) {
    if (typeof url === 'string' && /\/auth\/v1\/settings$/.test(url)) {
      return Promise.resolve(new Response(JSON.stringify({ external: cfg.providers || {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch.apply(this, arguments);
  };

  window.supabase = {
    createClient: () => ({
      auth: {
        getSession: () => call({ kind: 'auth', op: 'getSession' }),
        onAuthStateChange(cb) {
          listeners.push(cb);
          if (cfg.recovery) setTimeout(() => call({ kind: 'auth', op: 'getSession' }).then(r => emit('PASSWORD_RECOVERY', r.data.session)), 30);
          return { data: { subscription: { unsubscribe() {} } } };
        },
        async signInWithPassword(args) {
          const r = await call({ kind: 'auth', op: 'signInWithPassword', args });
          if (!r.error) emit('SIGNED_IN', r.data.session ? Object.assign({ user: r.data.user }, r.data.session) : null);
          return r;
        },
        async signUp(args) {
          const r = await call({ kind: 'auth', op: 'signUp', args });
          if (!r.error && r.data.session) emit('SIGNED_IN', Object.assign({ user: r.data.user }, r.data.session));
          return r;
        },
        async signOut() { const r = await call({ kind: 'auth', op: 'signOut' }); emit('SIGNED_OUT', null); return r; },
        resetPasswordForEmail: (email, options) => call({ kind: 'auth', op: 'resetPasswordForEmail', args: { email, options } }),
        updateUser: attrs => call({ kind: 'auth', op: 'updateUser', args: { attrs } }),
        async signInWithOAuth(args) { window.__oauth = args; return call({ kind: 'auth', op: 'signInWithOAuth', args }); }
      },
      from: table => ({
        select: (c, o) => Q(table, 'select').select(c, o),
        insert: p => Q(table, 'insert', p),
        upsert: (p, o) => Q(table, 'upsert', p, o),
        update: p => Q(table, 'update', p),
        delete: () => Q(table, 'delete')
      }),
      rpc: (fn, args) => call({ kind: 'rpc', fn, args: args || {} }),
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel() {}
    })
  };
}

module.exports = { createBackend };
