-- ============================================================
-- SkyySchool — хранилище фотографий домашки.
--
-- Выполняется в SQL-редакторе Supabase ПОСЛЕ schema.sql,
-- schema-classes.sql и schema-ai-teachers.sql.
--
-- ЧТО ЗДЕСЬ ВАЖНО ПОНЯТЬ ПРО ПРИВАТНОСТЬ.
-- В бакете лежат снимки детских тетрадей. На них видно почерк, имя на
-- обложке, иногда фамилию и класс. Публичный бакет Supabase отдаёт
-- файл каждому, кто знает адрес, а адрес вида
-- <бакет>/<uuid>/2026-09-18.jpg подбирается куда легче, чем кажется:
-- uuid ученика виден в других местах приложения.
--
-- Поэтому бакет закрытый, доступ идёт через временные ссылки
-- (createSignedUrl на час), а политики ниже разрешают ученику работать
-- только со СВОЕЙ папкой. Имя папки — это его auth.uid(), и проверяет
-- это база, а не фронтенд: код страницы подделывается за минуту,
-- политика — нет.
--
-- Имя бакета «homework» не конфликтует с таблицей homework: у файлов и
-- таблиц разные пространства имён. Но путаница в голове возможна,
-- поэтому напоминание: таблица homework — задания от живого учителя,
-- бакет homework — фотографии, таблица photo_checks — их разборы.
-- ============================================================

-- 1. Бакет. Приватный: public = false.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homework', 'homework', false,
  2 * 1024 * 1024,                       -- 2 МБ: браузер жмёт до ~1.2 МБ, запас на HEIC
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- 2. Политики доступа к файлам.
-- Первый сегмент пути — папка ученика, и он обязан совпадать с
-- auth.uid(). storage.foldername(name) возвращает массив сегментов,
-- [1] — первый.

drop policy if exists hw_insert_own on storage.objects;
create policy hw_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'homework'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists hw_select_own on storage.objects;
create policy hw_select_own on storage.objects for select to authenticated
  using (
    bucket_id = 'homework'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Удалять свои снимки ученик может: это его фотографии.
drop policy if exists hw_delete_own on storage.objects;
create policy hw_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'homework'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Перезаписывать существующий файл незачем: в имени стоит отметка
-- времени, и оно всегда новое. Политики update нет намеренно —
-- меньше поверхностей, на которых можно ошибиться.

-- Учитель видит снимки своих учеников: иначе проверять по фото
-- бессмысленно. Связь берём из таблицы links (ученик ↔ учитель),
-- она заведена в schema.sql.
drop policy if exists hw_select_teacher on storage.objects;
create policy hw_select_teacher on storage.objects for select to authenticated
  using (
    bucket_id = 'homework'
    and exists (
      select 1 from public.links l
      where l.teacher_id = auth.uid()
        and l.student_id::text = (storage.foldername(name))[1]
    )
  );


-- 3. Поля в photo_checks под новый разбор.
-- image_path — путь в бакете, а не готовая ссылка: ссылки временные,
-- хранить их бессмысленно, они протухнут раньше, чем понадобятся.
alter table public.photo_checks add column if not exists image_path text;

-- kind разводит два разных события, которые раньше сливались в одно:
--   'homework' — ученик прислал свою работу, её проверили;
--   'task'     — ученик сфотографировал условие, его разобрали.
-- Без этого поля в истории «решено за тебя» и «проверено у тебя»
-- выглядят одинаково, а это разные вещи и для ученика, и для учителя.
alter table public.photo_checks add column if not exists kind text
  not null default 'homework';

alter table public.photo_checks drop constraint if exists photo_checks_kind_chk;
alter table public.photo_checks add constraint photo_checks_kind_chk
  check (kind in ('homework','task'));

create index if not exists photo_checks_kind_idx on public.photo_checks (student_id, kind, created_at desc);


-- 4. Проверка после выполнения: бакет закрыт, политик четыре.
-- select id, public from storage.buckets where id = 'homework';
-- select policyname from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' and policyname like 'hw\_%';
