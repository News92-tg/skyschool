-- =====================================================================
-- Тесты: инструменты учителя (sql/schema-teacher-tools.sql).
-- Запуск — scripts/test-rls.sh, в базе тарифов после остальных тестов
-- (там уже есть photo_checks с user_id, homework_submissions,
-- подборки и user_telegram — как в живой базе).
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- свои люди: учитель, второй учитель, ученик
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-0000-0000-0000-000000000001', 'tt-teacher@test', '{"name":"Ольга Сергеевна","role":"teacher"}'),
  ('77777777-0000-0000-0000-000000000002', 'tt-teacher2@test', '{"name":"Пётр Ильич","role":"teacher"}'),
  ('77777777-0000-0000-0000-000000000003', 'tt-student@test', '{"name":"Ваня","role":"student"}')
on conflict (id) do nothing;
update profiles set role = 'teacher' where id in ('77777777-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------------
-- 1. Онбординг
-- ---------------------------------------------------------------------
select t_check('onboarding_done: boolean, по умолчанию false',
  (select data_type = 'boolean' and column_default = 'false' and is_nullable = 'NO'
     from information_schema.columns where table_name = 'profiles' and column_name = 'onboarding_done'));
select t_check('у нового профиля онбординг не пройден',
  (select not onboarding_done from profiles where id = '77777777-0000-0000-0000-000000000001'));
select t_check('предметы — в прежней колонке subjects (text[]), новой subject_list нет',
  (select count(*) = 1 from information_schema.columns where table_name = 'profiles' and column_name = 'subjects' and data_type = 'ARRAY')
  and not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'subject_list'));

set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000001', false);
update profiles set onboarding_done = true, subjects = array['math','physics'] where id = '77777777-0000-0000-0000-000000000001';
reset role;
select t_check('учитель отмечает онбординг и предметы у себя',
  (select onboarding_done and subjects = array['math','physics'] from profiles where id = '77777777-0000-0000-0000-000000000001'));

set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000003', false);
update profiles set onboarding_done = true where id = '77777777-0000-0000-0000-000000000002';
reset role;
select t_check('чужой профиль не меняется (RLS)',
  (select not onboarding_done from profiles where id = '77777777-0000-0000-0000-000000000002'));
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------
-- 2. Статистика профиля — my_stats()
-- ---------------------------------------------------------------------
insert into task_collections (id, teacher_id, title, share_code, tasks) values
  ('77777777-1111-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'Дроби', 'TTAAAA', '[{"id":"t1","type":"text","text":"1+1","accept":["2"]}]'),
  ('77777777-1111-0000-0000-000000000002', '77777777-0000-0000-0000-000000000002', 'Чужая', 'TTBBBB', '[{"id":"t1","type":"text","text":"2+2","accept":["4"]}]');
insert into collection_submissions (collection_id, student_id, student_name, answers, score, percent, status, created_at) values
  ('77777777-1111-0000-0000-000000000001', '77777777-0000-0000-0000-000000000003', 'Ваня', '{}', 9, 95, 'checked', now() - interval '3 days'),
  ('77777777-1111-0000-0000-000000000001', null, 'Маша', '{}', 7, 70, 'pending', now() - interval '1 day'),
  ('77777777-1111-0000-0000-000000000001', null, ' маша ', '{}', 5, 50, 'pending', now() - interval '2 hours'),
  ('77777777-1111-0000-0000-000000000002', null, 'Чужой', '{}', 1, 10, 'pending', now());
insert into photo_checks (user_id, subject, grade, created_at) values
  ('77777777-0000-0000-0000-000000000001', 'math', 4, now() - interval '5 days'),
  ('77777777-0000-0000-0000-000000000001', 'math', null, now() - interval '4 days');
insert into homework_submissions (student_name, class, subject, teacher_id, status, created_at) values
  ('Петя', '7А', 'math', '77777777-0000-0000-0000-000000000001', 'pending', now() - interval '30 minutes');

set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000001', false);
create temp table _st as select my_stats() as s;
reset role;
select t_check('проверок всего: 2 по фото + 3 по подборке + 1 по ссылке = 6',
  (select (s->>'checks_total')::int = 6 from _st), (select s::text from _st));
select t_check('ждут проверки: 2 по подборке + 1 по ссылке, чужие не в счёт',
  (select (s->>'pending')::int = 3 from _st));
select t_check('учеников: Ваня, Маша (без регистра и пробелов), Петя = 3',
  (select (s->>'students')::int = 3 from _st));
select t_check('средний балл: 5, 3, 2 по подборке и 4 по фото = 3.5',
  (select (s->>'avg_grade')::numeric = 3.5 from _st));
select t_check('последняя проверка — самая свежая работа (30 мин назад)',
  (select (s->>'last_check_at')::timestamptz > now() - interval '31 minutes' from _st));

set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000003', false);
create temp table _st2 as select my_stats() as s;
reset role;
select t_check('ученик не видит цифр учителя: у него 0 проверок',
  (select (s->>'checks_total')::int = 0 and (s->>'avg_grade') is null from _st2), (select s::text from _st2));

set role anon;
select t_expect_denied('аноним не вызывает my_stats', $q$ select my_stats() $q$);
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- ---------------------------------------------------------------------
-- Итог
-- ---------------------------------------------------------------------
\o
select case when ok then ' ✓ ' else ' ✗ ' end as " ", rpad(what, 60) as "проверка", details as "подробности"
  from _test_results order by n;

select count(*) as "всего", count(*) filter (where ok) as "прошло", count(*) filter (where not ok) as "провалено"
  from _test_results;

delete from auth.users where email like 'tt-%@test';

do $$
begin
  if exists (select 1 from _test_results where not ok) then
    raise exception 'Есть проваленные проверки инструментов учителя — см. таблицу выше';
  end if;
  raise notice 'Все проверки инструментов учителя пройдены.';
end $$;
