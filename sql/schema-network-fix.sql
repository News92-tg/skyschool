-- SkyySchool — network/auth hardening for Supabase
-- Run this AFTER sql/schema.sql in Supabase SQL Editor.
-- Safe to run repeatedly.

-- Keep profile data in sync with Supabase Auth metadata, including emoji.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, emoji)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data->>'role' in ('student','teacher','parent')
        then new.raw_user_meta_data->>'role'
      else 'student'
    end,
    nullif(new.raw_user_meta_data->>'emoji', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    role = excluded.role,
    emoji = coalesce(excluded.emoji, public.profiles.emoji);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keep chess game timestamps current on every move/side join.
create or replace function public.touch_chess_game_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists chess_games_touch_updated_at on public.chess_games;
create trigger chess_games_touch_updated_at
before update on public.chess_games
for each row execute function public.touch_chess_game_updated_at();

-- Realtime is required for the second device/tab to receive moves instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'chess_games'
  ) then
    alter publication supabase_realtime add table public.chess_games;
  end if;
end $$;
