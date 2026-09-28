-- =====================================================================
-- SkyySchool — проверка сочинений текстом (Groq, llama-3.1-8b-instant)
--
-- Запускать ПОСЛЕ sql/schema-tariffs.sql. Можно выполнять повторно.
--
-- Новых таблиц нет:
--   история и кэш  → photo_checks (mode = 'text', text_hash, criteria)
--   лимиты текста  → plan_limits  (text_requests_per_window, text_window_seconds)
--   окна запросов  → usage_limits (scope = 'text'; photo_usage для этого
--                    не годится: там счёт по дням и нет IP для тех, кто
--                    не вошёл)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. photo_checks: поля текстовой проверки
-- text_hash — SHA-256 от «предмет | длина | текст»: одинаковый текст с
-- теми же настройками за 7 дней отдаётся из кэша, без вызова модели.
-- Сам текст сочинения НЕ хранится — только хэш и разбор.
-- ---------------------------------------------------------------------
alter table public.photo_checks
  add column if not exists text_hash text,
  add column if not exists criteria  jsonb,
  add column if not exists mode      text,
  add column if not exists length    text;
alter table public.photo_checks alter column mode   set default 'photo';
alter table public.photo_checks alter column length set default 'long';

create index if not exists photo_checks_text_hash_idx
  on public.photo_checks (text_hash, created_at desc)
  where text_hash is not null;


-- ---------------------------------------------------------------------
-- 2. Лимиты текста в справочнике тарифов
--   Бесплатный: 1 запрос / 5 мин, Платный: 2 / мин, Премиум: 5 / мин.
-- Ставим только пустые: если лимиты уже поменяли в админке, повторный
-- запуск файла их не затрёт.
-- ---------------------------------------------------------------------
alter table public.plan_limits
  add column if not exists text_requests_per_window int,
  add column if not exists text_window_seconds      int;

update public.plan_limits set text_requests_per_window = 1, text_window_seconds = 300
 where plan = 'free' and text_requests_per_window is null;
update public.plan_limits set text_requests_per_window = 2, text_window_seconds = 60
 where plan in ('paid', 'basic') and text_requests_per_window is null;
update public.plan_limits set text_requests_per_window = 5, text_window_seconds = 60
 where plan in ('premium', 'pro', 'family') and text_requests_per_window is null;


-- ---------------------------------------------------------------------
-- 3. sky_plan отдаёт и лимиты текста. Меняется набор колонок ответа,
--    поэтому функцию пересоздаём (права ниже выдаются заново).
-- ---------------------------------------------------------------------
drop function if exists public.sky_plan(uuid);
create function public.sky_plan(p_user uuid)
returns table (
  plan text, title text, price_rub int,
  requests_per_window int, window_seconds int, photos_per_request int,
  compare boolean, teacher boolean, plagiarism boolean, expires_at timestamptz,
  text_requests_per_window int, text_window_seconds int
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
         (select m.expires_at from mine m),
         coalesce(pl.text_requests_per_window, 1),
         coalesce(pl.text_window_seconds, 300)
    from public.plan_limits pl
   where pl.plan = coalesce((select m.plan from mine m), 'free');
$$;


-- ---------------------------------------------------------------------
-- 4. Кэш: последний разбор с этим хэшем за p_days дней (или null)
-- ---------------------------------------------------------------------
create or replace function public.sky_text_cache(p_hash text, p_days int default 7)
returns table (result jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.result, c.created_at
    from public.photo_checks c
   where c.text_hash = p_hash
     and c.mode = 'text'
     and c.status = 'ok'
     and c.created_at > now() - make_interval(days => greatest(coalesce(p_days, 7), 1))
   order by c.created_at desc
   limit 1;
$$;


-- ---------------------------------------------------------------------
-- 5. Запись текстовой проверки в историю + токены в окно scope='text'
-- ---------------------------------------------------------------------
create or replace function public.sky_log_text(
  p_user uuid, p_ip text, p_subject text, p_length text,
  p_text_hash text, p_result jsonb, p_tokens int
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
    (user_id, ip, subject, mode, length, text_hash, criteria, ai_feedback, grade, errors,
     status, result, tokens_used)
  values
    (p_user, p_ip, p_subject, 'text', p_length, p_text_hash,
     case when jsonb_typeof(p_result -> 'criteria') = 'object' then p_result -> 'criteria' end,
     p_result ->> 'comment', v_grade,
     case when jsonb_typeof(p_result -> 'errors') = 'array' then p_result -> 'errors' end,
     'ok', p_result, coalesce(p_tokens, 0))
  returning id into v_id;

  if coalesce(p_tokens, 0) > 0 and (p_user is not null or coalesce(p_ip, '') <> '') then
    update public.usage_limits set tokens_used = tokens_used + p_tokens
     where id = (
       select u.id from public.usage_limits u
        where u.scope = 'text'
          and ((p_user is not null and u.user_id = p_user)
            or (p_user is null and u.user_id is null and u.ip = p_ip))
        order by u.window_start desc
        limit 1);
  end if;

  return v_id;
end $$;


-- Функции Worker — только для сервисного ключа.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.sky_plan(uuid)',
    'public.sky_text_cache(text, integer)',
    'public.sky_log_text(uuid, text, text, text, text, jsonb, integer)'
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
end $$;

commit;
