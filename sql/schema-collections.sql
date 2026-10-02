-- =====================================================================
-- SkyySchool — подборки заданий по ссылке (collections.html, collection.html)
--
-- Учитель собирает задания (из банка или свои) в подборку и получает
-- ссылку вида collection.html?code=A3K7MN. Ученик открывает ссылку,
-- решает и отправляет; задания с правильным ответом проверяются сразу,
-- открытые — учителем.
--
-- Запускать после sql/schema.sql. Можно выполнять повторно.
--
-- ПОЧЕМУ УЧЕНИК НЕ ЧИТАЕТ ТАБЛИЦУ ПОДБОРОК НАПРЯМУЮ
-- В tasks лежат и правильные ответы. Политика «публичные подборки видны
-- всем» открыла бы их любому, кто пошлёт select через API. Поэтому
-- подборку по коду отдаёт функция get_collection_by_code — задания без
-- ответов, — а проверяет ответы функция submit_collection на сервере.
-- По той же причине ответы ученика пишутся только через неё: прямая
-- вставка позволила бы прислать любой балл.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Таблицы
-- ---------------------------------------------------------------------
create table if not exists public.task_categories (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references auth.users(id) on delete cascade default auth.uid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  subject     text,
  description text,
  created_at  timestamptz default now()
);
create index if not exists task_categories_teacher_idx
  on public.task_categories (teacher_id, created_at desc);

create table if not exists public.task_collections (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid references auth.users(id) on delete cascade default auth.uid(),
  category_id uuid references public.task_categories(id) on delete set null,
  title       text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 2000),
  subject     text,
  share_code  text unique not null,   -- 6 символов без I, O, 1, 0; ставит триггер
  tasks       jsonb not null check (jsonb_typeof(tasks) = 'array'
                                    and jsonb_array_length(tasks) between 1 and 100
                                    and octet_length(tasks::text) <= 300000),
  is_public   boolean default false,  -- открывается по ссылке без входа
  expires_at  timestamptz,            -- null — ссылка бессрочная
  created_at  timestamptz default now()
);
-- Индекс по share_code не нужен отдельно: его уже создаёт unique.
create index if not exists task_collections_teacher_idx
  on public.task_collections (teacher_id, created_at desc);
create index if not exists task_collections_category_idx
  on public.task_collections (category_id);

create table if not exists public.collection_submissions (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid references public.task_collections(id) on delete cascade,
  student_id      uuid references auth.users(id) on delete set null,
  student_name    text,       -- если ученик без аккаунта
  answers         jsonb,      -- [{task_id, answer, correct: true | false | null}]
  score           int,
  percent         numeric,
  teacher_comment text,
  status          text default 'pending' check (status in ('pending','checked')),
  created_at      timestamptz default now()
);
create index if not exists collection_submissions_coll_idx
  on public.collection_submissions (collection_id, created_at desc);
create index if not exists collection_submissions_student_idx
  on public.collection_submissions (student_id);

-- Разбор по заданиям для учителя (teacher-review.html) и класс ученика
-- для выгрузки. Пишет обе колонки только submit_collection.
-- В task_details НЕТ правильных ответов: свою строку может читать и сам
-- ученик (политика ниже), и по ней он узнал бы ответы и пересдал на
-- 100 %. Правильные ответы — в tasks подборки, их видит только учитель.
alter table public.collection_submissions add column if not exists task_details jsonb;
alter table public.collection_submissions add column if not exists student_class text;


-- ---------------------------------------------------------------------
-- 2. Код подборки: 6 символов, как код класса. Буквы I, O и цифры 1, 0
--    выкинуты — их путают, переписывая с доски. Ставится всегда
--    триггером: клиент свой код подставить не может.
-- ---------------------------------------------------------------------
create or replace function public.gen_share_code()
returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
    from generate_series(1, 6);
$$;

-- security definer: иначе под RLS учитель видит только свои коды и не
-- заметил бы совпадение с чужим.
create or replace function public.task_collections_before_insert()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  loop
    v_code := public.gen_share_code();
    exit when not exists (select 1 from public.task_collections c where c.share_code = v_code);
  end loop;
  new.share_code := v_code;
  return new;
end $$;

drop trigger if exists task_collections_share_code on public.task_collections;
create trigger task_collections_share_code
  before insert on public.task_collections
  for each row execute function public.task_collections_before_insert();

-- Код после создания не меняется: ссылка уже у учеников.
create or replace function public.task_collections_keep_code()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.share_code := old.share_code;
  new.teacher_id := old.teacher_id;
  return new;
end $$;

drop trigger if exists task_collections_keep_code on public.task_collections;
create trigger task_collections_keep_code
  before update on public.task_collections
  for each row execute function public.task_collections_keep_code();


-- ---------------------------------------------------------------------
-- 3. Сравнение текстовых ответов: регистр, ё/е, пробелы, запятая в
--    десятичной дроби и точка в конце не важны.
-- ---------------------------------------------------------------------
create or replace function public.norm_answer(t text)
returns text
language sql immutable set search_path = public as $$
  select regexp_replace(
           regexp_replace(
             replace(translate(lower(btrim(coalesce(t, ''))), 'ё', 'е'), ',', '.'),
             '\s+', ' ', 'g'),
           '\.$', '');
$$;


-- ---------------------------------------------------------------------
-- 3a. task_details: что спросили, что ответил ученик и верно ли —
--     [{task_id, type, question, options, student_answer, student_choice,
--       is_correct}]. p_results — проверенные ответы из submit_collection
--     [{task_id, answer, correct}]. is_correct: true / false / null
--     (открытое задание ждёт учителя). Правильных ответов здесь нет —
--     см. комментарий у колонки.
-- ---------------------------------------------------------------------
create or replace function public.collection_task_details(p_tasks jsonb, p_results jsonb)
returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'task_id',        t ->> 'id',
           'type',           coalesce(t ->> 'type', 'text'),
           'question',       t ->> 'text',
           'options',        case when jsonb_typeof(t -> 'options') = 'array' then t -> 'options' else '[]'::jsonb end,
           'student_choice', case when coalesce(t ->> 'type', 'text') = 'choice' and r ->> 'answer' ~ '^\d{1,4}$'
                                  then (r ->> 'answer')::int end,
           'student_answer', case when coalesce(t ->> 'type', 'text') = 'choice'
                                  then case when r ->> 'answer' ~ '^\d{1,4}$' then t -> 'options' ->> (r ->> 'answer')::int end
                                  else nullif(r ->> 'answer', '') end,
           'is_correct',     r -> 'correct')
         order by n), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_tasks) = 'array' then p_tasks else '[]'::jsonb end) with ordinality as x(t, n)
    left join lateral (
      select a as r
        from jsonb_array_elements(case when jsonb_typeof(p_results) = 'array' then p_results else '[]'::jsonb end) as y(a)
       where a ->> 'task_id' = t ->> 'id'
       limit 1) z on true;
$$;


-- ---------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------
alter table public.task_categories        enable row level security;
alter table public.task_collections       enable row level security;
alter table public.collection_submissions enable row level security;

-- категории — только свои
drop policy if exists "categories: read own"   on public.task_categories;
drop policy if exists "categories: insert own" on public.task_categories;
drop policy if exists "categories: update own" on public.task_categories;
drop policy if exists "categories: delete own" on public.task_categories;
create policy "categories: read own"   on public.task_categories for select to authenticated
  using (teacher_id = (select auth.uid()));
create policy "categories: insert own" on public.task_categories for insert to authenticated
  with check (teacher_id = (select auth.uid()));
create policy "categories: update own" on public.task_categories for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy "categories: delete own" on public.task_categories for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- подборки — только свои (ученики — через get_collection_by_code, см. шапку);
-- категория, если указана, тоже своя
drop policy if exists "collections: read own"   on public.task_collections;
drop policy if exists "collections: insert own" on public.task_collections;
drop policy if exists "collections: update own" on public.task_collections;
drop policy if exists "collections: delete own" on public.task_collections;
create policy "collections: read own"   on public.task_collections for select to authenticated
  using (teacher_id = (select auth.uid()));
create policy "collections: insert own" on public.task_collections for insert to authenticated
  with check (teacher_id = (select auth.uid())
              and (category_id is null or exists (select 1 from public.task_categories c
                                                   where c.id = category_id and c.teacher_id = (select auth.uid()))));
create policy "collections: update own" on public.task_collections for update to authenticated
  using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid())
              and (category_id is null or exists (select 1 from public.task_categories c
                                                   where c.id = category_id and c.teacher_id = (select auth.uid()))));
create policy "collections: delete own" on public.task_collections for delete to authenticated
  using (teacher_id = (select auth.uid()));

-- ответы: ученик видит свои, учитель — все по своим подборкам.
-- Вставка — только через submit_collection, оценка — через
-- review_collection_submission; удалить может учитель.
drop policy if exists "submissions: read own or my collections" on public.collection_submissions;
drop policy if exists "submissions: teacher deletes"            on public.collection_submissions;
create policy "submissions: read own or my collections" on public.collection_submissions for select to authenticated
  using (student_id = (select auth.uid())
         or exists (select 1 from public.task_collections c
                     where c.id = collection_id and c.teacher_id = (select auth.uid())));
create policy "submissions: teacher deletes" on public.collection_submissions for delete to authenticated
  using (exists (select 1 from public.task_collections c
                  where c.id = collection_id and c.teacher_id = (select auth.uid())));

-- Права на таблицы: какие строки видно — решает RLS выше, а есть ли
-- доступ к таблице вообще — grant. В новых проектах Supabase он не
-- выдаётся сам. Аноним таблиц не видит вовсе, только функции ниже.
revoke all on table public.task_categories, public.task_collections, public.collection_submissions from anon;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant select, insert, update, delete on table public.task_categories, public.task_collections to authenticated;
    grant select, delete on table public.collection_submissions to authenticated;
    revoke insert, update on table public.collection_submissions from authenticated;
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 5. Подборка по коду — для ученика, в том числе без входа.
--    Задания БЕЗ правильных ответов. Ошибки: not_found, expired,
--    login_required (подборка не публичная, а ученик не вошёл).
-- ---------------------------------------------------------------------
create or replace function public.get_collection_by_code(p_code text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_row public.task_collections%rowtype;
begin
  select * into v_row from public.task_collections
   where share_code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_row.expires_at is not null and v_row.expires_at <= now() then
    return jsonb_build_object('error', 'expired');
  end if;
  if not coalesce(v_row.is_public, false) and auth.uid() is null then
    return jsonb_build_object('error', 'login_required');
  end if;
  return jsonb_build_object(
    'id',          v_row.id,
    'code',        v_row.share_code,
    'title',       v_row.title,
    'description', v_row.description,
    'subject',     v_row.subject,
    'expires_at',  v_row.expires_at,
    'teacher',     (select p.name from public.profiles p where p.id = v_row.teacher_id),
    'tasks',       coalesce((
       select jsonb_agg(jsonb_build_object(
                'id',      t ->> 'id',
                'type',    coalesce(t ->> 'type', 'text'),
                'text',    t ->> 'text',
                'options', case when jsonb_typeof(t -> 'options') = 'array' then t -> 'options' else '[]'::jsonb end)
              order by n)
         from jsonb_array_elements(v_row.tasks) with ordinality as x(t, n)), '[]'::jsonb)
  );
end $$;


-- ---------------------------------------------------------------------
-- 6. Отправить ответы. p_answers: [{task_id, answer}]; для выбора
--    варианта answer — номер варианта с нуля. p_student_class — класс
--    ученика («7Б»), необязательно: для выгрузки учителю.
--    Проверяет сразу всё, где есть правильный ответ; открытые задания
--    (без ответа) ждут учителя — тогда статус pending. Разбор по
--    заданиям (task_details) собирает сама функция из этой проверки:
--    присланному из браузера «верно» верить нельзя.
--    Ответ ученику: {ok, correct, auto, open, total} — «Верно: 7/10».
--
--    Прежняя версия — с тремя параметрами — осталась (ниже) и просто
--    зовёт эту без класса: страницы, открытые до обновления, работают.
--    У p_student_class нет значения по умолчанию нарочно: иначе вызов с
--    тремя параметрами подходил бы к обеим функциям.
-- ---------------------------------------------------------------------
create or replace function public.submit_collection(p_code text, p_student_name text, p_answers jsonb,
                                                    p_student_class text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_coll    public.task_collections%rowtype;
  v_uid     uuid := auth.uid();
  v_name    text := nullif(btrim(coalesce(p_student_name, '')), '');
  v_class   text := nullif(left(regexp_replace(btrim(coalesce(p_student_class, '')), '\s+', ' ', 'g'), 20), '');
  v_task    jsonb;
  v_given   text;
  v_ok      boolean;
  v_results jsonb := '[]'::jsonb;
  v_correct int := 0;
  v_auto    int := 0;
  v_open    int := 0;
  v_total   int;
  v_id      uuid;
begin
  select * into v_coll from public.task_collections
   where share_code = upper(btrim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;
  if v_coll.expires_at is not null and v_coll.expires_at <= now() then
    return jsonb_build_object('error', 'expired');
  end if;
  if not coalesce(v_coll.is_public, false) and v_uid is null then
    return jsonb_build_object('error', 'login_required');
  end if;
  if v_name is null and v_uid is not null then
    select nullif(btrim(p.name), '') into v_name from public.profiles p where p.id = v_uid;
  end if;
  if v_name is null then
    return jsonb_build_object('error', 'name_required');
  end if;
  v_name := left(v_name, 100);
  if jsonb_typeof(p_answers) is distinct from 'array' or octet_length(p_answers::text) > 200000 then
    return jsonb_build_object('error', 'bad_answers');
  end if;
  -- защита от двойного нажатия и от засорения подборки
  if exists (select 1 from public.collection_submissions s
              where s.collection_id = v_coll.id
                and s.created_at > now() - interval '20 seconds'
                and (s.student_id = v_uid or (v_uid is null and s.student_id is null and s.student_name = v_name))) then
    return jsonb_build_object('error', 'too_fast');
  end if;
  if (select count(*) from public.collection_submissions s where s.collection_id = v_coll.id) >= 2000 then
    return jsonb_build_object('error', 'full');
  end if;

  v_total := jsonb_array_length(v_coll.tasks);
  for v_task in select t from jsonb_array_elements(v_coll.tasks) as x(t) loop
    select left(coalesce(a ->> 'answer', ''), 2000) into v_given
      from jsonb_array_elements(p_answers) as y(a)
     where a ->> 'task_id' = v_task ->> 'id'
     limit 1;
    v_given := coalesce(v_given, '');

    -- номер варианта — не длиннее 4 цифр: «99999999999» не помещается в
    -- int, и раньше на нём падала вся отправка; case — чтобы до
    -- приведения к int доходило только число
    if coalesce(v_task ->> 'type', 'text') = 'choice' and (v_task ->> 'answer') ~ '^\d{1,4}$' then
      v_ok := case when v_given ~ '^\d{1,4}$' then v_given::int = (v_task ->> 'answer')::int else false end;
      v_auto := v_auto + 1;
    elsif jsonb_typeof(v_task -> 'accept') = 'array' and jsonb_array_length(v_task -> 'accept') > 0 then
      v_ok := public.norm_answer(v_given) <> ''
              and exists (select 1 from jsonb_array_elements_text(v_task -> 'accept') as z(x)
                           where public.norm_answer(x) = public.norm_answer(v_given));
      v_auto := v_auto + 1;
    else
      v_ok := null;                 -- открытое задание: решит учитель
      v_open := v_open + 1;
    end if;
    if v_ok then v_correct := v_correct + 1; end if;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'task_id', v_task ->> 'id', 'answer', v_given, 'correct', v_ok));
  end loop;

  insert into public.collection_submissions
    (collection_id, student_id, student_name, student_class, answers, task_details, score, percent, status)
  values
    (v_coll.id, v_uid, v_name, v_class, v_results, public.collection_task_details(v_coll.tasks, v_results), v_correct,
     round(v_correct * 100.0 / greatest(v_total, 1), 1),
     case when v_open > 0 then 'pending' else 'checked' end)
  returning id into v_id;

  -- id — чтобы страница попросила Worker сообщить учителю в Telegram
  -- (/api/notify-submission): тот найдёт работу по id и отправит одно
  -- сообщение. Прежние поля ответа — как были.
  return jsonb_build_object('ok', true, 'id', v_id, 'correct', v_correct, 'auto', v_auto, 'open', v_open, 'total', v_total);
end $$;

create or replace function public.submit_collection(p_code text, p_student_name text, p_answers jsonb)
returns jsonb
language sql volatile set search_path = public as $$
  select public.submit_collection(p_code, p_student_name, p_answers, null::text);
$$;


-- ---------------------------------------------------------------------
-- 7. Учитель проверяет ответы: p_marks — {task_id: true | false}
--    (для открытых заданий, но можно поправить и автопроверку),
--    p_comment — комментарий ученику (null — не менять).
--    Балл и процент пересчитываются; когда открытых без оценки не
--    осталось — статус checked. В task_details «верно» ставится то же.
-- ---------------------------------------------------------------------
create or replace function public.review_collection_submission(p_id uuid, p_marks jsonb, p_comment text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_sub     public.collection_submissions%rowtype;
  v_total   int;
  v_answers jsonb;
  v_correct int;
begin
  select s.* into v_sub from public.collection_submissions s
    join public.task_collections c on c.id = s.collection_id
   where s.id = p_id and c.teacher_id = auth.uid()
   for update of s;
  if not found then
    raise exception 'submission not found' using errcode = '42501';
  end if;
  if p_marks is not null and jsonb_typeof(p_marks) is distinct from 'object' then
    raise exception 'marks must be an object' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(
           case when p_marks ? (a ->> 'task_id') and jsonb_typeof(p_marks -> (a ->> 'task_id')) = 'boolean'
                then jsonb_set(a, '{correct}', p_marks -> (a ->> 'task_id'))
                else a end
           order by n), '[]'::jsonb)
    into v_answers
    from jsonb_array_elements(coalesce(v_sub.answers, '[]'::jsonb)) with ordinality as x(a, n);

  select count(*) filter (where (a ->> 'correct') = 'true') into v_correct
    from jsonb_array_elements(v_answers) as y(a);
  select jsonb_array_length(c.tasks) into v_total from public.task_collections c where c.id = v_sub.collection_id;

  update public.collection_submissions s set
    answers         = v_answers,
    task_details    = case when jsonb_typeof(s.task_details) = 'array' then (
                        select coalesce(jsonb_agg(
                                 case when p_marks ? (d ->> 'task_id') and jsonb_typeof(p_marks -> (d ->> 'task_id')) = 'boolean'
                                      then jsonb_set(d, '{is_correct}', p_marks -> (d ->> 'task_id'))
                                      else d end
                                 order by n), '[]'::jsonb)
                          from jsonb_array_elements(s.task_details) with ordinality as x(d, n))
                      else s.task_details end,
    score           = v_correct,
    percent         = round(v_correct * 100.0 / greatest(v_total, 1), 1),
    teacher_comment = case when p_comment is null then s.teacher_comment else left(p_comment, 2000) end,
    status          = case when exists (select 1 from jsonb_array_elements(v_answers) as z(a)
                                         where jsonb_typeof(a -> 'correct') = 'null' or not (a ? 'correct'))
                           then 'pending' else 'checked' end
   where s.id = p_id
  returning to_jsonb(s.*) into v_answers;
  return v_answers;
end $$;


-- ---------------------------------------------------------------------
-- 7a. Отправкам до появления task_details — разбор из их же ответов.
--     Повторный запуск ничего не меняет.
-- ---------------------------------------------------------------------
update public.collection_submissions s
   set task_details = public.collection_task_details(c.tasks, s.answers)
  from public.task_collections c
 where c.id = s.collection_id and s.task_details is null;


-- ---------------------------------------------------------------------
-- 8. Права на функции
-- ---------------------------------------------------------------------
revoke all on function public.get_collection_by_code(text)                     from public;
revoke all on function public.submit_collection(text, text, jsonb)             from public;
revoke all on function public.submit_collection(text, text, jsonb, text)       from public;
revoke all on function public.collection_task_details(jsonb, jsonb)            from public;
revoke all on function public.review_collection_submission(uuid, jsonb, text)  from public;
revoke all on function public.gen_share_code()                                 from public;
revoke all on function public.task_collections_before_insert()                 from public;
revoke all on function public.task_collections_keep_code()                     from public;
do $$
begin
  -- В Supabase новые функции по умолчанию доступны anon и authenticated —
  -- служебные (код, триггеры) закрываем явно.
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.review_collection_submission(uuid, jsonb, text) from anon;
    revoke all on function public.gen_share_code() from anon;
    revoke all on function public.task_collections_before_insert() from anon;
    revoke all on function public.task_collections_keep_code() from anon;
    revoke all on function public.collection_task_details(jsonb, jsonb) from anon;
    grant execute on function public.get_collection_by_code(text)               to anon;
    grant execute on function public.submit_collection(text, text, jsonb)       to anon;
    grant execute on function public.submit_collection(text, text, jsonb, text) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on function public.gen_share_code() from authenticated;
    revoke all on function public.task_collections_before_insert() from authenticated;
    revoke all on function public.task_collections_keep_code() from authenticated;
    revoke all on function public.collection_task_details(jsonb, jsonb) from authenticated;
    grant execute on function public.get_collection_by_code(text)                    to authenticated;
    grant execute on function public.submit_collection(text, text, jsonb)            to authenticated;
    grant execute on function public.submit_collection(text, text, jsonb, text)      to authenticated;
    grant execute on function public.review_collection_submission(uuid, jsonb, text) to authenticated;
  end if;
end $$;

commit;
