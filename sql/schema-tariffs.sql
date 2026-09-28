-- =====================================================================
-- SkyySchool — тарифы Бесплатный / Платный / Премиум, лимиты запросов,
-- история проверок, ДЗ по ссылкам.
--
-- Запускать ПОСЛЕ sql/schema-photo-limits.sql (на живой базе он уже
-- выполнен: plan_limits, user_plans, photo_checks, payments там есть).
-- Файл можно выполнять повторно: всё через if not exists / on conflict.
--
-- ЧТО ВЗЯТО ИЗ СУЩЕСТВУЮЩЕГО, А НЕ СОЗДАНО ЗАНОВО
-- ---------------------------------------------------------------------
-- В задании были таблицы user_tariffs, checks и pending_payments. В базе
-- уже есть их полные аналоги, и вторые копии разошлись бы с первыми:
--   user_tariffs      → user_plans   (+ plagiarism_enabled, activated_at)
--                       и справочник plan_limits (+ строки paid, premium)
--   checks            → photo_checks (+ ip, mode, length, result, tokens_used)
--   pending_payments  → payments     (+ purpose)
-- Новые таблицы — только те, которым аналога нет:
--   usage_limits          — окна запросов по пользователю ИЛИ по IP
--                           (photo_usage считает по дням и без IP)
--   homework_submissions  — работы, присланные по ссылке
--
-- ГДЕ ОТСТУПЛЕНО ОТ ЗАДАНИЯ И ПОЧЕМУ
-- ---------------------------------------------------------------------
-- 1. photo_checks: вставку клиенту НЕ открываем. Историю пишет Worker
--    сервисным ключом. Если разрешить insert own, ученик сможет вписать
--    себе в историю любую оценку, а её видят родители.
-- 2. payments: вставку клиенту тоже не открываем. Заявку на оплату
--    создаёт Worker (POST /api/payments) и сам ставит сумму по тарифу —
--    иначе клиент пришлёт amount = 1.
-- 3. homework_submissions: учитель видит работы, где teacher_id — он
--    сам, а не ВСЕ работы. Роль «учитель» выбирается при регистрации
--    самостоятельно, и «учитель видит всё» означало бы: любой, кто
--    назвался учителем, читает имена и работы всех детей. Работы по
--    ссылке учитель открывает через Worker (GET /api/homework/:id).
-- 4. Бакет homework остаётся ЗАКРЫТЫМ (см. schema-storage.sql: снимки
--    детских тетрадей с именами). Модели и учителю отдаются временные
--    подписанные ссылки — для Z.AI это такой же публичный URL, только
--    живёт час. Ничего в хранилище этот файл не меняет.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Тарифы: новые поля в справочнике и две новые строки
-- ---------------------------------------------------------------------
alter table public.plan_limits
  add column if not exists requests_per_window int,
  add column if not exists window_seconds      int,
  add column if not exists photos_per_request  int,
  add column if not exists feature_compare     boolean not null default false,
  add column if not exists feature_teacher     boolean not null default false,
  add column if not exists feature_plagiarism  boolean not null default false;

-- photo_limit_per_day и rate_limit_seconds обязательны в старой схеме;
-- для новых тарифов это потолок в сутки при непрерывной работе.
insert into public.plan_limits
  (plan, title, price_rub, photo_limit_per_day, rate_limit_seconds, sort_order,
   requests_per_window, window_seconds, photos_per_request,
   feature_compare, feature_teacher, feature_plagiarism)
values
  ('paid',    'Платный', 59,  1440, 60, 10, 1, 60, 10, true, false, false),
  ('premium', 'Премиум', 209, 4320, 20, 11, 3, 60, 20, true, true,  true)
on conflict (plan) do update set
  title               = excluded.title,
  price_rub           = excluded.price_rub,
  requests_per_window = excluded.requests_per_window,
  window_seconds      = excluded.window_seconds,
  photos_per_request  = excluded.photos_per_request,
  feature_compare     = excluded.feature_compare,
  feature_teacher     = excluded.feature_teacher,
  feature_plagiarism  = excluded.feature_plagiarism;

-- Бесплатный: 1 запрос за 10 минут, до 5 фото. Старые поля не трогаем.
update public.plan_limits
   set requests_per_window = 1, window_seconds = 600, photos_per_request = 5,
       feature_compare = false, feature_teacher = false, feature_plagiarism = false
 where plan = 'free';

-- Старые тарифы basic / pro / family продаваться не будут, но если у
-- кого-то они уже записаны, человек не должен остаться без лимитов.
update public.plan_limits
   set requests_per_window = 1, window_seconds = 60, photos_per_request = 10,
       feature_compare = true
 where plan = 'basic' and requests_per_window is null;
update public.plan_limits
   set requests_per_window = 3, window_seconds = 60, photos_per_request = 20,
       feature_compare = true, feature_teacher = true, feature_plagiarism = true
 where plan in ('pro', 'family') and requests_per_window is null;

-- Проверка на списывание покупается и отдельно от тарифа (+40 ₽).
alter table public.user_plans
  add column if not exists plagiarism_enabled boolean not null default false,
  add column if not exists activated_at       timestamptz not null default now();


-- ---------------------------------------------------------------------
-- 2. Окна запросов. Ключ — пользователь, а без входа — IP.
-- scope разводит проверки и отправку работ по ссылке: иначе ученик,
-- отправивший работу учителю, терял бы свою бесплатную проверку.
-- ---------------------------------------------------------------------
create table if not exists public.usage_limits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  ip              text,
  scope           text not null default 'check',
  window_start    timestamptz not null default now(),
  requests_count  int not null default 0,
  tokens_used     bigint not null default 0
);
create index if not exists usage_limits_user_idx on public.usage_limits (user_id, scope, window_start desc);
create index if not exists usage_limits_ip_idx   on public.usage_limits (ip, scope, window_start desc);


-- ---------------------------------------------------------------------
-- 3. История проверок: поля нового API
-- ---------------------------------------------------------------------
alter table public.photo_checks
  add column if not exists ip          text,
  add column if not exists mode        text,
  add column if not exists length      text,
  add column if not exists result      jsonb,
  add column if not exists tokens_used int;


-- ---------------------------------------------------------------------
-- 4. Работы, присланные по ссылке
-- student_id добавлен к заданию: без него «читать своё» не к чему
-- привязать. Ученик без входа отправляет работу через Worker, тогда
-- student_id пустой.
-- img_url — путь в бакете homework (submissions/<id>.jpg) или внешний
-- https-адрес. Ссылку для просмотра Worker подписывает при выдаче.
-- ---------------------------------------------------------------------
create table if not exists public.homework_submissions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references auth.users(id) on delete set null,
  student_name  text check (student_name is null or char_length(student_name) <= 100),
  class         text check (class is null or char_length(class) <= 20),
  subject       text,
  img_url       text,
  teacher_id    uuid references auth.users(id) on delete set null,
  status        text not null default 'pending' check (status in ('pending', 'checked', 'failed')),
  result        jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists homework_submissions_student_idx on public.homework_submissions (student_id, created_at desc);
create index if not exists homework_submissions_teacher_idx on public.homework_submissions (teacher_id, created_at desc);


-- ---------------------------------------------------------------------
-- 5. Заявки на оплату: назначение платежа
-- ---------------------------------------------------------------------
alter table public.payments add column if not exists purpose text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_purpose_chk') then
    alter table public.payments add constraint payments_purpose_chk
      check (purpose is null or purpose in ('paid_tariff', 'premium_tariff', 'plagiarism'));
  end if;
end $$;


-- =====================================================================
-- RLS
-- =====================================================================
alter table public.usage_limits         enable row level security;
alter table public.homework_submissions enable row level security;

drop policy if exists "users read own usage limits" on public.usage_limits;
create policy "users read own usage limits" on public.usage_limits
  for select using (auth.uid() = user_id);

drop policy if exists "students read own submissions" on public.homework_submissions;
create policy "students read own submissions" on public.homework_submissions
  for select using (auth.uid() = student_id);

-- Своя работа — только со статусом «ждёт проверки» и без результата:
-- поставить себе «проверено, 5» в обход модели нельзя.
drop policy if exists "students insert own submissions" on public.homework_submissions;
create policy "students insert own submissions" on public.homework_submissions
  for insert with check (auth.uid() = student_id and status = 'pending' and result is null);

drop policy if exists "teachers read addressed submissions" on public.homework_submissions;
create policy "teachers read addressed submissions" on public.homework_submissions
  for select using (auth.uid() = teacher_id);

-- В Supabase новые таблицы по умолчанию открыты anon и authenticated
-- целиком (RLS потом режет строки). Оставляем только нужное.
revoke all on table public.usage_limits         from anon, authenticated;
revoke all on table public.homework_submissions from anon, authenticated;
grant select         on table public.usage_limits         to authenticated;
grant select, insert on table public.homework_submissions to authenticated;


-- =====================================================================
-- Функции для Worker. Вызываются ТОЛЬКО сервисным ключом.
-- =====================================================================

-- Действующий тариф пользователя. Истёкший тариф = бесплатный;
-- p_user = null (вход не выполнен) — тоже бесплатный.
create or replace function public.sky_plan(p_user uuid)
returns table (
  plan text, title text, price_rub int,
  requests_per_window int, window_seconds int, photos_per_request int,
  compare boolean, teacher boolean, plagiarism boolean, expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with mine as (
    select up.plan, up.expires_at
      from public.user_plans up
     where up.user_id = p_user
       and (up.expires_at is null or up.expires_at > now())
  )
  select pl.plan, pl.title, pl.price_rub,
         coalesce(pl.requests_per_window, 1),
         coalesce(pl.window_seconds, 600),
         coalesce(pl.photos_per_request, 5),
         pl.feature_compare,
         pl.feature_teacher,
         pl.feature_plagiarism
           or coalesce((select up.plagiarism_enabled from public.user_plans up where up.user_id = p_user), false),
         (select m.expires_at from mine m)
    from public.plan_limits pl
   where pl.plan = coalesce((select m.plan from mine m), 'free');
$$;

-- Окно запросов: проверка и списание одной транзакцией.
--   p_delta > 0 — списать (если влезает в p_max за p_window секунд);
--   p_delta = 0 — только узнать остаток;
--   p_delta < 0 — вернуть (модель не ответила — запрос не в счёт).
-- Окно начинается с первого запроса: у бесплатного тарифа следующий
-- запрос — через 10 минут после предыдущего.
create or replace function public.sky_rate(
  p_user uuid, p_ip text, p_scope text, p_window int, p_max int, p_delta int default 1
)
returns table (allowed boolean, remaining int, retry_after int, reset_in int)
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_start timestamptz;
  v_count int := 0;
  v_reset int := 0;
begin
  if coalesce(p_window, 0) <= 0 or coalesce(p_max, 0) <= 0 then
    raise exception 'sky_rate: window and max must be positive';
  end if;
  if p_user is null and coalesce(p_ip, '') = '' then
    return query select true, p_max, 0, 0;
    return;
  end if;

  -- Два одновременных нажатия не должны оба пройти по одному остатку.
  perform pg_advisory_xact_lock(
    hashtextextended(coalesce(p_user::text, 'ip:' || p_ip) || '|' || p_scope, 0));

  select u.id, u.window_start, u.requests_count
    into v_id, v_start, v_count
    from public.usage_limits u
   where u.scope = p_scope
     and ((p_user is not null and u.user_id = p_user)
       or (p_user is null and u.user_id is null and u.ip = p_ip))
     and u.window_start > now() - make_interval(secs => p_window)
   order by u.window_start desc
   limit 1;

  if v_id is null then
    v_count := 0;
  else
    v_reset := greatest(ceil(extract(epoch from (v_start + make_interval(secs => p_window) - now())))::int, 1);
  end if;

  if p_delta > 0 then
    if v_count + p_delta > p_max then
      return query select false, greatest(p_max - v_count, 0), v_reset, v_reset;
      return;
    end if;
    if v_id is null then
      insert into public.usage_limits (user_id, ip, scope, window_start, requests_count)
      values (p_user, p_ip, p_scope, now(), p_delta);
      v_reset := p_window;
    else
      update public.usage_limits set requests_count = requests_count + p_delta where id = v_id;
    end if;
    v_count := v_count + p_delta;
  elsif p_delta < 0 and v_id is not null then
    update public.usage_limits set requests_count = greatest(requests_count + p_delta, 0) where id = v_id;
    v_count := greatest(v_count + p_delta, 0);
  end if;

  return query select
    (p_delta > 0) or v_count < p_max,
    greatest(p_max - v_count, 0),
    case when v_count >= p_max then v_reset else 0 end,
    v_reset;
end $$;

-- Запись проверки в историю + токены в текущее окно.
-- p_img_url — адрес БЕЗ подписи: подписанная ссылка протухает через
-- час, а токен доступа в истории хранить незачем.
create or replace function public.sky_log_check(
  p_user uuid, p_ip text, p_img_url text, p_subject text,
  p_mode text, p_length text, p_result jsonb, p_tokens int
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_grade int;
begin
  if (p_result ->> 'assessment') ~ '^[1-5]$' then
    v_grade := (p_result ->> 'assessment')::int;
  end if;

  insert into public.photo_checks
    (user_id, ip, subject, image_url, recognized_text, ai_feedback, grade, errors,
     status, mode, length, result, tokens_used)
  values
    (p_user, p_ip, p_subject, p_img_url,
     p_result ->> 'recognized_text', p_result ->> 'comment', v_grade,
     case when jsonb_typeof(p_result -> 'errors') = 'array' then p_result -> 'errors' end,
     'ok', p_mode, p_length, p_result, coalesce(p_tokens, 0))
  returning id into v_id;

  if coalesce(p_tokens, 0) > 0 and (p_user is not null or coalesce(p_ip, '') <> '') then
    update public.usage_limits set tokens_used = tokens_used + p_tokens
     where id = (
       select u.id from public.usage_limits u
        where u.scope = 'check'
          and ((p_user is not null and u.user_id = p_user)
            or (p_user is null and u.user_id is null and u.ip = p_ip))
        order by u.window_start desc
        limit 1);
  end if;

  return v_id;
end $$;

-- Итоги проверки работ по ссылкам: [{id, status, result}, ...]
create or replace function public.sky_submissions_update(p_items jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  update public.homework_submissions s
     set status = i.status, result = i.result
    from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(id uuid, status text, result jsonb)
   where s.id = i.id and i.status in ('checked', 'failed');
  get diagnostics n = row_count;
  return n;
end $$;

-- В Supabase функции в public по умолчанию исполнимы для anon и
-- authenticated, и revoke from public этого не снимает — снимаем явно.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.sky_plan(uuid)',
    'public.sky_rate(uuid, text, text, integer, integer, integer)',
    'public.sky_log_check(uuid, text, text, text, text, text, jsonb, integer)',
    'public.sky_submissions_update(jsonb)'
  ] loop
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

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update on table public.usage_limits         to service_role;
    grant select, insert, update on table public.homework_submissions to service_role;
  end if;
end $$;

commit;

-- Проверка после выполнения:
--   select plan, price_rub, requests_per_window, window_seconds, photos_per_request
--     from plan_limits order by sort_order;          -- free, …, paid, premium
--   select * from sky_plan(null);                      -- free, 1 / 600 с, 5 фото
--
-- Выдать тариф вручную (пока нет оплаты):
--   insert into user_plans (user_id, plan, expires_at)
--   values ('<uuid пользователя>', 'premium', now() + interval '30 days')
--   on conflict (user_id) do update set plan = excluded.plan, expires_at = excluded.expires_at;
--
-- Старые окна можно чистить раз в месяц:
--   delete from usage_limits where window_start < now() - interval '90 days';
