-- =====================================================================
-- Заглушка того, что в облачном Supabase уже есть из коробки.
--
-- Нужна ТОЛЬКО для локального прогона тестов на чистом PostgreSQL.
-- На живой базе Supabase этот файл выполнять НЕ надо — там всё это
-- уже есть, и попытка создать заново ничего хорошего не даст.
--
-- Что подменяем:
--   auth.users              — таблица аккаунтов (её ведёт Supabase Auth)
--   auth.uid()              — id текущего пользователя из JWT
--   роли authenticated/anon — под ними ходят посетители
--   publication supabase_realtime — список таблиц для живых обновлений
-- =====================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb default '{}'::jsonb
);

-- В Supabase auth.uid() достаёт id пользователя из JWT.
-- Локально берём из настройки сессии — так тесты могут «входить»
-- за разных людей, не поднимая настоящую авторизацию.
create or replace function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

grant usage on schema public, auth to authenticated, anon;
grant select on auth.users to authenticated, anon;

-- Права на таблицы: RLS решает, КАКИЕ строки видно, а grant — есть ли
-- доступ к таблице вообще. Нужны оба.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
