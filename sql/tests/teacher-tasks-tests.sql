-- =====================================================================
-- Тесты: свои задания учителя (sql/schema-teacher-tasks.sql поверх
-- sql/schema-homework.sql). Запуск — scripts/test-rls.sh.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;
reset role;
-- сколько строк затронул запрос — от имени текущей роли (RLS действует)
create or replace function tt_rows(sql_text text) returns int language plpgsql as $$
declare n int;
begin
  execute sql_text;
  get diagnostics n = row_count;
  return n;
end $$;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('88888888-0000-0000-0000-000000000001', 'ttk-teacher@test', '{"name":"Анна Павловна","role":"teacher"}'),
  ('88888888-0000-0000-0000-000000000002', 'ttk-teacher2@test', '{"name":"Борис Ильич","role":"teacher"}'),
  ('88888888-0000-0000-0000-000000000003', 'ttk-student@test', '{"name":"Ваня","role":"student"}')
on conflict (id) do nothing;

select t_check('teacher_tasks одна (второй таблицы нет), новые колонки на месте',
  (select count(*) = 4 from information_schema.columns where table_name = 'teacher_tasks'
      and column_name in ('options', 'correct_answer', 'explanation', 'source'))
  and (select count(*) = 1 from information_schema.tables where table_schema = 'public' and table_name = 'teacher_tasks'));
select t_check('индекс по учителю и предмету', exists (select 1 from pg_indexes where indexname = 'teacher_tasks_teacher_subject_idx'));
select t_check('RLS включён', (select relrowsecurity from pg_class where oid = 'public.teacher_tasks'::regclass));

-- ---------------------------------------------------------------------
-- Учитель 1 создаёт свои задания
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '88888888-0000-0000-0000-000000000001', false);
insert into teacher_tasks (id, subject, task_text, options, correct_answer, explanation)
values ('99999999-0000-0000-0000-000000000001', 'math', '2 + 2 = ?', '["3","4","5"]', '1', 'Сложите два и два');
insert into teacher_tasks (id, subject, task_text, correct_answer, source)
values ('99999999-0000-0000-0000-000000000002', 'russian', 'Подберите синоним к слову «быстрый»', 'скорый; стремительный', 'photo');
insert into teacher_tasks (id, subject, task_text)
values ('99999999-0000-0000-0000-000000000003', 'math', 'Опишите, где встречаются дроби');
select t_check('учитель видит свои три задания', (select count(*) from teacher_tasks) = 3);
select t_check('teacher_id подставлен сам, source по умолчанию manual',
  (select teacher_id = '88888888-0000-0000-0000-000000000001' and source = 'manual' from teacher_tasks where id = '99999999-0000-0000-0000-000000000001'));
select t_check('фильтр по предмету: math — 2', (select count(*) from teacher_tasks where subject = 'math') = 2);
select t_check('правит своё', tt_rows($q$ update teacher_tasks set explanation = 'Два плюс два — четыре' where id = '99999999-0000-0000-0000-000000000001' $q$) = 1);
select t_expect_denied('вариант один — нельзя', $q$ insert into teacher_tasks (subject, task_text, options) values ('math', 'x', '["1"]') $q$);
select t_expect_denied('варианты не массивом — нельзя', $q$ insert into teacher_tasks (subject, task_text, options) values ('math', 'x', '{"a":1}') $q$);
select t_expect_denied('пустой текст — нельзя', $q$ insert into teacher_tasks (subject, task_text) values ('math', '   ') $q$);
select t_expect_denied('непонятный источник — нельзя', $q$ insert into teacher_tasks (subject, task_text, source) values ('math', 'x', 'hack') $q$);
select t_expect_denied('чужим именем — нельзя', $q$ insert into teacher_tasks (teacher_id, subject, task_text) values ('88888888-0000-0000-0000-000000000002', 'math', 'x') $q$);

-- ---------------------------------------------------------------------
-- Чужие и ученики
-- ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '88888888-0000-0000-0000-000000000002', false);
select t_check('второй учитель чужих заданий не видит', (select count(*) from teacher_tasks) = 0);
select t_check('…и не правит', tt_rows($q$ update teacher_tasks set task_text = 'взлом' $q$) = 0);
select t_check('…и не удаляет', tt_rows($q$ delete from teacher_tasks $q$) = 0);
select set_config('request.jwt.claim.sub', '88888888-0000-0000-0000-000000000003', false);
select t_check('ученик ничего не видит (правильных ответов тоже)', (select count(*) from teacher_tasks) = 0);
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_denied('аноним таблицу не читает', $q$ select count(*) from teacher_tasks $q$);
select t_check('задание по ссылке (homework_task_get) — без правильного ответа и объяснения',
  (select count(*) = 1 and bool_and(task_text = '2 + 2 = ?') from homework_task_get('99999999-0000-0000-0000-000000000001'))
  and (select not (proargnames && array['correct_answer', 'explanation', 'options']) from pg_proc where proname = 'homework_task_get'));
reset role;
select t_check('у вошедших нет truncate/trigger/references, у анонима — ничего',
  not has_table_privilege('authenticated', 'public.teacher_tasks', 'truncate')
  and not has_table_privilege('authenticated', 'public.teacher_tasks', 'trigger')
  and not has_table_privilege('anon', 'public.teacher_tasks', 'select')
  and not has_table_privilege('anon', 'public.teacher_tasks', 'truncate'));

set role authenticated;
select set_config('request.jwt.claim.sub', '88888888-0000-0000-0000-000000000001', false);
select t_check('удаляет своё', tt_rows($q$ delete from teacher_tasks where id = '99999999-0000-0000-0000-000000000003' $q$) = 1);
reset role;

delete from teacher_tasks where teacher_id in ('88888888-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000002');
delete from auth.users where email like 'ttk-%@test';
drop function tt_rows(text);

\o
select case when ok then ' ✓ ' else ' ✗ ' end as " ", rpad(what, 60) as "проверка", details as "подробности"
  from _test_results order by n;
select count(*) as "всего", count(*) filter (where ok) as "прошло", count(*) filter (where not ok) as "провалено"
  from _test_results;
do $$
begin
  if exists (select 1 from _test_results where not ok) then
    raise exception 'Есть проваленные проверки своих заданий — см. таблицу выше';
  end if;
  raise notice 'Все проверки своих заданий пройдены.';
end $$;
