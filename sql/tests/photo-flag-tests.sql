-- =====================================================================
-- Тесты: «Это распознано неверно» (sql/schema-photo-flag.sql поверх
-- schema-photo-limits.sql и schema-tariffs.sql). Запуск — scripts/test-rls.sh.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;
reset role;
-- сколько строк затронул запрос — от имени текущей роли (RLS действует)
create or replace function pf_rows(sql_text text) returns int language plpgsql as $$
declare n int;
begin
  execute sql_text;
  get diagnostics n = row_count;
  return n;
end $$;
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-0000-0000-0000-000000000001', 'pf-a@test', '{"name":"Аня","role":"student"}'),
  ('77777777-0000-0000-0000-000000000002', 'pf-b@test', '{"name":"Боря","role":"student"}')
on conflict (id) do nothing;

-- Проверки пишет Worker: ссылка без подписи
insert into photo_checks (id, user_id, image_url, recognized_text, grade, created_at) values
  ('77777777-1111-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001',
   'https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000001/s1/1.jpg', 'Тгх', 3, now()),
  ('77777777-1111-0000-0000-000000000002', '77777777-0000-0000-0000-000000000001',
   'https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000001/old/1.jpg', 'Старое', 4, now() - interval '3 days'),
  ('77777777-1111-0000-0000-000000000003', '77777777-0000-0000-0000-000000000002',
   'https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000002/s2/1.jpg', 'Чужое', 5, now());

select t_check('колонки ocr_flagged и ocr_flagged_at на месте, по умолчанию false',
  (select count(*) = 2 from information_schema.columns
     where table_name = 'photo_checks' and column_name in ('ocr_flagged', 'ocr_flagged_at'))
  and (select not ocr_flagged and ocr_flagged_at is null from photo_checks where id = '77777777-1111-0000-0000-000000000001'));
select t_check('функция security definer, гостю не выдана',
  (select prosecdef from pg_proc where oid = 'public.photo_check_flag(text)'::regprocedure)
  and has_function_privilege('authenticated', 'public.photo_check_flag(text)', 'execute')
  and not has_function_privilege('anon', 'public.photo_check_flag(text)', 'execute'));

-- ---------------------------------------------------------------------
-- Гость
-- ---------------------------------------------------------------------
set role anon;
select t_expect_denied('гость не отмечает', $q$ select photo_check_flag('https://sb.test/x.jpg') $q$);
reset role;

-- ---------------------------------------------------------------------
-- Ученик A
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '77777777-0000-0000-0000-000000000001', false);
select t_check('свою проверку по подписанной ссылке — отмечает',
  photo_check_flag('https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000001/s1/1.jpg?token=abc.def') = true);
select t_check('флаг виден в истории, время записано',
  (select ocr_flagged and ocr_flagged_at is not null from photo_checks where id = '77777777-1111-0000-0000-000000000001'));
select set_config('pf.first', (select ocr_flagged_at::text from photo_checks where id = '77777777-1111-0000-0000-000000000001'), false);
select pg_sleep(0.02);
select t_check('повторно — тоже true, время первой отметки не меняется',
  photo_check_flag('https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000001/s1/1.jpg?token=zzz') = true
  and (select ocr_flagged_at::text = current_setting('pf.first') from photo_checks where id = '77777777-1111-0000-0000-000000000001'));
select t_check('проверку старше суток — нет',
  photo_check_flag('https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000001/old/1.jpg?token=x') = false);
select t_check('чужую — нет (и не видит, что она есть)',
  photo_check_flag('https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000002/s2/1.jpg?token=x') = false);
select t_check('ещё не записанную (Worker не успел) — false',
  photo_check_flag('https://sb.test/storage/v1/object/sign/homework/77777777-0000-0000-0000-000000000001/s9/1.jpg?token=x') = false);
select t_check('пустую ссылку — false', photo_check_flag('') = false and photo_check_flag(null) = false);
select t_check('напрямую строку не правит (оценку не поднять)',
  pf_rows($q$ update photo_checks set grade = 5 where id = '77777777-1111-0000-0000-000000000001' $q$) = 0);
reset role;
select t_check('старая и чужая не отмечены, оценка не изменилась',
  (select not ocr_flagged from photo_checks where id = '77777777-1111-0000-0000-000000000002')
  and (select not ocr_flagged from photo_checks where id = '77777777-1111-0000-0000-000000000003')
  and (select grade = 3 from photo_checks where id = '77777777-1111-0000-0000-000000000001'));

-- ---------------------------------------------------------------------
-- Без входа (authenticated, но без sub) — исключение
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_denied('без пользователя в JWT — ошибка', $q$ select photo_check_flag('https://sb.test/x.jpg') $q$);
reset role;

delete from photo_checks where id::text like '77777777-1111-%';
delete from auth.users where email like 'pf-%@test';
drop function pf_rows(text);

\o
select case when ok then ' ✓ ' else ' ✗ ' end as " ", rpad(what, 60) as "проверка", details as "подробности"
  from _test_results order by n;
select count(*) as "всего", count(*) filter (where ok) as "прошло", count(*) filter (where not ok) as "провалено"
  from _test_results;
do $$
begin
  if exists (select 1 from _test_results where not ok) then
    raise exception 'Есть проваленные проверки флага распознавания — см. таблицу выше';
  end if;
  raise notice 'Все проверки флага распознавания пройдены.';
end $$;
