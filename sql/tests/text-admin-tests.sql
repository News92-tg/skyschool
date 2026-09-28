-- =====================================================================
-- Тесты: проверка сочинений (sql/schema-text-check.sql) и админка
-- (sql/schema-admin.sql). Запуск — scripts/test-rls.sh, после
-- tariffs-tests.sql в той же одноразовой базе.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;

-- Люди из tariffs-tests.sql уже есть: A (Премиум), B, C, T.
-- Новый: M — администратор, S — обычный ученик без тарифа.
insert into auth.users (id, email, email_confirmed_at) values
  ('eeeeeeee-0000-0000-0000-00000000000a', 'admin@test', now()),
  ('ffffffff-0000-0000-0000-00000000000f', 'student@test', now());
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = 'admin@test' and email_confirmed_at is not null;

-- ---------------------------------------------------------------------
-- Лимиты текста
-- ---------------------------------------------------------------------
select t_check('текст: Бесплатный — 1 запрос / 300 с',
  (select text_requests_per_window = 1 and text_window_seconds = 300 from sky_plan(null)));
select t_check('текст: Премиум — 5 запросов / 60 с',
  (select text_requests_per_window = 5 and text_window_seconds = 60 from sky_plan('aaaaaaaa-0000-0000-0000-000000000001')));
select t_check('текст: Платный в справочнике — 2 / 60 с',
  exists (select 1 from plan_limits where plan = 'paid' and text_requests_per_window = 2 and text_window_seconds = 60));
select t_check('фото-лимиты в sky_plan на месте',
  (select requests_per_window = 3 and photos_per_request = 20 and teacher from sky_plan('aaaaaaaa-0000-0000-0000-000000000001')));

-- ---------------------------------------------------------------------
-- Кэш и история текстовых проверок
-- ---------------------------------------------------------------------
select t_check('кэш пуст для нового хэша', not exists (select 1 from sky_text_cache('h-1', 7)));
select t_check('sky_log_text пишет проверку',
  sky_log_text(null, '5.5.5.5', 'russian', 'long', 'h-1',
    '{"assessment": 4, "comment": "Хорошо", "criteria": {"logic": 4}, "errors": [{"type": "орфография"}]}'::jsonb, 900) is not null);
select t_check('в истории: mode=text, хэш, критерии, оценка',
  (select mode = 'text' and text_hash = 'h-1' and criteria ->> 'logic' = '4' and grade = 4 and ai_feedback = 'Хорошо'
          and length = 'long' and tokens_used = 900
     from photo_checks where text_hash = 'h-1'));
select t_check('кэш находит разбор по хэшу',
  (select result ->> 'comment' = 'Хорошо' from sky_text_cache('h-1', 7)));
update photo_checks set created_at = now() - interval '8 days' where text_hash = 'h-1';
select t_check('разбор старше 7 дней из кэша не берётся', not exists (select 1 from sky_text_cache('h-1', 7)));
select t_check('фото-проверка с тем же хэшем в кэш не попадает',
  sky_log_check(null, '5.5.5.5', null, null, 'check', 'long', '{"comment":"фото"}'::jsonb, 0) is not null
  and not exists (select 1 from sky_text_cache('h-2', 7)));
select t_check('новые строки фото по умолчанию mode=photo',
  (select column_default like '%photo%' from information_schema.columns where table_name = 'photo_checks' and column_name = 'mode'));

select sky_rate(null, '6.6.6.6', 'text', 300, 1, 1);
select sky_log_text(null, '6.6.6.6', 'russian', 'short', 'h-3', '{"assessment": 5}'::jsonb, 250);
select t_check('токены текста — в окно scope=text',
  (select tokens_used = 250 from usage_limits where ip = '6.6.6.6' and scope = 'text'));
select t_check('лимит текста не трогает лимит фото',
  not exists (select 1 from usage_limits where ip = '6.6.6.6' and scope = 'check'));

-- ---------------------------------------------------------------------
-- Админка: не админ
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-0000-0000-00000000000f', false);
select t_check('ученик — не админ', not is_admin());
select t_expect_denied('ученик не видит обзор',        $q$ select admin_overview('UTC') $q$);
select t_expect_denied('ученик не видит пользователей', $q$ select * from admin_users(null, 10) $q$);
select t_expect_denied('ученик не выдаёт себе Премиум',
  $q$ select admin_set_plan('ffffffff-0000-0000-0000-00000000000f', 'premium', 30, true) $q$);
select t_expect_denied('ученик не меняет цены',       $q$ select admin_update_limits('premium', '{"price_rub": 1}') $q$);
select t_expect_denied('ученик не читает список админов', $q$ select count(*) from app_admins $q$);
select t_expect_denied('ученик не вызывает кэш Worker',  $q$ select * from sky_text_cache('h-1', 7) $q$);
select t_expect_denied('ученик не пишет текстовую проверку',
  $q$ select sky_log_text(auth.uid(), null, null, null, 'x', '{"assessment":5}'::jsonb, 0) $q$);
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_denied('без входа — не вызвать is_admin',  $q$ select is_admin() $q$);
select t_expect_denied('без входа — не вызвать admin_overview', $q$ select admin_overview('UTC') $q$);
reset role;

-- ---------------------------------------------------------------------
-- Админка: админ
-- ---------------------------------------------------------------------
insert into payments (id, user_id, amount, plan, purpose, status) values
  ('99999999-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-00000000000f', 209, 'premium', 'premium_tariff', 'pending'),
  ('99999999-0000-0000-0000-000000000002', 'ffffffff-0000-0000-0000-00000000000f', 40, null, 'plagiarism', 'pending'),
  ('99999999-0000-0000-0000-000000000003', 'ffffffff-0000-0000-0000-00000000000f', 59, 'paid', 'paid_tariff', 'pending');

set role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-00000000000a', false);
select t_check('админ — админ', is_admin());
select t_check('обзор: пользователи, очередь оплат, проверки по дням',
  (select (o ->> 'users_total')::int >= 6 and (o ->> 'payments_pending')::int = 3
          and jsonb_array_length(o -> 'daily') >= 1 and (o -> 'plans') ? 'premium'
     from admin_overview('Europe/Moscow') o));
select t_check('пользователи: поиск по почте',
  (select count(*) = 1 and bool_and(email = 'student@test' and plan = 'free' and not plan_active) from admin_users('student@', 50)));
select t_check('пользователи: админ помечен',
  (select admin from admin_users('admin@test', 5)));
select t_check('выдать Премиум на 30 дней',
  (select (r ->> 'plan') = 'premium' and (r ->> 'expires_at')::timestamptz between now() + interval '29 days' and now() + interval '31 days'
     from admin_set_plan('ffffffff-0000-0000-0000-00000000000f', 'premium', 30, null) r));
select t_check('после выдачи — Премиум действует',
  (select plan = 'premium' and plan_active from admin_users('student@', 5)));
select t_check('бессрочно (дней = null) и со списыванием',
  (select (r ->> 'expires_at') is null and (r ->> 'plagiarism_enabled')::boolean
     from admin_set_plan('ffffffff-0000-0000-0000-00000000000f', 'paid', null, true) r));
select t_expect_denied('неизвестный тариф — ошибка',
  $q$ select admin_set_plan('ffffffff-0000-0000-0000-00000000000f', 'gold', 30, null) $q$);
select t_expect_denied('0 дней — ошибка',
  $q$ select admin_set_plan('ffffffff-0000-0000-0000-00000000000f', 'paid', 0, null) $q$);

select t_check('оплаты: в очереди три заявки', (select count(*) = 3 from admin_payments('pending', 50)));
select t_check('подтвердить Премиум: заявка оплачена',
  (select r ->> 'status' = 'paid' from admin_payment_decide('99999999-0000-0000-0000-000000000001', true, 30) r));
select t_check('после оплаты — Премиум на 30 дней',
  (select plan = 'premium' and expires_at > now() + interval '29 days' from admin_users('student@', 5)));
select t_check('подтвердить списывание: флаг включён',
  (select r ->> 'status' = 'paid' from admin_payment_decide('99999999-0000-0000-0000-000000000002', true, 30) r)
  and (select plagiarism from admin_users('student@', 5)));
select t_check('отклонить заявку',
  (select r ->> 'status' = 'rejected' from admin_payment_decide('99999999-0000-0000-0000-000000000003', false, 30) r));
select t_check('отклонённая не поменяла тариф', (select plan = 'premium' from admin_users('student@', 5)));
select t_expect_denied('повторное решение по заявке — ошибка',
  $q$ select admin_payment_decide('99999999-0000-0000-0000-000000000001', true, 30) $q$);

select t_check('проверки: только текст', (select count(*) >= 2 and bool_and(mode = 'text') from admin_checks('text', 50)));
select t_check('проверки: только фото', (select count(*) >= 1 and bool_and(mode <> 'text') from admin_checks('photo', 50)));

select t_check('поменять цену и лимит текста',
  (select (r ->> 'price_rub')::int = 199 and (r ->> 'text_requests_per_window')::int = 6
     from admin_update_limits('premium', '{"price_rub": 199, "text_requests_per_window": 6}') r));
select t_expect_denied('нулевой лимит — ошибка, цена не поменялась',
  $q$ select admin_update_limits('premium', '{"price_rub": 1, "requests_per_window": 0}') $q$);
select t_check('после отказа цена прежняя', (select price_rub = 199 from plan_limits where plan = 'premium'));
select t_expect_denied('лишнее поле — ошибка',
  $q$ select admin_update_limits('premium', '{"plan": "free"}') $q$);
reset role;
select t_check('новый лимит текста сразу в sky_plan',
  (select text_requests_per_window = 6 from sky_plan('aaaaaaaa-0000-0000-0000-000000000001')));

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
    raise exception 'Есть проваленные проверки текста и админки — см. таблицу выше';
  end if;
  raise notice 'Все проверки текста и админки пройдены.';
end $$;
