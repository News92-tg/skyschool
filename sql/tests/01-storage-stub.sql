-- =====================================================================
-- Заглушка хранилища Supabase (схема storage) для локальных тестов —
-- как 00-supabase-stub.sql для auth. Ровно то, на что опираются наши
-- схемы: бакеты, объекты с RLS и storage.foldername().
-- =====================================================================
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
