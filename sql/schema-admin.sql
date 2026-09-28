-- =====================================================================
-- SkyySchool — админ-панель (admin.html)
--
-- Запускать ПОСЛЕ sql/schema-tariffs.sql и sql/schema-text-check.sql.
-- Можно выполнять повторно.
--
-- КАК УСТРОЕН ДОСТУП
-- Страница админки — обычная страница сайта, ключей в ней нет. Она
-- входит обычным аккаунтом и вызывает функции admin_*. Каждая функция
-- сама проверяет, что вызвавший есть в app_admins, и только тогда
-- читает или меняет данные. Не админ получает ошибку 42501, даже если
-- вызовет функцию в обход страницы.
--
-- Назначить администратора (выполнить отдельно, подставив почту
-- подтверждённого аккаунта; в репозитории почту не храним):
--   insert into public.app_admins (user_id)
--   select id from auth.users
--    where lower(email) = lower('<почта>') and email_confirmed_at is not null
--   on conflict do nothing;
-- =====================================================================

begin;

create table if not exists public.app_admins (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- Политик нет намеренно: список админов меняется только из SQL-редактора.
revoke all on table public.app_admins from anon, authenticated;


create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;


-- ---------------------------------------------------------------------
-- Обзор: пользователи, тарифы, проверки и токены за сегодня, очередь
-- оплат и работ по ссылкам, по дням за 14 дней. Сутки — в поясе p_tz.
-- ---------------------------------------------------------------------
create or replace function public.admin_overview(p_tz text default 'UTC')
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tz    text := coalesce(nullif(p_tz, ''), 'UTC');
  v_today timestamptz;
  r       jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  v_today := date_trunc('day', now() at time zone v_tz) at time zone v_tz;

  select jsonb_build_object(
    'users_total', (select count(*) from auth.users),
    'users_7d',    (select count(*) from auth.users u where u.created_at > now() - interval '7 days'),
    'plans', coalesce((
       select jsonb_object_agg(t.plan, t.n) from (
         select up.plan, count(*) as n from public.user_plans up
          where up.expires_at is null or up.expires_at > now()
          group by up.plan) t), '{}'::jsonb),
    'checks_today', coalesce((
       select jsonb_object_agg(t.mode, t.n) from (
         select coalesce(c.mode, 'photo') as mode, count(*) as n from public.photo_checks c
          where c.created_at >= v_today
          group by 1) t), '{}'::jsonb),
    'tokens_today', (select coalesce(sum(c.tokens_used), 0) from public.photo_checks c where c.created_at >= v_today),
    'payments_pending',    (select count(*) from public.payments p where p.status = 'pending'),
    'submissions_pending', (select count(*) from public.homework_submissions s where s.status = 'pending'),
    'daily', coalesce((
       select jsonb_agg(d.row order by d.day) from (
         select (c.created_at at time zone v_tz)::date as day,
                jsonb_build_object(
                  'day',    (c.created_at at time zone v_tz)::date,
                  'photo',  count(*) filter (where coalesce(c.mode, 'photo') <> 'text'),
                  'text',   count(*) filter (where c.mode = 'text'),
                  'cached', count(*) filter (where c.mode = 'text' and c.result ->> 'cached' = 'true'),
                  'tokens', coalesce(sum(c.tokens_used), 0)) as row
           from public.photo_checks c
          where c.created_at > now() - interval '14 days'
          group by 1) d), '[]'::jsonb)
  ) into r;
  return r;
end $$;


-- ---------------------------------------------------------------------
-- Пользователи с тарифом и расходом
-- ---------------------------------------------------------------------
create or replace function public.admin_users(p_search text default null, p_limit int default 200)
returns table (
  id uuid, email text, name text, role text, created_at timestamptz, last_sign_in_at timestamptz,
  plan text, expires_at timestamptz, plan_active boolean, plagiarism boolean, admin boolean,
  checks_total bigint, checks_7d bigint, tokens_7d bigint, last_check_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  return query
  select u.id, u.email::text, p.name, p.role, u.created_at, u.last_sign_in_at,
         coalesce(up.plan, 'free'), up.expires_at,
         up.plan is not null and (up.expires_at is null or up.expires_at > now()),
         coalesce(up.plagiarism_enabled, false),
         exists (select 1 from public.app_admins a where a.user_id = u.id),
         (select count(*) from public.photo_checks c where c.user_id = u.id),
         (select count(*) from public.photo_checks c where c.user_id = u.id and c.created_at > now() - interval '7 days'),
         (select coalesce(sum(c.tokens_used), 0)::bigint from public.photo_checks c
           where c.user_id = u.id and c.created_at > now() - interval '7 days'),
         (select max(c.created_at) from public.photo_checks c where c.user_id = u.id)
    from auth.users u
    left join public.profiles   p  on p.id = u.id
    left join public.user_plans up on up.user_id = u.id
   where coalesce(p_search, '') = ''
      or u.email ilike '%' || p_search || '%'
      or p.name  ilike '%' || p_search || '%'
   order by u.created_at desc
   limit greatest(least(coalesce(p_limit, 200), 1000), 1);
end $$;


-- ---------------------------------------------------------------------
-- Выдать тариф. p_days = null — бессрочно; 'free' — без срока.
-- p_plagiarism = null — не менять докупленную проверку на списывание.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_plan(
  p_user uuid, p_plan text, p_days int default 30, p_plagiarism boolean default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plan_limits pl where pl.plan = p_plan) then
    raise exception 'unknown plan: %', p_plan using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 3660) then
    raise exception 'days must be from 1 to 3660' using errcode = '22023';
  end if;

  insert into public.user_plans (user_id, plan, expires_at, activated_at, updated_at, plagiarism_enabled)
  values (p_user, p_plan,
          case when p_plan = 'free' or p_days is null then null else now() + make_interval(days => p_days) end,
          now(), now(), coalesce(p_plagiarism, false))
  on conflict (user_id) do update set
    plan               = excluded.plan,
    expires_at         = excluded.expires_at,
    activated_at       = now(),
    updated_at         = now(),
    plagiarism_enabled = coalesce(p_plagiarism, public.user_plans.plagiarism_enabled);

  return (select to_jsonb(up) from public.user_plans up where up.user_id = p_user);
end $$;


-- ---------------------------------------------------------------------
-- Заявки на оплату и решение по ним
-- ---------------------------------------------------------------------
create or replace function public.admin_payments(p_status text default null, p_limit int default 200)
returns table (
  id uuid, created_at timestamptz, user_id uuid, email text,
  amount int, plan text, purpose text, status text
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  return query
  select p.id, p.created_at, p.user_id, u.email::text, p.amount, p.plan, p.purpose, p.status
    from public.payments p
    left join auth.users u on u.id = p.user_id
   where coalesce(p_status, '') = '' or p.status = p_status
   order by p.created_at desc
   limit greatest(least(coalesce(p_limit, 200), 1000), 1);
end $$;

-- Подтвердить: заявка «оплачена», тариф выдан на p_days дней (если тот
-- же тариф ещё действует — продлевается), проверка на списывание
-- включается. Отклонить: заявка «отклонена», тариф не трогаем.
create or replace function public.admin_payment_decide(p_id uuid, p_approve boolean, p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  select * into pay from public.payments p where p.id = p_id for update;
  if not found then
    raise exception 'payment not found' using errcode = '22023';
  end if;
  if pay.status is distinct from 'pending' then
    raise exception 'payment is already %', pay.status using errcode = '22023';
  end if;
  if not coalesce(p_approve, false) then
    update public.payments set status = 'rejected' where id = p_id;
    return jsonb_build_object('status', 'rejected');
  end if;
  if pay.user_id is null then
    raise exception 'payment has no user' using errcode = '22023';
  end if;
  if coalesce(p_days, 0) < 1 or p_days > 3660 then
    raise exception 'days must be from 1 to 3660' using errcode = '22023';
  end if;

  update public.payments set status = 'paid' where id = p_id;

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
  return jsonb_build_object('status', 'paid');
end $$;


-- ---------------------------------------------------------------------
-- Последние проверки (фото и текст)
-- ---------------------------------------------------------------------
create or replace function public.admin_checks(p_mode text default null, p_limit int default 200)
returns table (
  id uuid, created_at timestamptz, user_id uuid, email text, ip text, mode text,
  subject text, length text, grade int, tokens_used int, comment text, cached boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  return query
  select c.id, c.created_at, c.user_id, u.email::text, c.ip, coalesce(c.mode, 'photo'),
         c.subject, c.length, c.grade, c.tokens_used, left(c.ai_feedback, 300),
         coalesce(c.result ->> 'cached', 'false') = 'true'
    from public.photo_checks c
    left join auth.users u on u.id = c.user_id
   where coalesce(p_mode, '') = ''
      or (p_mode = 'text' and c.mode = 'text')
      or (p_mode = 'photo' and coalesce(c.mode, 'photo') <> 'text')
   order by c.created_at desc
   limit greatest(least(coalesce(p_limit, 200), 1000), 1);
end $$;


-- ---------------------------------------------------------------------
-- Поменять цену и лимиты тарифа. Меняются только перечисленные поля.
-- ---------------------------------------------------------------------
create or replace function public.admin_update_limits(p_plan text, p_patch jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text;
  allowed text[] := array[
    'title', 'price_rub', 'requests_per_window', 'window_seconds', 'photos_per_request',
    'text_requests_per_window', 'text_window_seconds',
    'feature_compare', 'feature_teacher', 'feature_plagiarism'];
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plan_limits pl where pl.plan = p_plan) then
    raise exception 'unknown plan: %', p_plan using errcode = '22023';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;
  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then
      raise exception 'field % cannot be changed here', k using errcode = '22023';
    end if;
  end loop;

  update public.plan_limits pl set
    title                    = coalesce(nullif(p_patch ->> 'title', ''), pl.title),
    price_rub                = coalesce((p_patch ->> 'price_rub')::int, pl.price_rub),
    requests_per_window      = coalesce((p_patch ->> 'requests_per_window')::int, pl.requests_per_window),
    window_seconds           = coalesce((p_patch ->> 'window_seconds')::int, pl.window_seconds),
    photos_per_request       = coalesce((p_patch ->> 'photos_per_request')::int, pl.photos_per_request),
    text_requests_per_window = coalesce((p_patch ->> 'text_requests_per_window')::int, pl.text_requests_per_window),
    text_window_seconds      = coalesce((p_patch ->> 'text_window_seconds')::int, pl.text_window_seconds),
    feature_compare          = coalesce((p_patch ->> 'feature_compare')::boolean, pl.feature_compare),
    feature_teacher          = coalesce((p_patch ->> 'feature_teacher')::boolean, pl.feature_teacher),
    feature_plagiarism       = coalesce((p_patch ->> 'feature_plagiarism')::boolean, pl.feature_plagiarism)
  where pl.plan = p_plan;

  if exists (select 1 from public.plan_limits pl where pl.plan = p_plan and (
       pl.price_rub < 0 or pl.requests_per_window < 1 or pl.window_seconds < 1 or pl.photos_per_request < 1
       or pl.text_requests_per_window < 1 or pl.text_window_seconds < 1)) then
    raise exception 'price must be >= 0, limits must be >= 1' using errcode = '22023';
  end if;

  return (select to_jsonb(pl) from public.plan_limits pl where pl.plan = p_plan);
end $$;


-- Вызывать может любой вошедший — проверка админа внутри функции.
-- Без входа (anon) — нельзя вовсе.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.is_admin()',
    'public.admin_overview(text)',
    'public.admin_users(text, integer)',
    'public.admin_set_plan(uuid, text, integer, boolean)',
    'public.admin_payments(text, integer)',
    'public.admin_payment_decide(uuid, boolean, integer)',
    'public.admin_checks(text, integer)',
    'public.admin_update_limits(text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end $$;

commit;
