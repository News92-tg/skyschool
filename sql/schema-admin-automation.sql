-- =====================================================================
-- SkyySchool — админка: тарифы, оплаты и подписки без ручного SQL
--
-- Запускать ПОСЛЕ sql/schema-admin.sql. Можно выполнять повторно.
-- (admin_set_plan и admin_payment_decide из schema-admin.sql здесь
-- переопределены — те же параметры, плюс запись в журнал. Если
-- schema-admin.sql запустили заново — запустите и этот файл.)
--
-- ЧТО ГДЕ. В ТЗ таблицы названы user_tariffs и pending_payments; в базе
-- они уже есть под другими именами, и дубликаты не заводим:
--   user_tariffs     → user_plans (plan, activated_at, expires_at)
--   pending_payments → payments   (status: pending → paid | rejected;
--                                  «confirmed» из ТЗ — это paid)
-- Новые таблицы:
--   audit_log     — журнал действий админов. RLS включён, политик нет:
--                   читать — только функцией admin_audit_log, писать —
--                   только функции admin_*.
--   user_telegram — chat_id для уведомлений. Не в profiles: profiles
--                   читают все (profiles_read = true), а chat_id — не
--                   для всех. RLS: каждый видит и меняет только свой.
--
-- Функции (все проверяют is_admin(), не админ получает 42501):
--   admin_grant_tariff(user_id, tariff, days)   — выдать тариф
--   admin_extend_tariff(user_id, days)          — продлить действующий
--   admin_revoke_tariff(user_id)                — снять (→ Бесплатный)
--   admin_bulk_grant(user_ids[], tariff, days)  — выдать сразу многим
--   admin_confirm_payment(payment_id, days)     — подтвердить оплату
--   admin_reject_payment(payment_id)            — отклонить
--   admin_user_list(...)                        — пользователи с фильтрами
--   admin_user_card(user_id)                    — карточка: тариф, оплаты, журнал
--   admin_payment_list(...)                     — оплаты с фильтрами
--   admin_subscriptions(limit)                  — платные тарифы и их сроки
--   admin_audit_log(limit, user_id)             — журнал
--   admin_set_telegram(user_id, chat_id)        — chat_id пользователю
-- Для Worker (только service_role):
--   sky_payment_info(payment_id)                — данные для уведомления
--   sky_is_admin(user_id)                       — админ ли тот, кто вызвал
--                                                 /api/notify-payment
--                                                 (вход проверен в Worker)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Журнал действий
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  target_user uuid references auth.users(id) on delete set null,
  payment_id  uuid,
  details     jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);
create index if not exists audit_log_target_idx  on public.audit_log (target_user, created_at desc);
alter table public.audit_log enable row level security;
-- Политик нет намеренно: прямого доступа ни у кого, только функции ниже.
revoke all on table public.audit_log from anon, authenticated;

create or replace function public._audit(p_action text, p_user uuid, p_payment uuid, p_details jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, target_user, payment_id, details)
  values (auth.uid(), p_action, p_user, p_payment, coalesce(p_details, '{}'::jsonb));
$$;

-- ---------------------------------------------------------------------
-- 2. Telegram пользователя
-- ---------------------------------------------------------------------
create table if not exists public.user_telegram (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  chat_id    text not null check (chat_id ~ '^-?[0-9]{3,20}$'),
  updated_at timestamptz not null default now()
);
alter table public.user_telegram enable row level security;

drop policy if exists "telegram: read own"   on public.user_telegram;
drop policy if exists "telegram: insert own" on public.user_telegram;
drop policy if exists "telegram: update own" on public.user_telegram;
drop policy if exists "telegram: delete own" on public.user_telegram;
create policy "telegram: read own"   on public.user_telegram for select to authenticated using ((select auth.uid()) = user_id);
create policy "telegram: insert own" on public.user_telegram for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "telegram: update own" on public.user_telegram for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "telegram: delete own" on public.user_telegram for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.user_telegram from anon;
grant select, insert, update, delete on table public.user_telegram to authenticated;

-- ---------------------------------------------------------------------
-- 3. Тарифы: выдать, продлить, снять, выдать многим
-- ---------------------------------------------------------------------
create or replace function public._require_admin()
returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
end $$;

-- Выдать тариф: новый срок от сегодня. p_days = null — бессрочно;
-- 'free' — без срока. Докупленная проверка на списывание не меняется.
create or replace function public.admin_grant_tariff(p_user uuid, p_tariff text, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  old public.user_plans%rowtype;
  r   jsonb;
begin
  perform public._require_admin();
  if not exists (select 1 from public.plan_limits pl where pl.plan = p_tariff) then
    raise exception 'unknown plan: %', p_tariff using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3660) then
    raise exception 'days must be from 1 to 3660' using errcode = '22023';
  end if;
  select * into old from public.user_plans up where up.user_id = p_user;

  insert into public.user_plans (user_id, plan, expires_at, activated_at, updated_at, plagiarism_enabled)
  values (p_user, p_tariff,
          case when p_tariff = 'free' or p_days is null then null else now() + make_interval(days => p_days) end,
          now(), now(), false)
  on conflict (user_id) do update set
    plan         = excluded.plan,
    expires_at   = excluded.expires_at,
    activated_at = now(),
    updated_at   = now();

  select to_jsonb(up) into r from public.user_plans up where up.user_id = p_user;
  perform public._audit('grant_tariff', p_user, null, jsonb_build_object(
    'plan', p_tariff, 'days', p_days, 'expires_at', r ->> 'expires_at',
    'prev_plan', old.plan, 'prev_expires_at', old.expires_at));
  return r;
end $$;

-- Продлить: к сроку прибавляется p_days (истёкший — считается от
-- сегодня). Бессрочный и Бесплатный продлевать нечего — ошибка.
create or replace function public.admin_extend_tariff(p_user uuid, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  old public.user_plans%rowtype;
  r   jsonb;
begin
  perform public._require_admin();
  if coalesce(p_days, 0) < 1 or p_days > 3660 then
    raise exception 'days must be from 1 to 3660' using errcode = '22023';
  end if;
  select * into old from public.user_plans up where up.user_id = p_user for update;
  if not found or old.plan = 'free' then
    raise exception 'no paid plan to extend' using errcode = '22023';
  end if;
  if old.expires_at is null then
    raise exception 'plan has no end date' using errcode = '22023';
  end if;

  update public.user_plans set
    expires_at = greatest(old.expires_at, now()) + make_interval(days => p_days),
    updated_at = now()
  where user_id = p_user;

  select to_jsonb(up) into r from public.user_plans up where up.user_id = p_user;
  perform public._audit('extend_tariff', p_user, null, jsonb_build_object(
    'plan', old.plan, 'days', p_days, 'prev_expires_at', old.expires_at, 'expires_at', r ->> 'expires_at'));
  return r;
end $$;

-- Снять тариф: Бесплатный без срока. Проверка на списывание — отдельная
-- покупка, её не трогаем.
create or replace function public.admin_revoke_tariff(p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  old public.user_plans%rowtype;
  r   jsonb;
begin
  perform public._require_admin();
  select * into old from public.user_plans up where up.user_id = p_user for update;
  if not found then
    raise exception 'user has no plan' using errcode = '22023';
  end if;
  update public.user_plans set plan = 'free', expires_at = null, updated_at = now() where user_id = p_user;
  select to_jsonb(up) into r from public.user_plans up where up.user_id = p_user;
  perform public._audit('revoke_tariff', p_user, null, jsonb_build_object(
    'prev_plan', old.plan, 'prev_expires_at', old.expires_at));
  return r;
end $$;

create or replace function public.admin_bulk_grant(p_users uuid[], p_tariff text, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid;
  n int := 0;
begin
  perform public._require_admin();
  if coalesce(array_length(p_users, 1), 0) = 0 then
    raise exception 'no users' using errcode = '22023';
  end if;
  if array_length(p_users, 1) > 500 then
    raise exception 'at most 500 users at once' using errcode = '22023';
  end if;
  foreach u in array (select array_agg(distinct x) from unnest(p_users) x) loop
    perform public.admin_grant_tariff(u, p_tariff, p_days);
    n := n + 1;
  end loop;
  perform public._audit('bulk_grant', null, null, jsonb_build_object('plan', p_tariff, 'days', p_days, 'count', n));
  return jsonb_build_object('count', n);
end $$;

-- Старая функция выдачи (страница до этой версии) — те же параметры,
-- теперь с журналом.
create or replace function public.admin_set_plan(
  p_user uuid, p_plan text, p_days int default 30, p_plagiarism boolean default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  r := public.admin_grant_tariff(p_user, p_plan, p_days);
  if p_plagiarism is not null then
    update public.user_plans set plagiarism_enabled = p_plagiarism, updated_at = now() where user_id = p_user;
    perform public._audit('set_plagiarism', p_user, null, jsonb_build_object('on', p_plagiarism));
    select to_jsonb(up) into r from public.user_plans up where up.user_id = p_user;
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- 4. Оплаты: подтвердить и отклонить
-- ---------------------------------------------------------------------
-- Подтвердить: заявка → paid, тариф выдаётся на p_days (действующий
-- такой же — продлевается), покупка проверки на списывание — включается.
create or replace function public.admin_confirm_payment(p_payment_id uuid, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
  r   jsonb;
begin
  perform public._require_admin();
  select * into pay from public.payments p where p.id = p_payment_id for update;
  if not found then
    raise exception 'payment not found' using errcode = '22023';
  end if;
  if pay.status is distinct from 'pending' then
    raise exception 'payment is already %', pay.status using errcode = '22023';
  end if;
  if pay.user_id is null then
    raise exception 'payment has no user' using errcode = '22023';
  end if;
  if coalesce(p_days, 0) < 1 or p_days > 3660 then
    raise exception 'days must be from 1 to 3660' using errcode = '22023';
  end if;

  update public.payments set status = 'paid' where id = p_payment_id;

  if pay.purpose = 'plagiarism' then
    insert into public.user_plans (user_id, plan, plagiarism_enabled)
    values (pay.user_id, 'free', true)
    on conflict (user_id) do update set plagiarism_enabled = true, updated_at = now();
  elsif pay.plan is not null then
    insert into public.user_plans (user_id, plan, expires_at, activated_at, updated_at)
    values (pay.user_id, pay.plan, now() + make_interval(days => p_days), now(), now())
    on conflict (user_id) do update set
      plan         = excluded.plan,
      expires_at   = case when public.user_plans.plan = excluded.plan
                               and public.user_plans.expires_at > now()
                          then public.user_plans.expires_at + make_interval(days => p_days)
                          else excluded.expires_at end,
      activated_at = now(),
      updated_at   = now();
  end if;

  select to_jsonb(up) into r from public.user_plans up where up.user_id = pay.user_id;
  perform public._audit('confirm_payment', pay.user_id, p_payment_id, jsonb_build_object(
    'amount', pay.amount, 'plan', pay.plan, 'purpose', pay.purpose, 'days', p_days, 'expires_at', r ->> 'expires_at'));
  return jsonb_build_object('status', 'paid', 'user_id', pay.user_id, 'plan', r);
end $$;

create or replace function public.admin_reject_payment(p_payment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
begin
  perform public._require_admin();
  select * into pay from public.payments p where p.id = p_payment_id for update;
  if not found then
    raise exception 'payment not found' using errcode = '22023';
  end if;
  if pay.status is distinct from 'pending' then
    raise exception 'payment is already %', pay.status using errcode = '22023';
  end if;
  update public.payments set status = 'rejected' where id = p_payment_id;
  perform public._audit('reject_payment', pay.user_id, p_payment_id, jsonb_build_object(
    'amount', pay.amount, 'plan', pay.plan, 'purpose', pay.purpose));
  return jsonb_build_object('status', 'rejected', 'user_id', pay.user_id);
end $$;

-- Старая функция решения по заявке — те же параметры, с журналом.
create or replace function public.admin_payment_decide(p_id uuid, p_approve boolean, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_approve, false) then
    return (public.admin_confirm_payment(p_id, p_days)) - 'plan' - 'user_id';
  end if;
  return (public.admin_reject_payment(p_id)) - 'user_id';
end $$;

-- Цены и лимиты (admin_update_limits из schema-admin.sql): в журнал —
-- триггером, что было и что стало.
create or replace function public._audit_plan_limits()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  diff jsonb := '{}'::jsonb;
  k    text;
begin
  for k in select jsonb_object_keys(to_jsonb(new)) loop
    if to_jsonb(new) -> k is distinct from to_jsonb(old) -> k then
      diff := diff || jsonb_build_object(k, jsonb_build_array(to_jsonb(old) -> k, to_jsonb(new) -> k));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    perform public._audit('update_limits', null, null, jsonb_build_object('plan', new.plan, 'changes', diff));
  end if;
  return new;
end $$;
drop trigger if exists plan_limits_audit on public.plan_limits;
create trigger plan_limits_audit after update on public.plan_limits
  for each row execute function public._audit_plan_limits();

-- ---------------------------------------------------------------------
-- 5. Списки для админки
-- ---------------------------------------------------------------------
-- Пользователи с фильтрами. p_plan: '' — все, 'free' — без действующего
-- тарифа, 'expired' — тариф истёк, иначе — действующий этот тариф.
-- Регистрация — с p_since по p_until включительно (даты).
-- (drop: при повторном запуске набор столбцов мог быть другим)
drop function if exists public.admin_user_list(text, text, date, date, integer);
create or replace function public.admin_user_list(
  p_search text default null, p_plan text default null,
  p_since date default null, p_until date default null, p_limit int default 200
)
returns table (
  id uuid, email text, name text, role text, created_at timestamptz, last_sign_in_at timestamptz,
  plan text, activated_at timestamptz, expires_at timestamptz, plan_active boolean, plagiarism boolean,
  admin boolean, telegram boolean, checks_total bigint, checks_7d bigint, tokens_7d bigint, last_check_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  with x as (
    select u.id, u.email::text as email, p.name, p.role, u.created_at, u.last_sign_in_at,
           coalesce(up.plan, 'free') as plan, up.activated_at, up.expires_at,
           (up.plan is not null and up.plan <> 'free' and (up.expires_at is null or up.expires_at > now())) as active,
           coalesce(up.plagiarism_enabled, false) as plag
      from auth.users u
      left join public.profiles   p  on p.id = u.id
      left join public.user_plans up on up.user_id = u.id
  )
  select x.id, x.email, x.name, x.role, x.created_at, x.last_sign_in_at,
         x.plan, x.activated_at, x.expires_at, x.active, x.plag,
         exists (select 1 from public.app_admins a where a.user_id = x.id),
         exists (select 1 from public.user_telegram t where t.user_id = x.id),
         (select count(*) from public.photo_checks c where c.user_id = x.id),
         (select count(*) from public.photo_checks c where c.user_id = x.id and c.created_at > now() - interval '7 days'),
         (select coalesce(sum(c.tokens_used), 0)::bigint from public.photo_checks c
           where c.user_id = x.id and c.created_at > now() - interval '7 days'),
         (select max(c.created_at) from public.photo_checks c where c.user_id = x.id)
    from x
   where (coalesce(p_search, '') = '' or x.email ilike '%' || p_search || '%' or x.name ilike '%' || p_search || '%')
     and (coalesce(p_plan, '') = ''
          or (p_plan = 'free'    and not x.active)
          or (p_plan = 'expired' and x.plan <> 'free' and x.expires_at is not null and x.expires_at <= now())
          or (x.active and x.plan = p_plan))
     and (p_since is null or x.created_at >= p_since::timestamptz)
     and (p_until is null or x.created_at <  (p_until + 1)::timestamptz)
   order by x.created_at desc
   limit greatest(least(coalesce(p_limit, 200), 1000), 1);
end $$;

-- Карточка пользователя: тариф, Telegram, оплаты, последние записи журнала.
create or replace function public.admin_user_card(p_user uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  perform public._require_admin();
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'name', p.name, 'role', p.role,
    'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'admin', exists (select 1 from public.app_admins a where a.user_id = u.id),
    'plan', coalesce(up.plan, 'free'), 'activated_at', up.activated_at, 'expires_at', up.expires_at,
    'plan_active', up.plan is not null and up.plan <> 'free' and (up.expires_at is null or up.expires_at > now()),
    'plagiarism', coalesce(up.plagiarism_enabled, false),
    'telegram_chat_id', (select t.chat_id from public.user_telegram t where t.user_id = u.id),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', pm.id, 'created_at', pm.created_at, 'amount', pm.amount, 'plan', pm.plan,
        'purpose', pm.purpose, 'status', pm.status) order by pm.created_at desc)
       from public.payments pm where pm.user_id = u.id), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(a.row order by a.created_at desc) from (
        select l.created_at, jsonb_build_object('created_at', l.created_at, 'action', l.action,
                 'actor', (select au.email from auth.users au where au.id = l.actor_id), 'details', l.details) as row
          from public.audit_log l where l.target_user = u.id
         order by l.created_at desc limit 20) a), '[]'::jsonb),
    'checks_total', (select count(*) from public.photo_checks c where c.user_id = u.id)
  ) into r
  from auth.users u
  left join public.profiles   p  on p.id = u.id
  left join public.user_plans up on up.user_id = u.id
  where u.id = p_user;
  return r;
end $$;

-- Оплаты с фильтрами: статус, даты (включительно), почта.
create or replace function public.admin_payment_list(
  p_status text default null, p_since date default null, p_until date default null,
  p_search text default null, p_limit int default 200
)
returns table (
  id uuid, created_at timestamptz, user_id uuid, email text,
  amount int, plan text, purpose text, status text, telegram boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  select p.id, p.created_at, p.user_id, u.email::text, p.amount, p.plan, p.purpose, p.status,
         exists (select 1 from public.user_telegram t where t.user_id = p.user_id)
    from public.payments p
    left join auth.users u on u.id = p.user_id
   where (coalesce(p_status, '') = '' or p.status = p_status)
     and (p_since is null or p.created_at >= p_since::timestamptz)
     and (p_until is null or p.created_at <  (p_until + 1)::timestamptz)
     and (coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%')
   order by p.created_at desc
   limit greatest(least(coalesce(p_limit, 200), 1000), 1);
end $$;

-- Подписки: все, у кого не Бесплатный. state: forever — без срока,
-- expiring — кончается в ближайшие 7 дней, active — позже, expired — истёк.
create or replace function public.admin_subscriptions(p_limit int default 500)
returns table (
  user_id uuid, email text, name text, plan text, activated_at timestamptz,
  expires_at timestamptz, days_left int, state text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  select up.user_id, u.email::text, p.name, up.plan, up.activated_at, up.expires_at,
         case when up.expires_at is null then null
              else ceil(extract(epoch from (up.expires_at - now())) / 86400)::int end,
         case when up.expires_at is null then 'forever'
              when up.expires_at <= now() then 'expired'
              when up.expires_at <= now() + interval '7 days' then 'expiring'
              else 'active' end
    from public.user_plans up
    join auth.users u on u.id = up.user_id
    left join public.profiles p on p.id = up.user_id
   where up.plan <> 'free'
   order by up.expires_at nulls last
   limit greatest(least(coalesce(p_limit, 500), 2000), 1);
end $$;

create or replace function public.admin_audit_log(p_limit int default 200, p_user uuid default null)
returns table (
  id bigint, created_at timestamptz, action text, actor_email text,
  target_user uuid, target_email text, payment_id uuid, details jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return query
  select l.id, l.created_at, l.action, a.email::text, l.target_user, t.email::text, l.payment_id, l.details
    from public.audit_log l
    left join auth.users a on a.id = l.actor_id
    left join auth.users t on t.id = l.target_user
   where p_user is null or l.target_user = p_user
   order by l.created_at desc, l.id desc
   limit greatest(least(coalesce(p_limit, 200), 1000), 1);
end $$;

-- chat_id пользователю (например, он прислал его в поддержку). Пусто —
-- убрать.
create or replace function public.admin_set_telegram(p_user uuid, p_chat_id text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v text := nullif(btrim(coalesce(p_chat_id, '')), '');
begin
  perform public._require_admin();
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;
  if v is null then
    delete from public.user_telegram where user_id = p_user;
  else
    if v !~ '^-?[0-9]{3,20}$' then
      raise exception 'chat_id must be digits' using errcode = '22023';
    end if;
    insert into public.user_telegram (user_id, chat_id, updated_at) values (p_user, v, now())
    on conflict (user_id) do update set chat_id = excluded.chat_id, updated_at = now();
  end if;
  perform public._audit('set_telegram', p_user, null, jsonb_build_object('set', v is not null));
  return jsonb_build_object('telegram_chat_id', v);
end $$;

-- ---------------------------------------------------------------------
-- 6. Для Worker: данные для уведомления об оплате (только service_role)
-- ---------------------------------------------------------------------
create or replace function public.sky_payment_info(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'status', p.status, 'amount', p.amount, 'plan', p.plan, 'purpose', p.purpose,
    'created_at', p.created_at, 'user_id', p.user_id, 'email', u.email,
    'plan_title', (select pl.title from public.plan_limits pl where pl.plan = p.plan),
    'expires_at', (select up.expires_at from public.user_plans up where up.user_id = p.user_id),
    'chat_id', (select t.chat_id from public.user_telegram t where t.user_id = p.user_id))
  from public.payments p
  left join auth.users u on u.id = p.user_id
  where p.id = p_id;
$$;

-- Админ ли пользователь — для Worker, который уже проверил его вход
-- (JWT) в Supabase Auth. У service_role нет доступа к app_admins и
-- is_admin() (та смотрит на auth.uid() вызвавшего), поэтому отдельная
-- функция и только для него.
create or replace function public.sky_is_admin(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (select 1 from public.app_admins a where a.user_id = p_user);
$$;

-- ---------------------------------------------------------------------
-- 7. Права
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  -- служебные: никому напрямую
  foreach f in array array[
    'public._audit(text, uuid, uuid, jsonb)',
    'public._require_admin()',
    'public._audit_plan_limits()'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', f);
    end if;
  end loop;

  -- admin_*: любой вошедший, проверка админа внутри
  foreach f in array array[
    'public.admin_grant_tariff(uuid, text, integer)',
    'public.admin_extend_tariff(uuid, integer)',
    'public.admin_revoke_tariff(uuid)',
    'public.admin_bulk_grant(uuid[], text, integer)',
    'public.admin_set_plan(uuid, text, integer, boolean)',
    'public.admin_confirm_payment(uuid, integer)',
    'public.admin_reject_payment(uuid)',
    'public.admin_payment_decide(uuid, boolean, integer)',
    'public.admin_user_list(text, text, date, date, integer)',
    'public.admin_user_card(uuid)',
    'public.admin_payment_list(text, date, date, text, integer)',
    'public.admin_subscriptions(integer)',
    'public.admin_audit_log(integer, uuid)',
    'public.admin_set_telegram(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;

  -- для Worker
  foreach f in array array['public.sky_payment_info(uuid)', 'public.sky_is_admin(uuid)'] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke all on function %s from authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

commit;

-- Проверка после выполнения:
--   select * from admin_subscriptions();          -- под админом
--   select * from admin_audit_log(20);
