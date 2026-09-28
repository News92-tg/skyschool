-- =====================================================================
-- Тесты тарифов и лимитов (sql/schema-tariffs.sql)
--
-- Запуск — scripts/test-rls.sh, вторая часть. Вручную, на ОДНОРАЗОВОЙ
-- базе:
--   psql -f sql/tests/00-supabase-stub.sql
--   psql -f sql/schema-photo-limits.sql
--   psql -f sql/schema-tariffs.sql
--   psql -f sql/tests/tariffs-tests.sql
-- =====================================================================

\set ON_ERROR_STOP on
\timing off

create table if not exists _test_results (
  n       serial primary key,
  what    text,
  ok      boolean,
  details text
);
truncate _test_results;

create or replace function t_record(what text, ok boolean, details text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into _test_results (what, ok, details) values (what, ok, details);
end $$;

create or replace function t_check(what text, ok boolean, details text default '')
returns void language plpgsql as $$
begin
  perform t_record(what, coalesce(ok, false), coalesce(details, ''));
end $$;

-- Не security definer: SQL должен выполниться с правами вызывающего.
create or replace function t_expect_denied(what text, sql_text text)
returns void language plpgsql as $$
begin
  begin
    execute sql_text;
    perform t_record(what, false, 'ПРОШЛО, хотя должно быть запрещено');
  exception when others then
    perform t_record(what, true, 'запрещено: ' || left(sqlerrm, 70));
  end;
end $$;

grant execute on function t_check(text, boolean, text) to authenticated, anon;
grant execute on function t_expect_denied(text, text) to authenticated, anon;
grant execute on function t_record(text, boolean, text) to authenticated, anon;

-- промежуточные результаты не печатаем, итоговая таблица — в конце
\o /dev/null

-- ---------------------------------------------------------------------
-- Люди
--   A — Премиум до конца месяца
--   B — Платный, но истёк вчера
--   C — Бесплатный, докупил проверку на списывание
--   T — учитель
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test'),
  ('dddddddd-0000-0000-0000-000000000004', 't@test');

insert into user_plans (user_id, plan, expires_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'premium', now() + interval '30 days'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'paid',    now() - interval '1 day');
insert into user_plans (user_id, plan, plagiarism_enabled) values
  ('cccccccc-0000-0000-0000-000000000003', 'free', true);

-- ---------------------------------------------------------------------
-- Справочник
-- ---------------------------------------------------------------------
select t_check('в справочнике есть Платный за 59 ₽',
  exists (select 1 from plan_limits where plan = 'paid' and price_rub = 59 and requests_per_window = 1 and window_seconds = 60 and photos_per_request = 10));
select t_check('в справочнике есть Премиум за 209 ₽',
  exists (select 1 from plan_limits where plan = 'premium' and price_rub = 209 and requests_per_window = 3 and feature_teacher));
select t_check('старые тарифы не удалены и получили лимиты',
  (select count(*) from plan_limits where plan in ('basic', 'pro', 'family') and requests_per_window is not null) = 3);

-- ---------------------------------------------------------------------
-- sky_plan
-- ---------------------------------------------------------------------
select t_check('без входа — бесплатный: 1 запрос / 600 с, 5 фото',
  (select plan = 'free' and requests_per_window = 1 and window_seconds = 600 and photos_per_request = 5 and not compare
     from sky_plan(null)));
select t_check('действующий Премиум',
  (select plan = 'premium' and teacher and plagiarism and compare and photos_per_request = 20
     from sky_plan('aaaaaaaa-0000-0000-0000-000000000001')));
select t_check('истёкший Платный = бесплатный',
  (select plan = 'free' and not compare from sky_plan('bbbbbbbb-0000-0000-0000-000000000002')));
select t_check('докупленная проверка на списывание на бесплатном',
  (select plan = 'free' and plagiarism from sky_plan('cccccccc-0000-0000-0000-000000000003')));

-- ---------------------------------------------------------------------
-- sky_rate: Премиум, 3 запроса в минуту
-- ---------------------------------------------------------------------
select t_check('Премиум: 1-й запрос проходит',
  (select allowed and remaining = 2 and reset_in = 60 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', '9.9.9.9', 'check', 60, 3, 1)));
select t_check('Премиум: 2-й',
  (select allowed and remaining = 1 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', '9.9.9.9', 'check', 60, 3, 1)));
select t_check('Премиум: 3-й',
  (select allowed and remaining = 0 and retry_after between 1 and 60 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', '9.9.9.9', 'check', 60, 3, 1)));
select t_check('Премиум: 4-й в ту же минуту — отказ с retry_after',
  (select not allowed and remaining = 0 and retry_after between 1 and 60 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', '9.9.9.9', 'check', 60, 3, 1)));
select t_check('отказ ничего не списал: в окне ровно 3',
  (select requests_count = 3 from usage_limits where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and scope = 'check'));
select t_check('просмотр остатка без списания',
  (select not allowed and remaining = 0 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', null, 'check', 60, 3, 0)));
select t_check('возврат после сбоя модели',
  (select allowed and remaining = 1 and retry_after = 0 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', null, 'check', 60, 3, -1)));
select t_check('после возврата снова можно',
  (select allowed and remaining = 0 from sky_rate('aaaaaaaa-0000-0000-0000-000000000001', null, 'check', 60, 3, 1)));

-- ---------------------------------------------------------------------
-- sky_rate: без входа, по IP, 1 запрос за 10 минут
-- ---------------------------------------------------------------------
select t_check('IP: первый запрос',
  (select allowed from sky_rate(null, '1.1.1.1', 'check', 600, 1, 1)));
select t_check('IP: второй сразу — отказ, ждать до 10 минут',
  (select not allowed and retry_after between 590 and 600 from sky_rate(null, '1.1.1.1', 'check', 600, 1, 1)));
select t_check('другой IP не задет',
  (select allowed from sky_rate(null, '2.2.2.2', 'check', 600, 1, 1)));
select t_check('отправка работ считается отдельно от проверок',
  (select allowed from sky_rate(null, '1.1.1.1', 'submit', 600, 10, 1)));
select t_check('вошедший с того же IP не делит лимит с анонимом',
  (select allowed from sky_rate('bbbbbbbb-0000-0000-0000-000000000002', '1.1.1.1', 'check', 600, 1, 1)));

update usage_limits set window_start = now() - interval '11 minutes'
 where user_id is null and ip = '1.1.1.1' and scope = 'check';
select t_check('через 10 минут окно открывается заново',
  (select allowed from sky_rate(null, '1.1.1.1', 'check', 600, 1, 1)));
select t_check('без пользователя и IP не падает',
  (select allowed from sky_rate(null, null, 'check', 600, 1, 1)));
do $$ begin
  perform sky_rate(null, '3.3.3.3', 'check', 0, 1, 1);
  perform t_record('нулевое окно — ошибка, а не пропуск', false, 'прошло');
exception when others then
  perform t_record('нулевое окно — ошибка, а не пропуск', true, left(sqlerrm, 60));
end $$;

-- ---------------------------------------------------------------------
-- История и токены
-- ---------------------------------------------------------------------
select t_check('sky_log_check пишет историю',
  sky_log_check('aaaaaaaa-0000-0000-0000-000000000001', '9.9.9.9', 'https://x/homework/a.jpg', 'физика', 'grade', 'long',
    '{"assessment": 4, "comment": "Хорошо", "recognized_text": "F=ma", "errors": [{"type":"x"}]}'::jsonb, 1234) is not null);
select t_check('оценка, текст и ошибки разложены по колонкам',
  (select grade = 4 and ai_feedback = 'Хорошо' and recognized_text = 'F=ma' and jsonb_array_length(errors) = 1
          and mode = 'grade' and tokens_used = 1234 and ip = '9.9.9.9'
     from photo_checks where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
select t_check('токены добавлены в текущее окно',
  (select tokens_used = 1234 from usage_limits where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and scope = 'check'));
do $$
declare v uuid;
begin
  v := sky_log_check(null, '1.1.1.1', null, null, 'check', 'short', '{"assessment": "N/A"}'::jsonb, 0);
  perform t_check('оценка "N/A" не ломает запись',
    (select grade is null and mode = 'check' and user_id is null from photo_checks where id = v));
end $$;

-- ---------------------------------------------------------------------
-- Работы по ссылке: итоги проверки
-- ---------------------------------------------------------------------
insert into homework_submissions (id, student_name, class, subject, img_url, teacher_id) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Иванов Иван', '9А', 'физика', 'submissions/e1.jpg', 'dddddddd-0000-0000-0000-000000000004'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Петров Пётр', '9А', 'физика', 'submissions/e2.jpg', null);
select t_check('sky_submissions_update меняет статусы',
  sky_submissions_update('[{"id":"eeeeeeee-0000-0000-0000-000000000001","status":"checked","result":{"assessment":5}},
                           {"id":"eeeeeeee-0000-0000-0000-000000000002","status":"bogus"}]'::jsonb) = 1);
select t_check('недопустимый статус пропущен',
  (select status = 'pending' from homework_submissions where id = 'eeeeeeee-0000-0000-0000-000000000002'));

-- ---------------------------------------------------------------------
-- Права: ученик под своим JWT
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);

select t_expect_denied('ученик не вызывает sky_plan',  $q$ select * from sky_plan(null) $q$);
select t_expect_denied('ученик не вызывает sky_rate',  $q$ select * from sky_rate(auth.uid(), null, 'check', 60, 999, -999) $q$);
select t_expect_denied('ученик не пишет историю через sky_log_check',
  $q$ select sky_log_check(auth.uid(), null, null, null, null, null, '{"assessment":5}'::jsonb, 0) $q$);
select t_expect_denied('ученик не меняет статусы работ',
  $q$ select sky_submissions_update('[]'::jsonb) $q$);

select t_check('ученик видит только свои окна лимитов',
  (select count(*) = count(*) filter (where user_id = auth.uid()) and count(*) > 0 from usage_limits));
select t_expect_denied('ученик не сбрасывает себе лимит',
  $q$ update usage_limits set requests_count = 0 where user_id = auth.uid() returning id $q$);
select t_expect_denied('ученик не создаёт себе окно',
  $q$ insert into usage_limits (user_id, requests_count) values (auth.uid(), 0) $q$);
select t_expect_denied('ученик не выписывает себе Премиум',
  $q$ insert into user_plans (user_id, plan) values (auth.uid(), 'premium') on conflict (user_id) do update set plan = 'premium' $q$);
select t_expect_denied('ученик не пишет себе оценку в историю',
  $q$ insert into photo_checks (user_id, grade) values (auth.uid(), 5) $q$);
select t_expect_denied('ученик не создаёт себе платёж со своей суммой',
  $q$ insert into payments (user_id, amount, plan, purpose) values (auth.uid(), 1, 'premium', 'premium_tariff') $q$);
select t_check('ученик видит свою историю',
  (select count(*) = 1 from photo_checks));

with ins as (
  insert into homework_submissions (student_id, student_name, class, img_url)
  values (auth.uid(), 'Я', '9Б', 'aaaaaaaa-0000-0000-0000-000000000001/x.jpg') returning id)
select t_check('ученик отправляет свою работу', count(*) = 1) from ins;
select t_expect_denied('нельзя отправить работу от чужого имени',
  $q$ insert into homework_submissions (student_id, student_name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Чужой') $q$);
select t_expect_denied('нельзя отправить сразу «проверено»',
  $q$ insert into homework_submissions (student_id, student_name, status, result) values (auth.uid(), 'Я', 'checked', '{"assessment":5}') $q$);
select t_expect_denied('нельзя поменять результат своей работы',
  $q$ update homework_submissions set result = '{"assessment":5}' where student_id = auth.uid() returning id $q$);
select t_check('ученик видит только свою работу',
  (select count(*) = 1 from homework_submissions));

-- ---------------------------------------------------------------------
-- Права: учитель
-- ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', 'dddddddd-0000-0000-0000-000000000004', false);
select t_check('учитель видит работы, адресованные ему, и только их',
  (select count(*) = 1 and bool_and(teacher_id = auth.uid()) from homework_submissions));
select t_check('учитель не видит чужие окна лимитов',
  (select count(*) = 0 from usage_limits));

-- ---------------------------------------------------------------------
-- Права: без входа
-- ---------------------------------------------------------------------
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_denied('аноним не читает работы',    $q$ select count(*) from homework_submissions $q$);
select t_expect_denied('аноним не читает окна',      $q$ select count(*) from usage_limits $q$);
select t_expect_denied('аноним не вызывает sky_rate', $q$ select * from sky_rate(null, '1.1.1.1', 'check', 600, 1, -1) $q$);
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
    raise exception 'Есть проваленные проверки тарифов — см. таблицу выше';
  end if;
  raise notice 'Все проверки тарифов пройдены.';
end $$;
