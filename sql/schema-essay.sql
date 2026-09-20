-- =====================================================================
-- SkyySchool — разбор сочинений
--
-- Это ДОПОЛНЕНИЕ к sql/schema.sql и sql/schema-classes.sql, а не замена.
-- Порядок применения:
--   1. sql/schema.sql
--   2. sql/schema-classes.sql
--   3. sql/schema-essay.sql   ← этот файл
--
-- Выполнять можно повторно: всё через "if not exists" и "drop policy
-- if exists", дублей не создаст.
--
-- family_links для родительского кабинета уже есть в schema-classes.sql
-- (family_links + is_parent_of() + can_view_student()) — здесь ничего
-- не добавляем, дашборд родителя просто читает существующие таблицы
-- через уже развёрнутый can_view_student(). Новая таблица здесь только
-- одна: essay_checks.
-- =====================================================================
 
 
-- ---------- разбор сочинений ----------
-- Отдельная таблица, а не расширение photo_checks: сочинение — это
-- текст, который ученик печатает сам, а не то, что распознаёт Gemini
-- с фотографии. Разная природа входа — разная таблица, чтобы у каждой
-- не было наполовину пустых колонок (image_url тут не нужен, а
-- essay_text в photo_checks был бы лишним).
create table if not exists essay_checks (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid references profiles on delete cascade,
  subject      text default 'russian' check (subject in ('russian','english')),
  prompt_text  text,
  essay_text   text not null,
  scores       jsonb default '{}'::jsonb,
  strengths    jsonb default '[]'::jsonb,
  issues       jsonb default '[]'::jsonb,
  feedback     text,
  next_step    text,
  created_at   timestamptz default now()
);
alter table essay_checks enable row level security;
 
create index if not exists essay_checks_student_idx on essay_checks (student_id, created_at desc);
 
 
-- ---------- политики доступа ----------
-- Тот же принцип, что у photo_checks: видит ученик, его учитель, его
-- родитель (через can_view_student, который уже умеет про family_links)
-- и админ. Пишет только сам ученик. Без update — разбор ИИ не редактируют
-- задним числом, а не согласны с оценкой — переспрашивают заново.
drop policy if exists ec_read on essay_checks;
create policy ec_read on essay_checks for select
  using (can_view_student(student_id));
 
drop policy if exists ec_write on essay_checks;
create policy ec_write on essay_checks for insert
  with check (auth.uid() = student_id);
 
drop policy if exists ec_delete on essay_checks;
create policy ec_delete on essay_checks for delete
  using (auth.uid() = student_id or is_admin());
 
 
-- ---------- защита от спама проверками ----------
-- Проверка сочинения — самый долгий и дорогой запрос к DeepSeek на
-- сайте (до 900 токенов ответа), поэтому лимит строже, чем у фото:
-- не чаще одного разбора в 20 секунд, тем же приёмом, что и у
-- photo_checks_rate_limit в schema-classes.sql.
create or replace function essay_checks_rate_limit()
returns trigger language plpgsql as $$
declare
  v_last timestamptz;
begin
  select max(created_at) into v_last
  from essay_checks
  where student_id = new.student_id;
 
  if v_last is not null and now() - v_last < interval '20 seconds' then
    raise exception 'Слишком часто: следующая проверка сочинения будет доступна через % сек.',
      ceil(extract(epoch from (interval '20 seconds' - (now() - v_last))));
  end if;
 
  return new;
end $$;
 
drop trigger if exists essay_checks_rate_limit_trg on essay_checks;
create trigger essay_checks_rate_limit_trg
  before insert on essay_checks
  for each row execute function essay_checks_rate_limit();
 
