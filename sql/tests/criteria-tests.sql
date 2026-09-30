-- =====================================================================
-- Тесты: критерии оценивания (sql/schema-criteria.sql).
-- Запуск — scripts/test-rls.sh, после text-admin-tests.sql в той же
-- одноразовой базе.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;
reset role;

select t_check('колонка score — numeric(3,1)',
  (select data_type = 'numeric' and numeric_precision = 3 and numeric_scale = 1
     from information_schema.columns where table_name = 'photo_checks' and column_name = 'score'));
select t_check('колонка criteria — jsonb',
  (select data_type = 'jsonb' from information_schema.columns where table_name = 'photo_checks' and column_name = 'criteria'));

select t_check('проверка с критериями: запись создана',
  sky_log_check('aaaaaaaa-0000-0000-0000-000000000001', null, 'https://x/1.jpg', 'math', 'check', 'long',
    '{"assessment": 4, "score": 4.2, "comment": "ok",
      "criteria": [{"name": "верно", "weight": 1, "score": 5, "comment": ""},
                   {"name": "оформление", "weight": 0.5, "score": 3, "comment": "грязно"}]}'::jsonb, 100) is not null);
select t_check('в истории: 2 критерия, score 4.2, grade 4',
  (select jsonb_array_length(criteria) = 2 and score = 4.2 and grade = 4
          and criteria -> 1 ->> 'name' = 'оформление'
     from photo_checks where image_url = 'https://x/1.jpg'));

-- вызов и проверка — разными запросами: подзапрос без связи с вызовом
-- Postgres считает ДО вызова функции
select sky_log_check(null, '7.7.7.7', 'https://x/2.jpg', 'math', 'check', 'long', '{"assessment": 5}'::jsonb, 0);
select t_check('старый вызов без критериев — как раньше',
  (select criteria is null and score is null and grade = 5 from photo_checks where image_url = 'https://x/2.jpg'));

select sky_log_check(null, '7.7.7.7', 'https://x/3.jpg', 'math', 'check', 'long', '{"score": 7}'::jsonb, 0);
select t_check('score вне 1–5 не пишется, строка пишется',
  (select score is null from photo_checks where image_url = 'https://x/3.jpg'));
select sky_log_check(null, '7.7.7.7', 'https://x/4.jpg', 'math', 'check', 'long', '{"score": "4.2"}'::jsonb, 0);
select t_check('score строкой не пишется',
  (select score is null from photo_checks where image_url = 'https://x/4.jpg'));
select sky_log_check(null, '7.7.7.7', 'https://x/5.jpg', 'math', 'check', 'long', '{"score": 3.66}'::jsonb, 0);
select t_check('score округляется до десятых',
  (select score = 3.7 from photo_checks where image_url = 'https://x/5.jpg'));
select sky_log_check(null, '7.7.7.7', 'https://x/6.jpg', 'math', 'check', 'long', '{"criteria": {"logic": 4}}'::jsonb, 0);
select t_check('критерии-объект (сочинение) в колонку не пишутся этой функцией',
  (select criteria is null from photo_checks where image_url = 'https://x/6.jpg'));

select t_expect_denied('ограничение: score 6 в таблицу не попадает',
  $q$ insert into photo_checks (image_url, score) values ('https://x/7.jpg', 6) $q$);

set role authenticated;
select t_expect_denied('ученик не вызывает sky_log_check сам',
  $q$ select sky_log_check(null, '1.1.1.1', null, null, 'check', 'long', '{"score": 5}'::jsonb, 0) $q$);
reset role;
set role anon;
select t_expect_denied('аноним не вызывает sky_log_check',
  $q$ select sky_log_check(null, '1.1.1.1', null, null, 'check', 'long', '{"score": 5}'::jsonb, 0) $q$);
reset role;

-- ---------------------------------------------------------------------
-- Итог
-- ---------------------------------------------------------------------
\o
select case when ok then ' ✓ ' else ' ✗ ' end as " ", rpad(what, 55) as "проверка", details as "подробности"
  from _test_results order by n;

select count(*) as "всего", count(*) filter (where ok) as "прошло", count(*) filter (where not ok) as "провалено"
  from _test_results;

do $$
begin
  if exists (select 1 from _test_results where not ok) then
    raise exception 'Есть проваленные проверки критериев — см. таблицу выше';
  end if;
  raise notice 'Все проверки критериев пройдены.';
end $$;
