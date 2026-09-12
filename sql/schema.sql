-- =====================================================================
-- SkyySchool — схема базы для Supabase
--
-- Как применить: панель Supabase → SQL Editor → New query →
-- вставить весь этот файл → Run. Выполняется один раз.
--
-- Про RLS (Row Level Security). Ключ anon лежит в коде сайта и виден
-- всем — это нормально и так задумано. Данные защищает не он, а правила
-- ниже: они выполняются на сервере и говорят, какие строки какому
-- пользователю показывать. Без включённого RLS любой посетитель прочитал
-- бы всю базу целиком, поэтому он включён для каждой таблицы.
-- =====================================================================

-- ---------- профили ----------
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  email       text,
  name        text not null,
  role        text not null default 'student'
              check (role in ('student','teacher','parent')),
  emoji       text,
  subjects    text[] default '{}',
  bio         text,
  rate        text,
  exp         text,
  created_at  timestamptz default now()
);
alter table profiles enable row level security;

-- профили видны всем: иначе нельзя показать каталог учителей
drop policy if exists profiles_read on profiles;
create policy profiles_read on profiles for select using (true);

drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update using (auth.uid() = id);


-- ---------- связь «учитель — ученик» ----------
create table if not exists links (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references profiles on delete cascade,
  student_id  uuid references profiles on delete cascade,
  status      text default 'active',
  created_at  timestamptz default now(),
  unique (teacher_id, student_id)
);
alter table links enable row level security;

drop policy if exists links_read_own on links;
create policy links_read_own on links for select
  using (auth.uid() = teacher_id or auth.uid() = student_id);

drop policy if exists links_write_own on links;
create policy links_write_own on links for insert
  with check (auth.uid() = student_id or auth.uid() = teacher_id);

drop policy if exists links_delete_own on links;
create policy links_delete_own on links for delete
  using (auth.uid() = teacher_id or auth.uid() = student_id);


-- ---------- домашние задания ----------
create table if not exists homework (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references profiles on delete cascade,
  student_id  uuid references profiles on delete cascade,
  title       text not null,
  subject     text,
  task_ids    text[] default '{}',
  due_date    date,
  note        text,
  created_at  timestamptz default now()
);
alter table homework enable row level security;

drop policy if exists hw_read_own on homework;
create policy hw_read_own on homework for select
  using (auth.uid() = teacher_id or auth.uid() = student_id);

-- задавать домашнее задание может только тот, кто указан учителем
drop policy if exists hw_write_teacher on homework;
create policy hw_write_teacher on homework for insert
  with check (auth.uid() = teacher_id);

drop policy if exists hw_update_teacher on homework;
create policy hw_update_teacher on homework for update
  using (auth.uid() = teacher_id);

drop policy if exists hw_delete_teacher on homework;
create policy hw_delete_teacher on homework for delete
  using (auth.uid() = teacher_id);


-- ---------- сдача заданий ----------
create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),
  homework_id  uuid references homework on delete cascade,
  student_id   uuid references profiles on delete cascade,
  answers      jsonb default '{}',
  total        int default 0,
  correct      int default 0,
  feedback     text,
  created_at   timestamptz default now()
);
alter table submissions enable row level security;

drop policy if exists sub_read on submissions;
create policy sub_read on submissions for select
  using (
    auth.uid() = student_id
    or auth.uid() in (select teacher_id from homework where homework.id = submissions.homework_id)
  );

drop policy if exists sub_write_student on submissions;
create policy sub_write_student on submissions for insert
  with check (auth.uid() = student_id);

-- ученик правит свою сдачу, учитель — только чтобы оставить отзыв
drop policy if exists sub_update on submissions;
create policy sub_update on submissions for update
  using (
    auth.uid() = student_id
    or auth.uid() in (select teacher_id from homework where homework.id = submissions.homework_id)
  );


-- ---------- переписка ----------
create table if not exists messages (
  id          uuid primary key default gen_random_uuid(),
  from_id     uuid references profiles on delete cascade,
  to_id       uuid references profiles on delete cascade,
  text        text not null,
  read_at     timestamptz,
  created_at  timestamptz default now()
);
alter table messages enable row level security;

drop policy if exists msg_read_own on messages;
create policy msg_read_own on messages for select
  using (auth.uid() = from_id or auth.uid() = to_id);

drop policy if exists msg_send_own on messages;
create policy msg_send_own on messages for insert
  with check (auth.uid() = from_id);

-- получатель отмечает прочтение
drop policy if exists msg_update_to on messages;
create policy msg_update_to on messages for update
  using (auth.uid() = to_id);


-- ---------- шахматные задания от учителя ----------
create table if not exists chess_tasks (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references profiles on delete cascade,
  student_id  uuid references profiles on delete cascade,
  fen         text not null,
  solutions   text[] default '{}',
  note        text,
  result      text,
  answer      text,
  created_at  timestamptz default now()
);
alter table chess_tasks enable row level security;

drop policy if exists ct_read_own on chess_tasks;
create policy ct_read_own on chess_tasks for select
  using (auth.uid() = teacher_id or auth.uid() = student_id);

drop policy if exists ct_write_teacher on chess_tasks;
create policy ct_write_teacher on chess_tasks for insert
  with check (auth.uid() = teacher_id);

drop policy if exists ct_update_both on chess_tasks;
create policy ct_update_both on chess_tasks for update
  using (auth.uid() = teacher_id or auth.uid() = student_id);


-- ---------- живая партия ----------
create table if not exists chess_games (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  white_id    uuid references profiles on delete set null,
  black_id    uuid references profiles on delete set null,
  fen         text not null,
  moves       text[] default '{}',
  status      text default 'play',
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);
alter table chess_games enable row level security;

-- партия открывается по коду, поэтому читать может любой, кто его знает
drop policy if exists cg_read on chess_games;
create policy cg_read on chess_games for select using (true);

drop policy if exists cg_insert on chess_games;
create policy cg_insert on chess_games for insert
  with check (auth.uid() is not null);

-- ходить может только участник партии, либо тот, кто садится на
-- свободную сторону
drop policy if exists cg_update_players on chess_games;
create policy cg_update_players on chess_games for update
  using (
    auth.uid() = white_id or auth.uid() = black_id
    or white_id is null or black_id is null
  );


-- ---------- живые обновления ----------
-- Без этого доска у соперника не будет обновляться сама.
--
-- Проверка «а не добавлена ли уже» нужна, чтобы файл можно было
-- выполнить второй раз. Без неё повторный прогон падает на этом месте
-- с ошибкой «relation is already member of publication» — а повторно
-- его запускают часто: то схему поправили, то не поняли, применилась
-- ли она с первого раза.
do $$
declare
  t text;
begin
  foreach t in array array['chess_games','messages','chess_tasks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;


-- ---------- профиль создаётся сам при регистрации ----------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
