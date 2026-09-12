-- =====================================================================
-- SkyySchool — классы, роли, онлайн-тетрадь, статистика, разбор фото
--
-- Это ДОПОЛНЕНИЕ к sql/schema.sql, а не замена. Порядок применения:
--   1. sql/schema.sql          (профили, связи, ДЗ, сообщения, шахматы)
--   2. sql/schema-classes.sql  ← этот файл
--
-- Выполнять можно повторно: всё через "if not exists" и "drop policy
-- if exists", дублей не создаст.
--
-- Зачем отдельный файл: schema.sql уже применён на живой базе. Менять
-- применённый файл — значит не знать, какая версия где раскатана.
-- Отдельная миграция честнее: видно, что было и что добавилось.
--
-- Порядок внутри файла — сначала ВСЕ таблицы, потом функции, потом
-- политики. Не для красоты: функции на language sql проверяют своё
-- тело прямо при создании, поэтому функция, которая смотрит в classes,
-- не может быть объявлена раньше самой таблицы classes. А политики
-- таблиц ссылаются на функции. Отсюда три блока именно в этом порядке.
--
-- Проверено на живом PostgreSQL 16: см. sql/tests/ — там заглушка
-- Supabase и тесты, которые реально проверяют, что ученик не видит
-- чужих данных.
-- =====================================================================


-- =====================================================================
-- ЧАСТЬ 1. Таблицы
-- =====================================================================

-- ---------- роль admin ----------
-- В schema.sql роли были student / teacher / parent. Добавляем admin,
-- не трогая уже существующие строки.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student','teacher','parent','admin'));


-- ---------- семья: родитель ↔ ребёнок ----------
-- В schema.sql роль parent была, а связи «чей это родитель» не было,
-- то есть роль ничего не давала. Вот она.
create table if not exists family_links (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references profiles on delete cascade,
  child_id   uuid references profiles on delete cascade,
  created_at timestamptz default now(),
  unique (parent_id, child_id),
  check (parent_id <> child_id)
);
alter table family_links enable row level security;


-- ---------- классы ----------
create or replace function gen_invite_code()
returns text language sql volatile as $$
  -- 6 символов: коротко, чтобы продиктовать голосом. Буквы I, O и
  -- цифры 1, 0 выкинуты — их путают при переписывании с доски.
  select string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
           (floor(random() * 32) + 1)::int, 1), '')
  from generate_series(1, 6);
$$;

create table if not exists classes (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references profiles on delete cascade,
  name        text not null,
  invite_code text unique not null default gen_invite_code(),
  created_at  timestamptz default now()
);
alter table classes enable row level security;


-- ---------- состав класса ----------
create table if not exists class_members (
  class_id      uuid references classes on delete cascade,
  user_id       uuid references profiles on delete cascade,
  role_in_class text default 'student' check (role_in_class in ('student','assistant')),
  joined_at     timestamptz default now(),
  primary key (class_id, user_id)
);
alter table class_members enable row level security;


-- ---------- онлайн-тетрадь ----------
-- state — весь холст и текст одним jsonb. Хранить каждый штрих
-- отдельной строкой заманчиво, но тогда при обрыве связи придётся
-- сшивать порядок штрихов вручную; для занятия один-на-один снимок
-- состояния проще и надёжнее.
create table if not exists notebook_sessions (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid references classes on delete set null,
  teacher_id  uuid references profiles on delete cascade,
  student_id  uuid references profiles on delete cascade,
  started_at  timestamptz default now(),
  ended_at    timestamptz,
  state       jsonb default '{}'::jsonb
);
alter table notebook_sessions enable row level security;


-- ---------- попытки решения заданий ----------
-- Сейчас прогресс тренажёра живёт в localStorage и учителю не виден.
-- Чтобы кабинет учителя мог показать «у этого ученика плохо с
-- логарифмами», попытки нужно писать в базу.
create table if not exists task_attempts (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid references profiles on delete cascade,
  bank       text not null,
  task_id    text not null,
  topic      text,
  correct    boolean not null,
  created_at timestamptz default now()
);
alter table task_attempts enable row level security;

create index if not exists task_attempts_student_idx on task_attempts (student_id, created_at desc);
create index if not exists task_attempts_topic_idx   on task_attempts (student_id, bank, topic);


-- ---------- разбор фото тетради ----------
-- Почему НЕ в таблицу homework: homework — это «задание, которое
-- учитель выдал». Распознанный текст, оценка и разбор ошибок — это
-- «работа, которую ученик сдал». Свалив их в одну таблицу, получим
-- строки, где половина колонок всегда пустая, и сломаем существующую
-- выдачу ДЗ. Поэтому отдельная таблица со ссылкой на homework —
-- необязательной, потому что фото можно прислать и просто так.
create table if not exists photo_checks (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references profiles on delete cascade,
  homework_id     uuid references homework on delete set null,
  subject         text default 'english',
  image_url       text,
  recognized_text text,
  grade           int check (grade is null or grade between 1 and 5),
  errors          jsonb default '[]'::jsonb,
  feedback        text,
  status          text default 'ok' check (status in ('ok','failed','pending')),
  created_at      timestamptz default now()
);
alter table photo_checks enable row level security;

create index if not exists photo_checks_student_idx on photo_checks (student_id, created_at desc);


-- =====================================================================
-- ЧАСТЬ 2. Вспомогательные функции
--
-- Зачем security definer. Политика RLS одной таблицы часто должна
-- заглянуть в другую («этот класс мой?»). Но у той, другой таблицы
-- тоже есть RLS — и если её политика в свою очередь смотрит обратно,
-- Postgres уходит в бесконечную рекурсию и падает с ошибкой
-- "infinite recursion detected in policy". Функция с security definer
-- выполняется с правами владельца и RLS внутри себя не применяет —
-- это штатный приём Supabase ровно для этого случая.
--
-- search_path прибит гвоздями специально: без этого security definer
-- функция — известная дыра (вызывающий может подсунуть свою схему
-- с поддельной таблицей classes и получить чужие права).
-- =====================================================================

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_class_teacher(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes where id = cid and teacher_id = auth.uid());
$$;

create or replace function is_class_member(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from class_members where class_id = cid and user_id = auth.uid());
$$;

-- «Я учу этого ученика?» — либо прямая подписка из links, либо общий класс.
create or replace function teaches_student(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from links
    where teacher_id = auth.uid() and student_id = sid and status = 'active'
  ) or exists (
    select 1
    from class_members cm
    join classes c on c.id = cm.class_id
    where c.teacher_id = auth.uid() and cm.user_id = sid
  );
$$;

-- «Это мой ребёнок?»
create or replace function is_parent_of(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from family_links where parent_id = auth.uid() and child_id = sid
  );
$$;

-- Кто вообще имеет право видеть данные ученика: он сам, его учитель,
-- его родитель, администратор. Собрано в одном месте, чтобы во всех
-- политиках было одинаковое правило, а не пять разных.
create or replace function can_view_student(sid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() = sid
      or teaches_student(sid)
      or is_parent_of(sid)
      or is_admin();
$$;


-- =====================================================================
-- ЧАСТЬ 3. Политики доступа (RLS)
-- =====================================================================

-- ---------- family_links ----------
drop policy if exists fam_read on family_links;
create policy fam_read on family_links for select
  using (auth.uid() = parent_id or auth.uid() = child_id or is_admin());

-- Привязку создаёт сам ребёнок (подтверждает родителя) или админ.
-- Иначе любой желающий объявил бы себя родителем чужого ученика и
-- получил доступ к его оценкам.
drop policy if exists fam_write on family_links;
create policy fam_write on family_links for insert
  with check (auth.uid() = child_id or is_admin());

drop policy if exists fam_delete on family_links;
create policy fam_delete on family_links for delete
  using (auth.uid() = child_id or auth.uid() = parent_id or is_admin());


-- ---------- classes ----------
drop policy if exists cls_read on classes;
create policy cls_read on classes for select
  using (auth.uid() = teacher_id or is_class_member(id) or is_admin());

drop policy if exists cls_write on classes;
create policy cls_write on classes for insert
  with check (auth.uid() = teacher_id);

drop policy if exists cls_update on classes;
create policy cls_update on classes for update
  using (auth.uid() = teacher_id or is_admin());

drop policy if exists cls_delete on classes;
create policy cls_delete on classes for delete
  using (auth.uid() = teacher_id or is_admin());


-- ---------- class_members ----------
drop policy if exists cm_read on class_members;
create policy cm_read on class_members for select
  using (auth.uid() = user_id or is_class_teacher(class_id) or is_admin());

-- Вступление по коду: ученик добавляет ТОЛЬКО сам себя. Учитель может
-- добавить кого угодно в свой класс.
drop policy if exists cm_write on class_members;
create policy cm_write on class_members for insert
  with check (auth.uid() = user_id or is_class_teacher(class_id) or is_admin());

drop policy if exists cm_delete on class_members;
create policy cm_delete on class_members for delete
  using (auth.uid() = user_id or is_class_teacher(class_id) or is_admin());


-- ---------- notebook_sessions ----------
drop policy if exists nb_read on notebook_sessions;
create policy nb_read on notebook_sessions for select
  using (
    auth.uid() = teacher_id
    or auth.uid() = student_id
    or is_parent_of(student_id)
    or is_admin()
  );

drop policy if exists nb_write on notebook_sessions;
create policy nb_write on notebook_sessions for insert
  with check (auth.uid() = teacher_id and teaches_student(student_id));

-- Писать в тетрадь во время занятия могут оба: учитель рисует поверх,
-- ученик пишет своё. Родитель только смотрит — его тут нет намеренно.
drop policy if exists nb_update on notebook_sessions;
create policy nb_update on notebook_sessions for update
  using (auth.uid() = teacher_id or auth.uid() = student_id);

drop policy if exists nb_delete on notebook_sessions;
create policy nb_delete on notebook_sessions for delete
  using (auth.uid() = teacher_id or is_admin());


-- ---------- task_attempts ----------
-- Заметьте: тут нет политик update и delete. Это намеренно —
-- переписать историю своих ошибок нельзя, иначе статистика
-- превращается в самоотчёт.
drop policy if exists ta_read on task_attempts;
create policy ta_read on task_attempts for select
  using (can_view_student(student_id));

drop policy if exists ta_write on task_attempts;
create policy ta_write on task_attempts for insert
  with check (auth.uid() = student_id);


-- ---------- photo_checks ----------
drop policy if exists pc_read on photo_checks;
create policy pc_read on photo_checks for select
  using (can_view_student(student_id));

drop policy if exists pc_write on photo_checks;
create policy pc_write on photo_checks for insert
  with check (auth.uid() = student_id);

-- Оценку правит учитель: ИИ ошибается, последнее слово за человеком.
drop policy if exists pc_update on photo_checks;
create policy pc_update on photo_checks for update
  using (teaches_student(student_id) or is_admin());

drop policy if exists pc_delete on photo_checks;
create policy pc_delete on photo_checks for delete
  using (auth.uid() = student_id or is_admin());


-- =====================================================================
-- ЧАСТЬ 4. Функции приложения, триггеры, живые обновления
-- =====================================================================

-- ---------- вступление в класс по коду ----------
-- Функция нужна потому, что искать класс по коду ученик не может: RLS
-- не даст ему прочитать класс, в котором он ещё не состоит. Курица и
-- яйцо. Функция с security definer разрывает круг: она проверяет код
-- сама и добавляет только вызывающего — подставить чужой id нельзя.
create or replace function join_class(code text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  v_class uuid;
begin
  if auth.uid() is null then
    raise exception 'Нужно войти в аккаунт';
  end if;

  select id into v_class from classes where invite_code = upper(trim(code));
  if v_class is null then
    raise exception 'Класс с таким кодом не найден';
  end if;

  insert into class_members (class_id, user_id)
  values (v_class, auth.uid())
  on conflict (class_id, user_id) do nothing;

  return v_class;
end $$;


-- ---------- слабые темы ученика ----------
-- Порог и сортировку решает вызывающий, функция только считает.
create or replace function weak_topics(sid uuid, min_attempts int default 3)
returns table (bank text, topic text, attempts bigint, wrong bigint, wrong_pct numeric)
language sql stable security definer set search_path = public as $$
  select
    a.bank,
    a.topic,
    count(*)                                             as attempts,
    count(*) filter (where not a.correct)                 as wrong,
    round(100.0 * count(*) filter (where not a.correct) / count(*), 1) as wrong_pct
  from task_attempts a
  where a.student_id = sid
    and can_view_student(sid)   -- права проверяем внутри: функция security definer
    and a.topic is not null
  group by a.bank, a.topic
  having count(*) >= min_attempts
  order by wrong_pct desc, attempts desc;
$$;


-- ---------- защита от спама фотографиями ----------
-- Не чаще одного разбора в 30 секунд на пользователя. Проверка стоит
-- в базе, а не только на клиенте: клиент обходится открытием консоли
-- браузера, база — нет.
create or replace function photo_checks_rate_limit()
returns trigger language plpgsql as $$
declare
  v_last timestamptz;
begin
  select max(created_at) into v_last
  from photo_checks
  where student_id = new.student_id;

  if v_last is not null and now() - v_last < interval '30 seconds' then
    raise exception 'Слишком часто: следующая проверка фото будет доступна через % сек.',
      ceil(extract(epoch from (interval '30 seconds' - (now() - v_last))));
  end if;

  return new;
end $$;

drop trigger if exists photo_checks_rate_limit_trg on photo_checks;
create trigger photo_checks_rate_limit_trg
  before insert on photo_checks
  for each row execute function photo_checks_rate_limit();


-- ---------- живые обновления ----------
-- Без этого тетрадь у второй стороны не будет обновляться сама.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = 'notebook_sessions'
    ) then
      alter publication supabase_realtime add table notebook_sessions;
    end if;
  end if;
end $$;
