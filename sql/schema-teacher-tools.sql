-- =====================================================================
-- SkyySchool — инструменты учителя
--
-- Выполнять после sql/schema.sql, schema-collections.sql,
-- schema-tariffs.sql и schema-admin-automation.sql. Повторный запуск
-- безопасен. Разделы добавляются по одному вместе со своей страницей.
--
-- Существующее не дублируем:
--   предметы учителя — profiles.subjects (text[], уже есть в schema.sql),
--     отдельной subject_list не заводим;
--   chat_id Telegram — таблица user_telegram (schema-admin-automation.sql):
--     profiles читают все вошедшие, и chat_id в ней был бы виден всем.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Онбординг учителя (onboarding.html)
--    Мастер показывается, пока у учителя нет ни одной подборки;
--    onboarding_done — прошёл он его или пропустил. Меняет сам
--    пользователь через политику profiles_update_own.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists onboarding_done boolean not null default false;


-- ---------------------------------------------------------------------
-- 2. Профиль (profile.html): статистика одним запросом
--    security invoker — считает с правами самого пользователя, RLS
--    таблиц действует как обычно: учитель видит только свои проверки
--    и работы по своим подборкам, чужих цифр функция не покажет.
--    «Проверок всего» — проверки по фото + работы по подборкам +
--    присланные учителю по ссылке; средний балл — оценки по фото и
--    процент подборок по шкале 90/75/60 (как в быстрой проверке).
-- ---------------------------------------------------------------------
create or replace function public.my_stats()
returns jsonb
language sql stable security invoker set search_path = public as $$
  with me as (select (select auth.uid()) as id),
  pc as (
    select p.grade, p.created_at from public.photo_checks p where p.user_id = (select id from me)
  ),
  cs as (
    select s.student_id, s.student_name, s.percent, s.status, s.created_at
      from public.collection_submissions s
      join public.task_collections c on c.id = s.collection_id
     where c.teacher_id = (select id from me)
  ),
  hs as (
    select h.student_id, h.student_name, h.status, h.created_at
      from public.homework_submissions h where h.teacher_id = (select id from me)
  ),
  grades as (
    select grade::numeric as g from pc where grade between 1 and 5
    union all
    select case when percent >= 90 then 5 when percent >= 75 then 4 when percent >= 60 then 3 else 2 end
      from cs where percent is not null
  ),
  students as (
    select coalesce(student_id::text, 'n:' || lower(btrim(student_name))) as k from cs
    union
    select coalesce(student_id::text, 'n:' || lower(btrim(student_name))) from hs
    union
    select l.student_id::text from public.links l
     where l.teacher_id = (select id from me) and l.status = 'active'
  )
  select jsonb_build_object(
    'checks_total',  (select count(*) from pc) + (select count(*) from cs) + (select count(*) from hs),
    'photo_checks',  (select count(*) from pc),
    'submissions',   (select count(*) from cs) + (select count(*) from hs),
    'pending',       (select count(*) from cs where status = 'pending') + (select count(*) from hs where status = 'pending'),
    'students',      (select count(*) from students where k is not null and k <> 'n:'),
    'avg_grade',     (select round(avg(g), 1) from grades),
    'graded',        (select count(*) from grades),
    'last_check_at', (select max(t) from (
                        select max(created_at) as t from pc
                        union all select max(created_at) from cs
                        union all select max(created_at) from hs) x)
  )
  where (select id from me) is not null;
$$;
revoke all on function public.my_stats() from public, anon;
grant execute on function public.my_stats() to authenticated;


-- ---------------------------------------------------------------------
-- 3. Telegram: привязка по одноразовому коду и уведомления
--    chat_id — прежняя таблица user_telegram (RLS: каждый видит свой).
--    Ссылка t.me/<бот>?start=<код>: код одноразовый и живёт 15 минут.
--    Не id пользователя, как в первом наброске: по чужому id кто угодно
--    привязал бы свой Telegram к чужому аккаунту и читал его уведомления.
-- ---------------------------------------------------------------------
create table if not exists public.telegram_link_codes (
  code       text primary key check (code ~ '^[A-Za-z0-9_-]{16,64}$'),
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);
create unique index if not exists telegram_link_codes_user_idx on public.telegram_link_codes (user_id);
alter table public.telegram_link_codes enable row level security;   -- политик нет: только функции ниже
revoke all on table public.telegram_link_codes from anon, authenticated;

-- Какие уведомления уже ушли: одна работа — одно сообщение, предупреждение
-- о лимите — не чаще раза в сутки. Пишет только Worker (service_role).
create table if not exists public.telegram_notify_log (
  key     text primary key check (char_length(key) <= 200),
  sent_at timestamptz not null default now()
);
alter table public.telegram_notify_log enable row level security;
revoke all on table public.telegram_notify_log from anon, authenticated;

-- Код для ссылки на бота: вызывает сам пользователь из профиля.
-- Прежний код того же человека гасится — действует только последний.
create or replace function public.telegram_link_start()
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid  uuid := (select auth.uid());
  v_code text;
  v_exp  timestamptz := now() + interval '15 minutes';
begin
  if v_uid is null then raise exception 'Войдите в аккаунт' using errcode = '28000'; end if;
  delete from public.telegram_link_codes where user_id = v_uid or expires_at < now();
  v_code := 'L' || replace(gen_random_uuid()::text, '-', '');   -- 33 символа, стойкий случайный
  insert into public.telegram_link_codes (code, user_id, expires_at) values (v_code, v_uid, v_exp);
  return jsonb_build_object('code', v_code, 'expires_at', v_exp);
end $$;

-- Бот получил /start <код>: привязать chat_id. Только Worker.
create or replace function public.sky_telegram_link(p_code text, p_chat_id text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid; v_name text;
begin
  if p_chat_id is null or p_chat_id !~ '^-?[0-9]{3,20}$' then return jsonb_build_object('ok', false, 'reason', 'bad_chat'); end if;
  delete from public.telegram_link_codes where code = p_code and expires_at >= now() returning user_id into v_uid;
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;
  insert into public.user_telegram (user_id, chat_id, updated_at) values (v_uid, p_chat_id, now())
    on conflict (user_id) do update set chat_id = excluded.chat_id, updated_at = now();
  select p.name into v_name from public.profiles p where p.id = v_uid;
  return jsonb_build_object('ok', true, 'user_id', v_uid, 'name', v_name);
end $$;

-- /stop в боте: отвязать этот чат от всех аккаунтов. Только Worker.
create or replace function public.sky_telegram_unlink(p_chat_id text)
returns int
language sql volatile security definer set search_path = public as $$
  with d as (delete from public.user_telegram where chat_id = p_chat_id returning 1) select count(*)::int from d;
$$;

-- chat_id пользователя (для /notify и предупреждений). Только Worker.
create or replace function public.sky_telegram_chat(p_user uuid)
returns text
language sql stable security definer set search_path = public as $$
  select t.chat_id from public.user_telegram t where t.user_id = p_user;
$$;

-- «Уже отправляли?» и отметка одним вызовом: true — отправлять,
-- false — уже было. Заодно чистит записи старше 60 дней. Только Worker.
create or replace function public.sky_notify_once(p_key text)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  delete from public.telegram_notify_log where sent_at < now() - interval '60 days';
  insert into public.telegram_notify_log (key) values (p_key) on conflict (key) do nothing;
  return found;
end $$;

-- Новая работа по подборке: кому сообщить и что. Только свежие
-- (15 минут) — старую работу через этот вход в уведомление не превратить.
create or replace function public.sky_collection_submission_info(p_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'teacher_id', c.teacher_id, 'title', c.title, 'code', c.share_code,
    'student_name', s.student_name, 'score', s.score, 'percent', s.percent,
    'total', jsonb_array_length(c.tasks), 'status', s.status, 'created_at', s.created_at,
    'chat_id', (select t.chat_id from public.user_telegram t where t.user_id = c.teacher_id))
  from public.collection_submissions s
  join public.task_collections c on c.id = s.collection_id
  where s.id = p_id and s.created_at > now() - interval '15 minutes';
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.sky_telegram_link(text, text)', 'public.sky_telegram_unlink(text)', 'public.sky_telegram_chat(uuid)',
    'public.sky_notify_once(text)', 'public.sky_collection_submission_info(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke all on function public.telegram_link_start() from public, anon;
grant execute on function public.telegram_link_start() to authenticated;
grant select, insert, update, delete on table public.telegram_link_codes, public.telegram_notify_log to service_role;
