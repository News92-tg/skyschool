-- Таблица пользовательских шахматных задач для конструктора.
create table if not exists public.chess_custom_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'general',
  difficulty text not null default 'easy',
  fen text not null,
  solutions text[] not null default '{}',
  idea text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chess_custom_tasks enable row level security;

create policy "chess custom tasks select own"
on public.chess_custom_tasks for select
using (auth.uid() = user_id);

create policy "chess custom tasks insert own"
on public.chess_custom_tasks for insert
to authenticated
with check (auth.uid() = user_id);

create policy "chess custom tasks update own"
on public.chess_custom_tasks for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chess custom tasks delete own"
on public.chess_custom_tasks for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists chess_custom_tasks_user_id_idx
on public.chess_custom_tasks(user_id, created_at desc);
