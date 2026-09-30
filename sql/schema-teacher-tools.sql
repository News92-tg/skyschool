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
