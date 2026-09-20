-- =====================================================================
-- SkyySchool — лимиты на разбор фото и тарифы
-- Запускать ПОСЛЕ sql/schema.sql и sql/schema-ai-teachers.sql
--
-- ЧЕМ ЭТА СХЕМА ОТЛИЧАЕТСЯ ОТ ПЕРВОНАЧАЛЬНОГО НАБРОСКА И ПОЧЕМУ
-- ---------------------------------------------------------------------
-- 1. У user_plans и payments ВКЛЮЧЕН RLS, и запись пользователю
--    запрещена полностью. В наброске RLS на этих таблицах не было.
--    Без него любой ученик с обычным анонимным ключом делает
--      PATCH /rest/v1/user_plans?user_id=eq.<свой id>  {"plan":"pro"}
--    и становится Pro бесплатно. Платный тариф, который пользователь
--    может выписать себе сам, — это не платный тариф.
--    То же с payments: иначе можно поставить себе status='paid'.
--
-- 2. Счётчик расхода вынесен в ОТДЕЛЬНУЮ таблицу photo_usage, а не
--    считается как «сколько строк в photo_checks за сегодня».
--    Причина: ученик должен иметь право удалить свои фото домашки —
--    это его работа и его данные. Но если лимит считать по строкам,
--    удаление истории обнуляет и расход, то есть лимит снимается
--    кнопкой «удалить». Разведение на две таблицы решает оба вопроса
--    сразу: историю можно чистить, квота остаётся.
--
-- 3. Проверка и списание идут ОДНОЙ транзакцией внутри функции
--    photo_try_consume(). Если читать счётчик, а потом писать его
--    отдельным запросом, два одновременных нажатия «разобрать» оба
--    увидят «использовано 2 из 3» и оба пройдут. На мобильном
--    интернете двойное нажатие — обычное дело.
--
-- 4. Пороги тарифов лежат в plan_limits, а не копиями в каждой строке
--    user_plans. Иначе изменение цены или лимита Basic требует
--    UPDATE по всем пользователям, и любой пропущенный остаётся со
--    старым лимитом навсегда. В user_plans остались необязательные
--    персональные переопределения — для подарочных и спорных случаев.
-- =====================================================================
 
begin;
 
-- ---------------------------------------------------------------------
-- Справочник тарифов
-- ---------------------------------------------------------------------
create table if not exists public.plan_limits (
  plan                 text primary key,
  title                text not null,
  price_rub            int  not null default 0,
  photo_limit_per_day  int  not null,
  rate_limit_seconds   int  not null,
  max_children         int  not null default 1,
  priority             boolean not null default false,
  sort_order           int  not null default 0
);
 
insert into public.plan_limits
  (plan,    title,    price_rub, photo_limit_per_day, rate_limit_seconds, max_children, priority, sort_order)
values
  ('free',   'Free',        0,   3,   180, 1, false, 0),
  ('basic',  'Basic',     299,  30,    60, 1, false, 1),
  ('pro',    'Pro',       799, 200,    30, 1, true,  2),
  ('family', 'Family',   1290, 500,    30, 3, true,  3)
on conflict (plan) do update set
  title = excluded.title,
  price_rub = excluded.price_rub,
  photo_limit_per_day = excluded.photo_limit_per_day,
  rate_limit_seconds = excluded.rate_limit_seconds,
  max_children = excluded.max_children,
  priority = excluded.priority,
  sort_order = excluded.sort_order;
 
-- ---------------------------------------------------------------------
-- Тариф пользователя
-- photo_limit_override / rate_limit_override — необязательные
-- персональные значения; когда null, берётся из plan_limits.
-- ---------------------------------------------------------------------
create table if not exists public.user_plans (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  plan                  text not null default 'free' references public.plan_limits(plan),
  photo_limit_override  int,
  rate_limit_override   int,
  expires_at            timestamptz,
  updated_at            timestamptz not null default now()
);
 
-- ---------------------------------------------------------------------
-- Расход квоты. Одна строка на пользователя и день.
-- last_at нужен для ограничения частоты: в наброске он назывался
-- last_check_at и жил в photo_checks, где такого столбца нет.
-- ---------------------------------------------------------------------
create table if not exists public.photo_usage (
  user_id  uuid not null references auth.users(id) on delete cascade,
  day      date not null default (now() at time zone 'utc')::date,
  used     int  not null default 0,
  last_at  timestamptz,
  primary key (user_id, day)
);
 
-- ---------------------------------------------------------------------
-- История разборов. Её пользователь может читать и удалять.
-- ---------------------------------------------------------------------
create table if not exists public.photo_checks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users(id) on delete cascade,
  subject          text,
  image_url        text,
  recognized_text  text,
  ai_feedback      text,
  grade            int,
  errors           jsonb,
  status           text default 'ok',
  created_at       timestamptz not null default now()
);
create index if not exists photo_checks_user_created_idx
  on public.photo_checks (user_id, created_at desc);
 
-- ---------------------------------------------------------------------
-- Платежи. Пишет только сервер, пользователь только читает свои.
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  amount       int,
  currency     text default 'RUB',
  method       text,
  status       text default 'pending',
  external_id  text,
  plan         text references public.plan_limits(plan),
  created_at   timestamptz not null default now()
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
 
 
-- =====================================================================
-- RLS
-- Общее правило: пользователь видит только своё и не пишет ничего,
-- кроме удаления собственной истории. Все записи делает Worker
-- сервисным ключом, который RLS не касается.
-- =====================================================================
 
alter table public.plan_limits  enable row level security;
alter table public.user_plans   enable row level security;
alter table public.photo_usage  enable row level security;
alter table public.photo_checks enable row level security;
alter table public.payments     enable row level security;
 
-- справочник тарифов виден всем: его показывает страница с ценами
drop policy if exists "plan limits are public" on public.plan_limits;
create policy "plan limits are public" on public.plan_limits
  for select using (true);
 
-- свой тариф — только чтение
drop policy if exists "users read own plan" on public.user_plans;
create policy "users read own plan" on public.user_plans
  for select using (auth.uid() = user_id);
 
-- свой расход — только чтение (чтобы интерфейс показал «2 из 3»)
drop policy if exists "users read own usage" on public.photo_usage;
create policy "users read own usage" on public.photo_usage
  for select using (auth.uid() = user_id);
 
-- своя история — чтение и удаление; вставка только сервером
drop policy if exists "users read own checks" on public.photo_checks;
create policy "users read own checks" on public.photo_checks
  for select using (auth.uid() = user_id);
 
drop policy if exists "users delete own checks" on public.photo_checks;
create policy "users delete own checks" on public.photo_checks
  for delete using (auth.uid() = user_id);
 
-- свои платежи — только чтение
drop policy if exists "users read own payments" on public.payments;
create policy "users read own payments" on public.payments
  for select using (auth.uid() = user_id);
 
-- Права на уровне таблиц. Намеренно НЕ выдаём insert/update на
-- user_plans, photo_usage и payments: политики выше и так их не
-- разрешают, но без гранта запрос отвалится раньше и понятнее.
grant usage on schema public to anon, authenticated;
grant select on table public.plan_limits  to anon, authenticated;
grant select on table public.user_plans   to authenticated;
grant select on table public.photo_usage  to authenticated;
grant select, delete on table public.photo_checks to authenticated;
grant select on table public.payments     to authenticated;
 
 
-- =====================================================================
-- Действующие лимиты пользователя
-- Просроченный тариф автоматически считается free: иначе платный
-- доступ пришлось бы гасить отдельной задачей по расписанию, и
-- забытая задача означала бы бесплатный Pro навсегда.
-- =====================================================================
create or replace function public.photo_effective_limits(p_user uuid)
returns table (
  plan text,
  photo_limit_per_day int,
  rate_limit_seconds int,
  priority boolean,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with up as (
    select * from public.user_plans where user_id = p_user
  ),
  chosen as (
    select
      case
        when up.plan is null then 'free'
        when up.expires_at is not null and up.expires_at < now() then 'free'
        else up.plan
      end as plan,
      up.photo_limit_override,
      up.rate_limit_override,
      up.expires_at
    from (select 1) dummy
    left join up on true
  )
  select
    c.plan,
    coalesce(c.photo_limit_override, pl.photo_limit_per_day),
    coalesce(c.rate_limit_override, pl.rate_limit_seconds),
    pl.priority,
    c.expires_at
  from chosen c
  join public.plan_limits pl on pl.plan = c.plan;
$$;
 
 
-- =====================================================================
-- Проверить и списать один разбор — атомарно.
--
-- Возвращает одну строку:
--   allowed    — можно ли разбирать
--   reason     — 'ok' | 'rate' | 'quota'
--   wait_sec   — сколько ждать при reason='rate'
--   used/limit — для надписи «2 из 3»
--   reset_at   — когда обновится суточная квота (полночь UTC)
--
-- Вызывать ТОЛЬКО сервисным ключом из Worker. Пользователю права на
-- эту функцию не выдаются: иначе он списывал бы чужие квоты, передав
-- чужой uuid.
-- =====================================================================
create or replace function public.photo_try_consume(p_user uuid)
returns table (
  allowed boolean,
  reason text,
  wait_sec int,
  used int,
  day_limit int,
  plan text,
  reset_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_limit int;
  v_rate int;
  v_today date := (now() at time zone 'utc')::date;
  v_used int := 0;
  v_last timestamptz;
  v_wait int := 0;
begin
  select l.plan, l.photo_limit_per_day, l.rate_limit_seconds
    into v_plan, v_limit, v_rate
    from public.photo_effective_limits(p_user) l;
 
  if v_plan is null then
    -- тарифа нет вообще (например, справочник не заполнен) — не пускаем,
    -- но и не притворяемся, что это лимит пользователя
    return query select false, 'noplan'::text, 0, 0, 0, 'free'::text,
                        ((v_today + 1)::timestamptz);
    return;
  end if;
 
  -- строка расхода за сегодня; блокируем её на время проверки, чтобы
  -- два одновременных запроса не прошли оба
  insert into public.photo_usage (user_id, day, used, last_at)
  values (p_user, v_today, 0, null)
  on conflict (user_id, day) do nothing;
 
  select u.used, u.last_at into v_used, v_last
    from public.photo_usage u
   where u.user_id = p_user and u.day = v_today
   for update;
 
  -- частота
  if v_last is not null and now() - v_last < make_interval(secs => v_rate) then
    v_wait := ceil(extract(epoch from (v_last + make_interval(secs => v_rate) - now())))::int;
    return query select false, 'rate'::text, greatest(v_wait, 1), v_used, v_limit, v_plan,
                        ((v_today + 1)::timestamptz);
    return;
  end if;
 
  -- суточная квота
  if v_used >= v_limit then
    return query select false, 'quota'::text, 0, v_used, v_limit, v_plan,
                        ((v_today + 1)::timestamptz);
    return;
  end if;
 
  -- Столбцы квалифицируем явно: имена выходных параметров функции
  -- (used, plan, reason…) совпадают с именами столбцов, и без
  -- префикса Postgres не знает, о чём речь.
  update public.photo_usage pu
     set used = pu.used + 1, last_at = now()
   where pu.user_id = p_user and pu.day = v_today
  returning pu.used into v_used;
 
  return query select true, 'ok'::text, 0, v_used, v_limit, v_plan,
                      ((v_today + 1)::timestamptz);
end;
$$;
 
-- Вернуть списанный разбор, если модель не ответила: иначе сбой на
-- стороне Gemini съедал бы квоту ученика, который ничего не получил.
create or replace function public.photo_refund(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.photo_usage pu
     set used = greatest(0, pu.used - 1)
   where pu.user_id = p_user
     and pu.day = (now() at time zone 'utc')::date;
$$;
 
-- ---------------------------------------------------------------------
-- Права на функции.
--
-- ВАЖНО: PostgreSQL по умолчанию выдаёт EXECUTE роли PUBLIC, а не
-- только anon/authenticated. Поэтому «revoke ... from anon,
-- authenticated» НИЧЕГО не закрывает — право остаётся через PUBLIC.
-- Проверено на живом Postgres: ученик спокойно вызывал
-- photo_try_consume с чужим uuid и списывал чужую квоту, попутно
-- читая чужой тариф из возвращённой строки. Снимать надо с PUBLIC.
-- ---------------------------------------------------------------------
revoke all on function public.photo_try_consume(uuid)        from public;
revoke all on function public.photo_refund(uuid)             from public;
revoke all on function public.photo_effective_limits(uuid)   from public;
 
-- Пользователю — отдельная функция без аргумента: она смотрит только
-- на auth.uid(), поэтому подставить чужой идентификатор нельзя даже
-- при желании. Нужна интерфейсу, чтобы показать «2 из 3».
create or replace function public.photo_my_limits()
returns table (
  plan text,
  photo_limit_per_day int,
  rate_limit_seconds int,
  priority boolean,
  expires_at timestamptz,
  used_today int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    l.plan, l.photo_limit_per_day, l.rate_limit_seconds, l.priority, l.expires_at,
    coalesce((
      select u.used from public.photo_usage u
       where u.user_id = auth.uid()
         and u.day = (now() at time zone 'utc')::date
    ), 0)
  from public.photo_effective_limits(auth.uid()) l
  where auth.uid() is not null;
$$;
 
revoke all on function public.photo_my_limits() from public;
grant execute on function public.photo_my_limits() to authenticated;
 
-- Снимаем и явные гранты, если они остались от прошлых прогонов:
-- revoke from public их не трогает.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.photo_try_consume(uuid)      from authenticated;
    revoke all on function public.photo_refund(uuid)           from authenticated;
    revoke all on function public.photo_effective_limits(uuid) from authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.photo_try_consume(uuid)      from anon;
    revoke all on function public.photo_refund(uuid)           from anon;
    revoke all on function public.photo_effective_limits(uuid) from anon;
  end if;
  -- service_role обходит RLS, но EXECUTE на функцию — обычный грант,
  -- и без него Worker получит «permission denied for function».
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.photo_try_consume(uuid)      to service_role;
    grant execute on function public.photo_refund(uuid)           to service_role;
    grant execute on function public.photo_effective_limits(uuid) to service_role;
    grant select, insert, update on table public.photo_usage  to service_role;
    grant select, insert, update on table public.user_plans   to service_role;
    grant select, insert, update on table public.payments     to service_role;
    grant select, insert on table public.photo_checks         to service_role;
  end if;
end $$;
 
commit;
 
-- =====================================================================
-- Что НЕ сделано намеренно
--
-- Family обещает «до 3 детей на аккаунте», но схемы связи родитель —
-- ребёнок в задании нет, и придумывать её наугад хуже, чем не делать:
-- от неё зависит, чью квоту тратит ребёнок, кто видит его оценки и
-- что происходит при отключении тарифа. В plan_limits.max_children
-- поле заведено, дальше нужен отдельный разговор.
-- =====================================================================
 
