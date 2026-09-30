-- =====================================================================
-- Тесты: админка без ручного SQL (sql/schema-admin-automation.sql).
-- Запуск — scripts/test-rls.sh, после text-admin-tests.sql в той же
-- одноразовой базе: люди и заявки оттуда уже есть.
--   A aaaaaaaa…01 (Премиум), B bbbbbbbb…02 (Платный, истёк),
--   C cccccccc…03, T dddddddd…04, M eeeeeeee…0a — админ,
--   S ffffffff…0f — обычный ученик.
-- =====================================================================

\set ON_ERROR_STOP on
\timing off
\o /dev/null

truncate _test_results;
reset role;

insert into payments (id, user_id, amount, plan, purpose, status) values
  ('88888888-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000004', 209, 'premium', 'premium_tariff', 'pending'),
  ('88888888-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000004', 59,  'paid',    'paid_tariff',    'pending'),
  ('88888888-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003', 40,  null,      'plagiarism',     'pending'),
  ('88888888-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 59,  'paid',    'paid_tariff',    'pending');
update auth.users set created_at = '2025-01-15' where id = 'dddddddd-0000-0000-0000-000000000004';

-- ---------------------------------------------------------------------
-- Не админ и аноним
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-0000-0000-00000000000f', false);
select t_expect_denied('ученик: admin_grant_tariff — нет',
  $q$ select admin_grant_tariff('ffffffff-0000-0000-0000-00000000000f', 'premium', 365) $q$);
select t_expect_denied('ученик: admin_confirm_payment — нет',
  $q$ select admin_confirm_payment('88888888-0000-0000-0000-000000000001', 30) $q$);
select t_expect_denied('ученик: admin_user_list — нет', $q$ select * from admin_user_list() $q$);
select t_expect_denied('ученик: admin_subscriptions — нет', $q$ select * from admin_subscriptions() $q$);
select t_expect_denied('ученик: admin_audit_log — нет', $q$ select * from admin_audit_log() $q$);
select t_expect_denied('ученик: журнал напрямую — нет', $q$ select * from audit_log $q$);
select t_expect_denied('ученик: писать в журнал — нет', $q$ insert into audit_log (action) values ('x') $q$);
select t_expect_denied('ученик: служебная _audit — нет', $q$ select _audit('x', null, null, '{}') $q$);
select t_expect_denied('ученик: sky_payment_info — только Worker', $q$ select sky_payment_info('88888888-0000-0000-0000-000000000001') $q$);
select t_check('ученик: тариф не поменялся попытками',
  not exists (select 1 from user_plans where user_id = 'ffffffff-0000-0000-0000-00000000000f' and expires_at > now() + interval '300 days'));

insert into user_telegram (user_id, chat_id) values ('ffffffff-0000-0000-0000-00000000000f', '555000111');
select t_check('Telegram: свой chat_id — можно', (select chat_id = '555000111' from user_telegram));
select t_expect_denied('Telegram: чужой chat_id — нет',
  $q$ insert into user_telegram (user_id, chat_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '123456') $q$);
select t_expect_denied('Telegram: не цифры — нет',
  $q$ update user_telegram set chat_id = 'abc' where user_id = 'ffffffff-0000-0000-0000-00000000000f' $q$);
reset role;
insert into user_telegram (user_id, chat_id) values ('aaaaaaaa-0000-0000-0000-000000000001', '777000222');
set role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-0000-0000-00000000000f', false);
select t_check('Telegram: чужие строки не видно', (select count(*) = 1 from user_telegram));
reset role;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select t_expect_denied('аноним: admin_user_list — нет', $q$ select * from admin_user_list() $q$);
select t_expect_denied('аноним: user_telegram — нет', $q$ select * from user_telegram $q$);
reset role;

-- ---------------------------------------------------------------------
-- Админ: тарифы
-- ---------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-00000000000a', false);

select t_check('выдать: Премиум на 30 дней',
  (select r ->> 'plan' = 'premium' and (r ->> 'expires_at')::timestamptz between now() + interval '29 days' and now() + interval '31 days'
     from admin_grant_tariff('dddddddd-0000-0000-0000-000000000004', 'premium', 30) r));
select t_check('выдать: в журнале — кто, кому, что',
  (select action = 'grant_tariff' and actor_email = 'admin@test' and target_email = 't@test' and details ->> 'plan' = 'premium'
     from admin_audit_log(1)));
select t_check('продлить на 10: +10 дней к сроку',
  (select (r ->> 'expires_at')::timestamptz between now() + interval '39 days' and now() + interval '41 days'
     from admin_extend_tariff('dddddddd-0000-0000-0000-000000000004', 10) r));
select t_check('продлить: в журнале было и стало',
  (select action = 'extend_tariff' and details ->> 'days' = '10' and details ? 'prev_expires_at' from admin_audit_log(1)));
select t_expect_denied('продлить Бесплатный — ошибка',
  $q$ select admin_extend_tariff('cccccccc-0000-0000-0000-000000000003', 30) $q$);
select t_expect_denied('продлить на 0 дней — ошибка',
  $q$ select admin_extend_tariff('dddddddd-0000-0000-0000-000000000004', 0) $q$);
select t_check('снять: Бесплатный без срока',
  (select r ->> 'plan' = 'free' and r ->> 'expires_at' is null from admin_revoke_tariff('dddddddd-0000-0000-0000-000000000004') r));
select t_check('снять: в журнале прежний тариф', (select action = 'revoke_tariff' and details ->> 'prev_plan' = 'premium' from admin_audit_log(1)));
select t_check('выдать бессрочно', (select r ->> 'expires_at' is null from admin_grant_tariff('dddddddd-0000-0000-0000-000000000004', 'paid', null) r));
select t_expect_denied('продлить бессрочный — ошибка',
  $q$ select admin_extend_tariff('dddddddd-0000-0000-0000-000000000004', 30) $q$);
select t_expect_denied('неизвестный тариф — ошибка',
  $q$ select admin_grant_tariff('dddddddd-0000-0000-0000-000000000004', 'gold', 30) $q$);
select t_expect_denied('срок больше 3660 дней — ошибка',
  $q$ select admin_grant_tariff('dddddddd-0000-0000-0000-000000000004', 'paid', 5000) $q$);

select t_check('выдать многим: повторы не считаются',
  (select (r ->> 'count')::int = 2 from admin_bulk_grant(array['aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003']::uuid[], 'paid', 7) r));
-- user_plans напрямую админу не видны (RLS: только своя строка) — смотрим функциями админки
select t_check('выдать многим: у обоих Платный на 7 дней',
  (select count(*) = 2 from admin_user_list(null, 'paid', null, null, 100)
    where email in ('a@test', 'c@test') and expires_at between now() + interval '6 days' and now() + interval '8 days'));
select t_check('выдать многим: итог в журнале', (select action = 'bulk_grant' and details ->> 'count' = '2' from admin_audit_log(1)));
select t_check('выдать многим: списывание у C не сбросилось',
  (select (c ->> 'plagiarism')::boolean from admin_user_card('cccccccc-0000-0000-0000-000000000003') c));
select t_expect_denied('выдать многим: пустой список — ошибка', $q$ select admin_bulk_grant(array[]::uuid[], 'paid', 7) $q$);

select t_check('старая admin_set_plan работает',
  (select r ->> 'plan' = 'premium' from admin_set_plan('aaaaaaaa-0000-0000-0000-000000000001', 'premium', 90, null) r));
select t_check('старая admin_set_plan пишет в журнал', (select action = 'grant_tariff' and target_email = 'a@test' from admin_audit_log(1)));

-- ---------------------------------------------------------------------
-- Админ: оплаты
-- ---------------------------------------------------------------------
select t_check('подтвердить: ответ — paid и выданный тариф',
  (select r ->> 'status' = 'paid' and r -> 'plan' ->> 'plan' = 'premium'
     from admin_confirm_payment('88888888-0000-0000-0000-000000000001', 30) r));
select t_check('подтвердить: заявка в списке оплачена',
  (select status = 'paid' from admin_payment_list('', null, null, 't@test', 50) where id = '88888888-0000-0000-0000-000000000001'));
select t_check('подтвердить: в журнале с номером заявки и суммой',
  (select action = 'confirm_payment' and payment_id = '88888888-0000-0000-0000-000000000001' and details ->> 'amount' = '209' from admin_audit_log(1)));
select t_expect_denied('подтвердить повторно — ошибка',
  $q$ select admin_confirm_payment('88888888-0000-0000-0000-000000000001', 30) $q$);
select t_check('отклонить: заявка отклонена',
  (select r ->> 'status' = 'rejected' from admin_reject_payment('88888888-0000-0000-0000-000000000002') r));
select t_check('отклонить: тариф прежний', (select c ->> 'plan' = 'premium' from admin_user_card('dddddddd-0000-0000-0000-000000000004') c));
select t_check('отклонить: в журнале', (select action = 'reject_payment' and payment_id = '88888888-0000-0000-0000-000000000002' from admin_audit_log(1)));
select t_check('покупка списывания: подтверждена',
  (select r ->> 'status' = 'paid' from admin_confirm_payment('88888888-0000-0000-0000-000000000003', 30) r));
select t_check('покупка списывания: проверка включена',
  (select (c ->> 'plagiarism')::boolean from admin_user_card('cccccccc-0000-0000-0000-000000000003') c));
select t_check('старая admin_payment_decide: тот же ответ',
  (select r = '{"status": "paid"}'::jsonb from admin_payment_decide('88888888-0000-0000-0000-000000000004', true, 30) r));
select t_check('старая admin_payment_decide: пишет в журнал',
  (select action = 'confirm_payment' and payment_id = '88888888-0000-0000-0000-000000000004' from admin_audit_log(1)));

select t_check('оплаты: фильтр по статусу', (select count(*) >= 3 and bool_and(status = 'paid') from admin_payment_list('paid', null, null, null, 100)));
select t_check('оплаты: фильтр по почте',
  (select count(*) filter (where email = 't@test') = 2 and bool_and(email ilike '%t@test%') from admin_payment_list('', null, null, 't@test', 100)));
select t_check('оплаты: фильтр по дате (завтра — пусто)', not exists (select 1 from admin_payment_list('', current_date + 1, null, null, 100)));
select t_check('оплаты: отметка «есть Telegram»', (select bool_or(telegram) from admin_payment_list('', null, null, 'student@', 100)));

-- ---------------------------------------------------------------------
-- Админ: пользователи, карточка, Telegram
-- ---------------------------------------------------------------------
-- B только что оплатил — делаем его тариф истёкшим, чтобы было что искать
reset role;
update user_plans set expires_at = now() - interval '2 days' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
set role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-00000000000a', false);
select t_check('пользователи: фильтр по тарифу', (select count(*) >= 1 and bool_and(plan = 'premium' and plan_active) from admin_user_list(null, 'premium', null, null, 100)));
select t_check('пользователи: Бесплатный — без действующего тарифа', (select bool_and(not plan_active) from admin_user_list(null, 'free', null, null, 100)));
select t_check('пользователи: истёкшие', (select count(*) >= 1 and bool_and(expires_at <= now()) from admin_user_list(null, 'expired', null, null, 100)));
select t_check('пользователи: по дате регистрации',
  (select count(*) = 1 and bool_and(email = 't@test') from admin_user_list(null, null, '2025-01-01', '2025-01-31', 100)));
select t_check('пользователи: поиск по части почты', (select count(*) = 2 from admin_user_list('t@test', null, null, null, 100)));
select t_check('пользователи: дата активации есть',
  (select activated_at is not null from admin_user_list('t@test', null, null, null, 100) where email = 't@test'));

select t_check('карточка: тариф, оплаты, журнал',
  (select c ->> 'email' = 't@test' and c ->> 'plan' = 'premium' and (c ->> 'plan_active')::boolean
          and jsonb_array_length(c -> 'payments') = 2 and jsonb_array_length(c -> 'audit') >= 4
          and c ->> 'telegram_chat_id' is null
     from admin_user_card('dddddddd-0000-0000-0000-000000000004') c));
select t_check('Telegram: админ ставит chat_id (пробелы по краям — не мешают)',
  (select r ->> 'telegram_chat_id' = '-1001234567' from admin_set_telegram('dddddddd-0000-0000-0000-000000000004', ' -1001234567 ') r));
select t_check('Telegram: chat_id в карточке',
  (select c ->> 'telegram_chat_id' = '-1001234567' from admin_user_card('dddddddd-0000-0000-0000-000000000004') c));
select t_expect_denied('Telegram: буквы — ошибка', $q$ select admin_set_telegram('dddddddd-0000-0000-0000-000000000004', 'abc') $q$);
select admin_set_telegram('dddddddd-0000-0000-0000-000000000004', '');
select t_check('Telegram: пусто — убрать', (select c ->> 'telegram_chat_id' is null from admin_user_card('dddddddd-0000-0000-0000-000000000004') c));
select admin_set_telegram('dddddddd-0000-0000-0000-000000000004', '424242');

-- ---------------------------------------------------------------------
-- Админ: подписки, журнал, цены
-- ---------------------------------------------------------------------
select admin_grant_tariff('ffffffff-0000-0000-0000-00000000000f', 'paid', 3);
select t_check('подписки: истекает за 7 дней', (select state = 'expiring' and days_left between 2 and 3 from admin_subscriptions() where email = 'student@test'));
select t_check('подписки: действует', (select state = 'active' from admin_subscriptions() where email = 't@test'));
select t_check('подписки: истекла', (select state = 'expired' and days_left <= 0 from admin_subscriptions() where email = 'b@test'));
select t_check('подписки: Бесплатных в списке нет', not exists (select 1 from admin_subscriptions() where plan = 'free'));
select admin_extend_tariff('ffffffff-0000-0000-0000-00000000000f', 30);
select t_check('продлить на 30 из подписок: истекающая стала действующей',
  (select state = 'active' and days_left between 32 and 34 from admin_subscriptions() where email = 'student@test'));

select t_check('журнал: фильтр по пользователю', (select count(*) >= 5 and bool_and(target_email = 't@test') from admin_audit_log(100, 'dddddddd-0000-0000-0000-000000000004')));
select admin_update_limits('premium', '{"price_rub": 249}');
select t_check('цены: изменение в журнале — было и стало',
  (select action = 'update_limits' and details ->> 'plan' = 'premium' and details -> 'changes' -> 'price_rub' ->> 1 = '249'
     from admin_audit_log(1)));
reset role;

-- ---------------------------------------------------------------------
-- Worker: данные для уведомления
-- ---------------------------------------------------------------------
set role service_role;
select t_check('sky_payment_info: почта, тариф, срок, chat_id',
  (select r ->> 'email' = 't@test' and r ->> 'status' = 'paid' and r ->> 'plan' = 'premium' and r ->> 'chat_id' = '424242'
          and r ->> 'expires_at' is not null and (r ->> 'amount')::int = 209
     from sky_payment_info('88888888-0000-0000-0000-000000000001') r));
select t_check('sky_payment_info: нет такой — null', sky_payment_info('88888888-0000-0000-0000-00000000ffff') is null);
select t_check('sky_is_admin: админ — да', sky_is_admin('eeeeeeee-0000-0000-0000-00000000000a'));
select t_check('sky_is_admin: ученик — нет', not sky_is_admin('ffffffff-0000-0000-0000-00000000000f'));
select t_check('sky_is_admin: null — нет', not sky_is_admin(null));
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'eeeeeeee-0000-0000-0000-00000000000a', false);
select t_expect_denied('sky_is_admin: из браузера не вызвать (даже админу)', $q$ select sky_is_admin('eeeeeeee-0000-0000-0000-00000000000a') $q$);
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
    raise exception 'Есть проваленные проверки админки — см. таблицу выше';
  end if;
  raise notice 'Все проверки админки пройдены.';
end $$;
