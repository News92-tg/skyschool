-- SkyySchool — Supabase access hardening
-- Run AFTER sql/schema.sql.
-- Fixes PostgreSQL table privileges that can produce REST 403
-- "permission denied for table ..." even when RLS policies exist.

begin;

grant usage on schema public to anon, authenticated;

-- Public/profile discovery and authenticated application data.
grant select on table public.profiles to anon, authenticated;
grant select, insert, update, delete on table public.links to authenticated;
grant select, insert, update, delete on table public.homework to authenticated;
grant select, insert, update, delete on table public.submissions to authenticated;
grant select, insert, update, delete on table public.messages to authenticated;
grant select, insert, update, delete on table public.chess_tasks to authenticated;
grant select, insert, update, delete on table public.chess_games to authenticated;

-- Needed for UUID defaults/identity helpers if these tables later use sequences.
grant usage, select on all sequences in schema public to anon, authenticated;

commit;
