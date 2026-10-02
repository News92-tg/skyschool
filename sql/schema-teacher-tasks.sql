/* ============================================================
   SkyySchool — свои задания учителя («Мои задания» в collections.html)

   Таблица teacher_tasks уже есть (sql/schema-homework.sql): в ней
   учитель хранит задания для проверки домашки по фото (?task=<id>).
   Её же используем для банка своих заданий — второй таблицы с тем же
   смыслом не заводим. Текст задания — прежняя колонка task_text (в
   постановке она называлась question). Добавляются:

     options        jsonb — варианты ответа ["…", "…"], от 2 до 10
     correct_answer text  — если есть варианты: номер верного с нуля
                            ("1"); иначе — верные ответы через «;»;
                            пусто — открытое задание, проверяет учитель
     explanation    text  — объяснение решения: показывается учителю в
                            разборе ошибок (teacher-review.html)
     source         text  — откуда задание: 'manual' (вручную),
                            'photo' (распознано с фото), 'homework'

   Доступ — прежняя политика teacher_tasks_own: учитель читает, пишет,
   правит и удаляет только свои задания. Ученику задание по ссылке
   отдаёт homework_task_get — только id, предмет, текст и дату; новые
   колонки (в том числе правильный ответ) через неё не видны.

   Выполнять после sql/schema-homework.sql. Можно запускать повторно.
   ============================================================ */

begin;

alter table public.teacher_tasks add column if not exists options        jsonb;
alter table public.teacher_tasks add column if not exists correct_answer text;
alter table public.teacher_tasks add column if not exists explanation    text;
alter table public.teacher_tasks add column if not exists source         text not null default 'manual';

-- Учитель не присылает свой id сам: подставит база (политика всё равно
-- не пустит чужой).
alter table public.teacher_tasks alter column teacher_id set default auth.uid();

-- Форма задания. not valid — уже сохранённые строки (задания домашки)
-- не перепроверяются, новые и изменённые — да.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teacher_tasks_shape'
                   and conrelid = 'public.teacher_tasks'::regclass) then
    alter table public.teacher_tasks add constraint teacher_tasks_shape check (
          char_length(btrim(task_text)) between 1 and 4000
      and char_length(subject) between 1 and 40
      and (options is null or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10
                               and octet_length(options::text) <= 8000))
      and (correct_answer is null or char_length(correct_answer) <= 500)
      and (explanation is null or char_length(explanation) <= 4000)
      and source in ('manual', 'photo', 'homework')
    ) not valid;
  end if;
end $$;

-- «Мои задания» с фильтром по предмету
create index if not exists teacher_tasks_teacher_subject_idx
  on public.teacher_tasks (teacher_id, subject, created_at desc);

-- Права: какие строки видно — решает RLS (teacher_tasks_own), а здесь
-- — что вообще можно делать с таблицей. Аноним — ничего; вошедшим —
-- обычные чтение и запись, без truncate/trigger/references (прежний
-- «grant all» давал и их).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.teacher_tasks from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke truncate, references, trigger on table public.teacher_tasks from authenticated;
    grant select, insert, update, delete on table public.teacher_tasks to authenticated;
  end if;
end $$;

commit;
