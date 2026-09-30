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
