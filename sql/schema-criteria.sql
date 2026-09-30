-- =====================================================================
-- SkyySchool — критерии оценивания при проверке фото
--
-- Запускать ПОСЛЕ sql/schema-tariffs.sql и sql/schema-text-check.sql.
-- Можно выполнять повторно.
--
-- Новых таблиц нет. Учитель задаёт критерии [{name, weight}], модель
-- ставит балл 1–5 по каждому, Worker считает итог:
--     score = Σ(вес × балл) / Σ(веса)      — например 4.2
--     grade = округление score             — 4.2 → 4
-- и отдаёт { criteria: [{name, weight, score, comment}], score, assessment }.
--
-- Где хранится:
--   photo_checks.criteria — таблица критериев с баллами (jsonb). Колонка
--                           уже есть (её завёл schema-text-check.sql для
--                           сочинений: там объект, здесь массив);
--   photo_checks.score    — итог по критериям (numeric, 1.0–5.0);
--   photo_checks.grade    — как и раньше, целая оценка.
--
-- RLS на photo_checks уже включён (schema-classes.sql / schema-tariffs.sql),
-- новые колонки подчиняются тем же правилам. Пишет в таблицу только
-- sky_log_check — security definer, исполняет только service_role
-- (то есть Worker).
-- =====================================================================

begin;

alter table public.photo_checks
  add column if not exists criteria jsonb,
  add column if not exists score    numeric(3,1);

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'photo_checks_score_range'
                    and conrelid = 'public.photo_checks'::regclass) then
    alter table public.photo_checks
      add constraint photo_checks_score_range check (score is null or (score >= 1 and score <= 5));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- sky_log_check: то же, что в schema-tariffs.sql, плюс критерии и итог.
-- Старые вызовы (без критериев) пишут то же, что и раньше: criteria и
-- score остаются пустыми.
-- ---------------------------------------------------------------------
create or replace function public.sky_log_check(
  p_user uuid, p_ip text, p_img_url text, p_subject text,
  p_mode text, p_length text, p_result jsonb, p_tokens int
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_grade int;
  v_score numeric(3,1);
begin
  if (p_result ->> 'assessment') ~ '^[1-5]$' then
    v_grade := (p_result ->> 'assessment')::int;
  end if;
  if jsonb_typeof(p_result -> 'score') = 'number'
     and (p_result ->> 'score')::numeric between 1 and 5 then
    v_score := round((p_result ->> 'score')::numeric, 1);
  end if;

  insert into public.photo_checks
    (user_id, ip, subject, image_url, recognized_text, ai_feedback, grade, errors,
     status, mode, length, result, tokens_used, criteria, score)
  values
    (p_user, p_ip, p_subject, p_img_url,
     p_result ->> 'recognized_text', p_result ->> 'comment', v_grade,
     case when jsonb_typeof(p_result -> 'errors') = 'array' then p_result -> 'errors' end,
     'ok', p_mode, p_length, p_result, coalesce(p_tokens, 0),
     case when jsonb_typeof(p_result -> 'criteria') = 'array' then p_result -> 'criteria' end,
     v_score)
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

-- Права — как в schema-tariffs.sql: только Worker (service_role).
do $$
declare
  f text := 'public.sky_log_check(uuid, text, text, text, text, text, jsonb, integer)';
begin
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
end $$;

commit;

-- Проверка после выполнения:
--   select id, grade, score, criteria from photo_checks
--    where score is not null order by created_at desc limit 5;
