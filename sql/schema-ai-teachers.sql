-- =====================================================================
-- SkyySchool — AI-учителя, отзывы, фото-домашка, шахматные партии
--
-- Третья миграция. Порядок применения:
--   1. sql/schema.sql
--   2. sql/schema-classes.sql
--   3. sql/schema-ai-teachers.sql  ← этот файл
--
-- Выполняется повторно без последствий.
--
-- ---------------------------------------------------------------------
-- Две вещи, которые сделаны НЕ буквально по заданию. Обе намеренно.
--
-- 1. Таблица для фото-домашки называется photo_checks, а не homework.
--    Имя homework в этой базе занято таблицей «задание, которое выдал
--    живой учитель». Она ещё используется страницей homework.html.
--    Переименовать её прямо сейчас — сломать работающую страницу
--    раньше, чем мы осознанно её удалим. Когда живых учителей будут
--    убирать совсем (это отдельный шаг, см. README), старую таблицу
--    можно снести, а эту переименовать одной строкой.
--
-- 2. Системные промпты шести базовых учителей НЕ продублированы сюда
--    INSERT-ами. Они лежат в data/ai-teachers.js, а здесь у базовых
--    учителей style_prompt = null.
--    Причина: файл нужен в любом случае — сайт обязан работать без
--    Supabase и офлайн, иначе в локальном режиме выбирать будет не из
--    кого. Положив тот же текст ещё и в базу, мы получим два
--    источника правды, которые разойдутся при первой же правке
--    формулировки, и никто не заметит, какой из них работает.
--    Поэтому: базовые учителя — строка с метаданными (чтобы отзывам
--    и рейтингу было на что ссылаться), текст промпта из файла;
--    пользовательские учителя — полностью из базы, там style_prompt
--    заполнен.
-- ---------------------------------------------------------------------
--
-- Про роли. В задании сказано оставить только student и admin.
-- Здесь роли НЕ трогаются: в базе уже могут быть аккаунты с ролями
-- teacher и parent, и сузить ограничение — значит уронить миграцию на
-- живых данных. Сужение роли относится к удалению системы живых
-- учителей, а не к добавлению AI-учителей. Миграция, которая только
-- добавляет, не должна ломать существующие аккаунты.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Выбранный учитель хранится в профиле
-- ---------------------------------------------------------------------
-- Нужно, чтобы выбор переезжал на другое устройство. Основное
-- хранилище всё равно localStorage: выбор учителя не должен ждать
-- сеть и не должен пропадать, когда сети нет.
alter table profiles add column if not exists ai_teacher text;


-- ---------------------------------------------------------------------
-- 2. AI-учителя
-- ---------------------------------------------------------------------
create table if not exists teachers_ai (
  id           text primary key,
  name         text not null,
  emoji        text default '🧑‍🏫',
  subject      text,                      -- null = универсальный
  role         text not null default 'friend'
               check (role in ('philosopher','examiner','friend','scientist','coach','kid')),
  style_note   text,                      -- короткое описание для карточки
  style_prompt text,                      -- у встроенных null: текст в data/ai-teachers.js
  strictness   int  not null default 3 check (strictness between 1 and 5),
  languages    text[] not null default '{ru}',
  goals        text[] not null default '{}',
  rating_avg   numeric(3,2) not null default 0,
  rating_count int not null default 0,
  is_public    boolean not null default true,
  is_builtin   boolean not null default false,
  created_by   uuid references profiles on delete cascade,
  created_at   timestamptz default now()
);
alter table teachers_ai enable row level security;

create index if not exists teachers_ai_public_idx on teachers_ai (is_public, subject);

-- Видно: всех публичных, своих собственных и всё — администратору.
drop policy if exists tai_read on teachers_ai;
create policy tai_read on teachers_ai for select
  using (is_public or created_by = auth.uid() or is_admin());

-- Создать можно только учителя от своего имени, и только не встроенного:
-- иначе любой желающий подменил бы промпт Сократа для всех сразу.
drop policy if exists tai_write on teachers_ai;
create policy tai_write on teachers_ai for insert
  with check (created_by = auth.uid() and is_builtin = false);

drop policy if exists tai_update on teachers_ai;
create policy tai_update on teachers_ai for update
  using ((created_by = auth.uid() and is_builtin = false) or is_admin());

drop policy if exists tai_delete on teachers_ai;
create policy tai_delete on teachers_ai for delete
  using ((created_by = auth.uid() and is_builtin = false) or is_admin());


-- ---------- шесть базовых учителей ----------
-- Только метаданные: текст промпта — в data/ai-teachers.js (см. шапку).
-- on conflict do update намеренно НЕ трогает rating_avg и rating_count:
-- повторный прогон миграции не должен обнулять накопленные отзывы.
insert into teachers_ai (id, name, emoji, role, style_note, strictness, languages, goals, is_builtin, is_public) values
  ('socrates',     'Сократ',                '🏛', 'philosopher',
   'Не даёт готовый ответ. Задаёт вопросы, пока вы не додумаетесь сами.',
   3, '{ru,en}', '{improve,self,olympiad}', true, true),

  ('strict-peter', 'Строгий Пётр',          '📐', 'examiner',
   'Экзаменатор. Требует точных формулировок и говорит, где на экзамене снимут балл.',
   5, '{ru,en}', '{ege,oge}', true, true),

  ('kind-max',     'Добрый Макс',           '🙂', 'friend',
   'Объясняет простыми словами и на бытовых примерах. Замечает прогресс.',
   2, '{ru,en}', '{improve,self}', true, true),

  ('lomonosov',    'Профессор Ломоносов',   '🔭', 'scientist',
   'Академично и вглубь: откуда взялось правило и где оно перестаёт работать.',
   4, '{ru,en}', '{olympiad,improve,self}', true, true),

  ('coach-anya',   'Коуч Аня',              '🎯', 'coach',
   'Держит режим: что учить дальше, сколько и когда.',
   3, '{ru,en}', '{ege,oge,improve}', true, true),

  ('malysh',       'Малыш',                 '🧸', 'kid',
   'Для 5–10 лет: короткие фразы, картинки словами, много похвалы.',
   1, '{ru,en}', '{self,improve}', true, true)
on conflict (id) do update set
  name       = excluded.name,
  emoji      = excluded.emoji,
  role       = excluded.role,
  style_note = excluded.style_note,
  strictness = excluded.strictness,
  languages  = excluded.languages,
  goals      = excluded.goals,
  is_builtin = true;


-- ---------------------------------------------------------------------
-- 3. Отзывы об учителях
-- ---------------------------------------------------------------------
create table if not exists teacher_reviews (
  id         uuid primary key default gen_random_uuid(),
  teacher_id text references teachers_ai on delete cascade,
  user_id    uuid references profiles on delete cascade,
  rating     int not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz default now(),
  unique (teacher_id, user_id)   -- один отзыв на учителя от человека
);
alter table teacher_reviews enable row level security;

-- Отзывы публичные: рейтинг учителя не имеет смысла, если его не видно.
drop policy if exists trv_read on teacher_reviews;
create policy trv_read on teacher_reviews for select using (true);

drop policy if exists trv_write on teacher_reviews;
create policy trv_write on teacher_reviews for insert
  with check (auth.uid() = user_id);

drop policy if exists trv_update on teacher_reviews;
create policy trv_update on teacher_reviews for update
  using (auth.uid() = user_id);

drop policy if exists trv_delete on teacher_reviews;
create policy trv_delete on teacher_reviews for delete
  using (auth.uid() = user_id or is_admin());


-- Средняя оценка пересчитывается триггером, а не клиентом.
-- Клиент видит не обязательно все строки и считал бы среднее по
-- видимой части — то есть показывал бы неверное число.
create or replace function recalc_teacher_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id text;
begin
  v_id := coalesce(new.teacher_id, old.teacher_id);

  update teachers_ai t set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2)
                             from teacher_reviews where teacher_id = v_id), 0),
    rating_count = (select count(*) from teacher_reviews where teacher_id = v_id)
  where t.id = v_id;

  return null;   -- after-триггер, возвращаемое значение не используется
end $$;

drop trigger if exists teacher_reviews_recalc on teacher_reviews;
create trigger teacher_reviews_recalc
  after insert or update or delete on teacher_reviews
  for each row execute function recalc_teacher_rating();


-- ---------------------------------------------------------------------
-- 4. Фото-домашка: привязка к AI-учителю
-- ---------------------------------------------------------------------
-- Сама таблица photo_checks заведена в schema-classes.sql (там же её
-- политики и ограничитель частоты — не чаще одного разбора в 30 секунд).
-- Здесь добавляем то, что нужно новой схеме работы.
alter table photo_checks add column if not exists teacher_id  text references teachers_ai on delete set null;
alter table photo_checks add column if not exists next_step   text;
alter table photo_checks add column if not exists task_text   text;
alter table photo_checks add column if not exists ocr_flagged boolean not null default false;

-- ocr_flagged — ученик нажал «это распознано неверно».
-- Единственный способ узнать, как часто распознавание врёт на почерке:
-- со стороны это не видно, а оценка по неверно прочитанному тексту
-- выглядит убедительно и при этом несправедлива. Флаг ставит сам
-- ученик, поэтому политику update для него надо расширить (ниже).
create index if not exists photo_checks_flagged_idx on photo_checks (ocr_flagged) where ocr_flagged;

-- Политика update у photo_checks в schema-classes.sql разрешала правку
-- только учителю: оценку правит человек, не ученик. Но пожаловаться на
-- распознавание ученик должен уметь сам. Разрешаем ему трогать свою
-- строку — с оговоркой ниже.
drop policy if exists pc_update on photo_checks;
create policy pc_update on photo_checks for update
  using (auth.uid() = student_id or teaches_student(student_id) or is_admin());

-- Оговорка: ученику разрешено менять только ocr_flagged. RLS сама по
-- себе колонки не различает, поэтому остальное сторожит триггер —
-- иначе «пожаловаться на распознавание» превратилось бы в «поставить
-- себе пятёрку».
create or replace function photo_checks_student_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() = old.student_id
     and not (teaches_student(old.student_id) or is_admin()) then
    if new.grade           is distinct from old.grade
    or new.feedback        is distinct from old.feedback
    or new.errors          is distinct from old.errors
    or new.recognized_text is distinct from old.recognized_text
    or new.next_step       is distinct from old.next_step
    or new.student_id      is distinct from old.student_id then
      raise exception 'Ученик может отметить только неверное распознавание, оценку менять нельзя';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists photo_checks_student_guard_trg on photo_checks;
create trigger photo_checks_student_guard_trg
  before update on photo_checks
  for each row execute function photo_checks_student_guard();

-- Разбор хранит и то, что ученик ответил, и то, что модель прочитала.
-- Разделение важное: распознавание рукописного текста ошибается, и
-- когда оценка выглядит несправедливой, первым делом надо смотреть,
-- что именно модель приняла за написанное.


-- ---------------------------------------------------------------------
-- 5. Шахматные партии с разбором ходов
-- ---------------------------------------------------------------------
create table if not exists chess_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles on delete cascade,
  teacher_id  text references teachers_ai on delete set null,
  fen         text,                          -- позиция на момент сохранения
  moves       jsonb not null default '[]'::jsonb,
  evaluations jsonb not null default '[]'::jsonb,
  result      text check (result is null or result in ('win','loss','draw','unfinished')),
  created_at  timestamptz default now()
);
alter table chess_sessions enable row level security;

create index if not exists chess_sessions_user_idx on chess_sessions (user_id, created_at desc);

drop policy if exists cs_read on chess_sessions;
create policy cs_read on chess_sessions for select
  using (auth.uid() = user_id or is_admin());

drop policy if exists cs_write on chess_sessions;
create policy cs_write on chess_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists cs_update on chess_sessions;
create policy cs_update on chess_sessions for update
  using (auth.uid() = user_id);

drop policy if exists cs_delete on chess_sessions;
create policy cs_delete on chess_sessions for delete
  using (auth.uid() = user_id or is_admin());
